/* 더 윙어 2 : 라이벌 - 게임 본체 */
"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "w2en-save-v1", HOF_KEY = "w2en-hof-v1", TIP_KEY = "w2en-tips";
const SET = JSON.parse(localStorage.getItem("w2-set") || "{}");
const saveSet = () => localStorage.setItem("w2-set", JSON.stringify(SET));
let S = null, busy = false;

const YOUTH_OPP = [["Cheonghae Youth", "#2b7bd6", "#fff"], ["Bukhang Youth", "#222", "#ffd23f"], ["Donglim Academy", "#7a2b4a", "#fff"],
                   ["Seogang Youth", "#e4572e", "#fff"], ["Libera Youth", "#0b5b3a", "#fff"], ["Port Valley Academy", "#5a2a82", "#ffd23f"]];
const DIFF = {
  easy: { name: "Easy", train: 1.15, inj: .6, rival: .92, offer: 3, shot: 1.2, mult: .8 },
  normal: { name: "Normal", train: 1, inj: 1, rival: 1, offer: 0, shot: 1, mult: 1 },
  hard: { name: "Hard", train: .88, inj: 1.3, rival: 1.08, offer: -2, shot: .88, mult: 1.2 },
};
const DF = () => DIFF[(S && S.diff) || "normal"];

/* ---------- 기본 계산 ---------- */
function ovrOf(stats, pos) { const w = POS[pos].w; let s = 0; for (const k in w) s += stats[k] * w[k]; return s; }
const OVR = () => Math.round(ovrOf(S.stats, S.pos));
const ROVR = () => Math.round(ovrOf(S.rival.stats, S.rival.pos));
const talentMul = (stars) => .7 + stars * .15;
const starStr = (n) => "★".repeat(n) + "☆".repeat(5 - n);
function randomName(origin) {
  return origin === "kr" ? pick(KR_GIVEN) + " " + pick(KR_SUR) : pick(EU_FIRST) + " " + pick(EU_LAST);
}
function rollStats(pos) {
  const st = {}, tal = {};
  for (const k of STAT_KEYS) { st[k] = randi(26, 36); tal[k] = rollTalent(); }
  const top = Object.entries(POS[pos].w).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  top.forEach((k) => { st[k] += randi(6, 10); });
  if (!STAT_KEYS.some((k) => tal[k] >= 4)) tal[pick(top)] = 4;
  return { stats: st, talent: tal };
}
function relLabel(rel) {
  return rel <= -40 ? "😡 Nemesis" : rel <= -10 ? "😒 Wary rival" : rel < 10 ? "⚔️ Rival" : rel < 40 ? "🤝 Friendly Rival" : "🫂 Brothers on the Pitch";
}
function fmtMoney(m) { return m >= 100 ? "₩" + (m / 100).toFixed(m >= 1000 ? 0 : 1) + "M" : "₩" + Math.round(m * 10) + "K"; }
function formStr(f) { return f >= 2 ? "🔥 Peak" : f === 1 ? "😊 Good" : f === 0 ? "😐 Neutral" : f === -1 ? "😓 Poor" : "🥶 Awful"; }
function myKit() { return S.phase === "pro" ? S.pro.kit : ORIGINS[S.origin].kit; }
function rivalKit() {
  if (S.rival.club) { const c = clubData(S.rival.league, S.rival.club); if (c) return [c[2], c[3]]; }
  return ORIGINS[S.rival.origin].kit;
}
function clubData(lg, name) { return LEAGUES[lg].clubs.find((c) => c[0] === name); }

/* ---------- 저장 ---------- */
/* 저장은 같은 순간에 여러 번 불려도 한 번만 써요(1MB 가까운 세이브라 폰에서 무거워요). 화면을 떠날 때는 바로 써요 */
let saveTimer = 0;
function save() { if (!S) return; S._ts = Date.now(); if (!saveTimer) saveTimer = setTimeout(flushSave, 0); }
function flushSave() { clearTimeout(saveTimer); saveTimer = 0; if (!S) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} if (typeof cloudAuto === "function") cloudAuto(); }
addEventListener("pagehide", () => { if (saveTimer) flushSave(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && saveTimer) flushSave(); });
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

/* ---------- 화면 / 모달 / 토스트 ---------- */
/* 로딩: 화면을 어둡게 하고 가운데에 엠블럼이 흘러가고 내 선수가 공을 몰고 달려요.
 * 무거운 계산 중에도 멈추지 않게 transform 애니메이션(CSS)만 써요. 다음 창(modal)이나 이적 화면이 뜨면 자동으로 꺼져요 */
function loadingOn(text) {
  let el = document.getElementById("loading");
  if (!el) { el = document.createElement("div"); el.id = "loading"; document.body.appendChild(el); }
  const pool = Object.keys(CREST_ID).filter((n) => CREST_READY.has(CREST_ID[n])).sort(() => Math.random() - .5).slice(0, 9);
  const strip = pool.map((n) => `<span>${crestHTML(n, 40)}</span>`).join("");
  el.innerHTML = `<div class="ld-box"><div class="ld-crests"><div class="ld-strip">${strip}${strip}</div></div>
    <div class="ld-run"><div class="ld-runner"><i class="ld-av"></i><b class="ld-ball">⚽</b></div></div>
    <p class="ld-txt">${text}<em>.</em><em>.</em><em>.</em></p></div>`;
  const av = el.querySelector && el.querySelector(".ld-av");
  if (av) { try { if (S && S.look) av.appendChild(avatarCanvas(S.look, myKit(), 40)); } catch { av.textContent = "🏃"; } }
  el.hidden = false;
  // 화면에 한 번 그려질 때까지 기다려요. 백그라운드 탭처럼 그리기가 멈춰도 0.15초 뒤엔 넘어가요
  return new Promise((r) => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fin, 30))); setTimeout(fin, 150); });
}
function loadingOff() { const el = document.getElementById("loading"); if (el) el.hidden = true; }
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
  if (typeof Bgm !== "undefined") Bgm.set(id === "scr-match" ? "match" : "menu");
  if (typeof feverTick === "function") feverTick();
  if (typeof adBanner === "function") adBanner(id);
}
function modal({ emoji = "", title = "", html = "", buttons = [{ label: "OK", value: true, cls: "btn-primary" }], wide = false, img = "", grid = false }) {
  return new Promise((resolve) => {
    const m = $("modal");
    loadingOff();
    // 이미 떠 있는 창을 다시 그리면(탭 전환 등) 깜빡이지 않게: 애니메이션 없이, 스크롤 위치 유지
    const keep = !m.hidden && m.querySelector(".mbox");
    const prevTop = keep ? m.querySelector(".mbox").scrollTop : 0, prevLeft = keep ? [...m.querySelectorAll(".seg")].map((s) => s.scrollLeft) : [];
    m.innerHTML = `<div class="mbox ${wide ? "wide" : ""}">${img ? `<img class="m-img" src="${img}" alt="" />` : emoji ? `<div class="m-emoji">${emoji}</div>` : ""}${title ? `<h3>${title}</h3>` : ""}<div class="m-html">${html}</div>
      <div class="m-btns${grid ? " grid" : ""}">${buttons.map((b, i) => `<button class="btn ${b.cls || "btn-ghost"}" data-i="${i}">${b.label}${b.hint ? `<small>${b.hint}</small>` : ""}</button>`).join("")}</div></div>`;
    m.hidden = false;
    if (keep) { const bx = m.querySelector(".mbox"); bx.classList.add("still"); bx.scrollTop = prevTop; m.querySelectorAll(".seg").forEach((s, i) => { if (prevLeft[i]) s.scrollLeft = prevLeft[i]; }); }
    m.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { Sfx.tap(); m.hidden = true; m.innerHTML = ""; resolve(buttons[+b.dataset.i].value); });
  });
}
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast"); t.innerHTML = msg; t.hidden = false; t.onclick = () => (t.hidden = true);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
/* 처음 한 번만 뜨는 코치 한마디 — 시스템을 한꺼번에 설명하지 않고 필요할 때 하나씩 */
function tip(id, text) {
  const seen = JSON.parse(localStorage.getItem(TIP_KEY) || "{}");
  if (seen[id]) return Promise.resolve();
  seen[id] = 1; localStorage.setItem(TIP_KEY, JSON.stringify(seen));
  // 줄(<br/>)과 문장 끝마다 한 칸씩 나눠 카드 목록으로 보여줘요 (가운데 정렬 긴 문단은 폰에서 읽기 힘듦)
  const items = text.split(/<br\s*\/?>/).map(s => s.trim()).filter(Boolean)
    .flatMap(s => s.split(/(?<=[.!?。])\s+(?=\S)/)).map(s => s.trim()).filter(Boolean);
  return modal({ emoji: "🧑‍🏫", title: "Coach's Tip", html: `<ul class="tip-list">${items.map(s => `<li>${s}</li>`).join("")}</ul>`, buttons: [{ label: "Got it", value: 1, cls: "btn-primary" }] });
}
function addLog(msg) {
  const when = S.phase === "youth" ? `Year ${S.year} · Month ${S.month}` : `Season ${S.pro.season} R${Math.min(S.pro.round + 1, ROUNDS)}`;
  S.log.unshift(`<span>${when}</span> ${msg}`); if (S.log.length > 40) S.log.length = 40;
}

/* ---------- 타이틀 ---------- */
function initTitle() {
  if (saveTimer) flushSave();
  const sv = load();
  $("btn-continue").hidden = !sv || sv.phase === "retired";
  if (sv && sv.phase !== "retired") {
    $("btn-continue").innerHTML = `Continue <small>${esc(sv.name)} · ${sv.phase === "youth" ? `Youth Year ${sv.year}` : `${sv.pro.club} Season ${sv.pro.season}`}</small>`;
  }
  // 이어할 진행이 있으면 이어하기가 주 버튼, 새로 만들기는 아래로
  const hasSave = !$("btn-continue").hidden, bn = $("btn-new"), bc = $("btn-continue");
  bc.className = `btn ${hasSave ? "btn-primary" : "btn-ghost"}`; bn.className = `btn ${hasSave ? "btn-ghost" : "btn-primary"}`;
  if (hasSave && bn.nextElementSibling === bc) bn.parentNode.insertBefore(bc, bn);
  if (!hasSave && bc.nextElementSibling === bn) bc.parentNode.insertBefore(bn, bc);
  $("ver").textContent = VERSION;
  show("scr-title");
}
function drawTitleArt() {
  const c = $("title-art"), ctx = c.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = 300 * dpr; c.height = 150 * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, 300, 150);
  drawAvatar(ctx, 85, 8, 136, { skin: 1, hair: 1, hairColor: 0, number: 7 }, ["#2a62c9", "#fff"], { mood: "joy" });
  drawAvatar(ctx, 215, 8, 136, { skin: 2, hair: 4, hairColor: 4, number: 9 }, ["#c62f3a", "#111"], { mood: "smug" });
  ctx.font = "bold 30px Jua, sans-serif"; ctx.fillStyle = "#ffe45a"; ctx.textAlign = "center";
  ctx.strokeStyle = "#0b1e14"; ctx.lineWidth = 5; ctx.strokeText("VS", 150, 92); ctx.fillText("VS", 150, 92);
}

/* ---------- 선수 만들기 ---------- */
const C = { step: 1, diff: "normal", name: "", pos: "wg", foot: "R", look: { skin: 1, hair: 0, hairColor: 0, number: 11 }, origin: null, roll: null };
function startCreate() {
  C.step = 1; C.name = randomName("kr"); C.pos = "wg"; C.foot = "R";
  C.look = { skin: randi(0, 3), hair: randi(0, 4), hairColor: randi(0, 2), number: 11, face: pick(FACE_IDS.slice(0, 6)) };
  C.origin = null; C.roll = rollStats(C.pos);
  renderCreate(); show("scr-create");
}
function renderCreate() {
  const el = $("create-body");
  $("create-step").textContent = `${C.step} / 3`;
  if (C.step === 1) {
    el.innerHTML = `
      <h2>✏️ Player Registration</h2>
      <div class="name-row"><input id="in-name" maxlength="8" value="${esc(C.name)}" placeholder="Name"/><button class="btn btn-ghost sm" id="b-rname">🎲</button></div>
      <p class="label">Position</p>
      <div class="pos-grid">${Object.entries(POS).map(([k, p]) => `<button class="card ${C.pos === k ? "on" : ""}" data-pos="${k}"><b>${p.emoji} ${p.name}</b><small>${p.desc}</small></button>`).join("")}</div>
      <p class="label">Strong foot</p>
      <div class="seg">${[["L", "Left"], ["R", "Right"]].map(([k, n]) => `<button class="${C.foot === k ? "on" : ""}" data-foot="${k}">${n}</button>`).join("")}</div>
      <p class="label">Difficulty</p>
      <div class="seg">${Object.entries(DIFF).map(([k, d]) => `<button class="${C.diff === k ? "on" : ""}" data-diff="${k}">${d.name}</button>`).join("")}</div>
      <p class="small">${C.diff === "easy" ? "Faster growth and fewer injuries. Recommended for first-timers" : C.diff === "hard" ? "Slower growth and a tougher rival. Reaching the world's top is really hard" : "Like real football, you grow as much as your effort and choices"}</p>
      <p class="label">Natural Talent <small>(More stars = that stat grows faster)</small></p>
      <div class="roll">${STATS.map((s) => `<div><span>${s.emoji} ${s.name}</span><b>${C.roll.stats[s.key]}</b><i class="${C.roll.talent[s.key] === 5 ? "t5" : ""}">${starStr(C.roll.talent[s.key])}</i></div>`).join("")}</div>
      <button class="btn btn-ghost" id="b-reroll">🎲 Reroll Talent</button>
      <button class="btn btn-primary" id="b-next">Next: Customize Look →</button>`;
    $("in-name").oninput = (e) => (C.name = e.target.value.trim());
    $("b-rname").onclick = () => { C.name = randomName("kr"); renderCreate(); };
    el.querySelectorAll("[data-pos]").forEach((b) => b.onclick = () => { C.pos = b.dataset.pos; C.roll = rollStats(C.pos); renderCreate(); });
    el.querySelectorAll("[data-foot]").forEach((b) => b.onclick = () => { C.foot = b.dataset.foot; renderCreate(); });
    el.querySelectorAll("[data-diff]").forEach((b) => b.onclick = () => { C.diff = b.dataset.diff; renderCreate(); });
    $("b-reroll").onclick = () => { C.roll = rollStats(C.pos); Sfx.tap(); renderCreate(); };
    $("b-next").onclick = () => { if (!C.name) { toast("Please enter a name"); return; } C.step = 2; renderCreate(); };
  } else if (C.step === 2) {
    el.innerHTML = `
      <h2>🎨 My Player's Face</h2>
      <div class="av-preview" id="av-prev"></div>
      <p class="label">Choose a face <small>(Kit changes to your club's colors)</small></p>
      <div class="face-grid">${FACE_IDS.map((id) => `<button class="face-pick ${C.look.face === id ? "on" : ""}" data-face="${id}"></button>`).join("")}</div>
      <p class="label">Shirt number</p><div class="num-row"><button class="btn btn-ghost sm" id="n-m">－</button><b id="n-v">${C.look.number}</b><button class="btn btn-ghost sm" id="n-p">＋</button></div>
      <button class="btn btn-primary" id="b-next">Next: Pick a Youth Club →</button>
      <button class="btn btn-ghost" id="b-back">← Back</button>`;
    $("av-prev").appendChild(avatarCanvas(C.look, ["#2a62c9", "#fff"], 150, { mood: "joy" }));
    el.querySelectorAll("[data-face]").forEach((b) => b.appendChild(avatarCanvas({ ...C.look, face: b.dataset.face }, ["#2a62c9", "#fff"], 64)));
    el.querySelectorAll("[data-face]").forEach((b) => b.onclick = () => { C.look.face = b.dataset.face; Sfx.tap(); renderCreate(); });
    $("n-m").onclick = () => { C.look.number = C.look.number <= 1 ? 99 : C.look.number - 1; renderCreate(); };
    $("n-p").onclick = () => { C.look.number = C.look.number >= 99 ? 1 : C.look.number + 1; renderCreate(); };
    $("b-next").onclick = () => { C.step = 3; renderCreate(); };
    $("b-back").onclick = () => { C.step = 1; renderCreate(); };
  } else {
    el.innerHTML = `
      <h2>🏟️ Where will you start?</h2>
      <p class="hint">Each youth academy grows different stats.</p>
      <div class="org-grid">${Object.entries(ORIGINS).map(([k, o]) => {
        const best = Object.entries(o.mul).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => STAT_NAME[s]).join("·");
        return `<button class="card org ${C.origin === k ? "on" : ""}" data-org="${k}"><span class="flag">${o.flag}</span><b>${o.name}</b><em>${o.tag}</em><small>${o.desc}</small><i>Grows fast: ${best}</i></button>`;
      }).join("")}</div>
      <button class="btn btn-primary" id="b-next" ${C.origin ? "" : "disabled"}>Join ⚽</button>
      <button class="btn btn-ghost" id="b-back">← Back</button>`;
    el.querySelectorAll("[data-org]").forEach((b) => b.onclick = () => { C.origin = b.dataset.org; renderCreate(); });
    $("b-next").onclick = () => { if (C.origin) newGame(); };
    $("b-back").onclick = () => { C.step = 2; renderCreate(); };
  }
}

function makeRival() {
  const origin = pick(Object.keys(ORIGINS).filter((k) => k !== C.origin));
  const pos = Math.random() < .6 ? C.pos : pick(Object.keys(POS).filter((k) => k !== C.pos));
  const r = rollStats(pos);
  // 시작 실력은 나보다 살짝 위 — 첫 목표가 생겨요
  const myO = ovrOf(C.roll.stats, C.pos);
  for (let i = 0; i < 40 && ovrOf(r.stats, pos) < myO + 2; i++) r.stats[mainStatOf(pos)] += 1;
  const type = pick(RIVAL_TYPES);
  return {
    name: randomName(origin), origin, pos, type: type.id, stats: r.stats, talent: r.talent,
    look: { skin: randi(0, 4), hair: randi(0, 5), hairColor: randi(0, 6), number: pick([7, 9, 10, 17, 19, 23]), face: pick(FACE_IDS.filter((f) => f !== C.look.face && (origin === "kr" ? true : !["p01", "p02", "p14", "p18"].includes(f)))) },
    rel: 0, age: 16, league: null, club: null, season: { g: 0, a: 0, r: [], apps: 0 },
    career: { g: 0, a: 0, trophies: 0, ballon: 0, awards: [] }, hurt: 0,
  };
}

function newGame() {
  applyMem(null);
  S = {
    v: 4, diff: C.diff, name: C.name, pos: C.pos, foot: C.foot, look: { ...C.look }, origin: C.origin,
    stats: { ...C.roll.stats }, talent: { ...C.roll.talent },
    cond: 85, form: 0, fame: 0, money: 0, age: 16, phase: "youth", year: 1, month: 1, turn: 0,
    buff: 1, injured: 0, gear: Object.fromEntries(SHOP2.map((x) => [x.id, 0])), shopOpen: false, trust: 50,
    log: [], ev: {}, flags: {}, pending: null,
    youth: { trophies: 0, apps: 0, g: 0, a: 0, ratings: [] },
    rival: makeRival(), h2h: { w: 0, d: 0, l: 0 },
    pro: null, clubStr: null,
    career: { apps: 0, g: 0, a: 0, mom: 0, trophies: [], awards: [], seasons: [], peakOvr: 0, peakTier: 0, ballon: 0, ballonTop3: 0, caps: 0 },
    stars: WORLD_STARS.map(([n, o, a]) => ({ name: n, ovr: o, age: a })),
  };
  W = null;
  addLog(`⚽ Joined ${ORIGINS[S.origin].name}! ${S.name}'s football journey begins.`);
  if (typeof track === "function") track("game_start", { pos: S.pos, origin: S.origin, diff: S.diff });
  save();
  showRivalIntro();
}

/* ---------- 라이벌 등장 ---------- */
function showRivalIntro() {
  const rv = S.rival, t = RIVAL_TYPES.find((x) => x.id === rv.type);
  const el = $("rival-body");
  el.innerHTML = `
    <p class="kicker">First day at the club, in a practice match you meet…</p>
    <h2 class="rv-h">⚔️ Destined Rival</h2>
    <div class="vs-row"><div id="rv-me"></div><b class="vs">VS</b><div id="rv-them"></div></div>
    <div class="rv-card">
      <b>${t.mood} ${esc(rv.name)}</b>
      <span>${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].name} · ${POS[rv.pos].name} · ${t.name}</span>
      <q>${t.quote}</q>
      <div class="cmp"><span>Me ${OVR()}</span><span>OVR</span><span>${ROVR()} ${esc(rv.name)}</span></div>
    </div>
    <p class="hint">This player will grow alongside you until retirement.<br/>You'll keep meeting in tournaments, in the league, and at the Ballon d'Or.</p>
    <button class="btn btn-primary" id="b-accept">🔥 Bring it on</button>`;
  $("rv-me").appendChild(avatarCanvas(S.look, myKit(), 110, { mood: "angry" }));
  $("rv-them").appendChild(avatarCanvas(rv.look, ORIGINS[rv.origin].kit, 110, { mood: "smug" }));
  $("b-accept").onclick = async () => {
    show("scr-main"); renderMain();
    await tip("t-start", "Pick one training each month. Training raises stats and <b>lowers Condition</b>.<br/>Low Condition reduces training efficiency, and <b>below 30 you risk injury</b>.<br/>Check the 📅 schedule at the top for months left until the next tournament.");
  };
  show("scr-rival");
}

/* ---------- 메인 화면 ---------- */
function nextScheduleText() {
  if (S.phase === "youth") {
    const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
    const name = S.month <= 6 ? "Spring Youth League" : (S.year === 3 ? "Youth Championship (Pro scouts gather)" : "Youth Championship");
    return { left, name, text: left === 0 ? `🏆 Right after this month's training: <b>${name}</b>` : `📅 ${left} month(s) until <b>${name}</b>` };
  }
  const opp = S.pro.schedule[S.pro.round];
  const rivalMatch = S.rival.club === opp;
  return { left: 0, name: opp, text: `📅 R${S.pro.round + 1}/${ROUNDS} Next: <b>${esc(opp)}</b> (Str ${Math.round(clubStr(S.pro.league, opp))})${rivalMatch ? ` <em class="rv">⚔️ Rival Match</em>` : ""}` };
}
function trainPreview(k) {
  if (atCapOf(k)) return trOf(k) < 3 ? (S.bold ? T(`🔥 ${boldCh(transChance(k))}% · 실패 −1`, `🔥 ${boldCh(transChance(k))}% · fail −1`) : T(`🌌 성공 ${transChance(k)}%`, `🌌 ${transChance(k)}% chance`)) : T("다음 경기 +5", "+5 next match");
  const g = trainGain(k, true);
  return `+${g[0].toFixed(1)}~${g[1].toFixed(1)}`;
}
function injuryRisk() {
  if (S.phase === "youth" && S.turn < 6) return 0;
  const c = S.cond - trainCost();
  return c >= 30 ? 0 : Math.round(clamp((30 - c) * 1.6 * ORIGINS[S.origin].injury * DF().inj, 0, 60));
}
function trainCost() { return Math.round(14 - S.stats.sta / 25 - S.gear.recovery * 2); }
function ageMul() {
  if (S.phase === "youth") return 1;
  return S.age <= 22 ? .9 : S.age <= 25 ? .7 : S.age <= 28 ? .45 : S.age <= 30 ? .3 : .15;
}
function trainGain(k, range = false) {
  const base = talentMul(S.talent[k]) * (S.phase === "youth" ? ORIGINS[S.origin].mul[k] : 1 + (ORIGINS[S.origin].mul[k] - 1) * .5)
    * ageMul() * (1 + S.gear.trainer * .1 + G("gps") * .06) * (S.cond >= 50 ? 1 : S.cond >= 25 ? .8 : .6) * (S.buff || 1)
    * DF().train * (S.phase === "pro" ? .65 : 1) * (1 + (typeof F === "function" ? F("train") : 0));
  const v = S.stats[k], dim = v >= 95 ? .25 : v >= 88 ? .4 : v >= 80 ? .6 : v >= 72 ? .85 : 1;
  // 한 능력치만 너무 앞서 나가면 잘 안 늘어요 (기초가 받쳐줘야 해요)
  const rel = v - ovrOf(S.stats, S.pos), relDim = rel > 25 ? .3 : rel > 15 ? .6 : 1;
  if (range) return [2.2 * base * dim * relDim, 3.8 * base * dim * relDim];
  return rand(2.2, 3.8) * base * dim * relDim;
}

