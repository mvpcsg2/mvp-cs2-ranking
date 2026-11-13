import { neon } from "@neondatabase/serverless";

const json = (data, status = 200, cors = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PBKDF2_ITERATIONS = 600000;
const SESSION_DAYS = 7;

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return base64Url(new Uint8Array(bits));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function emailLink(env, purpose, token) {
  const base = env.AUTH_API_URL || "https://mvp-cs2-api.mvpcsgo2.workers.dev";
  const path = purpose === "verify" ? "/api/auth/verify-email" : "/api/auth/reset-password";
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}
function htmlPage(body) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
async function sendMail(env, { to, subject, heading, message, link, button }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Cloudflare.");
  }
  const safeLink = escapeHtml(link);
  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  const safeButton = escapeHtml(button);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      text: heading + "\n\n" + message + "\n\n" + link,
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#20242a;line-height:1.5"><h2>${safeHeading}</h2><p>${safeMessage}</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#f2a900;color:#20242a;text-decoration:none;border-radius:6px;font-weight:bold">${safeButton}</a></p><p style="font-size:12px;color:#777">Если ты не запрашивал это письмо, просто проигнорируй его.</p></body></html>`,
    }),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Resend delivery failed", response.status, details.slice(0, 400));
    throw new Error("Не удалось отправить письмо. Проверь настройки Resend.");
  }
}
async function rateLimit(sql, request, bucket, limit = 8) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = (await sha256(ip + ":" + bucket)).slice(0, 48);
  const rows = await sql`
    INSERT INTO public.mvp_auth_rate_limits AS rate_limit (bucket_key, window_started_at, hit_count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (bucket_key) DO UPDATE SET
      hit_count = CASE
        WHEN rate_limit.window_started_at < now() - interval '15 minutes' THEN 1
        ELSE rate_limit.hit_count + 1
      END,
      window_started_at = CASE
        WHEN rate_limit.window_started_at < now() - interval '15 minutes' THEN now()
        ELSE rate_limit.window_started_at
      END
    RETURNING hit_count
  `;
  return Number(rows?.[0]?.hit_count || 0) <= limit;
}
async function createEmailToken(sql, userId, purpose) {
  const token = randomToken();
  const digest = await sha256(token);
  const hours = purpose === "verify_email" ? 24 : 1;
  await sql`
    UPDATE public.mvp_auth_email_tokens
    SET consumed_at = now()
    WHERE user_id = ${userId}::uuid AND purpose = ${purpose} AND consumed_at IS NULL
  `;
  await sql`
    INSERT INTO public.mvp_auth_email_tokens (user_id, purpose, token_hash, expires_at)
    VALUES (${userId}::uuid, ${purpose}, ${digest}, now() + make_interval(hours => ${hours}))
  `;
  return token;
}
function bearerToken(request) {
  const value = request.headers.get("Authorization") || "";
  const match = value.match(/^Bearer\s+([A-Za-z0-9_-]{32,})$/i);
  return match?.[1] || "";
}
export async function getSessionUser(sql, request) {
  const token = bearerToken(request);
  if (!token) return null;
  const digest = await sha256(token);
  const rows = await sql`
    SELECT u.id, u.email, u.username, u.role, u.permissions, u.is_banned, u.email_verified_at
    FROM public.mvp_auth_sessions s
    JOIN public.mvp_auth_users u ON u.id = s.user_id
    WHERE s.token_hash = ${digest}
      AND s.expires_at > now()
    LIMIT 1
  `;
  const user = rows?.[0] || null;
  if (!user || user.is_banned || !user.email_verified_at) return null;
  return user;
}
async function createSession(sql, userId) {
  const token = randomToken();
  const digest = await sha256(token);
  await sql`
    INSERT INTO public.mvp_auth_sessions (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${digest}, now() + make_interval(days => ${SESSION_DAYS}))
  `;
  return token;
}
async function readBody(request) {
  const text = await request.text();
  if (text.length > 12000) throw new Error("Слишком большой запрос.");
  try { return JSON.parse(text || "{}"); } catch { throw new Error("Некорректный JSON."); }
}
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    permissions: user.permissions || {},
    email_verified: Boolean(user.email_verified_at),
  };
}

