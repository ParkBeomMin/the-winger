/* 더 윙어 2 - 클라우드 저장
 * 익명 계정으로 자동 백업 → 8자리 이전 코드로 다른 기기 이어하기 → (선택) 구글 계정 연동
 * 세이브는 gzip + base64로 줄여서 Firestore 문서 하나에 넣어요. */
"use strict";

const FB = { k: "AIzaSyBdFLOz7Oc2qCJFkRO9ysDn6XWZIVWNQLk", p: "fir-test-2e554", app: "1:603862676773:web:01ce2060f71d61772716cc" };   // Firebase 프로젝트 TheWinger (더 윙어 2 전용)
const FB_BASE = `https://firestore.googleapis.com/v1/projects/${FB.p}/databases/(default)/documents`;
const FB_KEY = "winger2_fb2", CLOUD_SIG = "winger2_cloudsig2", COL = "w2saves", TCOL = "w2transfers";
const fbEnc = (v) => typeof v === "string" ? { stringValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : { nullValue: null };
const fbDec = (f) => !f ? null : "stringValue" in f ? f.stringValue : "integerValue" in f ? +f.integerValue : "timestampValue" in f ? Date.parse(f.timestampValue) : null;
function fbFetch(url, opt, ms = 6000) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { ...(opt || {}), signal: c.signal }).finally(() => clearTimeout(t)); }
function fbStore() { try { return JSON.parse(localStorage.getItem(FB_KEY) || "{}"); } catch { return {}; } }
async function fbAuth() {
  let a = fbStore();
  if (a.tok && a.exp > Date.now() + 60000) return a;
  if (a.rt) {
    const r = await fbFetch("https://securetoken.googleapis.com/v1/token?key=" + FB.k, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(a.rt) });
    if (r.ok) { const j = await r.json(); a = { ...a, uid: j.user_id, tok: j.id_token, rt: j.refresh_token, exp: Date.now() + (+j.expires_in) * 1000 }; localStorage.setItem(FB_KEY, JSON.stringify(a)); return a; }
  }
  const r = await fbFetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + FB.k, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
  if (!r.ok) throw new Error("auth");
  const j = await r.json();
  a = { uid: j.localId, tok: j.idToken, rt: j.refreshToken, exp: Date.now() + (+j.expiresIn) * 1000 };
  localStorage.setItem(FB_KEY, JSON.stringify(a));
  return a;
}
const fsDoc = (path, fields) => ({ update: { name: `projects/${FB.p}/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fbEnc(v)])) }, updateTransforms: [{ fieldPath: "t", setToServerValue: "REQUEST_TIME" }] });
async function fbCommit(writes, tok) { return fbFetch(FB_BASE + ":commit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ writes }) }, 12000); }

/* gzip + base64 */
async function packSave(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "undefined") return "j" + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  const gz = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let s = ""; for (let i = 0; i < gz.length; i += 0x8000) s += String.fromCharCode.apply(null, gz.subarray(i, i + 0x8000));
  return "z" + btoa(s);
}
async function unpackSave(str) {
  if (str[0] === "j") return cleanSave(JSON.parse(decodeURIComponent(escape(atob(str.slice(1))))));
  const bin = atob(str.slice(1)), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const txt = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  const o = cleanSave(JSON.parse(txt));
  if (!o || !o.name || !o.stats) throw new Error("bad");
  return o;
}
/* 남이 만든 이전 코드로 이상한 세이브가 들어와도 화면에 HTML이 끼어들지 못하게: 모든 문자열에서 < > 를 지워요 */
function cleanSave(v, d = 0) {
  if (d > 40) return null;
  if (typeof v === "string") return v.replace(/[<>]/g, "");
  if (Array.isArray(v)) return v.map((x) => cleanSave(x, d + 1));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) { if (k === "__proto__" || k === "constructor" || k === "prototype") continue; o[k.replace(/[<>]/g, "")] = cleanSave(v[k], d + 1); } return o; }
  return v;
}
function saveSummary(o) {
  if (!o) return "-";
  const n = (x) => Number.isFinite(+x) ? Math.round(+x) : 0;
  return `${esc(o.name)} · ${o.phase === "pro" && o.pro ? `${n(o.pro.season)}시즌 ${esc(o.pro.club)}` : o.phase === "retired" ? "은퇴" : `유스 ${n(o.year)}년차`} · ${n(o.age)}세 · ${fameGrade(n(o.fame)).name}`;
}

/* ---------- 자동 백업 ---------- */
let cloudBusy = false, cloudLast = 0, cloudTimer = 0;
function cloudOn() { return SET.cloud !== false; }
async function cloudPut(force) {
  if (typeof flushSave === "function" && saveTimer) flushSave();
  const snap = load();   // 늘 마지막 저장본(경기 중간 상태가 아닌)을 올려요
  if (!snap || !snap.name || cloudBusy || (!force && !cloudOn())) return false;
  const ts = snap._ts || Date.now();
  if (!force && localStorage.getItem(CLOUD_SIG) === String(ts)) return true;
  cloudBusy = true;
  try {
    const a = await fbAuth();
    const data = await packSave(snap);
    if (data.length > 900000) return false;
    const r = await fbCommit([fsDoc(`${COL}/${a.uid}`, { data, ts, v: VERSION })], a.tok);
    if (r.ok) { localStorage.setItem(CLOUD_SIG, String(ts)); cloudLast = Date.now(); }
    return r.ok;
  } catch { return false; } finally { cloudBusy = false; }
}
/* 저장할 때마다 부르면 20초에 한 번씩만 올려요 */
function cloudAuto() {
  if (!cloudOn() || !S || !S.name) return;
  clearTimeout(cloudTimer);
  const wait = Math.max(0, 20000 - (Date.now() - cloudLast));
  cloudTimer = setTimeout(() => cloudPut(), wait || 1500);
}
async function cloudGet() {
  const a = await fbAuth();
  const r = await fbFetch(`${FB_BASE}/${COL}/${a.uid}`, { headers: { Authorization: "Bearer " + a.tok } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("get " + r.status);
  const f = (await r.json()).fields || {};
  return { data: fbDec(f.data), ts: fbDec(f.ts) || 0, v: fbDec(f.v) };
}

/* ---------- 기기 이전 코드 (8자리, 24시간, 한 번 쓰면 사라져요) ---------- */
const TR_AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const trNorm = (c) => (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const trFmt = (c) => c.slice(0, 4) + "-" + c.slice(4);
async function makeTransfer() {
  if (typeof flushSave === "function" && saveTimer) flushSave();
  const a = await fbAuth(), data = await packSave(load());
  for (let k = 0; k < 3; k++) {
    const code = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => TR_AB[x % 32]).join("");
    const w = fsDoc(`${TCOL}/${code}`, { data, exp: Date.now() + 24 * 3600 * 1000, owner: a.uid });
    w.currentDocument = { exists: false };
    const r = await fbCommit([w], a.tok);
    if (r.ok) return code;
  }
  throw new Error("make");
}
async function redeemTransfer(code) {
  const r = await fbFetch(`${FB_BASE}/${TCOL}/${code}`, {}, 8000);
  if (r.status === 404 || r.status === 403) { toast("코드를 찾을 수 없어요"); return null; }
  if (!r.ok) { toast("연결에 실패했어요"); return null; }
  const f = (await r.json()).fields || {};
  if ((fbDec(f.exp) || 0) < Date.now()) { toast("기간이 지난 코드예요 (24시간)"); return null; }
  try { const o = await unpackSave(fbDec(f.data)); return o; } catch { toast("코드 데이터가 올바르지 않아요"); return null; }
}
async function deleteTransfer(code) { try { const a = await fbAuth(); await fbFetch(`${FB_BASE}/${TCOL}/${code}`, { method: "DELETE", headers: { Authorization: "Bearer " + a.tok } }); } catch {} }
function applySave(o) {
  o._ts = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  localStorage.removeItem(CLOUD_SIG);
  location.reload();
}

/* ---------- 구글 계정 연동 ---------- */
let FB_SDK = null;
function fbSdk() {
  if (!FB_SDK) FB_SDK = (async () => {
    const SV = "10.14.1";
    const [ap, au] = await Promise.all([import(`https://www.gstatic.com/firebasejs/${SV}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${SV}/firebase-auth.js`)]);
    const app = ap.initializeApp({ apiKey: FB.k, authDomain: FB.p + ".firebaseapp.com", projectId: FB.p, appId: FB.app }, "winger2");
    const auth = au.getAuth(app); await au.setPersistence(auth, au.inMemoryPersistence);
    return { au, auth };
  })().catch((e) => { FB_SDK = null; throw e; });
  return FB_SDK;
}
const isLinked = () => !!fbStore().google;
async function googleLink() {
  let sdk; try { sdk = await fbSdk(); } catch { toast("로그인 모듈을 불러오지 못했어요"); return false; }
  const { au, auth } = sdk;
  let res;
  try { res = await au.signInWithPopup(auth, new au.GoogleAuthProvider()); }
  catch (e) { toast(e && e.code === "auth/popup-blocked" ? "팝업이 막혔어요. 팝업을 허용해 주세요" : "로그인을 취소했어요"); return false; }
  const u = res.user, tok = await u.getIdToken();
  localStorage.setItem(FB_KEY, JSON.stringify({ uid: u.uid, tok, rt: u.refreshToken, exp: Date.now() + 3300 * 1000, google: 1, email: u.email || "" }));
  localStorage.removeItem(CLOUD_SIG);
  try { await au.signOut(auth); } catch {}
  await cloudReconcile();
  return true;
}
/* 구글 계정에 이미 다른 진행이 있으면 고르게 해요 */
async function cloudReconcile() {
  let c; try { c = await cloudGet(); } catch { toast("클라우드 연결에 실패했어요"); return; }
  if (!c || !c.data) { const ok = await cloudPut(true); toast(ok ? "☁️ 구글 계정에 저장했어요" : "저장에 실패했어요"); return; }
  let o = null; try { o = await unpackSave(c.data); } catch { await cloudPut(true); return; }
  const v = await modal({
    emoji: "☁️", title: "어느 진행으로 할까요?",
    html: `<p>이 구글 계정에 이미 저장된 진행이 있어요.</p><div class="ss-card"><b>☁️ 클라우드</b> <small>${new Date(c.ts).toLocaleString("ko-KR")}</small><br/>${saveSummary(o)}</div><div class="ss-card"><b>📱 이 기기</b><br/>${S && S.name ? saveSummary(S) : "진행 없음"}</div>`,
    buttons: [{ label: "☁️ 클라우드 불러오기", value: "pull", cls: "btn-primary" }, { label: "📱 이 기기로 덮어쓰기", value: "push" }, { label: "취소", value: null }],
  });
  if (v === "pull") applySave(o);
  else if (v === "push") { const ok = await cloudPut(true); toast(ok ? "이 기기 진행으로 저장했어요" : "저장 실패"); }
}
function googleUnlink() { [FB_KEY, CLOUD_SIG].forEach((k) => localStorage.removeItem(k)); toast("연동을 해제했어요. 이 기기 진행은 그대로 남아요"); }