/* 종합에 가장 많이 보탬이 되는 훈련 — 자동 진행·빠른 시즌이 써요 */
/* 훈련 버튼 이름: 최대치면 🌌 초월 도전, 초월 III까지 끝났으면 🎯 감각 훈련 */
function trainName(s) { return atCapOf(s.key) ? (trOf(s.key) < 3 ? T(`${s.name} 초월 도전`, `${s.name} Breakthrough`) : T(`${s.name} 감각 훈련`, `${s.name} Sharpness`)) : T(`${s.name} 훈련`, `${s.name} Training`); }
function bestTrainKey() {
  let best = null, bv = -1;
  for (const [k, w] of Object.entries(POS[S.pos].w)) {
    if (w <= 0 || S.stats[k] >= statCap(k)) continue;
    const g = trainGain(k, true), v = w * (g[0] + g[1]) / 2;
    if (v > bv) { bv = v; best = k; }
  }
  if (best) return best;
  const tk = Object.entries(POS[S.pos].w).filter(([k, w]) => w > 0 && trOf(k) < 3).sort((a, b) => b[1] - a[1])[0];
  return tk ? tk[0] : mainStatOf(S.pos);
}

function renderMain() {
  const pro = S.phase === "pro";
  const hud = $("hud");
  hud.innerHTML = `
    <div class="hud-av" id="hud-av"></div>
    <div class="hud-id"><b>${esc(S.name)} ${typeof titleTag === "function" ? titleTag() : ""}<small>${POS[S.pos].short} · age ${S.age}</small></b>
      <span>${pro ? `${crestHTML(S.pro.club, 15)} ${esc(S.pro.club)}` : `${ORIGINS[S.origin].flag} ${ORIGINS[S.origin].team}`} · OVR <em>${OVR()}</em></span></div>
    <div class="hud-r"><b>${pro ? `Season ${S.pro.season}` : `Year ${S.year} · Month ${S.month}`}</b><span>💰 ${fmtMoney(S.money)}</span></div>`;
  $("hud-av").appendChild(avatarCanvas(S.look, myKit(), 48));
  const ns = nextScheduleText();
  const warn = (S.phase === "youth" && ns.left <= 1 && S.cond < 55) || (pro && S.cond < 45);
  $("sched").innerHTML = ns.text + (warn ? `<div class="warn">⚠️ Condition is low before the match (${Math.round(S.cond)}). We recommend <b>Rest</b> this turn.</div>` : "");
  $("sched").classList.toggle("warn-on", warn);

  $("gauges").innerHTML = `
    <div class="g"><span>🩹 Condition</span><div class="bar"><i class="${S.cond < 30 ? "low" : S.cond < 55 ? "mid" : ""}" style="width:${S.cond}%"></i></div><b>${Math.round(S.cond)}</b></div>
    <div class="g2"><span>Form ${formStr(S.form)}</span><span title="Fame ${Math.round(S.fame)}">${fameGrade(S.fame).name}${fameGrade(S.fame).next ? ` <small>${Math.round(fameGrade(S.fame).pct * 100)}%</small>` : ""}</span>${pro && S.trust != null ? `<span>👔 ${trustLabel()}</span>` : ""}${S.buff > 1 ? `<span class="buff">🔥 Next training ×${S.buff}</span>` : ""}${S.injured ? `<span class="inj">🤕 Injury ${S.injured} turns</span>` : ""}</div>${pro && contractLine() ? `<div class="g3">${contractLine()}</div>` : ""}`;
  checkFameUp();

  // 라이벌 카드
  const rv = S.rival, my = OVR(), ro = ROVR(), diff = my - ro;
  const rvLine = pro && rv.club
    ? `${LEAGUES[rv.league].flag} ${esc(rv.club)} · Season ⚽${rvS().g} 🅰️${rvS().a} <small>(Me ⚽${S.pro.s.g} 🅰️${S.pro.s.a})</small>`
    : `${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].team} · ${POS[rv.pos].name}`;
  $("rival-card").innerHTML = `
    <div class="rc-av" id="rc-av"></div>
    <div class="rc-mid"><b>${esc(rv.name)} <small>${relLabel(rv.rel)}</small></b><span>${rvLine}</span>
      <div class="rc-bar"><i class="me" style="width:${clamp(50 + diff * 3, 8, 92)}%"></i></div>
      <span class="rc-cmp">Me <b>${my}</b> : <b>${ro}</b> Rival ${diff > 0 ? `<em class="up">+${diff} ahead</em>` : diff < 0 ? `<em class="dn">${diff} behind</em>` : "<em>Tied</em>"}</span></div>
    <span class="rc-more">›</span>`;
  $("rc-av").appendChild(avatarCanvas(rv.look, rivalKit(), 46, { mood: diff > 0 ? "angry" : "smug" }));
  const gEl = $("goals"); if (gEl) { const gh = pro && typeof goalsCard === "function" ? goalsCard() : ""; gEl.innerHTML = gh; gEl.hidden = !gh; }
  $("rival-card").onclick = openRival;

  // 능력치
  $("stats").innerHTML = STATS.map((s) => {
    const v = S.stats[s.key], w = POS[S.pos].w[s.key];
    const need = mastNeed(s.key), tgMode = (!need || atCapOf(s.key)) && trOf(s.key) < 3;
    const mp = tgMode ? Math.round(tgOf(s.key)) : need ? Math.round(((S.mast && S.mast[s.key]) || 0) / need * 100) : 100;
    const ttl = tgMode ? T(`초월 게이지 ${mp}% · 성공 ${transChance(s.key)}%`, `Breakthrough gauge ${mp}% · ${transChance(s.key)}% chance`) : need ? T(`숙련 ${(S.mast && S.mast[s.key]) || 0}/${need} (다음: ★${S.talent[s.key] + 1})`, `Mastery ${(S.mast && S.mast[s.key]) || 0}/${need} (next: ★${S.talent[s.key] + 1})`) : T("초월 III 완성", "Transcendence III");
    return `<div class="st ${w >= .2 ? "key" : ""}${tgMode ? " tgm" : ""}" title="${ttl} · ${T("최대치", "max")} ${statCap(s.key)}"><span>${s.emoji} ${s.name}</span><div class="bar"><i style="width:${Math.min(100, v)}%"></i><u style="width:${mp}%"></u></div><b class="${v > 99 ? "over" : ""}">${Math.round(v)}</b><em class="${S.talent[s.key] === 5 ? "t5" : ""}">${talentStr(s.key)}</em></div>`;
  }).join("");
  $("stats").querySelectorAll(".st").forEach((el, i) => el.onclick = () => openMast(STATS[i].key));

  // 행동
  const risk = injuryRisk(), inj = S.injured > 0;
  let html = STATS.map((s) => `<button class="act" data-train="${s.key}" ${inj ? "disabled" : ""}><span>${s.emoji}</span><b>${trainName(s)}</b><small>${trainPreview(s.key)}</small>${risk ? `<i class="risk">Injury ${risk}%</i>` : ""}</button>`).join("");
  html += `<button class="act rest" data-rest="1"><span>${inj ? "🏥" : "🛌"}</span><b>${inj ? "Rehab" : "Rest"}</b><small>Condition +${32 + S.gear.recovery * 8}</small></button>`;
  if (S.phase === "youth") html += `<button class="act auto" data-auto="1" ${inj ? "disabled" : ""}><span>⏩</span><b>Auto-play</b><small>Until next tournament</small></button>`;
  else html += `<button class="act auto" data-auto="1"><span>⏩</span><b>Auto-play</b><small>Until the match</small></button>`;
  const canTr = !inj && STATS.some((s) => atCapOf(s.key) && trOf(s.key) < 3);
  if (canTr) html = `<div class="bold-tg"><span>${T("초월 도전 방식", "Breakthrough mode")}</span><button data-bold="0" class="${S.bold ? "" : "on"}">🌌 ${T("안전", "Safe")}<small>${T("실패해도 손해 없음", "no loss on fail")}</small></button><button data-bold="1" class="${S.bold ? "on bold" : ""}">🔥 ${T("모험", "Bold")}<small>${T("확률 2배 · 실패 시 −1", "2x odds · −1 on fail")}</small></button></div>` + html;
  const ready = pro && S.pending === "match";
  if (ready) {
    const opp = S.pro.schedule[S.pro.round], home = S.pro.home[S.pro.round];
    html = `<div class="ready"><div class="ready-done">✅ Ready for this round<small>${(S.lastAct && S.lastAct.txt) || ""} · Condition ${Math.round(S.cond)}</small></div>
      <button class="btn btn-primary" id="b-kick">⚽ To the stadium<small>R${S.pro.round + 1} vs ${esc(opp)} · ${home ? "Home" : "Away"}</small></button></div>`;
  }
  $("actions").innerHTML = html;
  if (ready) $("b-kick").onclick = (e) => { if (busy) return; e.currentTarget.disabled = true; proRound(); };
  const yReady = !pro && S.pending === "tournament";
  if (yReady) {
    $("actions").innerHTML = `<div class="ready"><div class="ready-done">${T("✅ 이번 달 준비 끝", "✅ Ready for this month")}<small>${(S.lastAct && S.lastAct.txt) || ""} · ${T("컨디션", "Condition")} ${Math.round(S.cond)}</small></div>
      <button class="btn btn-primary" id="b-tour">${T("🏆 대회장으로", "🏆 To the tournament")}<small>${esc(tourName())}</small></button></div>`;
    $("b-tour").onclick = (e) => { if (busy) return; e.currentTarget.disabled = true; runTournament(); };
    if (S.lastAct && S.lastAct.key) { const i = STATS.findIndex((s) => s.key === S.lastAct.key); const row = $("stats").querySelectorAll(".st")[i]; if (row) row.classList.add("up"); }
  }
  if (ready && S.lastAct && S.lastAct.key) { const i = STATS.findIndex((s) => s.key === S.lastAct.key); const row = $("stats").querySelectorAll(".st")[i]; if (row) row.classList.add("up"); }
  $("actions").querySelectorAll("[data-train]").forEach((b) => b.onclick = () => turn({ kind: "train", key: b.dataset.train }, b));
  $("actions").querySelectorAll("[data-bold]").forEach((b) => b.onclick = () => { S.bold = b.dataset.bold === "1"; if (typeof Sfx !== "undefined") Sfx.tap(); renderMain(); });
  const rs = $("actions").querySelector("[data-rest]"); if (rs) rs.onclick = (e) => turn({ kind: "rest" }, e.currentTarget);
  const au = $("actions").querySelector("[data-auto]"); if (au) au.onclick = openAuto;
  const qk = $("actions").querySelector("[data-quick]"); if (qk) qk.onclick = quickSeason;
  $("actions-title").textContent = ready || yReady ? `Ready for kickoff` : pro ? `Prepare for this round (once before the match)` : `What will you do this month?`;

  const hb = [...(pro ? [["league", "🏆", "World"], ["squad", "👥", "Squad"], ["news", "📰", "News"]] : []), ["career", "📊", "Career"], ["rival", "🆚", "Rival"], ...(S.shopOpen ? [["shop", "🛍️", "Shop"]] : []), ["notice", "📢", "Notices"], ["menu", "⚙️", "Menu"]];
  $("hud-btns").style.setProperty("--n", hb.length);
  $("hud-btns").innerHTML = hb.map(([k, ic, nm]) => `<button data-h="${k}" class="${k === "notice" && typeof noticeUnread === "function" && noticeUnread() ? "has-dot" : ""}"><i>${ic}</i><span>${nm}</span></button>`).join("");
  const nb = $("newsbox");
  if (nb) { nb.hidden = !pro || !(S.news && S.news.length); nb.innerHTML = pro && S.news ? `<b>📰 Football News</b>${S.news.slice(0, 3).map((n) => `<div>${esc(n.m)}</div>`).join("")}` : ""; nb.onclick = openNews; }
  $("hud-btns").querySelectorAll("[data-h]").forEach((b) => b.onclick = () => hudBtn(b.dataset.h));
  $("log").innerHTML = S.log.slice(0, 14).map((l) => `<div>${l}</div>`).join("");
}
function hudBtn(h) {
  if (h === "league") openLeague();
  else if (h === "news") openNews();
  else if (h === "menu") modal({ title: "⚙️ Menu", html: `<p class="small">Difficulty: ${DF().name} · ${VERSION}</p>`, grid: true, buttons: [{ label: "❓ Help", value: "help" }, { label: Sfx.muted ? "🔇 Sound On" : "🔊 Sound Off", value: "snd" }, { label: typeof Bgm !== "undefined" && Bgm.on ? "🎵 Music Off" : "🎵 Music On", value: "bgm" }, { label: "📢 Notices", value: "notice" }, { label: "🏅 Achievements", value: "ach" }, { label: T("🎖️ 칭호", "🎖️ Titles"), value: "titles" }, { label: T("🔗 친구에게 공유", "🔗 Share with friends"), value: "share" }, { label: T("🔒 개인정보처리방침", "🔒 Privacy Policy"), value: "privacy" }, { label: "☁️ Save · Device Transfer", value: "cloud" }, { label: "🏠 To Title", value: "home" }, { label: "Close", value: null, cls: "btn-primary" }] }).then((v) => v && hudBtn(v));
  else if (h === "ach") openAch();
  else if (h === "titles") openTitles();
  else if (h === "cloud") openCloud();
  else if (h === "squad") openSquad();
  else if (h === "career") openCareer();
  else if (h === "rival") openRival();
  else if (h === "shop") openShop();
  else if (h === "help") openHelp();
  else if (h === "snd") { Sfx.toggle(); if (typeof Bgm !== "undefined") Bgm.refresh(); renderMain(); }
  else if (h === "bgm") { Bgm.toggle(); toast(Bgm.on ? "🎵 Music on" : "🎵 Music off"); }
  else if (h === "notice") openNotices();
  else if (h === "share") shareGame();
  else if (h === "privacy") window.open(window.W2_LANG === "en" ? "privacy.html#en" : "privacy.html", "_blank");
  else if (h === "home") { save(); initTitle(); }
}
function floatFx(btn, text, bad) {
  if (!btn) return;
  const r = btn.getBoundingClientRect(), d = document.createElement("div");
  d.className = "float" + (bad ? " bad" : ""); d.textContent = text;
  d.style.left = r.left + r.width / 2 + "px"; d.style.top = r.top + window.scrollY + "px";
  document.body.appendChild(d); setTimeout(() => d.remove(), 1100);
}

/* ---------- 한 턴 ---------- */
function applyAction(a, btn) {
  if (a.kind === "rest") {
    const v = 32 + S.gear.recovery * 8;
    S.cond = clamp(S.cond + v, 0, 100);
    addLog(S.injured ? `🏥 Rehab treatment. Condition +${v}` : `🛌 Had a good rest. Condition +${v}`);
    S.lastAct = { key: null, txt: S.injured ? `🏥 Rehab · Condition +${v}` : `🛌 Rest · Condition +${v}` };
    floatFx(btn, `Condition +${v}`);
    return;
  }
  const k = a.key, risk = injuryRisk();
  const used = S.buff > 1 ? ` (🔥×${S.buff})` : "", em = STATS.find((s) => s.key === k).emoji;
  if (atCapOf(k) && trOf(k) < 3) {
    // 🌌 초월 도전: 실패하면 게이지가 차서 다음 확률이 올라가요 (🔥버프는 게이지 2배, 피버 숙련 보너스도 게이지에)
    const bold = !!S.bold, r = transAttempt(k, S, (S.buff > 1 ? 2 : 1) * (1 + (typeof F === "function" ? F("mast") : 0)), bold);
    S.cond = clamp(S.cond - trainCost() * .5, 0, 100);
    S.buff = 1;
    const txt = r.ok ? T(`🌌 ${STAT_NAME[k]} 초월 성공! (${r.ch}%) ${TRANS_NAME[trOf(k)]} · 최대치 ${statCap(k)}`, `🌌 ${STAT_NAME[k]} breakthrough! (${r.ch}%) ${TRANS_NAME[trOf(k)]} · max ${statCap(k)}`)
      : bold ? T(`🔥 ${STAT_NAME[k]} 모험 실패 (${r.ch}%) · ${STAT_NAME[k]} −1 → ${Math.round(S.stats[k])} · 게이지 ${Math.round(tgOf(k))}%`, `🔥 ${STAT_NAME[k]} bold try failed (${r.ch}%) · ${STAT_NAME[k]} −1 → ${Math.round(S.stats[k])} · gauge ${Math.round(tgOf(k))}%`)
      : T(`${em} ${STAT_NAME[k]} 초월 도전 실패 (${r.ch}%) · 다음 ${r.next}% · 게이지 ${Math.round(tgOf(k))}%`, `${em} ${STAT_NAME[k]} breakthrough failed (${r.ch}%) · next ${r.next}% · gauge ${Math.round(tgOf(k))}%`);
    if (!r.ok) addLog(txt + used);
    S.lastAct = { key: k, txt: txt + used };
    floatFx(btn, r.ok ? T("🌌 초월 성공!", "🌌 Breakthrough!") : bold ? T(`🔥 실패! ${STAT_NAME[k]} −1`, `🔥 Failed! ${STAT_NAME[k]} −1`) : T(`아깝다! 다음 ${r.next}%`, `So close! Next ${r.next}%`));
    if (r.ok && typeof Sfx !== "undefined" && Sfx.goal) Sfx.goal();
  } else if (atCapOf(k)) {
    // 🎯 감각 훈련: 초월 III까지 끝난 능력치는 다음 경기에서만 +5
    S.sharp = S.sharp || {}; S.sharp[k] = 5;
    S.cond = clamp(S.cond - trainCost() * .5, 0, 100);
    S.buff = 1;
    const txt = T(`🎯 ${STAT_NAME[k]} 감각 훈련 · 다음 경기 ${STAT_NAME[k]} +5`, `🎯 ${STAT_NAME[k]} sharpness · +5 ${STAT_NAME[k]} next match`);
    addLog(txt); S.lastAct = { key: k, txt };
    floatFx(btn, T("🎯 다음 경기 +5", "🎯 +5 next match"));
  } else {
    const g = trainGain(k);
    const before = S.stats[k];
    S.stats[k] = clamp(S.stats[k] + g, 1, statCap(k));
    addMast(k, S.buff > 1 ? 2 : 1);
    S.cond = clamp(S.cond - trainCost(), 0, 100);
    S.buff = 1;
    addLog(`${em} ${STAT_NAME[k]} Training +${(S.stats[k] - before).toFixed(1)} → ${Math.round(S.stats[k])}${used}`);
    S.lastAct = { key: k, txt: `${em} ${STAT_NAME[k]} +${(S.stats[k] - before).toFixed(1)} → ${Math.round(S.stats[k])}${used}` };
    floatFx(btn, `${STAT_NAME[k]} +${(S.stats[k] - before).toFixed(1)}`);
  }
  if (risk && Math.random() * 100 < risk * (1 - G("shin") * .2)) {
    S.injured = randi(1, 2);
    S.cond = clamp(S.cond - 10, 0, 100);
    addLog(`🤕 Injured from overtraining! You can only rehab for ${S.injured} turns.`);
    if (S.lastAct) S.lastAct.txt += " · 🤕 Injured";
  }
}
function rivalGrow(scale = 1) {
  const rv = S.rival;
  if (rv.hurt > 0) { if (S.phase !== "pro") rv.hurt--; return; }   // 프로: 부상 결장은 경기 수로 줄어요(tickAvailability)
  const my = OVR(), ro = ROVR();
  const rubber = clamp(1 + (my - ro) / 12, .6, 1.5) * DF().rival * (S.phase === "pro" ? .55 : 1);
  const age = S.phase === "youth" ? 1 : rv.age <= 23 ? .85 : rv.age <= 27 ? .6 : rv.age <= 30 ? .4 : .2;
  const keys = Object.entries(POS[rv.pos].w).filter(([, w]) => w > 0).map(([k]) => k);
  for (let i = 0; i < 2; i++) {
    const k = Math.random() < .7 ? pickWeighted(rv.pos) : pick(keys);
    if (atCapOf(k, rv)) { if (trOf(k, rv) < 3 && Math.random() < .5 * scale) transAttempt(k, rv); continue; }   // 나와 같은 규칙: 최대치면 초월 도전
    const v = rv.stats[k], dim = v >= 92 ? .3 : v >= 85 ? .5 : v >= 75 ? .7 : 1;
    rv.stats[k] = clamp(v + rand(1.6, 3) * talentMul(rv.talent[k]) * rubber * age * dim * scale * .8, 1, statCap(k, rv));
    if (Math.random() < .5 * scale) addMast(k, 1, rv);   // 라이벌도 훈련한 만큼 숙련이 쌓여요
  }
}
function pickWeighted(pos) {
  const ent = Object.entries(POS[pos].w).filter(([, w]) => w > 0);
  let r = Math.random() * ent.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of ent) { if ((r -= w) <= 0) return k; }
  return ent[0][0];
}

async function maybeEvent() {
  if (S.turn < 1) return false;
  const sig = takeSig();
  let ev, d = {};
  if (sig) { ev = { id: sig.k, ...SIG_EVENTS[sig.k] }; d = sig.d || {}; S.ev["sig_" + sig.k] = S.turn; }
  else {
    if (Math.random() > (S.phase === "youth" ? .22 : .13)) return false;
    ev = pickEvent(S);
    if (!ev) return false;
    S.ev[ev.id] = S.turn;
  }
  const choice = await modal({
    emoji: ev.emoji, img: evImg(ev.id), title: `${ev.emoji} ${ev.title}`, html: `${sig ? `<p class="sig-tag">📡 Just happened</p>` : ""}<p class="ev-text">${esc(ev.text(S, d)).replace(/\n/g, "<br/>")}</p>`,
    buttons: ev.choices.map((c, i) => ({ label: c.label, hint: c.hint, value: i, cls: "btn-choice" })),
  });
  S._d = d;
  const out = ev.choices[choice].fx(S);
  delete S._d;
  addLog(`${ev.emoji} ${ev.title}: ${ev.choices[choice].label.replace(/^\S+\s/, "")} → ${out}`);
  await modal({ emoji: ev.emoji, title: "Result", html: `<p class="ev-out">${out.split(" · ").join("<br/>")}</p>`, buttons: [{ label: "Continue", value: 1, cls: "btn-primary" }] });
  return true;
}

/* 행동 하나 → 결과 → (이벤트) → 다음 단계. 반환: "ok" | "stop" (자동 진행이 멈출 이유) */
async function turn(a, btn, fromAuto = false) {
  if (busy) return "stop";
  busy = true;
  try {
    if (S.injured > 0 && a.kind === "train") a = { kind: "rest" };
    const wasInjured = S.injured;
    applyAction(a, btn);
    S.turn++;
    if (!fromAuto) await showAwake(); else if (S.awake) S.awake.length = 0;
    rivalGrow();
    if (G("nutrition")) S.cond = clamp(S.cond + G("nutrition") * 2, 0, 100);
    if (S.money >= 150 && !S.shopOpen) { S.shopOpen = true; addLog("🛍️ The Shop is open!"); }
    renderMain();
    if (!fromAuto) await sleepMs(250);
    const hadEvent = await maybeEvent();
    const newInjury = !wasInjured && S.injured > 0;
    if (S.phase === "youth") {
      const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
      if (left === 0) {
        // 대회 달: 바로 대회로 넘어가지 않고 메인에 "대회장으로" 버튼 (프로의 "경기장으로"와 같은 흐름)
        S.pending = "tournament"; save(); busy = false;
        renderMain(); window.scrollTo({ top: Math.max(0, $("actions").getBoundingClientRect().top + window.scrollY - 220), behavior: "smooth" });
        return "stop";
      }
      nextMonth();
    } else {
      S.pending = "match"; save(); busy = false;
      if (fromAuto) { await proRound(); return "stop"; }
      renderMain(); window.scrollTo({ top: Math.max(0, $("actions").getBoundingClientRect().top + window.scrollY - 220), behavior: "smooth" });
      return "stop";
    }
    save(); renderMain();
    if (S.shopOpen && !S.flags.shopTip) { S.flags.shopTip = 1; await tip("t-shop", "You can spend your savings at the 🛍️ <b>Shop</b>. Gear has permanent effects."); }
    return hadEvent || newInjury ? "stop" : "ok";
  } finally { busy = false; }
}
function nextMonth() {
  S.month++;
  if (S.month > 12) { S.month = 1; S.year++; S.age++; S.rival.age++; }
  S.cond = clamp(S.cond + 4, 0, 100);
  S.money += 5;
  if (S.injured > 0) S.injured--;
}

