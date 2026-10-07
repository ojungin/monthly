import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','style.css','app.js','core.mjs','weekly.mjs','portal.mjs','config.js'])await copyFile(file,'dist/'+file);
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!!url!==!!key)throw Error('SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 모두 설정하세요.');
if(url&&key){if(!/^https:\/\//.test(url))throw Error('Supabase URL은 HTTPS여야 합니다.');if(key.startsWith('sb_secret_'))throw Error('비밀 키는 브라우저에서 사용할 수 없습니다.');if(key.split('.').length===3){try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));if(payload.role!=='anon')throw Error('anon 키 또는 publishable 키만 사용하세요.')}catch(err){throw Error('유효한 공개 키가 아닙니다: '+err.message)}}await writeFile('dist/config.js','window.REPORT_CONFIG = '+JSON.stringify({supabaseUrl:url,publishableKey:key})+';\n');}
console.log('빌드 완료: dist/ (config.js 포함)');
