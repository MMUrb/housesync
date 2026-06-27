/* HouseSync service worker.
   1. Caches the static app shell so launches and navigations are fast.
   2. Shows incoming web-push notifications and focuses the app when tapped.

   Caching is deliberately conservative: we only ever serve cache-first for
   same-origin, immutable static assets (Next's content-hashed /_next/static
   files, fonts, icons, images). HTML documents, RSC payloads, API routes and
   anything cross-origin (Supabase) always go to the network, so authenticated
   and per-user data is never served stale or to the wrong account. */

const CACHE = "hs-static-v1";

function isCacheableStatic(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)$/.test(url.pathname);
}

self.addEventListener("install", () => {
  // Activate the new SW immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (!isCacheableStatic(url)) return; // network as usual for everything else

  // Stale-while-revalidate: serve the cached copy instantly, then refresh it in
  // the background so a new deploy is picked up by the next launch.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "HouseSync", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "HouseSync";
  const options = {
    body: data.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
