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


// ---- 월간 지표: 통합 통계(Dashboard_DV) 리포트 저장본(report|svc|생성시각)의 월간 지표 정의를 그대로 사용 ----
// 집계 방식은 통계 사이트 리포트(rSum·rLevel·rAvg)와 동일: 합계(sum)·기말(level)·평균(avg)
const DAY=86400000;
const dn=s=>Math.floor(Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/DAY);
const ds=n=>new Date(n*DAY).toISOString().slice(0,10);
export const monthEnd=ym=>new Date(Date.UTC(+ym.slice(0,4),+ym.slice(5,7),0)).toISOString().slice(0,10);
export function previousMonth(ym){const d=new Date(ym+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);}
export function unpackSource(p){
 if(!p)return null;const src={m:[],w:[],d:[]};let last='';
 const push=(g,s,e,v)=>{v=numberValue(v);if(v===null||!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return;src[g].push({s,e,a:dn(s),b:dn(e),v});if(e>last)last=e;};
 for(const [ym,v] of p.m||[])push('m',ym+'-01',monthEnd(ym),v);
 for(const [d,v] of p.w||[])push('w',d,ds(dn(d)+6),v);
 for(const [d,v] of p.d||[])push('d',d,d,v);
 src.end=p.end||last||null;src.en=src.end?dn(src.end):-1e9;return src;
}
function sumOf(src,a,b){
 const b2=Math.min(b,src.en);if(b2<a)return {val:null,a,b:b2,est:0,miss:b-a+1,none:true};
 const n=b2-a+1,cov=new Uint8Array(n);let val=0,any=false,est=0;
 for(const g of ['m','w','d'])for(const it of src[g]){if(it.a<a||it.b>b2)continue;let taken=false;for(let x=it.a;x<=it.b;x++)if(cov[x-a]){taken=true;break;}if(taken)continue;for(let x=it.a;x<=it.b;x++)cov[x-a]=1;val+=it.v;any=true;}
 for(const g of ['d','w','m'])for(const it of src[g]){if(it.b>src.en||it.b<a||it.a>b2)continue;const len=it.b-it.a+1;for(let x=Math.max(it.a,a);x<=Math.min(it.b,b2);x++)if(!cov[x-a]){cov[x-a]=2;val+=it.v/len;est++;any=true;}}
 let miss=0;for(let i=0;i<n;i++)if(!cov[i])miss++;
 return {val:any?val:null,a,b:b2,est,miss:miss+(b-b2)};
}
const AVG={dau:[['d',1],['w',1],['m',1]],wau:[['w',4]],mau:[['m',15],['w',4]],mavg:[['m',15]]};
function avgOf(src,a,b,how){
 const b2=Math.min(b,src.en);if(b2<a)return {val:null,a,b:b2,none:true};
 if(how==='dau'&&!src.d.length){const fm=src.m.filter(it=>it.a>=a&&it.b<=b2);let days=0,sv=0;for(const it of fm){const len=it.b-it.a+1;days+=len;sv+=it.v*len;}if(fm.length&&days===b2-a+1)return {val:sv/days,a,b:b2,g:'m',cnt:fm.length};}
 for(const [g,minO] of AVG[how]||AVG.mavg){let sw=0,sv=0,cnt=0;for(const it of src[g]){if(it.b>src.en)continue;const o=Math.min(it.b,b2)-Math.max(it.a,a)+1;if(o<minO)continue;const w=how==='dau'?o:1;sw+=w;sv+=it.v*w;cnt++;}if(sw)return {val:sv/sw,a,b:b2,g,cnt};}
 return {val:null,a,b:b2};
}
function levelOf(src,a,b){const b2=Math.min(b,src.en);let best=null;for(const g of ['m','w','d'])for(const it of src[g])if(it.b<=b2&&it.b>=a-31&&(!best||it.b>=best.b))best=it;return {val:best?best.v:null,a,b:b2,at:best?best.e:null,none:!best};}
export function evaluateMetric(mt,a,b){if(!mt?.src)return null;const r=mt.kind==='sum'?sumOf(mt.src,a,b):mt.kind==='avg'?avgOf(mt.src,a,b,mt.how):levelOf(mt.src,a,b);
 // 통계 사이트와 같이 기간의 절반 이상 미집계인 합계는 값으로 쓰지 않음
 if(mt.kind==='sum'&&r.val!==null&&r.miss>(b-a+1)/2)r.val=null;return r;}
export const metricGroups=[['회원',['total','newM','gaMem']],['활동성',['mau','dau','wau','views','visits','newU']],['포인트',['earn','use','cancel','expire','bal']],['매출',['sales']]];
const groupOf=key=>metricGroups.find(([,keys])=>keys.includes(key))?.[0]||'기타';
const orderOf=key=>{const flat=metricGroups.flatMap(([,k])=>k),i=flat.indexOf(key);return i<0?999:i;};
// 선택 월과 직전 월 비교. 진행 중인 달의 합계 지표는 직전 월의 같은 기간(1~D일)과 비교합니다.
export function monthlyMetricRow(key,def,platform,month){
 const mt={kind:def.kind||'level',how:def.how||undefined,src:unpackSource(def.src)},label=String(def.label||key),unit=String(def.unit||'');
 const row={key,label,platform,group:groupOf(key),kind:mt.kind,unit,value:null,previous:null,partial:false,through:'',basis:'month',note:''};
 if(!mt.src){row.note='원천 자료 없음';return row;}
 const ms=dn(month+'-01'),me=dn(monthEnd(month)),cur=evaluateMetric(mt,ms,me);
 const pm=previousMonth(month);let pa=dn(pm+'-01'),pb=dn(monthEnd(pm));
 if(cur&&cur.b>=ms&&cur.b<me){row.partial=true;row.through=ds(cur.b);if(mt.kind==='sum'){pb=Math.min(pb,pa+(cur.b-ms));row.basis='same-days';}}
 const prev=evaluateMetric(mt,pa,pb);
 row.value=cur?.val??null;row.previous=prev?.val??null;
 if(cur?.est)row.note=cur.est+'일 일할 추정';
 if(row.value===null)row.note=cur?.none?'선택 월 자료 없음':'선택 월 집계 부족';
 return row;
}
export function monthlyDatabaseSummary(records,month,seminars){
 const previous=previousMonth(month);
 const summary=emptyMetrics(month+'-01');summary.month=month;summary.previous_month=previous;summary.source='Dashboard_DV.datasets · report';summary.fetched_at=new Date().toISOString();summary.packs=[];
 const sections=summary.sections;sections.forEach(s=>{s.period=month;s.rows=[];s.note='';});
 for(const [svc,platform] of [['dv','닥터빌'],['pv','팜빌']]){
  const record=records.find(r=>String(r.key).startsWith('report|'+svc+'|')&&r.data?.m);
  summary.packs.push({platform,key:record?.key||'',generated_at:record?.data?.generatedAt||record?.fetched_at||'',anchor:record?.data?.anchor||''});
  if(!record)continue;
  // 세미나는 Google Sheets 원본을 직접 집계하므로 통계 리포트의 '세미나 진행'은 제외합니다.
  for(const key of Object.keys(record.data.m).filter(k=>k!=='sem').sort((a,b)=>orderOf(a)-orderOf(b))){
   const row=monthlyMetricRow(key,record.data.m[key],platform,month);sections[row.group==='포인트'?2:0].rows.push(row);
  }
 }
 sections[0].note=summary.packs.map(p=>p.platform+': '+(p.key?'통합 통계 리포트 '+(p.generated_at||'')+' 생성본':'통합 통계 리포트 저장본 없음')).join(' · ');
 sections[2].note=sections[0].note;
 const complete=r=>r[7]===true||/^(true|완료|y|예|1)$/i.test(String(r[7]).trim());
 const selected=m=>(seminars||[]).filter(r=>String(r[0]).slice(0,7)===m);
 const stat=(m,pv)=>{const rows=selected(m).filter(r=>!pv||numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null),done=rows.filter(complete);
  const vals=index=>done.map(r=>numberValue(pv?(index===8?r.pv_signup:r.pv_view):r[index])).filter(x=>x!==null);
  const sum=i=>{const v=vals(i);return v.length?v.reduce((a,b)=>a+b,0):done.length?null:0};
  const avg=i=>{const v=vals(i);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  return {done,values:[rows.length,done.length,sum(8),sum(9),avg(10),avg(11)]};
 };
 const detail=[];
 for(const [platform,pv] of [['닥터빌',false],['팜빌',true]]){
  if(pv&&!(seminars||[]).some(r=>numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null))continue;
  const now=stat(month,pv),before=stat(previous,pv);
  const labels=[['편성 건수','건','sum'],['완료 건수','건','sum'],['신청자 수 합계','명','sum'],['시청자 수 합계','명','sum'],['평균 만족도','점','avg'],['평균 유용도','점','avg']];
  sections[1].rows.push(...labels.slice(0,pv?4:6).map(([label,unit,kind],i)=>({key:'seminar'+i,label,unit,kind,platform,group:'세미나',value:now.values[i],previous:before.values[i],partial:false,basis:'month',note:''})));
  detail.push({platform,detail_title:platform+' · 완료 강의 상세',detail_headers:['강의일','강의명','연자명','신청자 수','시청자 수','만족도','유용도'],detail_rows:now.done.map(r=>[String(r[0]||''),r.title||'미입력',r.speaker||'미입력',...(pv?[r.pv_signup,r.pv_view,null,null]:[r[8],r[9],r[10],r[11]]).map(x=>numberValue(x)??'-')])});
 }
 sections[1].platform_details=detail;sections[1].note='비학술 세미나 Google Sheets raw · 강의일 기준 월 집계 · 완료 강의의 신청·시청 합계와 평균 점수';
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
