// Closes the emoji picker, taps the "dd" message, and checks its time reveals.
const targets = await fetch("http://localhost:9222/json").then((r) => r.json());
const page = targets.find((t) => t.type === "page") || targets[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const myId = ++id; pending.set(myId, res); ws.send(JSON.stringify({ id: myId, method, params })); });
const evalv = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
await send("Runtime.enable");

// Close the emoji picker if it's open
await evalv('document.querySelector(".grid-cols-8") ? document.querySelector(\'button[aria-label="Add emoji"]\').click() : null');
await sleep(500);

const before = await evalv('(document.body.innerText.match(/09:57/g)||[]).length');
const tapped = await evalv('(() => { const b=[...document.querySelectorAll(".overflow-y-auto button")].find(x=>x.textContent.trim()==="dd"); if(b){b.click(); return "tapped dd"; } return "not found"; })()');
await sleep(700);
const after = await evalv('(document.body.innerText.match(/09:57/g)||[]).length');
console.log("tap:", tapped, "| '09:57' occurrences before:", before, "after:", after, "=> reveal works:", after > before);
ws.close();
