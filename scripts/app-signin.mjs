// Drives the app's WebView via Chrome DevTools Protocol to sign in and open /chat.
// Requires: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
const targets = await fetch("http://localhost:9222/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page") || targets[0];
console.log("target:", page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const myId = ++id;
    pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", rej);
});
await send("Runtime.enable");

console.log("==> navigating to /login");
await evaluate("window.location.href='/login'");
await sleep(6000);

console.log("==> filling + submitting sign-in");
const fill = `(() => {
  function setVal(sel,val){
    const el=document.querySelector(sel);
    if(!el) return 'missing '+sel;
    const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  }
  const a=setVal('#email','alex.chattest@example.com');
  const b=setVal('#password','ChatTest123!');
  const btn=document.querySelector('button[type=submit]');
  if(btn) btn.click();
  return JSON.stringify({email:a,password:b,clicked:!!btn});
})()`;
const r = await evaluate(fill);
console.log("   ", r.result?.result?.value ?? JSON.stringify(r.result ?? r));
await sleep(6500);

console.log("==> navigating to /chat");
await evaluate("window.location.href='/chat'");
await sleep(7000);

const loc = await evaluate("location.pathname + ' | ' + document.title");
console.log("final:", loc.result?.result?.value ?? JSON.stringify(loc.result ?? r));
ws.close();
console.log("==> DONE");