/* ---------- 자동 진행 (유스) ---------- */
async function openAuto() {
  const keys = Object.entries(POS[S.pos].w).sort((a, b) => b[1] - a[1]).filter(([, w]) => w > 0).map(([k]) => k);
  const v = await modal({
    emoji: "⏩", title: "Auto-play",
    html: S.phase === "pro" ? `<p>Picks this round's training for you and goes straight to the match.<br/>Rests instead if your condition is low or you are injured.</p>` : `<p>Trains and rests on its own until right before the next tournament.<br/>Rests when Condition is low, and stops when an event occurs.</p>`,
    buttons: [{ label: "⚖️ Position Balance", value: "bal", cls: "btn-primary" }, ...keys.slice(0, 4).map((k) => ({ label: `${STATS.find((s) => s.key === k).emoji} ${STAT_NAME[k]} Focus`, value: k })), ...(S.phase === "pro" ? [{ label: `⚡ Fast-forward ${ROUNDS - S.pro.round} rounds (results only)`, value: "quick" }] : []), { label: "Cancel", value: null }],
  });
  if (!v) return;
  if (v === "quick") return quickSeason(true);
  if (S.phase === "pro") {
    let a;
    if (S.injured > 0 || S.cond < 45) a = { kind: "rest" };
    else { let k = v; if (v === "bal" || S.stats[v] >= statCap(v)) k = bestTrainKey(); a = { kind: "train", key: k }; }
    const btn = $("actions").querySelector(a.kind === "rest" ? "[data-rest]" : `[data-train="${a.key}"]`);
    return turn(a, btn, true);
  }
  for (let guard = 0; guard < 13; guard++) {
    if (S.phase !== "youth" || !$("scr-main").classList.contains("active")) break;
    const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
    let a;
    if (S.injured > 0 || S.cond < 42 || (left <= 1 && S.cond < 62)) a = { kind: "rest" };
    else {
      let k = v;
      if (v === "bal" || S.stats[v] >= statCap(v)) k = bestTrainKey();
      a = { kind: "train", key: k };
    }
    const btn = $("actions").querySelector(a.kind === "rest" ? "[data-rest]" : `[data-train="${a.key}"]`);
    const r = await turn(a, btn, true);
    if (r !== "ok") break;
    await sleepMs(320);
  }
}

/* ---------- 경기 공통 ---------- */
/* ---------- 경기 공통 (모든 경기가 world.js 엔진으로) ---------- */
/* 원정 유니폼: 주색·보조색·흰색·검정 중 우리 팀 색과 잔디색에서 가장 먼 걸로 */
function awayKit(home, away) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const d = (a, b) => { const [x, y] = [h(a), h(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  if (d(home[0], away[0]) >= 150) return away;
  const cands = [[away[1], away[0]], ["#f2f2f2", away[0]], ["#111111", away[0]], ["#f6d23a", "#111111"]];
  return cands.map((k) => [k, Math.min(d(k[0], home[0]), d(k[0], "#2a7f44") * 1.2)]).sort((x, y) => y[1] - x[1])[0][0];
}
function kitClash(a, b) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [h(a), h(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110;
}
function teamBadge(T, kit) {
  if (crestId(T.name)) return `<div class="crest-big">${crestHTML(T.name, 66)}</div>`;
  if (T.nat) return `<div class="crest nat">${NATIONS[T.nat].flag}</div>`;
  return `<div class="crest" style="background:${kit[0]};border-color:${kit[1]}">${esc(T.name.slice(0, 1))}</div>`;
}
const tStr = (T) => T.xi.reduce((s, p) => s + pOvr(p), 0) / Math.max(1, T.xi.length);
/* o = { title, sub, mine:팀, opp:팀, mySide:"home"|"away", forceQuick } → { r(내 기준 요약), res(엔진 결과), m } */
async function matchFlow(o) {
  show("scr-match");
  $("mt-title").innerHTML = o.title; $("mt-sub").innerHTML = o.sub || "";
  const meP = o.mine.xi.find((p) => p.id === "me") || o.mine.bench.find((p) => p.id === "me");
  const starter = o.mine.xi.some((p) => p.id === "me");
  const absent = !meP;
  const rvOpp = [...o.opp.xi, ...(o.opp.bench || [])].some((p) => p.id === "rv");
  const rvMate = o.mine.xi.some((p) => p.id === "rv");
  const oppKit = awayKit(o.mine.kit, o.opp.kit);
  const body = $("mt-body");
  const race = o.race;
  body.innerHTML = `
    <div class="pre">
      <div class="pre-vs">
        <div class="pre-team"><div id="pre-me"></div><b>${esc(o.mine.name)}</b><small>${o.mine.form ? `${o.mine.form} · ${STYLES[o.mine.style || "bal"].name} · ` : ""}Str ${Math.round(tStr(o.mine))}</small></div>
        <div class="pre-mid"><b>VS</b></div>
        <div class="pre-team"><div id="pre-opp"></div><b>${esc(o.opp.name)}</b><small>${o.opp.form ? `${o.opp.form} · ${STYLES[o.opp.style || "bal"].name} · ` : ""}Str ${Math.round(tStr(o.opp))}</small></div>
      </div>
      ${rvOpp ? `<div class="pre-rv">⚔️ Rival <b>${esc(S.rival.name)}</b> ${o.opp.xi.some((p) => p.id === "rv") ? "is starting" : "is on the bench"}! H2H ${S.h2h.w}W ${S.h2h.d}D ${S.h2h.l}L</div>` : rvMate ? `<div class="pre-rv">🤝 Rival <b>${esc(S.rival.name)}</b> is on your team</div>` : ""}
      ${race && !absent ? `<div class="pre-race">${race.slots ? `Battle for ${race.slots} ${ROLE_KO[S.pos]} starting spot(s) in ${race.form}` : `⚠️ No ${ROLE_KO[S.pos]} spot in the coach's ${race.form} · competing for another role`} (Start chance ${Math.round(race.p * 100)}%)<b>${race.rivals.slice(0, 3).map((p) => `${esc(p.n)} ${Math.round(pOvr(p))}`).join(" · ")}</b></div>` : ""}
      <div class="pre-info"><div>${absent ? (S.ban > 0 && S.injured <= 0 ? "⛔ Out due to suspension" : "🤕 You'll miss this match") : starter ? "✅ Starting" : "🪑 On the bench · waiting for a sub chance"}</div><div>🩹 Condition ${Math.round(S.cond)} · Form ${formStr(S.form)}</div></div>
      <div class="pre-xi">${o.mine.xi.map((p) => `<span class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}">${ROLE_KO[p.r]} ${esc(p.n)}</span>`).join("")}</div>
      ${S.cond < 45 && !absent ? `<div class="warn">⚠️ Low Condition: you'll play with reduced stats</div>` : ""}
      ${absent ? "" : `<div class="mode-pick"><span>Key moment</span><button data-mode="0" class="${SET.auto ? "" : "on"}">🎮 Manual</button><button data-mode="1" class="${SET.auto ? "on" : ""}">🤖 Auto</button></div>`}
      <button class="btn btn-primary" id="b-watch">${absent ? "📺 See Result" : "▶️ Watch match"}</button>
      ${absent ? "" : `<button class="btn btn-ghost" id="b-quick">⚡ Results only</button>`}
    </div>`;
  // 양쪽 모두 팀 엠블럼 (대표팀은 국기, 유스팀은 유니폼 색). 나·라이벌 얼굴은 엠블럼 옆 작은 배지로
  $("pre-me").innerHTML = teamBadge(o.mine, o.mine.kit);
  $("pre-opp").innerHTML = teamBadge(o.opp, oppKit);
  const meB = document.createElement("div"); meB.className = "pre-face"; meB.appendChild(avatarCanvas(S.look, o.mine.kit, 30, { mood: "angry" })); $("pre-me").appendChild(meB);
  if (rvOpp) { const rB = document.createElement("div"); rB.className = "pre-face rv"; rB.appendChild(avatarCanvas(S.rival.look, oppKit, 30, { mood: "smug" })); $("pre-opp").appendChild(rB); }
  body.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { SET.auto = b.dataset.mode === "1"; saveSet(); Sfx.tap(); body.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b)); });
  const choice = o.forceQuick ? "quick" : await new Promise((res) => {
    $("b-watch").onclick = () => res(absent ? "quick" : "watch");
    const q = $("b-quick"); if (q) q.onclick = () => res("quick");
  });
  const H = o.mySide === "home" ? o.mine : o.opp, A = o.mySide === "home" ? o.opp : o.mine;
  const m = genMatch(H, A);
  if (choice === "watch") {
    body.innerHTML = `<div id="match-root"></div>`;
    if (!SET.seenMini) { SET.seenMini = 1; saveSet(); await tip("t-mini", "When a <b>🔥 Key moment</b> comes during a match, the camera zooms in on your player.<br/><br/>⚽ Shot: aim away from the keeper → power in the green<br/>🏃 Dribble: go the opposite way the defense leans<br/>🎯 Pass: to an open teammate, before offside<br/>🛡️ Tackle: the moment the ball runs too far<br/><br/>Too much hassle? Turn on <b>🤖 Auto key moments</b>."); }
    const mySubs = o.mine.subs.find((s) => s.in.id === "me");
    const rvSide = rvOpp ? "away" : rvMate ? "home" : null;
    await playMatch($("match-root"), {
      home: { name: o.mine.name, kit: o.mine.kit, str: tStr(o.mine) }, away: { name: o.opp.name, kit: oppKit, str: tStr(o.opp) },
      m, mySide: o.mySide, auto: !!SET.auto, diffShot: DIFF[S.diff || "normal"].shot,
      me: { name: S.name, look: S.look, pos: S.pos, stats: S.sharp ? Object.fromEntries(Object.entries(S.stats).map(([k, v]) => [k, v + (S.sharp[k] || 0)])) : S.stats, starter, subMin: mySubs ? mySubs.min : null },
      rival: rvSide ? { name: S.rival.name, pos: S.rival.pos, side: rvSide, number: S.rival.look.number } : null,
      onAutoChange: (v) => { SET.auto = v; saveSet(); },
    });
  } else resolveAuto(m);
  const res = finishMatch(m);
  if (S.sharp && [...res.all.values()].some((x) => x.p.id === "me")) S.sharp = null;   // 🎯 감각 버프는 뛴 경기 한 번만
  const r = summarize(res, m, o.mySide, rvOpp);
  // 내 경고·퇴장·부상 — 프로에서는 징계가 다음 경기로 이어져요
  for (const i of res.cards.filter((x) => x.p.id === "me")) {
    if (i.kind === "inj") { const n = randi(1, 3); S.injured = Math.max(S.injured, n); r.cards.push(`🚑 Injured in the match, out for ${n} games`); addLog(`🚑 Injured during the match, out for ${n} games`); }
    else if (S.phase === "pro") {
      if (i.kind === "yc") { S.ycount = (S.ycount || 0) + 1; r.cards.push(`🟨 Yellow card (${S.ycount} this season)`); if (S.ycount % 5 === 0) { S.ban = Math.max(S.ban || 0, 1); r.cards.push("⛔ 5 yellow cards, suspended for the next match"); } }
      else { S.ban = i.kind === "rc" ? 2 : 1; r.sentOff = true; r.cards.push(`🟥 Sent off! Suspended for the next ${S.ban} games`); addLog(`🟥 Sent off, ${S.ban}-game suspension`); }
    } else r.cards.push(i.kind === "yc" ? "🟨 Yellow card" : "🟥 Sent off");
  }
  return { res, m, r };
}
function summarize(res, m, mySide, rvOpp) {
  const meX = [...res.all.values()].find((x) => x.p.id === "me");
  const gf = mySide === "home" ? res.hg : res.ag, ga = mySide === "home" ? res.ag : res.hg;
  return {
    gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D",
    rating: meX ? res.ratings.get(meX.p) : 0, mom: !!meX && res.mom === meX.p, played: !!meX, mins: meX ? meX.mins : 0,
    goals: meX ? meX.g : 0, assists: meX ? meX.a : 0, saves: meX ? meX.blk : 0,
    moments: m.evs.filter((e) => e.mom && e.res).map((e) => ({ type: e.mom, ok: e.res.ok })),
    rivalGoal: rvOpp && res.goals.some((g) => g.sh.id === "rv"), rvX: [...res.all.values()].find((x) => x.p.id === "rv"),
    goalsList: res.goals, mySide, cards: [],
    my: meX ? { pa: meX.pa, pc: meX.pc, sh: meX.sh, sot: meX.sot, xg: meX.xg, kp: meX.kp + meX.a, da: meX.da, dc: meX.dc, ta: meX.ta, tc: meX.tc, ic: meX.ic, cl: meX.cl, bk: meX.blk, sv: meX.sv, r: meX.p.r, cs: ga === 0 } : null,
    tm: res.team ? (mySide === "home" ? [res.team.home, res.team.away] : [res.team.away, res.team.home]) : null,
  };
}
/* 경기 리포트 표 — 우리 / 상대 */
function teamStatsHTML(tm) {
  if (!tm) return "";
  const [a, b] = tm, pct = (t) => t.pa ? Math.round(t.pc / t.pa * 100) : 0;
  const row = (l, x, y, hi) => `<div class="ts-row"><b class="${hi === 1 ? "hi" : ""}">${x}</b><span>${l}</span><b class="${hi === -1 ? "hi" : ""}">${y}</b></div>`;
  const cmp = (x, y) => x > y ? 1 : x < y ? -1 : 0;
  return `<div class="tstats">${row("Possession", a.pos + "%", b.pos + "%", cmp(a.pos, b.pos))}${row("Shots (on target)", `${a.sh} (${a.sot})`, `${b.sh} (${b.sot})`, cmp(a.sh, b.sh))}${row("Expected goals xG", a.xg.toFixed(1), b.xg.toFixed(1), cmp(a.xg, b.xg))}${row("Passes (accuracy)", `${a.pa} (${pct(a)}%)`, `${b.pa} (${pct(b)}%)`, cmp(pct(a), pct(b)))}${row("Tackles", a.ta, b.ta, cmp(a.ta, b.ta))}</div>`;
}
function myStatsHTML(s) {
  if (!s) return "";
  const c = (v, l) => `<span><b>${v}</b><small>${l}</small></span>`, pp = s.pa ? Math.round(s.pc / s.pa * 100) : 0;
  const cells = {
    pass: c(`${s.pc}/${s.pa}`, `Pass ${pp}%`), shot: c(`${s.sh} (${s.sot})`, "Shots (on target)"), xg: c(s.xg.toFixed(2), "xG"), kp: c(s.kp, "Key passes"),
    dri: c(`${s.dc}/${s.da}`, "Dribbling"), tack: c(`${s.tc}/${s.ta}`, "Tackles"), ic: c(s.ic || 0, "Interceptions"), cl: c(s.cl || 0, "Clearances"), bk: c(s.bk || 0, "Blocks"),
    sv: c(s.sv || 0, "Saves"), cs: c(s.cs ? "✅" : "-", "Clean sheet"),
  };
  const lay = { df: ["tack", "ic", "cl", "bk", "pass", "cs"], gk: ["sv", "cs", "cl", "pass", "ic", "kp"], mf: ["pass", "kp", "tack", "ic", "shot", "dri"] }[s.r] || ["pass", "shot", "xg", "kp", "dri", "tack"];
  return `<div class="mystats">${lay.map((k) => cells[k]).join("")}</div>`;
}

/* 시즌 상세 스탯 한 줄 */
function seasonStatHTML(s, role = S.pos) {
  if (!s || !s.ap) return "";
  if (role === "df" || role === "gk") {
    const pp = s.pa ? Math.round(s.pc / s.pa * 100) : 0;
    return `<div class="mystats"><span><b>${s.tc || 0}/${s.ta || 0}</b><small>Tackles</small></span><span><b>${s.ic || 0}</b><small>Interceptions</small></span><span><b>${s.cl || 0}</b><small>Clearances</small></span><span><b>${s.bk || 0}</b><small>Blocks</small></span><span><b>${s.cs || 0}</b><small>Clean sheets</small></span><span><b>${pp}%</b><small>Pass acc. (${s.pa || 0})</small></span>${s.sv ? `<span><b>${s.sv}</b><small>Saves</small></span>` : ""}</div>`;
  }
  const pp = s.pa ? Math.round(s.pc / s.pa * 100) : 0;
  return `<div class="mystats"><span><b>${pp}%</b><small>Pass acc. (${s.pa})</small></span><span><b>${s.kp || 0}</b><small>Key passes</small></span><span><b>${s.sh || 0} (${s.sot || 0})</b><small>Shots (on target)</small></span><span><b>${((s.xg || 0) / 100).toFixed(1)}</b><small>xG</small></span><span><b>${s.dc || 0}/${s.da || 0}</b><small>Dribbles</small></span><span><b>${s.tc || 0}/${s.ta || 0}</b><small>Tackles</small></span>${s.sv ? `<span><b>${s.sv}</b><small>Saves</small></span>` : ""}</div>`;
}
async function showResult(r, lines, btnLabel = "Continue") {
  const box = document.createElement("div");
  box.className = "result";
  const cls = r.rating >= 8 ? "s" : r.rating >= 7 ? "a" : r.rating >= 6 ? "b" : "c";
  box.innerHTML = `
    <div class="r-score">${r.gf} : ${r.ga} <span>${r.res === "W" ? "Win 🎉" : r.res === "D" ? "Draw 🤝" : "Loss 💧"}</span></div>
    ${r.played ? `<div class="r-rating ${cls}">Rating <b>${r.rating.toFixed(1)}</b>${r.mom ? ` <em>⭐ MOTM</em>` : ""}</div>
    <div class="r-stats">${r.mins} min · ⚽ ${r.goals} · 🅰️ ${r.assists} · 🛡️ ${r.saves} · Key moments ${r.moments.filter((m) => m.ok).length}/${r.moments.length}</div>` : `<div class="r-stats">You didn't get to play</div>`}
    ${myStatsHTML(r.my)}
    ${teamStatsHTML(r.tm)}
    ${r.goalsList.length ? `<div class="r-goals">${r.goalsList.map((g) => { const us = !r.mySide || g.side === r.mySide; return `<div class="gl ${us ? "us" : "them"}"><em>${g.min}'</em><span><i>⚽ ${g.sh.id === "me" ? "<b>" + esc(g.sh.n) + "</b>" : esc(g.sh.n)}</i>${g.as ? `<small>Assist ${g.as.id === "me" ? "<b>" + esc(g.as.n) + "</b>" : esc(g.as.n)}</small>` : ""}</span></div>`; }).join("")}</div>` : ""}
    <div class="r-lines">${lines.map((l) => `<div>${l}</div>`).join("")}</div>
    <button class="btn btn-primary" id="b-res">${btnLabel}</button>`;
  const body = $("mt-body");
  const old = body.querySelector(".result"); if (old) old.remove();
  body.appendChild(box);
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  if (r.mom) Sfx.good();
  await new Promise((res) => ($("b-res").onclick = res));
}
function applyMatch(r, opts = {}) {
  const lines = [];
  if (opts.rival) {
    if (r.res === "W") S.h2h.w++; else if (r.res === "D") S.h2h.d++; else S.h2h.l++;
    lines.push(`⚔️ Rival head-to-head ${S.h2h.w}W ${S.h2h.d}D ${S.h2h.l}L${r.rvX ? ` · ${esc(S.rival.name)} rating ${opts.rvRating ?? "-"}` : ""}`);
    if (r.rivalGoal) lines.push(`😤 ${esc(S.rival.name)} scored against you`);
  }
  lines.push(...(r.cards || []));
  if (!r.played) return lines;
  const prestige = opts.prestige || 1;
  const f = Math.round(((r.rating - 6.3) * 3 + r.goals * 2 + r.assists * 1.5 + (r.mom ? 3 : 0)) * ORIGINS[S.origin].fame * (S.phase === "youth" ? .6 : .6 + prestige * .2) * (opts.big || 1));
  const fb = typeof F === "function" ? F("fame") : 0;
  const f2 = f > 0 && fb ? Math.round(f * (1 + fb)) : f;
  S.fame = Math.max(0, S.fame + f2);
  lines.push(`⭐ Fame ${f2 >= 0 ? "+" : ""}${f2}${f2 !== f ? " 🎉" : ""}`);
  if (r.mom && S.phase === "pro") addMast(mainStatOf(S.pos), 2);
  const pf = S.form;
  if (r.rating >= 7.6) S.form = clamp(S.form + 1, -3, 3); else if (r.rating <= 5.7) S.form = clamp(S.form - 1, -3, 3);
  if (S.form < pf && G("mental") && Math.random() < G("mental") * .25) { S.form = pf; lines.push("🧘 Form held thanks to your mental coach"); }
  if (S.form !== pf) lines.push(`Form ${S.form > pf ? "▲" : "▼"} ${formStr(S.form)}`);
  S.cond = clamp(S.cond - (r.mins >= 60 ? 10 : 4), 0, 100);
  if (typeof achAfterMatch === "function") lines.push(...achAfterMatch(r));
  return lines;
}

/* ---------- 🥅 승부차기 — 내가 키커 명단에 들면 직접 차요 ---------- */
const onAt90 = (T) => onPitchAt(T.xi, T.subs || [], 90, T.off || []);
async function shootoutUI(myOn, oppOn, myName, oppName) {
  const A = pkTakers(myOn), B = pkTakers(oppOn);
  const gA = myOn.find((p) => p.r === "gk") || myOn[0], gB = oppOn.find((p) => p.r === "gk") || oppOn[0];
  const m = $("modal"); m.hidden = false;
  let a = 0, b = 0, drawn = 0; const ra = [], rb = [];
  const dots = (arr) => arr.map((x) => x ? "⚽" : "❌").join(" ") || "·";
  const draw = (msg) => {
    m.innerHTML = `<div class="mbox wide${drawn++ ? " still" : ""}"><h3>🥅 Penalty shoot-out</h3>
      <div class="so"><div class="so-row"><b>${esc(myName)}</b><em>${a}</em><span>${dots(ra)}</span></div>
      <div class="so-row"><b>${esc(oppName)}</b><em>${b}</em><span>${dots(rb)}</span></div></div>
      <p class="so-msg">${msg}</p><div id="so-mg"></div></div>`;
  };
  const decided = (i) => i < 4 ? (a > b + (4 - i) || b > a + (4 - i)) : a !== b;
  for (let i = 0; i < 30; i++) {
    const sh = A[i % A.length];
    draw(`Kicker ${i + 1} · <b>${esc(sh.n)}</b>${sh.id === "me" ? " (Me!)" : ""}`);
    await sleepMs(sh.id === "me" ? 200 : 700);
    let ok;
    if (sh.id === "me") { const x = await MG.shot($("so-mg"), { sho: S.stats.sho, gk: eff(gB, "def"), smart: clamp(.36 / DF().shot, .22, .5), pk: true }); ok = x.ok; }
    else ok = Math.random() < pkP(sh, gB);
    ra.push(ok); if (ok) a++; (ok ? Sfx.good : Sfx.bad)();
    const sb = B[i % B.length], okb = Math.random() < pkP(sb, gA);
    draw(`${esc(sh.n)} ${ok ? "scores ⚽" : "misses ❌"}<br/>${esc(sb.n)} steps up…`);
    await sleepMs(800);
    rb.push(okb); if (okb) b++;
    draw(`${esc(sb.n)} ${okb ? "scores ⚽" : "misses ❌"}`);
    await sleepMs(600);
    if (decided(i)) break;
  }
  draw(a > b ? "🎉 Won the shoot-out!" : "💧 Lost the shoot-out…");
  await new Promise((res) => { const bt = document.createElement("button"); bt.className = "btn btn-primary"; bt.textContent = "Continue"; bt.onclick = res; m.querySelector(".mbox").appendChild(bt); });
  m.hidden = true; m.innerHTML = "";
  return { aWin: a > b, a, b };
}

/* ---------- 유스 대회 (유스 팀도 실제 선수들로) ---------- */
function youthSquad(name, kit, nat, base, extra = []) {
  const used = new Set(), ps = [];
  ROLE_SQUAD.forEach((role, i) => {
    if (extra.some((e) => e.r === role) && i < 11 && ps.filter((p) => p.r === role).length + extra.filter((e) => e.r === role).length >= SLOTS[role]) return;
    const o = base + (i < 11 ? rand(-4, 4) : rand(-9, -3));
    const p = { id: "y" + name + i, n: natName(nat, used), nat, r: role, st: genStats(role, o), a: randi(16, 18), fm: 0, inj: 0 };
    refreshO(p); ps.push(p);
  });
  const all = [...extra, ...ps];
  const xi = bestXI(all), bench = benchOf(all, xi);
  return { name, kit, xi, bench, form: "4-3-3", style: "bal", adv: 0, meBench: bench.some((p) => p.id === "me") };
}
/* 유스 대회: 8팀, 2개 조 풀리그(3경기) → 조 1·2위 4강 → 결승.
 * 조 추첨도, 다른 팀 경기도 전부 같은 엔진으로 돌려요. 라이벌 팀과는 조별리그·4강·결승 어디서든 만날 수 있고, 못 만날 수도 있어요. */
/* 🔭 스카우트 관심도 — 유스 졸업 때 프로 제안을 정하는 점수와 같은 식이에요 (지금 실력 기준) */
function scoutScore() { return OVR() + Math.min(S.fame, 120) / 24 + S.youth.trophies * 1.5 + (S.youth.deep || 0) * .8 + DIFF[S.diff || "normal"].offer; }
function scoutInfo() {
  const sc = scoutScore();
  const all = LEAGUES.flatMap((l) => l.clubs.map((c) => ({ lg: l, club: c[0], str: clubStr(l.id, c[0]) })));
  const watch = all.filter((x) => x.str <= sc + 3 && x.str >= sc - 12).sort((a, b) => b.str - a.str).slice(0, 3);
  const next = all.filter((x) => x.str > sc + 3).sort((a, b) => a.str - b.str)[0];
  return { sc, pct: Math.round(clamp((sc - 40) / 50 * 100, 0, 100)), watch, next, need: next ? Math.max(1, Math.ceil(next.str - 3 - sc)) : 0 };
}
function scoutHTML() {
  const s = scoutInfo(), prev = S.youth.scoutPrev, d = prev == null ? null : s.pct - prev;
  S.youth.scoutPrev = s.pct;
  return `<div class="scout"><div class="sc-h">🔭 Scout interest <b>${s.pct}</b>${d == null ? "" : d > 0 ? `<em class="up">▲ ${d}</em>` : d < 0 ? `<em class="dn">▼ ${-d}</em>` : `<em>-</em>`}</div>
    <div class="sc-bar"><i style="width:${s.pct}%"></i></div>
    <div class="sc-w">${s.watch.length ? "Watching: " + s.watch.map((x) => `${x.lg.flag} ${esc(x.club)}`).join(" · ") : "No clubs watching yet"}</div>
    ${s.next ? `<div class="sc-n">About +${s.need} overall and ${s.next.lg.flag} <b>${esc(s.next.club)}</b> (${s.next.lg.name}) will take notice too</div>` : ""}
    <div class="sc-t">${S.year === 3 && S.month === 12 ? "Pro offers will come soon based on this" : "Rises with your rating, fame and tournament results. Pro offers at youth graduation are decided by it"}</div></div>`;
}
function tourName() { return S.month === 12 ? (S.year === 3 ? "Youth Championship · Pro scouts are watching" : "Youth Championship") : "Spring Youth League"; }
async function runTournament() {
  const final = S.month === 12;
  const name = tourName();
  const base = 38 + S.year * 6;
  const me = { id: "me", n: S.name, r: S.pos }, rv = { id: "rv", n: S.rival.name, r: S.rival.pos };
  const myName = ORIGINS[S.origin].team;
  let rvName = ORIGINS[S.rival.origin].team;
  if (rvName === myName) rvName += " B";
  const info = { [myName]: { kit: ORIGINS[S.origin].kit, nat: ORIGINS[S.origin].nat, o: base + 1, ex: [me] },
    [rvName]: { kit: ORIGINS[S.rival.origin].kit, nat: ORIGINS[S.rival.origin].nat, o: base + 1, ex: [rv] } };
  for (const o of YOUTH_OPP) info[o[0]] = { kit: [o[1], o[2]], nat: pick(["kr", "kr", "jp", "br", "es"]), o: base + rand(-3, 3), ex: [] };
  const pool = {};
  const team = (n) => {
    if (!pool[n]) { const t = youthSquad(n, info[n].kit, info[n].nat, info[n].o, info[n].ex); pool[n] = [...t.xi, ...t.bench]; }
    const xi = bestXI(pool[n]), bench = benchOf(pool[n], xi);
    return { name: n, kit: info[n].kit, xi, bench, form: "4-3-3", style: "bal", adv: 0, meBench: bench.some((p) => p.id === "me") };
  };
  const names = Object.keys(info).sort(() => Math.random() - .5);
  const groups = [names.slice(0, 4), names.slice(4, 8)];
  const myG = groups.findIndex((gp) => gp.includes(myName));
  const tbl = Object.fromEntries(names.map((n) => [n, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  const rec = (h, a, hg, ag) => {
    for (const [x, f, c] of [[h, hg, ag], [a, ag, hg]]) { const t = tbl[x]; t.p++; t.gf += f; t.ga += c; if (f > c) { t.w++; t.pts += 3; } else if (f === c) { t.d++; t.pts++; } else t.l++; }
  };
  const results = [], log = [];
  let metRival = 0;
  /* 한 경기 — 내 경기면 직접, 아니면 시뮬. ko면 비겼을 때 승부차기 */
  const play = async (h, a, label, ko, last) => {
    const mineH = h === myName, mineA = a === myName;
    if (!mineH && !mineA) {
      const H = team(h), A = team(a), res = playAI(H, A);
      let win = res.hg > res.ag ? h : res.ag > res.hg ? a : null, pk = "";
      if (!win && ko) { const so = shootoutAuto(onAt90(res.m.H), onAt90(res.m.A)); win = so.aWin ? h : a; pk = ` (PK ${so.a}:${so.b})`; }
      log.push(`${label} ${h} ${res.hg}:${res.ag} ${a}${pk}`);
      return { hg: res.hg, ag: res.ag, win, pk };
    }
    const opp = mineH ? a : h, rival = opp === rvName;
    if (rival) metRival++;
    const mine = team(myName), oppT = team(opp);
    const { r, res, m } = await matchFlow({ title: `🏆 Year ${S.year} ${name}`, sub: `${label}${rival ? " · ⚔️ Rival team" : ""}`, mine, opp: oppT, mySide: "home" });
    let pk = "", win = r.res === "W" ? myName : r.res === "L" ? opp : null;
    if (!win && ko) {
      const so = await shootoutUI(onAt90(m.H), onAt90(m.A), mine.name, oppT.name);
      win = so.aWin ? myName : opp; r.res = so.aWin ? "W" : "L"; pk = ` (pens ${so.a}:${so.b} ${so.aWin ? "W" : "L"})`;
    }
    const rvRating = rival ? [...res.ratings].find(([p]) => p.id === "rv")?.[1] : null;
    const lines = applyMatch(r, { rival, rvRating });
    if (r.played) { S.youth.apps++; S.youth.g += r.goals; S.youth.a += r.assists; S.youth.ratings.push(r.rating); }
    if (r.mom) { S.money += 20; lines.push("💰 MOTM bonus +₩200K"); }
    results.push({ label, opp, gf: r.gf, ga: r.ga, res: r.res, pk, rating: r.rating, rival });
    log.push(`${label} ${myName} ${r.gf}:${r.ga} ${opp}${pk}`);
    // 조별리그: 내 경기 결과까지 넣은 조 순위 표 (1·2위가 4강)
    if (!ko) {
      rec(h, a, mineH ? r.gf : r.ga, mineH ? r.ga : r.gf);
      const rows = grpRank(groups[myG]).map((n, i) => { const t = tbl[n]; return `<tr class="${n === myName ? "me" : ""}${i < 2 ? " up" : ""}"><td>${i + 1}</td><td class="gt-n">${esc(n)}</td><td>${t.p}</td><td>${t.w}-${t.d}-${t.l}</td><td>${t.gf - t.ga > 0 ? "+" : ""}${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`; }).join("");
      lines.push(`<div class="gt"><div class="gt-h">📋 ${T(`${label} 후 조 순위`, `Group table after ${label}`)} <small>${T("1·2위 4강", "Top 2 to semis")}</small></div><table class="tbl gt-t"><tr><th>#</th><th>${T("팀", "Team")}</th><th>${T("경기", "P")}</th><th>${T("승-무-패", "W-D-L")}</th><th>${T("득실", "GD")}</th><th>${T("승점", "Pts")}</th></tr>${rows}</table></div>`);
    }
    await showResult(r, lines, last ? "Tournament results →" : "Next match →");
    return { hg: mineH ? r.gf : r.ga, ag: mineH ? r.ga : r.gf, win, recd: !ko, pk };
  };
  const grpRank = (gp) => [...gp].sort((x, y) => tbl[y].pts - tbl[x].pts || (tbl[y].gf - tbl[y].ga) - (tbl[x].gf - tbl[x].ga) || tbl[y].gf - tbl[x].gf);
  // 조별리그 3라운드 (같은 라운드의 다른 조 경기도 같이)
  const RR = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
  for (let md = 0; md < 3; md++) {
    for (const gp of groups) {
      const [i, j, k, l] = RR[md];
      for (const [h, a] of [[gp[i], gp[j]], [gp[k], gp[l]]]) {
        const x = await play(h, a, `Group ${"AB"[groups.indexOf(gp)]} · Match ${md + 1}`, false, false);
        if (!x.recd) rec(h, a, x.hg, x.ag);   // 내 경기는 결과 화면에서 이미 반영
      }
    }
  }
  const A = grpRank(groups[0]), B = grpRank(groups[1]);
  const imIn = [A[0], A[1], B[0], B[1]].includes(myName);
  // 4강 → 결승 (내가 떨어져도 끝까지 시뮬)
  const sf = [[A[0], B[1]], [B[0], A[1]]], fin = [];
  const koRes = [];
  for (const [h, a] of sf) { const x = await play(h, a, "Semi-final", true, false); koRes.push({ k: "sf", h, a, ...x }); fin.push(x.win); }
  const fx = await play(fin[0], fin[1], "🏆 Final", true, true);
  koRes.push({ k: "f", h: fin[0], a: fin[1], ...fx });
  const champ = fx.win, runner = champ === fin[0] ? fin[1] : fin[0];
  // 내가 떨어져 결과 화면이 아직 안 나왔으면
  let title, prize, fame;
  if (champ === myName) { title = "🏆 Champions!"; prize = 100; fame = 8; S.youth.trophies++; if (Sfx.fanfare) Sfx.fanfare(); }
  else if (runner === myName) { title = "🥈 Runner-up"; prize = 40; fame = 3; }
  else if (imIn) { title = "🥉 Semi-final"; prize = 25; fame = 2; }
  else { title = `😢 Out in the group stage (#${grpRank(groups[myG]).indexOf(myName) + 1})`; prize = 10; fame = 1; }
  S.money += prize; S.fame += fame;
  if (typeof achToast === "function") achToast();
  S.youth.deep = (S.youth.deep || 0) + (runner === myName ? 1 : imIn && champ !== myName ? .5 : 0);
  const rvRes = champ === rvName ? "Champions" : runner === rvName ? "Runner-up" : fin.includes(rvName) || sf.flat().includes(rvName) ? "Semi-final" : "Group stage exit";
  addLog(`${name} ${title} (💰+${fmtMoney(prize)}, Fame +${fame}) · Rival team ${rvRes}${metRival ? ` · Faced them ${metRival}x` : " · Never faced them"}`);
  const gtab = (gp, k) => `<div class="gt"><div class="gt-h"><b>${T(`${k}조`, `Group ${k}`)}</b></div><table class="tbl gt-t"><tr><th>#</th><th>${T("팀", "Team")}</th><th>${T("승-무-패", "W-D-L")}</th><th>${T("득실", "GD")}</th><th>${T("승점", "Pts")}</th></tr>${grpRank(gp).map((n, i) => { const t = tbl[n]; return `<tr class="${n === myName ? "me" : ""}${i < 2 ? " up" : ""}"><td>${i + 1}</td><td class="gt-n">${esc(n)}${n === rvName ? " ⚔️" : ""}</td><td>${t.w}-${t.d}-${t.l}</td><td>${t.gf - t.ga > 0 ? "+" : ""}${t.gf - t.ga} <small>(${t.gf}:${t.ga})</small></td><td><b>${t.pts}</b></td></tr>`; }).join("")}</table></div>`;
  const koRow = (x) => `<div class="ko-row${x.h === myName || x.a === myName ? " me" : ""}"><span class="${x.win === x.h ? "w" : ""}">${esc(x.h)}${x.h === rvName ? " ⚔️" : ""}</span><b>${x.hg}:${x.ag}${x.pk ? `<small>${esc(x.pk.trim())}</small>` : ""}</b><span class="${x.win === x.a ? "w" : ""}">${esc(x.a)}${x.a === rvName ? " ⚔️" : ""}</span></div>`;
  await modal({
    emoji: title.split(" ")[0], title: `${name} ${title.replace(/^\S+\s/, "")}`, wide: true,
    html: `<div class="tour-sum">${results.map((x) => `<div><span>${x.label}${x.rival ? " ⚔️" : ""}</span><b>${esc(x.opp)}</b><em class="${x.res}">${x.gf}:${x.ga}${x.pk}</em><i>${x.rating ? x.rating.toFixed(1) : "-"}</i></div>`).join("")}</div>
      ${gtab(groups[0], "A")}${gtab(groups[1], "B")}
      <div class="gt"><div class="gt-h"><b>${T("4강", "Semi-finals")}</b></div>${koRes.filter((x) => x.k === "sf").map(koRow).join("")}<div class="gt-h" style="margin-top:8px"><b>${T("🏆 결승", "🏆 Final")}</b></div>${koRes.filter((x) => x.k === "f").map(koRow).join("")}<p class="ko-champ">🏆 ${esc(champ)}${champ === rvName ? " ⚔️" : ""} <small>· ${T("준우승", "Runner-up")} ${esc(runner)}</small></p></div>
      <p class="small">⚔️ Rival team (${esc(rvName)}) ${rvRes}${metRival ? ` · Faced them ${metRival}x this tournament` : " · Didn't meet them this time"}</p>
      <p>💰 +${fmtMoney(prize)} · ⭐ Fame +${fame}</p>
      ${scoutHTML()}`,
  });
  S.pending = null;
  if (typeof adNext === "function" && S.month === 12) { await loadingOn(S.year === 3 ? "Waiting for pro offers" : "Preparing next season"); await adNext("youth_cup"); }
  if (S.year === 3 && S.month === 12) { save(); return youthEnd(); }
  nextMonth(); save();
  loadingOff();
  show("scr-main"); renderMain();
}

/* ---------- 프로 계약 · 이적 ---------- */
function offerList(score, opts = {}) {
  const out = [];
  const TOPSTR = Math.max(...LEAGUES.flatMap((l) => l.clubs.map((c) => clubStr(l.id, c[0]))));   // 세계 최강 팀 전력
  // 보통은 내 점수 -12 ~ +3 팀이 제안해요. 내가 세계 최강 팀보다 훨씬 잘하면 그 범위에 팀이 없으니 최상위 팀들이 제안해요
  let LO = score - 12, HI = score + 3;
  if (LO > TOPSTR - 6) { LO = TOPSTR - 6; HI = Infinity; }
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const str = clubStr(lg.id, c[0]);
    if (opts.exclude && c[0] === opts.exclude) continue;
    if (str <= HI && str >= LO) out.push({ league: lg.id, club: c[0], str, kit: [c[2], c[3]] });
  }
  out.sort((a, b) => b.str - a.str);
  const n = opts.agent ? 4 : 3;
  const list = out.slice(0, n - 1);
  const rest = out.slice(n - 1);
  if (rest.length) list.push(pick(rest));
  if (!list.length && !opts.transfer) {
    const all = LEAGUES.filter((l) => l.tier === 1).flatMap((l) => l.clubs.map((c) => ({ league: l.id, club: c[0], str: clubStr(l.id, c[0]), kit: [c[2], c[3]] })));
    list.push(all.sort((a, b) => a.str - b.str)[0]);
  }
  return list;
}
function starterProb(club) {
  if (!W || !W.c[club]) return .5;
  const inj = S.injured, ban = S.ban; S.injured = 0; S.ban = 0;   // 오프시즌·다음 시즌 기준으로 계산
  try { return startChance(club, "me", 30); } finally { S.injured = inj; S.ban = ban; }
}
/* 감독 한 줄 + 포메이션 그림 */
function coachLine(club) { const co = coachOf(club); return `👔 ${esc(co.n)} ${NATIONS[co.nat] ? NATIONS[co.nat].flag : ""} · <b>${co.f}</b> · ${STYLES[co.s].name}`; }
function formationHTML(club, xi) {
  const F = FORMS[formOf(club)];
  return `<div class="fpitch">${xi.map((p, i) => { const [x, y] = F.pos[i] || [.5, .5];
    return `<span class="fdot ${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}" style="left:${8 + x * 84 / .72}%;top:${y * 100}%"><i>${p.id === "me" ? S.look.number : p.id === "rv" ? S.rival.look.number : p.no || ""}</i><em>${esc(p.n.includes(" ") ? p.n.split(" ").slice(-1)[0] : p.n)}</em></span>`; }).join("")}</div>`;
}
function salaryOf(lg) { const c = S.contract; return c && S.pro && c.club === S.pro.club ? c.sal : Math.round(LEAGUES[lg].pay * Math.pow(OVR() / 65, 2)); }
function rivalPickClub() {
  const rv = S.rival, o = ROVR() + Math.min(3, rv.career.trophies);
  let best = null;
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    if (S.pro && c[0] === S.pro.club && Math.random() < .5) continue;
    const str = clubStr(lg.id, c[0]);
    if (str > o + 2) continue;
    if (!best || str > best.str || (str === best.str && Math.random() < .5)) best = { league: lg.id, club: c[0], str };
  }
  if (!best) { const l = LEAGUES[pick([0, 1])]; const w = [...l.clubs].sort((a, b) => a[1] - b[1])[0]; best = { league: l.id, club: w[0] }; }
  rv.league = best.league; rv.club = best.club;
  moveToClub("rv", best.club);
}
function ensureWorld() {
  if (S.world && S.world.p && S.world.p.me && S.world.p.me.cs) { W = S.world; if (ensureDiv2()) save(); ensureCoaches(); return; }
  // 옛 세이브(v0.3 이하): 새 세계를 깔고 이번 시즌을 처음부터
  const keepClub = S.pro && S.pro.club;
  initWorld(); initLeagues(); initCups(null);
  if (S.phase === "pro") {
    const lgId = LEAGUES.findIndex((l) => l.clubs.some((c) => c[0] === keepClub));
    const club = lgId >= 0 ? keepClub : LEAGUES[0].clubs[0][0];
    joinClub({ league: lgId >= 0 ? lgId : 0, club });
    rivalPickClub();
    Object.assign(S.pro, { round: 0, s: { apps: 0, starts: 0, g: 0, a: 0, ratings: [], mom: 0 } });
    setSchedule();
    S.pending = null;
  }
}

