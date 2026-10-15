import {emptyMetrics,metricTitles,dayShift,numberValue,comparison} from './metrics.mjs?v=20261015-export-template';
import {reporterNotes} from './weekly.mjs?v=20261015-export-template';
export function weeklyExcelRows(s){const person=id=>s.members.find(m=>m.id===id)?.name||'미등록';return {
 tasks:[['구분/플랫폼명','업무내용','상태','목표 일정','진행률','업무담당자','주요성과','서비스','업무 ID'],...s.reports.flatMap(r=>r.items.map(i=>[i.project,i.title,i.state,i.target_date?new Date(i.target_date+'T00:00:00Z'):null,i.progress/100,person(r.user_id),i.result||'',i.service||'',i.id||''])).sort((a,b)=>a[0].localeCompare(b[0],'ko'))],
 issues:[['보고자','금주 이슈 및 대응','소속'],...reporterNotes(s,'issues').map(r=>[r.name,r.text,r.team])],
 plans:[['보고자','다음 주 계획','소속'],...reporterNotes(s,'next_plan').map(r=>[r.name,r.text,r.team])]
};}
const full=[[2,14]],metricSpans=[[2,4],[5,6],[7,7],[8,14]],taskSpans=[[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,12],[13,13],[14,14]],noteSpans=[[2,3],[4,12],[13,14]];
const width=20.625,bodyLine=15.5,maxLines=22;
function charWidth(c){return /[^\u0000-\u00ff]/u.test(c)?2:1;}
function wrappedLines(text,capacity){let count=1,line=0;for(const c of String(text)){if(c==='\n'){count++;line=0;}else{const next=charWidth(c);if(line+next>capacity){count++;line=0;}line+=next;}}return count;}
export function splitExcelText(value,capacity,limit=maxLines){if(typeof value!=='string')return [value];const chars=Array.from(value),chunks=[];let start=0,line=0,lines=1;for(let i=0;i<chars.length;i++){const c=chars[i],cost=charWidth(c);if(c==='\n'){lines++;line=0;}else{if(line+cost>capacity){lines++;line=0;}line+=cost;}if(lines>limit){const cut=c==='\n'?i+1:i;if(cut>start){chunks.push(chars.slice(start,cut).join(''));start=cut;}lines=1;line=cut>i?0:cost;}}if(start<chars.length||!chunks.length)chunks.push(chars.slice(start).join(''));return chunks;}
const capacity=([first,last])=>(last-first+1)*width-3;
const numberFormat=(value,unit='')=>('#,##0'+(Number.isInteger(value)?'':'.00'))+(unit?'"'+unit.replaceAll('"','')+'"':'');
export function weeklyExcelLayout(s){
 const rows=[],data=weeklyExcelRows(s),summary=s.metrics||emptyMetrics(s.week);let cursor=5;
 const add=(values,spans=full,kind='body',formats=[])=>{const chunks=values.map((value,i)=>splitExcelText(value,capacity(spans[i]))),count=Math.max(1,...chunks.map(c=>c.length));for(let part=0;part<count;part++){const cells=spans.map(([from,to],i)=>({from,to,value:chunks[i]?.[part]??'',numFmt:formats[i]}));const lines=Math.max(1,...cells.map(c=>wrappedLines(c.value instanceof Date?'2026-12-31':c.value,capacity([c.from,c.to]))));rows.push({row:cursor++,kind,cells,height:Math.max(26.1,Math.min(409.5,lines*bodyLine+8))});}};
 const text=(value,kind='body')=>add([value],full,kind),gap=()=>{rows.push({row:cursor++,kind:'gap',height:16,cells:[]});};
 text('0. 기간','section');text(s.week+' ~ '+dayShift(s.week,6));gap();
 metricTitles.forEach((title,index)=>{
  const part=summary.sections?.[index]||{};text(title,'section');text('집계 기간: '+(part.period||s.week+' ~ '+dayShift(s.week,6)));
  for(const platform of ['닥터빌','팜빌']){
   text(platform,'platform');add(['지표명','전주 값','금주 값','증감 비교'],metricSpans,'tableHeader');
   const metrics=(part.rows||[]).filter(r=>(r.platform||(/^\[팜빌\]/.test(r.label)?'팜빌':'닥터빌'))===platform);
   if(!metrics.length)add(['지표','자료 미확인','자료 미확인',''],metricSpans);
   metrics.forEach(r=>{const previous=numberValue(r.previous),current=numberValue(r.value);add([r.label.replace(/^\[(닥터빌|팜빌)\]\s*/,''),previous??'자료 미확인',current??'자료 미확인',comparison(r)],metricSpans,'body',['',numberFormat(previous,r.unit),numberFormat(current,r.unit),'']);});
   for(const detail of (part.platform_details||[part]).filter(p=>(p.platform||'닥터빌')===platform)){
    if(!detail.detail_headers)continue;text(detail.detail_title||'상세');const count=detail.detail_headers.length;
    const spans=count===4?[[2,3],[4,5],[6,7],[8,14]]:count===5?[[2,6],[7,8],[9,10],[11,12],[13,14]]:count===6?[[2,5],[6,7],[8,9],[10,11],[12,12],[13,14]]:Array.from({length:count},(_,i)=>[2+Math.floor(i*13/count),1+Math.floor((i+1)*13/count)]);
    add(detail.detail_headers,spans,'tableHeader');for(const values of detail.detail_rows||[])add(spans.map((_,i)=>values[i]??''),spans);if(!detail.detail_rows?.length)text('해당 기간 상세 자료 없음');
   }
  }gap();
 });
 text('4. 주간 업무','section');data.tasks.forEach((values,i)=>add(values,taskSpans,i?'body':'tableHeader',i?['','','','yyyy-mm-dd','0%','','','','']:[]));gap();gap();
 for(const [key,title] of [['issues','5. 금주 이슈 및 대응'],['plans','6. 다음주 계획']]){
  text(title,'section');const ai=s.ai_summary?.[key==='issues'?'issues':'plans'];if(ai){text('GPT 요약','platform');for(const item of ai)text(item.topic+' · '+item.summary);if(!ai.length)text('해당 내용 없음');text('보고자별 원문','platform');}
  const values=data[key].length>1?data[key]:[data[key][0],['일반','없음','']];values.forEach((value,i)=>add(value,noteSpans,i?'body':'tableHeader'));gap();gap();
 }
 return {title:s.week+' 주간 업무 보고',rows,lastRow:cursor-3};
}
export function buildWeeklyExcel(ExcelJS,s){
 const book=new ExcelJS.Workbook(),layout=weeklyExcelLayout(s);book.creator=s.author;book.created=new Date(s.created_at);
 const sheet=book.addWorksheet('주간 통합보고',{views:[{state:'frozen',ySplit:3,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'2:3',margins:{left:.7,right:.7,top:.75,bottom:.75,header:.3,footer:.3}}});
 sheet.columns=[{width:1.625},...Array.from({length:13},()=>({width}))];sheet.getRow(1).height=9.95;sheet.getRow(2).height=30;sheet.getRow(3).height=24;
 const border={top:{style:'thin',color:{argb:'FF000000'}},bottom:{style:'thin',color:{argb:'FF000000'}},left:{style:'thin',color:{argb:'FF000000'}},right:{style:'thin',color:{argb:'FF000000'}}};
 sheet.mergeCells('B2:N3');const title=sheet.getCell('B2');title.value=layout.title;title.font={name:'맑은 고딕',size:16,bold:true,color:{argb:'FFFFFFFF'}};title.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF595959'}};title.alignment={horizontal:'center',vertical:'middle',wrapText:true};title.border=border;
 let body=0;
 for(const record of layout.rows){const row=sheet.getRow(record.row);row.height=record.height;if(record.kind==='gap')continue;const dark=['section','tableHeader'].includes(record.kind),fill=dark?'FF595959':record.kind==='body'&&body++%2?'FFF8F9FA':'FFFFFFFF';
  for(const data of record.cells){if(data.to>data.from)sheet.mergeCells(record.row,data.from,record.row,data.to);const cell=sheet.getCell(record.row,data.from);cell.value=data.value===''?null:data.value;cell.font={name:'맑은 고딕',size:record.kind==='platform'?14:11,bold:dark||record.kind==='platform',color:{argb:dark?'FFFFFFFF':'FF000000'}};cell.alignment={vertical:'middle',horizontal:dark||typeof data.value==='number'||data.value instanceof Date?'center':'left',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:fill}};cell.border=border;if(data.numFmt)cell.numFmt=data.numFmt;}
 }
 sheet.pageSetup.printArea='B1:N'+layout.lastRow;return book;
}
let excelModule;
export async function weeklyExcelBlob(s){if(!globalThis.ExcelJS)excelModule||=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.onload=()=>resolve(globalThis.ExcelJS);script.onerror=()=>{excelModule=null;reject(Error('Excel 모듈을 불러오지 못했습니다. 네트워크를 확인해주세요.'));};document.head.append(script);});const ExcelJS=globalThis.ExcelJS||await excelModule,book=buildWeeklyExcel(ExcelJS,s);return new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
