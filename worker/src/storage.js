import { getSql } from "./db.js";
import { getSessionUser } from "./auth.js";

const json=(data,status=200,cors={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...cors}});
const fail=(error,status=400,cors={})=>json({ok:false,error},status,cors);
const MAX_BYTES=8*1024*1024;
const TYPES=new Set(["image/png","image/jpeg","image/webp","image/gif"]);

function decodeAssetPath(path){
  try{
    const decoded=path.split("/").map(part=>decodeURIComponent(part));
    if(decoded.length!==2||decoded.some(part=>!part||part==="."||part===".."||part.includes("/")||part.includes("\\")))return "";
    if(!/^[a-z0-9._-]{1,120}$/i.test(decoded[1]))return "";
    // Older deployed pages used singular folder names for team images.
    // Normalize them to the canonical R2 folders before permission checks and storage.
    const prefixAliases={"team-logo":"team-logos","team-player":"team-players"};
    const prefix=prefixAliases[decoded[0]]||decoded[0];
    if(!["site-logo","site-background","player-trophies","team-logos","team-players","tournament-organizers"].includes(prefix))return "";
    return prefix+"/"+decoded[1];
  }catch{return "";}
}
async function allowed(sql,user,prefix){
  if(!user)return false;
  if(user.role==="admin")return true;
  if(user.role==="moderator"){
    if(prefix==="player-trophies")return user.permissions?.manage_trophies===true;
    if(prefix==="team-logos"||prefix==="team-players")return user.permissions?.manage_teams===true;
    if(prefix==="tournament-organizers")return user.permissions?.manage_matches===true;
    return user.permissions?.manage_site_settings===true;
  }
  // A verified account may upload team images when its Gmail/email address is assigned as a team captain.
  // Match the assigned captain by email as requested, rather than relying only on the role label.
  if((prefix==="team-logos"||prefix==="team-players")&&user.email){
    const rows=await sql`
      SELECT 1
      FROM public.mvp_team_captains c
      JOIN public.mvp_auth_users u ON u.id=c.user_id
      WHERE lower(u.email)=lower(${user.email})
        AND u.email_verified_at IS NOT NULL
      LIMIT 1
    `;
    if(rows.length)return true;
  }
  return false;
}

export async function handleStorageRequest(request,env,cors){
  const url=new URL(request.url);
  if(url.pathname==="/api/storage/upload"){
    if(request.method!=="POST")return fail("Method not allowed",405,cors);
    if(!env.MVP_ASSETS)return fail("Cloudflare R2 binding MVP_ASSETS is not configured.",503,cors);
    const key=decodeAssetPath(url.searchParams.get("path")||"");
    if(!key)return fail("Некорректный путь к файлу.",400,cors);
    const prefix=key.split("/")[0];
    if (!env.HYPERDRIVE?.connectionString && !env.DATABASE_URL)return fail("Database connection is not configured",500,cors);
    const sqlUser=await getSessionUser(getSql(env),request);
    if(!(await allowed(getSql(env),sqlUser,prefix)))return fail("Недостаточно прав для загрузки файла.",403,cors);
    const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
    if(!TYPES.has(type))return fail("Поддерживаются только PNG, JPG, WebP и GIF.",415,cors);
    const buffer=await request.arrayBuffer();
    if(buffer.byteLength===0||buffer.byteLength>MAX_BYTES)return fail("Файл пустой или превышает 8 МБ.",413,cors);
    await env.MVP_ASSETS.put(key,buffer,{httpMetadata:{contentType:type,cacheControl:"public, max-age=31536000, immutable"}});
    return json({ok:true,data:{path:key}},201,cors);
  }
  if(url.pathname.startsWith("/assets/")&&request.method==="GET"){
    if(!env.MVP_ASSETS)return fail("Cloudflare R2 binding MVP_ASSETS is not configured.",503,cors);
    const key=decodeAssetPath(url.pathname.slice("/assets/".length));
    if(!key)return fail("Not found",404,cors);
    const object=await env.MVP_ASSETS.get(key);
    if(!object)return fail("Not found",404,cors);
    const headers=new Headers(cors);
    object.writeHttpMetadata(headers);
    headers.set("etag",object.httpEtag);
    headers.set("cache-control","public, max-age=31536000, immutable");
    headers.set("x-content-type-options","nosniff");
    return new Response(object.body,{headers});
  }
  return null;
}
