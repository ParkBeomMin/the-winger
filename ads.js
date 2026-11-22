/* 더 윙어 2 - 📊 GA4 · 💰 애드센스 하단 배너
 * 실서비스 주소(parkbeommin.github.io)에서만 켜요. ?noga=1 / ?noads=1 로 끌 수 있어요.
 * 배너는 경기 화면(scr-match)과 선수 만들기 화면에서는 숨겨요(조작 영역과 떨어뜨리기). */
"use strict";
const ADS = {
  client: "ca-pub-7426857657290789",
  slot: "4368581183",                 // 광고 단위 the-winger-bottom (320x50 고정)
  prod: location.hostname === "parkbeommin.github.io",
  preview: /[?&]adpreview=1/.test(location.search),
  filled: false,
};
ADS.on = (ADS.prod || ADS.preview) && !/[?&](noads|rec|portal)=1/.test(location.search);
const GA = { id: "G-BN3LZG4ZSS", on: ADS.prod && !/[?&](noga|rec)=1/.test(location.search) };
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
if (GA.on) {
  const s = document.createElement("script"); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA.id}`; document.head.appendChild(s);
  gtag("js", new Date()); gtag("config", GA.id, { allow_google_signals: false, allow_ad_personalization_signals: false });
}
function track(name, params = {}) { if (GA.on) try { gtag("event", name, params); } catch {} }
window.adsbygoogle = window.adsbygoogle || [];
function adBreak(o) { window.adsbygoogle.push(o); }
function adConfig(o) { window.adsbygoogle.push(o); }
if (ADS.on && ADS.prod) {
  const s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.client}`;
  s.setAttribute("data-ad-client", ADS.client);
  if (/[?&]adtest=1/.test(location.search)) s.setAttribute("data-adbreak-test", "on");
  s.setAttribute("data-ad-frequency-hint", "120s");   // 전면 광고는 최소 2분 간격
  document.head.appendChild(s);
  adConfig({ preloadAdBreaks: "on", sound: "on" });
}
/* 📺 전면 광고 (H5 Games Ads) — 시즌 결산, 유스 대회 끝, 은퇴식처럼 쉬어 가는 지점에서만.
 * 애드센스 H5 게임 광고 승인 전에는 아무것도 안 뜨고 바로 넘어가요(adBreakDone이 곧장 불려요). 5초 안에 응답이 없어도 넘어가요. */
function adNext(name) {
  if (!ADS.on || !ADS.prod) return Promise.resolve();
  return new Promise((res) => {
    let done = false, shown = false; const fin = (info) => { if (done) return; done = true; if (typeof Bgm !== "undefined" && ADS.prevBgm !== undefined) { Bgm.set(ADS.prevBgm); ADS.prevBgm = undefined; } if (info && info.breakStatus === "viewed") track("ad_break", { name }); res(); };
    try {
      adBreak({ type: "next", name,
        beforeAd: () => { shown = true; if (typeof Bgm !== "undefined") { ADS.prevBgm = Bgm.mode; Bgm.set(null); } },
        afterAd: () => {},
        adBreakDone: fin });
    } catch { fin(); }
    // 광고가 2초 안에 안 뜨면 기다리지 않고 넘어가요 (뜬 광고는 끝날 때까지, 최대 60초)
    setTimeout(() => { if (!shown) fin(); }, 2000);
    setTimeout(() => fin(), 60000);
  });
}
const HIDE_AD_ON = [];   // 모든 화면에 하단 배너 (미니게임 창이 뜨면 그 위를 덮어요)
function adBanner(screenId) {
  if (!ADS.on) return;
  let bar = document.getElementById("adbar");
  // 하단 띠는 화면에 고정하지 않고 콘텐츠 맨 아래에 붙여요 (모바일 고정 광고는 애드센스 정책 위반이라 구글이 스크롤 때 접어 버려요. 시즌1과 같은 방식)
  const host = document.getElementById("app") || document.body;
  if (!bar) { bar = ADS.bar || document.createElement("div"); bar.id = "adbar"; host.appendChild(bar); }
  ADS.bar = bar;
  const show = !HIDE_AD_ON.includes(screenId);
  bar.style.display = show ? "flex" : "none";
  document.body.classList.toggle("ad-on", show);
  if (show && !ADS.filled) {
    ADS.filled = true;
    if (ADS.prod) {
      const ins = document.createElement("ins"); ins.className = "adsbygoogle";
      ins.style.cssText = "display:inline-block;width:320px;height:50px";
      ins.setAttribute("data-ad-client", ADS.client); ins.setAttribute("data-ad-slot", ADS.slot);
      bar.appendChild(ins); try { window.adsbygoogle.push({}); } catch {}
      houseAdWatch(bar, ins);
    } else { bar.innerHTML = `<div class="ad-ph">하단 배너 광고 자리 (320x50)</div>`; if (/[?&]house=1/.test(location.search)) { bar.innerHTML = ""; houseAd(bar); } }
  }
}