/* ---------- 메뉴 ---------- */
async function openCloud() {
  const st = fbStore();
  const last = localStorage.getItem(CLOUD_SIG);
  const v = await modal({
    emoji: "☁️", title: "저장 · 기기 이전", wide: true,
    html: `<p>진행은 매 턴 이 기기에 저장되고, <b>자동 클라우드 백업</b>이 켜져 있으면 서버에도 올라가요.</p>
      <div class="ss-card"><b>상태</b><br/>${isLinked() ? `🔗 구글 연동됨 (${esc(st.email || "")})` : st.uid ? "👤 익명 백업 사용 중 (이 브라우저에 묶여 있어요)" : "아직 백업한 적 없어요"}<br/><small>${last ? `마지막 백업 ${new Date(+last).toLocaleString("ko-KR")}` : ""}</small></div>
      <p class="small">· <b>이전 코드</b>: 다른 기기에서 8자리 코드를 넣으면 지금 진행이 그대로 옮겨져요 (24시간, 1회용).<br/>· <b>구글 연동</b>: 어느 기기에서든 같은 구글 계정으로 이어서 해요.</p>`,
    buttons: [
      { label: "📤 이전 코드 만들기", value: "make", cls: "btn-primary" },
      { label: "📥 이전 코드 입력", value: "redeem" },
      isLinked() ? { label: "🔓 구글 연동 해제", value: "unlink" } : { label: "🔗 구글 계정 연동", value: "link" },
      { label: `☁️ 자동 백업 ${cloudOn() ? "끄기" : "켜기"}`, value: "toggle" },
      { label: "닫기", value: null },
    ],
  });
  if (v === "make") {
    const sv = S || load();   // 타이틀 화면에선 아직 S를 안 불러왔어요 → 저장된 진행으로 확인
    if (!sv || !sv.name) return toast("옮길 진행이 없어요");
    toast("코드를 만드는 중…", 1500);
    let code; try { code = await makeTransfer(); } catch { return toast("코드를 만들지 못했어요. 잠시 뒤에 다시 해 주세요"); }
    await modal({ emoji: "📤", title: "이전 코드", html: `<p class="xfer-code">${trFmt(code)}</p><p class="small">다른 기기에서 <b>⚙️ → ☁️ 저장 · 기기 이전 → 📥 이전 코드 입력</b>에 넣어 주세요.<br/>24시간 동안 한 번만 쓸 수 있어요.</p>`, buttons: [{ label: "코드 복사", value: 1, cls: "btn-primary" }, { label: "닫기", value: 0 }] })
      .then((c) => { if (c) navigator.clipboard?.writeText(code).then(() => toast("복사했어요")); });
  } else if (v === "redeem") {
    const code = trNorm(prompt("8자리 이전 코드를 입력해 주세요 (예: ABCD-2345)") || "");
    if (!code) return;
    if (code.length !== 8) return toast("8자리 코드를 확인해 주세요");
    const o = await redeemTransfer(code);
    if (!o) return;
    const ok = await modal({ emoji: "📥", title: "이 진행으로 바꿀까요?", html: `<div class="ss-card"><b>받을 진행</b><br/>${saveSummary(o)}</div><div class="ss-card"><b>지금 이 기기</b><br/>${S && S.name ? saveSummary(S) : "진행 없음"}</div><p class="small">이 기기 진행은 받은 진행으로 바뀌어요.</p>`, buttons: [{ label: "바꾸기", value: true, cls: "btn-primary" }, { label: "취소", value: false }] });
    if (!ok) return;
    await deleteTransfer(code);
    applySave(o);
  } else if (v === "link") await googleLink();
  else if (v === "unlink") googleUnlink();
  else if (v === "toggle") { SET.cloud = !cloudOn(); saveSet(); toast(`자동 백업 ${cloudOn() ? "켬" : "끔"}`); if (cloudOn()) cloudPut(true); }
}
