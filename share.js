/* 더 윙어 2 - 📲 홈 화면에 추가(PWA) · 🔗 공유 · 🔒 개인정보처리방침 링크
 * 한국어·영어판이 같은 파일을 써요(T(한국어, 영어)). */
"use strict";
const T = (ko, en) => (window.W2_LANG === "en" ? en : ko);
const GAME_URL = "https://parkbeommin.github.io/the-winger/" + (window.W2_LANG === "en" ? "en/" : "");

/* 서비스워커: 실서비스·로컬에서만 */
if ("serviceWorker" in navigator && (location.hostname === "parkbeommin.github.io" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register(window.W2_LANG === "en" ? "../sw.js" : "sw.js", { scope: window.W2_LANG === "en" ? "../" : "./" }).catch(() => {}));
}

/* 홈 화면에 추가: 안드로이드 크롬은 설치 창, 아이폰 사파리는 방법 안내 */
let installEvt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; titleExtras(); });
addEventListener("appinstalled", () => { installEvt = null; titleExtras(); if (typeof track === "function") track("pwa_install"); });
async function installApp() {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); if (r && r.outcome === "accepted") toast(T("📲 홈 화면에 추가했어요!", "📲 Added to your home screen!")); installEvt = null; titleExtras(); return; }
  if (isIOS()) return modal({ emoji: "📲", title: T("홈 화면에 추가", "Add to Home Screen"), html: T("<p>사파리 아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르면 앱처럼 바로 실행돼요.</p>", "<p>In Safari, tap the <b>Share button (□↑)</b> → <b>Add to Home Screen</b> to launch it like an app.</p>"), buttons: [{ label: T("알겠어요", "Got it"), value: 1, cls: "btn-primary" }] });
  modal({ emoji: "📲", title: T("홈 화면에 추가", "Add to Home Screen"), html: T("<p>브라우저 메뉴(⋮)에서 <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 눌러 주세요.</p>", "<p>Open the browser menu (⋮) and choose <b>Add to Home screen</b> or <b>Install app</b>.</p>"), buttons: [{ label: T("알겠어요", "Got it"), value: 1, cls: "btn-primary" }] });
}

/* 게임 공유: 폰은 공유 창, PC는 주소 복사 */
async function shareGame(text) {
  const data = { title: T("더 윙어 2 : 라이벌", "The Winger 2: Rival"), text: text || T("운명의 라이벌과 함께 크는 축구선수 키우기 ⚽ 유스에서 발롱도르까지!", "Raise a footballer alongside your destined rival ⚽ From youth to the Ballon d'Or!"), url: GAME_URL + "?src=share" };
  if (typeof track === "function") track("share", { method: navigator.share ? "native" : "copy" });
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${data.text}\n${data.url}`); toast(T("🔗 링크를 복사했어요. 친구에게 붙여넣어 주세요!", "🔗 Link copied. Paste it to a friend!")); }
  catch { prompt(T("이 주소를 복사해 주세요", "Copy this link"), data.url); }
}
/* 시즌 결산 자랑하기 */
function shareSeason() {
  const P = S.pro, last = S.career.seasons[S.career.seasons.length - 1];
  if (!last) return shareGame();
  const aw = last.awards && last.awards.length ? ` · ${last.awards.join(", ")}` : "";
  shareGame(T(`⚽ 더 윙어 2 · ${S.name} ${last.season}시즌 ${last.club}: ${last.g}골 ${last.a}도움, 평점 ${last.avg}${aw}. 나도 키워보기 👇`,
    `⚽ The Winger 2 · ${S.name}, Season ${last.season} at ${last.club}: ${last.g} goals, ${last.a} assists, rating ${last.avg}${aw}. Raise yours 👇`));
}

/* 타이틀에 버튼들 */
function titleExtras() {
  const box = document.getElementById("title-extras");
  if (!box) return;
  const canInstall = !isStandalone() && (installEvt || isIOS() || /android/i.test(navigator.userAgent));
  box.innerHTML = `${canInstall ? `<button class="btn btn-ghost sm" id="btn-install">📲 ${T("홈 화면에 추가", "Add to Home")}</button>` : ""}<button class="btn btn-ghost sm" id="btn-share-game">🔗 ${T("친구에게 공유", "Share")}</button>`;
  const bi = document.getElementById("btn-install"); if (bi) bi.onclick = installApp;
  document.getElementById("btn-share-game").onclick = () => shareGame();
}
(() => {
  const ver = document.getElementById("ver");
  if (ver && !document.getElementById("title-extras")) {
    const box = document.createElement("div"); box.id = "title-extras"; ver.parentNode.insertBefore(box, ver);
    const a = document.createElement("a"); a.className = "privacy-link"; a.href = window.W2_LANG === "en" ? "../privacy.html#en" : "privacy.html";
    a.textContent = T("개인정보처리방침", "Privacy Policy"); ver.parentNode.insertBefore(a, ver.nextSibling);
    const lang = document.createElement("a"); lang.className = "privacy-link"; lang.href = window.W2_LANG === "en" ? "../" : "en/";
    lang.textContent = window.W2_LANG === "en" ? "한국어" : "English"; ver.parentNode.insertBefore(lang, a.nextSibling);
  }
  titleExtras();
})();