/* 📮 광고가 비면(애드센스 응답 "unfilled" 또는 8초 동안 응답 없음) 그 자리에 '광고 문의' 배너를 띄워요.
 * 애드센스가 대신 채워 주는 관련 검색어(unfill-optimized)는 구글 콘텐츠라 그대로 둬요. */
const adT = (ko, en) => (window.W2_LANG === "en" ? en : ko);
function houseAd(bar, ins) {
  if (bar.querySelector(".house-ad")) return;
  if (ins) ins.style.display = "none";
  const b = document.createElement("button"); b.className = "house-ad"; b.type = "button";
  b.innerHTML = `<b>${adT("📢 이 자리에 광고하세요", "📢 Advertise here")}</b><small>${adT("더 윙어 2 광고 문의 ›", "The Winger 2 ad inquiry ›")}</small>`;
  b.onclick = () => { track("ad_inquiry_open"); if (typeof openAdInquiry === "function") openAdInquiry(); };
  bar.appendChild(b);
}
/* 애드센스가 광고 대신 넣는 검색 칩(unfill-optimized)은 스크롤하면 스스로 숨어서 띠가 비어 보일 때가 있어요.
 * 그 순간에만 뒤쪽에 광고 문의 배너를 보여 줘요 (칩이 다시 나오면 숨겨요. 진짜 광고·칩은 절대 가리지 않아요) */
function houseLayerWatch(bar, ins) {
  if (bar.__layer) return;
  const L = document.createElement("button"); L.type = "button"; L.className = "house-ad house-layer";
  L.innerHTML = `<b>${adT("📢 이 자리에 광고하세요", "📢 Advertise here")}</b><small>${adT("더 윙어 2 광고 문의 ›", "The Winger 2 ad inquiry ›")}</small>`;
  L.onclick = () => { track("ad_inquiry_open"); if (typeof openAdInquiry === "function") openAdInquiry(); };
  bar.appendChild(L); bar.__layer = L;
  setInterval(() => {
    if (ins.getAttribute("data-ad-status") !== "unfill-optimized" || getComputedStyle(bar).display === "none") { L.classList.remove("on"); return; }
    L.classList.toggle("on", !adChipsSeen(bar, ins, L));
  }, 700);
}
/* 칩 글자가 실제로 띠 안에 보이는지: 숨김·투명·잘림·밀려남·다른 것에 가려짐을 모두 걸러요 */
function adChipsSeen(bar, ins, L) {
  const r = bar.getBoundingClientRect();
  if (!r.height) return false;
  if (r.top >= innerHeight || r.bottom <= 0) return true;   // 화면 밖이면 판단 보류(문의 배너 안 띄움)
  const op = (el) => { let o = 1; for (let x = el; x && x !== bar; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity; } return o; };
  const pe = L ? L.style.pointerEvents : ""; if (L) L.style.pointerEvents = "none";
  let seen = false;
  for (const el of ins.querySelectorAll("span,a,div,button")) {
    if (el.children.length || !(el.innerText || "").trim()) continue;
    const q = el.getBoundingClientRect();
    if (q.width < 3 || q.height < 3 || q.bottom < r.top + 4 || q.top > r.bottom - 4 || q.right < r.left || q.left > r.right || op(el) < .15) continue;
    let vt = q.top, vb = q.bottom;   // 부모가 잘라내면(overflow) 보이는 높이만 남겨요
    for (let p = el.parentElement; p && p !== bar; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflow !== "visible" || cs.overflowY !== "visible") { const pr = p.getBoundingClientRect(); vt = Math.max(vt, pr.top); vb = Math.min(vb, pr.bottom); } }
    if (vb - vt < 3) continue;
    const cx = Math.min(Math.max(q.left + q.width / 2, r.left + 1), r.right - 1), cy = Math.min(Math.max(q.top + q.height / 2, r.top + 1), r.bottom - 1);
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit !== ins && ins.contains(hit) && (hit === el || el.contains(hit) || hit.contains(el))) { seen = true; break; }
  }
  if (L) L.style.pointerEvents = pe;
  return seen;
}
function houseAdWatch(bar, ins) {
  const check = () => { const st = ins.getAttribute("data-ad-status"); if (st === "unfilled") houseAd(bar, ins); if (st === "unfill-optimized") houseLayerWatch(bar, ins); return !!st; };
  new MutationObserver(check).observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
  setTimeout(() => { if (!check() && !ins.querySelector("iframe")) houseAd(bar, ins); }, 8000);
}

