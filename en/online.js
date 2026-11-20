/* 더 윙어 2 - 온라인: 🎉 피버 타임 · 📢 공지사항 · 🏛️ 세계 명예의 전당
 * 전부 TheWinger Firestore(cloud.js의 FB, FB_BASE, fbAuth, fbCommit, fsDoc)를 써요.
 * 피버·공지는 누구나 읽고, 쓰기는 관리자(admin.html, 구글 로그인)만 돼요. */
"use strict";

const fv = (f) => !f ? null : "stringValue" in f ? f.stringValue : "integerValue" in f ? +f.integerValue : "doubleValue" in f ? f.doubleValue : "booleanValue" in f ? f.booleanValue : "timestampValue" in f ? Date.parse(f.timestampValue) : "mapValue" in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, fv(x)])) : null;
const docObj = (d) => { const o = {}; for (const k in d.fields || {}) o[k] = fv(d.fields[k]); o.id = d.name.split("/").pop(); return o; };
async function fsList(col, n = 30) {
  const r = await fbFetch(`${FB_BASE}/${col}?pageSize=${n}`, {}, 6000);
  if (!r.ok) throw new Error(col + " " + r.status);
  return ((await r.json()).documents || []).map(docObj);
}
const rdj = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const wrj = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- 🎉 피버 타임 ----------
 * 운영자가 기간과 효과를 열면 그동안 모두에게 붙는 보너스. 받은 구간은 저장해 두고,
 * 화면이 바뀔 때마다 지금 시각으로 다시 판정해요(이미 켜 둔 화면에도 떠요).
 * 운영 실수로 큰 값이 들어와도 게임이 무너지지 않게 읽는 쪽에서 상한을 걸어요. */
const FEVER_CAP = { train: 1.0, mast: 1.0, fame: .5, money: .5, rate: .4 };
const FEVER_LABEL = { train: "Training gains", mast: "Mastery", fame: "Fame gain", money: "Fees · Prizes", rate: "Match rating" };
const FEVER_KEY = "w2-fever", FEVER_SEEN = "w2-fever-seen";
function feverNorm(o) {
  if (!o) return null;
  const from = +o.from, to = +o.to;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  const eff = {};
  for (const k in FEVER_CAP) { const v = Number(o.eff && o.eff[k]); if (Number.isFinite(v) && v > 0) eff[k] = Math.min(v, FEVER_CAP[k]); }
  const rep = o.rep === "daily" || o.rep === "weekly" ? o.rep : "none";
  const t0 = clamp(+o.t0 || 0, 0, 1440), t1 = clamp(+o.t1 || 0, 0, 1440);
  const days = String(o.days || "0123456").replace(/[^0-6]/g, "");
  return { id: String(o.id || "fever"), emoji: String(o.emoji || "🎉").slice(0, 4), title: String((window.W2_LANG === "en" && o.title_en) || o.title || "Fever Time").slice(0, 40), note: String((window.W2_LANG === "en" && o.note_en) || o.note || "").slice(0, 120), from, to, eff, rep, t0, t1, days };
}
/* 반복 피버: 기간(from~to) 안에서 매일 또는 고른 요일의 t0~t1분(한국 시각)만 켜져요. 자정을 넘기는 구간(22:00~02:00)도 돼요.
 * 돌려주는 값은 '이번 회차'의 시작·끝(알림을 회차마다 한 번 띄우려고) */
