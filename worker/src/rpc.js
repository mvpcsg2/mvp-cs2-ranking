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

    case "admin_save_team": {
      if(!hasPermission(user,"manage_teams"))throw new Error("Нет разрешения на управление командами.");
      const name=String(p.p_name||"").trim();
      if(name.length<2||name.length>80)throw new Error("Название команды должно содержать от 2 до 80 символов.");
      const banned=parseBool(p.p_is_banned);
      if(banned&&!hasPermission(user,"manage_bans"))throw new Error("Нет разрешения на блокировку команд.");
      const values={
        name,
        tag:String(p.p_tag||"").trim().slice(0,20),
        points:Math.max(0,Math.floor(Number(p.p_points)||0)),
        players:String(p.p_players||"").slice(0,4000),
        logo:String(p.p_logo||"").slice(0,2000),
        player_photos:p.p_player_photos??{},
        tournament_wins:Math.max(0,Math.floor(Number(p.p_tournament_wins)||0)),
        is_banned:banned,
        ban_reason:banned?String(p.p_ban_reason||"").trim().slice(0,500):""
      };
      const id=String(p.p_team_id||"");
      const rows=id&&/^\d+$/.test(id)
        ? await sql`UPDATE public.teams SET name=${values.name},tag=${values.tag},points=${values.points},players=${values.players},logo=${values.logo},player_photos=${JSON.stringify(values.player_photos)}::jsonb,tournament_wins=${values.tournament_wins},is_banned=${values.is_banned},ban_reason=${values.ban_reason} WHERE id=${id}::bigint RETURNING *`
        : await sql`INSERT INTO public.teams (name,tag,points,players,logo,player_photos,tournament_wins,is_banned,ban_reason) VALUES (${values.name},${values.tag},${values.points},${values.players},${values.logo},${JSON.stringify(values.player_photos)}::jsonb,${values.tournament_wins},${values.is_banned},${values.ban_reason}) RETURNING *`;
      if(!rows.length)throw new Error("Не удалось сохранить команду.");
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
  try{
    const body=await request.json();
    const name=String(body.name||"");
    if(!/^[a-z_]{2,80}$/.test(name))return fail("Некорректное имя операции.",400,cors);
    const sql=neon(env.DATABASE_URL);
    const user=await getSessionUser(sql,request);
    const data=await runRpc(sql,user,name,body.args||{},env);
    return json({ok:true,data},200,cors);
  }catch(error){
    console.error("RPC request failed",error?.message||error);
    return fail(error?.message||"Ошибка операции.",400,cors);
  }
}