async function youthEnd() {
  S.pending = "offers";
  if (!S.world || !S.world.p || !S.world.p.me || !S.world.p.me.cs) { initWorld(); initLeagues(); initCups(null); }
  W = S.world;
  if (!W.p.rv.c) rivalPickClub();
  save();
  const score = scoutScore();
  const offers = offerList(score, { agent: G("agent") > 0 });
  if (!offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 10) {
    const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] });
  }
  const pick1 = await offerScreen({
    title: "✍️ Pro contract offers",
    hint: `3 youth years done! OVR ${OVR()} · ${fameGrade(S.fame).name} · ${S.youth.trophies} titles<br/>Rival <b>${esc(josa(S.rival.name, "은/는"))}</b> looks set to join <b>${LEAGUES[S.rival.league].flag} ${esc(S.rival.club)}</b>.`,
    offers, stay: null,
  });
  S.phase = "pro"; S.age = 19; S.rival.age = 19;
  S.pro = S.pro || {};
  joinClub(pick1);
  S.pro.season = 1; S.pro.round = 0;
  await negotiate(pick1, `✍️ First pro contract with ${esc(pick1.club)}`);
  S.pro.season = 1; initSeason(true);
  addLog(`✍️ Joined ${LEAGUES[pick1.league].flag} ${pick1.club}! Your pro debut season begins.`);
  if (typeof track === "function") track("pro_debut", { tier: LEAGUES[pick1.league].tier, ovr: OVR(), trophies: S.youth.trophies });
  addLog(`📰 Rival ${josa(S.rival.name, "은/는")} joins ${S.rival.club}.`);
  news(`✍️ Rookie ${S.name} joins ${pick1.club} · Rival ${S.rival.name} heads to ${S.rival.club}`);
  S.pending = null; save();
  show("scr-main"); renderMain();
  await tip("t-pro", `As a pro, each round is <b>1 training + 1 match</b>, with ${ROUNDS} rounds a season (home & away).<br/>1,920 players at 120 clubs in 12 leagues (top and second tiers of 6 countries) play real matches on the same engine every round. Follow the world in 📰 News, 🏆 League and 👥 Squad.<br/>Finish near the top and you play the <b>continental cup</b> next season. The <b>World Cup</b> comes every 4 seasons.`);
}
function joinClub(o) {
  const c = clubData(o.league, o.club);
  S.pro = S.pro || {};
  Object.assign(S.pro, { league: o.league, club: o.club, kit: [c[2], c[3]] });
  moveToClub("me", o.club);
  for (const p of clubPlayers(o.club)) if (p.id !== "me" && p.id !== "rv" && p.no === S.look.number) p.no = pickNo(o.club, p.r);   // 내 등번호는 내가 달아요
  S.career.peakTier = Math.max(S.career.peakTier, LEAGUES[o.league].tier);
  if (!S.career.clubs) S.career.clubs = [];
  if (S.career.clubs[S.career.clubs.length - 1] !== o.club) S.career.clubs.push(o.club);
}
function offerScreen({ title, hint, offers, stay }) {
  return new Promise((resolve) => {
    show("scr-offers");
    setTimeout(loadingOff, 0);
    $("of-title").textContent = title;
    $("of-hint").innerHTML = hint;
    const list = $("of-list");
    list.innerHTML = offers.map((o, i) => {
      const rv = o.club === S.rival.club;
      const p = Math.round(starterProb(o.club) * 100);
      const others = clubPlayers(o.club).filter((x) => x.id !== "me" && x.r === S.pos).sort((a, b) => pOvr(b) - pOvr(a));
      const prevRank = S.lgs && S.lgs[o.league] && S.lgs[o.league].table[o.club].p ? rankOf(o.club) + "th" : "-";
      const cup = Object.entries(S.cups || {}).find(([, c]) => c.teams.includes(o.club));
      return `<button class="offer" data-i="${i}"><div class="crest-big">${crestHTML(o.club, 54)}</div>
        <div class="of-mid"><b>${esc(o.club)}</b><span>${LEAGUES[o.league].flag} ${LEAGUES[o.league].name} · Strength ${Math.round(o.str)} · Rank ${prevRank}</span>
        <span>Starter chance <em class="${p >= 60 ? "up" : p < 35 ? "dn" : ""}">${p}%</em> · Match fee ~${fmtMoney(baseSalary(o.league, o.str))}</span>
        ${S.contract && S.pro && S.phase === "pro" && S.contract.club === S.pro.club && S.contract.years > 0 && o.club !== S.pro.club ? `<span>✍️ ${esc(S.pro.club)} release odds <em class="${releaseChance(o) >= .6 ? "up" : releaseChance(o) < .35 ? "dn" : ""}">${Math.round(releaseChance(o) * 100)}%</em></span>` : ""}
        <span class="coach">${coachLine(o.club)}${FORMS[formOf(o.club)].roles.includes(S.pos) ? "" : ` · ⚠️ No ${ROLE_KO[S.pos]} slot`}</span>
        <span class="race">${ROLE_KO[S.pos]} rivals: ${others.slice(0, 3).map((x) => `${esc(x.n)}${x.id === "rv" ? "⚔️" : ""} ${Math.round(pOvr(x))}`).join(" · ")}</span>
        ${rv ? `<span class="rv">⚔️ Rival ${esc(S.rival.name)}'s team${S.rival.pos === S.pos ? " (same position, battle for a start!)" : " (you'd be teammates)"}</span>` : ""}</div></button>`;
    }).join("") || `<p class="hint">No offers this time.</p>`;
    list.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { Sfx.good(); resolve(offers[+b.dataset.i]); });
    const st = $("of-stay");
    st.hidden = !stay;
    if (stay) { st.textContent = stay; st.onclick = () => resolve(null); }
  });
}

