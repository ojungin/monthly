import {loadSupabase} from './supabase-loader.mjs?v=20261102-report5';
import {emptyMetrics,activityMetrics,pointMetrics,isoWeek,dayShift,numberValue,loadSeminarMetrics} from './metrics.mjs?v=20261102-report5';
let database;
export async function dashboardClient(){if(database)return database;const response=await fetch('https://ojungin.github.io/doctorville_dash/data/config.json',{cache:'no-cache'});if(!response.ok)throw Error('통계 DB 연결 설정을 불러오지 못했습니다.');const cfg=await response.json();if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)throw Error('Dashboard_DV 연결 정보가 없습니다.');const {createClient}=await loadSupabase();database=createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:true}});return database;}
export async function dashboardSession(){const db=await dashboardClient();const {data,error}=await db.auth.getSession();if(error)throw error;return data.session;}
export async function loginDashboard(email,password){const db=await dashboardClient();const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw Error('통계 계정 이메일과 비밀번호를 확인해주세요.');const p=await db.from('profiles').select('id,name,role,active').eq('id',data.user.id).maybeSingle();if(p.error||!p.data?.active||!['super','admin','dv'].includes(p.data.role)){await db.auth.signOut();throw Error('통계 DB 내부 담당자 권한이 필요합니다.');}return p.data;}
export async function disconnectDashboard(){if(database)await database.auth.signOut();}
export function dashboardKeys(week){const keys=['api|activity','file|data/pv_activity.enc.json','file|data/points.enc.json','file|data/pv_points.enc.json'];for(const svc of ['dv','pv']){keys.push('api|get|'+svc);for(const day of [week,dayShift(week,-7)]){const w=isoWeek(day);keys.push('api|get|'+svc+'|'+JSON.stringify({week:w}),'file|data/'+(svc==='pv'?'pv/':'')+'snapshots/'+w+'.enc.json');}}return keys;}
export function databaseSummary(records,week){const summary=emptyMetrics(week),map=new Map(records.map(r=>[r.key,r]));summary.source='Dashboard_DV.datasets';summary.sections[0].note='Dashboard_DV DB 저장본 · 원본을 갱신하려면 통계 사이트에서 갱신해주세요.';summary.sections[0].platform_notes={};const notes=[],details=[];
for(const [svc,platform] of [['dv','닥터빌'],['pv','팜빌']]){
 const pick=day=>{const w=isoWeek(day),dir=svc==='pv'?'pv/':'';for(const key of ['api|get|'+svc+'|'+JSON.stringify({week:w}),'api|get|'+svc,'file|data/'+dir+'snapshots/'+w+'.enc.json']){const row=map.get(key),payload=row?.data,snap=payload?.snap||payload;if(snap?.weekStart===day&&(snap.svc||'dv')===svc)return {snap,prev:payload?.prev,at:row.fetched_at};}return null;};
 const current=pick(week),previous=pick(dayShift(week,-7))?.snap||(current?.prev?.weekStart===dayShift(week,-7)?current.prev:null);
 if(current){for(const [label,k] of [['전체 회원','total'],['신규 회원','newWeek']])summary.sections[0].rows.push({label,platform,value:numberValue(current.snap.kpi?.[k]),unit:'명',previous:numberValue(previous?.kpi?.[k]??(k==='newWeek'?current.snap.kpi?.newPrevWeek:null))});summary.sections[0].platform_notes[platform]='회원 DB 저장: '+(current.at||'시각 미확인');}else summary.sections[0].platform_notes[platform]='선택한 주간의 회원 DB 저장본이 없습니다.';
 const act=map.get(svc==='dv'?'api|activity':'file|data/pv_activity.enc.json');if(act){let data=act.data.activity||act.data;
 const part=activityMetrics(data,week);summary.sections[0].rows.push(...part.rows.map(r=>({...r,platform})));summary.sections[0].platform_notes[platform]+=' · 활동성 DB 저장: '+(act.fetched_at||'시각 미확인')+(part.note?' · '+part.note:'');}else summary.sections[0].platform_notes[platform]+=' · 활동성 DB 저장본 없음';
 const record=map.get(svc==='dv'?'file|data/points.enc.json':'file|data/pv_points.enc.json');const part=record?pointMetrics(record.data,week):{rows:[],note:'포인트 DB 저장본이 없습니다.'};part.platform=platform;part.rows=part.rows.map(r=>({...r,platform}));if(part.detail_headers)details.push({...part,detail_title:platform+' · '+part.detail_title});notes.push([platform,part.note+(record?' · DB 저장: '+record.fetched_at:'')]);summary.sections[2].rows.push(...part.rows);
}
summary.sections[2].platform_details=details;summary.sections[2].platform_notes=Object.fromEntries(notes);summary.sections[2].note='Dashboard_DV DB 저장본 · '+notes.map(([p,n])=>p+': '+n).join('\n');summary.fetched_at=new Date().toISOString();return summary;
}
export async function loadDatabaseMetrics(week,options={}){let rows;if(options.records)rows=options.records;else{const db=await dashboardClient();const session=await dashboardSession();if(!session)throw Error('통계 DB 계정으로 연결해주세요.');const result=await db.from('datasets').select('key,data,fetched_at').in('key',dashboardKeys(week));if(result.error)throw Error('통계 DB 조회 실패: '+result.error.message);rows=result.data||[];}const summary=databaseSummary(rows,week);try{summary.sections[1]=await (options.seminar||loadSeminarMetrics)(week)}catch(err){summary.sections[1].note='세미나 조회 실패: '+err.message}return summary;}


