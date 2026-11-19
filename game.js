/* 더 윙어 2 : 라이벌 - 게임 본체 */
"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "w2-save-v1", HOF_KEY = "w2-hof-v1", TIP_KEY = "w2-tips";
const SET = JSON.parse(localStorage.getItem("w2-set") || "{}");
const saveSet = () => localStorage.setItem("w2-set", JSON.stringify(SET));
let S = null, busy = false;

const YOUTH_OPP = [["청해 유스", "#2b7bd6", "#fff"], ["북항 유스", "#222", "#ffd23f"], ["동림 아카데미", "#7a2b4a", "#fff"],
                   ["서강 유스", "#e4572e", "#fff"], ["리베라 유스", "#0b5b3a", "#fff"], ["포트밸리 아카데미", "#5a2a82", "#ffd23f"]];
const DIFF = {
  easy: { name: "쉬움", train: 1.15, inj: .6, rival: .92, offer: 3, shot: 1.2 },
  normal: { name: "보통", train: 1, inj: 1, rival: 1, offer: 0, shot: 1 },
  hard: { name: "어려움", train: .88, inj: 1.3, rival: 1.08, offer: -2, shot: .88 },
};
const DF = () => DIFF[(S && S.diff) || "normal"];

/* ---------- 기본 계산 ---------- */
function ovrOf(stats, pos) { const w = POS[pos].w; let s = 0; for (const k in w) s += stats[k] * w[k]; return s; }
const OVR = () => Math.round(ovrOf(S.stats, S.pos));
const ROVR = () => Math.round(ovrOf(S.rival.stats, S.rival.pos));
const talentMul = (stars) => .7 + stars * .15;
const starStr = (n) => "★".repeat(n) + "☆".repeat(5 - n);
function randomName(origin) {
  return origin === "kr" ? pick(KR_SUR) + pick(KR_GIVEN) : pick(EU_FIRST) + " " + pick(EU_LAST);
}
function rollStats(pos) {
  const st = {}, tal = {};
  for (const k of STAT_KEYS) { st[k] = randi(26, 36); tal[k] = Math.min(5, Math.max(1, Math.round(rand(.6, 4.4)))); }
  const top = Object.entries(POS[pos].w).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
  top.forEach((k) => { st[k] += randi(6, 10); });
  if (!STAT_KEYS.some((k) => tal[k] >= 4)) tal[pick(top)] = 4;
  return { stats: st, talent: tal };
}
function relLabel(rel) {
  return rel <= -40 ? "😡 앙숙" : rel <= -10 ? "😒 견제" : rel < 10 ? "⚔️ 라이벌" : rel < 40 ? "🤝 선의의 경쟁자" : "🫂 필드 위의 형제";
}
function fmtMoney(m) { return m >= 10000 ? (m / 10000).toFixed(1) + "억" : Math.round(m) + "만"; }
function formStr(f) { return f >= 2 ? "🔥 절정" : f === 1 ? "😊 좋음" : f === 0 ? "😐 보통" : f === -1 ? "😓 나쁨" : "🥶 최악"; }
function myKit() { return S.phase === "pro" ? S.pro.kit : ORIGINS[S.origin].kit; }
function rivalKit() {
  if (S.rival.club) { const c = clubData(S.rival.league, S.rival.club); if (c) return [c[2], c[3]]; }
  return ORIGINS[S.rival.origin].kit;
}
function clubData(lg, name) { return LEAGUES[lg].clubs.find((c) => c[0] === name); }

/* ---------- 저장 ---------- */
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

/* ---------- 화면 / 모달 / 토스트 ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}
function modal({ emoji = "", title = "", html = "", buttons = [{ label: "확인", value: true, cls: "btn-primary" }], wide = false, img = "" }) {
  return new Promise((resolve) => {
    const m = $("modal");
    m.innerHTML = `<div class="mbox ${wide ? "wide" : ""}">${img ? `<img class="m-img" src="${img}" alt="" />` : emoji ? `<div class="m-emoji">${emoji}</div>` : ""}${title ? `<h3>${title}</h3>` : ""}<div class="m-html">${html}</div>
      <div class="m-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || "btn-ghost"}" data-i="${i}">${b.label}${b.hint ? `<small>${b.hint}</small>` : ""}</button>`).join("")}</div></div>`;
    m.hidden = false;
    m.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { Sfx.tap(); m.hidden = true; m.innerHTML = ""; resolve(buttons[+b.dataset.i].value); });
  });
}
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("toast"); t.innerHTML = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
/* 처음 한 번만 뜨는 코치 한마디 — 시스템을 한꺼번에 설명하지 않고 필요할 때 하나씩 */
function tip(id, text) {
  const seen = JSON.parse(localStorage.getItem(TIP_KEY) || "{}");
  if (seen[id]) return Promise.resolve();
  seen[id] = 1; localStorage.setItem(TIP_KEY, JSON.stringify(seen));
  return modal({ emoji: "🧑‍🏫", title: "코치 한마디", html: `<p>${text}</p>`, buttons: [{ label: "알겠어요", value: 1, cls: "btn-primary" }] });
}
function addLog(msg) {
  const when = S.phase === "youth" ? `${S.year}년차 ${S.month}월` : `${S.pro.season}시즌 R${Math.min(S.pro.round + 1, ROUNDS)}`;
  S.log.unshift(`<span>${when}</span> ${msg}`); if (S.log.length > 40) S.log.length = 40;
}

/* ---------- 타이틀 ---------- */
function initTitle() {
  const sv = load();
  $("btn-continue").hidden = !sv || sv.phase === "retired";
  if (sv && sv.phase !== "retired") {
    $("btn-continue").innerHTML = `이어하기 <small>${esc(sv.name)} · ${sv.phase === "youth" ? `유스 ${sv.year}년차` : `${sv.pro.club} ${sv.pro.season}시즌`}</small>`;
  }
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
  C.look = { skin: randi(0, 3), hair: randi(0, 4), hairColor: randi(0, 2), number: 11 };
  C.origin = null; C.roll = rollStats(C.pos);
  renderCreate(); show("scr-create");
}
function renderCreate() {
  const el = $("create-body");
  $("create-step").textContent = `${C.step} / 3`;
  if (C.step === 1) {
    el.innerHTML = `
      <h2>✏️ 선수 등록</h2>
      <div class="name-row"><input id="in-name" maxlength="8" value="${esc(C.name)}" placeholder="이름"/><button class="btn btn-ghost sm" id="b-rname">🎲</button></div>
      <p class="label">포지션</p>
      <div class="pos-grid">${Object.entries(POS).map(([k, p]) => `<button class="card ${C.pos === k ? "on" : ""}" data-pos="${k}"><b>${p.emoji} ${p.name}</b><small>${p.desc}</small></button>`).join("")}</div>
      <p class="label">주발</p>
      <div class="seg">${[["L", "왼발"], ["R", "오른발"]].map(([k, n]) => `<button class="${C.foot === k ? "on" : ""}" data-foot="${k}">${n}</button>`).join("")}</div>
      <p class="label">난이도</p>
      <div class="seg">${Object.entries(DIFF).map(([k, d]) => `<button class="${C.diff === k ? "on" : ""}" data-diff="${k}">${d.name}</button>`).join("")}</div>
      <p class="small">${C.diff === "easy" ? "성장이 빠르고 부상이 적어요. 처음이라면 추천" : C.diff === "hard" ? "성장이 느리고 라이벌이 더 독해요. 세계 정상은 정말 어려워요" : "실제 축구처럼, 노력과 선택만큼 커요"}</p>
      <p class="label">타고난 재능 <small>(별이 많을수록 그 능력치가 빨리 자라요)</small></p>
      <div class="roll">${STATS.map((s) => `<div><span>${s.emoji} ${s.name}</span><b>${C.roll.stats[s.key]}</b><i>${starStr(C.roll.talent[s.key])}</i></div>`).join("")}</div>
      <button class="btn btn-ghost" id="b-reroll">🎲 재능 다시 뽑기</button>
      <button class="btn btn-primary" id="b-next">다음: 외모 꾸미기 →</button>`;
    $("in-name").oninput = (e) => (C.name = e.target.value.trim());
    $("b-rname").onclick = () => { C.name = randomName("kr"); renderCreate(); };
    el.querySelectorAll("[data-pos]").forEach((b) => b.onclick = () => { C.pos = b.dataset.pos; C.roll = rollStats(C.pos); renderCreate(); });
    el.querySelectorAll("[data-foot]").forEach((b) => b.onclick = () => { C.foot = b.dataset.foot; renderCreate(); });
    el.querySelectorAll("[data-diff]").forEach((b) => b.onclick = () => { C.diff = b.dataset.diff; renderCreate(); });
    $("b-reroll").onclick = () => { C.roll = rollStats(C.pos); Sfx.tap(); renderCreate(); };
    $("b-next").onclick = () => { if (!C.name) { toast("이름을 입력해 주세요"); return; } C.step = 2; renderCreate(); };
  } else if (C.step === 2) {
    el.innerHTML = `
      <h2>🎨 내 선수 꾸미기</h2>
      <div class="av-preview" id="av-prev"></div>
      <p class="label">피부</p><div class="sw">${SKINS.map((c, i) => `<button class="${C.look.skin === i ? "on" : ""}" data-skin="${i}" style="background:${c}"></button>`).join("")}</div>
      <p class="label">헤어</p><div class="seg wrap">${HAIR_STYLES.map((n, i) => `<button class="${C.look.hair === i ? "on" : ""}" data-hair="${i}">${n}</button>`).join("")}</div>
      <p class="label">헤어 색</p><div class="sw">${HAIR_COLORS.map((c, i) => `<button class="${C.look.hairColor === i ? "on" : ""}" data-hc="${i}" style="background:${c}"></button>`).join("")}</div>
      <p class="label">등번호</p><div class="num-row"><button class="btn btn-ghost sm" id="n-m">－</button><b id="n-v">${C.look.number}</b><button class="btn btn-ghost sm" id="n-p">＋</button></div>
      <button class="btn btn-primary" id="b-next">다음: 유스 고르기 →</button>
      <button class="btn btn-ghost" id="b-back">← 뒤로</button>`;
    $("av-prev").appendChild(avatarCanvas(C.look, ["#2a62c9", "#fff"], 150, { mood: "joy" }));
    el.querySelectorAll("[data-skin]").forEach((b) => b.onclick = () => { C.look.skin = +b.dataset.skin; renderCreate(); });
    el.querySelectorAll("[data-hair]").forEach((b) => b.onclick = () => { C.look.hair = +b.dataset.hair; renderCreate(); });
    el.querySelectorAll("[data-hc]").forEach((b) => b.onclick = () => { C.look.hairColor = +b.dataset.hc; renderCreate(); });
    $("n-m").onclick = () => { C.look.number = C.look.number <= 1 ? 99 : C.look.number - 1; renderCreate(); };
    $("n-p").onclick = () => { C.look.number = C.look.number >= 99 ? 1 : C.look.number + 1; renderCreate(); };
    $("b-next").onclick = () => { C.step = 3; renderCreate(); };
    $("b-back").onclick = () => { C.step = 1; renderCreate(); };
  } else {
    el.innerHTML = `
      <h2>🏟️ 어디서 시작할까요?</h2>
      <p class="hint">유스마다 잘 크는 능력치가 달라요.</p>
      <div class="org-grid">${Object.entries(ORIGINS).map(([k, o]) => {
        const best = Object.entries(o.mul).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => STAT_NAME[s]).join("·");
        return `<button class="card org ${C.origin === k ? "on" : ""}" data-org="${k}"><span class="flag">${o.flag}</span><b>${o.name}</b><em>${o.tag}</em><small>${o.desc}</small><i>잘 크는 능력치: ${best}</i></button>`;
      }).join("")}</div>
      <button class="btn btn-primary" id="b-next" ${C.origin ? "" : "disabled"}>입단하기 ⚽</button>
      <button class="btn btn-ghost" id="b-back">← 뒤로</button>`;
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
    look: { skin: randi(0, 4), hair: randi(0, 5), hairColor: randi(0, 6), number: pick([7, 9, 10, 17, 19, 23]) },
    rel: 0, age: 16, league: null, club: null, season: { g: 0, a: 0, r: [], apps: 0 },
    career: { g: 0, a: 0, trophies: 0, ballon: 0, awards: [] }, hurt: 0,
  };
}

function newGame() {
  S = {
    v: 4, diff: C.diff, name: C.name, pos: C.pos, foot: C.foot, look: { ...C.look }, origin: C.origin,
    stats: { ...C.roll.stats }, talent: { ...C.roll.talent },
    cond: 85, form: 0, fame: 0, money: 0, age: 16, phase: "youth", year: 1, month: 1, turn: 0,
    buff: 1, injured: 0, gear: { boots: 0, trainer: 0, recovery: 0 }, shopOpen: false,
    log: [], ev: {}, flags: {}, pending: null,
    youth: { trophies: 0, apps: 0, g: 0, a: 0, ratings: [] },
    rival: makeRival(), h2h: { w: 0, d: 0, l: 0 },
    pro: null, clubStr: null,
    career: { apps: 0, g: 0, a: 0, mom: 0, trophies: [], awards: [], seasons: [], peakOvr: 0, peakTier: 0, ballon: 0, ballonTop3: 0, caps: 0 },
    stars: WORLD_STARS.map(([n, o, a]) => ({ name: n, ovr: o, age: a })),
  };
  W = null;
  addLog(`⚽ ${ORIGINS[S.origin].name} 입단! ${S.name}의 축구 인생이 시작됐어요.`);
  save();
  showRivalIntro();
}