export async function handleAuthRequest(request, env, cors) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/auth/")) return null;
  if (request.method !== "GET" && request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, cors);
  if (!env.DATABASE_URL) return json({ ok: false, error: "DATABASE_URL secret is missing" }, 500, cors);

  const sql = neon(env.DATABASE_URL);
  const path = url.pathname;

  try {
    if (path === "/api/auth/session" && request.method === "GET") {
      const user = await getSessionUser(sql, request);
      return json({ ok: true, user: user ? publicUser(user) : null }, 200, cors);
    }

    if (path === "/api/auth/register" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "register", 5))) return json({ ok: false, error: "Слишком много попыток. Попробуй позже." }, 429, cors);
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "Введи корректный email." }, 400, cors);
      if (username.length < 2 || username.length > 24) return json({ ok: false, error: "Имя пользователя должно содержать от 2 до 24 символов." }, 400, cors);
      if (password.length < 10 || password.length > 128) return json({ ok: false, error: "Пароль должен содержать от 10 до 128 символов." }, 400, cors);
      if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return json({ ok: false, error: "Регистрация временно недоступна: не настроена отправка почты." }, 503, cors);
      const salt = randomToken();
      const hash = await passwordHash(password, salt);
      let inserted;
      try {
        inserted = await sql`
          INSERT INTO public.mvp_auth_users (email, username, password_salt, password_hash)
          VALUES (${email}, ${username}, ${salt}, ${hash})
          RETURNING id, email, username
        `;
      } catch (error) {
        if (String(error?.message || "").toLowerCase().includes("unique")) return json({ ok: false, error: "Аккаунт с таким email уже существует. Попробуй войти или восстановить пароль." }, 409, cors);
        throw error;
      }
      const user = inserted[0];
      const token = await createEmailToken(sql, user.id, "verify_email");
      const link = emailLink(env, "verify", token);
      try {
        await sendMail(env, { to: email, subject: "Подтверди email — MVP CS2 Ranking", heading: "Подтверждение email", message: "Подтверди адрес электронной почты, чтобы активировать аккаунт MVP CS2 Ranking.", link, button: "Подтвердить email" });
      } catch (error) {
        return json({ ok: false, account_created: true, error: error.message, can_resend_verification: true }, 503, cors);
      }
      return json({ ok: true, message: "Аккаунт создан. Проверь почту и подтверди email." }, 201, cors);
    }

    if (path === "/api/auth/resend-verification" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "resend-verification", 5))) return json({ ok: false, error: "Слишком много попыток. Попробуй позже." }, 429, cors);
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ ok: true, message: "Если аккаунт ожидает подтверждения, письмо будет отправлено." }, 200, cors);
      const users = await sql`SELECT id, email, email_verified_at FROM public.mvp_auth_users WHERE email = ${email} LIMIT 1`;
      if (users[0] && !users[0].email_verified_at) {
        const token = await createEmailToken(sql, users[0].id, "verify_email");
        const link = emailLink(env, "verify", token);
        await sendMail(env, { to: email, subject: "Подтверди email — MVP CS2 Ranking", heading: "Подтверждение email", message: "Подтверди адрес электронной почты, чтобы активировать аккаунт MVP CS2 Ranking.", link, button: "Подтвердить email" });
      }
      return json({ ok: true, message: "Если аккаунт ожидает подтверждения, письмо будет отправлено." }, 200, cors);
    }

    if (path === "/api/auth/verify-email" && request.method === "GET") {
      if (!(await rateLimit(sql, request, "verify-email", 10))) return htmlPage("<h2>Слишком много попыток</h2><p>Попробуй позже.</p>");
      const token = url.searchParams.get("token") || "";
      const digest = await sha256(token);
      const adminEmail = String(env.AUTH_ADMIN_EMAIL || "").trim().toLowerCase();
      const verified = token.length >= 32 ? await sql`
        UPDATE public.mvp_auth_users u
        SET email_verified_at = COALESCE(u.email_verified_at, now()),
            role = CASE WHEN lower(u.email) = ${adminEmail} AND ${adminEmail} <> '' THEN 'admin' ELSE u.role END,
            updated_at = now()
        FROM public.mvp_auth_email_tokens t
        WHERE t.user_id = u.id AND t.token_hash = ${digest}
          AND t.purpose = 'verify_email' AND t.consumed_at IS NULL AND t.expires_at > now()
        RETURNING u.id, u.email
      ` : [];
      if (!verified.length) return htmlPage("<!doctype html><html lang='ru'><meta charset='utf-8'><title>Ссылка недействительна</title><body style='font-family:Arial;padding:32px'><h2>Ссылка подтверждения недействительна или устарела</h2><p>Запроси новое письмо подтверждения на сайте.</p></body></html>");
      await sql`UPDATE public.mvp_auth_email_tokens SET consumed_at = now() WHERE token_hash = ${digest}`;
      const site = escapeHtml(env.AUTH_PUBLIC_URL || "https://mvp-cs2-ranking.pages.dev/");
      const adminNotice = String(verified[0].email).toLowerCase() === adminEmail ? "<p>Тебе назначена роль администратора.</p>" : "";
      return htmlPage(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email подтверждён</title><body style="font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:auto;color:#20242a"><h2>Email подтверждён!</h2><p>Аккаунт MVP CS2 Ranking активирован.</p>${adminNotice}<p><a href="${site}" style="display:inline-block;padding:12px 18px;background:#f2a900;color:#20242a;text-decoration:none;border-radius:6px;font-weight:bold">Вернуться на сайт</a></p></body></html>`);
    }

    if (path === "/api/auth/verify-email" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "verify-email", 10))) return json({ ok: false, error: "Слишком много попыток. Попробуй позже." }, 429, cors);
      const body = await readBody(request);
      const token = String(body.token || "");
      if (token.length < 32 || token.length > 128) return json({ ok: false, error: "Ссылка подтверждения недействительна или устарела." }, 400, cors);
      const digest = await sha256(token);
      const adminEmail = String(env.AUTH_ADMIN_EMAIL || "").trim().toLowerCase();
      const verified = await sql`
        UPDATE public.mvp_auth_users u
        SET email_verified_at = COALESCE(u.email_verified_at, now()),
            role = CASE WHEN lower(u.email) = ${adminEmail} AND ${adminEmail} <> '' THEN 'admin' ELSE u.role END,
            updated_at = now()
        FROM public.mvp_auth_email_tokens t
        WHERE t.user_id = u.id AND t.token_hash = ${digest}
          AND t.purpose = 'verify_email' AND t.consumed_at IS NULL AND t.expires_at > now()
        RETURNING u.id, u.email, u.username, u.role, u.permissions, u.email_verified_at
      `;
      if (!verified.length) return json({ ok: false, error: "Ссылка подтверждения недействительна или устарела." }, 400, cors);
      await sql`UPDATE public.mvp_auth_email_tokens SET consumed_at = now() WHERE token_hash = ${digest}`;
      return json({ ok: true, message: "Email подтверждён. Теперь можно войти.", user: publicUser(verified[0]) }, 200, cors);
    }

    if (path === "/api/auth/login" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "login", 10))) return json({ ok: false, error: "Слишком много попыток входа. Попробуй через 15 минут." }, 429, cors);
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rows = await sql`SELECT id, email, username, password_salt, password_hash, role, permissions, is_banned, email_verified_at FROM public.mvp_auth_users WHERE email = ${email} LIMIT 1`;
      const user = rows[0];
      // Do comparable password-hash work for unknown emails to reduce account enumeration by timing.
      const candidate = await passwordHash(password.slice(0, 128), user?.password_salt || "mvp-auth-dummy-salt");
      if (!user || candidate !== user.password_hash || !user.email_verified_at || user.is_banned) {
        return json({ ok: false, error: "Неверный email или пароль. Убедись, что email подтверждён." }, 401, cors);
      }
      const token = await createSession(sql, user.id);
      await sql`DELETE FROM public.mvp_auth_sessions WHERE user_id = ${user.id}::uuid AND expires_at < now()`;
      return json({ ok: true, token, user: publicUser(user), expires_in: SESSION_DAYS * 86400 }, 200, cors);
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      const token = bearerToken(request);
      if (token) await sql`DELETE FROM public.mvp_auth_sessions WHERE token_hash = ${await sha256(token)}`;
      return json({ ok: true }, 200, cors);
    }

    if (path === "/api/auth/forgot-password" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "forgot-password", 5))) return json({ ok: false, error: "Слишком много попыток. Попробуй позже." }, 429, cors);
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const users = EMAIL_RE.test(email)
        ? await sql`SELECT id, email FROM public.mvp_auth_users WHERE email = ${email} AND email_verified_at IS NOT NULL AND is_banned = false LIMIT 1`
        : [];
      if (users[0]) {
        const token = await createEmailToken(sql, users[0].id, "reset_password");
        const link = emailLink(env, "reset", token);
        await sendMail(env, { to: email, subject: "Сброс пароля — MVP CS2 Ranking", heading: "Сброс пароля", message: "По запросу создана ссылка для установки нового пароля. Она действует один час.", link, button: "Изменить пароль" });
      }
      return json({ ok: true, message: "Если подтверждённый аккаунт существует, письмо для восстановления будет отправлено." }, 200, cors);
    }

    if (path === "/api/auth/reset-password" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (token.length < 32 || token.length > 128) return htmlPage("<h2>Ссылка восстановления недействительна</h2>");
      const safeToken = escapeHtml(token);
      return htmlPage(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Новый пароль</title><body style="font-family:Arial,sans-serif;padding:32px;max-width:460px;margin:auto;color:#20242a"><h2>Установить новый пароль</h2><form id="resetForm"><label>Новый пароль (не менее 10 символов)<br><input id="password" type="password" minlength="10" maxlength="128" required autocomplete="new-password" style="box-sizing:border-box;width:100%;padding:12px;margin:10px 0 16px"></label><button style="padding:12px 18px;background:#f2a900;border:0;border-radius:6px;font-weight:bold;cursor:pointer">Сохранить пароль</button></form><p id="message" role="status"></p><script>const token="${safeToken}";document.getElementById("resetForm").addEventListener("submit",async e=>{e.preventDefault();const password=document.getElementById("password").value;const message=document.getElementById("message");message.textContent="Сохраняем…";try{const response=await fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,password})});const result=await response.json();message.textContent=result.message||result.error||"Не удалось изменить пароль";if(result.ok)document.getElementById("resetForm").remove()}catch(_){message.textContent="Ошибка соединения. Попробуй ещё раз."}});</script></body></html>`);
    }

    if (path === "/api/auth/reset-password" && request.method === "POST") {
      if (!(await rateLimit(sql, request, "reset-password", 5))) return json({ ok: false, error: "Слишком много попыток. Попробуй позже." }, 429, cors);
      const body = await readBody(request);
      const token = String(body.token || "");
      const password = String(body.password || "");
      if (password.length < 10 || password.length > 128) return json({ ok: false, error: "Пароль должен содержать от 10 до 128 символов." }, 400, cors);
      const digest = await sha256(token);
      const tokens = await sql`
        SELECT t.id, t.user_id
        FROM public.mvp_auth_email_tokens t
        WHERE t.token_hash = ${digest} AND t.purpose = 'reset_password'
          AND t.consumed_at IS NULL AND t.expires_at > now()
        LIMIT 1
      `;
      if (!tokens[0]) return json({ ok: false, error: "Ссылка восстановления недействительна или устарела." }, 400, cors);
      const salt = randomToken();
      const hash = await passwordHash(password, salt);
      await sql`UPDATE public.mvp_auth_users SET password_salt = ${salt}, password_hash = ${hash}, updated_at = now() WHERE id = ${tokens[0].user_id}::uuid`;
      await sql`UPDATE public.mvp_auth_email_tokens SET consumed_at = now() WHERE id = ${tokens[0].id}::uuid`;
      await sql`DELETE FROM public.mvp_auth_sessions WHERE user_id = ${tokens[0].user_id}::uuid`;
      return json({ ok: true, message: "Пароль изменён. Теперь войди с новым паролем." }, 200, cors);
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  } catch (error) {
    console.error("Auth endpoint failed", path, error?.message || error);
    return json({ ok: false, error: error?.message || "Ошибка сервера авторизации." }, 500, cors);
  }
}
