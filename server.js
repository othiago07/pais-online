// Servidor do País Você é Presidente: entrega o site e mantém os jogadores online (WebSocket).
// Sem dependências: só Node 18+.  Rodar:  node server.js   (porta = PORT ou 8080)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'site');const PORT=process.env.PORT||8080;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.ico':'image/x-icon'};
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';
  const f=path.normalize(path.join(ROOT,p));if(!f.startsWith(ROOT)){res.writeHead(403);return res.end()}
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Servidor online do País Você é Presidente: OK ('+players.size+' jogando)')}
    const ext=path.extname(f);res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':ext==='.json'?'no-cache':'public, max-age=300'});res.end(d)})});
// ---------- WebSocket mínimo ----------
const players=new Map();let nextId=1;
function send(sock,str){const b=Buffer.from(str);let h;
  if(b.length<126)h=Buffer.from([0x81,b.length]);else if(b.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(b.length,2)}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(b.length),2)}
  try{sock.write(Buffer.concat([h,b]))}catch(e){}}
const clean=s=>String(s||'').replace(/[^\w.À-ÿ ]/g,'').slice(0,40);
srv.on('upgrade',(req,sock)=>{
  if(!req.url.startsWith('/ws')||players.size>=500){sock.destroy();return}
  const k=req.headers['sec-websocket-key'];if(!k){sock.destroy();return}
  const acc=crypto.createHash('sha1').update(k+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  const id=nextId++;const pl={id,sock,uf:'',u:'',x:0,z:8,a:0,w:0,last:Date.now()};players.set(id,pl);let buf=Buffer.alloc(0);
  sock.on('data',d=>{buf=Buffer.concat([buf,d]);
    while(buf.length>=2){const op=buf[0]&15,masked=buf[1]&128;let len=buf[1]&127,off=2;
      if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4}else if(len===127){sock.destroy();return}
      if(len>4096){sock.destroy();return}
      const need=off+(masked?4:0)+len;if(buf.length<need)return;
      let data=buf.subarray(off+(masked?4:0),need);if(masked){const m=buf.subarray(off,off+4);data=Buffer.from(data.map((b,i)=>b^m[i&3]))}
      buf=buf.subarray(need);
      if(op===8){sock.end();return}if(op===9){sock.write(Buffer.from([0x8A,0]));continue}if(op!==1)continue;
      try{const m=JSON.parse(data.toString());pl.last=Date.now();
        if(m.t==='hi')pl.u=clean(m.u).toLowerCase();
        else if(m.t==='c'&&Number.isInteger(m.k)&&m.k>=0&&m.k<12&&Date.now()-(pl.lastC||0)>1500){pl.lastC=Date.now();const msg=JSON.stringify({t:'c',id,k:m.k});for(const o of players.values())if(o!==pl&&Math.abs(o.x-pl.x)<60&&Math.abs(o.z-pl.z)<60)send(o.sock,msg)}
        else if(m.t==='p'&&isFinite(m.x)&&isFinite(m.z)){pl.x=+m.x;pl.z=+m.z;pl.a=+m.a||0;pl.w=m.w?1:0;pl.uf=/^[A-Z]{2}$/.test(m.uf||'')?m.uf:''}}catch(e){}}});
  const bye=()=>players.delete(id);sock.on('close',bye);sock.on('error',bye);
  pl.you=id;});
// envia o estado de todos 5x por segundo (só quem está perto de cada um)
let tick=0;
setInterval(()=>{const now=Date.now();const all=[...players.values()];tick++;
  if(tick%10===0){const lista=JSON.stringify({t:'lista',l:all.filter(o=>o.u).slice(0,150).map(o=>[o.id,o.u,o.uf,+o.x.toFixed(1),+o.z.toFixed(1)])});for(const p of all)send(p.sock,lista)}
  for(const p of all)if(now-p.last>60000){p.sock.destroy();players.delete(p.id)}
  const ufs={};for(const p of players.values())if(p.uf)ufs[p.uf]=(ufs[p.uf]||0)+1;
  for(const p of players.values()){const near=all.filter(o=>Math.abs(o.x-p.x)<90&&Math.abs(o.z-p.z)<120).slice(0,60);
    send(p.sock,JSON.stringify({t:'all',you:p.id,n:players.size,ufs,list:near.map(o=>[o.id,o.u,+o.x.toFixed(2),+o.z.toFixed(2),+o.a.toFixed(2),o.w])}))}},200);
srv.listen(PORT,()=>console.log('País Você é Presidente no ar: http://localhost:'+PORT));