/* ---------- 라이벌 등장 ---------- */
function showRivalIntro() {
  const rv = S.rival, t = RIVAL_TYPES.find((x) => x.id === rv.type);
  const el = $("rival-body");
  el.innerHTML = `
    <p class="kicker">입단 첫날, 연습경기에서 만난…</p>
    <h2 class="rv-h">⚔️ 운명의 라이벌</h2>
    <div class="vs-row"><div id="rv-me"></div><b class="vs">VS</b><div id="rv-them"></div></div>
    <div class="rv-card">
      <b>${t.mood} ${esc(rv.name)}</b>
      <span>${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].name} · ${POS[rv.pos].name} · ${t.name}</span>
      <q>${t.quote}</q>
      <div class="cmp"><span>나 ${OVR()}</span><span>종합</span><span>${ROVR()} ${esc(rv.name)}</span></div>
    </div>
    <p class="hint">이 선수는 은퇴할 때까지 당신과 함께 자라요.<br/>대회에서, 리그에서, 발롱도르에서 계속 마주칠 거예요.</p>
    <button class="btn btn-primary" id="b-accept">🔥 받아들이겠어</button>`;
  $("rv-me").appendChild(avatarCanvas(S.look, myKit(), 110, { mood: "angry" }));
  $("rv-them").appendChild(avatarCanvas(rv.look, ORIGINS[rv.origin].kit, 110, { mood: "smug" }));
  $("b-accept").onclick = async () => {
    show("scr-main"); renderMain();
    await tip("t-start", "매달 훈련 하나를 골라요. 훈련하면 능력치가 오르고 <b>컨디션이 내려가요</b>.<br/>컨디션이 낮으면 훈련 효율이 떨어지고, <b>30 아래부터는 부상 위험</b>이 생겨요.<br/>위쪽 📅 일정에서 다음 대회까지 남은 달을 확인하세요.");
  };
  show("scr-rival");
}

/* ---------- 메인 화면 ---------- */
function nextScheduleText() {
  if (S.phase === "youth") {
    const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
    const name = S.month <= 6 ? "상반기 유스 리그" : (S.year === 3 ? "유스 챔피언십 (프로 스카우트 집결)" : "유스 챔피언십");
    return { left, name, text: left === 0 ? `🏆 이번 달 훈련 후 바로 <b>${name}</b>` : `📅 <b>${name}</b>까지 ${left}개월` };
  }
  const opp = S.pro.schedule[S.pro.round];
  const rivalMatch = S.rival.club === opp;
  return { left: 0, name: opp, text: `📅 R${S.pro.round + 1}/${ROUNDS} 다음 상대 <b>${esc(opp)}</b> (전력 ${Math.round(clubStr(S.pro.league, opp))})${rivalMatch ? ` <em class="rv">⚔️ 라이벌 매치</em>` : ""}` };
}
function trainPreview(k) {
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
    * ageMul() * (1 + S.gear.trainer * .1) * (S.cond >= 50 ? 1 : S.cond >= 25 ? .8 : .6) * (S.buff || 1)
    * DF().train * (S.phase === "pro" ? .65 : 1);
  const v = S.stats[k], dim = v >= 95 ? .25 : v >= 88 ? .4 : v >= 80 ? .6 : v >= 72 ? .85 : 1;
  // 한 능력치만 너무 앞서 나가면 잘 안 늘어요 (기초가 받쳐줘야 해요)
  const rel = v - ovrOf(S.stats, S.pos), relDim = rel > 25 ? .3 : rel > 15 ? .6 : 1;
  if (range) return [2.2 * base * dim * relDim, 3.8 * base * dim * relDim];
  return rand(2.2, 3.8) * base * dim * relDim;
}

/* 종합에 가장 많이 보탬이 되는 훈련 — 자동 진행·빠른 시즌이 써요 */
function bestTrainKey() {
  let best = null, bv = -1;
  for (const [k, w] of Object.entries(POS[S.pos].w)) {
    if (w <= 0 || S.stats[k] >= 99) continue;
    const g = trainGain(k, true), v = w * (g[0] + g[1]) / 2;
    if (v > bv) { bv = v; best = k; }
  }
  return best || mainStatOf(S.pos);
}

