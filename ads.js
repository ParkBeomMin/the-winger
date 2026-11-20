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
if (ADS.on && ADS.prod) {
  const s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.client}`;
  document.head.appendChild(s);
}
window.adsbygoogle = window.adsbygoogle || [];
const HIDE_AD_ON = ["scr-match", "scr-create"];
function adBanner(screenId) {
  if (!ADS.on) return;
  let bar = document.getElementById("adbar");
  if (!bar) { bar = document.createElement("div"); bar.id = "adbar"; document.body.appendChild(bar); }
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
    } else bar.innerHTML = `<div class="ad-ph">하단 배너 광고 자리 (320x50)</div>`;
  }
}
