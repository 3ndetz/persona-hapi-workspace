import {readFile} from 'node:fs/promises';
const files=new Map([['/workspace',['index.html','text/html']],['/workspace/',['index.html','text/html']],['/persona-workspace/app.mjs',['app.mjs','text/javascript']],['/persona-workspace/state.mjs',['state.mjs','text/javascript']],['/persona-workspace/style.css',['style.css','text/css']],['/persona-workspace/embed.js',['embed.js','text/javascript']]]);
export const workspaceInjection='<script defer src="/persona-workspace/embed.js"></script>';
export async function serveWorkspace(req,res){
 const path=new URL(req.url,'http://localhost').pathname;
 const file=path==='/persona-workspace/icon.svg'?['icon.svg','image/svg+xml']:files.get(path);
 if(!file||!['GET','HEAD'].includes(req.method))return false;
 try{const bytes=await readFile(new URL('./'+file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);}
 catch{res.writeHead(503);res.end('Workspace module unavailable. Open /sessions for the stock UI.');}
 return true;
}
