import http from 'node:http';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
import {serveWorkspace,workspaceInjection} from './workspace/server.mjs';

// Transport only: authentication, agents, API writes and subscriptions remain HAPI's.
export function createProxy({upstream='http://127.0.0.1:3006'}={}){
 const target=new URL(upstream);
 if(target.protocol!=='http:'||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw new Error('Upstream must be an HTTP origin without credentials or a path. Use HTTPS at your public reverse proxy.');
 const options=req=>({hostname:target.hostname,port:target.port||80,method:req.method,path:req.url,headers:{...req.headers,host:target.host,'accept-encoding':'identity'}});
 const server=http.createServer(async(req,res)=>{
  try{if(await serveWorkspace(req,res))return;}catch{res.writeHead(503);res.end('Workspace unavailable.');return;}
  const forward=http.request(options(req),response=>{
   if(!(response.headers['content-type']??'').includes('text/html')){res.writeHead(response.statusCode,response.headers);response.pipe(res);return;}
   const chunks=[];let size=0;
   response.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){response.destroy(new Error('HTML too large'));return;}chunks.push(chunk);});
   response.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Upstream page unavailable.');});
   response.on('end',()=>{
    try{
     let body=Buffer.concat(chunks);const encoding=response.headers['content-encoding'];const limit={maxOutputLength:8*1024*1024};
     if(encoding==='gzip')body=gunzipSync(body,limit);else if(encoding==='deflate')body=inflateSync(body,limit);else if(encoding==='br')body=brotliDecompressSync(body,limit);else if(encoding&&encoding!=='identity')throw new Error('Unsupported HTML encoding');
     const html=body.toString('utf8');body=Buffer.from(html.includes('</head>')?html.replace('</head>',workspaceInjection+'</head>'):html);
     const headers={...response.headers,'content-length':body.length,'cache-control':'no-store'};
     for(const key of ['content-encoding','transfer-encoding','etag','last-modified'])delete headers[key];
     res.writeHead(response.statusCode,headers);res.end(body);
    }catch{if(!res.headersSent)res.writeHead(502);res.end('Upstream page unavailable.');}
   });
  });
  forward.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('HAPI upstream unavailable.');});
  req.on('aborted',()=>forward.destroy());res.on('close',()=>{if(!res.writableFinished)forward.destroy();});req.pipe(forward);
 });
 server.on('upgrade',(req,socket,head)=>{
  const forward=http.request(options(req));let remote;
  const fail=()=>{socket.destroy();remote?.destroy();forward.destroy();};socket.on('error',fail);
  forward.on('upgrade',(response,peer,peerHead)=>{
   remote=peer;peer.on('error',fail);socket.on('end',()=>peer.end());peer.on('end',()=>socket.end());socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());
   let headers='HTTP/1.1 '+response.statusCode+' '+response.statusMessage+'\r\n';
   for(let i=0;i<response.rawHeaders.length;i+=2)headers+=response.rawHeaders[i]+': '+response.rawHeaders[i+1]+'\r\n';
   socket.write(headers+'\r\n');if(peerHead.length)socket.write(peerHead);if(head.length)peer.write(head);peer.pipe(socket);socket.pipe(peer);
  });
  forward.on('response',response=>{response.resume();socket.end('HTTP/1.1 '+response.statusCode+' '+response.statusMessage+'\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');});
  forward.on('error',fail);forward.end();
 });
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {values}=parseArgs({options:{upstream:{type:'string',default:'http://127.0.0.1:3006'},port:{type:'string',default:'3096'},host:{type:'string',default:'127.0.0.1'}}});
 const port=Number(values.port);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
 const server=createProxy({upstream:values.upstream});server.listen(port,values.host,()=>console.log('Workspace: http://'+values.host+':'+port+'/workspace'));
 const stop=()=>{server.close();setTimeout(()=>process.exit(0),2000).unref();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
