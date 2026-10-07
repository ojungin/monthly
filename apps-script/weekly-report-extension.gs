/**
 * 기존 회원 대시보드 Apps Script에 추가하는 읽기 전용 확장.
 * doPost의 checkPassword_ 인증 성공 이후 try 블록 맨 앞에 다음 한 줄 추가:
 * if (req.action === 'weeklyReport') return json_(weeklyReportMetrics_(String(req.weekStart || '')));
 * 저장 후 배포 > 배포 관리 > 기존 웹 앱 수정 > 새 버전으로 배포 (URL 유지).
 * 회원·활동성·세미나 원본을 수정하지 않으며 집계값만 반환합니다.
 */
function weeklyReportMetrics_(week) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw Error('보고 주간 형식 오류');
 var date=new Date(week+'T12:00:00Z');
 if(isNaN(date.getTime())||date.getUTCDay()!==1)throw Error('월요일을 선택해주세요');
 var shift=function(n){var d=new Date(date);d.setUTCDate(d.getUTCDate()+n);return Utilities.formatDate(d,'UTC','yyyy-MM-dd');};
 var finish=shift(6),prev=shift(-7),newWeek=0,newPrevWeek=0;
 var day=function(v){if(v instanceof Date)return Utilities.formatDate(v,'Asia/Seoul','yyyy-MM-dd');var m=String(v).match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);return m?m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2):'';};
 var num=function(v){if(v===null||v===undefined||String(v).trim()==='')return null;var n=Number(String(v).replace(/[,\s명점%]/g,''));return isFinite(n)?n:null;};
 var memberSheet=SpreadsheetApp.openById('18Oaw2ldpiZu_uvaNQG2YNkwou7WWpi6itI-Scjpn070').getSheetByName('시트1');
 if(!memberSheet)throw Error('회원분석 시트1이 없습니다');
 if(memberSheet.getLastRow()>1)memberSheet.getRange(2,18,memberSheet.getLastRow()-1,1).getValues().forEach(function(r){var d=day(r[0]);if(d>=week&&d<=finish)newWeek++;if(d>=prev&&d<week)newPrevWeek++;});
 var raw=SpreadsheetApp.openById('1UQqI5Yqjt7pSReSFb0IltpBInHijTFY8eHq0Df-B3Ow').getSheetByName('raw');
 if(!raw)throw Error('세미나 raw 시트가 없습니다');
 var rows=raw.getLastRow()>1?raw.getRange(2,4,raw.getLastRow()-1,12).getValues():[];
 var selected=rows.filter(function(r){var d=day(r[0]);return d>=week&&d<=finish;});
 var done=selected.filter(function(r){return r[7]===true||String(r[7]).toLowerCase()==='true';});
 var values=function(i){return done.map(function(r){return num(r[i]);}).filter(function(n){return n!==null;});};
 var sum=function(i){var ns=values(i);return ns.length?ns.reduce(function(a,b){return a+b;},0):null;};
 var avg=function(i){var ns=values(i);return ns.length?ns.reduce(function(a,b){return a+b;},0)/ns.length:null;};
 var metric=function(label,value,unit){return {label:label,value:value,unit:unit,previous:null};};
 return {ok:true,week:week,member:{newWeek:newWeek,newPrevWeek:newPrevWeek},activity:activityData_(false),
 seminar:{title:'2. 비학술 세미나 기획 및 운영 지표',period:week+' ~ '+finish,
 rows:[metric('편성 세미나',selected.length,'건'),metric('완료 세미나',done.length,'건'),metric('신청 건수',sum(8),'건'),metric('시청 건수',sum(9),'건'),metric('평균 만족도',avg(10),'점'),metric('평균 유용도',avg(11),'점')],
 note:'신청·시청은 완료 세미나별 참여 건수 합계이며 고유 회원 수가 아닙니다. 만족도·유용도는 입력된 값의 단순 평균입니다.'}};
}
