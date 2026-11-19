/* 더 윙어 2 : 라이벌 - 게임 본체 */
"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "w2-save-v1", HOF_KEY = "w2-hof-v1", TIP_KEY = "w2-tips";
const SET = JSON.parse(localStorage.getItem("w2-set") || "{}");
const saveSet = () => localStorage.setItem("w2-set", JSON.stringify(SET));
let S = null, busy = false;

const YOUTH_OPP = [["청해 유스", "#2b7bd6", "#fff"], ["북항 유스", "#222", "#ffd23f"], ["동림 아카데미", "#7a2b4a", "#fff"],
                   ["서강 유스", "#e4572e", "#fff"], ["리베라 유스", "#0b5b3a", "#fff"], ["포트밸리 아카데미", "#5a2a82", "#ffd23f"]];
const ROUNDS = 9;

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
function clubStr(lg, name) { return (S.clubStr && S.clubStr[lg] && S.clubStr[lg][name]) ?? clubData(lg, name)[1]; }

/* ---------- 저장 ---------- */
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }
function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

/* ---------- 화면 / 모달 / 토스트 ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}
function modal({ emoji = "", title = "", html = "", buttons = [{ label: "확인", value: true, cls: "btn-primary" }], wide = false }) {
  return new Promise((resolve) => {
    const m = $("modal");
    m.innerHTML = `<div class="mbox ${wide ? "wide" : ""}">${emoji ? `<div class="m-emoji">${emoji}</div>` : ""}${title ? `<h3>${title}</h3>` : ""}<div class="m-html">${html}</div>
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
  drawTitleArt();
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
const C = { step: 1, name: "", pos: "wg", foot: "R", look: { skin: 1, hair: 0, hairColor: 0, number: 11 }, origin: null, roll: null };
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
      <p class="label">타고난 재능 <small>(별이 많을수록 그 능력치가 빨리 자라요)</small></p>
      <div class="roll">${STATS.map((s) => `<div><span>${s.emoji} ${s.name}</span><b>${C.roll.stats[s.key]}</b><i>${starStr(C.roll.talent[s.key])}</i></div>`).join("")}</div>
      <button class="btn btn-ghost" id="b-reroll">🎲 재능 다시 뽑기</button>
      <button class="btn btn-primary" id="b-next">다음: 외모 꾸미기 →</button>`;
    $("in-name").oninput = (e) => (C.name = e.target.value.trim());
    $("b-rname").onclick = () => { C.name = randomName("kr"); renderCreate(); };
    el.querySelectorAll("[data-pos]").forEach((b) => b.onclick = () => { C.pos = b.dataset.pos; C.roll = rollStats(C.pos); renderCreate(); });
    el.querySelectorAll("[data-foot]").forEach((b) => b.onclick = () => { C.foot = b.dataset.foot; renderCreate(); });
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
    v: 1, name: C.name, pos: C.pos, foot: C.foot, look: { ...C.look }, origin: C.origin,
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
  return c >= 30 ? 0 : Math.round(clamp((30 - c) * 1.6 * ORIGINS[S.origin].injury, 0, 60));
}
function trainCost() { return Math.round(14 - S.stats.sta / 25 - S.gear.recovery * 2); }
function ageMul() {
  if (S.phase === "youth") return 1;
  return S.age <= 22 ? .9 : S.age <= 25 ? .7 : S.age <= 28 ? .45 : S.age <= 30 ? .3 : .15;
}
function trainGain(k, range = false) {
  const base = talentMul(S.talent[k]) * (S.phase === "youth" ? ORIGINS[S.origin].mul[k] : 1 + (ORIGINS[S.origin].mul[k] - 1) * .5)
    * ageMul() * (1 + S.gear.trainer * .1) * (S.cond >= 50 ? 1 : S.cond >= 25 ? .8 : .6) * (S.buff || 1);
  const v = S.stats[k], dim = v >= 95 ? .25 : v >= 88 ? .4 : v >= 80 ? .6 : v >= 72 ? .85 : 1;
  if (range) return [2.2 * base * dim, 3.8 * base * dim];
  return rand(2.2, 3.8) * base * dim;
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
      <span>${pro ? `${LEAGUES[S.pro.league].flag} ${esc(S.pro.club)}` : `${ORIGINS[S.origin].flag} ${ORIGINS[S.origin].team}`} · 종합 <em>${OVR()}</em></span></div>
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
    ? `${LEAGUES[rv.league].flag} ${esc(rv.club)} · 이번 시즌 ⚽${rv.season.g} 🅰️${rv.season.a}${S.pro && rv.league === S.pro.league ? ` <small>(나 ⚽${S.pro.s.g} 🅰️${S.pro.s.a})</small>` : ""}`
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

  $("hud-btns").innerHTML = `<button data-h="career">📊 커리어</button><button data-h="rival">🆚 라이벌</button>${S.shopOpen ? `<button data-h="shop">🛍️ 상점</button>` : ""}<button data-h="help">❓</button><button data-h="snd">${Sfx.muted ? "🔇" : "🔊"}</button><button data-h="home">🏠</button>`;
  $("hud-btns").querySelectorAll("[data-h]").forEach((b) => b.onclick = () => hudBtn(b.dataset.h));
  $("log").innerHTML = S.log.slice(0, 14).map((l) => `<div>${l}</div>`).join("");
}
function hudBtn(h) {
  if (h === "career") openCareer();
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
  const rubber = clamp(1 + (my - ro) / 12, .6, 1.5);
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
  if (Math.random() > (S.phase === "youth" ? .22 : .24)) return false;
  const ev = pickEvent(S);
  if (!ev) return false;
  S.ev[ev.id] = S.turn;
  const choice = await modal({
    emoji: ev.emoji, title: ev.title, html: `<p class="ev-text">${esc(ev.text(S)).replace(/\n/g, "<br/>")}</p>`,
    buttons: ev.choices.map((c, i) => ({ label: c.label, hint: c.hint, value: i, cls: i === 0 ? "btn-primary" : "btn-ghost" })),
  });
  const out = ev.choices[choice].fx(S);
  addLog(`${ev.emoji} ${ev.title}: ${ev.choices[choice].label.replace(/^\S+\s/, "")} → ${out}`);
  await modal({ emoji: ev.emoji, title: "결과", html: `<p>${out}</p>`, buttons: [{ label: "계속", value: 1, cls: "btn-primary" }] });
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
function meForMatch(starter, absent) {
  return { name: S.name, look: S.look, pos: S.pos, stats: S.stats, form: S.form, cond: S.cond, ovr: OVR(), starter, absent };
}
async function matchFlow(o) {
  // o: { title, sub, home, away, starter, rival, absent }
  show("scr-match");
  $("mt-title").innerHTML = o.title; $("mt-sub").innerHTML = o.sub || "";
  const body = $("mt-body");
  const lowCond = S.cond < 45;
  body.innerHTML = `
    <div class="pre">
      <div class="pre-vs"><div id="pre-me"></div><div class="pre-mid"><b>VS</b><span>${esc(o.away.name)}</span><small>전력 ${Math.round(o.away.str)} · 우리 ${Math.round(o.home.str)}</small></div><div id="pre-opp"></div></div>
      ${o.rival ? `<div class="pre-rv">⚔️ 라이벌 <b>${esc(S.rival.name)}</b> 출전! 상대 전적 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패</div>` : ""}
      <div class="pre-info">${o.absent ? "🤕 부상으로 결장해요" : o.starter ? "✅ 선발 출전" : "🪑 벤치 대기 (후반 교체 투입 예정)"} · 컨디션 ${Math.round(S.cond)} · 폼 ${formStr(S.form)}</div>
      ${lowCond && !o.absent ? `<div class="warn">⚠️ 컨디션이 낮아 승부처 성공률과 평점이 떨어져요</div>` : ""}
      <button class="btn btn-primary" id="b-watch">${o.absent ? "📺 결과 확인" : "▶️ 경기 보기"}</button>
      ${o.absent ? "" : `<button class="btn btn-ghost" id="b-quick">⚡ 결과만 보기</button>`}
    </div>`;
  $("pre-me").appendChild(avatarCanvas(S.look, o.home.kit, 70, { mood: "angry" }));
  if (o.rival) $("pre-opp").appendChild(avatarCanvas(S.rival.look, o.away.kit, 70, { mood: "smug" }));
  else $("pre-opp").innerHTML = `<div class="crest" style="background:${o.away.kit[0]};border-color:${o.away.kit[1]}">${esc(o.away.name.slice(0, 1))}</div>`;
  const choice = await new Promise((res) => {
    $("b-watch").onclick = () => res(o.absent ? "quick" : "watch");
    const q = $("b-quick"); if (q) q.onclick = () => res("quick");
  });
  const cfg = {
    home: o.home, away: o.away, me: meForMatch(o.starter, o.absent), auto: !!SET.auto,
    rival: o.rival ? { name: S.rival.name, look: S.rival.look, pos: S.rival.pos, ovr: ROVR(), side: "away" } : null,
    onAutoChange: (v) => { SET.auto = v; saveSet(); },
  };
  if (choice === "watch") {
    body.innerHTML = `<div id="match-root"></div>`;
    if (!SET.seenMini) { SET.seenMini = 1; saveSet(); await tip("t-mini", "경기 중 <b>🔥 승부처</b>가 오면 화면이 내 선수에게 확대돼요.<br/>슛은 빈 곳을 탭, 패스는 빈 동료를 탭, 돌파는 타이밍, 수비는 방향 읽기!<br/>귀찮으면 <b>🤖 승부처 자동</b>을 켜두세요."); }
    return await playMatch($("match-root"), cfg);
  }
  return simMatch(cfg);
}
async function showResult(r, lines, btnLabel = "계속") {
  const box = document.createElement("div");
  box.className = "result";
  const cls = r.rating >= 8 ? "s" : r.rating >= 7 ? "a" : r.rating >= 6 ? "b" : "c";
  box.innerHTML = `
    <div class="r-score">${r.gf} : ${r.ga} <span>${r.res === "W" ? "승리 🎉" : r.res === "D" ? "무승부 🤝" : "패배 💧"}</span></div>
    ${r.rating ? `<div class="r-rating ${cls}">평점 <b>${r.rating.toFixed(1)}</b>${r.mom ? ` <em>⭐ MOM</em>` : ""}</div>
    <div class="r-stats">⚽ ${r.goals} · 🅰️ ${r.assists} · 🛡️ ${r.saves} · 승부처 ${r.moments.filter((m) => m.ok).length}/${r.moments.length}</div>` : ""}
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
  if (!r.rating) return lines;
  const prestige = opts.prestige || 1;
  const f = Math.round(((r.rating - 6.2) * 3 + r.goals * 2 + r.assists * 1.5 + (r.mom ? 3 : 0)) * ORIGINS[S.origin].fame * (S.phase === "youth" ? .6 : .6 + prestige * .2));
  S.fame = Math.max(0, S.fame + f);
  lines.push(`⭐ 명성 ${f >= 0 ? "+" : ""}${f}`);
  const pf = S.form;
  if (r.rating >= 7.8) S.form = clamp(S.form + 1, -3, 3); else if (r.rating <= 5.6) S.form = clamp(S.form - 1, -3, 3);
  if (S.form !== pf) lines.push(`폼 ${S.form > pf ? "▲" : "▼"} ${formStr(S.form)}`);
  S.cond = clamp(S.cond - (opts.starter === false ? 4 : 10), 0, 100);
  if (opts.rival) {
    if (r.res === "W") S.h2h.w++; else if (r.res === "D") S.h2h.d++; else S.h2h.l++;
    lines.push(`⚔️ 라이벌 상대 전적 ${S.h2h.w}승 ${S.h2h.d}무 ${S.h2h.l}패`);
    if (r.rivalGoal) lines.push(`😤 ${esc(S.rival.name)}에게 골을 허용했어요`);
  }
  return lines;
}

/* ---------- 유스 대회 ---------- */
async function runTournament() {
  const final = S.month === 12;
  const name = final ? (S.year === 3 ? "유스 챔피언십 · 프로 스카우트 집결" : "유스 챔피언십") : "상반기 유스 리그";
  if (!SET.seenTour) { SET.seenTour = 1; saveSet(); }
  const base = 44 + S.year * 5;
  const myStr = base + 2 + (OVR() - (36 + S.year * 7)) * .35;
  const rivalStr = base + 3 + (ROVR() - (36 + S.year * 7)) * .3;
  const opps = [...YOUTH_OPP].sort(() => Math.random() - .5).slice(0, 2);
  let pts = 0, wins = 0;
  const kit = ORIGINS[S.origin].kit;
  const results = [];
  for (let i = 0; i < 3; i++) {
    let away, rival = false, label;
    if (i < 2) { const o = opps[i]; away = { name: o[0], kit: [o[1], o[2]], str: base + rand(-3, 4) }; label = `조별 ${i + 1}경기`; }
    else if (pts >= 3) { away = { name: ORIGINS[S.rival.origin].team, kit: ORIGINS[S.rival.origin].kit, str: rivalStr }; rival = true; label = "🏆 결승"; }
    else { const o = YOUTH_OPP.find((x) => !opps.includes(x)); away = { name: o[0], kit: [o[1], o[2]], str: base + rand(-2, 3) }; label = "순위 결정전"; }
    const absent = S.injured > 0;
    const r = await matchFlow({ title: `🏆 ${S.year}년차 ${name}`, sub: label, home: { name: ORIGINS[S.origin].team, kit, str: myStr }, away, starter: true, rival, absent });
    if (r.res === "W") { pts += 3; wins++; } else if (r.res === "D") pts += 1;
    // 결승 무승부는 승부차기
    let pk = "";
    if (i === 2 && rival && r.res === "D") { const win = Math.random() < .5 + (OVR() - ROVR()) / 100; r.res = win ? "W" : "L"; pk = win ? " (승부차기 승)" : " (승부차기 패)"; }
    const lines = applyMatch(r, { rival, starter: true });
    if (!absent) { S.youth.apps++; S.youth.g += r.goals; S.youth.a += r.assists; S.youth.ratings.push(r.rating); }
    if (r.mom) { S.money += 20; lines.push("💰 MOM 보너스 +20만"); }
    results.push({ label, opp: away.name, gf: r.gf, ga: r.ga, res: r.res, pk, rating: r.rating });
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

/* ---------- 프로 계약 ---------- */
function offerList(score, opts = {}) {
  const out = [];
  for (const lg of LEAGUES) {
    for (const c of lg.clubs) {
      const str = clubStr(lg.id, c[0]);
      if (opts.exclude && c[0] === opts.exclude) continue;
      if (str <= score + 3 && str >= score - 12) out.push({ league: lg.id, club: c[0], str, kit: [c[2], c[3]] });
    }
  }
  out.sort((a, b) => b.str - a.str);
  const n = opts.agent ? 4 : 3;
  let list = [];
  // 위쪽 몇 개 + 무작위 하나
  list = out.slice(0, n - 1);
  const rest = out.slice(n - 1);
  if (rest.length) list.push(pick(rest));
  if (!list.length && !opts.transfer) {
    const lg = LEAGUES[0], weakest = [...lg.clubs].sort((a, b) => a[1] - b[1])[0];
    list.push({ league: 0, club: weakest[0], str: clubStr(0, weakest[0]), kit: [weakest[2], weakest[3]] });
  }
  return list;
}
function starterProb(clubS, rivalTeammate) {
  let p = clamp(.5 + (OVR() - clubS) / 12, .1, .97) + S.form * .03;
  if (rivalTeammate && S.rival.pos === S.pos) p -= clamp((ROVR() - OVR()) / 20, -.15, .25);
  return clamp(p, .05, .98);
}
function salaryOf(lg, str) { return Math.round(LEAGUES[lg].pay * Math.pow(OVR() / 65, 2) * (S.flags.agent ? .9 : 1)); }
function rivalPickClub() {
  const rv = S.rival, o = ROVR() + S.rival.career.trophies;
  let best = null;
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const str = clubStr(lg.id, c[0]);
    if (str > o + 2) continue;
    if (!best || str > best.str) best = { league: lg.id, club: c[0], str };
  }
  if (!best) best = { league: 0, club: LEAGUES[0].clubs[9][0], str: LEAGUES[0].clubs[9][1] };
  rv.league = best.league; rv.club = best.club;
}

async function youthEnd() {
  S.pending = "offers"; save();
  const score = OVR() + Math.min(S.fame, 120) / 24 + S.youth.trophies * 1.5;
  const offers = offerList(score, { agent: S.flags.agent });
  rivalPickClub();
  const rivalOffer = !offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 10;
  if (rivalOffer) { const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] }); }
  const pick1 = await offerScreen({
    title: "✍️ 프로 계약 제안",
    hint: `유스 3년 끝! 종합 ${OVR()} · 명성 ${Math.round(S.fame)} · 우승 ${S.youth.trophies}회<br/>라이벌 <b>${esc(josa(S.rival.name, "은/는"))}</b> <b>${LEAGUES[S.rival.league].flag} ${esc(S.rival.club)}</b> 입단이 유력해요.`,
    offers, stay: null,
  });
  S.phase = "pro"; S.age = 19; S.rival.age = 19;
  S.clubStr = S.clubStr || Object.fromEntries(LEAGUES.map((lg) => [lg.id, Object.fromEntries(lg.clubs.map((c) => [c[0], c[1]]))]));
  joinClub(pick1);
  S.pro.season = 1; initSeason();
  addLog(`✍️ ${LEAGUES[pick1.league].flag} ${pick1.club} 입단! 프로 데뷔 시즌이 시작돼요.`);
  addLog(`📰 라이벌 ${josa(S.rival.name, "은/는")} ${S.rival.club} 입단.`);
  S.pending = null; save();
  show("scr-main"); renderMain();
  await tip("t-pro", "프로는 <b>라운드마다 훈련 1번 + 경기 1번</b>이에요. 한 시즌은 9라운드.<br/>종합이 클럽 전력보다 낮으면 벤치에서 시작할 수 있어요.<br/>시즌이 끝나면 수상, 발롱도르, 이적 제안이 기다려요.");
}
function joinClub(o) {
  const c = clubData(o.league, o.club);
  S.pro = S.pro || {};
  Object.assign(S.pro, { league: o.league, club: o.club, kit: [c[2], c[3]] });
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
      const p = Math.round(starterProb(o.str, rv) * 100);
      return `<button class="offer" data-i="${i}"><div class="crest" style="background:${o.kit[0]};border-color:${o.kit[1]}">${esc(o.club.slice(0, 1))}</div>
        <div class="of-mid"><b>${esc(o.club)}</b><span>${LEAGUES[o.league].flag} ${LEAGUES[o.league].name} · 전력 ${Math.round(o.str)}</span>
        <span>선발 가능성 <em class="${p >= 60 ? "up" : p < 35 ? "dn" : ""}">${p}%</em> · 라운드 수당 ${salaryOf(o.league, o.str)}만</span>
        ${rv ? `<span class="rv">⚔️ 라이벌 ${esc(S.rival.name)}의 팀${S.rival.pos === S.pos ? " (같은 포지션 주전 경쟁!)" : " (한 팀에서 뛰어요)"}</span>` : ""}</div></button>`;
    }).join("") || `<p class="hint">이번에는 제안이 없어요.</p>`;
    list.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { Sfx.good(); resolve(offers[+b.dataset.i]); });
    const st = $("of-stay");
    st.hidden = !stay;
    if (stay) { st.textContent = stay; st.onclick = () => resolve(null); }
  });
}

