/* 더 윙어 2 운영 페이지: 피버·공지 등록/삭제, 명예의 전당 정리. Firestore 규칙이 관리자 이메일만 쓰기를 허용해요. */
"use strict";
const $ = (id) => document.getElementById(id);
let ADM = null;   // { tok, email, exp }
const enc = (v) => typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : typeof v === "number" ? { doubleValue: v }
  : v && typeof v === "object" ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : { nullValue: null };
const dec = (f) => !f ? null : "stringValue" in f ? f.stringValue : "integerValue" in f ? +f.integerValue : "doubleValue" in f ? f.doubleValue : "booleanValue" in f ? f.booleanValue : "mapValue" in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : "timestampValue" in f ? Date.parse(f.timestampValue) : null;
const objOf = (d) => { const o = {}; for (const k in d.fields || {}) o[k] = dec(d.fields[k]); o.id = d.name.split("/").pop(); return o; };

async function login() {
  const { au, auth } = await fbSdk();
  const res = await au.signInWithPopup(auth, new au.GoogleAuthProvider());
  ADM = { tok: await res.user.getIdToken(), email: res.user.email, user: res.user };
  $("who").textContent = `✅ ${ADM.email}`;
  loadAll();
}
async function tok() { if (!ADM) throw new Error("로그인 필요"); ADM.tok = await ADM.user.getIdToken(); return ADM.tok; }
async function put(path, fields) {
  const t = await tok();
  const w = { update: { name: `projects/${FB.p}/databases/(default)/documents/${path}`, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])) } };
  const r = await fetch(`${FB_BASE}:commit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ writes: [w] }) });
  if (!r.ok) { alert("저장 실패: " + (await r.text()).slice(0, 200)); return false; }
  return true;
}
async function del(path) {
  const t = await tok();
  const r = await fetch(`${FB_BASE}/${path}`, { method: "DELETE", headers: { Authorization: "Bearer " + t } });
  if (!r.ok) alert("삭제 실패 " + r.status);
}
async function listAuth(col) { const t = await tok(); const r = await fetch(`${FB_BASE}/${col}?pageSize=100`, { headers: { Authorization: "Bearer " + t } }); return r.ok ? ((await r.json()).documents || []).map(objOf) : []; }
async function list(col) { const r = await fetch(`${FB_BASE}/${col}?pageSize=50`); return r.ok ? ((await r.json()).documents || []).map(objOf) : []; }
const fmt = (ms) => new Date(ms).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });

async function loadAll() {
  const fv = (await list("w2fever")).sort((a, b) => b.from - a.from);
  $("fv-list").innerHTML = fv.map((e) => `<div class="item"><div>${esc(e.emoji)} <b>${esc(e.title)}</b><br/><span class="small">${fmt(e.from)} ~ ${fmt(e.to)}${e.rep && e.rep !== "none" ? ` · 🔁 ${e.rep === "daily" ? "매일" : "매주 " + [...(e.days || "")].map((d) => "일월화수목금토"[+d]).join("")} ${String(Math.floor(e.t0 / 60)).padStart(2, "0")}:${String(e.t0 % 60).padStart(2, "0")}~${String(Math.floor(e.t1 / 60)).padStart(2, "0")}:${String(e.t1 % 60).padStart(2, "0")}` : ""} · ${Object.entries(e.eff || {}).map(([k, v]) => `${k} ${v}`).join(", ")}${Date.now() > e.to ? " · 종료" : Date.now() >= e.from ? " · 🔴 진행 중" : " · 예정"}</span></div><button class="del" data-del="w2fever/${e.id}">삭제</button></div>`).join("") || `<p class="small">등록된 피버가 없어요</p>`;
  const nt = (await list("w2notices")).sort((a, b) => b.at - a.at);
  $("nt-list").innerHTML = nt.map((n) => `<div class="item"><div>${n.pin ? "📌 " : ""}<b>${esc(n.title)}</b><br/><span class="small">${fmt(n.at)}</span></div><button class="del" data-del="w2notices/${n.id}">삭제</button></div>`).join("") || `<p class="small">등록된 공지가 없어요</p>`;
  const hof = (await list("w2hof")).sort((a, b) => b.score - a.score);
  $("hof-list").innerHTML = hof.map((h) => `<div class="item"><div><b>${esc(h.name)}</b> ${Number(h.score) | 0}점 · ${esc(h.grade)}<br/><span class="small">${esc(h.club)} · ⚽${Number(h.g) | 0} 🅰️${Number(h.a) | 0} · ${esc(h.v)}</span></div><button class="del" data-del="w2hof/${encodeURIComponent(h.id)}">삭제</button></div>`).join("") || "아직 없어요";
  if (ADM) { const q = (await listAuth("w2contact")).sort((a, b) => b.t - a.t);
    $("inq-list").innerHTML = q.length ? q.map((x) => `<div class="item"><div><b>${esc(x.name || "(이름 없음)")}</b> · ${esc(x.contact)} <span class="small">${fmt(x.t)} · ${esc(x.lang)}</span><br/><span style="white-space:pre-wrap">${esc(x.msg)}</span></div><button class="del" data-del="w2contact/${x.id}">삭제</button></div>`).join("") : "<p class='small'>아직 문의가 없어요</p>"; }
  document.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (!confirm("삭제할까요?")) return; await del(b.dataset.del); loadAll(); });
}

$("fv-days").innerHTML = "요일: " + ["일", "월", "화", "수", "목", "금", "토"].map((d, i) => `<label style="display:inline;margin-right:8px"><input type="checkbox" value="${i}" ${i === 0 || i === 6 ? "checked" : ""} style="width:auto"/> ${d}</label>`).join("");
$("login").onclick = () => login().catch((e) => alert("로그인 실패: " + e.message));
const now = new Date(); now.setMinutes(0, 0, 0);
const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
$("fv-from").value = local(now); $("fv-to").value = local(new Date(now.getTime() + 2 * 86400000));
$("fv-save").onclick = async () => {
  const from = Date.parse($("fv-from").value), to = Date.parse($("fv-to").value);
  if (!(to > from)) return alert("끝 시각이 시작보다 늦어야 해요");
  const rep = $("fv-rep").value;
  const hm = (v) => { const [h, m] = (v || "0:0").split(":").map(Number); return h * 60 + m; };
  const t0 = hm($("fv-t0").value), t1 = hm($("fv-t1").value);
  const days = [...document.querySelectorAll("#fv-days input:checked")].map((x) => x.value).join("");
  if (rep !== "none" && t0 === t1) return alert("하루 중 시작과 끝 시각이 같아요");
  if (rep === "weekly" && !days) return alert("요일을 하나 이상 골라 주세요");
  const pct = (id, cap) => Math.min(cap, Math.max(0, (+$(id).value || 0) / 100));
  const eff = { train: pct("fv-train", 1), mast: pct("fv-mast", 1), fame: pct("fv-fame", .5), money: pct("fv-money", .5), rate: Math.min(.4, Math.max(0, +$("fv-rate").value || 0)) };
  for (const k in eff) if (!eff[k]) delete eff[k];
  if (!Object.keys(eff).length) return alert("효과를 하나 이상 넣어 주세요");
  const id = "fv" + from.toString(36);
  if (await put(`w2fever/${id}`, { emoji: $("fv-emoji").value.slice(0, 4) || "🎉", title: $("fv-title").value.slice(0, 40), note: $("fv-note").value.slice(0, 120), title_en: $("fv-title-en").value.slice(0, 40), note_en: $("fv-note-en").value.slice(0, 120), from, to, eff, rep, t0, t1, days })) loadAll();
};
$("nt-save").onclick = async () => {
  const title = $("nt-title").value.trim(); if (!title) return alert("제목을 넣어 주세요");
  const at = Date.now();
  if (await put(`w2notices/n${at.toString(36)}`, { title: title.slice(0, 60), body: $("nt-body").value.slice(0, 2000), title_en: $("nt-title-en").value.slice(0, 60), body_en: $("nt-body-en").value.slice(0, 2000), pin: $("nt-pin").checked, at })) { $("nt-title").value = ""; $("nt-body").value = ""; loadAll(); }
};
loadAll();
