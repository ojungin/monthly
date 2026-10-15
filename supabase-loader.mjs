// Official npm @supabase/supabase-js 2.118.0 browser bundle, served by this site.
let pending;
export function loadSupabase(){
 if(globalThis.supabase?.createClient)return Promise.resolve(globalThis.supabase);
 if(!pending){
  const attempt=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=new URL('./supabase-2.118.0.js',import.meta.url).href;
   script.async=true;
   const timer=setTimeout(()=>fail(),20000);
   function fail(){clearTimeout(timer);script.remove();reject(Error('로그인 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.'));}
   script.onload=()=>{clearTimeout(timer);if(!globalThis.supabase?.createClient){fail();return;}resolve(globalThis.supabase);};
   script.onerror=fail;
   document.head.append(script);
  });
  pending=attempt.catch(error=>{pending=undefined;throw error;});
 }
 return pending;
}