export function monthlyDatabaseSummary(records,month,seminars){
 const prev=new Date(month+'-01T12:00:00Z');prev.setUTCMonth(prev.getUTCMonth()-1);const previous=prev.toISOString().slice(0,7);
 const summary=emptyMetrics(month+'-01');summary.month=month;summary.trends=[];summary.source='Dashboard_DV.datasets';summary.fetched_at=new Date().toISOString();
 const sections=summary.sections;sections.forEach(s=>{s.period=month;s.rows=[];s.note='선택 월과 직전 월의 원본 집계 값입니다.';});
 for(const [svc,platform] of [['dv','닥터빌'],['pv','팜빌']]){
  const record=records.find(r=>String(r.key).startsWith('report|'+svc+'|')&&r.data?.m);
  const data=record?.data;
  for(const [key,index] of [['sales',0],['newM',0],['total',0],['dau',0],['mau',0],['views',0],['earn',2],['use',2],['expire',2],['bal',2]]){
   const metric=data?.m?.[key];if(!metric)continue;
   const value=m=>{const values=(metric.src?.m||[]).filter(x=>String(x[0]).slice(0,7)===m);return values.length?numberValue(values.at(-1)[1]):null};
   sections[index].rows.push({label:metric.label||key,platform,value:value(month),previous:value(previous),unit:metric.unit||''});
   const year=Number(month.slice(0,4)),last=Number(month.slice(5,7));summary.trends.push({label:metric.label||key,platform,unit:metric.unit||'',months:Array.from({length:last},(_,i)=>String(i+1).padStart(2,'0')),current:Array.from({length:last},(_,i)=>value(year+'-'+String(i+1).padStart(2,'0'))),previous:Array.from({length:last},(_,i)=>value((year-1)+'-'+String(i+1).padStart(2,'0')))});
  }
  sections[0].platform_notes||={};sections[0].platform_notes[platform]=record?'통합 DB 보고서 저장본 · '+(record.fetched_at||''):'통합 DB 보고서 저장본을 찾지 못했습니다.';
 }
 const complete=r=>r[7]===true||/^(true|완료|y|예|1)$/i.test(String(r[7]).trim());
 const selected=m=>(seminars||[]).filter(r=>String(r[0]).slice(0,7)===m);
 const stat=(m,pv)=>{const rows=selected(m).filter(r=>!pv||numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null),done=rows.filter(complete);
  const vals=(index)=>done.map(r=>numberValue(pv?(index===8?r.pv_signup:r.pv_view):r[index])).filter(x=>x!==null);
  const sum=i=>{const v=vals(i);return v.length?v.reduce((a,b)=>a+b,0):done.length?null:0};
  const avg=i=>{const v=vals(i);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  return {done,values:[rows.length,done.length,sum(8),sum(9),avg(10),avg(11)]};
 };
 const detail=[];
 for(const [platform,pv] of [['닥터빌',false],['팜빌',true]]){
  const now=stat(month,pv),before=stat(previous,pv);if(pv&&!(seminars||[]).some(r=>numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null))continue;
  const labels=[['편성 건수','건'],['완료 건수','건'],['신청자 수 합계','명'],['시청자 수 합계','명'],['평균 만족도','점'],['평균 유용도','점']];
  sections[1].rows.push(...labels.slice(0,pv?4:6).map(([label,unit],i)=>({label,unit,platform,value:now.values[i],previous:before.values[i]})));
  detail.push({platform,detail_title:platform+' · 완료 강의 상세',detail_headers:['강의명','연자명','신청자 수','시청자 수','만족도','유용도'],detail_rows:now.done.map(r=>[r.title||'미입력',r.speaker||'미입력',...(pv?[r.pv_signup,r.pv_view,null,null]:[r[8],r[9],r[10],r[11]]).map(x=>numberValue(x)??'미입력')])});
 }
 sections[1].platform_details=detail;sections[1].note='Google Sheets Raw 강의일 기준 월별 집계 · 완료 강의 기준 신청·시청 합계와 평균 점수';
 return summary;
}
export async function loadMonthlyDatabaseMetrics(month,options={}){
 const {querySeminarSheet,parseGVizResponse,seminarRowsFromTable}=await import('./metrics.mjs?v=20261102-report5');
 let records=options.records;
 if(!records){const db=await dashboardClient();if(!await dashboardSession())throw Error('통계 DB 계정을 연결해주세요.');
  const result=await Promise.all(['dv','pv'].map(svc=>db.from('datasets').select('key,data,fetched_at').like('key','report|'+svc+'|%').order('fetched_at',{ascending:false}).limit(1)));
  for(const r of result)if(r.error)throw Error('통계 DB 조회 실패: '+r.error.message);
  records=result.flatMap(r=>r.data||[]);
 }
 const response=options.seminars?null:await querySeminarSheet();
 const rows=options.seminars||seminarRowsFromTable(typeof response==='string'?parseGVizResponse(response):response);
 return monthlyDatabaseSummary(records,month,rows);
}