const KST = 9 * 3600000;
function occurrence(e, now) {
  if (now < e.from || now >= e.to) return null;
  if (e.rep === "none") return { from: e.from, to: e.to };
  const k = new Date(now + KST), mins = k.getUTCHours() * 60 + k.getUTCMinutes();
  const dayStart = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()) - KST;   // 오늘 0시(KST)의 실제 시각
  const wrap = e.t1 <= e.t0;
  const tryDay = (d0, wd) => {
    if (e.rep === "weekly" && !e.days.includes(String(wd))) return null;
    const s = d0 + e.t0 * 60000, en = d0 + (wrap ? e.t1 + 1440 : e.t1) * 60000;
    return now >= s && now < en ? { from: Math.max(s, e.from), to: Math.min(en, e.to) } : null;
  };
  return tryDay(dayStart, k.getUTCDay()) || (wrap && mins < e.t1 ? tryDay(dayStart - 86400000, (k.getUTCDay() + 6) % 7) : null);
}
/* 지금 켜진 피버 전부 (여러 개면 효과를 더하고, 상한은 그대로) */
function feverAll() {
  const box = rdj(FEVER_KEY), now = Date.now();
  return ((box && box.rows) || []).map(feverNorm).filter(Boolean).map((e) => { const oc = occurrence(e, now); return oc ? { ...e, ocFrom: oc.from, ocTo: oc.to } : null; }).filter(Boolean);
}
function feverLive() {
  const all = feverAll();
  if (!all.length) return null;
  const eff = {};
  for (const e of all) for (const k in e.eff) eff[k] = Math.min(FEVER_CAP[k], (eff[k] || 0) + e.eff[k]);
  return { ...all[0], eff, more: all.length - 1, to: Math.min(...all.map((e) => e.ocTo)), from: all[0].ocFrom };
}
/* 게임 로직이 부르는 값: 효과가 없으면 0 */
function F(k) { const e = feverLive(); return e && e.eff[k] ? e.eff[k] : 0; }
const feverEffText = (e) => Object.keys(e.eff).map((k) => k === "rate" ? `${FEVER_LABEL[k]} +${e.eff[k].toFixed(1)}` : `${FEVER_LABEL[k]} +${Math.round(e.eff[k] * 100)}%`).join(" · ");
function leftText(to) {
  let s = Math.max(0, Math.floor((to - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60);
  return d ? `${d}d ${h}h left` : h ? `${h}h ${m}m left` : m ? `${m}m left` : "Ending soon";
}
async function feverRefresh() {
  try {
    const rows = await fsList("w2fever", 20), now = Date.now();
    wrj(FEVER_KEY, { at: now, rows: rows.filter((r) => +r.to > now).map((r) => ({ id: r.id, emoji: r.emoji, title: r.title, note: r.note, title_en: r.title_en, note_en: r.note_en, from: r.from, to: r.to, eff: r.eff, rep: r.rep, t0: r.t0, t1: r.t1, days: r.days })) });
  } catch {}
  feverTick();
}
function feverTick() {
  const e = feverLive();
  let bar = document.getElementById("fever-bar");
  if (!e) { if (bar) bar.remove(); document.body.classList.remove("fever-on"); return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "fever-bar"; document.body.appendChild(bar); bar.onclick = () => feverAnnounce(e, true); }
  document.body.classList.add("fever-on");
  bar.innerHTML = `<span>${esc(e.emoji)}</span><b>${esc(e.title)}${e.more ? ` +${e.more} more` : ""}</b><em>${feverEffText(e)}</em><small>${leftText(e.to)}</small>`;
  feverAnnounce(e);
}
function feverAnnounce(e, force) {
  const stamp = `${e.id}@${e.from}`;
  if (!force && rdj(FEVER_SEEN) === stamp) return;
  if (!force && !$("modal").hidden) return;   // 다른 창이 열려 있으면 다음 화면 전환 때
  wrj(FEVER_SEEN, stamp);
  modal({ emoji: esc(e.emoji), title: esc(e.title), html: `${e.note ? `<p>${esc(e.note)}</p>` : ""}<p class="fv-big">${feverEffText(e)}</p><p class="small">${leftText(e.to)} · until ${new Date(e.to).toLocaleString("en-US")}</p>`, buttons: [{ label: "Nice!", value: 1, cls: "btn-primary" }] });
}

/* ---------- 📢 공지사항 ---------- */
const NOTICE_KEY = "w2-notices", NOTICE_SEEN = "w2-notice-seen";
async function noticeRefresh() {
  try {
    const rows = (await fsList("w2notices", 30)).filter((r) => !r.hide).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (+b.at || 0) - (+a.at || 0));
    wrj(NOTICE_KEY, rows.slice(0, 20).map((r) => ({ id: r.id, title: r.title, body: r.body, title_en: r.title_en || "", body_en: r.body_en || "", at: +r.at || 0, pin: !!r.pin })));
  } catch {}
  noticeBadge();
}
const notices = () => rdj(NOTICE_KEY) || [];
function noticeUnread() { const seen = rdj(NOTICE_SEEN) || 0; return notices().filter((n) => n.at > seen).length; }
function noticeBadge() {
  const b = document.getElementById("btn-notice");
  if (b) { b.classList.toggle("has-dot", noticeUnread() > 0); b.dataset.n = noticeUnread() || ""; }
  const h = document.querySelector('[data-h="notice"]');
  if (h) h.classList.toggle("has-dot", noticeUnread() > 0);
}
function openNotices() {
  const list = notices().map((n) => window.W2_LANG === "en" && n.title_en ? { ...n, title: n.title_en, body: n.body_en || n.body } : n);
  wrj(NOTICE_SEEN, Math.max(0, ...list.map((n) => n.at)));
  noticeBadge();
  modal({ title: "📢 Notices", wide: true,
    html: list.length ? list.map((n) => `<details class="notice" ${n.pin ? "open" : ""}><summary>${n.pin ? "📌 " : ""}<b>${esc(n.title)}</b> <small>${n.at ? new Date(n.at).toLocaleDateString("en-US") : ""}</small></summary><div>${esc(n.body || "").replace(/\n/g, "<br/>")}</div></details>`).join("") : "<p>No notices yet.</p>",
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }] });
}

