// Start tests/server.cjs first. Runs against an isolated Chrome profile and port.
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'patrimonio-cpu-test-'));
const binary=process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--in-process-gpu','--no-first-run','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket,sequence=0;const pending=new Map();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const endpoint=new Promise((resolve,reject)=>{let output='';chrome.on('error',reject);chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/\S+)/);if(match)resolve(match[1]);});setTimeout(()=>reject(Error('Chrome debug endpoint timed out')),10000).unref();});
function send(method,params={},sessionId){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
(async()=>{
  socket=new WebSocket(await endpoint);
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  socket.addEventListener('message',e=>{const data=JSON.parse(e.data),p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}});
  const {targetId}=await send('Target.createTarget',{url:'http://127.0.0.1:8769/tests/trocas-browser.html'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  for(let i=0;i<200;i++){
    const result=await send('Runtime.evaluate',{expression:"JSON.stringify({state:document.body?.dataset.result,text:document.getElementById('result')?.textContent})",returnByValue:true},sessionId);
    const state=JSON.parse(result.result.value || '{}');
    if(state.state==='PASS'){console.log(state.text);return;}
    if(state.state==='FAIL')throw Error(state.text);
    await pause(200);
  }
  throw Error('Browser tests timed out');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(socket?.readyState===1){try{await send('Browser.close');}catch{}socket.close();}chrome.kill();});
