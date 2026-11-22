/* 더 윙어 2 - 📲 홈 화면에 추가(PWA) · 🔗 공유 · 🔒 개인정보처리방침 링크
 * 한국어·영어판이 같은 파일을 써요(T(한국어, 영어)). */
"use strict";
const T = (ko, en) => (window.W2_LANG === "en" ? en : ko);
const GAME_URL = "https://parkbeommin.github.io/the-winger/" + (window.W2_LANG === "en" ? "en/" : "");

/* 서비스워커: 실서비스·로컬에서만 */
if ("serviceWorker" in navigator && (location.hostname === "parkbeommin.github.io" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}));
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
/* 📣 시즌 결산 자랑하기: 자랑 카드 이미지(1080x1350) + 정리된 글
 * 폰은 이미지와 글을 함께 공유 창으로, 안 되면 이미지 저장 · 글 복사 */
function seasonBrag() {
  const P = S.pro, last = S.career.seasons[S.career.seasons.length - 1];
  if (!last) return null;
  const lg = LEAGUES[last.league], nat = NATIONS[ORIGINS[S.origin].nat];
  const ms = (typeof W !== "undefined" && W.p && W.p.me && W.p.me.s) || {};
  const aw = [...(last.awards || [])];
  for (const [k, c] of Object.entries(S.cups || {})) if (c.winner === last.club && CUPS[k]) aw.push(T(`${CUPS[k].emoji} ${CUPS[k].name} 우승`, `${CUPS[k].emoji} ${CUPS[k].name} winner`));
  const rv = S.rival, rr = last.rv || {};
  const mine = last.g + last.a, theirs = (rr.g || 0) + (rr.a || 0);
  const head = aw.find((x) => x.includes("🏅")) ? T("🏅 발롱도르 수상!", "🏅 Ballon d'Or winner!")
    : aw.find((x) => x.includes("🏆")) ? T("🏆 우승 시즌!", "🏆 Champions!")
    : aw.find((x) => x.includes("👟")) ? T("👟 득점왕 시즌!", "👟 Golden Boot season!")
    : aw.find((x) => x.includes("👑")) ? T("👑 리그 MVP 시즌!", "👑 League MVP season!")
    : last.g >= 20 ? T(`⚽ ${last.g}골 폭발!`, `⚽ ${last.g} goals!`)
    : T(`${last.season}시즌 결산`, `Season ${last.season} review`);
  const pc = ms.pa ? Math.round(ms.pc / ms.pa * 100) : last.pp || 0;
  const role = ms.r || ({ fw: "fw", wg: "fw", mf: "mf", df: "df", gk: "gk" })[S.pos] || "fw";
  const sub = {
    fw: [[T("슈팅(유효)", "Shots (on)"), ms.sh != null ? `${ms.sh}(${ms.sot})` : "-"], [T("키패스", "Key passes"), ms.kp ?? last.kp ?? 0], [T("드리블", "Dribbles"), ms.da != null ? `${ms.dc}/${ms.da}` : "-"]],
    mf: [[T("패스 성공", "Pass acc."), pc + "%"], [T("키패스", "Key passes"), ms.kp ?? last.kp ?? 0], [T("태클", "Tackles"), ms.tc ?? last.tc ?? 0]],
    df: [[T("태클", "Tackles"), ms.tc ?? last.tc ?? 0], [T("가로채기", "Interceptions"), ms.ic || 0], [T("걷어내기", "Clearances"), ms.cl || 0]],
    gk: [[T("선방", "Saves"), ms.sv || 0], [T("걷어내기", "Clearances"), ms.cl || 0], [T("패스 성공", "Pass acc."), pc + "%"]],
  }[role] || [];
  const verdict = mine > theirs ? T("🔥 이번 시즌은 내가 이겼다!", "🔥 I beat my rival this season!") : mine < theirs ? T("😤 이번엔 라이벌이 앞섰다", "😤 My rival edged it this time") : T("🤝 막상막하", "🤝 Neck and neck");
  return { P, last, lg, nat, aw, rv, rr, head, sub, verdict, mine, theirs };
}
function bragText(d) {
  const { last, lg, aw, rv, rr, verdict } = d;
  const L = [
    T("⚽ 더 윙어 2 : 라이벌", "⚽ The Winger 2: Rival"),
    T(`${S.name} · ${last.season}시즌 결산 (${last.age}세)`, `${S.name} · Season ${last.season} (age ${last.age})`),
    T(`${lg.flag} ${last.club} · ${lg.name} ${last.rank}위`, `${lg.flag} ${last.club} · ${lg.name}, ${last.rank}th`),
    "",
    T(`⚽ ${last.g}골  🅰️ ${last.a}도움  ⭐ 평점 ${Number(last.avg).toFixed(2)}  (${last.apps}경기)`, `⚽ ${last.g} G  🅰️ ${last.a} A  ⭐ ${Number(last.avg).toFixed(2)} avg  (${last.apps} apps)`),
  ];
  if (aw.length) L.push(aw.join(" · "));
  if (last.ballon) L.push(T(`🏅 발롱도르 ${last.ballon}위`, `🏅 Ballon d'Or #${last.ballon}`));
  L.push(T(`⚔️ 라이벌 ${rv.name}: ${rr.g || 0}골 ${rr.a || 0}도움 → ${verdict.replace(/^\S+\s/, "")}`, `⚔️ Rival ${rv.name}: ${rr.g || 0} G ${rr.a || 0} A → ${verdict.replace(/^\S+\s/, "")}`));
  L.push("", T("나도 키워보기 👇", "Raise your own 👇"));
  return L.join("\n");
}
function loadImg(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function bragCard(d) {
  const { last, lg, nat, aw, rv, rr, head, sub, verdict, mine, theirs } = d;
  try { await document.fonts.load("64px Jua"); await document.fonts.load("32px 'Gowun Dodum'"); } catch {}
  const Wd = 1080, Hd = 1350, cv = document.createElement("canvas"); cv.width = Wd; cv.height = Hd;
  const x = cv.getContext("2d");
  const J = (n) => `${n}px Jua, sans-serif`, G = (n, b) => `${b ? "bold " : ""}${n}px 'Gowun Dodum', sans-serif`;
  const rr2 = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  const fit = (t, max, size, font) => { let n = size; x.font = font(n); while (x.measureText(t).width > max && n > 18) { n -= 2; x.font = font(n); } return n; };
  // 배경: 경기장 + 잔디 줄무늬
  let g = x.createLinearGradient(0, 0, 0, Hd); g.addColorStop(0, "#0d2f1d"); g.addColorStop(1, "#05110a"); x.fillStyle = g; x.fillRect(0, 0, Wd, Hd);
  const st = await loadImg("assets/stadium.webp");
  if (st) { x.globalAlpha = .32; const sc = Math.max(Wd / st.width, 720 / st.height); x.drawImage(st, (Wd - st.width * sc) / 2, 0, st.width * sc, st.height * sc); x.globalAlpha = 1; }
  g = x.createLinearGradient(0, 300, 0, 760); g.addColorStop(0, "rgba(5,17,10,0)"); g.addColorStop(1, "#05110a"); x.fillStyle = g; x.fillRect(0, 300, Wd, 460);
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,.018)" : "rgba(0,0,0,0)"; x.fillRect(i * 90, 760, 90, Hd - 760); }
  // 머리말
  x.fillStyle = "#8fe3ae"; x.font = J(34); x.textBaseline = "alphabetic"; x.fillText(T("더 윙어 2 : 라이벌", "THE WINGER 2 : RIVAL"), 64, 84);
  x.textAlign = "right"; x.fillStyle = "rgba(255,255,255,.7)"; x.font = J(34); x.fillText(T(`${last.season}시즌`, `SEASON ${last.season}`), Wd - 64, 84); x.textAlign = "left";
  const hs = fit(head, Wd - 128, 88, J); x.fillStyle = "#fff"; x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 18; x.fillText(head, 64, 84 + 24 + hs); x.shadowBlur = 0;
  // 선수 카드
  const cy = 250, ch = 370; rr2(48, cy, Wd - 96, ch, 36); x.fillStyle = "rgba(10,30,20,.78)"; x.fill(); x.strokeStyle = "rgba(143,227,174,.35)"; x.lineWidth = 3; x.stroke();
  x.save(); rr2(76, cy + 28, 330, ch - 56, 28); x.clip();
  g = x.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, (d.P && d.P.kit && d.P.kit[0]) || "#2a6"); g.addColorStop(1, "#0a1a12"); x.fillStyle = g; x.fillRect(76, cy + 28, 330, ch - 56);
  try { if (S.look && S.look.face && typeof faceReady === "function" && !faceReady(S.look.face) && FACE_IMG[S.look.face]) await new Promise((r) => { FACE_IMG[S.look.face].addEventListener("load", r, { once: true }); setTimeout(r, 1500); }); drawAvatar(x, 241, cy + 40, 300, S.look, (d.P && d.P.kit) || ["#2a6", "#fff"], { mood: aw.length ? "joy" : undefined }); } catch {}
  x.restore();
  const tx = 440, tw = Wd - 96 - (tx - 48) - 40;
  let ty = cy + 80;
  const ns = fit(S.name, tw, 66, J); x.fillStyle = "#fff"; x.fillText(S.name, tx, ty); ty += 20;
  if (S.title && typeof titleName === "function") { const tn = titleName(S.title); x.font = G(30, 1); const w = x.measureText(tn).width + 36; rr2(tx, ty, w, 50, 25); x.fillStyle = "#f5c842"; x.fill(); x.fillStyle = "#3a2a00"; x.fillText(tn, tx + 18, ty + 36); ty += 60; } else ty += 14;
  x.font = G(32, 1); x.fillStyle = "rgba(255,255,255,.82)"; x.fillText(`${nat ? nat.flag + " " : ""}${POS[S.pos].name} · ${T(`${last.age}세`, `age ${last.age}`)} · ${T("종합", "OVR")} ${last.ovr}`, tx, ty + 34); ty += 58;
  const cid = typeof crestId === "function" ? crestId(last.club) : null;
  const ci = cid && typeof CREST_READY !== "undefined" && CREST_READY.has(cid) ? await loadImg(`assets/crests/${cid}.webp`) : null;
  if (ci) x.drawImage(ci, tx, ty, 76, 76); else { x.fillStyle = (crestKit(last.club) || ["#2a6"])[0]; rr2(tx + 6, ty + 4, 64, 68, 14); x.fill(); }
  fit(last.club, tw - 92, 44, J); x.fillStyle = "#fff"; x.fillText(last.club, tx + 92, ty + 34);
  x.font = G(28, 1); x.fillStyle = "#8fe3ae"; x.fillText(T(`${lg.flag} ${lg.name} · ${last.rank}위`, `${lg.flag} ${lg.name} · ${last.rank}th`), tx + 92, ty + 72);
  // 통산 기록 칩
  const mom = (d.P && d.P.s && d.P.s.mom) || 0, C = S.career || {};
  const chips = [mom ? T(`⭐ MOM ${mom}회`, `⭐ MOM x${mom}`) : null, T(`통산 ⚽ ${C.g || 0} · 🅰️ ${C.a || 0}`, `Career ⚽ ${C.g || 0} · 🅰️ ${C.a || 0}`)].filter(Boolean);
  let chx = tx; const chy = Math.min(ty + 90, cy + ch - 56); x.font = G(26, 1);
  for (const c of chips) { const w = x.measureText(c).width + 32; if (chx + w > Wd - 76) break; rr2(chx, chy, w, 48, 24); x.fillStyle = "rgba(255,255,255,.09)"; x.fill(); x.fillStyle = "rgba(255,255,255,.88)"; x.fillText(c, chx + 16, chy + 33); chx += w + 12; }
  // 큰 숫자 4칸
  const tiles = [[last.g, T("골", "Goals"), "#ffd25a"], [last.a, T("도움", "Assists"), "#7fd4ff"], [Number(last.avg).toFixed(2), T("평점", "Rating"), "#8fe3ae"], [last.apps, T("경기", "Apps"), "#fff"]];
  const ty0 = cy + ch + 30, tw4 = (Wd - 96 - 3 * 20) / 4;
  tiles.forEach(([v, l, c], i) => { const X = 48 + i * (tw4 + 20); rr2(X, ty0, tw4, 170, 28); x.fillStyle = "rgba(255,255,255,.07)"; x.fill(); x.textAlign = "center"; x.fillStyle = c; fit(String(v), tw4 - 24, 92, J); x.fillText(String(v), X + tw4 / 2, ty0 + 100); x.font = G(30, 1); x.fillStyle = "rgba(255,255,255,.75)"; x.fillText(l, X + tw4 / 2, ty0 + 146); x.textAlign = "left"; });
  // 포지션별 세부 기록
  let y = ty0 + 170 + 48; x.font = G(28, 1);
  const subT = sub.map(([l, v]) => `${l} ${v}`).join("   ·   ");
  x.fillStyle = "rgba(255,255,255,.7)"; x.textAlign = "center"; x.fillText(subT, Wd / 2, y); x.textAlign = "left"; y += 34;
  // 수상 배지
  const badges = [...aw]; if (last.ballon && !aw.some((a) => a.includes("🏅"))) badges.push(T(`🏅 발롱도르 ${last.ballon}위`, `🏅 Ballon d'Or #${last.ballon}`));
  if (!badges.length) badges.push(T("💪 다음 시즌엔 트로피를!", "💪 Trophies next season!"));
  x.font = G(30, 1); let bx = 48, by = y; const rows = [];
  for (const b of badges.slice(0, 8)) { const w = x.measureText(b).width + 44; if (bx + w > Wd - 48) { bx = 48; by += 66; } rows.push([b, bx, by, w]); bx += w + 14; }
  for (const [b, X, Y, w] of rows) { const gold = b.includes("🏅") && !b.match(/\d+[위#]|#\d/); rr2(X, Y, w, 54, 27); x.fillStyle = gold ? "#f5c842" : b.includes("🏆") ? "rgba(245,200,66,.22)" : "rgba(143,227,174,.16)"; x.fill(); x.fillStyle = gold ? "#3a2a00" : "#fff"; x.fillText(b, X + 22, Y + 38); }
  // 라이벌: 바닥글 바로 위에 붙여요
  const FH = 180, rh = 120; y = Math.max(by + 54 + 24, Hd - FH - 24 - rh);
  if (rh > 90) {
    rr2(48, y, Wd - 96, rh, 28); x.fillStyle = mine > theirs ? "rgba(90,200,120,.16)" : mine < theirs ? "rgba(230,80,80,.16)" : "rgba(255,255,255,.08)"; x.fill();
    x.font = J(36); x.fillStyle = "#ff8c8c"; x.fillText(T(`⚔️ 라이벌 ${rv.name}`, `⚔️ Rival ${rv.name}`), 76, y + 48);
    x.font = G(28, 1); x.fillStyle = "rgba(255,255,255,.8)"; x.fillText(T(`${rr.club || ""} · ⚽ ${rr.g || 0}골 · 🅰️ ${rr.a || 0}도움 · 평점 ${rr.avg ? Number(rr.avg).toFixed(2) : "-"}`, `${rr.club || ""} · ⚽ ${rr.g || 0} G · 🅰️ ${rr.a || 0} A · ${rr.avg ? Number(rr.avg).toFixed(2) : "-"} avg`), 76, y + 90);
    x.font = J(32); x.fillStyle = "#fff"; x.textAlign = "right"; x.fillText(verdict, Wd - 76, y + 48); x.textAlign = "left";
  }
  // 바닥글: 왼쪽 문구 + 오른쪽 QR (찍으면 게임으로)
  x.fillStyle = "#8fe3ae"; x.fillRect(0, Hd - FH, Wd, FH);
  const qs = 148, qx = Wd - 56 - qs, qy = Hd - FH + (FH - qs) / 2;
  const qr = await loadImg(window.W2_LANG === "en" ? "assets/qr-en.png" : "assets/qr-ko.png");
  rr2(qx - 10, qy - 10, qs + 20, qs + 20, 18); x.fillStyle = "#fff"; x.fill();
  if (qr) { x.imageSmoothingEnabled = false; x.drawImage(qr, qx, qy, qs, qs); x.imageSmoothingEnabled = true; }
  x.fillStyle = "#062012"; x.font = J(56); x.fillText(T("나도 키워보기", "Raise your own"), 64, Hd - FH + 82);
  x.font = G(30, 1); x.fillStyle = "rgba(6,32,18,.82)"; x.fillText(T("📷 QR 찍고 바로 시작 · 무료 축구선수 키우기", "📷 Scan to play · free football career game"), 64, Hd - FH + 132);
  x.font = J(64); x.fillStyle = "#062012"; x.textAlign = "right"; x.fillText("▶", qx - 26, Hd - FH + 112); x.textAlign = "left";
  return cv;
}
async function shareSeason() {
  const d = seasonBrag();
  if (!d) return shareGame();
  if (typeof loadingOn === "function") loadingOn(T("자랑 카드 만드는 중", "Making your card"));
  let cv = null; try { cv = await bragCard(d); } catch (e) { console.warn(e); }
  if (typeof loadingOff === "function") loadingOff();
  const text = bragText(d);
  if (!cv) return shareGame(text);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const url = URL.createObjectURL(blob), fname = `the-winger2-s${d.last.season}.png`;
  const file = new File([blob], fname, { type: "image/png" });
  const canFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  if (typeof track === "function") track("brag_open");
  for (;;) {
    const v = await modal({ title: T("📣 이번 시즌 자랑하기", "📣 Share this season"),
      html: `<img src="${url}" alt="" style="width:100%;max-height:52vh;object-fit:contain;border-radius:12px;display:block;margin:4px 0 8px"/><details class="brag-d" style="text-align:left;font-size:.8rem"><summary style="cursor:pointer;opacity:.8">${T("📝 함께 보낼 글 보기", "📝 Text to send")}</summary><pre class="brag-txt" style="white-space:pre-wrap;font:inherit;font-size:.78rem;text-align:left;background:rgba(255,255,255,.05);border-radius:10px;padding:8px 10px;margin:0">${text.replace(/[<&]/g, (c) => c === "<" ? "&lt;" : "&amp;")}
${GAME_URL}</pre></details>`,
      buttons: [...(canFile ? [{ label: T("📤 이미지로 공유", "📤 Share image"), value: "share", cls: "btn-primary" }] : []),
        { label: T("💾 이미지 저장", "💾 Save image"), value: "save", cls: canFile ? "btn-ghost" : "btn-primary" },
        { label: T("📋 글 복사", "📋 Copy text"), value: "copy" }, { label: T("닫기", "Close"), value: "close" }] });
    if (v === "share") { if (typeof track === "function") track("share", { method: "brag_image" }); try { await navigator.share({ files: [file], text: `${text}
${GAME_URL}` }); break; } catch (e) { if (e && e.name === "AbortError") continue; toast(T("공유가 안 되는 브라우저예요. 이미지 저장을 눌러 주세요.", "Sharing isn't supported here. Try Save image.")); } }
    else if (v === "save") { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); if (typeof track === "function") track("share", { method: "brag_save" }); toast(T("💾 이미지를 저장했어요", "💾 Image saved")); }
    else if (v === "copy") { try { await navigator.clipboard.writeText(`${text}
${GAME_URL}`); toast(T("📋 자랑 글을 복사했어요", "📋 Copied")); } catch { prompt(T("이 글을 복사해 주세요", "Copy this"), `${text}
${GAME_URL}`); } }
    else break;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* 타이틀에 버튼들 */
function titleExtras() {
  const box = document.getElementById("title-extras");
  if (!box) return;
  const canInstall = !isStandalone() && (installEvt || isIOS() || /android/i.test(navigator.userAgent));
  box.innerHTML = canInstall ? `<button class="btn btn-ghost" id="btn-install">📲 ${T("홈 화면에 추가하고 앱처럼 하기", "Add to Home Screen")}</button>` : "";
  const bi = document.getElementById("btn-install"); if (bi) bi.onclick = installApp;
  const sg = document.getElementById("btn-share-game"); if (sg) sg.onclick = () => shareGame();
}
(() => {
  const ver = document.getElementById("ver");
  if (ver && !document.getElementById("title-extras")) {
    const box = document.createElement("div"); box.id = "title-extras"; ver.parentNode.insertBefore(box, ver);
    const a = document.createElement("a"); a.className = "privacy-link"; a.href = window.W2_LANG === "en" ? "privacy.html#en" : "privacy.html";
    a.textContent = T("개인정보처리방침", "Privacy Policy"); ver.parentNode.insertBefore(a, ver.nextSibling);
    const lang = document.createElement("a"); lang.className = "privacy-link"; lang.href = window.W2_LANG === "en" ? "./" : "en/";
    lang.textContent = window.W2_LANG === "en" ? "한국어" : "English"; ver.parentNode.insertBefore(lang, a.nextSibling);
  }
  titleExtras();
})();
