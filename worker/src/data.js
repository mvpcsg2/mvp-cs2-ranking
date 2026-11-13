import { neon } from "@neondatabase/serverless";
import { getSessionUser } from "./auth.js";

const TABLES = {
  teams: {
    read: ["id","name","tag","points","players","logo","created_at","player_photos","tournament_wins","is_banned","ban_reason"],
    write: ["name","tag","points","players","logo","player_photos","tournament_wins","created_at"],
    permission: "manage_teams",
  },
  cs2_players: {
    read: ["id","nickname","photo_url","created_at","role","team_id","is_banned","ban_reason","faceit_nickname","steam_id64","faceit_profile_url","faceit_elo","faceit_skill_level","faceit_last_synced_at","country_code"],
    write: ["nickname","photo_url","role","team_id","faceit_nickname","steam_id64","faceit_profile_url","faceit_elo","faceit_skill_level","faceit_last_synced_at","country_code"],
    permission: "manage_players",
  },
  team_matches: {
    read: ["id","team_id","opponent_team_id","opponent_name","team_score","opponent_score","map_name","played_at","match_status","tournament_name","created_by"],
    write: ["team_id","opponent_team_id","opponent_name","team_score","opponent_score","map_name","played_at","match_status","tournament_name","created_by"],
    permission: "manage_matches",
  },
  match_player_stats: {
    read: ["id","match_id","team_id","player_id","kills","deaths","kd","created_at"],
    write: ["match_id","team_id","player_id","kills","deaths","kd","created_at"],
    permission: "manage_matches",
  },
  mvp_tournaments: {
    read: ["id","name","best_of","status","is_active","bracket_data","created_at","updated_at","created_by"],
    write: ["name","best_of","status","is_active","bracket_data","created_at","updated_at","created_by"],
    permission: "manage_matches",
  },
  cs2_streams: {
    read: ["id","title","youtube_url","created_at","created_by"],
    write: ["title","youtube_url","created_at","created_by"],
    permission: "manage_streams",
  },
  mvp_site_settings: {
    read: ["setting_key","setting_value","updated_at","updated_by"],
    privateRead: true,
    write: ["setting_key","setting_value","updated_at","updated_by"],
    permission: "manage_site_settings",
  },
  mvp_trophy_catalog: {
    read: ["id","name","description","image_url","created_at"],
    write: ["name","description","image_url","created_at","created_by"],
    permission: "manage_trophies",
  },
  player_trophies: {
    read: ["id","player_id","team_id","place","tournament_name","awarded_at","custom_trophy_name","custom_trophy_image_url","custom_trophy_description","created_by"],
    write: ["player_id","team_id","place","tournament_name","awarded_at","custom_trophy_name","custom_trophy_image_url","custom_trophy_description","created_by"],
    permission: "manage_trophies",
  },
  player_prize_money: {
    read: ["id","player_id","team_id","tournament_name","amount","currency","awarded_at","created_by"],
    write: ["player_id","team_id","tournament_name","amount","currency","awarded_at","created_by"],
    permission: "manage_trophies",
  },
  mvp_editorial_news: {
    read: ["id","title","category","summary","body","image_url","external_url","author_name","published","created_at","updated_at"],
    write: ["title","category","summary","body","image_url","external_url","author_name","published","created_at","updated_at"],
    permission: "manage_news",
    special: "editorial",
  },
  support_messages: {
    read: ["id","user_id","sender_id","message","created_at"],
    write: ["user_id","sender_id","message","created_at"],
    permission: "manage_support",
    special: "support",
  },
  profiles: {
    read: ["id","email","username","role","permissions","created_at"],
    write: [],
    special: "profiles",
  },
};

const IDENT = /^[a-z_][a-z0-9_]*$/i;
const quoteIdent = value => {
  if (!IDENT.test(value)) throw new Error("Invalid SQL identifier");
  return '"' + value + '"';
};
const json = (data, status=200, cors={}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...cors },
});
const fail = (message, status=400, cors={}) => json({ ok:false, error:message }, status, cors);

