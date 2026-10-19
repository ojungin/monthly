import {escapeHTML as e} from './core.mjs';
export const metricTitles=['1. 주요 지표 · 회원 및 활동성','2. 비학술 세미나 기획 및 운영 지표','3. 포인트 지급·사용·잔여 지표'];
export const sources=[
 ['Dashboard_DV 회원 DB','https://ojungin.github.io/doctorville_dash/'],
 ['Dashboard_DV 활동성 DB','https://ojungin.github.io/doctorville_dash/#activity'],
 ['비학술 세미나 · raw','https://docs.google.com/spreadsheets/d/1UQqI5Yqjt7pSReSFb0IltpBInHijTFY8eHq0Df-B3Ow/edit'],
 ['Dashboard_DV 포인트 DB','https://ojungin.github.io/doctorville_dash/#points']];
export function dayShift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function isoWeek(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+3-(d.getUTCDay()+6)%7);const year=d.getUTCFullYear(),first=new Date(Date.UTC(year,0,4,12));return year+'-W'+String(1+Math.round((d-first)/604800000)).padStart(2,'0')}
export function numberValue(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(String(v).replace(/[,\s명점%]/g,''));return Number.isFinite(n)?n:null}
function metric(label,value,unit='',previous=null){return {label,value:numberValue(value),unit,previous:numberValue(previous)}}
export function displayMetric(row){const n=numberValue(row.value);return n===null?'자료 미확인':n.toLocaleString('ko-KR',{maximumFractionDigits:2})+(row.unit||'')}
export function comparison(row){const n=numberValue(row.value),p=numberValue(row.previous);if(n===null||p===null)return '';const d=n-p;return '전주 대비 '+(d>0?'▲ 상승 ':d<0?'▼ 하락 ':'변동 없음 ')+(d>0?'+':'')+d.toLocaleString('ko-KR',{maximumFractionDigits:2})+(row.unit||'')+(p===0?' (증감률 산출 불가)':' ('+(d>0?'+':'')+(d/p*100).toFixed(1)+'%)')}
export function emptyMetrics(week){return {version:1,week,fetched_at:null,sections:metricTitles.map(title=>({title,period:week+' ~ '+dayShift(week,6),rows:[],note:'원본 지표를 아직 불러오지 않았습니다.'}))}}
export function metricRows(summary,index,platform){const rows=summary?.sections?.[index]?.rows||[];const selected=platform?rows.filter(r=>(r.platform||(/^\[팜빌\]/.test(r.label)?'팜빌':'닥터빌'))===platform):rows;return selected.length?selected.map(r=>[r.label.replace(/^\[(닥터빌|팜빌)\]\s*/,''),displayMetric({...r,value:r.previous}),displayMetric(r),comparison(r)]):[['지표','자료 미확인','자료 미확인','']]}
export function metricsBody(s,{includeMetadata=true}={}){const summary=s.metrics||emptyMetrics(s.week);return metricTitles.map((title,i)=>{const part=summary.sections?.[i]||{},sourceIndexes=i===0?[0,1]:i===1?[2]:[3];return '<section class="report-section"><h2>'+title+'</h2><p class="report-muted">집계 기간: '+e(part.period||s.week+' ~ '+dayShift(s.week,6))+'</p>'+['닥터빌','팜빌'].map(platform=>'<h3>'+platform+'</h3><table class="metric-table"><colgroup><col style="width:31%"><col style="width:17%"><col style="width:17%"><col style="width:35%"></colgroup><thead><tr><th>지표명</th><th>전주 값</th><th>금주 값</th><th>증감 비교</th></tr></thead><tbody>'+metricRows(summary,i,platform).map(r=>'<tr>'+r.map(c=>'<td>'+(c==='자료 미확인'?'<span class="report-missing">'+e(c)+'</span>':e(c))+'</td>').join('')+'</tr>').join('')+'</tbody></table>'+metricDetailsBody(part,platform)+(includeMetadata?'<p class="report-muted">'+e(part.platform_notes?.[platform]||'')+'</p>':'')+(includeMetadata&&platform==='팜빌'&&!part.rows?.some(r=>r.platform==='팜빌'||/^\[팜빌\]/.test(r.label))?'<p class="report-muted">'+e(part.platform_notes?.['팜빌']||'선택한 주간의 팜빌 자료가 없습니다.')+'</p>':'')).join('')+(includeMetadata?'<p class="report-footnote">'+e(part.note||'')+'</p><p class="report-muted">출처: '+sourceIndexes.map(n=>'<a target="_blank" rel="noopener" href="'+sources[n][1]+'">'+e(sources[n][0])+'</a>').join(' · ')+'</p>':'')+'</section>'}).join('')+(includeMetadata?'<p class="report-muted">지표 조회: '+e(summary.fetched_at||'미조회')+'</p>':'')}
export function metricDetailsBody(part,platform){if(platform&&part.platform_details)return part.platform_details.filter(p=>p.platform===platform).map(p=>metricDetailsBody(p)).join('');if(platform&&(part.platform||'닥터빌')!==platform)return '';if(part.platform_details)return part.platform_details.map(p=>metricDetailsBody(p)).join('');if(!part.detail_headers)return '';return '<h3>'+e(part.detail_title)+'</h3><div class="table-wrap"><table><thead><tr>'+part.detail_headers.map(x=>'<th>'+e(x)+'</th>').join('')+'</tr></thead><tbody>'+(part.detail_rows?.length?part.detail_rows.map(row=>'<tr>'+row.map(x=>'<td>'+e(x)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+part.detail_headers.length+'">해당 기간 상세 자료 없음</td></tr>')+'</tbody></table></div>'}
export function activityWeek(value){
 const raw=String(value??'').trim();
 const iso=raw.match(/^(\d{4})-W(\d{1,2})$/i);
 if(iso){const first=iso[1]+'-01-04',day=new Date(first+'T12:00:00Z').getUTCDay();const monday=dayShift(first,-((day+6)%7));const date=dayShift(monday,(Number(iso[2])-1)*7);return isoWeek(date)===iso[1]+'-W'+iso[2].padStart(2,'0')?date:'';}
 const m=raw.match(/^(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?:[T\s.]|$)/);
 if(!m)return '';
 const date=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
 const parsed=new Date(date+'T12:00:00Z');
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date?date:'';
}
export function activityMetrics(data,week){
 const section={title:metricTitles[0],period:week+' ~ '+dayShift(week,6),rows:[],note:''},prev=dayShift(week,-7);
 const normal=value=>String(value??'').replace(/\s/g,'').toLowerCase();
 const index=(cols,names)=>cols.findIndex(c=>names.some(n=>normal(c)===normal(n)));
 const table=data?.weekly,cols=table?.cols||[],rows=table?.rows||[];
 const date=index(cols,['주 시작일(월)','주 시작일','주차']),device=index(cols,['기기','구분']);
 const find=w=>rows.filter(r=>activityWeek(r[date])===w&&/^(전체|all|total)$/i.test(String(r[device]??'').trim())).at(-1);
 const now=find(week),before=find(prev);
 if(!now)section.note='해당 주 전체 기기 활동성 자료 미확인. PC/MO 사용자 수를 합산하지 않습니다.';
 else{
  if(!before)section.note='직전 주('+prev+') 전체 기기 활동성 자료 미확인. 다른 주간 값으로 대체하지 않습니다.';
  for(const [label,unit] of [['DAU','명'],['WAU','명'],['MAU','명'],['MAU(YTD)','명'],['조회수','회'],['평균세션시간(분)','분']]){
   const j=index(cols,[label]);if(j>=0)section.rows.push(metric(label==='MAU(YTD)'?'YTD MAU (연초 누적)':label,now[j],unit,before?.[j]));
  }
 }
 const pages=data?.pageWeekly,pcols=pages?.cols||[],pdate=index(pcols,['주 시작일(월)','주 시작일','주차']),pname=index(pcols,['페이지그룹']),pv=index(pcols,['조회수']);
 if(pdate>=0&&pname>=0&&pv>=0){
  const pageMap=w=>{const map=new Map();for(const r of pages.rows||[])if(activityWeek(r[pdate])===w)map.set(String(r[pname]).trim(),r);return map;};
  const current=pageMap(week),previous=pageMap(prev);
  const top=[...current.entries()].sort(([,a],[,b])=>(numberValue(b[pv])||0)-(numberValue(a[pv])||0)).slice(0,5);
  section.rows.push(...top.map(([name,r])=>metric('페이지 조회수 · '+name,r[pv],'회',previous.get(name)?.[pv])));
  if(!top.length)section.note+=' 페이지별 해당 주 자료 미확인.';
 }
 return section;
}
function seminarDate(value){if(value instanceof Date)return value.toISOString().slice(0,10);const google=String(value??'').match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,.*)?\)$/);if(google)return google[1]+'-'+String(Number(google[2])+1).padStart(2,'0')+'-'+google[3].padStart(2,'0');const m=String(value??'').match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';}
export function seminarMetrics(rows,week){
 const complete=r=>r[7]===true||/^(true|완료|y|예|1)$/i.test(String(r[7]).trim());
 const inWeek=(r,w)=>{const date=seminarDate(r[0]);return date>=w&&date<=dayShift(w,6);};
 const build=(platform,pv=false)=>{
  const eligible=pv?rows.filter(r=>numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null):rows;
  const aggregate=w=>{const chosen=eligible.filter(r=>inWeek(r,w)),done=chosen.filter(complete),value=(r,i)=>pv?(i===8?r.pv_signup:i===9?r.pv_view:null):r[i];
   const sum=i=>{if(!done.length)return 0;const ns=done.map(r=>numberValue(value(r,i))).filter(n=>n!==null);return ns.length?ns.reduce((a,b)=>a+b,0):null;};
   const avg=i=>{const ns=done.map(r=>numberValue(value(r,i))).filter(n=>n!==null);return ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:null;};
   return {chosen,done,value,values:[chosen.length,done.length,sum(8),sum(9),avg(10),avg(11)]};};
  const now=aggregate(week),prev=aggregate(dayShift(week,-7)),labels=[['편성 건수','건'],['완료 건수','건'],['신청자 수 합계','명'],['시청자 수 합계','명'],['평균 만족도','점'],['평균 유용도','점']];
  return {platform,rows:labels.filter((_,i)=>!pv||i<4).map(([label,unit],i)=>({...metric(label,now.values[i],unit,prev.values[i]),platform})),detail_title:'완료 강의 상세',detail_headers:['강의명','연자명','신청자 수','시청자 수','만족도','유용도'],detail_rows:now.done.map(r=>[String(r.title||'').trim()||'미입력',String(r.speaker||'').trim()||'미입력',...[8,9,10,11].map(i=>numberValue(now.value(r,i))??'미입력')])};
 };
 const dv=build('닥터빌'),pv=build('팜빌',true),hasPV=rows.some(r=>numberValue(r.pv_signup)!==null||numberValue(r.pv_view)!==null);
 return {title:metricTitles[1],period:week+' ~ '+dayShift(week,6),rows:[...dv.rows,...(hasPV?pv.rows:[])],detail_title:dv.detail_title,detail_headers:dv.detail_headers,detail_rows:dv.detail_rows,platform_details:[dv,...(hasPV?[pv]:[])],platform_notes:{'팜빌':'팜빌 신청·시청 수가 입력된 강의만 팜빌로 집계합니다. 만족도·유용도 전용 열은 Raw에 없어 닥터빌 점수를 복사하지 않습니다.'},note:'Raw 일자 기준 월~일 집계 · 완료 체크된 강의만 참여 실적에 반영합니다. 신청·시청은 완료 강의 참여 건수 합계이며 고유 회원 수가 아닙니다. 만족도·유용도는 숫자가 입력된 완료 강의의 단순 평균입니다. 빈칸·대시는 0점으로 계산하지 않습니다.'};
}
export function pointMetrics(data,week){
 const w=data?.weekly,i=w?.weeks?.indexOf(week)??-1,j=w?.weeks?.indexOf(dayShift(week,-7))??-1;
 const part={title:metricTitles[2],period:week+' ~ '+dayShift(week,6)+' (주 집계)',rows:[],detail_title:'사용포인트 상세',detail_headers:['사용 방법','사용 포인트','전주 대비','사용 건수'],detail_rows:[],note:''};
 if(i<0){part.note='선택한 주간의 포인트 원본 자료가 없습니다. 월 누계로 대체하지 않습니다.';return part}
 const prev=values=>j>=0?values?.[j]:null;
 part.rows=[metric('지급 포인트',w.earn?.amt?.[i],'P',prev(w.earn?.amt)),metric('사용 포인트',w.use?.amt?.[i],'P',prev(w.use?.amt)),metric('소멸 포인트',w.expire?.amt?.[i],'P',prev(w.expire?.amt)),metric('토탈 잔여포인트',w.balanceTotal?.[i],'P',prev(w.balanceTotal))];
 part.detail_rows=Object.entries(w.methods?.use||{}).map(([label,v])=>{const r=metric(label,v.amt?.[i],'P',prev(v.amt));return [label,displayMetric(r),comparison(r),numberValue(v.cnt?.[i])??'자료 미확인']});
 part.note='지급·사용·소멸은 해당 주 합계, 토탈 잔여포인트는 주말 기준 원본 잔액입니다. 상승·하락은 수치 증감을 뜻합니다.'+(j<0?' 전주 자료가 없어 비교할 수 없습니다.':'')+(w.partialLast&&i===w.weeks.length-1?' 진행 중인 주: '+w.lastDay+'까지 집계되어 전주 전체와 비교 기간이 다릅니다.':'');
 return part;
}