/* 자동 광고(앵커)와 우리 하단 배너가 겹치지 않게:
 *  · 앵커가 아래에 뜨면 우리 배너를 잠시 숨기고(앵커가 그 자리를 대신), 앵커를 닫으면 다시 보여요
 *  · 앵커가 위에 뜨면 화면 위쪽을 그만큼 비워서 HUD가 가려지지 않게 해요 */
function adAnchorWatch() {
  if (!ADS.on || !ADS.prod) return;
  setInterval(() => {
    const a = [...document.querySelectorAll("ins.adsbygoogle[data-anchor-status]")].find((x) => x.getAttribute("data-anchor-status") === "displayed" && x.offsetHeight > 20);
    const bar = document.getElementById("adbar");
    let top = 0, bottom = false;
    // 아래쪽 앵커는 우리 배너와 실제로 겹칠 때만 배너를 숨겨요 (애드센스 "의도 기반" 검색 칩처럼 배너 위에 떠 있는 건 겹치지 않으니 배너 유지)
    if (a) { const r = a.getBoundingClientRect(); if (r.top < innerHeight / 2) top = Math.round(r.height); else { const br = bar && bar.getBoundingClientRect(); bottom = !br || !br.height || r.bottom > br.top + 4; } }
    document.documentElement.style.setProperty("--anchor-top", top + "px");
    // 하단 배너는 어떤 경우에도 숨기지 않아요 (앵커는 사이트 설정에서 꺼져 있고, 의도 기반 검색 칩은 그대로 둬요)
    if (bar && bar.style.visibility === "hidden") bar.style.visibility = "visible";
    void bottom;
  }, 1500);
}
adAnchorWatch();
function adBarGuard() {
  if (!ADS.on) return;
  setInterval(() => {
    const bar = document.getElementById("adbar") || ADS.bar;
    if (!bar || !document.body.classList.contains("ad-on")) return;
    const host = document.getElementById("app") || document.body;
    if (bar.parentNode !== host || bar !== host.lastElementChild) host.appendChild(bar);
    for (const p of ["visibility", "opacity", "transform", "top", "height"]) if (bar.style[p]) bar.style[p] = "";
    if (bar.style.display !== "flex") bar.style.display = "flex";
  }, 1000);
}
adBarGuard();
/* 🔎 진단 모드: 주소에 ?adbg=1 을 붙이면 화면 위쪽에 하단 띠 상태가 실시간으로 떠요 (폰에서 사라지는 순간 캡처용) */
if (/[?&]adbg=1/.test(location.search)) setTimeout(() => {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:4px;top:40px;z-index:2147483647;background:rgba(0,0,0,.82);color:#7f7;font:10px/1.35 monospace;padding:6px;margin:0;border-radius:6px;pointer-events:none;max-width:96vw;white-space:pre-wrap";
  document.body.appendChild(box);
  const hist = [];
  let prev = "";
  setInterval(() => {
    const bar = document.getElementById("adbar"), ins = bar && bar.querySelector("ins.adsbygoogle"), L = bar && bar.querySelector(".house-layer");
    const vv = window.visualViewport;
    if (!bar) { box.textContent = "NO #adbar"; return; }
    const r = bar.getBoundingClientRect(), cs = getComputedStyle(bar);
    const hitEl = document.elementFromPoint(innerWidth / 2, Math.min(r.top + r.height / 2, innerHeight - 2));
    const hit = hitEl ? (bar.contains(hitEl) ? "bar:" : "OTHER:") + hitEl.tagName + "." + String(hitEl.className).slice(0, 18) : "none";
    const ir = ins && ins.getBoundingClientRect();
    const st = `bar ${Math.round(r.top)}/${Math.round(r.height)} ${cs.display} ${cs.visibility} op${cs.opacity}\nins ${ins ? ins.getAttribute("data-ad-status") + " " + Math.round(ir.top) + "/" + Math.round(ir.height) + " " + getComputedStyle(ins).display : "none"} chips:${ins ? adChipsSeen(bar, ins, L) : "-"} layer:${L ? L.classList.contains("on") : "-"}\nhit ${hit}`;
    const key = st.replace(/\d+\/\d+/g, "");
    if (key !== prev) { hist.unshift(new Date().toTimeString().slice(0, 8) + " " + st.split("\n").join(" | ")); hist.length = Math.min(hist.length, 4); prev = key; }
    box.textContent = `v${(document.querySelector('script[src*="ads.js"]') || {}).src?.split("v=")[1] || "?"} sy${Math.round(scrollY)} ih${innerHeight} vv${vv ? Math.round(vv.height) + "+" + Math.round(vv.offsetTop) : "-"}\n${st}\n-- changes --\n${hist.join("\n")}`;
  }, 400);
}, 1500);
