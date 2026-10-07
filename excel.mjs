import {emptyMetrics,metricTitles,metricRows,dayShift,sources} from './metrics.mjs?v=20261008-report-design-final';
import {groupedNotes} from './weekly.mjs?v=20261008-report-design-final';
export function weeklyExcelRows(s){const person=id=>s.members.find(m=>m.id===id)?.name||'미등록';return {
 tasks:[['프로젝트','업무내용','상태','목표 일정','진행률','업무담당자','주요성과','서비스','업무 ID'],...s.reports.flatMap(r=>r.items.map(i=>[i.project,i.title,i.state,i.target_date?new Date(i.target_date+'T00:00:00Z'):null,i.progress/100,person(r.user_id),i.result||'',i.service||'',i.id||''])).sort((a,b)=>a[0].localeCompare(b[0],'ko'))],
 issues:[['카테고리','이슈 및 지원 요청','담당자'],...groupedNotes(s.reports,'issues').flatMap(g=>g.entries.map(x=>[g.category,x.text,x.owners.map(person).join(', ')]))],
 plans:[['카테고리','다음 주 계획','담당자'],...groupedNotes(s.reports,'next_plan').flatMap(g=>g.entries.map(x=>[g.category,x.text,x.owners.map(person).join(', ')]))]
}}
let excelModule;
export async function weeklyExcelBlob(s){excelModule ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{excelModule=null;reject(Error('Excel 모듈을 불러오지 못했습니다. 네트워크를 확인해주세요.'))};document.head.append(script)});const ExcelJS=await excelModule,book=new ExcelJS.Workbook(),data=weeklyExcelRows(s);book.creator=s.author;book.created=new Date(s.created_at);

 const widths=[22,48,12,15,12,18,58,14,42];
 const sheet=book.addWorksheet('주간 통합보고',{views:[{state:'frozen',ySplit:2}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:2'}});
 sheet.columns=widths.map(width=>({width}));
 sheet.mergeCells('A1:I1');sheet.getCell('A1').value=s.week+' 주간 통합보고';sheet.getCell('A1').font={name:'맑은 고딕',size:16,bold:true,color:{argb:'FF626EE6'}};sheet.getRow(1).height=30;
 sheet.mergeCells('A2:I2');sheet.getCell('A2').value='생성: '+new Date(s.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · 작성: '+s.author+' · 제출 '+s.reports.length+'건';sheet.getRow(2).height=24;
 const style=(row,header,index=0)=>row.eachCell({includeEmpty:true},cell=>{cell.font={name:'맑은 고딕',size:11,...(header?{bold:true,color:{argb:'FFFFFFFF'}}:{})};cell.alignment={vertical:'top',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:header?'FF626EE6':index%2?'FFF8F9FA':'FFFFFFFF'}};cell.border={bottom:{style:'thin',color:{argb:'FFE1E1E1'}}}});
 let cursor=4;
 const titleRow=title=>{sheet.mergeCells(cursor,1,cursor,9);const row=sheet.getRow(cursor);row.getCell(1).value=title;row.height=28;style(row,true);cursor++;};
 const textRow=text=>{sheet.mergeCells(cursor,1,cursor,9);const row=sheet.getRow(cursor);row.getCell(1).value=text;row.height=Math.min(300,Math.max(26,Math.ceil(String(text).length/100)*20));style(row,false);cursor++;};
 titleRow('0. 기간');textRow(s.week+' ~ '+dayShift(s.week,6));cursor++;
 const summary=s.metrics||emptyMetrics(s.week);
 metricTitles.forEach((title,i)=>{const part=summary.sections[i];titleRow(title);textRow('집계 기간: '+part.period);
 for(const values of [['지표','값','비교'],...metricRows(summary,i)]){
  sheet.mergeCells(cursor,1,cursor,4);sheet.mergeCells(cursor,5,cursor,6);sheet.mergeCells(cursor,7,cursor,9);
  const row=sheet.getRow(cursor);row.getCell(1).value=values[0];row.getCell(5).value=values[1];row.getCell(7).value=values[2];row.height=34;style(row,values[0]==='지표');cursor++;
 }textRow(part.note||'');for(const n of (i===0?[0,1]:i===1?[2]:[3]))textRow('출처: '+sources[n][0]+' · '+sources[n][1]);cursor++;});
 textRow('지표 조회: '+(summary.fetched_at||'미조회'));
 titleRow('4. 주간 업무');const taskHeader=cursor;
 data.tasks.forEach((values,n)=>{const row=sheet.getRow(n+taskHeader);row.values=values;row.height=n?Math.min(350,Math.max(38,...values.map((v,c)=>String(v??'').split('\n').reduce((a,line)=>a+Math.max(1,Math.ceil(line.length/(widths[c]*0.7))),0)*16))):28;style(row,!n,n);if(n){row.getCell(4).numFmt='yyyy-mm-dd';row.getCell(5).numFmt='0%'}});
 const taskEnd=data.tasks.length+taskHeader-1;sheet.autoFilter={from:{row:taskHeader,column:1},to:{row:taskEnd,column:9}};
 cursor=taskEnd+3;
 for(const [key,title] of [['issues','5. 이슈 및 지원 요청'],['plans','6. 다음주 계획']]){
  sheet.mergeCells(cursor,1,cursor,9);const titleRow=sheet.getRow(cursor);titleRow.getCell(1).value=title;titleRow.height=28;style(titleRow,true);cursor++;
  const rows=data[key].length>1?data[key]:[data[key][0],['일반','없음','']];
  for(const [n,values] of rows.entries()){
   sheet.mergeCells(cursor,1,cursor,2);sheet.mergeCells(cursor,3,cursor,7);sheet.mergeCells(cursor,8,cursor,9);
   const row=sheet.getRow(cursor);row.getCell(1).value=values[0];row.getCell(3).value=values[1];row.getCell(8).value=values[2];row.height=n?Math.min(350,Math.max(38,...values.map((v,c)=>String(v??'').split('\n').reduce((a,line)=>a+Math.max(1,Math.ceil(line.length/([40,85,32][c]))),0)*16))):28;style(row,!n,n);cursor++;
  }cursor+=2;
 }
 sheet.pageSetup.printArea='A1:I'+(cursor-3);
 return new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