function renderMain() {
  const pro = S.phase === "pro";
  const hud = $("hud");
  hud.innerHTML = `
    <div class="hud-av" id="hud-av"></div>
    <div class="hud-id"><b>${esc(S.name)} <small>${POS[S.pos].short} · ${S.age}세</small></b>
      <span>${pro ? `${crestHTML(S.pro.club, 15)} ${esc(S.pro.club)}` : `${ORIGINS[S.origin].flag} ${ORIGINS[S.origin].team}`} · 종합 <em>${OVR()}</em></span></div>
    <div class="hud-r"><b>${pro ? `${S.pro.season}시즌` : `${S.year}년차 ${S.month}월`}</b><span>💰 ${fmtMoney(S.money)}</span></div>`;
  $("hud-av").appendChild(avatarCanvas(S.look, myKit(), 48));
  const ns = nextScheduleText();
  const warn = (S.phase === "youth" && ns.left <= 1 && S.cond < 55) || (pro && S.cond < 45);
  $("sched").innerHTML = ns.text + (warn ? `<div class="warn">⚠️ 경기를 앞두고 컨디션이 낮아요 (${Math.round(S.cond)}). 이번 턴은 <b>휴식</b>을 추천해요.</div>` : "");
  $("sched").classList.toggle("warn-on", warn);

  $("gauges").innerHTML = `
    <div class="g"><span>🩹 컨디션</span><div class="bar"><i class="${S.cond < 30 ? "low" : S.cond < 55 ? "mid" : ""}" style="width:${S.cond}%"></i></div><b>${Math.round(S.cond)}</b></div>
    <div class="g2"><span>폼 ${formStr(S.form)}</span><span>⭐ 명성 ${Math.round(S.fame)}</span>${S.buff > 1 ? `<span class="buff">🔥 다음 훈련 ×${S.buff}</span>` : ""}${S.injured ? `<span class="inj">🤕 부상 ${S.injured}턴</span>` : ""}</div>`;

  // 라이벌 카드
  const rv = S.rival, my = OVR(), ro = ROVR(), diff = my - ro;
  const rvLine = pro && rv.club
    ? `${LEAGUES[rv.league].flag} ${esc(rv.club)} · 시즌 ⚽${rvS().g} 🅰️${rvS().a} <small>(나 ⚽${S.pro.s.g} 🅰️${S.pro.s.a})</small>`
    : `${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].team} · ${POS[rv.pos].name}`;
  $("rival-card").innerHTML = `
    <div class="rc-av" id="rc-av"></div>
    <div class="rc-mid"><b>${esc(rv.name)} <small>${relLabel(rv.rel)}</small></b><span>${rvLine}</span>
      <div class="rc-bar"><i class="me" style="width:${clamp(50 + diff * 3, 8, 92)}%"></i></div>
      <span class="rc-cmp">나 <b>${my}</b> : <b>${ro}</b> 라이벌 ${diff > 0 ? `<em class="up">+${diff} 앞섬</em>` : diff < 0 ? `<em class="dn">${diff} 뒤짐</em>` : "<em>동률</em>"}</span></div>
    <span class="rc-more">›</span>`;
  $("rc-av").appendChild(avatarCanvas(rv.look, rivalKit(), 46, { mood: diff > 0 ? "angry" : "smug" }));
  $("rival-card").onclick = openRival;

  // 능력치
  $("stats").innerHTML = STATS.map((s) => {
    const v = S.stats[s.key], w = POS[S.pos].w[s.key];
    return `<div class="st ${w >= .2 ? "key" : ""}"><span>${s.emoji} ${s.name}</span><div class="bar"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b><em>${starStr(S.talent[s.key])}</em></div>`;
  }).join("");

  // 행동
  const risk = injuryRisk(), inj = S.injured > 0;
  let html = STATS.map((s) => `<button class="act" data-train="${s.key}" ${inj ? "disabled" : ""}><span>${s.emoji}</span><b>${s.name} 훈련</b><small>${trainPreview(s.key)}</small>${risk ? `<i class="risk">부상 ${risk}%</i>` : ""}</button>`).join("");
  html += `<button class="act rest" data-rest="1"><span>${inj ? "🏥" : "🛌"}</span><b>${inj ? "재활" : "휴식"}</b><small>컨디션 +${32 + S.gear.recovery * 8}</small></button>`;
  if (S.phase === "youth") html += `<button class="act auto" data-auto="1" ${inj ? "disabled" : ""}><span>⏩</span><b>자동 진행</b><small>대회 직전까지</small></button>`;
  else html += `<button class="act auto" data-quick="1"><span>⚡</span><b>남은 라운드</b><small>빠르게 시즌 끝내기</small></button>`;
  $("actions").innerHTML = html;
  $("actions").querySelectorAll("[data-train]").forEach((b) => b.onclick = () => turn({ kind: "train", key: b.dataset.train }, b));
  $("actions").querySelector("[data-rest]").onclick = (e) => turn({ kind: "rest" }, e.currentTarget);
  const au = $("actions").querySelector("[data-auto]"); if (au) au.onclick = openAuto;
  const qk = $("actions").querySelector("[data-quick]"); if (qk) qk.onclick = quickSeason;
  $("actions-title").textContent = pro ? `이번 라운드 준비 (경기 전 1번)` : `이번 달 뭘 할까요?`;

  $("hud-btns").innerHTML = `${pro ? `<button data-h="league">🏆 세계</button><button data-h="squad">👥 스쿼드</button><button data-h="news">📰 뉴스</button>` : ""}<button data-h="career">📊 커리어</button><button data-h="rival">🆚 라이벌</button>${S.shopOpen ? `<button data-h="shop">🛍️</button>` : ""}<button data-h="menu">⚙️</button>`;
  const nb = $("newsbox");
  if (nb) { nb.hidden = !pro || !(S.news && S.news.length); nb.innerHTML = pro && S.news ? `<b>📰 축구 소식</b>${S.news.slice(0, 3).map((n) => `<div>${esc(n.m)}</div>`).join("")}` : ""; nb.onclick = openNews; }
  $("hud-btns").querySelectorAll("[data-h]").forEach((b) => b.onclick = () => hudBtn(b.dataset.h));
  $("log").innerHTML = S.log.slice(0, 14).map((l) => `<div>${l}</div>`).join("");
}
function hudBtn(h) {
  if (h === "league") openLeague();
  else if (h === "news") openNews();
  else if (h === "menu") modal({ title: "⚙️ 메뉴", html: `<p class="small">난이도: ${DF().name} · ${VERSION}</p>`, buttons: [{ label: "❓ 도움말", value: "help" }, { label: Sfx.muted ? "🔇 소리 켜기" : "🔊 소리 끄기", value: "snd" }, { label: "🏠 타이틀로", value: "home" }, { label: "닫기", value: null, cls: "btn-primary" }] }).then((v) => v && hudBtn(v));
  else if (h === "squad") openSquad();
  else if (h === "career") openCareer();
  else if (h === "rival") openRival();
  else if (h === "shop") openShop();
  else if (h === "help") openHelp();
  else if (h === "snd") { Sfx.toggle(); renderMain(); }
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
    addLog(S.injured ? `🏥 재활 치료. 컨디션 +${v}` : `🛌 푹 쉬었어요. 컨디션 +${v}`);
    floatFx(btn, `컨디션 +${v}`);
    return;
  }
  const k = a.key, risk = injuryRisk();
  const g = trainGain(k);
  const before = S.stats[k];
  S.stats[k] = clamp(S.stats[k] + g, 1, 99);
  S.cond = clamp(S.cond - trainCost(), 0, 100);
  const used = S.buff > 1 ? ` (🔥×${S.buff})` : "";
  S.buff = 1;
  addLog(`${STATS.find((s) => s.key === k).emoji} ${STAT_NAME[k]} 훈련 +${(S.stats[k] - before).toFixed(1)} → ${Math.round(S.stats[k])}${used}`);
  floatFx(btn, `${STAT_NAME[k]} +${(S.stats[k] - before).toFixed(1)}`);
  if (risk && Math.random() * 100 < risk) {
    S.injured = randi(1, 2);
    S.cond = clamp(S.cond - 10, 0, 100);
    addLog(`🤕 무리한 훈련으로 부상! ${S.injured}턴 동안 재활만 할 수 있어요.`);
  }
}
function rivalGrow(scale = 1) {
  const rv = S.rival;
  if (rv.hurt > 0) { rv.hurt--; return; }
  const my = OVR(), ro = ROVR();
  const rubber = clamp(1 + (my - ro) / 12, .6, 1.5) * DF().rival * (S.phase === "pro" ? .55 : 1);
  const age = S.phase === "youth" ? 1 : rv.age <= 23 ? .85 : rv.age <= 27 ? .6 : rv.age <= 30 ? .4 : .2;
  const keys = Object.entries(POS[rv.pos].w).filter(([, w]) => w > 0).map(([k]) => k);
  for (let i = 0; i < 2; i++) {
    const k = Math.random() < .7 ? pickWeighted(rv.pos) : pick(keys);
    const v = rv.stats[k], dim = v >= 92 ? .3 : v >= 85 ? .5 : v >= 75 ? .7 : 1;
    rv.stats[k] = clamp(v + rand(1.6, 3) * talentMul(rv.talent[k]) * rubber * age * dim * scale * .8, 1, 99);
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
  if (Math.random() > (S.phase === "youth" ? .22 : .13)) return false;
  const ev = pickEvent(S);
  if (!ev) return false;
  S.ev[ev.id] = S.turn;
  const choice = await modal({
    emoji: ev.emoji, img: `assets/ev_${ev.id}.webp`, title: `${ev.emoji} ${ev.title}`, html: `<p class="ev-text">${esc(ev.text(S)).replace(/\n/g, "<br/>")}</p>`,
    buttons: ev.choices.map((c, i) => ({ label: c.label, hint: c.hint, value: i, cls: i === 0 ? "btn-primary" : "btn-ghost" })),
  });
  const out = ev.choices[choice].fx(S);
  addLog(`${ev.emoji} ${ev.title}: ${ev.choices[choice].label.replace(/^\S+\s/, "")} → ${out}`);
  await modal({ emoji: ev.emoji, title: "결과", html: `<p class="ev-out">${out.split(" · ").join("<br/>")}</p>`, buttons: [{ label: "계속", value: 1, cls: "btn-primary" }] });
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
    rivalGrow();
    if (S.money >= 150 && !S.shopOpen) { S.shopOpen = true; addLog("🛍️ 상점이 열렸어요!"); }
    renderMain();
    if (!fromAuto) await sleepMs(250);
    const hadEvent = await maybeEvent();
    const newInjury = !wasInjured && S.injured > 0;
    if (S.phase === "youth") {
      const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
      if (left === 0) {
        S.pending = "tournament"; save(); busy = false;
        await runTournament();
        return "stop";
      }
      nextMonth();
    } else {
      S.pending = "match"; save(); busy = false;
      await proRound();
      return "stop";
    }
    save(); renderMain();
    if (S.shopOpen && !S.flags.shopTip) { S.flags.shopTip = 1; await tip("t-shop", "모은 돈으로 🛍️ <b>상점</b>을 쓸 수 있어요. 장비는 영구 효과예요."); }
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
    emoji: "⏩", title: "자동 진행",
    html: `<p>대회 직전까지 알아서 훈련하고 쉬어요.<br/>컨디션이 낮으면 쉬고, 이벤트가 생기면 멈춰요.</p>`,
    buttons: [{ label: "⚖️ 포지션 균형", value: "bal", cls: "btn-primary" }, ...keys.slice(0, 4).map((k) => ({ label: `${STATS.find((s) => s.key === k).emoji} ${STAT_NAME[k]} 집중`, value: k })), { label: "취소", value: null }],
  });
  if (!v) return;
  for (let guard = 0; guard < 13; guard++) {
    if (S.phase !== "youth" || !$("scr-main").classList.contains("active")) break;
    const left = S.month <= 6 ? 6 - S.month : 12 - S.month;
    let a;
    if (S.injured > 0 || S.cond < 42 || (left <= 1 && S.cond < 62)) a = { kind: "rest" };
    else {
      let k = v;
      if (v === "bal" || S.stats[v] >= 99) k = bestTrainKey();
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
  const oppKit = kitClash(o.mine.kit[0], o.opp.kit[0]) ? [o.opp.kit[1], o.opp.kit[0]] : o.opp.kit;
  const body = $("mt-body");
  const race = o.race;
  body.innerHTML = `
    <div class="pre">
      <div class="pre-vs">
        <div class="pre-team"><div id="pre-me"></div><b>${esc(o.mine.name)}</b><small>전력 ${Math.round(tStr(o.mine))}</small></div>
        <div class="pre-mid"><b>VS</b></div>
        <div class="pre-team"><div id="pre-opp"></div><b>${esc(o.opp.name)}</b><small>전력 ${Math.round(tStr(o.opp))}</small></div>
      </div>
      ${rvOpp ? `<div class="pre-rv">⚔️ 라이벌 <b>${esc(S.rival.name)}</b> ${o.opp.xi.some((p) => p.id === "rv") ? "선발" : "벤치"}! 상대 전적 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패</div>` : rvMate ? `<div class="pre-rv">🤝 라이벌 <b>${esc(S.rival.name)}</b>과 같은 편</div>` : ""}
      ${race && !absent ? `<div class="pre-race">${ROLE_KO[S.pos]} ${race.slots}자리 주전 경쟁 (선발 확률 ${Math.round(race.p * 100)}%)<b>${race.rivals.slice(0, 3).map((p) => `${esc(p.n)} ${Math.round(pOvr(p))}`).join(" · ")}</b></div>` : ""}
      <div class="pre-info"><div>${absent ? (S.ban > 0 && S.injured <= 0 ? "⛔ 출전 정지로 못 뛰어요" : "🤕 이번 경기는 못 뛰어요") : starter ? "✅ 선발 출전" : "🪑 벤치 대기 · 교체 투입 기회를 기다려요"}</div><div>🩹 컨디션 ${Math.round(S.cond)} · 폼 ${formStr(S.form)}</div></div>
      <div class="pre-xi">${o.mine.xi.map((p) => `<span class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}">${ROLE_KO[p.r]} ${esc(p.n)}</span>`).join("")}</div>
      ${S.cond < 45 && !absent ? `<div class="warn">⚠️ 컨디션이 낮아 능력치가 떨어진 채로 뛰어요</div>` : ""}
      <button class="btn btn-primary" id="b-watch">${absent ? "📺 결과 확인" : "▶️ 경기 보기"}</button>
      ${absent ? "" : `<button class="btn btn-ghost" id="b-quick">⚡ 결과만 보기</button>`}
    </div>`;
  // 양쪽 모두 팀 엠블럼 (대표팀은 국기, 유스팀은 유니폼 색). 나·라이벌 얼굴은 엠블럼 옆 작은 배지로
  $("pre-me").innerHTML = teamBadge(o.mine, o.mine.kit);
  $("pre-opp").innerHTML = teamBadge(o.opp, oppKit);
  const meB = document.createElement("div"); meB.className = "pre-face"; meB.appendChild(avatarCanvas(S.look, o.mine.kit, 30, { mood: "angry" })); $("pre-me").appendChild(meB);
  if (rvOpp) { const rB = document.createElement("div"); rB.className = "pre-face rv"; rB.appendChild(avatarCanvas(S.rival.look, oppKit, 30, { mood: "smug" })); $("pre-opp").appendChild(rB); }
  const choice = o.forceQuick ? "quick" : await new Promise((res) => {
    $("b-watch").onclick = () => res(absent ? "quick" : "watch");
    const q = $("b-quick"); if (q) q.onclick = () => res("quick");
  });
  const H = o.mySide === "home" ? o.mine : o.opp, A = o.mySide === "home" ? o.opp : o.mine;
  const m = genMatch(H, A);
  if (choice === "watch") {
    body.innerHTML = `<div id="match-root"></div>`;
    if (!SET.seenMini) { SET.seenMini = 1; saveSet(); await tip("t-mini", "경기 중 <b>🔥 승부처</b>가 오면 화면이 내 선수에게 확대돼요.<br/><br/>⚽ 슈팅: 키퍼 반대쪽 코스 → 파워 초록<br/>🏃 돌파: 수비가 쏠린 반대쪽으로<br/>🎯 패스: 오프사이드 전, 빈 동료에게<br/>🛡️ 태클: 공이 길게 빠진 순간<br/><br/>귀찮으면 <b>🤖 승부처 자동</b>을 켜두세요."); }
    const mySubs = o.mine.subs.find((s) => s.in.id === "me");
    const rvSide = rvOpp ? "away" : rvMate ? "home" : null;
    await playMatch($("match-root"), {
      home: { name: o.mine.name, kit: o.mine.kit, str: tStr(o.mine) }, away: { name: o.opp.name, kit: oppKit, str: tStr(o.opp) },
      m, mySide: o.mySide, auto: !!SET.auto, diffShot: DIFF[S.diff || "normal"].shot,
      me: { name: S.name, look: S.look, pos: S.pos, stats: S.stats, starter, subMin: mySubs ? mySubs.min : null },
      rival: rvSide ? { name: S.rival.name, pos: S.rival.pos, side: rvSide, slot: rvSide === "home" && S.rival.pos === S.pos ? (S.pos === "wg" ? 8 : 5) : undefined } : null,
      onAutoChange: (v) => { SET.auto = v; saveSet(); },
    });
  } else resolveAuto(m);
  const res = finishMatch(m);
  const r = summarize(res, m, o.mySide, rvOpp);
  // 내 경고·퇴장·부상 — 프로에서는 징계가 다음 경기로 이어져요
  for (const i of res.cards.filter((x) => x.p.id === "me")) {
    if (i.kind === "inj") { const n = randi(1, 3); S.injured = Math.max(S.injured, n); r.cards.push(`🚑 경기 중 부상, ${n}경기 결장`); addLog(`🚑 경기 중 부상으로 ${n}경기 결장`); }
    else if (S.phase === "pro") {
      if (i.kind === "yc") { S.ycount = (S.ycount || 0) + 1; r.cards.push(`🟨 경고 (시즌 누적 ${S.ycount}장)`); if (S.ycount % 5 === 0) { S.ban = Math.max(S.ban || 0, 1); r.cards.push("⛔ 경고 5장 누적, 다음 경기 출전 정지"); } }
      else { S.ban = i.kind === "rc" ? 2 : 1; r.cards.push(`🟥 퇴장! 다음 ${S.ban}경기 출전 정지`); addLog(`🟥 퇴장, ${S.ban}경기 출전 정지`); }
    } else r.cards.push(i.kind === "yc" ? "🟨 경고" : "🟥 퇴장");
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
    goalsList: res.goals, cards: [],
  };
}
async function showResult(r, lines, btnLabel = "계속") {
  const box = document.createElement("div");
  box.className = "result";
  const cls = r.rating >= 8 ? "s" : r.rating >= 7 ? "a" : r.rating >= 6 ? "b" : "c";
  box.innerHTML = `
    <div class="r-score">${r.gf} : ${r.ga} <span>${r.res === "W" ? "승리 🎉" : r.res === "D" ? "무승부 🤝" : "패배 💧"}</span></div>
    ${r.played ? `<div class="r-rating ${cls}">평점 <b>${r.rating.toFixed(1)}</b>${r.mom ? ` <em>⭐ MOM</em>` : ""}</div>
    <div class="r-stats">${r.mins}분 · ⚽ ${r.goals} · 🅰️ ${r.assists} · 🛡️ ${r.saves} · 승부처 ${r.moments.filter((m) => m.ok).length}/${r.moments.length}</div>` : `<div class="r-stats">출전하지 못했어요</div>`}
    <div class="r-goals">${r.goalsList.map((g) => `<span>${g.min}' ${g.sh.id === "me" ? "<b>" + esc(g.sh.n) + "</b>" : esc(g.sh.n)}</span>`).join("")}</div>
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
    lines.push(`⚔️ 라이벌 상대 전적 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패${r.rvX ? ` · ${esc(S.rival.name)} 평점 ${opts.rvRating ?? "-"}` : ""}`);
    if (r.rivalGoal) lines.push(`😤 ${esc(S.rival.name)}에게 골을 허용했어요`);
  }
  lines.push(...(r.cards || []));
  if (!r.played) return lines;
  const prestige = opts.prestige || 1;
  const f = Math.round(((r.rating - 6.3) * 3 + r.goals * 2 + r.assists * 1.5 + (r.mom ? 3 : 0)) * ORIGINS[S.origin].fame * (S.phase === "youth" ? .6 : .6 + prestige * .2) * (opts.big || 1));
  S.fame = Math.max(0, S.fame + f);
  lines.push(`⭐ 명성 ${f >= 0 ? "+" : ""}${f}`);
  const pf = S.form;
  if (r.rating >= 7.6) S.form = clamp(S.form + 1, -3, 3); else if (r.rating <= 5.7) S.form = clamp(S.form - 1, -3, 3);
  if (S.form !== pf) lines.push(`폼 ${S.form > pf ? "▲" : "▼"} ${formStr(S.form)}`);
  S.cond = clamp(S.cond - (r.mins >= 60 ? 10 : 4), 0, 100);
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
    m.innerHTML = `<div class="mbox wide${drawn++ ? " still" : ""}"><h3>🥅 승부차기</h3>
      <div class="so"><div class="so-row"><b>${esc(myName)}</b><em>${a}</em><span>${dots(ra)}</span></div>
      <div class="so-row"><b>${esc(oppName)}</b><em>${b}</em><span>${dots(rb)}</span></div></div>
      <p class="so-msg">${msg}</p><div id="so-mg"></div></div>`;
  };
  const decided = (i) => i < 4 ? (a > b + (4 - i) || b > a + (4 - i)) : a !== b;
  for (let i = 0; i < 30; i++) {
    const sh = A[i % A.length];
    draw(`${i + 1}번째 키커 · <b>${esc(sh.n)}</b>${sh.id === "me" ? " (나!)" : ""}`);
    await sleepMs(sh.id === "me" ? 200 : 700);
    let ok;
    if (sh.id === "me") { const x = await MG.shot($("so-mg"), { sho: S.stats.sho, gk: eff(gB, "def"), smart: clamp(.36 / DF().shot, .22, .5), pk: true }); ok = x.ok; }
    else ok = Math.random() < pkP(sh, gB);
    ra.push(ok); if (ok) a++; (ok ? Sfx.good : Sfx.bad)();
    const sb = B[i % B.length], okb = Math.random() < pkP(sb, gA);
    draw(`${esc(sh.n)} ${ok ? "성공 ⚽" : "실축 ❌"}<br/>${esc(sb.n)} 키커가 나와요…`);
    await sleepMs(800);
    rb.push(okb); if (okb) b++;
    draw(`${esc(sb.n)} ${okb ? "성공 ⚽" : "실축 ❌"}`);
    await sleepMs(600);
    if (decided(i)) break;
  }
  draw(a > b ? "🎉 승부차기 승리!" : "💧 승부차기 패배…");
  await new Promise((res) => { const bt = document.createElement("button"); bt.className = "btn btn-primary"; bt.textContent = "계속"; bt.onclick = res; m.querySelector(".mbox").appendChild(bt); });
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
  return { name, kit, xi, bench, adv: 0, meBench: bench.some((p) => p.id === "me") };
}
async function runTournament() {
  const final = S.month === 12;
  const name = final ? (S.year === 3 ? "유스 챔피언십 · 프로 스카우트 집결" : "유스 챔피언십") : "상반기 유스 리그";
  const base = 38 + S.year * 6;
  const me = { id: "me", n: S.name, r: S.pos }, rv = { id: "rv", n: S.rival.name, r: S.rival.pos };
  const myNat = ORIGINS[S.origin].nat;
  const myTeam = () => youthSquad(ORIGINS[S.origin].team, ORIGINS[S.origin].kit, myNat, base + 1, [me]);
  const opps = [...YOUTH_OPP].sort(() => Math.random() - .5).slice(0, 2);
  let pts = 0;
  const results = [];
  for (let i = 0; i < 3; i++) {
    let opp, rival = false, label;
    if (i < 2) { const o = opps[i]; opp = youthSquad(o[0], [o[1], o[2]], pick(["kr", "kr", "jp", "br", "es"]), base + rand(-3, 3)); label = `조별 ${i + 1}경기`; }
    else if (pts >= 3) { opp = youthSquad(ORIGINS[S.rival.origin].team, ORIGINS[S.rival.origin].kit, ORIGINS[S.rival.origin].nat, base + 1, [rv]); rival = true; label = "🏆 결승"; }
    else { const o = YOUTH_OPP.find((x) => !opps.includes(x)); opp = youthSquad(o[0], [o[1], o[2]], "kr", base + rand(-2, 2)); label = "순위 결정전"; }
    const mine = myTeam();
    const { r, res, m } = await matchFlow({ title: `🏆 ${S.year}년차 ${name}`, sub: label, mine, opp, mySide: "home" });
    if (r.res === "W") pts += 3; else if (r.res === "D") pts += 1;
    let pk = "";
    if (i === 2 && rival && r.res === "D") { const so = await shootoutUI(onAt90(m.H), onAt90(m.A), mine.name, opp.name); r.res = so.aWin ? "W" : "L"; pk = ` (승부차기 ${so.a}:${so.b} ${so.aWin ? "승" : "패"})`; }
    const rvRating = rival ? [...res.ratings].find(([p]) => p.id === "rv")?.[1] : null;
    const lines = applyMatch(r, { rival, rvRating });
    if (r.played) { S.youth.apps++; S.youth.g += r.goals; S.youth.a += r.assists; S.youth.ratings.push(r.rating); }
    if (r.mom) { S.money += 20; lines.push("💰 MOM 보너스 +20만"); }
    results.push({ label, opp: opp.name, gf: r.gf, ga: r.ga, res: r.res, pk, rating: r.rating });
    await showResult(r, lines, i < 2 ? "다음 경기 →" : "대회 결과 →");
  }
  const last = results[2];
  let title, prize, fame;
  if (last.label === "🏆 결승" && last.res === "W") { title = "🏆 우승!"; prize = 100; fame = 8; S.youth.trophies++; }
  else if (last.label === "🏆 결승") { title = "🥈 준우승"; prize = 40; fame = 3; }
  else { title = last.res === "W" ? "🥉 3위" : "4위"; prize = 15; fame = 1; }
  S.money += prize; S.fame += fame;
  addLog(`${name} ${title} (💰+${prize}만, 명성 +${fame})`);
  await modal({
    emoji: title.split(" ")[0], title: `${name} ${title.replace(/^\S+\s/, "")}`,
    html: `<div class="tour-sum">${results.map((x) => `<div><span>${x.label}</span><b>${esc(x.opp)}</b><em class="${x.res}">${x.gf}:${x.ga}${x.pk}</em><i>${x.rating ? x.rating.toFixed(1) : "-"}</i></div>`).join("")}</div><p>💰 +${prize}만 · ⭐ 명성 +${fame}</p>`,
  });
  S.pending = null;
  if (S.year === 3 && S.month === 12) { save(); return youthEnd(); }
  nextMonth(); save();
  show("scr-main"); renderMain();
}

