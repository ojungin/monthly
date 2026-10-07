import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const base=resolve(process.cwd());
const allowed=new Set(['index.html','style.css','app.js','core.mjs','weekly.mjs','portal.mjs','excel.mjs','metrics.mjs','config.js']);
http.createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path==='/'?'index.html':path.slice(1);if(!allowed.has(file))throw Error();const full=resolve(base,file);if(!full.startsWith(base+sep))throw Error();const data=await readFile(full);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript'}[extname(file)]||'text/plain')+'; charset=utf-8'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
