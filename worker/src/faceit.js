import { neon } from "@neondatabase/serverless";
import { getSessionUser } from "./auth.js";

const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors}});
const fail=(error,status=400,cors={})=>json({ok:false,error},status,cors);

export async function handleFaceitRequest(request,env,cors){
  const url=new URL(request.url);
  if(url.pathname!=="/api/faceit/sync")return null;
  if(request.method!=="POST")return fail("Method not allowed",405,cors);
  if(!env.DATABASE_URL)return fail("DATABASE_URL secret is missing",500,cors);
  if(!env.FACEIT_API_KEY)return fail("FACEIT_API_KEY is not configured in Cloudflare.",503,cors);
  try{
    const body=await request.json();
    const playerId=String(body.player_id||"");
    if(!/^\d+$/.test(playerId))return fail("Некорректный ID игрока.",400,cors);
    const sql=neon(env.DATABASE_URL);
    const user=await getSessionUser(sql,request);
    if(!user||!(user.role==="admin"||(user.role==="moderator"&&user.permissions?.manage_players===true)))return fail("Нет доступа к синхронизации FACEIT.",403,cors);
    const players=await sql`SELECT id,nickname,faceit_nickname,faceit_profile_url FROM public.cs2_players WHERE id=${playerId}::bigint LIMIT 1`;
    const player=players[0];
    if(!player)return fail("Игрок не найден.",404,cors);
    let faceitNickname=String(player.faceit_nickname||"").trim();
    if(!faceitNickname&&player.faceit_profile_url){
      try{faceitNickname=new URL(player.faceit_profile_url).pathname.split("/").filter(Boolean).at(-1)||"";}catch{}
    }
    if(!faceitNickname)return fail("Сначала сохрани ник FACEIT в профиле игрока.",400,cors);
    const faceitResponse=await fetch("https://open.faceit.com/data/v4/players?nickname="+encodeURIComponent(faceitNickname),{
      headers:{authorization:"Bearer "+env.FACEIT_API_KEY,accept:"application/json"},
    });
    if(!faceitResponse.ok){
      const responseText=await faceitResponse.text().catch(()=>"");
      console.error("FACEIT API error",faceitResponse.status,responseText.slice(0,250));
      return fail(faceitResponse.status===404?"Игрок не найден в FACEIT.":"FACEIT API временно недоступен.",502,cors);
    }
    const faceit=await faceitResponse.json();
    const cs2=faceit.games?.cs2||{};
    const elo=Number(cs2.faceit_elo);
    const level=Number(cs2.skill_level);
    if(!Number.isFinite(elo)||!Number.isFinite(level))return fail("FACEIT не вернул рейтинг CS2 для этого игрока.",422,cors);
    const updated=await sql`
      UPDATE public.cs2_players
      SET faceit_nickname=${faceit.nickname||faceitNickname},
          faceit_elo=${Math.max(0,Math.floor(elo))},
          faceit_skill_level=${Math.max(0,Math.floor(level))},
          faceit_last_synced_at=now()
      WHERE id=${playerId}::bigint
      RETURNING id,nickname,faceit_nickname,faceit_elo,faceit_skill_level,faceit_last_synced_at
    `;
    return json({ok:true,data:updated[0]||null},200,cors);
  }catch(error){
    console.error("FACEIT sync failed",error?.message||error);
    return fail(error?.message||"Не удалось синхронизировать FACEIT.",500,cors);
  }
}