/* ---------- 프로 시즌 ---------- */
function setSchedule() {
  const L = S.lgs[S.pro.league];
  const mine = L.rounds.map((pairs) => pairs.find((x) => x.includes(S.pro.club)));
  S.pro.schedule = mine.map((p) => p[0] === S.pro.club ? p[1] : p[0]);
  S.pro.home = mine.map((p) => p[0] === S.pro.club);
}
function initSeason(first) {
  const prev = first ? null : Object.fromEntries(LEAGUES.map((l) => [l.id, sortedTable(l.id).map((x) => x[0])]));
  initLeagues();
  initCups(prev);
  S.ycount = 0;
  Object.assign(S.pro, { round: 0, lastBench: false, s: { apps: 0, starts: 0, g: 0, a: 0, ratings: [], mom: 0 }, cup: { ap: 0, g: 0, a: 0 } });
  setSchedule();
  if (typeof goalsInit === "function") goalsInit();
  S.cond = Math.max(S.cond, 80);
  S.pro.streak = 0; S.pro.benchRun = 0; S.flags.trSeason = 0;
  if (syncTrust()) pushSig("newcoach", { n: coachOf(S.pro.club).n, f: coachOf(S.pro.club).f, s: coachOf(S.pro.club).s });
  if (S.trustPenalty) { addTrust(-S.trustPenalty); S.trustPenalty = 0; }
  if (!first && S.rival.club === S.pro.club) pushSig("rivalmate");
  if (S.contract && S.contract.club === S.pro.club && S.contract.years === 1) pushSig("contractlast");
  const sf = payStaff();
  if (sf) { addLog(`👥 Staff upkeep -${fmtMoney(sf.fee)}`); if (sf.lapsed.length) addLog(`⚠️ Not enough money, contract ended: ${sf.lapsed.join(", ")}`); }
  for (const [k, c] of Object.entries(S.cups)) if (c.teams.includes(S.pro.club)) news(`${CUPS[k].emoji} ${S.pro.club} plays in the ${CUPS[k].name} this season!`);
}
function rvS() { const p = W && W.p.rv; return p ? { g: p.s.g, a: p.s.a, ap: p.s.ap, avg: pAvg(p) } : { g: 0, a: 0, ap: 0, avg: 0 }; }
function recordMine(r, kind, lgPay) {
  const P = S.pro;
  if (!r.played) return null;
  if (kind === "league") { P.s.apps++; if (r.mins === 90 || r.starter) P.s.starts++; P.s.g += r.goals; P.s.a += r.assists; P.s.ratings.push(r.rating); if (r.mom) P.s.mom++; }
  else { P.cup.ap++; P.cup.g += r.goals; P.cup.a += r.assists; }
  const pay = Math.round((salaryOf(P.league) * ((r.mins >= 60 ? 1 : .7) + (r.goals + r.assists) * .15) + (r.mom ? lgPay * .5 : 0)) * (1 + (typeof F === "function" ? F("money") : 0)));
  S.money += pay;
  return pay;
}

/* 한 라운드: 내 경기 + 6개 리그 나머지 경기 전부 + (있으면) 대륙컵. quick이면 연출 없이 */
async function proRound(quick = false) {
  const P = S.pro, lg = LEAGUES[P.league], round = P.round;
  if (P.ticked !== round) { tickAvailability(); P.ticked = round; }   // 이 라운드 결장 카운트 (이어하기로 다시 들어와도 한 번만)
  const opp = P.schedule[round], isHome = P.home[round];
  const wasBanned = (S.ban || 0) > 0;
  const mine = teamFor(P.club, { home: isHome }), oppT = teamFor(opp, { home: !isHome });
  S.flags.forceStart = false;
  const starter = mine.xi.some((p) => p.id === "me");
  const rvOpp = [...oppT.xi, ...oppT.bench].some((p) => p.id === "rv");
  const { r, res } = await matchFlow({
    title: `${lg.flag} ${lg.name} R${round + 1}`, sub: `Season ${P.season} · ${esc(P.club)} ${isHome ? "Home" : "Away"}`,
    mine, opp: oppT, mySide: isHome ? "home" : "away", race: spotRace(P.club), forceQuick: quick,
  });
  r.starter = starter;
  const [h, a] = isHome ? [P.club, opp] : [opp, P.club];
  credit(res, "league", P.league, h, a);
  simRoundRest(round, P.club);
  const rvR = rvOpp ? [...res.ratings].find(([p]) => p.id === "rv")?.[1] : null;
  const lines = applyMatch(r, { rival: rvOpp, rvRating: rvR, prestige: lg.prestige });
  const pay = recordMine(r, "league", lg.pay);
  if (pay != null) lines.push(`💰 Match fee +${fmtMoney(pay)}${r.mom ? " (incl. ⭐ MOTM bonus)" : r.goals + r.assists ? " (incl. goal/assist bonus)" : ""}`);
  if (syncTrust()) pushSig("newcoach", { n: coachOf(P.club).n, f: coachOf(P.club).f, s: coachOf(P.club).s });
  const tl = r.played ? addTrust(r.rating >= 8 ? 5 : r.rating >= 7.3 ? 3 : r.rating >= 6.6 ? 1 : r.rating <= 5.6 ? -5 : r.rating <= 6.1 ? -2 : 0, `Rating ${r.rating}`) : null;
  if (tl) lines.push(tl);
  P.streak = r.res === "W" ? Math.max(0, P.streak || 0) + 1 : r.res === "L" ? Math.min(0, P.streak || 0) - 1 : 0;
  if (P.streak === -3) pushSig("losing3"); if (P.streak === 4) pushSig("winning4");
  if (r.played && r.goals >= 3) pushSig("hattrick", { opp });
  else if (r.played && r.rating >= 8.6) pushSig("superb", { r: r.rating });
  else if (r.played && r.rating <= 5.3) pushSig("awful", { r: r.rating });
  if (r.sentOff) pushSig("redcard");
  if (r.cards.some((c) => c.startsWith("🚑"))) pushSig("matchinjury");
  P.benchRun = !starter && !wasBanned && S.injured === 0 ? (P.benchRun || 0) + 1 : 0;
  if (P.benchRun === 3) pushSig("benched3");
  if (round >= 11 && !S.flags.trSeason) { const t = sortedTable(), mr = myRank(), gap = t[0][1].pts - t[mr - 1][1].pts; if (mr <= 3 && (mr > 1 ? gap <= 3 : t[0][1].pts - t[1][1].pts <= 3)) { S.flags.trSeason = 1; pushSig("titlerace", { rank: mr, gap: mr > 1 ? gap : t[0][1].pts - t[1][1].pts }); } }
  if ((round === 5 || round === 12) && !(S.pro.season % 4 === 0 && round === 12)) callUp();
  if (wasBanned) { S.ban--; lines.push("⛔ Missed the match through suspension"); }
  else if (S.injured > 0 && !r.cards.some((c) => c.startsWith("🚑"))) { S.injured--; if (!r.played) lines.push("🤕 Missed the match through injury"); }
  P.lastBench = !starter && S.injured === 0;
  const rvp = W.p.rv;
  if (!rvOpp && rvp.c) {
    const last = S.lgs[rvp.l].res.slice().reverse().find((x) => x.h === rvp.c || x.a === rvp.c);
    if (last) {
      // 라이벌 소식 카드: 라이벌 팀 기준 승패, 스코어, 이번 경기 골·도움, 시즌 기록
      const home = last.h === rvp.c, gf = home ? last.hg : last.ag, ga = home ? last.ag : last.hg;
      const res = gf > ga ? ["W", "W"] : gf < ga ? ["L", "L"] : ["D", "D"];
      const gl = (last.g || []).filter((x) => x[2] === rvp.n).length, as = (last.g || []).filter((x) => x[3] === rvp.n).length;
      const mom = last.mom && last.mom[0] === rvp.n;
      const today = [gl ? `⚽ ${gl} goal${gl > 1 ? "s" : ""}` : "", as ? `🅰️ ${as} assist${as > 1 ? "s" : ""}` : "", mom ? "⭐ MOM" : ""].filter(Boolean).join(" · ") || "no goals or assists";
      lines.push(`<div class="rvn"><div class="rvn-h">⚔️ Rival news <b>${esc(rvp.n)}</b></div>
        <div class="rvn-m"><i class="rvn-${res[0]}">${res[1]}</i><span class="${home ? "me" : ""}">${esc(last.h)}</span><b>${last.hg} : ${last.ag}</b><span class="${home ? "" : "me"}">${esc(last.a)}</span></div>
        <div class="rvn-s">This match: ${today}<br/>Season ⚽${rvp.s.g} 🅰️${rvp.s.a}${rvp.s.ap ? ` · Rating ${pAvg(rvp).toFixed(2)}` : ""}</div></div>`);
    }
  }
  const gRank = P.s.g ? topBy(P.league, "g", 60).findIndex((p) => p.id === "me") + 1 : 0;
  lines.push(`📊 League #${myRank()} · Season ⚽${P.s.g} 🅰️${P.s.a}${gRank ? ` · Scoring #${gRank}` : ""}`);
  const others = S.lgs[P.league].res.slice(-5).filter((x) => x.h !== P.club && x.a !== P.club);
  lines.push(`<details class="rr"><summary>📋 R${round + 1} other matches</summary>${others.map((x) => `<div>${esc(x.h)} <b>${x.hg}:${x.ag}</b> ${esc(x.a)} <small>${x.g.map((g) => `${g[0]}' ${esc(g[2])}`).join(", ")}</small></div>`).join("")}</details>`);
  addLog(`${r.res === "W" ? "✅" : r.res === "D" ? "➖" : "❌"} R${round + 1} vs ${opp} ${r.gf}:${r.ga}${r.played ? ` · Rating ${r.rating}` : " · Didn't play"}${starter || !r.played ? "" : " (sub)"}${r.goals ? ` · ⚽${r.goals}` : ""}${r.assists ? ` · 🅰️${r.assists}` : ""}${rvOpp ? " ⚔️" : ""}`);
  // 경기 결과를 바로 저장해요 — 결과 화면에서 나가도 이 경기는 다시 치르지 않아요
  P.round++;
  S.cond = clamp(S.cond + 6, 0, 100);
  S.pending = "cups"; if (!quick) save();
  if (!quick) await showResult(r, lines, round + 1 >= ROUNDS ? "Season review →" : "Continue");
  return roundTail(quick);
}
async function roundTail(quick = false) {
  const P = S.pro;
  await runCups(P.round, quick);
  if (quick) { S.pending = null; if (P.round % 3 === 0 || P.round >= ROUNDS) save(); return; }
  if (P.round >= ROUNDS) { S.pending = "season"; save(); return seasonEnd(); }
  S.pending = null; save();
  show("scr-main"); renderMain();
}

/* 대륙컵 한 단계 — 우리 클럽이 살아있으면 직접 뛰어요 */
async function runCups(roundDone, quick) {
  for (const key of cupsAt(roundDone)) {
    const cup = CUPS[key], C = S.cups[key];
    if (!C || C.alive.length < 2) continue;
    const stageName = CUP_STAGE[C.stage] || `Round of ${C.stage}`;
    const winners = [];
    let myLine = null;
    for (const [h, a] of cupPairs(key)) {
      if (h === S.pro.club || a === S.pro.club) {
        const isHome = h === S.pro.club, opp = isHome ? a : h;
        const mine = teamFor(S.pro.club, { home: isHome }), oppT = teamFor(opp, { home: !isHome });
        const { r, res, m } = await matchFlow({ title: `${cup.emoji} ${cup.name} ${stageName}`, sub: `${esc(S.pro.club)} vs ${esc(opp)} · ${LEAGUES[W.c[opp].l].flag} ${LEAGUES[W.c[opp].l].name}`,
          mine, opp: oppT, mySide: isHome ? "home" : "away", forceQuick: quick });
        let so = null;
        if (res.hg === res.ag) {
          const myOn = onAt90(mine), opOn = onAt90(oppT);
          const s = quick ? shootoutAuto(myOn, opOn) : await shootoutUI(myOn, opOn, S.pro.club, opp);
          so = isHome ? s : { aWin: !s.aWin, a: s.b, b: s.a };
          if (!quick) show("scr-match");
        }
        const { win, pk } = cupResolve(key, h, a, res, so);
        winners.push(win);
        const rvOpp = [...oppT.xi].some((p) => p.id === "rv");
        const lines = applyMatch(r, { rival: rvOpp, prestige: 3, big: 1.5 });
        recordMine(r, "cup", LEAGUES[S.pro.league].pay);
        const iWon = win === S.pro.club;
        const stagePrize = cup.prize[cup.at.indexOf(roundDone)] || 0;
        if (iWon) { S.money += stagePrize; lines.push(`${cup.emoji} ${C.stage === 2 ? "Champions!!" : "Through to the next round!"}${pk ? pk : ""} 💰 +${fmtMoney(stagePrize)}`); }
        else lines.push(`💧 ${cup.name}: out in the ${stageName}${pk}`);
        myLine = `${iWon ? "✅" : "❌"} ${stageName} vs ${opp} ${r.gf}:${r.ga}${pk}`;
        addLog(`${cup.emoji} ${cup.name} ${myLine}`);
        if (!quick) await showResult(r, lines, "Continue");
      } else {
        const res = playAI(teamFor(h, { home: true }), teamFor(a));
        winners.push(cupResolve(key, h, a, res).win);
      }
    }
    cupAdvance(key, winners);
    if (C.alive.length === 2 && C.alive.includes(S.pro.club)) pushSig("cupfinal", { cup: cup.name });
    if (C.winner === S.pro.club) { S.career.trophies.push(`Season ${S.pro.season} ${cup.name}`); S.career.awards.push(`Season ${S.pro.season} ${cup.emoji} ${cup.name} winner`); S.career.awardScore = (S.career.awardScore || 0) + 12 * cup.weight; S.fame += 20; }
    if (!quick && !myLine) {
      const rs = (C.res || []).slice(-winners.length);
      toast(`<div class="cupt"><b>${cup.emoji} ${cup.name} ${stageName}</b>${rs.map((x) => `<div class="cupt-r"><span class="${x.win === x.h ? "w" : ""}">${crestHTML(x.h, 16)} ${esc(x.h)}</span><em>${x.hg}:${x.ag}</em><span class="${x.win === x.a ? "w" : ""}">${esc(x.a)} ${crestHTML(x.a, 16)}</span>${x.so ? `<small>Penalties ${x.so} · ${esc(x.win)} win</small>` : ""}</div>`).join("")}</div>`, 5000);
    }
  }
}

/* 남은 라운드 빠르게 — 훈련은 자동, 경기는 결과만 */
async function quickSeason(skipAsk) {
  if (!skipAsk) {
    const ok = await modal({ emoji: "⚡", title: "Fast-forward the rest", html: `<p>The remaining ${ROUNDS - S.pro.round} rounds will run with auto training + results only.<br/>You'll still be asked about events.</p>`, buttons: [{ label: "Go", value: true, cls: "btn-primary" }, { label: "Cancel", value: false }] });
    if (!ok) return;
  }
  busy = true;
  try {
    while (S.phase === "pro" && S.pro.round < ROUNDS) {
      const a = S.injured > 0 || S.cond < 45 ? { kind: "rest" } : { kind: "train", key: bestTrainKey() };
      applyAction(a, null); S.turn++; rivalGrow();
      if (S.money >= 150) S.shopOpen = true;
      await maybeEvent();
      await proRound(true);
      renderMain(); await sleepMs(60);
    }
  } finally { busy = false; }
  S.pending = "season"; save();
  seasonEnd();
}

/* ---------- 시즌 결산 ---------- */
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const POS_F = { fw: .8, wg: .9, mf: 1.3, df: 2.6, gk: 2.6 };
/* 발롱도르 점수 (v1.9.8): 기록과 우승 비중을 키우고 능력치 비중은 줄였어요 */
/* 실제 발롱도르 기준(① 개인 활약 ② 팀 우승 ③ 페어플레이)에 맞춰: 큰 대회 우승·큰 경기 골 비중↑, 퇴장 감점, 능력치 비중↓ (v2.0) */
const BALLON_W = { ovr: .3, tier: 5, rate: 8, ga: .75, big: .5, champ: 8, boot: 6, ast: 4, mvp: 5, red: 3 };
const BALLON_SPLIT = [1, .6, .4, .3, .25];   // 같은 팀 n번째 후보가 받는 팀 성적 보너스 비율
/* 발롱도르 계산식 보기: 항목별 점수 (1위와 나) */
function ballonParts(o) {
  const B = BALLON_W, pf = POS_F[o.pos] || 1;
  return [
    [T("종합 능력치", "Overall"), `${Math.round(o.ovr)} × ${B.ovr}`, o.ovr * B.ovr],
    [T("리그 수준", "League level"), `${o.tier} × ${B.tier}`, o.tier * B.tier],
    [T("평균 평점", "Avg rating"), `(${o.avg.toFixed(2)} − 6.5) × ${B.rate}`, (o.avg - 6.5) * B.rate],
    [T("골·도움 (큰 경기 골 1.5배)", "Goals·assists (big-game goals x1.5)"), `(${o.g}${o.bg ? ` + ${o.bg}×0.5` : ""} + ${o.a}×0.8) × ${pf} × ${B.ga}`, (o.g + (o.bg || 0) * B.big + o.a * .8) * pf * B.ga],
    [T("리그 우승", "League title"), o.champ ? `+${B.champ}` : "-", o.champ ? B.champ : 0],
    [T("득점왕 · 도움왕 · MVP", "Golden Boot · Assists · MVP"), [o.boot && "👟", o.ast && "🎯", o.mvp && "👑"].filter(Boolean).join(" ") || "-", (o.boot ? B.boot : 0) + (o.ast ? B.ast : 0) + (o.mvp ? B.mvp : 0)],
    [T("대륙컵 · 월드컵", "Cups · World Cup"), (o.cup || 0) + (o.wc || 0) ? "+" + ((o.cup || 0) + (o.wc || 0)).toFixed(1) : "-", (o.cup || 0) + (o.wc || 0)],
    [T("페어플레이 (퇴장)", "Fair play (red cards)"), o.rc ? `${o.rc} × −${B.red}` : "-", -(o.rc || 0) * B.red],
    [T("같은 팀 표 나눔", "Same-team vote split"), o.split ? T("팀 내 순위만큼 팀 보너스 감소", "team bonus shared") : "-", -(o.split || 0)],
  ];
}
function openBallonInfo() {
  const I = window.__ballon; if (!I || !I.top) return;
  const cols = [I.top, I.me && I.me !== I.top ? I.me : null].filter(Boolean);
  const nm = (c) => `${NATIONS[c.nat] ? NATIONS[c.nat].flag : ""} ${esc(c.name)}`;
  const parts = cols.map(ballonParts);
  const rows = parts[0].map((r, i) => `<tr><td>${r[0]}</td>${parts.map((p) => `<td><small>${p[i][1]}</small><b>${p[i][2] ? (p[i][2] > 0 ? "+" : "") + p[i][2].toFixed(1) : "0"}</b></td>`).join("")}</tr>`).join("");
  modal({ title: T("🏅 발롱도르 계산식", "🏅 Ballon d'Or formula"), wide: true,
    html: `<p class="small">${T("리그 9경기 이상 뛴 모든 선수를 아래 점수 합으로 줄 세워요. 포지션 배율: 공격수 0.8 · 윙어 0.9 · 미드 1.3 · 수비 2.6", "Every player with 9+ league games is ranked by this total. Position factor: FW 0.8 · WG 0.9 · MF 1.3 · DF 2.6")}</p>
      <div class="hd-scroll"><table class="tbl bf"><tr><th></th>${cols.map((c, i) => `<th>${i === 0 ? "1. " : I.myRank + ". "}${nm(c)}</th>`).join("")}</tr>${rows}
      <tr class="me"><td><b>${T("합계", "Total")}</b></td>${cols.map((c) => `<td><b>${c.sc.toFixed(1)}</b></td>`).join("")}</tr></table></div>`,
    buttons: [{ label: T("닫기", "Close"), value: 1, cls: "btn-primary" }] });
}
function ballonScore(o) { const B = BALLON_W; return o.ovr * B.ovr + o.tier * B.tier + (o.avg - 6.5) * B.rate + (o.g + (o.bg || 0) * B.big + o.a * .8) * (POS_F[o.pos] || 1) * B.ga + (o.champ ? B.champ : 0) + (o.boot ? B.boot : 0) + (o.ast ? B.ast : 0) + (o.mvp ? B.mvp : 0) + (o.cup || 0) + (o.wc || 0) - (o.rc || 0) * B.red; }
function leagueAwards(lgId) {
  const ps = leaguePlayers(lgId).filter((p) => p.s.ap >= 9);
  const best = (f) => ps.slice().sort(f)[0];
  return {
    boot: best((a, b) => b.s.g - a.s.g || b.s.a - a.s.a || pAvg(b) - pAvg(a)),
    ast: best((a, b) => b.s.a - a.s.a || b.s.g - a.s.g || pAvg(b) - pAvg(a)),
    mvp: best((a, b) => (pAvg(b) + (rankOf(b.c) <= 3 ? .2 : 0)) - (pAvg(a) + (rankOf(a.c) <= 3 ? .2 : 0))),
    young: ps.filter((p) => ageOf(p) <= 22).sort((a, b) => pAvg(b) - pAvg(a))[0],
    champ: sortedTable(lgId)[0][0],
  };
}

async function seasonEnd() {
  const P = S.pro, lg = LEAGUES[P.league], rank = myRank(), tbl = sortedTable();
  const myAvg = avg(P.s.ratings), rv = S.rival, rvp = W.p.rv, rs = rvS();
  const AW = Object.fromEntries(LEAGUES.map((l) => [l.id, leagueAwards(l.id)]));
  const mineAw = AW[P.league];
  const awards = [];
  if (mineAw.boot && mineAw.boot.id === "me" && P.s.g >= 5) awards.push({ k: "boot", name: "👟 Golden Boot", w: 8 * lg.prestige });
  if (mineAw.ast && mineAw.ast.id === "me" && P.s.a >= 4) awards.push({ k: "ast", name: "🎯 Assist King", w: 6 * lg.prestige });
  if (mineAw.mvp && mineAw.mvp.id === "me") awards.push({ k: "mvp", name: "👑 League MVP", w: 10 * lg.prestige });
  if (mineAw.young && mineAw.young.id === "me") awards.push({ k: "young", name: "🌟 Young Player Award", w: 6 });
  if (rank === 1) { awards.push({ k: "title", name: `🏆 ${lg.name} champions`, w: 8 * lg.prestige }); S.career.trophies.push(`Season ${P.season} ${lg.name}`); }
  const rvAwards = [];
  const RA = rvp.l != null ? AW[rvp.l] : null;
  if (RA) {
    if (RA.boot && RA.boot.id === "rv") rvAwards.push("👟 Golden Boot");
    if (RA.ast && RA.ast.id === "rv") rvAwards.push("🎯 Assist King");
    if (RA.mvp && RA.mvp.id === "rv") rvAwards.push("👑 League MVP");
    if (RA.champ === rvp.c) { rvAwards.push("🏆 League title"); rv.career.trophies++; }
  }
  for (const [k, c] of Object.entries(S.cups)) if (c.winner === rvp.c) rvAwards.push(`${CUPS[k].emoji} ${CUPS[k].name} winner`);
  // 발롱도르 — 6개 리그 전 선수 (리그 9경기 이상)
  const cupBonus = (club) => Object.entries(S.cups).reduce((s, [k, c]) => s + (c.winner === club ? CUPS[k].weight * 5 : c.winner && (c.log[c.log.length - 1] || "").includes(club) ? CUPS[k].weight * 2 : 0), 0);
  const WCW = S.wcWinner && S.wcWinner.season === P.season ? S.wcWinner : null;
  const cands = Object.values(W.p).filter((p) => p.c && p.s.ap >= 9).map((p) => {
    const l = W.c[p.c].l;
    return { id: p.id, name: p.n, nat: p.nat, club: p.c, pos: p.r, ovr: pOvr(p), tier: LEAGUES[l].tier, avg: pAvg(p), g: p.s.g + p.cs.g + ((WCW && WCW.goals && WCW.goals[p.id]) || 0), bg: p.cs.g + ((WCW && WCW.goals && WCW.goals[p.id]) || 0), rc: p.s.rc || 0, a: p.s.a + p.cs.a, champ: AW[l].champ === p.c, boot: !!AW[l].boot && AW[l].boot.id === p.id, ast: !!AW[l].ast && AW[l].ast.id === p.id, mvp: !!AW[l].mvp && AW[l].mvp.id === p.id, cup: cupBonus(p.c), wc: WCW ? (WCW.nat === p.nat ? 15 : WCW.runner === p.nat ? 6 : 0) : 0 };
  }).map((c) => ({ ...c, sc: ballonScore(c) })).sort((a, b) => b.sc - a.sc);
  // 같은 팀 표 나눔: 팀 성적 보너스(리그 우승 + 대륙컵)는 팀 1등 후보만 100%, 2등 60% · 3등 40% · 4등 30% · 그 아래 25% (실제 투표처럼 같은 팀 표가 갈려요)
  { const seen = {}; for (const c of cands) { const n = seen[c.club] = (seen[c.club] || 0) + 1; const tp = (c.champ ? BALLON_W.champ : 0) + (c.cup || 0); c.split = tp * (1 - (BALLON_SPLIT[n - 1] ?? BALLON_SPLIT[BALLON_SPLIT.length - 1])); c.sc -= c.split; } cands.sort((a, b) => b.sc - a.sc); }
  const myB = cands.findIndex((c) => c.id === "me") + 1, rvB = cands.findIndex((c) => c.id === "rv") + 1;
  window.__ballon = { top: cands[0], me: myB ? cands[myB - 1] : null, myRank: myB };
  if (myB === 1) { awards.push({ k: "ballon", name: "🏅 Ballon d'Or", w: 0 }); S.career.ballon++; if (typeof F === "function" && F("train") > 0) S.flags.feverBallon = 1; }
  else if (myB && myB <= 3) S.career.ballonTop3++;
  if (rvB === 1) { rvAwards.push("🏅 Ballon d'Or"); rv.career.ballon++; }
  if (cands[0] && cands[0].id !== "me") news(`🏅 Season ${P.season} Ballon d'Or: ${cands[0].name} (${NATIONS[cands[0].nat].flag} ${cands[0].club})`);
  rv.career.g += rs.g + rvp.cs.g; rv.career.a += rs.a + rvp.cs.a; rv.career.awards.push(...rvAwards);

  S.career.apps += P.s.apps + P.cup.ap; S.career.g += P.s.g + P.cup.g; S.career.a += P.s.a + P.cup.a; S.career.mom += P.s.mom;
  S.career.awards.push(...awards.map((a) => `Season ${P.season} ${a.name}`));
  S.career.awardScore = (S.career.awardScore || 0) + awards.reduce((x, a) => x + a.w, 0);
  S.career.peakOvr = Math.max(S.career.peakOvr, OVR());
  S.career.seasons.push({ season: P.season, age: S.age, club: P.club, league: P.league, rank, apps: P.s.apps, starts: P.s.starts, g: P.s.g, a: P.s.a, cup: { ...P.cup }, avg: Math.round(myAvg * 100) / 100, awards: awards.map((a) => a.name), ovr: OVR(), gpm: Math.round(Object.values(S.lgs[P.league].table).reduce((s, t) => s + t.gf, 0) / Math.max(1, Object.values(S.lgs[P.league].table).reduce((s, t) => s + t.p, 0)) * 200) / 100, lgTop: LEAGUES.map((l) => { const t = topBy(l.id, "g", 1)[0]; return t ? t.s.g : 0; }), rv: { club: rvp.c, g: rs.g, a: rs.a, avg: Math.round(rs.avg * 100) / 100, b: rvB }, ballon: myB, pp: passPct(W.p.me.s), kp: W.p.me.s.kp || 0, tc: W.p.me.s.tc || 0, ic: W.p.me.s.ic || 0, cl: W.p.me.s.cl || 0, bk: W.p.me.s.bk || 0, cs: W.p.me.s.cs || 0, sv: W.p.me.s.sv || 0, xg: Math.round((W.p.me.s.xg || 0) / 10) / 10 });
  const fameGain = awards.reduce((x, a) => x + Math.round(a.w / 2), 0) + (rank <= 3 ? 6 : 0);
  if (typeof track === "function") track("season_end", { season: P.season, age: S.age, tier: lg.tier, rank, goals: P.s.g, assists: P.s.a, ballon: myB || 0, ovr: OVR() });
  S.fame += fameGain;
  const prize = rank === 1 ? lg.pay * 6 : 0;
  S.money += prize;
  const goalsHTML = typeof goalsSettle === "function" ? goalsSettle() : "";
  const achNew = typeof achCheck === "function" ? achCheck({}) : [];
  achNew.forEach((m) => addLog(m));
  for (const l of LEAGUES) news(`🏆 ${l.flag} ${l.name} Season ${P.season} champions: ${AW[l.id].champ}${AW[l.id].boot ? ` · Golden Boot ${AW[l.id].boot.n} ${AW[l.id].boot.s.g} goals` : ""}`);

  show("scr-season");
  $("ss-title").textContent = `📋 Season ${P.season} review · Age ${S.age}`;
  const myRow = (n) => n === P.club ? "me" : n === rvp.c ? "rv" : "";
  const pl = (p) => `<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>`;
  const plRow = (p, v) => `<div class="bl ${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><b>${pl(p)}${p.id === "rv" ? " ⚔️" : ""}</b><small>${esc(shortName(p.c))}</small><em>${v}</em></div>`;
  const awLine = (l) => { const A = AW[l.id]; return `<div class="aw-row"><b>${l.flag} ${l.name}</b> 🏆 ${esc(A.champ)} · 👟 ${A.boot ? `${pl(A.boot)} ${A.boot.s.g} goals` : "-"} · 👑 ${A.mvp ? pl(A.mvp) : "-"}</div>`; };
  const cupLine = Object.entries(S.cups).map(([k, c]) => `<div class="aw-row"><b>${CUPS[k].emoji} ${CUPS[k].name}</b> Winner ${esc(c.winner || "-")}${c.teams.includes(P.club) ? ` · Us: ${c.winner === P.club ? "🏆 Champions" : "Out"}` : ""}</div>`).join("");
  const heroAw = awards.find((a) => a.k === "ballon") || awards[0];
  $("ss-body").innerHTML = `${heroAw ? `<div class="ss-hero" style="background-image:url(assets/ceremony.webp)"><div class="ss-aw">${awards.map((a) => `<span class="${a.k === "ballon" ? "gold" : ""}">${a.name}</span>`).join("")}</div></div>` : ""}
    <div class="ss-card"><h4>${lg.flag} ${lg.name} final table</h4>
      <table class="tbl"><tr><th>#</th><th>Club</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
      ${tbl.map(([n, t], i) => `<tr class="${myRow(n)} ${zoneCls(P.league, i)}"><td>${i + 1}</td><td>${crestHTML(n, 14)} ${esc(n)}${n === rvp.c ? " ⚔️" : ""}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join("")}</table></div>
    <div class="ss-card"><h4>My season</h4>
      ${seasonStatHTML(W.p.me.s)}
      <div class="ss-me"><div id="ss-av"></div><div>League ${P.s.apps} apps (${P.s.starts} starts)<br/>⚽ ${P.s.g} goals · 🅰️ ${P.s.a} assists · MOTM ${P.s.mom}<br/>Avg rating <b>${myAvg ? myAvg.toFixed(2) : "-"}</b>${P.cup.ap ? `<br/>Continental cup ${P.cup.ap} apps ⚽ ${P.cup.g} 🅰️ ${P.cup.a}` : ""}<br/>
      ${awards.length ? awards.map((a) => `<span class="aw">${a.name}</span>`).join(" ") : "<small>No awards this season</small>"}
      ${prize ? `<br/>💰 Prize money +${fmtMoney(prize)}` : ""}<br/>⭐ Fame +${fameGain}</div></div></div>
    ${goalsHTML}${achNew.length ? `<div class="ss-card"><h4>🏅</h4>${achNew.map((m) => `<div class="small">${m}</div>`).join("")}</div>` : ""}
    <div class="ss-card two"><div><h4>👟 Top scorers</h4>${topBy(P.league, "g", 5).map((p) => plRow(p, p.s.g + " goals")).join("")}</div>
      <div><h4>🎯 Top assists</h4>${topBy(P.league, "a", 5).map((p) => plRow(p, p.s.a + " assists")).join("")}</div></div>
    <div class="ss-card rvc"><h4>⚔️ Rival ${esc(rv.name)}</h4>
      <div>${LEAGUES[rvp.l].flag} ${esc(rvp.c)} (#${rankOf(rvp.c)}) · ${rs.ap} apps · ⚽ ${rs.g} · 🅰️ ${rs.a} · Avg ${rs.avg ? rs.avg.toFixed(2) : "-"}<br/>
      ${rvAwards.length ? rvAwards.map((a) => `<span class="aw rv">${a}</span>`).join(" ") : "<small>No awards</small>"}</div>
      <div class="ss-vs">${P.s.g + P.s.a > rs.g + rs.a ? "🔥 You won this season!" : P.s.g + P.s.a < rs.g + rs.a ? "😤 Your rival edged it this season" : "🤝 Neck and neck"}</div></div>
    <div class="ss-card"><h4>🌍 World football</h4>${TOP_LEAGUES.filter((l) => l.id !== P.league).map(awLine).join("")}${cupLine}</div>
    <div class="ss-card"><h4>🔁 Promotion · Relegation</h4>${promoPreview().map((x) => `<div class="small">${LEAGUES[x.lg].flag} ⬆️ ${x.up.map((n) => `<b class="${n === P.club ? "me-t" : ""}">${esc(n)}</b>`).join(", ")} · ⬇️ ${x.down.map((n) => `<b class="${n === P.club ? "me-t" : ""}">${esc(n)}</b>`).join(", ")}</div>`).join("")}</div>
    <div class="ss-card"><h4>🏅 Ballon d'Or ranking</h4>
      ${cands.slice(0, 5).map((c, i) => `<div class="bl ${c.id === "me" ? "me" : c.id === "rv" ? "rv" : ""}"><span>${i + 1}</span><b>${NATIONS[c.nat].flag} <a class="pl" data-pid="${c.id}">${esc(c.name)}</a>${c.id === "rv" ? " ⚔️" : ""}</b><small>${esc(shortName(c.club))} ⚽${c.g} 🅰️${c.a}</small><em>${c.sc.toFixed(1)}</em></div>`).join("")}
      ${myB > 5 ? `<div class="bl me"><span>${myB}</span><b>${esc(S.name)}</b><small></small><em>${cands[myB - 1].sc.toFixed(1)}</em></div>` : ""}
      ${rvB > 5 ? `<div class="bl rv"><span>${rvB}</span><b>${esc(rv.name)} ⚔️</b><small></small><em>${cands[rvB - 1].sc.toFixed(1)}</em></div>` : ""}<button class="btn btn-ghost bf-btn" id="bf-open">${T("📐 계산식 보기 (1위 vs 나)", "📐 See the formula (1st vs me)")}</button></div>`;
  $("ss-av").appendChild(avatarCanvas(S.look, P.kit, 56, { mood: awards.length ? "joy" : undefined }));
  const bfB = $("bf-open"); if (bfB) bfB.onclick = openBallonInfo;
  bindPlayerLinks($("ss-body"));
  if (awards.some((a) => a.k === "ballon")) { Sfx.goal(); if (Sfx.fanfare) Sfx.fanfare(); }
  addLog(`📋 Season ${P.season} · #${rank} · ⚽${P.s.g} 🅰️${P.s.a}${awards.length ? " · " + awards.map((a) => a.name).join(", ") : ""}`);
  archiveSeason(P.season);

  const canRetire = S.age >= 31, mustRetire = S.age >= 36;
  const wcNext = P.season % 4 === 0;
  $("ss-acts").innerHTML = mustRetire ? `<button class="btn btn-primary" id="ss-retire">🎓 Retirement ceremony</button>`
    : `<button class="btn btn-primary" id="ss-next">${wcNext ? "🌍 To the World Cup →" : "💼 Transfer window →"}</button>${canRetire ? `<button class="btn btn-ghost" id="ss-retire">🎓 Retire here</button>` : ""}`;
  if (typeof shareSeason === "function") { const sb = document.createElement("button"); sb.className = "btn btn-ghost"; sb.textContent = T("📣 이번 시즌 자랑하기", "📣 Share this season"); sb.onclick = shareSeason; $("ss-acts").appendChild(sb); }
  const choice = await new Promise((res) => {
    const n = $("ss-next"); if (n) n.onclick = () => res("next");
    const r = $("ss-retire"); if (r) r.onclick = () => res("retire");
  });
  if (choice !== "retire") await loadingOn(wcNext ? "Opening the World Cup" : "Opening the transfer window");
  if (typeof adNext === "function") await adNext("season_end");
  if (choice === "retire") return retire();
  if (wcNext) { await loadingOn("Opening the World Cup"); await worldCup(); }
  await loadingOn("Opening the transfer window");
  await offseason();
  loadingOff();
}

/* ---------- 🌍 월드컵 ---------- */
async function worldCup() {
  const { sq, field } = wcField();
  if (field.length < 8) return;
  S.cond = Math.max(S.cond, 85);
  const year = S.pro.season;
  const kr = sq.kr;
  const meIn = kr && [...kr.xi, ...kr.bench].some((p) => p.id === "me");
  if (kr && !meIn && OVR() >= 66) pushSig("wcdropped");
  const groups = [[], []];
  [...field].sort((a, b) => sq[b].str - sq[a].str).forEach((n, i) => groups[[0, 1, 1, 0][i % 4]].push(n));
  await modal({ emoji: "🌍", title: `Season ${year} World Cup kicks off`, wide: true, html: `<p>8 nations battle for the trophy.</p>
    ${groups.map((g, i) => `<div class="aw-row"><b>Group ${"AB"[i]}</b> ${g.map((n) => `${NATIONS[n].flag} ${NATIONS[n].name} <small>(${Math.round(sq[n].str)})</small>`).join(" · ")}</div>`).join("")}
    <p class="small">${meIn ? `🇰🇷 <b>${esc(S.name)}</b> called up for South Korea! You're playing.` : kr ? `🇰🇷 You didn't make the South Korea squad. Just watch the results.` : "South Korea didn't qualify."}</p>`,
    buttons: [{ label: "Kick-off", value: 1, cls: "btn-primary" }] });
  const tableOf = (g) => Object.fromEntries(g.map((n) => [n, { pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, p: 0 }]));
  const grpSort = (t) => Object.entries(t).sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf);
  const wcTable = (gi, done) => `<div class="wc-tb"><b>${"AB"[gi]}${T("조", " Group")}</b><table class="tbl"><tr><th>#</th><th></th><th>${T("경기", "P")}</th><th>${T("승", "W")}</th><th>${T("무", "D")}</th><th>${T("패", "L")}</th><th>${T("득실", "GD")}</th><th>${T("승점", "Pts")}</th></tr>${grpSort(TB[gi]).map(([n, x], i) => `<tr class="${n === "kr" ? "me" : ""} ${done && i < 2 ? "z-pro" : ""}"><td>${i + 1}</td><td>${NATIONS[n].flag} ${NATIONS[n].name}</td><td>${x.p}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.gd > 0 ? "+" : ""}${x.gd}</td><td><b>${x.pts}</b></td></tr>`).join("")}</table></div>`;
  const recG = (gi, m) => { const t = TB[gi], A = t[m.a], B = t[m.b]; A.p++; B.p++; A.gf += m.hg; B.gf += m.ag; A.ga += m.ag; B.ga += m.hg; A.gd += m.hg - m.ag; B.gd += m.ag - m.hg; if (m.hg > m.ag) { A.pts += 3; A.w++; B.l++; } else if (m.hg < m.ag) { B.pts += 3; B.w++; A.l++; } else { A.pts++; B.pts++; A.d++; B.d++; } };
  const TB = groups.map(tableOf);
  const scorer = {};
  const play = async (a, b, stage, mustWin, gi) => {
    const A = natTeam(sq, a), B = natTeam(sq, b);
    const mine = (a === "kr" || b === "kr") && meIn;
    let res, r = null, mm = null;
    const krIsA = a === "kr";
    if (mine) {
      ({ res, r, m: mm } = await matchFlow({ title: `🌍 World Cup ${stage}`, sub: `${NATIONS[a].flag} ${NATIONS[a].name} vs ${NATIONS[b].flag} ${NATIONS[b].name}`, mine: krIsA ? A : B, opp: krIsA ? B : A, mySide: krIsA ? "home" : "away" }));
    } else { res = playAI(A, B); mm = res.m; }
    for (const g of res.goals) scorer[g.sh.id] = (scorer[g.sh.id] || 0) + 1, scorer[g.sh.id + "_p"] = g.sh;
    let win = res.hg > res.ag ? a : res.ag > res.hg ? b : null, pk = "";
    if (!win && mustWin) {
      const hOn = onAt90(mm.H), aOn = onAt90(mm.A);
      let so;
      if (mine) { const s = await shootoutUI(krIsA ? hOn : aOn, krIsA ? aOn : hOn, NATIONS.kr.name, NATIONS[krIsA ? b : a].name); so = krIsA ? s : { aWin: !s.aWin, a: s.b, b: s.a }; }
      else so = shootoutAuto(hOn, aOn);
      win = so.aWin ? a : b; pk = ` (Penalties ${so.a}:${so.b})`;
    }
    if (mine) {
      S.career.caps = (S.career.caps || 0) + (r.played ? 1 : 0);
      S.career.wcG = (S.career.wcG || 0) + r.goals;
      const lines = applyMatch(r, { prestige: 3, big: 2 });
      lines.push(win === "kr" ? "🇰🇷 South Korea wins!" : win ? "💧 Defeat" : "🤝 Draw");
      if (gi != null) { recG(gi, { a, b, hg: res.hg, ag: res.ag }); lines.push(wcTable(gi)); }
      await showResult(r, lines, "Continue");
      if (gi != null) return { a, b, hg: res.hg, ag: res.ag, win, pk, counted: true };
    }
    return { a, b, hg: res.hg, ag: res.ag, win, pk };
  };
  const log = [];
  for (let gi = 0; gi < 2; gi++) {
    const g = groups[gi];
    for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]) {
      const m = await play(g[i], g[j], `Group ${"AB"[gi]}`, false, gi);
      if (!m.counted) recG(gi, m);
      log.push(`Group ${"AB"[gi]} ${NATIONS[m.a].flag} ${m.hg}:${m.ag} ${NATIONS[m.b].flag}`);
    }
  }
  const adv = TB.map((t) => grpSort(t).slice(0, 2).map((x) => x[0]));
  const krOut = field.includes("kr") ? (adv.flat().includes("kr") ? T("🇰🇷 대한민국 4강 진출!", "🇰🇷 Korea reach the semi-finals!") : T("🇰🇷 대한민국 조별리그 탈락", "🇰🇷 Korea out in the group stage")) : "";
  await modal({ emoji: "🌍", title: T(`${year}시즌 월드컵 조별리그 결과`, `Season ${year} World Cup group stage`), wide: true, html: `${wcTable(0, true)}${wcTable(1, true)}<p class="small">${T("조 1·2위가 4강에 올라가요 (초록 줄)", "Top 2 of each group go to the semis (green)")}${krOut ? " · " + krOut : ""}</p>`, buttons: [{ label: T("4강으로", "To the semis"), value: 1, cls: "btn-primary" }] });
  const sf1 = await play(adv[0][0], adv[1][1], "Semi-final", true), sf2 = await play(adv[1][0], adv[0][1], "Semi-final", true);
  log.push(`Semi-final ${NATIONS[sf1.a].flag} ${sf1.hg}:${sf1.ag} ${NATIONS[sf1.b].flag}${sf1.pk}`, `Semi-final ${NATIONS[sf2.a].flag} ${sf2.hg}:${sf2.ag} ${NATIONS[sf2.b].flag}${sf2.pk}`);
  const fin = await play(sf1.win, sf2.win, "Final", true);
  log.push(`Final ${NATIONS[fin.a].flag} ${fin.hg}:${fin.ag} ${NATIONS[fin.b].flag}${fin.pk}`);
  const champ = fin.win;
  const wcGoals = {}; for (const k of Object.keys(scorer)) if (!k.endsWith("_p") && scorer[k] > 0) wcGoals[k] = scorer[k];
  S.wcWinner = { nat: champ, runner: champ === fin.a ? fin.b : fin.a, season: year + 1, goals: wcGoals };
  const topId = Object.keys(scorer).filter((k) => !k.endsWith("_p")).sort((x, y) => scorer[y] - scorer[x])[0];
  const boot = topId ? scorer[topId + "_p"] : null;
  news(`🌍 World Cup winner: ${NATIONS[champ].flag} ${NATIONS[champ].name}! Golden Boot ${boot ? boot.n + " " + scorer[topId] + " goals" : "-"}`);
  const krRes = adv.flat().includes("kr") ? ([sf1, sf2].some((m) => (m.a === "kr" || m.b === "kr") && m.win === "kr") ? (champ === "kr" ? "🏆 Champions" : "🥈 Runner-up") : "Semi-final") : field.includes("kr") ? "Group stage exit" : "Did not qualify";
  if (meIn) {
    S.career.wc = (S.career.wc || []).concat([`Season ${year} ${krRes}`]);
    if (champ === "kr") { S.career.trophies.push(`Season ${year} World Cup`); S.career.awards.push(`Season ${year} 🌍 World Cup winner`); S.career.awardScore = (S.career.awardScore || 0) + 60; S.fame += 60; }
    if (boot && boot.id === "me") { S.career.awards.push(`Season ${year} 🌍 World Cup Golden Boot`); S.career.awardScore = (S.career.awardScore || 0) + 20; }
    addLog(`🌍 World Cup South Korea: ${krRes}`);
  }
  await modal({ emoji: "🌍", title: `World Cup winner: ${NATIONS[champ].flag} ${NATIONS[champ].name}`, wide: true, img: "assets/ceremony.webp",
    html: `<p>🇰🇷 South Korea: <b>${krRes}</b>${boot ? ` · 👟 Golden Boot ${esc(boot.n)} ${scorer[topId]} goals` : ""}</p><div class="wc-log">${log.map((l) => `<div>${l}</div>`).join("")}</div>`,
    buttons: [{ label: "To the transfer window", value: 1, cls: "btn-primary" }] });
}

