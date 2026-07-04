const CACHE_NAME = "radiology-inventory-v1.2.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./css/mobile.css",
  "./js/app.js",
  "./js/ui.js",
  "./js/sheet.js",
  "./js/inventory.js",
  "./js/setting.js",
  "./js/timeline.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin.includes("script.google.com")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ rows: [] }), {
      headers: { "Content-Type": "application/json" }
    })));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cached = await caches.match(request);
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return cached || caches.match("./index.html");
  }
}