/* ---------- 프로 시즌 ---------- */
function initSeason() {
  const lg = LEAGUES[S.pro.league];
  const names = lg.clubs.map((c) => c[0]);
  // 원형 대진: 10팀 9라운드
  const arr = [...names], rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const pairs = [];
    for (let i = 0; i < 5; i++) pairs.push([arr[i], arr[9 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  const sched = rounds.map((pairs) => { const p = pairs.find((x) => x.includes(S.pro.club)); return p[0] === S.pro.club ? p[1] : p[0]; });
  Object.assign(S.pro, {
    round: 0, rounds, schedule: sched, lastBench: false,
    table: Object.fromEntries(names.map((n) => [n, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])),
    s: { apps: 0, starts: 0, g: 0, a: 0, ratings: [], mom: 0 },
  });
  S.rival.season = { g: 0, a: 0, r: [], apps: 0 };
  S.cond = Math.max(S.cond, 80);
}
function simScore(a, b) {
  return [Math.min(6, poisson(clamp(1.3 * Math.exp((a - b) / 20), .2, 3.5))), Math.min(6, poisson(clamp(1.15 * Math.exp((b - a) / 20), .2, 3.4)))];
}
function recordGame(h, a, gh, ga) {
  const T = S.pro.table, x = T[h], y = T[a];
  x.p++; y.p++; x.gf += gh; x.ga += ga; y.gf += ga; y.ga += gh;
  if (gh > ga) { x.w++; y.l++; x.pts += 3; } else if (gh < ga) { y.w++; x.l++; y.pts += 3; } else { x.d++; y.d++; x.pts++; y.pts++; }
}
function sortedTable() {
  return Object.entries(S.pro.table).sort((a, b) => b[1].pts - a[1].pts || (b[1].gf - b[1].ga) - (a[1].gf - a[1].ga) || b[1].gf - a[1].gf);
}
function myRank() { return sortedTable().findIndex(([n]) => n === S.pro.club) + 1; }
function rivalRound(rivalIsOpp, rivalStats) {
  const rv = S.rival;
  if (rv.hurt > 0) return;
  const cs = clubStr(rv.league, rv.club), o = ROVR();
  rv.season.apps++;
  if (rivalStats) { rv.season.g += rivalStats.g; rv.season.a += rivalStats.a; rv.season.r.push(rivalStats.r); return; }
  // 라이벌도 나와 같은 경기 규칙으로 뛰어요 (결과만 보기와 같은 계산)
  const lg = LEAGUES[rv.league], opp = pick(lg.clubs.filter((c) => c[0] !== rv.club));
  const starter = Math.random() < clamp(.5 + (o - cs) / 12, .1, .97);
  const r = simMatch({ home: { str: cs + (starter ? (o - cs) * .15 : 0) }, away: { str: clubStr(rv.league, opp[0]) },
    me: { pos: rv.pos, stats: rv.stats, form: 0, cond: 70, starter } });
  rv.season.g += r.goals; rv.season.a += r.assists; rv.season.r.push(r.rating);
}

async function proRound() {
  const P = S.pro, lg = LEAGUES[P.league];
  const opp = P.schedule[P.round];
  const myS = clubStr(P.league, P.club), oppS = clubStr(P.league, opp);
  const rivalOpp = S.rival.club === opp;
  const rivalMate = S.rival.club === P.club;
  const absent = S.injured > 0;
  let starter = !absent && (S.flags.forceStart || Math.random() < starterProb(myS, rivalMate));
  S.flags.forceStart = false;
  const teamStr = myS + (starter ? (OVR() - myS) * .15 : 0);
  const oc = clubData(P.league, opp);
  const r = await matchFlow({
    title: `${lg.flag} ${lg.name} R${P.round + 1}`, sub: `${P.season}시즌 · ${esc(P.club)}`,
    home: { name: P.club, kit: P.kit, str: teamStr }, away: { name: opp, kit: [oc[2], oc[3]], str: oppS },
    starter, rival: rivalOpp && !S.rival.hurt, absent,
  });
  // 다른 경기
  for (const [h, a] of P.rounds[P.round]) {
    if (h === P.club || a === P.club) continue;
    const [x, y] = simScore(clubStr(P.league, h), clubStr(P.league, a));
    recordGame(h, a, x, y);
  }
  recordGame(P.club, opp, r.gf, r.ga);
  // 라이벌
  rivalRound(rivalOpp, rivalOpp && !S.rival.hurt ? { g: r.rivalGoal ? 1 : 0, a: 0, r: r.rivalGoal ? 7.4 : 6.3 } : null);
  const lines = applyMatch(r, { rival: rivalOpp && !S.rival.hurt, starter, prestige: lg.prestige });
  if (!absent) {
    P.s.apps++; if (starter) P.s.starts++;
    P.s.g += r.goals; P.s.a += r.assists; P.s.ratings.push(r.rating); if (r.mom) P.s.mom++;
    const pay = Math.round(salaryOf(P.league, myS) * (starter ? 1 : .7) + (r.mom ? LEAGUES[P.league].pay * .5 : 0));
    S.money += pay; lines.push(`💰 수당 +${pay}만${r.mom ? " (MOM 보너스 포함)" : ""}`);
  }
  P.lastBench = !starter && !absent;
  if (absent) { S.injured--; lines.push("🤕 이번 경기는 결장했어요"); }
  lines.push(`📊 리그 ${myRank()}위 · 시즌 ⚽${P.s.g} 🅰️${P.s.a}`);
  if (rivalOpp) addLog(`⚔️ 라이벌 매치 vs ${opp} ${r.gf}:${r.ga} (평점 ${r.rating || "-"})`);
  else addLog(`${r.res === "W" ? "✅" : r.res === "D" ? "➖" : "❌"} R${P.round + 1} vs ${opp} ${r.gf}:${r.ga}${r.rating ? ` · 평점 ${r.rating}` : ""}${r.goals ? ` · ⚽${r.goals}` : ""}${r.assists ? ` · 🅰️${r.assists}` : ""}`);
  await showResult(r, lines, P.round + 1 >= ROUNDS ? "시즌 결산 →" : "계속");
  P.round++;
  S.cond = clamp(S.cond + 6, 0, 100);
  if (P.round >= ROUNDS) { S.pending = "season"; save(); return seasonEnd(); }
  S.pending = null; save();
  show("scr-main"); renderMain();
}

/* 남은 라운드 빠르게 — 훈련은 포지션 균형 자동, 경기는 결과만 */
async function quickSeason() {
  const ok = await modal({ emoji: "⚡", title: "남은 라운드 빠르게", html: `<p>남은 ${ROUNDS - S.pro.round}라운드를 자동 훈련 + 결과만 보기로 진행해요.<br/>이벤트는 그대로 물어봐요.</p>`, buttons: [{ label: "진행", value: true, cls: "btn-primary" }, { label: "취소", value: false }] });
  if (!ok) return;
  busy = true;
  try {
    while (S.phase === "pro" && S.pro.round < ROUNDS) {
      let a;
      if (S.injured > 0 || S.cond < 45) a = { kind: "rest" };
      else a = { kind: "train", key: bestTrainKey() };
      applyAction(a, null); S.turn++; rivalGrow();
      if (S.money >= 150) S.shopOpen = true;
      await maybeEvent();
      const P = S.pro, opp = P.schedule[P.round];
      const myS = clubStr(P.league, P.club), oppS = clubStr(P.league, opp);
      const rivalOpp = S.rival.club === opp, absent = S.injured > 0;
      const starter = !absent && (S.flags.forceStart || Math.random() < starterProb(myS, S.rival.club === P.club));
      S.flags.forceStart = false;
      const r = simMatch({ home: { str: myS + (starter ? (OVR() - myS) * .15 : 0) }, away: { str: oppS }, me: meForMatch(starter, absent),
        rival: rivalOpp && !S.rival.hurt ? { ovr: ROVR(), side: "away", pos: S.rival.pos } : null });
      for (const [h, x] of P.rounds[P.round]) { if (h === P.club || x === P.club) continue; const [g1, g2] = simScore(clubStr(P.league, h), clubStr(P.league, x)); recordGame(h, x, g1, g2); }
      recordGame(P.club, opp, r.gf, r.ga);
      rivalRound(rivalOpp);
      applyMatch(r, { rival: rivalOpp && !S.rival.hurt, starter, prestige: LEAGUES[P.league].prestige });
      if (!absent) {
        P.s.apps++; if (starter) P.s.starts++; P.s.g += r.goals; P.s.a += r.assists; P.s.ratings.push(r.rating); if (r.mom) P.s.mom++;
        S.money += Math.round(salaryOf(P.league, myS) * (starter ? 1 : .7) + (r.mom ? LEAGUES[P.league].pay * .5 : 0));
      } else S.injured--;
      P.lastBench = !starter && !absent;
      addLog(`${r.res === "W" ? "✅" : r.res === "D" ? "➖" : "❌"} R${P.round + 1} vs ${opp} ${r.gf}:${r.ga}${r.rating ? ` · 평점 ${r.rating}` : " · 결장"}${r.goals ? ` · ⚽${r.goals}` : ""}${r.assists ? ` · 🅰️${r.assists}` : ""}`);
      P.round++; S.cond = clamp(S.cond + 6, 0, 100);
      renderMain(); await sleepMs(180);
    }
  } finally { busy = false; }
  S.pending = "season"; save();
  seasonEnd();
}

/* ---------- 시즌 결산 ---------- */
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const POS_F = { fw: .8, wg: .9, mf: 1.3, df: 2.6 };
function ballonScore(o) { return o.ovr + o.tier * 5 + (o.avg - 6.5) * 10 + (o.g + o.a * .8) * (POS_F[o.pos] || 1) * .4 + (o.champ ? 5 : 0); }

async function seasonEnd() {
  const P = S.pro, lg = LEAGUES[P.league], rank = myRank(), tbl = sortedTable();
  const myAvg = avg(P.s.ratings), rv = S.rival, rvAvg = avg(rv.season.r);
  const awards = [];
  const sameLeague = rv.league === P.league;
  // 득점왕 — 리그 다른 선수들 최고 기록과 겨뤄요
  const otherTop = randi(4, 7) + (lg.tier - 1);
  const rivalG = sameLeague ? rv.season.g : 0;
  if (P.s.g >= 3 && P.s.g >= Math.max(otherTop, rivalG)) awards.push({ k: "boot", name: "👟 득점왕", w: 8 * lg.prestige });
  if (myAvg >= 7.4 && rank <= 3 && (!sameLeague || myAvg >= rvAvg)) awards.push({ k: "mvp", name: "👑 리그 MVP", w: 10 * lg.prestige });
  if (S.age <= 22 && myAvg >= 7.0) awards.push({ k: "young", name: "🌟 영플레이어상", w: 6 });
  if (rank === 1) { awards.push({ k: "title", name: `🏆 ${lg.name} 우승`, w: 8 * lg.prestige }); S.career.trophies.push(`${P.season}시즌 ${lg.name}`); }
  // 라이벌 수상
  const rvAwards = [];
  const rvRank = sameLeague ? tbl.findIndex(([n]) => n === rv.club) + 1 : randi(1, 10);
  if (rv.season.g >= 3 && rv.season.g > P.s.g * (sameLeague ? 1 : 0) && rv.season.g >= otherTop) rvAwards.push("👟 득점왕");
  if (rvRank === 1) { rvAwards.push("🏆 리그 우승"); rv.career.trophies++; }
  // 발롱도르
  const cands = [
    { name: S.name, me: true, pos: S.pos, ovr: OVR(), tier: lg.tier, avg: myAvg, g: P.s.g, a: P.s.a, champ: rank === 1 },
    { name: rv.name, rival: true, pos: rv.pos, ovr: ROVR(), tier: LEAGUES[rv.league].tier, avg: rvAvg, g: rv.season.g, a: rv.season.a, champ: rvAwards.includes("🏆 리그 우승") },
    ...S.stars.map((s) => ({ name: s.name, pos: "fw", ovr: s.ovr, tier: 3, avg: rand(6.9, 8.1), g: randi(3, 8), a: randi(1, 5), champ: Math.random() < .2 })),
  ].map((c) => ({ ...c, sc: ballonScore(c) })).sort((a, b) => b.sc - a.sc);
  const myB = cands.findIndex((c) => c.me) + 1, rvB = cands.findIndex((c) => c.rival) + 1;
  if (myB === 1) { awards.push({ k: "ballon", name: "🏅 발롱도르", w: 0 }); S.career.ballon++; }
  else if (myB <= 3) { S.career.ballonTop3++; }
  if (rvB === 1) { rvAwards.push("🏅 발롱도르"); rv.career.ballon++; }
  rv.career.g += rv.season.g; rv.career.a += rv.season.a; rv.career.awards.push(...rvAwards);

  // 기록
  S.career.apps += P.s.apps; S.career.g += P.s.g; S.career.a += P.s.a; S.career.mom += P.s.mom;
  S.career.awards.push(...awards.map((a) => `${P.season}시즌 ${a.name}`));
  S.career.awardScore = (S.career.awardScore || 0) + awards.reduce((x, a) => x + a.w, 0);
  S.career.peakOvr = Math.max(S.career.peakOvr, OVR());
  S.career.seasons.push({ season: P.season, age: S.age, club: P.club, league: P.league, rank, apps: P.s.apps, g: P.s.g, a: P.s.a, avg: Math.round(myAvg * 100) / 100, awards: awards.map((a) => a.name), ovr: OVR(), rv: { club: rv.club, g: rv.season.g, a: rv.season.a, avg: Math.round(rvAvg * 100) / 100, b: rvB }, ballon: myB });
  const fameGain = awards.reduce((x, a) => x + Math.round(a.w / 2), 0) + (rank <= 3 ? 6 : 0);
  S.fame += fameGain;
  const prize = rank === 1 ? lg.pay * 6 : 0;
  S.money += prize;

  // 화면
  show("scr-season");
  $("ss-title").textContent = `📋 ${P.season}시즌 결산 · ${S.age}세`;
  const myRow = (n) => n === P.club ? "me" : n === rv.club ? "rv" : "";
  $("ss-body").innerHTML = `
    <div class="ss-card"><h4>${lg.flag} ${lg.name} 최종 순위</h4>
      <table class="tbl"><tr><th>#</th><th>클럽</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${tbl.map(([n, t], i) => `<tr class="${myRow(n)}"><td>${i + 1}</td><td>${esc(n)}${n === rv.club ? " ⚔️" : ""}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf - t.ga}</td><td><b>${t.pts}</b></td></tr>`).join("")}</table></div>
    <div class="ss-card"><h4>내 시즌</h4>
      <div class="ss-me"><div id="ss-av"></div><div>${P.s.apps}경기(선발 ${P.s.starts}) · ⚽ ${P.s.g} · 🅰️ ${P.s.a} · 평균 평점 <b>${myAvg ? myAvg.toFixed(2) : "-"}</b> · MOM ${P.s.mom}<br/>
      ${awards.length ? awards.map((a) => `<span class="aw">${a.name}</span>`).join(" ") : "<small>이번 시즌 수상은 없어요</small>"}
      ${prize ? `<br/>💰 우승 상금 +${prize}만` : ""}<br/>⭐ 명성 +${fameGain}</div></div></div>
    <div class="ss-card rvc"><h4>⚔️ 라이벌 ${esc(rv.name)}</h4>
      <div>${LEAGUES[rv.league].flag} ${esc(rv.club)} · ⚽ ${rv.season.g} · 🅰️ ${rv.season.a} · 평균 ${rvAvg ? rvAvg.toFixed(2) : "-"}<br/>
      ${rvAwards.length ? rvAwards.map((a) => `<span class="aw rv">${a}</span>`).join(" ") : "<small>수상 없음</small>"}</div>
      <div class="ss-vs">${P.s.g + P.s.a > rv.season.g + rv.season.a ? "🔥 이번 시즌은 내가 이겼어요!" : P.s.g + P.s.a < rv.season.g + rv.season.a ? "😤 이번 시즌은 라이벌이 앞섰어요" : "🤝 막상막하"}</div></div>
    <div class="ss-card"><h4>🏅 발롱도르 순위</h4>
      ${cands.slice(0, 5).map((c, i) => `<div class="bl ${c.me ? "me" : c.rival ? "rv" : ""}"><span>${i + 1}</span><b>${esc(c.name)}${c.rival ? " ⚔️" : ""}</b><em>${c.sc.toFixed(1)}</em></div>`).join("")}
      ${myB > 5 ? `<div class="bl me"><span>${myB}</span><b>${esc(S.name)}</b><em>${cands[myB - 1].sc.toFixed(1)}</em></div>` : ""}
      ${rvB > 5 ? `<div class="bl rv"><span>${rvB}</span><b>${esc(rv.name)} ⚔️</b><em>${cands[rvB - 1].sc.toFixed(1)}</em></div>` : ""}</div>`;
  $("ss-av").appendChild(avatarCanvas(S.look, P.kit, 56, { mood: awards.length ? "joy" : undefined }));
  if (awards.some((a) => a.k === "ballon")) Sfx.goal();
  addLog(`📋 ${P.season}시즌 ${rank}위 · ⚽${P.s.g} 🅰️${P.s.a}${awards.length ? " · " + awards.map((a) => a.name).join(", ") : ""}`);

  const canRetire = S.age >= 31, mustRetire = S.age >= 36;
  const acts = $("ss-acts");
  acts.innerHTML = mustRetire ? `<button class="btn btn-primary" id="ss-retire">🎓 은퇴식으로</button>`
    : `<button class="btn btn-primary" id="ss-next">💼 이적 시장 →</button>${canRetire ? `<button class="btn btn-ghost" id="ss-retire">🎓 여기서 은퇴하기</button>` : ""}`;
  const choice = await new Promise((res) => {
    const n = $("ss-next"); if (n) n.onclick = () => res("next");
    const r = $("ss-retire"); if (r) r.onclick = () => res("retire");
  });
  if (choice === "retire") return retire();
  await offseason();
}

async function offseason() {
  // 나이 · 노쇠
  S.age++; S.rival.age++;
  const decl = [];
  if (S.age >= 31) {
    for (const k of STAT_KEYS) { const d = (k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8); S.stats[k] = clamp(S.stats[k] - d, 1, 99); }
    decl.push("나이가 들며 스피드와 체력이 떨어졌어요");
  }
  if (S.rival.age >= 31) for (const k of STAT_KEYS) S.rival.stats[k] = clamp(S.rival.stats[k] - ((k === "spd" || k === "sta") ? rand(1.5, 3.5) : rand(.4, 1.8)), 1, 99);
  for (const s of S.stars) { s.age++; if (s.age >= 31) s.ovr -= rand(.5, 2); else if (s.age <= 26) s.ovr += rand(0, 1.2); }
  S.stars = S.stars.filter((s) => s.age < 36 && s.ovr > 78);
  while (S.stars.length < 8) S.stars.push({ name: pick(EU_FIRST) + " " + pick(EU_LAST), ovr: rand(84, 88), age: randi(20, 24) });
  // 클럽 전력 흔들기
  for (const lg of LEAGUES) for (const c of lg.clubs) S.clubStr[lg.id][c[0]] = clamp(S.clubStr[lg.id][c[0]] + rand(-1.5, 1.5), c[1] - 6, c[1] + 6);

  // 라이벌 이적
  const oldRv = S.rival.club;
  if (ROVR() > clubStr(S.rival.league, S.rival.club) + 3 || ROVR() < clubStr(S.rival.league, S.rival.club) - 10) rivalPickClub();
  const rvMoved = oldRv !== S.rival.club;

  // 이적 제안
  const P = S.pro;
  const myAvg = avg(P.s.ratings);
  const score = OVR() + (myAvg - 6.7) * 3 + Math.min(S.fame / 150, 4);
  let offers = offerList(score, { exclude: P.club, agent: S.flags.agent, transfer: true }).filter((o) => o.str >= clubStr(P.league, P.club) - 2 || P.lastBench);
  if (S.rival.club !== P.club && !offers.find((o) => o.club === S.rival.club) && Math.abs(clubStr(S.rival.league, S.rival.club) - score) < 7 && Math.random() < .6) {
    const c = clubData(S.rival.league, S.rival.club); offers.push({ league: S.rival.league, club: c[0], str: clubStr(S.rival.league, c[0]), kit: [c[2], c[3]] });
  }
  await tip("t-transfer", "시즌이 끝나면 <b>이적 제안</b>이 와요. 더 강한 클럽은 연봉과 명성이 크지만 선발 경쟁이 치열해요.<br/>라이벌의 팀에서 제안이 오기도 해요.");
  const choice = await offerScreen({
    title: "💼 이적 시장",
    hint: `${decl.length ? "⏳ " + decl.join(", ") + "<br/>" : ""}현재 ${LEAGUES[P.league].flag} <b>${esc(P.club)}</b> (전력 ${Math.round(clubStr(P.league, P.club))}) · 종합 ${OVR()}<br/>${rvMoved ? `📰 라이벌 ${esc(S.rival.name)}, <b>${esc(S.rival.club)}</b>로 이적!` : `라이벌 ${esc(josa(S.rival.name, "은/는"))} ${esc(S.rival.club)}에 남아요.`}`,
    offers, stay: `🤝 ${P.club}에 남는다`,
  });
  if (choice) { joinClub(choice); addLog(`💼 ${LEAGUES[choice.league].flag} ${choice.club}로 이적!`); S.fame += 5; }
  if (rvMoved) addLog(`📰 라이벌 ${S.rival.name}, ${S.rival.club}로 이적`);
  P.season++;
  initSeason();
  S.pending = null; save();
  show("scr-main"); renderMain();
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
  $("end-body").innerHTML = `
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
      <p class="small">통산 ${c.apps}경기 ⚽${c.g} 🅰️${c.a} · MOM ${c.mom} · A매치 ${c.caps || 0}</p>
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
      <p><b>🔥 승부처</b><br/>경기 중 내 선수에게 찬스가 오면 미니게임으로 직접 해결해요. 🤖 자동을 켜면 능력치로 판정해요.</p>
      <p><b>📅 프로</b><br/>9라운드 시즌. 종합이 클럽 전력보다 낮으면 벤치일 수 있어요. 시즌 후 수상, 발롱도르, 이적. 31세부터 은퇴 가능, 36세 시즌이 마지막이에요.</p></div>`,
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
document.fonts && document.fonts.ready.then(() => { if ($("scr-title").classList.contains("active")) drawTitleArt(); });
initTitle();
