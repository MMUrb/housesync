// Reloads /chat in the app's WebView (fetching the latest deploy) and checks
// for the new emoji button.
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
const evalv = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, t = 30000, every = 800) {
  const t0 = Date.now();
  while (Date.now() - t0 < t) { try { const v = await evalv(expr); if (v) return v; } catch {} await sleep(every); }
  return null;
}
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
await send("Runtime.enable");
console.log("at:", await evalv("location.pathname"));
// Force a fresh load of the deployed /chat
await evalv("location.href='/about:blank'.slice(0,0) || (window.location.href='/chat')");
await sleep(1500);
await evalv("window.location.reload(true)");
const ready = await waitFor("location.pathname==='/chat' && document.querySelector('textarea') ? 'ready':''");
const hasEmoji = await evalv("!!document.querySelector('button[aria-label=\"Add emoji\"]')");
const msgCount = await evalv("document.querySelectorAll('button[aria-label]').length");
console.log("chat ready:", ready, "| emoji button present:", hasEmoji, "| aria buttons:", msgCount);
ws.close();
