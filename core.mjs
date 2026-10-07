export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function monday(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
export const monthReports=(reports,month)=>reports.filter(r=>r.status==='submitted'&&r.week_start.startsWith(month));
export function summarize(reports){return {reports:reports.length,people:new Set(reports.map(r=>r.user_id)).size,items:reports.flatMap(r=>r.items),done:reports.flatMap(r=>r.items).filter(i=>i.state==='완료').length}}
export function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
export function validateItems(items){if(!items.length)throw Error('업무를 한 개 이상 입력해주세요.');for(const i of items){if(!i.project.trim()||!i.title.trim())throw Error('프로젝트와 업무 내용을 입력해주세요.');if(i.progress<0||i.progress>100||!Number.isFinite(i.progress))throw Error('진행률은 0~100 사이여야 합니다.');if(!['완료','진행','보류'].includes(i.state))throw Error('업무 상태를 확인해주세요.')}}