/* ---------- 프로 계약 · 이적 ---------- */
function offerList(score, opts = {}) {
  const out = [];
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const str = clubStr(lg.id, c[0]);
    if (opts.exclude && c[0] === opts.exclude) continue;
    if (str <= score + 3 && str >= score - 12) out.push({ league: lg.id, club: c[0], str, kit: [c[2], c[3]] });
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
  const mine = OVR() + S.form * 1.2;
  const others = clubPlayers(club).filter((p) => p.id !== "me" && p.r === S.pos).map((p) => pOvr(p)).sort((a, b) => b - a);
  const kth = others[SLOTS[S.pos] - 1];
  return kth == null ? .97 : clamp(.5 + (mine - kth) / 7, .04, .97);
}
function salaryOf(lg) { return Math.round(LEAGUES[lg].pay * Math.pow(OVR() / 65, 2) * (S.flags.agent ? .9 : 1)); }
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
  if (S.world && S.world.p && S.world.p.me && S.world.p.me.cs) { W = S.world; return; }
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
  const score = OVR() + Math.min(S.fame, 120) / 24 + S.youth.trophies * 1.5 + DIFF[S.diff || "normal"].offer;
  const offers = offerList(score, { agent: S.flags.agent });
  if (!offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 10) {
    const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] });
  }
  const pick1 = await offerScreen({
    title: "✍️ 프로 계약 제안",
    hint: `유스 3년 끝! 종합 ${OVR()} · 명성 ${Math.round(S.fame)} · 우승 ${S.youth.trophies}회<br/>라이벌 <b>${esc(josa(S.rival.name, "은/는"))}</b> <b>${LEAGUES[S.rival.league].flag} ${esc(S.rival.club)}</b> 입단이 유력해요.`,
    offers, stay: null,
  });
  S.phase = "pro"; S.age = 19; S.rival.age = 19;
  S.pro = S.pro || {};
  joinClub(pick1);
  S.pro.season = 1; initSeason(true);
  addLog(`✍️ ${LEAGUES[pick1.league].flag} ${pick1.club} 입단! 프로 데뷔 시즌이 시작돼요.`);
  addLog(`📰 라이벌 ${josa(S.rival.name, "은/는")} ${S.rival.club} 입단.`);
  news(`✍️ 신인 ${S.name}, ${pick1.club} 입단 · 라이벌 ${S.rival.name}은 ${S.rival.club}`);
  S.pending = null; save();
  show("scr-main"); renderMain();
  await tip("t-pro", `프로는 <b>라운드마다 훈련 1번 + 경기 1번</b>, 한 시즌 ${ROUNDS}라운드(홈·원정)예요.<br/>6개 리그 60개 클럽 960명이 매 라운드 같은 엔진으로 실제 경기를 치러요. 📰 뉴스, 🏆 리그, 👥 스쿼드에서 세계가 돌아가는 걸 볼 수 있어요.<br/>리그 상위권이면 다음 시즌 <b>대륙컵</b>, 4시즌마다 <b>월드컵</b>이 열려요.`);
}
function joinClub(o) {
  const c = clubData(o.league, o.club);
  S.pro = S.pro || {};
  Object.assign(S.pro, { league: o.league, club: o.club, kit: [c[2], c[3]] });
  moveToClub("me", o.club);
  S.career.peakTier = Math.max(S.career.peakTier, LEAGUES[o.league].tier);
  if (!S.career.clubs) S.career.clubs = [];
  if (S.career.clubs[S.career.clubs.length - 1] !== o.club) S.career.clubs.push(o.club);
}
function offerScreen({ title, hint, offers, stay }) {
  return new Promise((resolve) => {
    show("scr-offers");
    $("of-title").textContent = title;
    $("of-hint").innerHTML = hint;
    const list = $("of-list");
    list.innerHTML = offers.map((o, i) => {
      const rv = o.club === S.rival.club;
      const p = Math.round(starterProb(o.club) * 100);
      const others = clubPlayers(o.club).filter((x) => x.id !== "me" && x.r === S.pos).sort((a, b) => pOvr(b) - pOvr(a));
      const prevRank = S.lgs && S.lgs[o.league] && S.lgs[o.league].table[o.club].p ? rankOf(o.club) + "위" : "-";
      const cup = Object.entries(S.cups || {}).find(([, c]) => c.teams.includes(o.club));
      return `<button class="offer" data-i="${i}"><div class="crest-big">${crestHTML(o.club, 54)}</div>
        <div class="of-mid"><b>${esc(o.club)}</b><span>${LEAGUES[o.league].flag} ${LEAGUES[o.league].name} · 전력 ${Math.round(o.str)} · 순위 ${prevRank}</span>
        <span>선발 가능성 <em class="${p >= 60 ? "up" : p < 35 ? "dn" : ""}">${p}%</em> · 라운드 수당 ${salaryOf(o.league)}만</span>
        <span class="race">${ROLE_KO[S.pos]} ${SLOTS[S.pos]}자리 경쟁: ${others.slice(0, 3).map((x) => `${esc(x.n)}${x.id === "rv" ? "⚔️" : ""} ${Math.round(pOvr(x))}`).join(" · ")}</span>
        ${rv ? `<span class="rv">⚔️ 라이벌 ${esc(S.rival.name)}의 팀${S.rival.pos === S.pos ? " (같은 포지션 주전 경쟁!)" : " (한 팀에서 뛰어요)"}</span>` : ""}</div></button>`;
    }).join("") || `<p class="hint">이번에는 제안이 없어요.</p>`;
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
  S.cond = Math.max(S.cond, 80);
  for (const [k, c] of Object.entries(S.cups)) if (c.teams.includes(S.pro.club)) news(`${CUPS[k].emoji} ${S.pro.club}, 이번 시즌 ${CUPS[k].name} 출전!`);
}
function rvS() { const p = W && W.p.rv; return p ? { g: p.s.g, a: p.s.a, ap: p.s.ap, avg: pAvg(p) } : { g: 0, a: 0, ap: 0, avg: 0 }; }
function recordMine(r, kind, lgPay) {
  const P = S.pro;
  if (!r.played) return null;
  if (kind === "league") { P.s.apps++; if (r.mins === 90 || r.starter) P.s.starts++; P.s.g += r.goals; P.s.a += r.assists; P.s.ratings.push(r.rating); if (r.mom) P.s.mom++; }
  else { P.cup.ap++; P.cup.g += r.goals; P.cup.a += r.assists; }
  const pay = Math.round(salaryOf(P.league) * (r.mins >= 60 ? 1 : .7) + (r.mom ? lgPay * .5 : 0));
  S.money += pay;
  return pay;
}

/* 한 라운드: 내 경기 + 6개 리그 나머지 경기 전부 + (있으면) 대륙컵. quick이면 연출 없이 */
async function proRound(quick = false) {
  const P = S.pro, lg = LEAGUES[P.league], round = P.round;
  const opp = P.schedule[round], isHome = P.home[round];
  const wasBanned = (S.ban || 0) > 0;
  const mine = teamFor(P.club, { home: isHome }), oppT = teamFor(opp, { home: !isHome });
  S.flags.forceStart = false;
  const starter = mine.xi.some((p) => p.id === "me");
  const rvOpp = [...oppT.xi, ...oppT.bench].some((p) => p.id === "rv");
  const { r, res } = await matchFlow({
    title: `${lg.flag} ${lg.name} R${round + 1}`, sub: `${P.season}시즌 · ${esc(P.club)} ${isHome ? "홈" : "원정"}`,
    mine, opp: oppT, mySide: isHome ? "home" : "away", race: spotRace(P.club), forceQuick: quick,
  });
  r.starter = starter;
  const [h, a] = isHome ? [P.club, opp] : [opp, P.club];
  credit(res, "league", P.league, h, a);
  simRoundRest(round, P.club);
  const rvR = rvOpp ? [...res.ratings].find(([p]) => p.id === "rv")?.[1] : null;
  const lines = applyMatch(r, { rival: rvOpp, rvRating: rvR, prestige: lg.prestige });
  const pay = recordMine(r, "league", lg.pay);
  if (pay != null) lines.push(`💰 수당 +${pay}만${r.mom ? " (⭐ MOM 보너스 포함)" : ""}`);
  if (wasBanned) { S.ban--; lines.push("⛔ 출전 정지로 결장했어요"); }
  else if (S.injured > 0 && !r.cards.some((c) => c.startsWith("🚑"))) { S.injured--; if (!r.played) lines.push("🤕 부상으로 결장했어요"); }
  P.lastBench = !starter && S.injured === 0;
  const rvp = W.p.rv;
  if (!rvOpp && rvp.c) {
    const last = S.lgs[rvp.l].res.slice().reverse().find((x) => x.h === rvp.c || x.a === rvp.c);
    if (last) lines.push(`⚔️ 라이벌 소식: ${esc(last.h)} ${last.hg}:${last.ag} ${esc(last.a)} · ${esc(rvp.n)} 시즌 ⚽${rvp.s.g} 🅰️${rvp.s.a}`);
  }
  const gRank = P.s.g ? topBy(P.league, "g", 60).findIndex((p) => p.id === "me") + 1 : 0;
  lines.push(`📊 리그 ${myRank()}위 · 시즌 ⚽${P.s.g} 🅰️${P.s.a}${gRank ? ` · 득점 ${gRank}위` : ""}`);
  const others = S.lgs[P.league].res.slice(-5).filter((x) => x.h !== P.club && x.a !== P.club);
  lines.push(`<details class="rr"><summary>📋 R${round + 1} 다른 경기</summary>${others.map((x) => `<div>${esc(x.h)} <b>${x.hg}:${x.ag}</b> ${esc(x.a)} <small>${x.g.map((g) => `${g[0]}' ${esc(g[2])}`).join(", ")}</small></div>`).join("")}</details>`);
  addLog(`${r.res === "W" ? "✅" : r.res === "D" ? "➖" : "❌"} R${round + 1} vs ${opp} ${r.gf}:${r.ga}${r.played ? ` · 평점 ${r.rating}` : " · 결장"}${starter || !r.played ? "" : " (교체)"}${r.goals ? ` · ⚽${r.goals}` : ""}${r.assists ? ` · 🅰️${r.assists}` : ""}${rvOpp ? " ⚔️" : ""}`);
  if (!quick) await showResult(r, lines, round + 1 >= ROUNDS ? "시즌 결산 →" : "계속");
  P.round++;
  S.cond = clamp(S.cond + 6, 0, 100);
  await runCups(P.round, quick);
  if (quick) return;
  if (P.round >= ROUNDS) { S.pending = "season"; save(); return seasonEnd(); }
  S.pending = null; save();
  show("scr-main"); renderMain();
}

/* 대륙컵 한 단계 — 우리 클럽이 살아있으면 직접 뛰어요 */
async function runCups(roundDone, quick) {
  for (const key of cupsAt(roundDone)) {
    const cup = CUPS[key], C = S.cups[key];
    if (!C || C.alive.length < 2) continue;
    const stageName = CUP_STAGE[C.stage] || `${C.stage}강`;
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
        if (iWon) { S.money += stagePrize; lines.push(`${cup.emoji} ${C.stage === 2 ? "우승!!" : "다음 라운드 진출!"}${pk ? pk : ""} 💰 +${stagePrize}만`); }
        else lines.push(`💧 ${cup.name} ${stageName} 탈락${pk}`);
        myLine = `${iWon ? "✅" : "❌"} ${stageName} vs ${opp} ${r.gf}:${r.ga}${pk}`;
        addLog(`${cup.emoji} ${cup.name} ${myLine}`);
        if (!quick) await showResult(r, lines, "계속");
      } else {
        const res = playAI(teamFor(h, { home: true }), teamFor(a));
        winners.push(cupResolve(key, h, a, res).win);
      }
    }
    cupAdvance(key, winners);
    if (C.winner === S.pro.club) { S.career.trophies.push(`${S.pro.season}시즌 ${cup.name}`); S.career.awards.push(`${S.pro.season}시즌 ${cup.emoji} ${cup.name} 우승`); S.career.awardScore = (S.career.awardScore || 0) + 12 * cup.weight; S.fame += 20; }
    if (!quick && !myLine) toast(`${cup.emoji} ${cup.name} ${stageName}: ${C.log.slice(-winners.length).join(" / ")}`, 3500);
  }
}

