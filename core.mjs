export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function monday(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
export const monthReports=(reports,month)=>reports.filter(r=>r.status==='submitted'&&r.week_start.startsWith(month));
export const canEditReport=(member,report)=>member.id===report.user_id;
export function summarize(reports){return {reports:reports.length,people:new Set(reports.map(r=>r.user_id)).size,items:reports.flatMap(r=>r.items),done:reports.flatMap(r=>r.items).filter(i=>i.state==='완료').length}}
export function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
export function validateItems(items){if(!items.length)throw Error('업무를 한 개 이상 입력해주세요.');for(const i of items){if(!i.project.trim()||!i.title.trim())throw Error('프로젝트와 업무 내용을 입력해주세요.');if(i.progress<0||i.progress>100||!Number.isFinite(i.progress))throw Error('진행률은 0~100 사이여야 합니다.');if(!['완료','진행','보류'].includes(i.state))throw Error('업무 상태를 확인해주세요.')}}

// 기준 주간 이전의 제출본 중 팀원별 최신 보고 주간, 최신 수정본을 선택합니다.
export function latestTeamReports(reports,week){const latest=new Map();for(const r of reports.filter(r=>r.status==='submitted'&&r.week_start<=week).slice().sort((a,b)=>b.week_start.localeCompare(a.week_start)||String(b.updated_at||'').localeCompare(String(a.updated_at||''))||String(b.id||'').localeCompare(String(a.id||''))))if(!latest.has(r.user_id))latest.set(r.user_id,r);return [...latest.values()]}

export function filterTeamTasks(reports,filters={}){const byTask=new Map();for(const r of reports.filter(r=>r.status==='submitted'&&(!filters.month||r.week_start.startsWith(filters.month))&&(!filters.owner||r.user_id===filters.owner)).slice().sort((a,b)=>b.week_start.localeCompare(a.week_start)||String(b.updated_at||'').localeCompare(String(a.updated_at||''))))r.items.forEach((item,n)=>{const key=r.user_id+':'+(item.id||r.id+'-'+n);if(!byTask.has(key))byTask.set(key,{...item,owner:r.user_id,sourceWeek:r.week_start})});return [...byTask.values()].filter(i=>!filters.state||i.state===filters.state)}
// 메일 인증코드 로그인 오류를 팀원이 이해할 수 있는 문장으로 바꿉니다.
export function otpErrorMessage(error){const code=String(error?.code||''),message=String(error?.message||error||''),text=code+' '+message;
 if(/otp_disabled|signup|not allowed|user_not_found|user not found/i.test(text))return '등록된 팀원 이메일이 아닙니다. 관리자에게 계정 등록을 요청해주세요.';
 if(error?.status===429||/rate.?limit|security purposes|after \d+ seconds/i.test(text))return '인증코드 요청이 많아 잠시 제한되었습니다. 1분 후 다시 시도해주세요.';
 if(/otp_expired|expired|invalid|token/i.test(text))return '인증코드가 맞지 않거나 만료되었습니다. 코드를 다시 받아주세요.';
 return '인증 처리 중 문제가 발생했습니다: '+message;}
