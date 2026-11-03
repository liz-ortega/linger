/* Offline shell for the Linger app: network first, cached copy when offline. */
var CACHE = "linger-app-v3";
var SHELL = ["/app", "/app/app.css", "/app/app.js", "/app/config.js", "/favicon.svg",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var ours = url.origin === location.origin && (url.pathname === "/app" || url.pathname.indexOf("/app/") === 0 || url.pathname === "/favicon.svg");
  var cdn = url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!ours && !cdn) return; // never touch database calls
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req.mode === "navigate" ? "/app" : req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req.mode === "navigate" ? "/app" : req).then(function (m) { return m || caches.match("/app"); });
  }));
});