/* 남은 라운드 빠르게 — 훈련은 자동, 경기는 결과만 */
async function quickSeason(skipAsk) {
  if (!skipAsk) {
    const ok = await modal({ emoji: "⚡", title: "남은 라운드 빠르게", html: `<p>남은 ${ROUNDS - S.pro.round}라운드를 자동 훈련 + 결과만 보기로 진행해요.<br/>이벤트는 그대로 물어봐요.</p>`, buttons: [{ label: "진행", value: true, cls: "btn-primary" }, { label: "취소", value: false }] });
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
function ballonScore(o) { return o.ovr + o.tier * 5 + (o.avg - 6.5) * 10 + (o.g + o.a * .8) * (POS_F[o.pos] || 1) * .25 + (o.champ ? 5 : 0) + (o.cup || 0) + (o.wc || 0); }
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
  if (mineAw.boot && mineAw.boot.id === "me" && P.s.g >= 5) awards.push({ k: "boot", name: "👟 득점왕", w: 8 * lg.prestige });
  if (mineAw.ast && mineAw.ast.id === "me" && P.s.a >= 4) awards.push({ k: "ast", name: "🎯 도움왕", w: 6 * lg.prestige });
  if (mineAw.mvp && mineAw.mvp.id === "me") awards.push({ k: "mvp", name: "👑 리그 MVP", w: 10 * lg.prestige });
  if (mineAw.young && mineAw.young.id === "me") awards.push({ k: "young", name: "🌟 영플레이어상", w: 6 });
  if (rank === 1) { awards.push({ k: "title", name: `🏆 ${lg.name} 우승`, w: 8 * lg.prestige }); S.career.trophies.push(`${P.season}시즌 ${lg.name}`); }
  const rvAwards = [];
  const RA = rvp.l != null ? AW[rvp.l] : null;
  if (RA) {
    if (RA.boot && RA.boot.id === "rv") rvAwards.push("👟 득점왕");
    if (RA.ast && RA.ast.id === "rv") rvAwards.push("🎯 도움왕");
    if (RA.mvp && RA.mvp.id === "rv") rvAwards.push("👑 리그 MVP");
    if (RA.champ === rvp.c) { rvAwards.push("🏆 리그 우승"); rv.career.trophies++; }
  }
  for (const [k, c] of Object.entries(S.cups)) if (c.winner === rvp.c) rvAwards.push(`${CUPS[k].emoji} ${CUPS[k].name} 우승`);
  // 발롱도르 — 6개 리그 전 선수 (리그 9경기 이상)
  const cupBonus = (club) => Object.entries(S.cups).reduce((s, [k, c]) => s + (c.winner === club ? CUPS[k].weight * 2.5 : c.winner && (c.log[c.log.length - 1] || "").includes(club) ? CUPS[k].weight : 0), 0);
  const cands = Object.values(W.p).filter((p) => p.c && p.s.ap >= 9).map((p) => {
    const l = W.c[p.c].l;
    return { id: p.id, name: p.n, nat: p.nat, club: p.c, pos: p.r, ovr: pOvr(p), tier: LEAGUES[l].tier, avg: pAvg(p), g: p.s.g + p.cs.g, a: p.s.a + p.cs.a, champ: AW[l].champ === p.c, cup: cupBonus(p.c), wc: S.wcWinner && S.wcWinner.nat === p.nat && S.wcWinner.season === P.season ? 6 : 0 };
  }).map((c) => ({ ...c, sc: ballonScore(c) })).sort((a, b) => b.sc - a.sc);
  const myB = cands.findIndex((c) => c.id === "me") + 1, rvB = cands.findIndex((c) => c.id === "rv") + 1;
  if (myB === 1) { awards.push({ k: "ballon", name: "🏅 발롱도르", w: 0 }); S.career.ballon++; }
  else if (myB && myB <= 3) S.career.ballonTop3++;
  if (rvB === 1) { rvAwards.push("🏅 발롱도르"); rv.career.ballon++; }
  if (cands[0] && cands[0].id !== "me") news(`🏅 ${P.season}시즌 발롱도르: ${cands[0].name}(${NATIONS[cands[0].nat].flag} ${cands[0].club})`);
  rv.career.g += rs.g + rvp.cs.g; rv.career.a += rs.a + rvp.cs.a; rv.career.awards.push(...rvAwards);

  S.career.apps += P.s.apps + P.cup.ap; S.career.g += P.s.g + P.cup.g; S.career.a += P.s.a + P.cup.a; S.career.mom += P.s.mom;
  S.career.awards.push(...awards.map((a) => `${P.season}시즌 ${a.name}`));
  S.career.awardScore = (S.career.awardScore || 0) + awards.reduce((x, a) => x + a.w, 0);
  S.career.peakOvr = Math.max(S.career.peakOvr, OVR());
  S.career.seasons.push({ season: P.season, age: S.age, club: P.club, league: P.league, rank, apps: P.s.apps, starts: P.s.starts, g: P.s.g, a: P.s.a, cup: { ...P.cup }, avg: Math.round(myAvg * 100) / 100, awards: awards.map((a) => a.name), ovr: OVR(), gpm: Math.round(Object.values(S.lgs[P.league].table).reduce((s, t) => s + t.gf, 0) / Math.max(1, Object.values(S.lgs[P.league].table).reduce((s, t) => s + t.p, 0)) * 200) / 100, lgTop: LEAGUES.map((l) => { const t = topBy(l.id, "g", 1)[0]; return t ? t.s.g : 0; }), rv: { club: rvp.c, g: rs.g, a: rs.a, avg: Math.round(rs.avg * 100) / 100, b: rvB }, ballon: myB });
  const fameGain = awards.reduce((x, a) => x + Math.round(a.w / 2), 0) + (rank <= 3 ? 6 : 0);
  S.fame += fameGain;
  const prize = rank === 1 ? lg.pay * 6 : 0;
  S.money += prize;
  for (const l of LEAGUES) news(`🏆 ${l.flag} ${l.name} ${P.season}시즌 우승: ${AW[l.id].champ}${AW[l.id].boot ? ` · 득점왕 ${AW[l.id].boot.n} ${AW[l.id].boot.s.g}골` : ""}`);

  show("scr-season");
  $("ss-title").textContent = `📋 ${P.season}시즌 결산 · ${S.age}세`;
  const myRow = (n) => n === P.club ? "me" : n === rvp.c ? "rv" : "";
  const pl = (p) => `<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>`;
  const plRow = (p, v) => `<div class="bl ${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><b>${pl(p)}${p.id === "rv" ? " ⚔️" : ""}</b><small>${esc(shortName(p.c))}</small><em>${v}</em></div>`;
  const awLine = (l) => { const A = AW[l.id]; return `<div class="aw-row"><b>${l.flag} ${l.name}</b> 🏆 ${esc(A.champ)} · 👟 ${A.boot ? `${pl(A.boot)} ${A.boot.s.g}골` : "-"} · 👑 ${A.mvp ? pl(A.mvp) : "-"}</div>`; };
  const cupLine = Object.entries(S.cups).map(([k, c]) => `<div class="aw-row"><b>${CUPS[k].emoji} ${CUPS[k].name}</b> 우승 ${esc(c.winner || "-")}${c.teams.includes(P.club) ? ` · 우리 ${c.winner === P.club ? "🏆 우승" : "탈락"}` : ""}</div>`).join("");
  const heroAw = awards.find((a) => a.k === "ballon") || awards[0];
  $("ss-body").innerHTML = `${heroAw ? `<div class="ss-hero" style="background-image:url(assets/ceremony.webp)"><b>${awards.map((a) => a.name).join(" · ")}</b></div>` : ""}
    <div class="ss-card"><h4>${lg.flag} ${lg.name} 최종 순위</h4>
      <table class="tbl"><tr><th>#</th><th>클럽</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${tbl.map(([n, t], i) => `<tr class="${myRow(n)}"><td>${i + 1}</td><td>${crestHTML(n, 14)} ${esc(n)}${n === rvp.c ? " ⚔️" : ""}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join("")}</table></div>
    <div class="ss-card"><h4>내 시즌</h4>
      <div class="ss-me"><div id="ss-av"></div><div>리그 ${P.s.apps}경기 (선발 ${P.s.starts})<br/>⚽ ${P.s.g}골 · 🅰️ ${P.s.a}도움 · MOM ${P.s.mom}<br/>평균 평점 <b>${myAvg ? myAvg.toFixed(2) : "-"}</b>${P.cup.ap ? `<br/>대륙컵 ${P.cup.ap}경기 ⚽ ${P.cup.g} 🅰️ ${P.cup.a}` : ""}<br/>
      ${awards.length ? awards.map((a) => `<span class="aw">${a.name}</span>`).join(" ") : "<small>이번 시즌 수상은 없어요</small>"}
      ${prize ? `<br/>💰 우승 상금 +${prize}만` : ""}<br/>⭐ 명성 +${fameGain}</div></div></div>
    <div class="ss-card two"><div><h4>👟 득점 순위</h4>${topBy(P.league, "g", 5).map((p) => plRow(p, p.s.g + "골")).join("")}</div>
      <div><h4>🎯 도움 순위</h4>${topBy(P.league, "a", 5).map((p) => plRow(p, p.s.a + "도움")).join("")}</div></div>
    <div class="ss-card rvc"><h4>⚔️ 라이벌 ${esc(rv.name)}</h4>
      <div>${LEAGUES[rvp.l].flag} ${esc(rvp.c)} (${rankOf(rvp.c)}위) · ${rs.ap}경기 · ⚽ ${rs.g} · 🅰️ ${rs.a} · 평균 ${rs.avg ? rs.avg.toFixed(2) : "-"}<br/>
      ${rvAwards.length ? rvAwards.map((a) => `<span class="aw rv">${a}</span>`).join(" ") : "<small>수상 없음</small>"}</div>
      <div class="ss-vs">${P.s.g + P.s.a > rs.g + rs.a ? "🔥 이번 시즌은 내가 이겼어요!" : P.s.g + P.s.a < rs.g + rs.a ? "😤 이번 시즌은 라이벌이 앞섰어요" : "🤝 막상막하"}</div></div>
    <div class="ss-card"><h4>🌍 세계 축구</h4>${LEAGUES.filter((l) => l.id !== P.league).map(awLine).join("")}${cupLine}</div>
    <div class="ss-card"><h4>🏅 발롱도르 순위</h4>
      ${cands.slice(0, 5).map((c, i) => `<div class="bl ${c.id === "me" ? "me" : c.id === "rv" ? "rv" : ""}"><span>${i + 1}</span><b>${NATIONS[c.nat].flag} <a class="pl" data-pid="${c.id}">${esc(c.name)}</a>${c.id === "rv" ? " ⚔️" : ""}</b><small>${esc(shortName(c.club))} ⚽${c.g} 🅰️${c.a}</small><em>${c.sc.toFixed(1)}</em></div>`).join("")}
      ${myB > 5 ? `<div class="bl me"><span>${myB}</span><b>${esc(S.name)}</b><small></small><em>${cands[myB - 1].sc.toFixed(1)}</em></div>` : ""}
      ${rvB > 5 ? `<div class="bl rv"><span>${rvB}</span><b>${esc(rv.name)} ⚔️</b><small></small><em>${cands[rvB - 1].sc.toFixed(1)}</em></div>` : ""}</div>`;
  $("ss-av").appendChild(avatarCanvas(S.look, P.kit, 56, { mood: awards.length ? "joy" : undefined }));
  bindPlayerLinks($("ss-body"));
  if (awards.some((a) => a.k === "ballon")) Sfx.goal();
  addLog(`📋 ${P.season}시즌 ${rank}위 · ⚽${P.s.g} 🅰️${P.s.a}${awards.length ? " · " + awards.map((a) => a.name).join(", ") : ""}`);
  archiveSeason(P.season);

  const canRetire = S.age >= 31, mustRetire = S.age >= 36;
  const wcNext = P.season % 4 === 0;
  $("ss-acts").innerHTML = mustRetire ? `<button class="btn btn-primary" id="ss-retire">🎓 은퇴식으로</button>`
    : `<button class="btn btn-primary" id="ss-next">${wcNext ? "🌍 월드컵으로 →" : "💼 이적 시장 →"}</button>${canRetire ? `<button class="btn btn-ghost" id="ss-retire">🎓 여기서 은퇴하기</button>` : ""}`;
  const choice = await new Promise((res) => {
    const n = $("ss-next"); if (n) n.onclick = () => res("next");
    const r = $("ss-retire"); if (r) r.onclick = () => res("retire");
  });
  if (choice === "retire") return retire();
  if (wcNext) await worldCup();
  await offseason();
}

/* ---------- 🌍 월드컵 ---------- */
async function worldCup() {
  const { sq, field } = wcField();
  if (field.length < 8) return;
  S.cond = Math.max(S.cond, 85);
  const year = S.pro.season;
  const kr = sq.kr;
  const meIn = kr && [...kr.xi, ...kr.bench].some((p) => p.id === "me");
  const groups = [[], []];
  [...field].sort((a, b) => sq[b].str - sq[a].str).forEach((n, i) => groups[[0, 1, 1, 0][i % 4]].push(n));
  await modal({ emoji: "🌍", title: `${year}시즌 월드컵 개막`, wide: true, html: `<p>8개국이 우승을 다퉈요.</p>
    ${groups.map((g, i) => `<div class="aw-row"><b>${"AB"[i]}조</b> ${g.map((n) => `${NATIONS[n].flag} ${NATIONS[n].name} <small>(${Math.round(sq[n].str)})</small>`).join(" · ")}</div>`).join("")}
    <p class="small">${meIn ? `🇰🇷 대한민국 대표로 <b>${esc(S.name)}</b> 발탁! 직접 뛰어요.` : kr ? `🇰🇷 대한민국 명단에 들지 못했어요. 결과만 지켜봐요.` : "대한민국은 출전하지 못했어요."}</p>`,
    buttons: [{ label: "킥오프", value: 1, cls: "btn-primary" }] });
  const tableOf = (g) => Object.fromEntries(g.map((n) => [n, { pts: 0, gd: 0, gf: 0 }]));
  const T = groups.map(tableOf);
  const scorer = {};
  const play = async (a, b, stage, mustWin) => {
    const A = natTeam(sq, a), B = natTeam(sq, b);
    const mine = (a === "kr" || b === "kr") && meIn;
    let res, r = null, mm = null;
    const krIsA = a === "kr";
    if (mine) {
      ({ res, r, m: mm } = await matchFlow({ title: `🌍 월드컵 ${stage}`, sub: `${NATIONS[a].flag} ${NATIONS[a].name} vs ${NATIONS[b].flag} ${NATIONS[b].name}`, mine: krIsA ? A : B, opp: krIsA ? B : A, mySide: krIsA ? "home" : "away" }));
    } else { res = playAI(A, B); mm = res.m; }
    for (const g of res.goals) scorer[g.sh.id] = (scorer[g.sh.id] || 0) + 1, scorer[g.sh.id + "_p"] = g.sh;
    let win = res.hg > res.ag ? a : res.ag > res.hg ? b : null, pk = "";
    if (!win && mustWin) {
      const hOn = onAt90(mm.H), aOn = onAt90(mm.A);
      let so;
      if (mine) { const s = await shootoutUI(krIsA ? hOn : aOn, krIsA ? aOn : hOn, NATIONS.kr.name, NATIONS[krIsA ? b : a].name); so = krIsA ? s : { aWin: !s.aWin, a: s.b, b: s.a }; }
      else so = shootoutAuto(hOn, aOn);
      win = so.aWin ? a : b; pk = ` (승부차기 ${so.a}:${so.b})`;
    }
    if (mine) {
      S.career.caps = (S.career.caps || 0) + (r.played ? 1 : 0);
      S.career.wcG = (S.career.wcG || 0) + r.goals;
      const lines = applyMatch(r, { prestige: 3, big: 2 });
      lines.push(win === "kr" ? "🇰🇷 대한민국 승리!" : win ? "💧 패배" : "🤝 무승부");
      await showResult(r, lines, "계속");
    }
    return { a, b, hg: res.hg, ag: res.ag, win, pk };
  };
  const log = [];
  for (let gi = 0; gi < 2; gi++) {
    const g = groups[gi];
    for (const [i, j] of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]) {
      const m = await play(g[i], g[j], `${"AB"[gi]}조`, false);
      const t = T[gi];
      t[m.a].gf += m.hg; t[m.b].gf += m.ag; t[m.a].gd += m.hg - m.ag; t[m.b].gd += m.ag - m.hg;
      if (m.hg > m.ag) t[m.a].pts += 3; else if (m.hg < m.ag) t[m.b].pts += 3; else { t[m.a].pts++; t[m.b].pts++; }
      log.push(`${"AB"[gi]}조 ${NATIONS[m.a].flag} ${m.hg}:${m.ag} ${NATIONS[m.b].flag}`);
    }
  }
  const adv = T.map((t) => Object.entries(t).sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf).slice(0, 2).map((x) => x[0]));
  const sf1 = await play(adv[0][0], adv[1][1], "4강", true), sf2 = await play(adv[1][0], adv[0][1], "4강", true);
  log.push(`4강 ${NATIONS[sf1.a].flag} ${sf1.hg}:${sf1.ag} ${NATIONS[sf1.b].flag}${sf1.pk}`, `4강 ${NATIONS[sf2.a].flag} ${sf2.hg}:${sf2.ag} ${NATIONS[sf2.b].flag}${sf2.pk}`);
  const fin = await play(sf1.win, sf2.win, "결승", true);
  log.push(`결승 ${NATIONS[fin.a].flag} ${fin.hg}:${fin.ag} ${NATIONS[fin.b].flag}${fin.pk}`);
  const champ = fin.win;
  S.wcWinner = { nat: champ, season: year + 1 };
  const topId = Object.keys(scorer).filter((k) => !k.endsWith("_p")).sort((x, y) => scorer[y] - scorer[x])[0];
  const boot = topId ? scorer[topId + "_p"] : null;
  news(`🌍 월드컵 우승: ${NATIONS[champ].flag} ${NATIONS[champ].name}! 득점왕 ${boot ? boot.n + " " + scorer[topId] + "골" : "-"}`);
  const krRes = adv.flat().includes("kr") ? ([sf1, sf2].some((m) => (m.a === "kr" || m.b === "kr") && m.win === "kr") ? (champ === "kr" ? "🏆 우승" : "🥈 준우승") : "4강") : field.includes("kr") ? "조별리그 탈락" : "미출전";
  if (meIn) {
    S.career.wc = (S.career.wc || []).concat([`${year}시즌 ${krRes}`]);
    if (champ === "kr") { S.career.trophies.push(`${year}시즌 월드컵`); S.career.awards.push(`${year}시즌 🌍 월드컵 우승`); S.career.awardScore = (S.career.awardScore || 0) + 60; S.fame += 60; }
    if (boot && boot.id === "me") { S.career.awards.push(`${year}시즌 🌍 월드컵 득점왕`); S.career.awardScore = (S.career.awardScore || 0) + 20; }
    addLog(`🌍 월드컵 대한민국 ${krRes}`);
  }
  await modal({ emoji: "🌍", title: `월드컵 우승: ${NATIONS[champ].flag} ${NATIONS[champ].name}`, wide: true, img: "assets/ceremony.webp",
    html: `<p>🇰🇷 대한민국: <b>${krRes}</b>${boot ? ` · 👟 득점왕 ${esc(boot.n)} ${scorer[topId]}골` : ""}</p><div class="wc-log">${log.map((l) => `<div>${l}</div>`).join("")}</div>`,
    buttons: [{ label: "이적 시장으로", value: 1, cls: "btn-primary" }] });
}

async function offseason() {
  const P = S.pro;
  const myAvg = avg(P.s.ratings);
  S.age++; S.rival.age++;
  const decl = [];
  if (S.age >= 31) {
    for (const k of STAT_KEYS) { const d = (k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8); S.stats[k] = clamp(S.stats[k] - d, 1, 99); }
    decl.push("나이가 들며 스피드와 체력이 떨어졌어요");
  }
  if (S.rival.age >= 31) for (const k of STAT_KEYS) S.rival.stats[k] = clamp(S.rival.stats[k] - ((k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8)), 1, 99);
  worldOffseason();
  const oldRv = S.rival.club;
  if (ROVR() > clubStr(S.rival.league, S.rival.club) + 3 || spotRace(S.rival.club, "rv").margin < -4) rivalPickClub();
  const rvMoved = oldRv !== S.rival.club;
  if (rvMoved) news(`🔁 라이벌 ${S.rival.name}, ${oldRv} → ${S.rival.club}`);
  const score = OVR() + (myAvg - 6.7) * 3 + Math.min(S.fame / 150, 4) + DIFF[S.diff || "normal"].offer;
  const offers = offerList(score, { exclude: P.club, agent: S.flags.agent, transfer: true }).filter((o) => o.str >= clubStr(P.league, P.club) - 2 || P.lastBench);
  if (S.rival.club !== P.club && !offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 7 && Math.random() < .6) {
    const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] });
  }
  await tip("t-transfer", "시즌이 끝나면 <b>이적 제안</b>이 와요. 제안마다 그 팀 순위, 같은 자리 경쟁자, 선발 가능성이 보여요.<br/>AI 선수들도 매 오프시즌 실제로 이적하고, 은퇴하고, 신인이 들어와요. 📰 뉴스에서 확인할 수 있어요.");
  const choice = await offerScreen({
    title: "💼 이적 시장",
    hint: `${decl.length ? "⏳ " + decl.join(", ") + "<br/>" : ""}현재 ${LEAGUES[P.league].flag} <b>${esc(P.club)}</b> (전력 ${Math.round(clubStr(P.league, P.club))}, 선발 가능성 ${Math.round(starterProb(P.club) * 100)}%) · 종합 ${OVR()} · 시장가치 ${fmtMV(marketValue(W.p.me))}<br/>${rvMoved ? `📰 라이벌 ${esc(S.rival.name)}, <b>${esc(S.rival.club)}</b>로 이적!` : `라이벌 ${esc(josa(S.rival.name, "은/는"))} ${esc(S.rival.club)}에 남아요.`}`,
    offers, stay: `🤝 ${P.club}에 남는다`,
  });
  if (choice) { const from = P.club; joinClub(choice); addLog(`💼 ${LEAGUES[choice.league].flag} ${choice.club}로 이적!`); news(`🔁 ${S.name}, ${from} → ${choice.club} 이적 (이적료 ${fmtMV(marketValue(W.p.me))})`); S.fame += 5; }
  if (rvMoved) addLog(`📰 라이벌 ${S.rival.name}, ${S.rival.club}로 이적`);
  P.season++;
  initSeason(false);
  S.pending = null; save();
  show("scr-main"); renderMain();
}

/* ---------- 세계 보기: 리그 · 스쿼드 · 뉴스 · 선수 ---------- */
function bindPlayerLinks(root) {
  root.querySelectorAll("[data-pid]").forEach((a) => a.onclick = (e) => { e.stopPropagation(); openPlayer(a.dataset.pid); });
}
function openLeague(lgId = S.pro.league, tab = "table") {
  const lgBtns = LEAGUES.map((l) => `<button class="${l.id === lgId ? "on" : ""}" data-lg="${l.id}">${l.flag} ${l.name}</button>`).join("");
  const tabs = [["table", "순위"], ["res", "결과"], ["g", "득점"], ["a", "도움"], ["rt", "평점"], ["cup", "대륙컵"]].map(([k, n]) => `<button class="${k === tab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("");
  let body;
  const pl = (p) => `<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>`;
  if (tab === "table") {
    body = `<table class="tbl"><tr><th>#</th><th>클럽</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>${sortedTable(lgId).map(([n, t], i) =>
      `<tr class="${n === S.pro.club ? "me" : n === W.p.rv.c ? "rv" : ""}"><td>${i + 1}</td><td><a class="pl" data-club="${esc(n)}">${crestHTML(n, 14)} ${esc(n)}</a></td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join("")}</table>`;
  } else if (tab === "res") {
    const rs = S.lgs[lgId].res.slice(-5);
    body = rs.length ? rs.map((x) => `<div class="rep"><div>${crestHTML(x.h, 16)} <b>${esc(x.h)}</b> <em>${x.hg}:${x.ag}</em> <b>${esc(x.a)}</b> ${crestHTML(x.a, 16)}</div><small>${x.g.map((g) => `${g[0]}' ${esc(g[2])}${g[3] ? ` (${esc(g[3])})` : ""}`).join(" · ") || "득점 없음"}${x.mom ? ` · ⭐ ${esc(x.mom[0])} ${x.mom[1]}` : ""}${(x.rc || []).map((c) => ` · ${c[2] === "inj" ? "🚑" : "🟥"} ${esc(c[1])} ${c[0]}'`).join("")}</small></div>`).join("") : "<p>아직 경기가 없어요.</p>";
  } else if (tab === "cup") {
    body = Object.entries(S.cups).map(([k, c]) => `<div class="ss-card"><h4>${CUPS[k].emoji} ${CUPS[k].name}</h4><div class="small">출전: ${c.teams.map(esc).join(", ")}</div>${c.log.map((l) => `<div class="small">${esc(l)}</div>`).join("") || `<div class="small">${CUPS[k].at[0]}라운드 뒤에 시작해요</div>`}${c.winner ? `<div>🏆 <b>${esc(c.winner)}</b></div>` : c.alive.length > 1 ? `<div class="small">생존: ${c.alive.map(esc).join(", ")}</div>` : ""}</div>`).join("");
  } else {
    const list = topBy(lgId, tab, 15);
    body = list.length ? `<table class="tbl"><tr><th>#</th><th>선수</th><th>클럽</th><th>경기</th><th>⚽</th><th>🅰️</th><th>평점</th></tr>${list.map((p, i) =>
      `<tr class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><td>${i + 1}</td><td>${NATIONS[p.nat].flag}${pl(p)}${p.id === "rv" ? "⚔️" : ""}</td><td>${esc(shortName(p.c))}</td><td>${p.s.ap}</td><td>${p.s.g}</td><td>${p.s.a}</td><td>${pAvg(p).toFixed(2)}</td></tr>`).join("")}</table>` : "<p>아직 기록이 없어요.</p>";
  }
  const p = modal({ title: "🏆 세계 축구", wide: true, html: `<div class="seg wrap lg-seg">${lgBtns}</div><div class="seg wrap lg-seg">${tabs}</div><div class="lg-body">${body}</div>`, buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }] });
  setTimeout(() => {
    document.querySelectorAll("#modal [data-lg]").forEach((b) => b.onclick = () => { $("modal").hidden = true; openLeague(+b.dataset.lg, tab); });
    document.querySelectorAll("#modal [data-tab]").forEach((b) => b.onclick = () => { $("modal").hidden = true; openLeague(lgId, b.dataset.tab); });
    bindPlayerLinks($("modal"));
    document.querySelectorAll("#modal [data-club]").forEach((a) => a.onclick = () => { $("modal").hidden = true; openSquad(a.dataset.club); });
  }, 0);
  return p;
}
function openSquad(club = S.pro.club) {
  const order = ["gk", "df", "mf", "wg", "fw"];
  const ps = clubPlayers(club).sort((a, b) => order.indexOf(a.r) - order.indexOf(b.r) || pOvr(b) - pOvr(a));
  const xi = bestXI(ps, false);
  const race = club === S.pro.club ? spotRace(club) : null;
  modal({
    title: `${crestHTML(club, 30)} ${esc(club)}`, wide: true,
    html: `${race ? `<p class="small">${ROLE_KO[S.pos]} ${race.slots}자리 · 선발 가능성 <b>${Math.round(race.p * 100)}%</b>${race.kth ? ` · 넘어야 할 상대 <b>${esc(race.kth.n)} ${Math.round(pOvr(race.kth))}</b>` : ""}</p>` : `<p class="small">${LEAGUES[W.c[club].l].flag} ${LEAGUES[W.c[club].l].name} ${rankOf(club)}위</p>`}
      <table class="tbl"><tr><th>자리</th><th>선수</th><th>나이</th><th>능력</th><th>경기</th><th>⚽</th><th>🅰️</th><th>평점</th></tr>${ps.map((p) =>
        `<tr class="${p.id === "me" ? "me" : p.id === "rv" ? "rv" : ""}"><td>${ROLE_KO[p.r]}${xi.includes(p) ? "" : " <small>후보</small>"}</td><td>${NATIONS[p.nat].flag}<a class="pl" data-pid="${p.id}">${esc(p.n)}</a>${p.inj > 0 ? " 🚑" : ""}</td><td>${ageOf(p)}</td><td><b>${Math.round(pOvr(p))}</b></td><td>${p.s.ap}</td><td>${p.s.g}</td><td>${p.s.a}</td><td>${p.s.ap ? pAvg(p).toFixed(1) : "-"}</td></tr>`).join("")}</table>`,
    buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => bindPlayerLinks($("modal")), 0);
}
function openPlayer(id) {
  const p = W.p[id]; if (!p) return;
  const st = sOf(p);
  const hist = [...(p.h || []), ...(p.s.ap || p.cs.ap ? [{ y: S.pro.season, c: p.c, ap: p.s.ap + p.cs.ap, g: p.s.g + p.cs.g, a: p.s.a + p.cs.a, r: Math.round(pAvg(p) * 100) / 100, now: true }] : [])];
  if (id === "me") return openCareer();
  $("modal").hidden = true;
  modal({
    title: `${NATIONS[p.nat].flag} ${esc(p.n)}${id === "rv" ? " ⚔️" : ""}`, wide: true,
    html: `<p class="small">${ROLE_KO[p.r]} · ${ageOf(p)}세 · ${NATIONS[p.nat].name} · ${p.c ? `<a class="pl" data-club="${esc(p.c)}">${crestHTML(p.c, 14)} ${esc(p.c)}</a>` : "무소속"} · 종합 <b>${Math.round(pOvr(p))}</b> · 시장가치 <b>${fmtMV(marketValue(p))}</b>${p.inj > 0 ? ` · 🚑 부상 ${p.inj}경기` : ""}</p>
      <div class="roll">${STATS.map((s) => `<div><span>${s.emoji} ${s.name}</span><b>${Math.round(st[s.key])}</b></div>`).join("")}</div>
      <table class="tbl"><tr><th>시즌</th><th>클럽</th><th>경기</th><th>⚽</th><th>🅰️</th><th>평점</th></tr>${hist.slice().reverse().map((h) => `<tr><td>${h.y}${h.now ? "*" : ""}</td><td>${esc(shortName(h.c))}</td><td>${h.ap}</td><td>${h.g}</td><td>${h.a}</td><td>${h.r ? h.r.toFixed(2) : "-"}</td></tr>`).join("")}</table>
      <p class="small">통산 ⚽ ${hist.reduce((s, h) => s + h.g, 0)} · 🅰️ ${hist.reduce((s, h) => s + h.a, 0)} (기록 보관 이후)</p>`,
    buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => document.querySelectorAll("#modal [data-club]").forEach((a) => a.onclick = () => { $("modal").hidden = true; openSquad(a.dataset.club); }), 0);
}
function openNews() {
  modal({ title: "📰 축구 소식", wide: true, html: `<div class="news-list">${(S.news || []).map((n) => `<div><small>${n.t}</small> ${esc(n.m)}</div>`).join("") || "<p>아직 소식이 없어요.</p>"}</div>`, buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }] });
}

/* ---------- 은퇴 / 선수 카드 ---------- */
function careerScore() {
  const c = S.career, pf = POS_F[S.pos] || 1;
  return Math.round(c.apps * .3 + (c.g + c.a * .8) * pf * .8 + c.mom * .5 + (c.awardScore || 0) + c.ballon * 60 + c.ballonTop3 * 20 + Math.max(0, c.peakOvr - 55) * 4 + c.peakTier * 15 + (c.caps || 0));
}
function gradeOf(sc) { let g = CAREER_GRADES[0][1]; for (const [t, n] of CAREER_GRADES) if (sc >= t) g = n; return g; }
async function retire() {
  const sc = careerScore(), grade = gradeOf(sc);
  S.phase = "retired"; S.pending = null;
  const entry = { name: S.name, pos: S.pos, look: S.look, kit: S.pro.kit, grade, score: sc, peak: S.career.peakOvr, apps: S.career.apps, g: S.career.g, a: S.career.a,
    ballon: S.career.ballon, trophies: S.career.trophies.length, rival: S.rival.name, h2h: { ...S.h2h }, date: new Date().toISOString().slice(0, 10) };
  const hof = JSON.parse(localStorage.getItem(HOF_KEY) || "[]"); hof.push(entry); hof.sort((a, b) => b.score - a.score); localStorage.setItem(HOF_KEY, JSON.stringify(hof.slice(0, 30)));
  save();
  show("scr-end");
  const rv = S.rival;
  const cmp = S.career.g + S.career.a - (rv.career.g + rv.career.a);
  $("end-body").innerHTML = `<div class="end-hero"><p>${esc(S.name)}, ${S.age}세. ${S.career.apps}경기의 여정을 마치고 축구화를 벗었어요.</p></div>
    <canvas id="card" width="540" height="820"></canvas>
    <div class="end-rv"><b>⚔️ 라이벌과의 결말</b><p>${rivalEnding()}</p>
      <div>통산 나 ⚽${S.career.g} 🅰️${S.career.a} 🏅${S.career.ballon} · ${esc(rv.name)} ⚽${rv.career.g} 🅰️${rv.career.a} 🏅${rv.career.ballon}</div>
      <div>맞대결 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패 · ${cmp > 0 ? "공격 포인트는 내가 앞섰어요" : cmp < 0 ? "공격 포인트는 라이벌이 앞섰어요" : "공격 포인트 동률"}</div></div>
    <div class="end-list"><b>🏆 커리어</b>${S.career.awards.slice(-12).map((t) => `<div>${t}</div>`).join("") || "<div>-</div>"}</div>`;
  drawCard($("card"), entry);
  $("b-share").onclick = shareCard;
}
function rivalEnding() {
  const rel = S.rival.rel, n = esc(S.rival.name);
  if (rel >= 40) return `은퇴식 날, ${josa(n, "이/가")} 꽃다발을 들고 찾아왔어요. "너 아니었으면 나도 여기까지 못 왔어." 둘은 오래도록 웃었어요.`;
  if (rel >= 10) return `${josa(n, "은/는")} SNS에 짧게 남겼어요. "최고의 경쟁자에게. 수고했다." 존중으로 끝난 라이벌이었어요.`;
  if (rel > -10) return `${josa(n, "과/와")}의 경쟁은 끝까지 팽팽했어요. 기자들은 둘을 한 시대의 두 얼굴로 기억해요.`;
  if (rel > -40) return `${josa(n, "은/는")} 은퇴 소식에 "드디어 편해지겠네"라고 답했어요. 끝까지 견제하던 사이였어요.`;
  return `${josa(n, "과/와")} 끝내 화해하지 못했어요. 하지만 팬들은 둘의 맞대결을 리그 최고의 더비로 기억해요.`;
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
  ctx.fillText(`${e.apps}경기 · ⚽ ${e.g} · 🅰️ ${e.a} · 🏆 ${e.trophies} · 🏅 ${e.ballon}`, W / 2, 690);
  ctx.fillStyle = "#ff9a9a"; ctx.fillText(`⚔️ vs ${e.rival}  ${e.h2h.w}승 ${e.h2h.d}무 ${e.h2h.l}패`, W / 2, 730);
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = "18px Jua, sans-serif"; ctx.fillText("더 윙어 2 : 라이벌", W / 2, 785);
}
async function shareCard() {
  const cv = $("card");
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const file = new File([blob], "the-winger-card.png", { type: "image/png" });
  const text = `⚽ ${S.name} 커리어 종료! ${gradeOf(careerScore())} · ⚽${S.career.g} 🅰️${S.career.a} 🏅발롱도르 ${S.career.ballon}회\n#더윙어2 ${location.href}`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch {}
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "the-winger-card.png"; a.click();
  try { await navigator.clipboard.writeText(text); toast("카드를 저장하고 결과 문구를 복사했어요"); } catch { toast("카드를 저장했어요"); }
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
    html: `<div class="rv-modal"><div id="rvm-av"></div><div><b>${t.mood} ${t.name}</b><br/>${ORIGINS[rv.origin].flag} ${ORIGINS[rv.origin].name} · ${POS[rv.pos].name} · ${rv.age}세<br/>${rv.club ? `${LEAGUES[rv.league].flag} ${esc(rv.club)}` : ORIGINS[rv.origin].team}<br/>관계 ${relLabel(rv.rel)} (${rv.rel})</div></div>
      <div class="cmp-head"><span>나</span><span>능력치</span><span>라이벌</span></div>${rows}
      <div class="cmp-row tot"><b>${OVR()}</b><span>종합</span><b>${ROVR()}</b></div>
      <p class="small">맞대결 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패${rv.career.g || rv.career.a ? ` · 라이벌 통산 ⚽${rv.career.g} 🅰️${rv.career.a}` : ""}${rv.career.ballon ? ` · 🏅${rv.career.ballon}` : ""}</p>
      <p class="small">💡 관계는 이벤트 선택으로 바뀌어요. 관계가 좋으면 함께 훈련하자는 제안이 오고, 은퇴식 결말도 달라져요.</p>`,
    buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }],
  });
  setTimeout(() => { const el = $("rvm-av"); if (el) el.appendChild(avatarCanvas(rv.look, rivalKit(), 80, { mood: "smug" })); }, 0);
}
function openCareer() {
  const c = S.career;
  const yRows = S.youth.apps ? `<p class="small">유스 ${S.youth.apps}경기 ⚽${S.youth.g} 🅰️${S.youth.a} · 우승 ${S.youth.trophies}회 · 평균 ${avg(S.youth.ratings).toFixed(2)}</p>` : "";
  const rows = c.seasons.map((s) => `<tr><td>${s.season}</td><td>${esc(shortName(s.club))}</td><td>${s.rank}</td><td>${s.apps}</td><td>${s.g}</td><td>${s.a}</td><td>${s.avg ? s.avg.toFixed(2) : "-"}</td><td>${s.ballon}</td></tr>`).join("");
  modal({
    title: "📊 커리어", wide: true,
    html: `${yRows}${rows ? `<table class="tbl"><tr><th>시즌</th><th>클럽</th><th>순위</th><th>경기</th><th>⚽</th><th>🅰️</th><th>평점</th><th>발롱</th></tr>${rows}</table>` : "<p>아직 프로 기록이 없어요.</p>"}
      <p class="small">통산 ${c.apps}경기 ⚽${c.g} 🅰️${c.a} · MOM ${c.mom} · 🇰🇷 A매치 ${c.caps || 0}경기${c.wcG ? ` ${c.wcG}골` : ""}${c.wc ? ` · 🌍 월드컵 ${c.wc.join(", ")}` : ""}</p>
      ${c.awards.length || c.trophies.length ? `<div class="aw-list">${[...c.trophies.map((t) => "🏆 " + t), ...c.awards].map((a) => `<span>${a}</span>`).join("")}</div>` : ""}
      ${S.phase === "pro" ? `<p class="small">현재 커리어 점수 ${careerScore()} · ${gradeOf(careerScore())}</p>` : ""}`,
    buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }],
  });
}
function shortName(n) { return n.length > 7 ? n.slice(0, 7) + "…" : n; }
async function openShop() {
  const html = () => `<p class="small">💰 보유 ${fmtMoney(S.money)}</p>` + SHOP.map((it) => {
    const lv = S.gear[it.id], price = it.price[lv];
    return `<div class="shop-row"><span>${it.emoji}</span><div><b>${it.name} Lv.${lv}</b><small>${it.desc} (레벨당)</small></div>${lv >= 3 ? "<em>MAX</em>" : `<button class="btn btn-primary sm" data-buy="${it.id}" ${S.money < price ? "disabled" : ""}>${price}만</button>`}</div>`;
  }).join("");
  const p = modal({ title: "🛍️ 상점", html: `<div id="shop-in">${html()}</div>`, buttons: [{ label: "닫기", value: 1, cls: "btn-ghost" }] });
  const bind = () => document.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => {
    const it = SHOP.find((x) => x.id === b.dataset.buy), lv = S.gear[it.id], price = it.price[lv];
    if (S.money < price) return;
    S.money -= price; S.gear[it.id]++;
    if (it.id === "boots") { S.stats.sho = clamp(S.stats.sho + 2, 1, 99); S.stats.dri = clamp(S.stats.dri + 2, 1, 99); }
    Sfx.good(); addLog(`🛍️ ${it.name} Lv.${S.gear[it.id]} 구매`); save();
    $("shop-in").innerHTML = html(); bind();
  });
  bind();
  await p; renderMain();
}
function openHelp() {
  modal({
    title: "❓ 도움말", wide: true,
    html: `<div class="help">
      <p><b>🏋️ 훈련과 컨디션</b><br/>훈련하면 능력치↑ 컨디션↓. 컨디션 50 아래면 효율이 떨어지고, 30 아래로 내려가는 훈련은 부상 위험이 있어요. 버튼에 위험도가 떠요.</p>
      <p><b>⭐ 재능</b><br/>별이 많은 능력치일수록 빨리 자라요. 유스마다 잘 크는 능력치도 달라요.</p>
      <p><b>⚔️ 라이벌</b><br/>라이벌도 매달 자라요. 대회 결승, 리그 맞대결, 득점왕, 발롱도르에서 계속 부딪혀요. 이벤트 선택으로 관계가 바뀌고 결말이 달라져요.</p>
      <p><b>🔥 승부처 미니게임</b><br/>경기 중 내 선수가 끼는 찬스가 오면 직접 해결해요. 포지션마다 자주 나오는 게 달라요.</p>
      <ul>
        <li><b>⚽ 슈팅</b> (공격수·윙어): 키퍼가 서 있는 반대쪽 코스를 9칸 중에 고르고, 파워 게이지를 초록에서 멈춰요. 너무 세면 크로스바를 넘기고, 약하면 막혀요.</li>
        <li><b>🏃 1:1 돌파</b> (윙어·공격수): 수비수 무게중심이 한쪽으로 쏠린 순간(빨간 화살표) 반대쪽으로 치고 나가요.</li>
        <li><b>🎯 침투 패스</b> (미드필더): 달려드는 동료 셋 중, 오프사이드 라인을 넘기 전에 마크 없는 동료를 탭해요.</li>
        <li><b>🛡️ 태클</b> (수비수·미드필더): 상대가 공을 길게 친 순간(초록) 태클! 너무 빨리 뻗으면 파울로 경고를 받아요.</li>
        <li><b>🥅 페널티킥 · 승부차기</b>: 팀에서 슈팅이 가장 좋으면 내가 키커예요. 컵·결승 무승부는 승부차기로 가요.</li>
      </ul>
      <p>능력치가 높을수록 판정 구간이 넓어지고 게이지가 느려져요. 🤖 자동을 켜면 AI 선수들과 똑같은 확률로 계산돼요.</p>
      <p><b>🌍 축구 세계</b><br/>6개 리그(K리그1, J리그, 네덜란드, 포르투갈, 스페인, 잉글랜드) 60개 클럽의 960명이 매 라운드 실제로 경기를 치러요. 모든 경기는 같은 엔진이에요: 미드필드 싸움으로 찬스가 나고, 슈터·패서·수비수·키퍼의 실제 능력치로 결과가 정해져요. 선수들은 나이 들고, 성장하고, 이적하고, 은퇴해요.</p>
      <p><b>📅 프로</b><br/>한 시즌 ${ROUNDS}라운드(홈·원정). 같은 자리 동료보다 잘해야 선발이에요. 리그 상위권이면 다음 시즌 대륙컵(챔피언스 컵·아시아 챔피언스 컵), 4시즌마다 월드컵. 31세부터 은퇴 가능, 36세 시즌이 마지막이에요.</p>
      <p><b>🎚️ 난이도</b><br/>쉬움·보통·어려움에 따라 성장 속도, 부상, 라이벌의 독함, 이적 제안, 슈팅 미니게임 난이도가 달라져요.</p></div>`,
    buttons: [{ label: "닫기", value: 1, cls: "btn-primary" }],
  });
}
function openHof() {
  const hof = JSON.parse(localStorage.getItem(HOF_KEY) || "[]");
  $("hof-list").innerHTML = hof.length ? hof.map((e, i) => `<div class="hof-row"><span>${i + 1}</span><div class="hav" data-i="${i}"></div><div><b>${esc(e.name)} <small>${POS[e.pos].short} · 최고 ${Math.round(e.peak)}</small></b><span>${e.grade}</span><small>⚽${e.g} 🅰️${e.a} 🏆${e.trophies} 🏅${e.ballon} · vs ${esc(e.rival)} ${e.h2h.w}-${e.h2h.d}-${e.h2h.l}</small></div><em>${e.score}</em></div>`).join("") : `<p class="hint">아직 은퇴한 선수가 없어요.</p>`;
  document.querySelectorAll("#hof-list .hav").forEach((d) => { const e = hof[+d.dataset.i]; d.appendChild(avatarCanvas(e.look, e.kit, 44)); });
  show("scr-hof");
}

