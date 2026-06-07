// Opens the emoji picker in the app's chat and reports its state.
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
await evalv('document.querySelector(\'button[aria-label="Add emoji"]\')?.click()');
await sleep(900);
const open = await evalv("!!document.querySelector('.grid-cols-8')");
const emojiCount = await evalv("document.querySelectorAll('.grid-cols-8 button').length");
console.log("emoji picker open:", open, "| emojis in view:", emojiCount);
ws.close();