async function offseason() {
  const P = S.pro;
  const myAvg = avg(P.s.ratings);
  S.age++; S.rival.age++;
  const decl = [];
  if (S.age >= 31) {
    for (const k of STAT_KEYS) { const d = (k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8); S.stats[k] = clamp(S.stats[k] - d * (1 - trOf(k) * .25), 1, statCap(k)); }
    decl.push("Age is catching up: your Speed and Stamina dropped");
  }
  if (S.rival.age >= 31) for (const k of STAT_KEYS) S.rival.stats[k] = clamp(S.rival.stats[k] - ((k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8)) * (1 - trOf(k, S.rival) * .25), 1, statCap(k, S.rival));
  worldOffseason();
  promoRelegate();
  if (W.c[P.club] && W.c[P.club].l !== P.league) {
    const upL = LEAGUES[W.c[P.club].l].div === 1;
    P.league = W.c[P.club].l;
    if (upL) S.fame += 8;
    if (upL) S.flags.achPro = 1; else S.flags.achRel = 1;
    if (typeof achToast === "function") achToast();
    addLog(upL ? `⬆️ ${P.club} promoted to ${LEAGUES[P.league].name}!` : `⬇️ ${P.club} relegated to ${LEAGUES[P.league].name}`);
    save();
    await modal({ emoji: upL ? "⬆️" : "⬇️", title: upL ? "Promoted!" : "Relegated", html: upL
      ? `<p><b>${esc(P.club)}</b> moved up to <b>${LEAGUES[P.league].flag} ${LEAGUES[P.league].name}</b>!<br/>Tougher opponents ahead. Fame +8</p>`
      : `<p><b>${esc(P.club)}</b> dropped to <b>${LEAGUES[P.league].flag} ${LEAGUES[P.league].name}</b>.<br/>Your contract stays the same. You can take offers from other clubs in the transfer window.</p>`,
      buttons: [{ label: "To the transfer window", value: 1, cls: "btn-primary" }] });
    await loadingOn("Opening the transfer window");
  } else save();
  const ct = S.contract;
  if (ct && ct.club === P.club) ct.years--;
  const free = !ct || ct.club !== P.club || ct.years <= 0;
  const oldRv = S.rival.club;
  if (ROVR() > clubStr(S.rival.league, S.rival.club) + 3 || spotRace(S.rival.club, "rv").margin < -4) rivalPickClub();
  const rvMoved = oldRv !== S.rival.club;
  if (rvMoved) news(`🔁 Rival ${S.rival.name}, ${oldRv} → ${S.rival.club}`);
  const score = OVR() + (myAvg - 6.7) * 3 + Math.min(S.fame / 150, 4) + DIFF[S.diff || "normal"].offer;
  const offers = offerList(score + (S.flags.wantMove ? 1.5 : 0), { exclude: P.club, agent: G("agent") > 0, transfer: true }).filter((o) => o.str >= clubStr(P.league, P.club) - 2 || P.lastBench);
  if (S.rival.club !== P.club && !offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 7 && Math.random() < .6) {
    const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] });
  }
  await tip("t-transfer", "When the season ends, <b>transfer offers</b> arrive. Each offer shows the team's rank, your rivals for the spot, and your starting chance.<br/>AI players also really move, retire, and debut every offseason. Check 📰 News to follow it all.");
  let choice = await offerScreen({
    title: "💼 Transfer window",
    hint: `${decl.length ? "⏳ " + decl.join(", ") + "<br/>" : ""}${free ? "📝 <b>Contract expired!</b> You can move freely or renew.<br/>" : `✍️ ${ct.years} yr(s) left on contract · Moving needs club approval.<br/>`}Now: ${LEAGUES[P.league].flag} <b>${esc(P.club)}</b> (Strength ${Math.round(clubStr(P.league, P.club))}, starting chance ${Math.round(starterProb(P.club) * 100)}%) · OVR ${OVR()} · Market value ${fmtMV(marketValue(W.p.me))}<br/>${rvMoved ? `📰 Rival ${esc(S.rival.name)} moves to <b>${esc(S.rival.club)}</b>!` : `Rival ${esc(josa(S.rival.name, "은/는"))} stays at ${esc(S.rival.club)}.`}`,
    offers, stay: free ? `✍️ Renewal talks with ${P.club}` : `🤝 Stay at ${P.club} (${ct.years} yr(s) left)`,
  });
  if (choice && !free && Math.random() >= releaseChance(choice)) {
    addLog(`⛔ ${P.club} blocked your move to ${choice.club}`);
    await modal({ emoji: "⛔", title: "Transfer blocked", html: `<p><b>${esc(P.club)}</b> didn't approve the transfer.<br/>You still have ${ct.years} yr(s) on your contract.</p>`, buttons: [{ label: "OK", value: 1, cls: "btn-primary" }] });
    pushSig("transferblocked", { club: choice.club });
    choice = null;
  }
  if (choice) {
    const from = P.club, fee = marketValue(W.p.me), paid = !free ? ` (Fee ${fmtMV(fee)})` : " (Free transfer)";
    joinClub(choice); addLog(`💼 Moving to ${LEAGUES[choice.league].flag} ${choice.club}!${paid}`); news(`🔁 ${S.name}, ${from} → ${choice.club}${paid}`); S.fame += 5;
    await negotiate(choice, `✍️ Signing talks with ${esc(choice.club)}`);
    pushSig("newclub");
  } else if (free) await negotiate({ league: P.league, club: P.club, str: clubStr(P.league, P.club) }, `✍️ Renewal talks with ${esc(P.club)}`);
  S.flags.wantMove = false; S.flags.renewWill = false;
  if (rvMoved) addLog(`📰 Rival ${S.rival.name} moves to ${S.rival.club}`);
  P.season++;
  initSeason(false);
  S.pending = null; save();
  show("scr-main"); renderMain();
}

