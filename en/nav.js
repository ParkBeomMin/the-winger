/* 더 윙어 2 - 뒤로가기 (한 페이지 앱이라 브라우저·안드로이드 뒤로가기를 직접 처리해요)
 * 항상 맨 위에 '가드' 기록을 하나 두고, 뒤로가기가 오면 지금 화면에 맞게 처리한 뒤 다시 깔아요.
 *  · 창이 열려 있으면 닫기/취소/확인 같은 버튼으로 닫아요 (선택형 이벤트는 고르게 해요)
 *  · 경기 중에는 막아요 · 명예의 전당/선수 만들기/은퇴식은 타이틀로
 *  · 게임 메인에서는 "타이틀로 나갈까요?" · 타이틀에서는 두 번 누르면 나가요 */
"use strict";
(() => {
  if (!window.history || !history.pushState) return;
  let exitArmed = 0, leaving = false;
  const guard = () => { try { history.pushState({ w2: "guard", t: Date.now() }, ""); } catch {} };
  try { history.replaceState({ w2: "base" }, ""); } catch {}
  guard();
  const active = () => (document.querySelector(".screen.active") || {}).id || "";
  const CLOSE = /닫기|취소|나중에|돌아가기|확인|알겠어요|좋아|계속|아니|Close|Cancel|Later|Back|OK|Got it|Nice|Continue|Not now|No\b/;
  function closeModal() {
    const m = document.getElementById("modal");
    if (!m || m.hidden) return false;
    const btns = [...m.querySelectorAll(".m-btns button, .mbox > button")];
    if (!btns.length) { toast("Please wait a moment"); return true; }
    const b = btns.length === 1 ? btns[0] : btns.find((x) => CLOSE.test(x.textContent.trim().split("\n")[0]) && !/진행|시작|사기|서명|Continue|Proceed|Start|Buy|Sign/.test(x.textContent));
    if (b) b.click(); else toast("👆 Please pick one of the options");
    return true;
  }
  addEventListener("popstate", async () => {
    if (leaving) return;
    if (closeModal()) return guard();
    const ov = document.querySelector(".m-overlay:not([hidden])");
    const id = active();
    if (ov || id === "scr-match") { toast("⚽ You can't go back during a match"); return guard(); }
    if (id === "scr-hof" || id === "scr-create" || id === "scr-end") { initTitle(); return guard(); }
    if (id === "scr-season" || id === "scr-offers" || id === "scr-rival") { toast("Finish this screen to continue"); return guard(); }
    if (id === "scr-main") {
      guard();
      if (typeof busy !== "undefined" && busy) return toast("In progress. One moment");
      const ok = await modal({ emoji: "🏠", title: "Return to title?", html: "<p>Your progress is saved. You can come back with Continue.</p>", buttons: [{ label: "To title", value: true, cls: "btn-primary" }, { label: "Cancel", value: false }] });
      if (ok) initTitle();
      return;
    }
    // 타이틀: 두 번 누르면 나가요
    if (Date.now() - exitArmed < 2000) { leaving = true; history.back(); return; }
    exitArmed = Date.now(); toast("Press again to exit the game"); guard();
  });
})();
