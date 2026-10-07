import {seminarSourceURL,parseGVizResponse,seminarRowsFromTable} from '../metrics.mjs';
// 원본 데이터·개인정보를 로그나 빌드 산출물에 저장하지 않습니다.
const url=seminarSourceURL.replace('D1%3AO1000','D1%3AO5')+'&tqx=out%3Ajson';
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('세미나 원본 직접 조회 HTTP '+response.status);
const rows=seminarRowsFromTable(parseGVizResponse(await response.text()));
console.log('세미나 공개 원본 접근 및 raw 열 구성 확인 완료 (표본 '+rows.length+'행).');
