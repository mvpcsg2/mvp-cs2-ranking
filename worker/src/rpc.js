import { neon } from "@neondatabase/serverless";
import { getSessionUser } from "./auth.js";

const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors}});
const fail=(error,status=400,cors={})=>json({ok:false,error},status,cors);
const PERMISSIONS=["manage_teams","manage_matches","manage_players","manage_trophies","manage_streams","manage_support","manage_bans","manage_news","manage_site_settings"];
const hasPermission=(user,name)=>Boolean(user&&(user.role==="admin"||(user.role==="moderator"&&user.permissions?.[name]===true)));
const isAdmin=user=>Boolean(user&&user.role==="admin");
const cleanPermissions=value=>Object.fromEntries(PERMISSIONS.map(key=>[key,value?.[key]===true]));

function parseBool(value){return value===true||value===1||value==="true";}
async function runRpc(sql,user,name,args,env){
  const p=args||{};
  switch(name){
    case "is_current_user_banned":
      return Boolean(user?.is_banned);

    case "admin_rename_player": {
      if(!hasPermission(user,"manage_players"))throw new Error("Нет разрешения на управление игроками.");
      const id=String(p.p_player_id||"");
      const nickname=String(p.p_new_nickname||"").trim();
      if(!/^\d+$/.test(id)||nickname.length<2||nickname.length>32)throw new Error("Некорректный ID игрока или ник.");
      const rows=await sql`UPDATE public.cs2_players SET nickname=${nickname} WHERE id=${id}::bigint RETURNING id,nickname,photo_url`;
      if(!rows.length)throw new Error("Игрок не найден.");
      return rows[0];
    }

    case "admin_set_player_ban": {
      if(!hasPermission(user,"manage_bans"))throw new Error("Нет разрешения на блокировку игроков.");
      const id=String(p.p_player_id||"");
      if(!/^\d+$/.test(id))throw new Error("Некорректный ID игрока.");
      const banned=parseBool(p.p_banned),reason=banned?String(p.p_reason||"").trim().slice(0,500):"";
      if(banned&&!reason)throw new Error("Укажи причину блокировки.");
      const rows=await sql`UPDATE public.cs2_players SET is_banned=${banned},ban_reason=${reason} WHERE id=${id}::bigint RETURNING id,nickname,is_banned,ban_reason`;
      if(!rows.length)throw new Error("Игрок не найден.");
      return rows[0];
    }

    case "admin_set_team_ban": {
      if(!hasPermission(user,"manage_bans"))throw new Error("Нет разрешения на блокировку команд.");
      const id=String(p.p_team_id||"");
      if(!/^\d+$/.test(id))throw new Error("Некорректный ID команды.");
      const banned=parseBool(p.p_banned),reason=banned?String(p.p_reason||"").trim().slice(0,500):"";
      if(banned&&!reason)throw new Error("Укажи причину блокировки.");
      const rows=await sql`UPDATE public.teams SET is_banned=${banned},ban_reason=${reason} WHERE id=${id}::bigint RETURNING id,name,is_banned,ban_reason`;
      if(!rows.length)throw new Error("Команда не найдена.");
      return rows[0];
    }

    case "captain_apply_tournament": {
      if(!user)throw new Error("Требуется вход.");const id=String(p.p_tournament_id||"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new Error("Некорректный турнир.");
      const rows=await sql`SELECT c.team_id FROM public.mvp_team_captains c JOIN public.mvp_tournaments t ON t.id=${id}::uuid AND t.allow_captain_registration=true AND t.event_status<>'completed' WHERE c.user_id=${user.id}::uuid LIMIT 1`;if(!rows.length)throw new Error("Регистрация закрыта или тебе не назначена команда.");
      const inserted=await sql`INSERT INTO public.mvp_tournament_applications(tournament_id,team_id,captain_user_id) VALUES(${id}::uuid,${rows[0].team_id}::bigint,${user.id}::uuid) ON CONFLICT(tournament_id,team_id) DO NOTHING RETURNING id,status`;if(!inserted.length)throw new Error("Заявка этой команды уже существует.");return inserted[0];
    }
    case "admin_list_tournament_applications": {
      if(!isAdmin(user))throw new Error("Только администратор может просматривать заявки.");const rows=await sql`SELECT a.id,a.tournament_id,a.team_id,a.status,a.created_at,a.reviewed_at,a.admin_note,t.name tournament_name,tm.name team_name,u.email captain_email FROM public.mvp_tournament_applications a JOIN public.mvp_tournaments t ON t.id=a.tournament_id JOIN public.teams tm ON tm.id=a.team_id JOIN public.mvp_auth_users u ON u.id=a.captain_user_id ORDER BY a.created_at DESC LIMIT 500`;return rows;
    }
    case "admin_delete_tournament_application": {
      if(!isAdmin(user))throw new Error("Только администратор может удалять заявки.");
      const id=String(p.p_application_id||"");
      if(!/^[0-9]+$/.test(id))throw new Error("Некорректный номер заявки.");
      // Removing an approved request only removes its application history.
      // The team deliberately remains in the tournament bracket.
      const rows=await sql`DELETE FROM public.mvp_tournament_applications WHERE id=${id}::bigint RETURNING id,status`;
      if(!rows.length)throw new Error("Заявка не найдена или уже удалена.");
      return rows[0];
    }
    case "captain_get_my_team": {
      if(!user?.id)throw new Error("Войди в аккаунт.");
      const rows=await sql`
        SELECT t.id,t.name,t.tag,t.players,t.logo,t.player_photos
        FROM public.mvp_team_captains c
        JOIN public.teams t ON t.id=c.team_id
        WHERE c.user_id=${user.id}::uuid
        LIMIT 1
      `;
      return rows[0]||null;
    }

    case "captain_save_my_team": {
      if(!user?.id)throw new Error("Войди в аккаунт.");
      const name=String(p.p_name||"").trim();
      const tag=String(p.p_tag||"").trim();
      const players=String(p.p_players||"").trim();
      const logo=String(p.p_logo||"").trim();
      const photos=Array.isArray(p.p_player_photos)?p.p_player_photos.slice(0,5):[];
      if(name.length<2||name.length>80)throw new Error("Название команды должно содержать от 2 до 80 символов.");
      if(tag.length>12)throw new Error("Тег команды не должен превышать 12 символов.");
      if(players.length>300)throw new Error("Состав команды слишком длинный.");
      if(logo.length>2000||photos.some(photo=>String(photo||"").length>2000))throw new Error("Ссылка на изображение слишком длинная.");
      if(photos.some(photo=>photo!=null&&typeof photo!=="string"))throw new Error("Некорректный список фотографий.");
      const rows=await sql`
        UPDATE public.teams t
        SET name=${name},
            tag=${tag},
            players=${players},
            logo=${logo},
            player_photos=${JSON.stringify(photos)}::jsonb
        WHERE t.id=(
          SELECT c.team_id FROM public.mvp_team_captains c
          WHERE c.user_id=${user.id}::uuid
          LIMIT 1
        )
        RETURNING t.id,t.name,t.tag,t.players,t.logo,t.player_photos
      `;
      if(!rows.length)throw new Error("За твоим аккаунтом не закреплена команда. Попроси администратора назначить тебя капитаном.");
      return rows[0];
    }

    case "organizer_create": {
      if(!user)throw new Error("Войди в аккаунт, чтобы создать турнирную компанию.");
      const name=String(p.p_name||"").trim();
      const slug=String(p.p_slug||"").trim().toLowerCase();
      const description=String(p.p_description||"").trim().slice(0,800);
      const logo=String(p.p_logo_url||"").trim().slice(0,2000);
      if(name.length<2||name.length>80)throw new Error("Название компании должно содержать от 2 до 80 символов.");
      if(!/^[a-z0-9-]{2,80}$/.test(slug))throw new Error("Короткий код: только латинские буквы, цифры и дефис (2–80 символов).");
      if(logo&&!/^https:\/\//i.test(logo))throw new Error("Ссылка на логотип должна начинаться с https://.");
      const rows=await sql`
        WITH created AS (
          INSERT INTO public.mvp_tournament_organizers(name,slug,logo_url,description,is_active,sort_order,created_by)
          VALUES(${name},${slug},${logo},${description},true,100,${user.id}::uuid)
          RETURNING id,name,slug,logo_url,description,is_active,sort_order,created_at,updated_at
        ), membership AS (
          INSERT INTO public.mvp_tournament_organizer_owners(organizer_id,user_id,assigned_by)
          SELECT id,${user.id}::uuid,${user.id}::uuid FROM created
          RETURNING organizer_id
        )
        SELECT created.*,true AS is_owner FROM created JOIN membership ON membership.organizer_id=created.id
      `;
      if(!rows.length)throw new Error("Не удалось создать турнирную компанию.");
      return rows[0];
    }

    case "organizer_get_owners": {
      if(!user)throw new Error("Требуется вход.");
      const id=String(p.p_organizer_id||"");
      if(!/^\d+$/.test(id))throw new Error("Некорректная компания.");
      const access=await sql`SELECT 1 FROM public.mvp_tournament_organizer_owners WHERE organizer_id=${id}::bigint AND user_id=${user.id}::uuid LIMIT 1`;
      if(!access.length&&!hasPermission(user,"manage_matches"))throw new Error("Управлять владельцами может только владелец компании.");
      return await sql`
        SELECT u.id,u.username,o.created_at
        FROM public.mvp_tournament_organizer_owners o
        JOIN public.mvp_auth_users u ON u.id=o.user_id
        WHERE o.organizer_id=${id}::bigint
        ORDER BY o.created_at ASC
      `;
    }

    case "organizer_add_owner": {
      if(!user)throw new Error("Требуется вход.");
      const id=String(p.p_organizer_id||"");
      const email=String(p.p_email||"").trim().toLowerCase();
      if(!/^\d+$/.test(id)||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new Error("Укажи корректный email и компанию.");
      const access=await sql`SELECT 1 FROM public.mvp_tournament_organizer_owners WHERE organizer_id=${id}::bigint AND user_id=${user.id}::uuid LIMIT 1`;
      if(!access.length&&!hasPermission(user,"manage_matches"))throw new Error("Добавлять владельцев может только владелец компании.");
      const target=await sql`SELECT id,username FROM public.mvp_auth_users WHERE lower(email)=${email} AND email_verified_at IS NOT NULL AND is_banned=false LIMIT 1`;
      if(!target.length)throw new Error("Пользователь не найден. Проверь email и убедись, что аккаунт подтверждён.");
      if(String(target[0].id)===String(user.id))throw new Error("Ты уже владелец этой компании.");
      const inserted=await sql`
        INSERT INTO public.mvp_tournament_organizer_owners(organizer_id,user_id,assigned_by)
        SELECT ${id}::bigint,${target[0].id}::uuid,${user.id}::uuid
        WHERE EXISTS(SELECT 1 FROM public.mvp_tournament_organizers WHERE id=${id}::bigint)
        ON CONFLICT(organizer_id,user_id) DO NOTHING
        RETURNING organizer_id
      `;
      if(!inserted.length)throw new Error("Этот пользователь уже владелец компании или компания не найдена.");
      return {id:target[0].id,username:target[0].username};
    }

    case "organizer_update": {
      if(!user)throw new Error("Требуется вход.");
      const id=String(p.p_organizer_id||"");
      const name=String(p.p_name||"").trim();
      const slug=String(p.p_slug||"").trim().toLowerCase();
      const description=String(p.p_description||"").trim().slice(0,800);
      const logo=String(p.p_logo_url||"").trim().slice(0,2000);
      if(!/^\d+$/.test(id)||name.length<2||name.length>80||! /^[a-z0-9-]{2,80}$/.test(slug))throw new Error("Проверь название компании и короткий код.");
      const access=await sql`SELECT 1 FROM public.mvp_tournament_organizer_owners WHERE organizer_id=${id}::bigint AND user_id=${user.id}::uuid LIMIT 1`;
      if(!access.length&&!hasPermission(user,"manage_matches"))throw new Error("Изменять компанию может только её владелец.");
      if(logo&&!/^https:\/\//i.test(logo))throw new Error("Ссылка на логотип должна начинаться с https://.");
      const rows=await sql`UPDATE public.mvp_tournament_organizers SET name=${name},slug=${slug},logo_url=${logo},description=${description},updated_at=now() WHERE id=${id}::bigint RETURNING id,name,slug,logo_url,description,is_active,sort_order,created_at,updated_at`;
      if(!rows.length)throw new Error("Компания не найдена.");
      return rows[0];
    }

    case "admin_get_team_captain": {
      if(!isAdmin(user))throw new Error("Только администратор.");const id=String(p.p_team_id||"");if(!/^[0-9]+$/.test(id))throw new Error("Некорректная команда.");
      const rows=await sql`SELECT u.email,u.username FROM public.mvp_team_captains c JOIN public.mvp_auth_users u ON u.id=c.user_id WHERE c.team_id=${id}::bigint LIMIT 1`;return rows[0]||null;
    }
    case "admin_assign_team_captain": {
      if(!isAdmin(user))throw new Error("Только администратор может назначать капитана.");const id=String(p.p_team_id||""),email=String(p.p_email||"").trim().toLowerCase();if(!/^[0-9]+$/.test(id))throw new Error("Некорректная команда.");
      if(!email){await sql.query("DELETE FROM public.mvp_team_captains WHERE team_id=$1::bigint",[id]);return null;}
      const rows=await sql`SELECT id,email,username FROM public.mvp_auth_users WHERE lower(email)=${email} AND email_verified_at IS NOT NULL AND is_banned=false LIMIT 1`;if(!rows.length)throw new Error("Пользователь не найден или email не подтверждён.");
      await sql`INSERT INTO public.mvp_team_captains(team_id,user_id,assigned_by) VALUES(${id}::bigint,${rows[0].id}::uuid,${user.id}::uuid) ON CONFLICT(team_id) DO UPDATE SET user_id=EXCLUDED.user_id,assigned_by=EXCLUDED.assigned_by,assigned_at=now()`;return rows[0];
    }
    case "admin_save_team": {
      if(!hasPermission(user,"manage_teams"))throw new Error("Нет разрешения на управление командами.");
      const name=String(p.p_name||"").trim();
      if(name.length<2||name.length>80)throw new Error("Название команды должно содержать от 2 до 80 символов.");
      const banned=parseBool(p.p_is_banned);
      if(banned&&!hasPermission(user,"manage_bans"))throw new Error("Нет разрешения на блокировку команд.");
      const id=p.p_team_id==null?null:String(p.p_team_id);
      if(id!==null&&!/^\d+$/.test(id))throw new Error("Некорректный ID команды.");
      const photos=Array.isArray(p.p_player_photos)?p.p_player_photos:[];
      const rows=await sql`
        SELECT to_jsonb(public.mvp_admin_save_team(
          ${id}::bigint,
          ${name},
          ${String(p.p_tag||"").trim().slice(0,20)},
          ${Math.max(0,Math.floor(Number(p.p_points)||0))},
          ${String(p.p_players||"").slice(0,4000)},
          ${String(p.p_logo||"").slice(0,2000)},
          ${JSON.stringify(photos)}::jsonb,
          ${Math.max(0,Math.floor(Number(p.p_tournament_wins)||0))},
          ${banned},
          ${banned?String(p.p_ban_reason||"").trim().slice(0,500):""}
        )) AS saved
      `;
      const saved=rows?.[0]?.saved;
      if(!saved)throw new Error("Не удалось сохранить команду.");
      return saved;
    }

    case "admin_review_tournament_application": {
      if(!isAdmin(user))throw new Error("Только администратор может рассматривать заявки.");
      const id=String(p.p_application_id||""),status=String(p.p_status||"");
      if(!/^[0-9]+$/.test(id)||!["approved","rejected"].includes(status))throw new Error("Некорректное решение.");
      const note=String(p.p_admin_note||"").slice(0,500);
      if(status==="rejected"){
        const rows=await sql`UPDATE public.mvp_tournament_applications SET status='rejected',reviewed_at=now(),reviewed_by=${user.id}::uuid,admin_note=${note} WHERE id=${id}::bigint AND status='pending' RETURNING id,status`;
        if(!rows.length)throw new Error("Заявка уже рассмотрена.");
        return rows[0];
      }
      // Approved teams always enter the upper bracket. Lower-bracket places are
      // derived automatically from first-round upper-bracket losers by the client resolver.
      const rows=await sql`
        WITH locked AS (
          SELECT a.id AS application_id,a.team_id,t.id AS tournament_id,
                 t.team_count,t.event_status,t.bracket_data,
                 tm.name,tm.tag,tm.logo
          FROM public.mvp_tournament_applications a
          JOIN public.mvp_tournaments t ON t.id=a.tournament_id
          JOIN public.teams tm ON tm.id=a.team_id
          WHERE a.id=${id}::bigint AND a.status='pending'
          FOR UPDATE OF a,t
        ),
        prepared AS (
          SELECT *,COALESCE(bracket_data->'teams','[]'::jsonb) AS upper_teams,
                   COALESCE(bracket_data->'lower_teams','[]'::jsonb) AS lower_teams
          FROM locked
        ),
        placed AS (
          UPDATE public.mvp_tournaments t
          SET bracket_data=jsonb_set(COALESCE(p.bracket_data,'{}'::jsonb),'{teams}',
                p.upper_teams||jsonb_build_array(jsonb_build_object('id',p.team_id::text,'name',p.name,'tag',COALESCE(p.tag,''),'logo',COALESCE(p.logo,''))),true)
          FROM prepared p
          WHERE t.id=p.tournament_id
            AND p.event_status<>'completed'
            AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(p.upper_teams||p.lower_teams) existing
              WHERE existing->>'id'=p.team_id::text
            )
            AND jsonb_array_length(p.upper_teams)<LEAST(16,GREATEST(8,COALESCE(p.team_count,8)))
          RETURNING t.id
        )
        UPDATE public.mvp_tournament_applications a
        SET status='approved',reviewed_at=now(),reviewed_by=${user.id}::uuid,admin_note=${note}
        FROM locked l,placed p
        WHERE a.id=l.application_id AND p.id=l.tournament_id
        RETURNING a.id,a.status
      `;
      if(!rows.length)throw new Error("Не удалось добавить команду: заявка уже рассмотрена, турнир завершён, команда уже в сетке или свободных мест больше нет.");
      return rows[0];
    }
    case "admin_set_moderator_by_email": {
      if(!isAdmin(user))throw new Error("Назначать модераторов может только администратор.");
      const email=String(p.p_email||"").trim().toLowerCase();
      if(!email.includes("@"))throw new Error("Некорректный email.");
      if(email.toLowerCase()===String(env.AUTH_ADMIN_EMAIL||"").toLowerCase())throw new Error("Главного администратора нельзя изменить.");
      const permissions=cleanPermissions(p.p_permissions);
      const rows=await sql`UPDATE public.mvp_auth_users SET role='moderator',permissions=${JSON.stringify(permissions)}::jsonb,updated_at=now() WHERE lower(email)=${email} RETURNING id,email,username,role,permissions`;
      if(!rows.length)throw new Error("Пользователь не найден. Он должен сначала зарегистрироваться и подтвердить email.");
      return rows[0];
    }

    case "admin_ban_email": {
      if(!isAdmin(user))throw new Error("Блокировать аккаунты может только администратор.");
      const email=String(p.p_email||"").trim().toLowerCase();
      if(!email.includes("@"))throw new Error("Некорректный email.");
      if(email===String(env.AUTH_ADMIN_EMAIL||"").trim().toLowerCase())throw new Error("Главного администратора нельзя заблокировать.");
      const reason=String(p.p_reason||"").trim().slice(0,500);
      const rows=await sql`UPDATE public.mvp_auth_users SET is_banned=true,ban_reason=${reason},updated_at=now() WHERE lower(email)=${email} RETURNING id,email,is_banned`;
      if(!rows.length)throw new Error("Аккаунт с таким email не найден в Neon.");
      await sql`DELETE FROM public.mvp_auth_sessions WHERE user_id=${rows[0].id}::uuid`;
      return rows[0];
    }

    case "admin_unban_email": {
      if(!isAdmin(user))throw new Error("Снимать блокировки может только администратор.");
      const email=String(p.p_email||"").trim().toLowerCase();
      const rows=await sql`UPDATE public.mvp_auth_users SET is_banned=false,ban_reason=NULL,updated_at=now() WHERE lower(email)=${email} RETURNING id,email,is_banned`;
      if(!rows.length)throw new Error("Аккаунт не найден в Neon.");
      return rows[0];
    }

    case "admin_list_accounts": {
      if(!hasPermission(user,"manage_support"))throw new Error("Нет доступа к управлению аккаунтами.");
      return await sql`SELECT id AS user_id,email,username,role,permissions,is_banned,created_at FROM public.mvp_auth_users ORDER BY created_at DESC LIMIT 500`;
    }

    case "admin_update_account_access": {
      if(!isAdmin(user))throw new Error("Изменять роли может только администратор.");
      const id=String(p.p_user_id||"");
      const role=String(p.p_role||"player");
      if(!/^[0-9a-f-]{36}$/i.test(id)||!["player","moderator"].includes(role))throw new Error("Недопустимая роль или ID пользователя.");
      const target=await sql`SELECT email,role FROM public.mvp_auth_users WHERE id=${id}::uuid LIMIT 1`;
      if(!target.length)throw new Error("Пользователь не найден.");
      if(String(target[0].email).toLowerCase()===String(env.AUTH_ADMIN_EMAIL||"").toLowerCase())throw new Error("Нельзя изменить права главного администратора.");
      const permissions=role==="moderator"?cleanPermissions(p.p_permissions):{};
      const rows=await sql`UPDATE public.mvp_auth_users SET role=${role},permissions=${JSON.stringify(permissions)}::jsonb,updated_at=now() WHERE id=${id}::uuid RETURNING id AS user_id,email,username,role,permissions,is_banned`;
      return rows[0];
    }

    case "admin_list_banned_emails": {
      if(!hasPermission(user,"manage_bans"))throw new Error("Нет доступа к списку блокировок.");
      return await sql`SELECT email, COALESCE(ban_reason,'Аккаунт заблокирован администратором') AS reason FROM public.mvp_auth_users WHERE is_banned=true ORDER BY email LIMIT 500`;
    }

    case "mvp_wipe_and_advance_season": {
      if(!isAdmin(user))throw new Error("Годовой архив и вайп может выполнять только главный администратор.");
      const nextYear=Number(p.p_next_year);
      if(!Number.isInteger(nextYear)||nextYear<2020||nextYear>2200)throw new Error("Некорректный год сезона.");
      // This operation intentionally calls a dedicated database function so the archive,
      // score reset, and season switch remain atomic. The Neon auth SQL migration installs this function.
      const rows=await sql`SELECT public.mvp_wipe_and_advance_season(${nextYear}) AS result`;
      return rows?.[0]?.result||null;
    }

    default:
      throw new Error("Эта административная операция ещё не перенесена.");
  }
}

export async function handleRpcRequest(request,env,cors){
  const url=new URL(request.url);
  if(url.pathname!=="/api/data/rpc")return null;
  if(request.method!=="POST")return fail("Method not allowed",405,cors);
  if(!env.DATABASE_URL)return fail("DATABASE_URL secret is missing",500,cors);
  let operation = "";
  try{
    const body=await request.json();
    operation=String(body.name||"");
    if(!/^[a-z_]{2,80}$/.test(operation))return fail("Некорректное имя операции.",400,cors);
    const sql=neon(env.DATABASE_URL);
    const user=await getSessionUser(sql,request);
    const data=await runRpc(sql,user,operation,body.args||{},env);
    return json({ok:true,data},200,cors);
  }catch(error){
    console.error("RPC request failed", { operation, message: error?.message || String(error) });
    return fail(error?.message||"Ошибка операции.",400,cors);
  }
}