async function readJSON(url,options){const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('지표 원본 조회 실패 ('+response.status+')');return response.json()}
export function metricError(error){const message=String(error?.message||error);if(/unauthorized/.test(message))return '원본 시트 연동 비밀번호가 일치하지 않습니다. 대시보드 로그인 비밀번호와 시트 연동 비밀번호를 확인해주세요.';if(/locked/.test(message))return '원본 시트 연동이 비밀번호 오류로 잠겼습니다. 10분 후 다시 조회해주세요.';if(/password_not_set/.test(message))return '원본 시트에 연동 비밀번호가 설정되지 않았습니다.';if(/Failed to fetch|NetworkError|Unexpected token|JSON/i.test(message))return '원본 연결 실패: Apps Script 배포 권한·응답·네트워크를 확인해주세요.';return message}

export const seminarSourceURL='https://docs.google.com/spreadsheets/d/1UQqI5Yqjt7pSReSFb0IltpBInHijTFY8eHq0Df-B3Ow/gviz/tq?gid=1830918551&range=A1%3AT1000&headers=1';
export function parseGVizResponse(text){const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw Error('세미나 원본 응답을 확인할 수 없습니다.');return JSON.parse(text.slice(start,end+1))}
export function seminarRowsFromTable(response){
 if(response.status!=='ok'||!response.table)throw Error('세미나 시트 공유 권한과 원본 상태를 확인해주세요.');
 const table=response.table,labels=(table.cols||[]).map(c=>String(c.label||'').replace(/\s/g,'').trim());
 const find=names=>labels.findIndex(label=>names.includes(label));
 const index={date:find(['일자','강의일','강의일자','진행일','진행일자','세미나일자']),done:find(['완료','완료여부','진행완료']),signup:find(['신청자수','닥터빌신청자수','신청수']),view:find(['시청자수','닥터빌시청자수','시청수']),satisfaction:find(['만족도','만족도점수']),usefulness:find(['유용도','유용도점수']),title:find(['강의명','세미나명','제목','주제','강의제목']),speaker:find(['연자','연자명','강사','강사명','강연자','강연자명','발표자'])};
 for(const [key,label] of Object.entries({date:'일자',done:'완료',signup:'신청자 수',view:'시청자 수',satisfaction:'만족도',usefulness:'유용도'}))if(index[key]<0)throw Error('세미나 raw 시트의 열 구성이 변경되었습니다: '+label);
 const pvSignup=find(['팜빌신청자수','팜빌신청수']),namedPVView=find(['팜빌시청자수','팜빌시청수']),pvView=namedPVView>=0?namedPVView:pvSignup>=0?labels.findIndex((label,i)=>i>pvSignup&&['시청자수','시청수'].includes(label)):-1;
 return (table.rows||[]).map(row=>{
  const get=i=>i<0?'':row.c?.[i]?.v??row.c?.[i]?.f??'';
  const values=Array.from({length:12},()=>''),date=get(index.date);values[0]=seminarDate(date);
  if(!values[0]&&typeof date==='number'&&date>30000&&date<90000)values[0]=new Date(Date.UTC(1899,11,30)+date*86400000).toISOString().slice(0,10);
  for(const [key,i] of [['done',7],['signup',8],['view',9],['satisfaction',10],['usefulness',11]])values[i]=get(index[key]);
  values.title=String(get(index.title)).trim();values.speaker=String(get(index.speaker)).trim();values.pv_signup=get(pvSignup);values.pv_view=get(pvView);
  return values;
 }).filter(row=>row[0]);
}
let seminarQueryId=0;
export function querySeminarSheet(){return new Promise((resolve,reject)=>{const callback='weeklySeminarResponse_'+(++seminarQueryId),script=document.createElement('script');let timer;
 const clean=()=>{clearTimeout(timer);script.remove();delete window[callback]};
 window[callback]=response=>{clean();resolve(response)};script.onerror=()=>{clean();reject(Error('세미나 원본을 불러오지 못했습니다. 네트워크와 공유 권한을 확인해주세요.'))};
 timer=setTimeout(()=>{clean();reject(Error('세미나 원본 조회 시간이 초과되었습니다. 다시 조회해주세요.'))},30000);
 script.src=seminarSourceURL+'&tqx='+encodeURIComponent('out:json;responseHandler:'+callback);document.head.append(script);
})}
export async function loadSeminarMetrics(week,query=querySeminarSheet){const response=await query(),rows=seminarRowsFromTable(response),part=seminarMetrics(rows,week);part.fetched_at=new Date().toISOString();part.note+=' Google Sheets raw 직접 조회 · 조회 '+part.fetched_at;return part}