/* ---------- 이어하기 ---------- */
async function resume() {
  S = load();
  if (!S) return initTitle();
  W = S.world || null;
  if (!S.diff) S.diff = "normal";
  if (S.phase === "pro") ensureWorld();
  show("scr-main"); renderMain();
  if (S.pending === "tournament") await runTournament();
  else if (S.pending === "match") await proRound();
  else if (S.pending === "season") await seasonEnd();
  else if (S.pending === "offers") await youthEnd();
}

/* ---------- 오류가 나도 멈춘 채로 두지 않아요 ---------- */
window.addEventListener("unhandledrejection", (e) => { busy = false; console.error(e.reason); toast("⚠️ 오류가 났어요. 화면을 새로고침하면 이어서 할 수 있어요."); });
window.addEventListener("error", (e) => { busy = false; console.error(e.error || e.message); });

/* ---------- 시작 ---------- */
$("btn-new").onclick = async () => {
  const sv = load();
  if (sv && sv.phase !== "retired") {
    const ok = await modal({ emoji: "⚠️", title: "새로 시작할까요?", html: `<p>진행 중인 <b>${esc(sv.name)}</b>의 기록이 사라져요.</p>`, buttons: [{ label: "새로 시작", value: true, cls: "btn-primary" }, { label: "취소", value: false }] });
    if (!ok) return;
  }
  startCreate();
};
$("btn-continue").onclick = resume;
$("btn-hof").onclick = openHof;
$("btn-hof-back").onclick = initTitle;
$("btn-create-home").onclick = initTitle;
$("b-again").onclick = () => { localStorage.removeItem(SAVE_KEY); initTitle(); };
initTitle();
