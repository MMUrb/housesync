// Robust WebView sign-in via CDP: polls for elements (slow emulator network).
const targets = await fetch("http://localhost:9222/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page") || targets[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) =>
  new Promise((res) => { const myId = ++id; pending.set(myId, res); ws.send(JSON.stringify({ id: myId, method, params })); });
const evalv = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 30000, every = 800) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await evalv(expr); if (v) return v; } catch {}
    await sleep(every);
  }
  return null;
}

await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
await send("Runtime.enable");
console.log("target:", page.url);

let path = await evalv("location.pathname");
if (path !== "/login") { await evalv("window.location.href='/login'"); }

const hasEmail = await waitFor("!!document.querySelector('#email') && !!document.querySelector('#password')");
console.log("login form ready:", hasEmail);

const fill = `(() => {
  function setVal(sel,val){
    const el=document.querySelector(sel); if(!el) return 'missing '+sel;
    const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val);
    el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
  }
  const a=setVal('#email','alex.chattest@example.com');
  const b=setVal('#password','ChatTest123!');
  const btn=document.querySelector('button[type=submit]'); if(btn) btn.click();
  return JSON.stringify({email:a,password:b,clicked:!!btn});
})()`;
console.log("fill:", await evalv(fill));

const left = await waitFor("location.pathname !== '/login' ? location.pathname : ''", 30000);
console.log("after sign-in, path:", left);

await evalv("window.location.href='/chat'");
const chatReady = await waitFor("location.pathname==='/chat' && document.querySelector('textarea') ? 'ready' : ''", 30000);
console.log("chat ready:", chatReady, "| path:", await evalv("location.pathname"));
ws.close();
console.log("DONE");
