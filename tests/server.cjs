// Local-only server for tests. /__test_app removes external camera/Excel dependencies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__test_app') {res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]*src="https:[^"]*"[^>]*><\/script>/g,''));}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/plain');res.end(data);});
}).listen(8769,'127.0.0.1',()=>console.log('Test server http://127.0.0.1:8769/tests/trocas-browser.html'));
