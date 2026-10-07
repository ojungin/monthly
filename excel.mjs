import {groupedNotes} from './weekly.mjs';
export function weeklyExcelRows(s){const person=id=>s.members.find(m=>m.id===id)?.name||'미등록';return {
 tasks:[['프로젝트','업무내용','상태','목표 일정','진행률','업무담당자','주요성과','서비스','업무 ID'],...s.reports.flatMap(r=>r.items.map(i=>[i.project,i.title,i.state,i.target_date?new Date(i.target_date+'T00:00:00Z'):null,i.progress/100,person(r.user_id),i.result||'',i.service||'',i.id||''])).sort((a,b)=>a[0].localeCompare(b[0],'ko'))],
 issues:[['카테고리','이슈 및 지원 요청','담당자'],...groupedNotes(s.reports,'issues').flatMap(g=>g.entries.map(x=>[g.category,x.text,x.owners.map(person).join(', ')]))],
 plans:[['카테고리','다음 주 계획','담당자'],...groupedNotes(s.reports,'next_plan').flatMap(g=>g.entries.map(x=>[g.category,x.text,x.owners.map(person).join(', ')]))]
}}
let excelModule;
export async function weeklyExcelBlob(s){excelModule ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{excelModule=null;reject(Error('Excel 모듈을 불러오지 못했습니다. 네트워크를 확인해주세요.'))};document.head.append(script)});const ExcelJS=await excelModule,book=new ExcelJS.Workbook(),data=weeklyExcelRows(s);book.creator=s.author;book.created=new Date(s.created_at);

 const widths=[22,48,12,15,12,18,58,14,42];
 const sheet=book.addWorksheet('주간 통합보고',{views:[{state:'frozen',ySplit:4}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:4'}});
 sheet.columns=widths.map(width=>({width}));
 sheet.mergeCells('A1:I1');sheet.getCell('A1').value=s.week+' 주간 통합보고';sheet.getCell('A1').font={name:'맑은 고딕',size:16,bold:true,color:{argb:'FF17365D'}};sheet.getRow(1).height=30;
 sheet.mergeCells('A2:I2');sheet.getCell('A2').value='생성: '+new Date(s.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · 작성: '+s.author+' · 제출 '+s.reports.length+'건';sheet.getRow(2).height=24;
 const style=(row,header,index=0)=>row.eachCell({includeEmpty:true},cell=>{cell.font={name:'맑은 고딕',size:11,...(header?{bold:true,color:{argb:'FFFFFFFF'}}:{})};cell.alignment={vertical:'top',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:header?'FF17365D':index%2?'FFF0F5FC':'FFFFFFFF'}};cell.border={bottom:{style:'thin',color:{argb:'FFD9E2F0'}}}});
 data.tasks.forEach((values,n)=>{const row=sheet.getRow(n+4);row.values=values;row.height=n?Math.min(350,Math.max(38,...values.map((v,c)=>String(v??'').split('\n').reduce((a,line)=>a+Math.max(1,Math.ceil(line.length/(widths[c]*0.7))),0)*16))):28;style(row,!n,n);if(n){row.getCell(4).numFmt='yyyy-mm-dd';row.getCell(5).numFmt='0%'}});
 const taskEnd=data.tasks.length+3;sheet.autoFilter={from:{row:4,column:1},to:{row:taskEnd,column:9}};
 let cursor=taskEnd+3;
 for(const [key,title] of [['issues','이슈 및 지원 요청'],['plans','다음 주 계획']]){
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
