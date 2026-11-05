import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {otpErrorMessage} from '../core.mjs';
test('login uses an emailed one-time code for registered members only, with no password flow left',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/signInWithOtp\(\{email,options:\{shouldCreateUser:false\}\}\)/);
 assert.match(app,/verifyOtp\(\{email:otpEmail,token,type:'email'\}\)/);
 assert.match(app,/autocomplete="one-time-code"/);
 for(const gone of ['signInWithPassword','resetPasswordForEmail','passwordScreen','PASSWORD_RECOVERY','id="password"'])assert(!app.includes(gone),gone);
});
test('OTP errors are shown in plain Korean',()=>{
 assert.match(otpErrorMessage({code:'otp_disabled',message:'Signups not allowed for otp'}),/등록된 팀원 이메일이 아닙니다/);
 assert.match(otpErrorMessage({status:429,message:'For security purposes, you can only request this after 42 seconds.'}),/1분 후/);
 assert.match(otpErrorMessage({code:'otp_expired',message:'Token has expired or is invalid'}),/만료/);
 assert.match(otpErrorMessage({message:'boom'}),/boom/);
});
