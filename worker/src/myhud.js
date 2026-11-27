import { getSql } from "./db.js";
import { getSessionUser } from './auth.js';

const reply = (data, status = 200, cors = {}) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...cors}});
const canReview = u => u && (u.role === 'admin' || (u.role === 'moderator' && u.permissions?.manage_matches === true));
const clean = (v, max=100) => String(v ?? '').trim().slice(0,max);
function normalize(body) {
  const teams = Array.isArray(body.teams) ? body.teams.slice(0,2) : [];
  if (teams.length !== 2 || !teams.every(t => t && typeof t.name === 'string' && Number.isInteger(Number(t.score)) && Number(t.score)>=0 && Number(t.score)<=100)) throw new Error('Нужны две команды и корректный счёт');
  return {map:clean(body.map,80),bestOf:clean(body.bestOf,10),status:clean(body.status,30),teams:teams.map(t=>({name:clean(t.name,80),score:Number(t.score),players:(Array.isArray(t.players)?t.players:[]).slice(0,12).map(p=>({name:clean(p.name,80),steamId:clean(p.steamId,30),kills:Math.max(0,Math.min(999,Number(p.kills)||0)),deaths:Math.max(0,Math.min(999,Number(p.deaths)||0)),assists:Math.max(0,Math.min(999,Number(p.assists)||0))}))}))};
}
export async function handleMyhudRequest(request,env,cors) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/myhud/')) return null;
  if (!env.HYPERDRIVE?.connectionString && !env.DATABASE_URL) return reply({ok:false,error:'Database connection is not configured'},503,cors);
  if (!['GET','POST'].includes(request.method)) return reply({ok:false,error:'Method not allowed'},405,cors);
  try {
    const sql=getSql(env);
    const user=await getSessionUser(sql,request);
    if (!user) return reply({ok:false,error:'Требуется вход в аккаунт сайта'},401,cors);
    if (path==='/api/myhud/live' && request.method==='POST') {
      const raw=await request.text(); if(raw.length>12000)return reply({ok:false,error:'Payload too large'},413,cors);
      const data=normalize(JSON.parse(raw));
      await sql`INSERT INTO public.mvp_myhud_live (user_id,payload,updated_at) VALUES (${user.id}::uuid,${JSON.stringify(data)}::jsonb,now()) ON CONFLICT (user_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()`;
      return reply({ok:true},200,cors);
    }
    if(path==='/api/myhud/live' && request.method==='GET') {
      const rows=await sql`SELECT user_id,payload,updated_at FROM public.mvp_myhud_live WHERE updated_at > now() - interval '45 seconds' ORDER BY updated_at DESC LIMIT 50`;
      return reply({ok:true,live:rows},200,cors);
    }
    if(path==='/api/myhud/results' && request.method==='POST') {
      const raw=await request.text();if(raw.length>12000)return reply({ok:false,error:'Payload too large'},413,cors);
      const body=JSON.parse(raw);const data=normalize(body);
      if(!['gameover','over','ended'].includes(clean(body.mapPhase,20).toLowerCase()))return reply({ok:false,error:'Карта ещё не завершена'},400,cors);
      const key=clean(body.clientMatchId,128);
      if(!/^[a-zA-Z0-9:_-]{12,128}$/.test(key))return reply({ok:false,error:'Некорректный идентификатор матча'},400,cors);
      const rows=await sql`INSERT INTO public.mvp_myhud_result_submissions (user_id,client_match_id,payload) VALUES (${user.id}::uuid,${key},${JSON.stringify(data)}::jsonb) ON CONFLICT (user_id,client_match_id) DO UPDATE SET client_match_id=EXCLUDED.client_match_id RETURNING id,status,created_at`;
      return reply({ok:true,submission:rows[0]},202,cors);
    }
    if(path==='/api/myhud/results' && request.method==='GET') {
      const rows=canReview(user)?await sql`SELECT id,user_id,payload,status,created_at,reviewed_at FROM public.mvp_myhud_result_submissions ORDER BY created_at DESC LIMIT 100`:await sql`SELECT id,payload,status,created_at,reviewed_at FROM public.mvp_myhud_result_submissions WHERE user_id=${user.id}::uuid ORDER BY created_at DESC LIMIT 50`;
      return reply({ok:true,results:rows},200,cors);
    }
    if(path==='/api/myhud/review' && request.method==='POST') {
      if(!canReview(user))return reply({ok:false,error:'Недостаточно прав'},403,cors);
      const raw=await request.text();if(raw.length>2000)return reply({ok:false,error:'Payload too large'},413,cors);
      const body=JSON.parse(raw);if(!['approved','rejected'].includes(body.status)||! /^[0-9a-f-]{36}$/i.test(body.id||''))return reply({ok:false,error:'Некорректные данные'},400,cors);
      const rows=await sql`UPDATE public.mvp_myhud_result_submissions SET status=${body.status},reviewed_by=${user.id}::uuid,reviewed_at=now() WHERE id=${body.id}::uuid AND status='pending' RETURNING id,status`;
      if(!rows.length)return reply({ok:false,error:'Заявка не найдена или уже рассмотрена'},409,cors);
      return reply({ok:true,submission:rows[0],note:'Подтверждение сохраняет решение; запись в официальный рейтинг выполняется отдельным этапом.'},200,cors);
    }
    return reply({ok:false,error:'Not found'},404,cors);
  } catch(error) {console.error('MyHUD API',error);return reply({ok:false,error:'Ошибка обработки запроса'},500,cors);}
}
