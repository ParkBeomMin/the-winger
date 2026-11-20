// 더 윙어 2 서비스워커: 한 번 받은 그림은 저장해두고 바로 띄워요 (오프라인에서도 이어하기)
// - 페이지(HTML)·매니페스트는 네트워크 먼저(업데이트가 바로 보이게), 안 되면 저장본
// - 스크립트는 주소에 ?v=버전이 붙어 있어서, 저장본 먼저 + 뒤에서 새로 받아 갱신
// - 다른 사이트(광고·Firebase·폰트)는 건드리지 않아요
const CACHE = "w2-v1";
const CORE = ["./", "./index.html", "./assets/title.webp", "./assets/stadium.webp", "./assets/icon-192.png"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (/admin\.(html|js)$/.test(url.pathname)) return;
  const fresh = req.mode === "navigate" || /\.html$|\.webmanifest$|\/$/.test(url.pathname);
  if (fresh) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
