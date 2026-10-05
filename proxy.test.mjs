import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createProxy} from './proxy.mjs';
test('standalone proxy: assets, native HTML, auth, API writes, SSE and upgrade',{timeout:20000},async()=>{
 const hub=http.createServer((req,res)=>{
  if(req.url==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: first\n\n');setTimeout(()=>res.end('data: last\n\n'),15);return;}
  if(req.url==='/api/sessions'){if(req.headers.authorization!=='Bearer fixture'){res.writeHead(401);res.end('Unauthorized');return;}const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({method:req.method,body:Buffer.concat(chunks).toString()}));});return;}
  res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");res.end('<html><head><title>Native HAPI</title></head><body>native controls</body></html>');
 });const sockets=new Set();hub.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});hub.on('upgrade',(req,socket)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: fixture\r\n\r\n');socket.on('data',bytes=>socket.write(bytes));socket.on('end',()=>socket.end());});
 await new Promise(r=>hub.listen(0,'127.0.0.1',r));const proxy=createProxy({upstream:'http://127.0.0.1:'+hub.address().port});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+proxy.address().port;
 try{
  assert.equal((await fetch(base+'/workspace')).status,200);assert.match(await(await fetch(base+'/persona-workspace/app.mjs')).text(),/function render/);
  const native=await fetch(base+'/sessions');assert.equal(native.headers.get('content-security-policy'),"frame-ancestors 'self'");assert.match(await native.text(),/embed\.js.*<\/head>/);
  assert.equal((await fetch(base+'/api/sessions')).status,401);
  const api=await fetch(base+'/api/sessions',{method:'POST',headers:{authorization:'Bearer fixture'},body:'once'});assert.deepEqual(await api.json(),{method:'POST',body:'once'});
  assert.equal(await(await fetch(base+'/events')).text(),'data: first\n\ndata: last\n\n');
  await new Promise((resolve,reject)=>{const req=http.request(base+'/socket',{headers:{Connection:'Upgrade',Upgrade:'fixture'}});req.on('error',reject);req.on('upgrade',(res,socket)=>{assert.equal(res.statusCode,101);socket.on('error',reject);socket.once('data',data=>{try{assert.equal(data.toString(),'echo');socket.destroy();resolve();}catch(error){socket.destroy();reject(error);}});socket.write('echo');});req.end();});
 }finally{for(const socket of sockets)socket.destroy();proxy.closeAllConnections();hub.closeAllConnections();await Promise.all([new Promise(r=>proxy.close(r)),new Promise(r=>hub.close(r))]);}
});
test('upstream cannot carry embedded credentials or a redirecting path',()=>{assert.throws(()=>createProxy({upstream:'https://example.com'}));assert.throws(()=>createProxy({upstream:'http://user:password@localhost:3006'}));assert.throws(()=>createProxy({upstream:'http://localhost:3006/elsewhere'}));});