/* ---------- 🏛️ 세계 명예의 전당 ---------- */
const HOF_SENT = "w2-hof-sent";
async function hofSubmit(e) {
  try {
    const a = await fbAuth();
    const doc = {
      uid: a.uid, name: String(e.name).slice(0, 12), pos: e.pos, origin: S.origin, diff: S.diff || "normal",
      score: Math.round(e.score), grade: String(e.grade).slice(0, 30), peak: Math.round(e.peak), apps: e.apps | 0, g: e.g | 0, a: e.a | 0,
      ballon: e.ballon | 0, trophies: e.trophies | 0, club: String((S.career.clubs || []).slice(-1)[0] || "").slice(0, 20),
      rival: String(e.rival).slice(0, 12), face: String(S.look.face || ""), kit0: String((e.kit || [])[0] || "#3b7fd6").slice(0, 9), v: VERSION,
    };
    const id = `${a.uid.slice(0, 10)}_${Date.now().toString(36)}`;
    const w = fsDoc(`w2hof/${id}`, doc); w.currentDocument = { exists: false };
    const r = await fbCommit([w], a.tok);
    if (r.ok) { const s = rdj(HOF_SENT) || []; s.push(id); wrj(HOF_SENT, s); }
    return r.ok;
  } catch { return false; }
}
async function hofTop(n = 50) {
  const body = { structuredQuery: { from: [{ collectionId: "w2hof" }], orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }], limit: n } };
  const r = await fbFetch(`${FB_BASE}:runQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 8000);
  if (!r.ok) throw new Error("hof " + r.status);
  return (await r.json()).filter((x) => x.document).map((x) => docObj(x.document));
}
async function openHofWorld() {
  const box = $("hof-list");
  box.innerHTML = `<p class="hint">Loading…</p>`;
  let rows;
  try { rows = await hofTop(50); } catch { box.innerHTML = `<p class="hint">Connection failed. Please try again in a moment.</p>`; return; }
  const mine = new Set(rdj(HOF_SENT) || []);
  const N = (x) => Number.isFinite(+x) ? Math.round(+x) : 0;
  box.innerHTML = rows.length ? rows.map((e, i) => `<div class="hof-row ${mine.has(e.id) ? "me" : ""}"><span>${i + 1}</span><div class="hav" data-w="${i}"></div><div><b>${esc(e.name)} <small>${POS[e.pos] ? POS[e.pos].short : ""} · ${ORIGINS[e.origin] ? ORIGINS[e.origin].flag : ""} · Peak ${N(e.peak)}${DIFF[e.diff] && e.diff !== "normal" ? ` · ${DIFF[e.diff].name}` : ""}</small></b><span>${esc(e.grade)}</span><small>⚽${N(e.g)} 🅰️${N(e.a)} 🏆${N(e.trophies)} 🏅${N(e.ballon)} · ${esc(e.club)}</small></div><em>${N(e.score)}</em></div>`).join("")
    : `<p class="hint">No players registered yet. Be the first legend!</p>`;
  box.querySelectorAll("[data-w]").forEach((d) => { const e = rows[+d.dataset.w]; try { d.appendChild(avatarCanvas({ face: FACE_IDS.includes(e.face) ? e.face : FACE_IDS[0], skin: 0, hair: 0, hairColor: 0, number: 0 }, [/^#[0-9a-f]{3,8}$/i.test(e.kit0) ? e.kit0 : "#3b7fd6", "#ffffff"], 44)); } catch { d.textContent = "⚽"; } });
}

/* ---------- 시작 ---------- */
function onlineStart() {
  feverRefresh(); noticeRefresh();
  setInterval(() => { if (!document.hidden) { feverRefresh(); noticeRefresh(); } }, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) feverTick(); });
}

onlineStart();