/* ---------- 세계 보기: 리그 · 스쿼드 · 뉴스 · 선수 ---------- */
function bindPlayerLinks(root) {
  root.querySelectorAll("[data-pid]").forEach((a) => a.onclick = (e) => { e.stopPropagation(); openPlayer(a.dataset.pid); });
}
/* 순위표 승강권: 1부 하위 2팀 강등, 2부 상위 2팀 승격 */
function zoneCls(lgId, i) { const l = LEAGUES[lgId], n = l.clubs.length; return l.down != null && i >= n - 2 ? "z-rel" : l.up != null && i < 2 ? "z-pro" : ""; }
function zoneLegend(lgId) { const l = LEAGUES[lgId]; return `<p class="small zone-lg">${l.down != null ? `<i class="z-rel"></i> Relegation zone (${LEAGUES[l.down].name})` : `<i class="z-pro"></i> Promotion zone (${LEAGUES[l.up].name})`}</p>`; }
function openLeague(lgId = S.pro.league, tab = "table") {
  const cur = LEAGUES[lgId], top = cur.div === 2 ? LEAGUES[cur.up] : cur;
  const lgBtns = TOP_LEAGUES.map((l) => { const t = cur.div === 2 ? LEAGUES[l.down] : l; return `<button class="${l.id === top.id ? "on" : ""}" data-lg="${t.id}">${t.flag} ${t.name}</button>`; }).join("");
  const divBtns = top.down != null ? `<div class="seg lg-div"><button class="${cur.div === 1 ? "on" : ""}" data-lg="${top.id}">Tier 1</button><button class="${cur.div === 2 ? "on" : ""}" data-lg="${top.down}">Tier 2</button></div>` : "";
  const tabs = [["table", "Rank"], ["res", "Result"], ["g", "Goals"], ["a", "Assists"], ["rt", "Rating"], ["kp", "Key passes"], ["pp", "Pass%"], ["tc", "Tackles"], ["cup", "Continental Cup"]].map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("");
  let body;
  const pl = (p) => `<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>`;
  if (tab === "table") {
    body = `<table class="tbl"><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>${sortedTable(lgId).map(([n, t], i) =>
      `<tr class="${n === S.pro.club ? "me" : n === W.p.rv.c ? "rv" : ""} ${zoneCls(lgId, i)}"><td>${i + 1}</td><td><a class="pl" data-club="${esc(n)}">${crestHTML(n, 14)} ${esc(n)}</a></td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join("")}</table>`;
    body += zoneLegend(lgId);
  } else if (tab === "res") {
    const rs = S.lgs[lgId].res.slice(-5);
    body = rs.length ? rs.map((x) => `<div class="rep"><div>${crestHTML(x.h, 16)} <b>${esc(x.h)}</b> <em>${x.hg}:${x.ag}</em> <b>${esc(x.a)}</b> ${crestHTML(x.a, 16)}</div><small>${x.g.map((g) => `${g[0]}' ${esc(g[2])}${g[3] ? ` (${esc(g[3])})` : ""}`).join(" · ") || "No goals"}${x.mom ? ` · ⭐ ${esc(x.mom[0])} ${x.mom[1]}` : ""}${(x.rc || []).map((c) => ` · ${c[2] === "inj" ? "🚑" : "🟥"} ${esc(c[1])} ${c[0]}'`).join("")}${x.ts ? `<br/>Poss ${x.ts[0]}:${100 - x.ts[0]} · Shots ${x.ts[1]}(${x.ts[2]}):${x.ts[4]}(${x.ts[5]}) · xG ${x.ts[3]}:${x.ts[6]} · Pass ${x.ts[7]}%:${x.ts[8]}%` : ""}</small></div>`).join("") : "<p>No matches yet.</p>";
  } else if (tab === "cup") {
    body = Object.entries(S.cups).map(([k, c]) => `<div class="ss-card"><h4>${CUPS[k].emoji} ${CUPS[k].name}</h4><div class="small">Teams: ${c.teams.map(esc).join(", ")}</div>${c.log.map((l) => `<div class="small">${esc(l)}</div>`).join("") || `<div class="small">Starts after Round ${CUPS[k].at[0]}</div>`}${c.winner ? `<div>🏆 <b>${esc(c.winner)}</b></div>` : c.alive.length > 1 ? `<div class="small">Still in: ${c.alive.map(esc).join(", ")}</div>` : ""}</div>`).join("");
  } else {
    const list = topBy(lgId, tab, 15);
    const extra = { kp: ["Key passes", (p) => p.s.kp || 0], pp: ["Pass%", (p) => passPct(p.s) + "%"], tc: ["Tackles", (p) => `${p.s.tc || 0}/${p.s.ta || 0}`] }[tab];
    body = list.length ? `<table class="tbl"><tr><th>#</th><th>Player</th><th>Club</th><th>Apps</th><th>⚽</th><th>🅰️</th>${extra ? `<th>${extra[0]}</th>` : ""}<th>Rating</th></tr>${list.map((p, i) =>
      `<tr class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><td>${i + 1}</td><td>${NATIONS[p.nat].flag}${pl(p)}${p.id === "rv" ? "⚔️" : ""}</td><td>${esc(shortName(p.c))}</td><td>${p.s.ap}</td><td>${p.s.g}</td><td>${p.s.a}</td>${extra ? `<td><b>${extra[1](p)}</b></td>` : ""}<td>${pAvg(p).toFixed(2)}</td></tr>`).join("")}</table>` : "<p>No records yet.</p>";
  }
  const p = modal({ title: "🏆 World Football", wide: true, html: `${divBtns}<div class="seg wrap lg-seg">${lgBtns}</div><div class="seg wrap lg-seg">${tabs}</div><div class="lg-body">${body}</div>`, buttons: [{ label: "Close", value: 1, cls: "btn-primary" }] });
  setTimeout(() => {
    document.querySelectorAll("#modal [data-lg]").forEach((b) => b.onclick = () => openLeague(+b.dataset.lg, tab));
    document.querySelectorAll("#modal [data-tab]").forEach((b) => b.onclick = () => openLeague(lgId, b.dataset.tab));
    bindPlayerLinks($("modal"));
    document.querySelectorAll("#modal [data-club]").forEach((a) => a.onclick = () => { $("modal").hidden = true; openSquad(a.dataset.club); });
  }, 0);
  return p;
}
function openSquad(club = S.pro.club) {
  const order = ["gk", "df", "mf", "wg", "fw"];
  const ps = clubPlayers(club).sort((a, b) => order.indexOf(a.r) - order.indexOf(b.r) || pOvr(b) - pOvr(a));
  const xi = bestXI(ps, false, formOf(club));
  const race = club === S.pro.club ? spotRace(club) : null;
  modal({
    title: `${crestHTML(club, 30)} ${esc(club)}`, wide: true,
    html: `<p class="small coach">${coachLine(club)}</p>${formationHTML(club, xi)}${race ? `<p class="small">${race.slots ? `${race.slots} ${ROLE_KO[S.pos]} slot(s)` : `⚠️ No ${ROLE_KO[S.pos]} slot in ${race.form}`} · Starting chance <b>${Math.round(race.p * 100)}%</b>${race.kth ? ` · Player to beat <b>${esc(race.kth.n)} ${Math.round(pOvr(race.kth))}</b>` : ""}</p>` : `<p class="small">${LEAGUES[W.c[club].l].flag} ${LEAGUES[W.c[club].l].name} #${rankOf(club)}</p>`}
      <table class="tbl"><tr><th>Pos</th><th>Player</th><th>Age</th><th>OVR</th><th>Apps</th><th>⚽</th><th>🅰️</th><th>Rating</th></tr>${ps.map((p) =>
        `<tr class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><td>${ROLE_KO[p.r]}${xi.includes(p) ? (xi.roles[xi.indexOf(p)] !== p.r ? `→${ROLE_KO[xi.roles[xi.indexOf(p)]]}` : "") : " <small>Sub</small>"}</td><td><small>${p.id === "me" ? S.look.number : p.id === "rv" ? S.rival.look.number : p.no || ""}</small> ${NATIONS[p.nat].flag}<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>${p.inj > 0 ? " 🚑" : ""}</td><td>${ageOf(p)}</td><td><b>${Math.round(pOvr(p))}</b></td><td>${p.s.ap}</td><td>${p.s.g}</td><td>${p.s.a}</td><td>${p.s.ap ? pAvg(p).toFixed(1) : "-"}</td></tr>`).join("")}</table>`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => bindPlayerLinks($("modal")), 0);
}
function openPlayer(id) {
  const p = W.p[id]; if (!p) return;
  const st = sOf(p);
  const hist = [...(p.h || []).map(hObj), ...(p.s.ap || p.cs.ap ? [{ y: S.pro.season, c: p.c, ap: p.s.ap + p.cs.ap, g: p.s.g + p.cs.g, a: p.s.a + p.cs.a, r: Math.round(pAvg(p) * 100) / 100, now: true }] : [])];
  if (id === "me") return openCareer();
  $("modal").hidden = true;
  modal({
    title: `${NATIONS[p.nat].flag} ${esc(p.n)}${id === "rv" ? " ⚔️" : ""}`, wide: true,
    html: `<p class="small">${ROLE_KO[p.r]} · age ${ageOf(p)} · ${NATIONS[p.nat].name} · ${p.c ? `<a class="pl" data-club="${esc(p.c)}">${crestHTML(p.c, 14)} ${esc(p.c)}</a>` : "Free agent"} · OVR <b>${Math.round(pOvr(p))}</b> · Market value <b>${fmtMV(marketValue(p))}</b>${p.inj > 0 ? ` · 🚑 Injured ${p.inj} games` : ""}</p>
      <div class="roll">${STATS.map((s) => { const t5 = id === "rv" ? S.rival.talent[s.key] === 5 : (aiEnsure(p), aiTal(p, STAT_KEYS.indexOf(s.key)) === 5); return `<div><span>${s.emoji} ${s.name}</span><b class="${st[s.key] > 99 ? "over" : ""}">${Math.round(st[s.key])}</b><i class="${t5 ? "t5" : ""}">${id === "rv" ? talentStr(s.key, S.rival.talent[s.key], trOf(s.key, S.rival)) : aiTalentStr(p, s.key)}</i></div>`; }).join("")}</div>
      ${p.s.ap ? `<p class="label">This season in detail</p>${seasonStatHTML(p.s, p.r)}` : ""}
      <table class="tbl"><tr><th>Season</th><th>Club</th><th>Apps</th><th>⚽</th><th>🅰️</th><th>Pass%</th><th>Key passes</th><th>Rating</th></tr>${hist.slice().reverse().map((h) => `<tr><td>${h.y}${h.now ? "*" : ""}</td><td>${esc(shortName(h.c))}</td><td>${h.ap}</td><td>${h.g}</td><td>${h.a}</td><td>${h.now ? passPct(p.s) : h.pp ?? "-"}</td><td>${h.now ? p.s.kp || 0 : h.kp ?? "-"}</td><td>${h.r ? h.r.toFixed(2) : "-"}</td></tr>`).join("")}</table>
      <p class="small">Career ⚽ ${hist.reduce((s, h) => s + h.g, 0)} · 🅰️ ${hist.reduce((s, h) => s + h.a, 0)} (since records began)</p>`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => document.querySelectorAll("#modal [data-club]").forEach((a) => a.onclick = () => { $("modal").hidden = true; openSquad(a.dataset.club); }), 0);
}
function openNews() {
  modal({ title: "📰 Football News", wide: true, html: `<div class="news-list">${(S.news || []).map((n) => `<div><small>${n.t}</small> ${esc(n.m)}</div>`).join("") || "<p>No news yet.</p>"}</div>`, buttons: [{ label: "Close", value: 1, cls: "btn-primary" }] });
}

/* ---------- 은퇴 / 선수 카드 ---------- */
/* 명예의 전당 점수: 난이도 배율 (쉬움 ×0.8, 보통 ×1, 어려움 ×1.2) */
function hofTtl(e) { if (e && e.ttl) return e.ttl; let d = e && e.d; if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } } return (d && d.ttl) || ""; }
function hofAdj(e) {
  let d = e && e.d; if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
  const raw = Number(e && e.score) || 0;
  return d && d.adj ? Math.round(raw) : Math.round(raw * ((DIFF[e && e.diff] || DIFF.normal).mult || 1));
}
function careerScore() { return Math.round(careerScoreRaw() * (DF().mult || 1)); }
function careerScoreRaw() {
  const c = S.career, pf = POS_F[S.pos] || 1;
  return Math.round(c.apps * .3 + (c.g + c.a * .8) * pf * .8 + c.mom * .5 + (c.awardScore || 0) + c.ballon * 60 + c.ballonTop3 * 20 + Math.max(0, c.peakOvr - 55) * 4 + c.peakTier * 15 + (c.caps || 0));
}
function gradeOf(sc) { let g = CAREER_GRADES[0][1]; for (const [t, n] of CAREER_GRADES) if (sc >= t) g = n; return g; }
async function retire() {
  const sc = careerScore(), grade = gradeOf(sc);
  if (typeof track === "function") track("retire", { score: sc, seasons: S.career.seasons.length, age: S.age, ballon: S.career.ballon });
  if (typeof achToast === "function") achToast({ retire: true });
  S.phase = "retired"; S.pending = null;
  const entry = { name: S.name, pos: S.pos, look: S.look, kit: S.pro.kit, grade, score: sc, peak: S.career.peakOvr, apps: S.career.apps, g: S.career.g, a: S.career.a,
    ballon: S.career.ballon, trophies: S.career.trophies.length, rival: S.rival.name, h2h: { ...S.h2h }, date: new Date().toISOString().slice(0, 10), diff: S.diff || "normal", ttl: S.title && typeof titleName === "function" ? titleName(S.title) : "", d: hofDetailData() };
  const hof = JSON.parse(localStorage.getItem(HOF_KEY) || "[]"); hof.push(entry); hof.sort((a, b) => b.score - a.score); localStorage.setItem(HOF_KEY, JSON.stringify(hof.slice(0, 30)));
  if (typeof hofSubmit === "function") hofSubmit(entry).then((ok) => ok && toast("🌍 Inducted into the World Hall of Fame!", 3000));
  if (Sfx.fanfare) Sfx.fanfare();
  save();
  show("scr-end");
  const rv = S.rival;
  const cmp = S.career.g + S.career.a - (rv.career.g + rv.career.a);
  $("end-body").innerHTML = `<div class="end-hero">${S.title && typeof titleName === "function" ? `<p class="ttl-end">${titleName(S.title)}</p>` : ""}<p>${esc(S.name)}, age ${S.age}. After a ${S.career.apps}-game journey, it's time to hang up the boots.</p></div>
    <canvas id="card" width="540" height="820"></canvas>
    <div class="end-rv"><b>⚔️ How the rivalry ended</b><p>${rivalEnding()}</p>
      <div>Career Me ⚽${S.career.g} 🅰️${S.career.a} 🏅${S.career.ballon} · ${esc(rv.name)} ⚽${rv.career.g} 🅰️${rv.career.a} 🏅${rv.career.ballon}</div>
      <div>H2H ${S.h2h.w}W ${S.h2h.d}D ${S.h2h.l}L · ${cmp > 0 ? "You led in goal contributions" : cmp < 0 ? "Your rival led in goal contributions" : "Goal contributions tied"}</div></div>
    <div class="end-list"><b>🏆 Career</b>${S.career.awards.slice(-12).map((t) => `<div>${t}</div>`).join("") || "<div>-</div>"}</div>`;
  drawCard($("card"), entry);
  $("b-share").onclick = shareCard;
}
function rivalEnding() {
  const rel = S.rival.rel, n = esc(S.rival.name);
  if (rel >= 40) return `On retirement day, ${josa(n, "이/가")} showed up with flowers. "I wouldn't have made it this far without you." The two laughed for a long time.`;
  if (rel >= 10) return `${josa(n, "은/는")} posted a short note online: "To my greatest rival. Well played." A rivalry that ended in respect.`;
  if (rel > -10) return `The rivalry with ${josa(n, "과/와")} stayed neck and neck to the end. Reporters remember the two as the twin faces of an era.`;
  if (rel > -40) return `${josa(n, "은/는")} replied to the retirement news: "Finally, some peace." They kept each other in check to the very end.`;
  return `You never made peace with ${josa(n, "과/와")}. But fans remember your clashes as the league's greatest derby.`;
}
function drawCard(cv, e) {
  const ctx = cv.getContext("2d"), W = 540, H = 820;
  const top = e.peak >= 88 ? ["#3a2a00", "#f5c542"] : e.peak >= 78 ? ["#1d2d4a", "#9fc3ff"] : ["#132a1d", "#6ee7a0"];
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, top[0]); g.addColorStop(1, "#0b1210");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = top[1]; ctx.lineWidth = 6; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = top[1]; ctx.font = "bold 92px Jua, sans-serif"; ctx.textAlign = "left"; ctx.fillText(String(Math.round(e.peak)), 44, 130);
  ctx.font = "bold 34px Jua, sans-serif"; ctx.fillText(POS[e.pos].short, 50, 175);
  drawAvatar(ctx, W / 2 + 60, 60, 300, e.look, e.kit, { mood: "joy" });
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "bold 48px Jua, sans-serif"; ctx.fillText(e.name, W / 2, 420);
  ctx.font = "24px Jua, sans-serif"; ctx.fillStyle = top[1]; ctx.fillText(e.grade, W / 2, 460);
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 490); ctx.lineTo(W - 60, 490); ctx.stroke();
  ctx.font = "bold 26px Jua, sans-serif"; ctx.fillStyle = "#fff";
  STATS.forEach((s, i) => {
    const x = i < 3 ? 110 : 330, y = 535 + (i % 3) * 44;
    ctx.textAlign = "left"; ctx.fillStyle = top[1]; ctx.fillText(String(Math.round(S.stats[s.key])), x, y);
    ctx.fillStyle = "#e8efe9"; ctx.fillText(s.name, x + 60, y);
  });
  ctx.textAlign = "center"; ctx.font = "24px Jua, sans-serif"; ctx.fillStyle = "#e8efe9";
  ctx.fillText(`${e.apps} apps · ⚽ ${e.g} · 🅰️ ${e.a} · 🏆 ${e.trophies} · 🏅 ${e.ballon}`, W / 2, 690);
  ctx.fillStyle = "#ff9a9a"; ctx.fillText(`⚔️ vs ${e.rival}  ${e.h2h.w}W ${e.h2h.d}D ${e.h2h.l}L`, W / 2, 730);
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "18px Jua, sans-serif"; ctx.fillText("The Winger 2: Rival", W / 2, 785);
}
async function shareCard() {
  const cv = $("card");
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const file = new File([blob], "the-winger-card.png", { type: "image/png" });
  const text = `⚽ ${S.name}'s career is over! ${gradeOf(careerScore())} · ⚽${S.career.g} 🅰️${S.career.a} 🏅Ballon d'Or x${S.career.ballon}\n#TheWinger2 ${location.href}`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch {}
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "the-winger-card.png"; a.click();
  try { await navigator.clipboard.writeText(text); toast("Card saved and result text copied"); } catch { toast("Card saved"); }
}