function hasPermission(user, permission) {
  return Boolean(user && (user.role === "admin" || (user.role === "moderator" && user.permissions?.[permission] === true)));
}
function normalizeFilters(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > 30) throw new Error("Слишком много условий запроса.");
  return input.map(item => {
    const column = String(item?.column || "");
    const op = String(item?.op || "eq").toLowerCase();
    if (!IDENT.test(column) || !["eq","neq","gt","gte","lt","lte","in","is"].includes(op)) throw new Error("Недопустимое условие запроса.");
    return { column, op, value:item.value };
  });
}
function buildWhere(filters, orFilters, params, allowed) {
  const clauses=[];
  const add=(column,op,value)=>{
    if(!allowed.includes(column)) throw new Error("Недопустимое поле фильтра: "+column);
    const ident=quoteIdent(column);
    if(op==="in"){
      if(!Array.isArray(value)||value.length>500)throw new Error("Некорректный список фильтра.");
      if(!value.length){clauses.push("FALSE");return;}
      const marks=value.map(v=>{params.push(v);return "$"+params.length;});
      clauses.push(ident+" IN ("+marks.join(",")+")");
    }else if(op==="is" && value===null){clauses.push(ident+" IS NULL");}
    else if(op==="eq" && value===null){clauses.push(ident+" IS NULL");}
    else if(op==="neq" && value===null){clauses.push(ident+" IS NOT NULL");}
    else{
      const operator={eq:"=",neq:"<>",gt:">",gte:">=",lt:"<",lte:"<="}[op];
      if(!operator)throw new Error("Недопустимый оператор фильтра.");
      params.push(value);clauses.push(ident+" "+operator+" $"+params.length);
    }
  };
  for(const filter of normalizeFilters(filters)) add(filter.column,filter.op,filter.value);
  if(Array.isArray(orFilters)&&orFilters.length){
    if(orFilters.length>10)throw new Error("Слишком много OR-условий.");
    const pieces=[];
    for(const filter of orFilters){
      const before=clauses.length;
      const temp=[];
      add(filter.column,filter.op,filter.value);
      temp.push(clauses.pop());
      if(before!==clauses.length)throw new Error("Invalid OR condition");
      pieces.push(temp[0]);
    }
    clauses.push("("+pieces.join(" OR ")+")");
  }
  return clauses.length ? " WHERE "+clauses.join(" AND ") : "";
}
function validatePayload(payload, writable) {
  const rows=Array.isArray(payload)?payload:[payload];
  if(!rows.length||rows.length>100)throw new Error("Некорректное количество строк.");
  for(const row of rows){
    if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("Некорректная запись.");
    for(const key of Object.keys(row)){
      if(!writable.includes(key))throw new Error("Запись в поле "+key+" запрещена.");
    }
  }
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  if(!columns.length)throw new Error("Нет данных для записи.");
  return {rows,columns};
}
async function runQuery(sql, body, user, cors) {
  const requestedTable=String(body.table||"");
  const config=TABLES[requestedTable];
  if(!config) return fail("Таблица не разрешена для API.",403,cors);
  const table=requestedTable==="profiles"?"mvp_auth_users":requestedTable;
  const isRead=body.action==="select";
  if(!["select","insert","update","delete","upsert"].includes(body.action))return fail("Недопустимая операция.",400,cors);

  if(requestedTable==="profiles"){
    if(!user)return fail("Требуется вход в аккаунт.",401,cors);
    if(!hasPermission(user,"manage_support") && !(body.filters||[]).some(f=>f.column==="id"&&f.op==="eq"&&String(f.value)===String(user.id))){
      return fail("Нет доступа к профилям других пользователей.",403,cors);
    }
  }else if(config.special==="support"){
    if(!user)return fail("Требуется вход в аккаунт.",401,cors);
    if(body.action==="insert"){
      const rows=Array.isArray(body.values)?body.values:[body.values];
      if(rows.length>20||rows.some(row=>!row||String(row.sender_id)!==String(user.id)||(!hasPermission(user,"manage_support")&&String(row.user_id)!==String(user.id)))){
        return fail("Нет прав для отправки сообщения в этот чат.",403,cors);
      }
    }else if(!hasPermission(user,"manage_support") && !(body.filters||[]).some(f=>f.column==="user_id"&&f.op==="eq"&&String(f.value)===String(user.id))){
      return fail("Нет доступа к этому чату.",403,cors);
    }
  }else if(!isRead && !hasPermission(user,config.permission)){
    return fail("Недостаточно прав для изменения данных.",403,cors);
  }

  if(body.action==="select"){
    if(config.privateRead && !hasPermission(user,config.permission))return fail("Недостаточно прав для чтения этих настроек.",403,cors);
    const columns=body.columns==="*"||!body.columns?config.read:body.columns;
    if(!Array.isArray(columns)||!columns.length||columns.some(c=>!config.read.includes(c)))return fail("Запрошены недоступные поля.",403,cors);
    if(requestedTable==="profiles" && !hasPermission(user,"manage_support") && columns.some(c=>!["id","email","username","role","permissions","created_at"].includes(c)))return fail("Нет доступа к полям профиля.",403,cors);
    const params=[];
    const where=buildWhere(body.filters,body.orFilters,params,config.read);
    let enforcedWhere=where;
    if(config.special==="editorial" && !hasPermission(user,"manage_news")){
      params.push(true);
      const publishedFilter = "published = $" + params.length;
      enforcedWhere = enforcedWhere ? enforcedWhere + " AND " + publishedFilter : " WHERE " + publishedFilter;
    }
    const orders=Array.isArray(body.orders)?body.orders:[];
    if(orders.length>5)return fail("Слишком много сортировок.",400,cors);
    const orderSql=orders.map(o=>{
      if(!config.read.includes(o.column))throw new Error("Недопустимое поле сортировки.");
      return quoteIdent(o.column)+(o.ascending===false?" DESC":" ASC");
    });
    const limit=Math.min(Math.max(Number(body.limit)||100,1),2000);
    const query="SELECT "+columns.map(quoteIdent).join(", ")+" FROM public."+quoteIdent(table)+enforcedWhere+(orderSql.length?" ORDER BY "+orderSql.join(", "):"")+" LIMIT "+limit;
    const rows=await sql.query(query,params);
    if(requestedTable==="support_messages"&&!hasPermission(user,"manage_support")&&rows.some(row=>String(row.user_id)!==String(user.id)))return fail("Нет доступа к этому чату.",403,cors);
    return json({ok:true,data:rows},200,cors);
  }

  if(!user)return fail("Требуется вход в аккаунт.",401,cors);
  if(config.special && !["support","editorial"].includes(config.special))return fail("Операция запрещена.",403,cors);
  if(!config.special && !hasPermission(user,config.permission))return fail("Недостаточно прав для изменения данных.",403,cors);
  if(config.special==="support" && body.action!=="insert" && !hasPermission(user,"manage_support"))return fail("Изменение сообщений доступно только службе поддержки.",403,cors);
  if(body.action==="insert"||body.action==="upsert"){
    const {rows,columns}=validatePayload(body.values,config.write);
    if(body.action==="upsert"&&!Array.isArray(body.conflictColumns))return fail("Для upsert требуется ключ конфликта.",400,cors);
    const params=[];
    const valuesSql=rows.map(row=>"("+columns.map(column=>{
      params.push(Object.hasOwn(row,column)?row[column]:null);return "$"+params.length;
    }).join(", ")+")").join(", ");
    let query="INSERT INTO public."+quoteIdent(table)+" ("+columns.map(quoteIdent).join(", ")+") VALUES "+valuesSql;
    if(body.action==="upsert"){
      const conflicts=body.conflictColumns;
      if(!conflicts.length||conflicts.some(c=>!config.write.includes(c)))return fail("Недопустимый ключ upsert.",400,cors);
      const updates=columns.filter(c=>!conflicts.includes(c));
      query+=" ON CONFLICT ("+conflicts.map(quoteIdent).join(", ")+") ";
      query+=updates.length?"DO UPDATE SET "+updates.map(c=>quoteIdent(c)+" = EXCLUDED."+quoteIdent(c)).join(", "):"DO NOTHING";
    }
    const returning=body.returning==="*"?config.read:(Array.isArray(body.returning)?body.returning:config.read.filter(c=>c==="id"));
    if(returning.some(c=>!config.read.includes(c)))return fail("Недопустимые возвращаемые поля.",400,cors);
    query+=" RETURNING "+(returning.length?returning.map(quoteIdent).join(", "):"1 AS ok");
    const result=await sql.query(query,params);
    return json({ok:true,data:result},200,cors);
  }

  if(body.action==="update"||body.action==="delete"){
    const params=[];
    const where=buildWhere(body.filters,body.orFilters,params,config.read);
    if(!where)return fail("Массовое изменение без фильтра запрещено.",400,cors);
    let query;
    if(body.action==="update"){
      const payload=body.values;
      if(!payload||typeof payload!=="object"||Array.isArray(payload))return fail("Некорректные данные обновления.",400,cors);
      const columns=Object.keys(payload);
      if(!columns.length||columns.some(c=>!config.write.includes(c)))return fail("Запрошено изменение недоступного поля.",403,cors);
      const set=columns.map(column=>{params.push(payload[column]);return quoteIdent(column)+" = $"+params.length;}).join(", ");
      query="UPDATE public."+quoteIdent(table)+" SET "+set+where;
    }else{
      query="DELETE FROM public."+quoteIdent(table)+where;
    }
    const returning=body.returning==="*"?config.read:(Array.isArray(body.returning)?body.returning:config.read.filter(c=>c==="id"));
    if(returning.some(c=>!config.read.includes(c)))return fail("Недопустимые возвращаемые поля.",400,cors);
    query+=" RETURNING "+(returning.length?returning.map(quoteIdent).join(", "):"1 AS ok");
    const result=await sql.query(query,params);
    return json({ok:true,data:result},200,cors);
  }
  return fail("Недопустимая операция.",400,cors);
}

export async function handleDataRequest(request, env, cors) {
  const url=new URL(request.url);
  if(url.pathname!=="/api/data/query")return null;
  if(request.method!=="POST")return fail("Method not allowed",405,cors);
  if(!env.DATABASE_URL)return fail("DATABASE_URL secret is missing",500,cors);
  try{
    const text=await request.text();
    if(text.length>250000)return fail("Слишком большой запрос.",413,cors);
    const body=JSON.parse(text||"{}");
    const sql=neon(env.DATABASE_URL);
    const user=await getSessionUser(sql,request);
    return await runQuery(sql,body,user,cors);
  }catch(error){
    console.error("Data API request failed",error?.message||error);
    return fail(error?.message||"Ошибка запроса к базе.",400,cors);
  }
}