/* ---------- 모달들 ---------- */
function openRival() {
  const rv = S.rival, t = RIVAL_TYPES.find((x) => x.id === rv.type);
  const rows = STATS.map((s) => {
    const a = Math.round(S.stats[s.key]), b = Math.round(rv.stats[s.key]);
    return `<div class="cmp-row"><b class="${a > b ? "up" : ""}">${a}</b><span>${s.emoji} ${s.name}</span><b class="${b > a ? "dn" : ""}">${b}</b></div>`;
  }).join("");
  modal({
    title: `⚔️ ${esc(rv.name)}`, wide: true,
    html: `<div class="rv-modal"><div id="rvm-av"></div><div><b>${t.mood} ${t.name}</b><br/>${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].name} · ${POS[rv.pos].name} · age ${rv.age}<br/>${rv.club ? `${LEAGUES[rv.league].flag} ${esc(rv.club)}` : ORIGINS[rv.origin].team}<br/>Relationship ${relLabel(rv.rel)} (${rv.rel})</div></div>
      <div class="cmp-head"><span>Me</span><span>Stats</span><span>Rival</span></div>${rows}
      <div class="cmp-row tot"><b>${OVR()}</b><span>OVR</span><b>${ROVR()}</b></div>
      <p class="small">H2H ${S.h2h.w}W ${S.h2h.d}D ${S.h2h.l}L${rv.career.g || rv.career.a ? ` · Rival career ⚽${rv.career.g} 🅰️${rv.career.a}` : ""}${rv.career.ballon ? ` · 🏅${rv.career.ballon}` : ""}</p>
      <p class="small">💡 Event choices change your relationship. A good relationship brings offers to train together and changes the retirement ending.</p>`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => { const el = $("rvm-av"); if (el) el.appendChild(avatarCanvas(rv.look, rivalKit(), 80, { mood: "smug" })); }, 0);
}
/* 수비 기록 합계 (시즌 기록에 있는 것만. 옛 시즌은 태클만 있을 수 있어요) */
function defTotals(seasons) {
  const t = { tc: 0, ic: 0, cl: 0, cs: 0, sv: 0, n: 0 };
  for (const s of seasons || []) { if (s.ic != null) t.n++; t.tc += s.tc || 0; t.ic += s.ic || 0; t.cl += s.cl || 0; t.cs += s.cs || 0; t.sv += s.sv || 0; }
  return t;
}
function openCareer() {
  const c = S.career, isDef = S.pos === "df" || S.pos === "gk", DT = defTotals(c.seasons);
  const yRows = S.youth.apps ? `<p class="small">Youth ${S.youth.apps} apps ⚽${S.youth.g} 🅰️${S.youth.a} · ${S.youth.trophies} titles · Avg ${avg(S.youth.ratings).toFixed(2)}</p>` : "";
  const rows = c.seasons.map((s) => `<tr><td>${s.season}</td><td>${esc(shortName(s.club))}</td><td>${s.rank}</td><td>${s.apps}</td><td>${s.g}</td><td>${s.a}</td>${isDef ? `<td>${s.tc ?? "-"}</td><td>${s.ic ?? "-"}</td><td>${S.pos === "gk" ? (s.sv ?? "-") : (s.cs ?? "-")}</td>` : `<td>${s.pp ?? "-"}</td><td>${s.kp ?? "-"}</td>`}<td>${s.avg ? s.avg.toFixed(2) : "-"}</td><td>${s.ballon}</td></tr>`).join("");
  modal({
    title: "📊 Career", wide: true,
    html: `${yRows}${rows ? `<table class="tbl"><tr><th>Season</th><th>Club</th><th>Rank</th><th>Apps</th><th>⚽</th><th>🅰️</th>${isDef ? `<th>${T("태클", "Tkl")}</th><th>${T("가로채기", "Int")}</th><th>${S.pos === "gk" ? T("선방", "Saves") : T("무실점", "CS")}</th>` : `<th>Pass%</th><th>Key passes</th>`}<th>Rating</th><th>Ballon</th></tr>${rows}</table>` : "<p>No pro records yet.</p>"}
      ${S.phase === "pro" && W && W.p.me.s.ap ? `<p class="label">This season in detail (League)</p>${seasonStatHTML(W.p.me.s)}` : ""}
      <p class="label">Career totals (up to last season)</p>
      <div class="mystats"><span><b>${c.apps}</b><small>Apps</small></span><span><b>${c.g}</b><small>⚽ Goals</small></span><span><b>${c.a}</b><small>🅰️ Assists</small></span><span><b>${c.mom}</b><small>⭐ MOM</small></span>${isDef ? `<span><b>${DT.tc}</b><small>${T("🛡️ 태클", "🛡️ Tackles")}</small></span><span><b>${DT.ic}</b><small>${T("✂️ 가로채기", "✂️ Interceptions")}</small></span><span><b>${S.pos === "gk" ? DT.sv : DT.cs}</b><small>${S.pos === "gk" ? T("🧤 선방", "🧤 Saves") : T("🧱 무실점", "🧱 Clean sheets")}</small></span>` : ""}<span><b>${c.caps || 0}</b><small>🇰🇷 Caps · ${(c.ig || 0) + (c.wcG || 0)} goals</small></span><span><b class="fm">${fameGrade(S.fame).name}</b><small>Fame</small></span></div>
      ${c.wc && c.wc.length ? `<div class="car-wc">${c.wc.map((w) => `<span>🌍 ${esc(w)}</span>`).join("")}</div>` : ""}
      ${c.awards.length ? `<p class="label">Trophies & awards</p><div class="aw-list">${c.awards.map((a) => `<span>${a}</span>`).join("")}</div>` : ""}
      ${S.phase === "pro" ? `<div class="car-score"><span>Current career score</span><b>${careerScore()}</b><em>${gradeOf(careerScore())}</em></div>` : ""}`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }],
  });
}
/* 능력치 줄을 누르면: 숙련도와 재능 설명 */
function openMast(k) {
  const s = STATS.find((x) => x.key === k), have = (S.mast && S.mast[k]) || 0, need = mastNeed(k), star = S.talent[k], tr = trOf(k);
  const next = star < 5 ? `Talent ★${star + 1}` : TRANS_NAME[tr + 1];
  if (atCapOf(k) || star >= 5) return modal({ emoji: s.emoji, title: T(`${s.name} 초월`, `${s.name} breakthrough`),
    html: `<ul class="tip-list"><li>${T("지금 재능", "Talent")} <b>${talentStr(k)}</b>, ${T("능력치", "stat")} <b>${Math.round(S.stats[k])}</b> / ${T("최대", "max")} <b>${statCap(k)}</b></li>
      ${tr < 3 ? `<li>${T(`🌌 초월 게이지 <b>${Math.round(tgOf(k))}%</b> · 다음 도전 성공 확률 <b>${transChance(k)}%</b>`, `🌌 Gauge <b>${Math.round(tgOf(k))}%</b> · next try <b>${transChance(k)}%</b>`)}</li>
      <li>${T(`최대치에 닿으면 훈련이 <b>초월 도전</b>이 돼요. 확률 = 기본 ${TR_BASE[tr]}% + 재능 ★ ${star}% + 게이지 × 0.1. 실패할 때마다 게이지가 차고, 꽉 차면 다음 도전은 <b>확정 성공</b>이에요(최대 ${TR_PITY[tr] + 1}번).`, `At max, training becomes a <b>breakthrough try</b>. Chance = base ${TR_BASE[tr]}% + talent ★ ${star}% + gauge × 0.1. Each fail fills the gauge; when full the next try <b>always succeeds</b> (at most ${TR_PITY[tr] + 1} tries).`)}</li>
      <li>${T("성공하면 초월 단계 +1, 최대치 +2, 능력치 +1~2. 피로는 보통 훈련의 절반이에요. MOM·해외 연수·재능 개발 프로그램도 게이지를 채워요.", "Success: +1 tier, max +2, stat +1~2. Half the usual fatigue. MOM, training camps and the talent program also fill the gauge.")}</li>
      <li>${T(`🔥 <b>모험 도전</b>을 고르면 성공 확률이 2배(지금 ${boldCh(transChance(k))}%)지만, 실패하면 능력치가 1 떨어져서 훈련으로 다시 최대치를 채워야 해요. 게이지는 똑같이 차요. 도전 방식은 훈련 버튼 위에서 바꿔요.`, `🔥 A <b>bold try</b> doubles the odds (now ${boldCh(transChance(k))}%), but a fail drops the stat by 1, so you must train it back to max first. The gauge still fills. Switch modes above the training buttons.`)}</li>`
      : `<li>${T("🎯 초월 III 완성! 이제 이 능력치 훈련은 <b>감각 훈련</b>이에요. 다음 경기에서만 이 능력치가 +5로 계산돼요(피로 절반).", "🎯 Transcendence III complete! Training this stat is now <b>sharpness</b>: +5 to it for your next match only (half fatigue).")}</li>`}
      <li>${T("초월은 Ⅰ~Ⅲ까지, 단계마다 최대치가 2씩 올라 105까지 가고 나이 들어 떨어지는 폭도 줄어요. 라이벌과 세계의 모든 선수도 같은 확률 규칙이에요.", "Tiers I-III raise the max by 2 each (up to 105) and slow aging decline. Your rival and every player use the same odds.")}</li></ul>`,
    buttons: [{ label: T("닫기", "Close"), value: 1, cls: "btn-primary" }] });
  modal({ emoji: s.emoji, title: `${s.name} mastery`,
    html: `<ul class="tip-list"><li>Talent <b>${talentStr(k)}</b>, rating <b>${Math.round(S.stats[k])}</b> / max <b>${statCap(k)}</b></li>
      <li>Mastery <b>${need ? `${have} / ${need}` : "Complete"}</b>${need ? ` · when full: <b>${next}</b>` : ""}</li>
      <li>Training this stat builds mastery. At max (99), training becomes a 🌌 breakthrough try. MOM awards, overseas training and the talent program also add to it.</li>
      <li>Higher talent ★ means bigger training gains and better breakthrough odds at max. Transcendence (I to III) raises the max by 2 each, up to 105.</li></ul>`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }] });
}
function shortName(n) { return n.length > 12 ? n.slice(0, 12) + "…" : n; }
function migrateLife() {
  S.gear = S.gear || {};
  for (const it of SHOP2) if (S.gear[it.id] == null) S.gear[it.id] = 0;
  if (S.flags.agent && !S.gear.agent) S.gear.agent = 1;
  if (S.trust == null) S.trust = 50;
  S.mast = S.mast || {}; S.trans = S.trans || {};
  S.rival.mast = S.rival.mast || {}; S.rival.trans = S.rival.trans || {};
  // v2.2: ★5 뒤(또는 최대치에서) 쌓아 둔 숙련은 같은 비율만큼 초월 게이지로 옮겨요
  if (S.trV !== 1) {
    for (const E of [S, S.rival]) for (const k of STAT_KEYS) {
      const m = (E.mast && E.mast[k]) || 0, tr = trOf(k, E);
      if (!m || tr >= 3) continue;
      if (E.talent[k] >= 5) { addTg(k, Math.min(95, m / [30, 40, 50][tr] * 100), E); E.mast[k] = 0; }
      else if (atCapOf(k, E)) { addTg(k, Math.min(95, m / MAST_NEED[E.talent[k]] * 100), E); E.mast[k] = 0; }
    }
    S.trV = 1;
  }
}
function openHelp() {
  modal({
    title: "❓ Help", wide: true,
    html: `<div class="help">
      <p><b>🏋️ Training & Condition</b><br/>Training raises stats and lowers Condition. Below 50 Condition, training gets less effective, and training that drops you under 30 risks injury. Buttons show the risk level.</p>
      <p><b>👔 Coach trust · ✍️ Contract</b><br/>Coach trust goes up and down with your match ratings and choices, and it affects the fight for a starting spot. If the coach changes or you transfer, you build it up again. Pro contracts have a length, match fee and release clause, and a transfer during a contract needs the club's OK. When a contract ends, you can sign a renewal or leave on a free.</p>
      <p><b>📡 Just happened</b><br/>Real things from matches and the world, like hat-tricks, losing streaks, coach changes, reaching a final, a rival's injury or an international call-up, turn into next turn's events.</p>
      <p><b>🛍️ Shop · ⭐ Fame grades</b><br/>Gear is permanent, Staff has a cost each season, and Consumables are used right away. Giving raises Fame. Fame shows as grades from Unknown → Prospect → … → Football Icon.</p>
      <p><b>🎉 Fever Time · 📢 Notices · 🏛️ World Hall of Fame</b><br/>During live events a Fever banner appears at the top, with bonuses to Training, Mastery, Fame and match fees. Read Notices from the title screen and the 📢 button. When you retire, your Career joins the World Hall of Fame ranking.</p>
      <p><b>🏆 Youth tournament</b><br/>8 teams play a round robin in 2 groups, and the top 2 of each group go to the Semi-final, then the Final. You can meet your Rival's team in the Group stage, Semi-final or Final.</p>
      <p><b>☁️ Saving</b><br/>Every match result is saved right away, with automatic cloud backup. In ⚙️ → ☁️ you can continue on another device with an 8-character transfer code, or link a Google account.</p>
      <p><b>⭐ Talent · 🧬 Awakening · 🌌 Transcend</b><br/>Each star gives +15% training growth (★1 x0.85 to ★5 x1.45). The purple line under each stat bar is Mastery. It fills through Training (🔥 buffed training counts double), MOTM, overseas camps and talent programs, and when full you get +1 star. Once a stat hits its max (99), training becomes a 🌌 breakthrough try: a chance at Transcend I–III (max +2 each, up to 105). Each fail fills the sky-blue gauge and raises the odds; a full gauge guarantees success. After Transcend III it becomes 🎯 sharpness training (+5 for the next match only). Your Rival and every player in the world gain stars and Transcend by the same rules (check player profiles).</p>
      <p><b>⚔️ Rival</b><br/>Your Rival grows every month too. You keep clashing in cup finals, league head-to-heads, the Golden Boot and the Ballon d'Or. Event choices change your relationship and the ending.</p>
      <p><b>🔥 Key moment minigames</b><br/>When a chance involving you comes up in a match, you play it yourself. Each position gets different ones more often.</p>
      <ul>
        <li><b>⚽ Shot</b> (Forward · Winger): Pick a spot away from the keeper out of 9 zones, then stop the power gauge in the green. Too hard and it flies over the bar, too soft and it gets saved.</li>
        <li><b>🏃 1v1 dribble</b> (Winger · Forward): When the defender leans one way (red arrow), burst past on the other side.</li>
        <li><b>🎯 Through ball</b> (Midfielder): Of three teammates making runs, tap the unmarked one before they cross the offside line.</li>
        <li><b>🛡️ Tackle</b> (Defender · Midfielder): Tackle when the opponent knocks the ball too far (green)! Go in too early and it's a foul and a Yellow card.</li>
        <li><b>🥅 Penalty · Penalty shoot-out</b>: If you're the team's best shooter, you take it. Drawn cup games and Finals go to a Penalty shoot-out.</li>
      </ul>
      <p>Higher stats mean wider success zones and slower gauges. Turn on 🤖 Auto and it's calculated with the same odds as AI players.</p>
      <p><b>🌍 Football world</b><br/>1,920 players at 120 clubs in 12 leagues (top and second tiers of Korea, Japan, Netherlands, Portugal, Spain and England) really play every round. At season end the bottom 2 of each top tier swap places with the top 2 of the second tier. Every match uses the same engine: midfield battles create chances, and the real stats of shooters, passers, defenders and keepers decide the outcome. Players age, grow, transfer and retire.</p>
      <p><b>📅 Pro</b><br/>${ROUNDS} rounds a season (home & away). You start only if you beat teammates in your position. Finish high in the league to play next season's continental cup (Champions Cup · Asian Champions Cup), and there's a World Cup every 4 seasons. You can retire from age 31, and the season you turn 36 is your last.</p>
      <p><b>🎚️ Difficulty</b><br/>Easy, Normal and Hard change growth speed, injuries, how tough your Rival is, transfer offers and shooting minigame difficulty.</p></div>`,
    buttons: [{ label: "Close", value: 1, cls: "btn-primary" }],
  });
}
/* 명예의 전당 상세 — 은퇴할 때 커리어를 짧게 묶어 둬요 (세계 랭킹에도 같이 올라가요, 6000자 안) */
function hofDetailData() {
  const c = S.career, cut = (x, n) => String(x == null ? "" : x).slice(0, n);
  const d = {
    adj: 1, ttl: S.title && typeof titleName === "function" ? titleName(S.title) : "", ag: S.age, org: S.origin, mom: c.mom | 0, caps: c.caps | 0, ig: ((c.ig || 0) + (c.wcG || 0)) | 0, fame: cut(fameGrade(S.fame).name, 16),
    y: S.youth ? [S.youth.apps | 0, S.youth.g | 0, S.youth.a | 0, S.youth.trophies | 0] : null,
    s: c.seasons.slice(-25).map((s) => [s.season | 0, cut(s.club, 16), s.league | 0, s.rank | 0, s.apps | 0, s.g | 0, s.a | 0, Math.round((s.avg || 0) * 100), s.ballon | 0, s.tc | 0, s.ic | 0, s.cs | 0, s.sv | 0]),
    tr: c.trophies.slice(-20).map((t) => cut(t, 28)), aw: c.awards.slice(-20).map((t) => cut(t, 28)), wc: (c.wc || []).slice(0, 6).map((t) => cut(t, 20)),
    rv: [S.h2h.w | 0, S.h2h.d | 0, S.h2h.l | 0], df: (() => { const t = defTotals(c.seasons); return [t.tc, t.ic, t.cl, t.cs, t.sv]; })(), rvs: S.rival.career ? [S.rival.career.g | 0, S.rival.career.a | 0, S.rival.career.ballon | 0] : null,
  };
  while (JSON.stringify(d).length > 5800 && (d.aw.length || d.s.length > 5)) { if (d.aw.length > 5) d.aw.shift(); else if (d.s.length > 5) d.s.shift(); else d.aw.shift(); }
  return d;
}
function openHofDetail(e, rank) {
  let d = e.d;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = null; } }
  if (!d || typeof d !== "object") d = null;
  const N = (x) => Number.isFinite(+x) ? Math.round(+x) : 0, A = (x) => Array.isArray(x) ? x : [];
  const h2h = e.h2h ? [e.h2h.w, e.h2h.d, e.h2h.l] : d && A(d.rv).length === 3 ? d.rv : null;
  const org = (d && d.org) || e.origin;
  const head = `<div class="hd-head"><div class="hav" id="hd-av"></div><div><b>${esc(e.name)}</b>${hofTtl(e) ? `<i class="ttl">${esc(hofTtl(e))}</i>` : ""}<small>${POS[e.pos] ? POS[e.pos].name : ""}${ORIGINS[org] ? " · " + ORIGINS[org].flag + " " + ORIGINS[org].name : ""}${d && d.ag ? ` · retired at ${N(d.ag)}` : ""}</small><span>${esc(gradeOf(hofAdj(e)))}</span></div><em>${rank ? "#" + rank + "<br/>" : ""}${hofAdj(e)} pts</em></div>`;
  const chips = [["Apps", N(e.apps)], ["⚽ Goals", N(e.g)], ["🅰️ Assists", N(e.a)], ["Peak rating", N(e.peak)], ["🏆 Champions", N(e.trophies)], ["🏅 Ballon d'Or", N(e.ballon)]];
  if (d) chips.push(["⭐ MOM", N(d.mom)], [`Caps · ${N(d.ig)} goals`, N(d.caps)]);
  const isDef = e.pos === "df" || e.pos === "gk", dfT = d && A(d.df).length === 5 ? d.df : null;
  if (isDef && dfT) chips.push([T("🛡️ 태클", "🛡️ Tackles"), N(dfT[0])], [T("✂️ 가로채기", "✂️ Interceptions"), N(dfT[1])], e.pos === "gk" ? [T("🧤 선방", "🧤 Saves"), N(dfT[4])] : [T("🧱 무실점", "🧱 Clean sheets"), N(dfT[3])]);
  let html = head + `<div class="hd-chips">${chips.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join("")}</div>`;
  if (d && A(d.s).length) {
    html += `<p class="label">Seasons</p><div class="hd-scroll"><table class="tbl"><tr><th>Season</th><th>Club</th><th>Pos</th><th>Apps</th>${isDef && dfT ? `<th>${T("태클", "Tkl")}</th><th>${T("가로채기", "Int")}</th><th>${e.pos === "gk" ? T("선방", "Sv") : T("무실점", "CS")}</th>` : "<th>⚽</th><th>🅰️</th>"}<th>Rating</th><th>Ballon</th></tr>${A(d.s).map((s) => { s = A(s); const lg = LEAGUES[N(s[2])]; return `<tr><td>${N(s[0])}</td><td>${lg ? lg.flag + " " : ""}${esc(shortName(String(s[1] || "")))}</td><td>${N(s[3]) || "-"}</td><td>${N(s[4])}</td>${isDef && dfT ? (s.length > 9 ? `<td>${N(s[9])}</td><td>${N(s[10])}</td><td>${N(e.pos === "gk" ? s[12] : s[11])}</td>` : "<td>-</td><td>-</td><td>-</td>") : `<td>${N(s[5])}</td><td>${N(s[6])}</td>`}<td>${s[7] ? (N(s[7]) / 100).toFixed(2) : "-"}</td><td>${N(s[8]) ? "#" + N(s[8]) : "-"}</td></tr>`; }).join("")}</table></div>`;
  } else if (e.club) html += `<p class="small">Last club: ${esc(e.club)}</p>`;
  if (isDef && !dfT) html += `<p class="small">${T("수비 기록(태클 · 가로채기 · 무실점)은 v2.4.2 이후 은퇴한 선수부터 보여요", "Defensive stats (tackles, interceptions, clean sheets) show for players retired after v2.4.2")}</p>`;
  const tr = d ? A(d.tr) : [], aw = d ? A(d.aw) : [], wc = d ? A(d.wc) : [];
  if (tr.length || aw.length || wc.length) html += `<p class="label">Trophies & awards</p><div class="aw-list">${[...tr.map((t) => "🏆 " + esc(t)), ...wc.map((t) => "🌍 World Cup " + esc(t)), ...aw.map((t) => esc(t))].map((a) => `<span>${a}</span>`).join("")}</div>`;
  if (e.rival) html += `<p class="label">⚔️ Rival ${esc(e.rival)}</p><p class="small">${h2h ? `Head-to-head ${N(h2h[0])}W ${N(h2h[1])}D ${N(h2h[2])}L` : ""}${d && A(d.rvs).length === 3 ? ` · Rival career ⚽${N(d.rvs[0])} 🅰️${N(d.rvs[1])} 🏅${N(d.rvs[2])}` : ""}</p>`;
  if (d && A(d.y).length === 4 && d.y[0]) html += `<p class="small">Youth ${N(d.y[0])} apps ⚽${N(d.y[1])} 🅰️${N(d.y[2])} · ${N(d.y[3])} titles${d.fame ? " · " + esc(d.fame) : ""}</p>`;
  if (e.date) html += `<p class="small">Retired ${esc(e.date)}</p>`;
  modal({ title: "🏛️ Hall of Fame", wide: true, html, buttons: [{ label: "Close", value: 1, cls: "btn-primary" }] });
  setTimeout(() => { const av = document.getElementById("hd-av"); if (av) { try { av.appendChild(e.look ? avatarCanvas(e.look, e.kit, 56) : avatarCanvas({ face: FACE_IDS.includes(e.face) ? e.face : FACE_IDS[0], skin: 0, hair: 0, hairColor: 0, number: 0 }, [/^#[0-9a-f]{3,8}$/i.test(e.kit0) ? e.kit0 : "#3b7fd6", "#ffffff"], 56)); } catch { av.textContent = "⚽"; } } }, 0);
}
function openHof(tab = "world") {
  $("hof-tabs").innerHTML = `<button class="${tab === "world" ? "on" : ""}" data-ht="world">🌍 World ranking</button><button class="${tab === "mine" ? "on" : ""}" data-ht="mine">📱 My records</button>`;
  document.querySelectorAll("[data-ht]").forEach((b) => b.onclick = () => openHof(b.dataset.ht));
  if (tab === "world" && typeof openHofWorld === "function") { show("scr-hof"); return openHofWorld(); }
  const hof = JSON.parse(localStorage.getItem(HOF_KEY) || "[]").map((e) => ({ ...e, sc: hofAdj(e) })).sort((a, b) => b.sc - a.sc);
  $("hof-list").innerHTML = hof.length ? hof.map((e, i) => `<div class="hof-row"><span>${i + 1}</span><div class="hav" data-i="${i}"></div><div><b>${esc(e.name)} ${hofTtl(e) ? `<i class="ttl">${esc(hofTtl(e))}</i> ` : ""}<small>${POS[e.pos].short} · Peak ${Math.round(e.peak)}${DIFF[e.diff] && e.diff !== "normal" ? ` · ${DIFF[e.diff].name}&nbsp;×${DIFF[e.diff].mult}` : ""}</small></b><span>${gradeOf(e.sc)}</span><small>⚽${e.g} 🅰️${e.a} 🏆${e.trophies} 🏅${e.ballon} · vs ${esc(e.rival)} ${e.h2h.w}-${e.h2h.d}-${e.h2h.l}</small></div><em>${e.sc}</em></div>`).join("") : `<p class="hint">No retired players yet.</p>`;
  document.querySelectorAll("#hof-list .hav").forEach((d) => { const e = hof[+d.dataset.i]; d.appendChild(avatarCanvas(e.look, e.kit, 44)); const row = d.closest(".hof-row"); if (row) row.onclick = () => openHofDetail(e, +d.dataset.i + 1); });
  show("scr-hof");
}

/* ---------- 이어하기 ---------- */
async function resume() {
  S = load();
  if (!S) return initTitle();
  applyMem(S.lgMem);
  W = S.world || null;
  if (!S.diff) S.diff = "normal";
  // 옛 세이브는 비슷한 초상화를 골라 입혀요
  if (!S.look.face) S.look.face = FACE_IDS[((S.look.hair || 0) * 3 + (S.look.skin || 0)) % FACE_IDS.length];
  if (!S.rival.look.face) S.rival.look.face = FACE_IDS[((S.rival.look.hair || 0) * 3 + (S.rival.look.skin || 0) + 7) % FACE_IDS.length];
  migrateLife();
  if (S.phase === "pro") ensureWorld();
  if (S.phase === "pro" && !S.contract && S.pro) S.contract = { club: S.pro.club, years: 2, sal: Math.round(LEAGUES[S.pro.league].pay * Math.pow(OVR() / 65, 2)), rel: Math.max(1, Math.round(marketValue(W.p.me) * 1.6)), since: S.pro.season };
  if (S.phase === "pro") syncTrust();
  show("scr-main"); renderMain();
  if (!S.pending && typeof dailyCheck === "function") setTimeout(dailyCheck, 500);
  if (S.pending === "tournament") { /* 메인의 '대회장으로' 버튼에서 시작 */ }
  else if (S.pending === "match") { /* 메인의 '경기장으로' 버튼에서 시작 */ }
  else if (S.pending === "cups") await roundTail();
  else if (S.pending === "season") await seasonEnd();
  else if (S.pending === "offers") await youthEnd();
}

/* ---------- 오류가 나도 멈춘 채로 두지 않아요 ---------- */
window.addEventListener("unhandledrejection", (e) => { busy = false; console.error(e.reason); toast("⚠️ Something went wrong. Refresh the page to continue."); });
window.addEventListener("error", (e) => { busy = false; console.error(e.error || e.message); });

/* ---------- 시작 ---------- */
preloadFaces();
$("btn-new").onclick = async () => {
  const sv = load();
  if (sv && sv.phase !== "retired") {
    const ok = await modal({ emoji: "⚠️", title: "Start a new game?", html: `<p>Your current progress with <b>${esc(sv.name)}</b> will be lost.</p>`, buttons: [{ label: "New game", value: true, cls: "btn-primary" }, { label: "Cancel", value: false }] });
    if (!ok) return;
  }
  startCreate();
};
$("btn-continue").onclick = resume;
$("btn-xfer").onclick = () => openCloud();
/* 탭을 닫거나 앱을 내릴 때 마지막 저장본을 클라우드에 올려요 */
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && S && S.name) { clearTimeout(cloudTimer); cloudPut(); } });
$("btn-hof").onclick = () => openHof();
$("btn-notice").onclick = () => openNotices();
$("btn-hof-back").onclick = initTitle;
$("btn-create-home").onclick = initTitle;
$("b-again").onclick = () => { localStorage.removeItem(SAVE_KEY); initTitle(); };
initTitle();
