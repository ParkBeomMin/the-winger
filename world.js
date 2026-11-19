/* 더 윙어 2 - 리그 세계: 30개 클럽 × 16명, 매 라운드 3개 리그 전 경기가 돌아가요.
 * 선수마다 시즌 기록(출전·골·도움·평점)이 쌓이고 순위표·득점왕·발롱도르가 전부 여기서 나와요. */
"use strict";

const ROLE_XI = ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "wg", "wg", "fw"];
const ROLE_SQUAD = [...ROLE_XI, "gk", "df", "mf", "wg", "fw"];
const SLOTS = { gk: 1, df: 4, mf: 3, wg: 2, fw: 1 };
const ROLE_KO = { gk: "GK", df: "DF", mf: "MF", wg: "WG", fw: "FW" };
const G_W = { fw: 5, wg: 3.2, mf: 1.5, df: .4, gk: 0 };
const A_W = { mf: 4, wg: 3.4, fw: 2, df: 1, gk: .1 };
const KR_GIVEN2 = ["재현", "승우", "민재", "강인", "희찬", "준호", "현우", "우진", "지훈", "성민", "동현", "태양", "한결", "다온", "시온", "도윤",
  "정우", "윤호", "상훈", "규민", "범준", "찬영", "세진", "형준"];
const EU_FIRST2 = ["토마스", "얀", "루이스", "안드레", "마르코", "필립", "세르히오", "빅토르", "오스카", "라파엘", "에밀", "휴고", "아르노", "펠릭스", "다비드", "노아"];
const EU_LAST2 = ["베르흐", "로시", "쿠퍼", "바르가스", "린드", "코르테스", "뮐러른", "하트", "피오레", "블랑코", "오코로", "드브리", "산투스", "카레라", "볼트만", "에스포", "마르티", "노르덴"];

let W = null;   // S.world 를 가리켜요

function worldName(lg, used) {
  for (let i = 0; i < 20; i++) {
    const n = lg === 0 ? pick(KR_SUR) + pick([...KR_GIVEN, ...KR_GIVEN2]) : pick([...EU_FIRST, ...EU_FIRST2]) + " " + pick([...EU_LAST, ...EU_LAST2]);
    if (!used.has(n)) { used.add(n); return n; }
  }
  return "선수" + Math.floor(Math.random() * 999);
}
const roleOfPos = (pos) => pos;   // fw/wg/mf/df 그대로

function initWorld() {
  W = S.world = { p: {}, c: {}, n: 1 };
  const used = new Set([S.name, S.rival.name]);
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const ids = [];
    ROLE_SQUAD.forEach((role, i) => {
      let o = c[1] + (i < 11 ? rand(-4, 4) : rand(-11, -4));
      if (i < 11 && role !== "gk" && Math.random() < .12) o += rand(3, 7);
      const id = "p" + W.n++;
      W.p[id] = { id, n: worldName(lg.id, used), r: role, o: Math.round(clamp(o, 40, 93) * 10) / 10, a: randi(19, 33), c: c[0], l: lg.id, s: blankS() };
      ids.push(id);
    });
    W.c[c[0]] = { l: lg.id, base: c[1], kit: [c[2], c[3]], ids };
    // 베스트 11 평균을 클럽 기준 전력에 맞춰요
    const diff = c[1] - xiAvg(c[0]);
    ids.forEach((id) => { W.p[id].o = Math.round(clamp(W.p[id].o + diff, 40, 93) * 10) / 10; });
  }
  // 세계 스타들을 빅리그 상위 클럽 공격진에 앉혀요
  const big = [...LEAGUES[2].clubs].sort((a, b) => b[1] - a[1]);
  WORLD_STARS.forEach(([n, o, a], i) => {
    const club = W.c[big[i % big.length][0]];
    const id = club.ids.find((x) => ["fw", "wg"].includes(W.p[x].r) && !W.p[x].star);
    if (id) Object.assign(W.p[id], { n, o, a, star: true });
  });
  W.p.me = { id: "me", n: S.name, r: S.pos, c: null, l: null, s: blankS() };
  W.p.rv = { id: "rv", n: S.rival.name, r: S.rival.pos, c: null, l: null, s: blankS() };
  S.lgs = {};
}
function blankS() { return { ap: 0, st: 0, g: 0, a: 0, rs: 0, mom: 0 }; }
function pOvr(p) { return p.id === "me" ? OVR() : p.id === "rv" ? ROVR() : p.o; }
function clubStr(lg, name) { return W && W.c[name] ? xiAvg(name) : (clubData(lg, name) || [0, 60])[1]; }
function xiAvg(club) { const xi = bestXI(club, false); return Math.round(xi.reduce((s, id) => s + pOvr(W.p[id]), 0) / xi.length * 10) / 10; }

/* 선발 11명: 자리별로 능력치 순, 가끔 로테이션. 나는 폼과 '선발 약속'을 반영해요 */
function bestXI(club, noisy = true, excl = []) {
  const ids = W.c[club].ids.filter((id) => !excl.includes(id) && !(id === "me" && S.injured > 0) && !(id === "rv" && S.rival.hurt > 0));
  const score = (id) => {
    const p = W.p[id];
    let v = pOvr(p);
    if (noisy) v += rand(-2.5, 2.5) - (Math.random() < .06 ? 15 : 0);
    if (id === "me") { v += S.form * 1.2; if (noisy && S.flags.forceStart) v += 100; }
    return v;
  };
  const xi = [];
  for (const role of Object.keys(SLOTS)) {
    const c = ids.filter((id) => W.p[id].r === role).map((id) => [id, score(id)]).sort((a, b) => b[1] - a[1]);
    c.slice(0, SLOTS[role]).forEach(([id]) => xi.push(id));
  }
  return xi;
}
function teamStrOf(xi) { return xi.reduce((s, id) => s + pOvr(W.p[id]), 0) / Math.max(1, xi.length); }

/* 이 클럽에서 내 자리 경쟁 — 제안 화면과 경기 전 화면이 같이 써요 */
function spotRace(club, who = "me") {
  const role = W.p[who].r, mine = pOvr(W.p[who]);
  const rivals = W.c[club].ids.filter((id) => id !== who && W.p[id].r === role).map((id) => W.p[id]).sort((a, b) => pOvr(b) - pOvr(a));
  const kth = rivals[SLOTS[role] - 1];
  const margin = kth ? mine + (who === "me" ? S.form * 1.2 : 0) - pOvr(kth) : 20;
  return { role, slots: SLOTS[role], rivals, kth, margin, p: clamp(.5 + margin / 7, .04, .97) };
}

/* 클럽 이동: 들어가는 클럽의 같은 자리 가장 약한 선수가 내가 떠난 클럽으로 가요(없으면 은퇴) */
function moveToClub(id, club) {
  const p = W.p[id], from = p.c;
  if (from === club) return;
  if (from && W.c[from]) W.c[from].ids = W.c[from].ids.filter((x) => x !== id);
  const dest = W.c[club];
  const weakest = dest.ids.filter((x) => x !== "me" && x !== "rv" && W.p[x].r === p.r).sort((a, b) => W.p[a].o - W.p[b].o)[0];
  if (weakest) {
    dest.ids = dest.ids.filter((x) => x !== weakest);
    if (from && W.c[from]) { const w = W.p[weakest]; w.c = from; w.l = W.c[from].l; W.c[from].ids.push(weakest); }
    else delete W.p[weakest];
  }
  dest.ids.push(id); p.c = club; p.l = dest.l;
}

/* ---------- 리그 일정 / 순위 ---------- */
function makeRounds(names) {
  const arr = [...names], rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const pairs = [];
    for (let i = 0; i < 5; i++) pairs.push(r % 2 ? [arr[9 - i], arr[i]] : [arr[i], arr[9 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}
function initLeagues() {
  for (const lg of LEAGUES) {
    const names = lg.clubs.map((c) => c[0]).sort(() => Math.random() - .5);
    S.lgs[lg.id] = { rounds: makeRounds(names), table: Object.fromEntries(names.map((n) => [n, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])), res: [] };
  }
  for (const id in W.p) W.p[id].s = blankS();
}
function recordGame(lgId, h, a, gh, ga) {
  const T = S.lgs[lgId].table, x = T[h], y = T[a];
  x.p++; y.p++; x.gf += gh; x.ga += ga; y.gf += ga; y.ga += gh;
  if (gh > ga) { x.w++; y.l++; x.pts += 3; } else if (gh < ga) { y.w++; x.l++; y.pts += 3; } else { x.d++; y.d++; x.pts++; y.pts++; }
}
function sortedTable(lgId = S.pro.league) {
  return Object.entries(S.lgs[lgId].table).sort((a, b) => b[1].pts - a[1].pts || (b[1].gf - b[1].ga) - (a[1].gf - a[1].ga) || b[1].gf - a[1].gf);
}
function rankOf(club) { const l = W.c[club].l; return sortedTable(l).findIndex(([n]) => n === club) + 1; }
function myRank() { return rankOf(S.pro.club); }

/* ---------- 득점자 고르기 ---------- */
function pickBy(ids, wfn) {
  const ws = ids.map((id) => Math.max(0, wfn(W.p[id])));
  let t = ws.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < ids.length; i++) { if ((t -= ws[i]) <= 0) return ids[i]; }
  return ids[0];
}
/* 라이벌은 큰 경기에 강해요 — AI 경기에서도 득점·도움 기회가 더 몰려요 */
const scorerW = (p) => G_W[p.r] * Math.pow(pOvr(p) / 75, 4) * (p.id === "rv" ? 2 : 1);
const assistW = (p) => A_W[p.r] * Math.pow(pOvr(p) / 75, 3) * (p.id === "rv" ? 1.8 : 1);
function pickScorer(xi, excl = []) { return pickBy(xi.filter((id) => !excl.includes(id)), scorerW); }
function pickAssist(xi, scorer, excl = []) { return Math.random() < .72 ? pickBy(xi.filter((id) => id !== scorer && !excl.includes(id)), assistW) : null; }

/* 경기 후 선수 기록 반영 — goals: [{side, s(득점), a(도움)}] */
function creditMatch(lgId, home, away, hxi, axi, hsub, asub, goals, fixed = {}) {
  const hg = goals.filter((g) => g.side === "home").length, ag = goals.length - hg;
  const rate = {};
  const teamAvg = { home: teamStrOf(hxi), away: teamStrOf(axi) };
  const one = (id, side, starter) => {
    const p = W.p[id];
    if (fixed[id] != null) { rate[id] = fixed[id]; } else {
      const myG = goals.filter((g) => g.s === id).length, myA = goals.filter((g) => g.a === id).length;
      const gf = side === "home" ? hg : ag, gaa = side === "home" ? ag : hg;
      let r = 6.4 + myG * .9 + myA * .6 + (gf > gaa ? .3 : gf < gaa ? -.3 : 0) + (pOvr(p) - teamAvg[side]) / 15 + rand(-.7, .7);
      if ((p.r === "df" || p.r === "gk") && gaa === 0) r += .4;
      if ((p.r === "df" || p.r === "gk") && gaa >= 3) r -= .4;
      if (id === "rv") r += .35;
      if (!starter) r = 6.2 + (r - 6.2) * .6;
      rate[id] = Math.round(clamp(r, 4, 10) * 10) / 10;
    }
    p.s.ap++; if (starter) p.s.st++; p.s.rs += rate[id];
  };
  hxi.forEach((id) => one(id, "home", true)); axi.forEach((id) => one(id, "away", true));
  hsub.forEach((id) => one(id, "home", false)); asub.forEach((id) => one(id, "away", false));
  for (const g of goals) { if (g.s && W.p[g.s]) W.p[g.s].s.g++; if (g.a && W.p[g.a]) W.p[g.a].s.a++; }
  const best = Object.entries(rate).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 7.5) W.p[best[0]].s.mom++;
  recordGame(lgId, home, away, hg, ag);
  S.lgs[lgId].res.push([home, away, hg, ag]);
  return { hg, ag, rate, mom: best && best[0] };
}
function subsOf(club, xi) {
  return W.c[club].ids.filter((id) => !xi.includes(id) && W.p[id].r !== "gk" && !(id === "me" && S.injured > 0) && !(id === "rv" && S.rival.hurt > 0))
    .sort(() => Math.random() - .5).slice(0, 3);
}
/* AI 경기 하나 */
function simGame(lgId, home, away) {
  const hxi = bestXI(home), axi = bestXI(away);
  const hs = teamStrOf(hxi) + 1.5, as = teamStrOf(axi);
  const hg = Math.min(6, poisson(clamp(1.3 * Math.exp((hs - as) / 20), .2, 3.5)));
  const ag = Math.min(6, poisson(clamp(1.15 * Math.exp((as - hs) / 20), .2, 3.4)));
  const goals = [];
  for (let i = 0; i < hg; i++) { const s = pickScorer(hxi); goals.push({ side: "home", s, a: pickAssist(hxi, s) }); }
  for (let i = 0; i < ag; i++) { const s = pickScorer(axi); goals.push({ side: "away", s, a: pickAssist(axi, s) }); }
  return creditMatch(lgId, home, away, hxi, axi, subsOf(home, hxi), subsOf(away, axi), goals);
}
/* 이번 라운드의 나머지 경기 전부 (3개 리그) */
function simRoundRest(round, skip) {
  for (const lg of LEAGUES) for (const [h, a] of S.lgs[lg.id].rounds[round]) {
    if (skip && (h === skip || a === skip)) continue;
    simGame(lg.id, h, a);
  }
}

/* ---------- 기록 조회 ---------- */
const pAvg = (p) => p.s.ap ? p.s.rs / p.s.ap : 0;
function leaguePlayers(lgId) { return Object.values(W.p).filter((p) => p.l === lgId && p.c); }
function topBy(lgId, key, n = 10) {
  const ps = leaguePlayers(lgId).filter((p) => p.s.ap > 0);
  if (key === "rt") return ps.filter((p) => p.s.ap >= Math.max(3, Math.floor((S.pro.round || ROUNDS) * .6))).sort((a, b) => pAvg(b) - pAvg(a)).slice(0, n);
  return ps.sort((a, b) => b.s[key] - a.s[key] || (key === "g" ? b.s.a - a.s.a : b.s.g - a.s.g) || pAvg(b) - pAvg(a)).slice(0, n);
}

/* ---------- 오프시즌: 나이·성장·은퇴·신인 ---------- */
function worldOffseason() {
  const used = new Set(Object.values(W.p).map((p) => p.n));
  for (const id of Object.keys(W.p)) {
    const p = W.p[id];
    if (id === "me" || id === "rv") continue;
    p.a++;
    p.o += p.a <= 23 ? rand(.5, 3) : p.a <= 28 ? rand(-.5, 1.2) : p.a <= 31 ? -rand(0, 1.8) : -rand(1, 3);
    if (p.a >= 36 || (p.a >= 33 && Math.random() < .3)) {
      const club = W.c[p.c];
      const nid = "p" + W.n++;
      W.p[nid] = { id: nid, n: worldName(club.l, used), r: p.r, o: club.base - rand(3, 9), a: randi(18, 20), c: p.c, l: club.l, s: blankS() };
      club.ids = club.ids.map((x) => x === id ? nid : x);
      delete W.p[id];
    }
  }
  // 클럽 기준 전력 쪽으로 반쯤 되돌려 리그 격차를 유지해요 (나·라이벌은 빼고)
  for (const name in W.c) {
    const c = W.c[name], diff = (c.base - xiAvg(name)) * .5;
    c.ids.forEach((id) => { if (id !== "me" && id !== "rv") W.p[id].o = Math.round(clamp(W.p[id].o + diff, 40, 94) * 10) / 10; });
  }
  // 하위 리그에서 잘한 선수 몇 명은 위 리그로 (AI 이적)
  for (const lgId of [0, 1]) {
    const tops = leaguePlayers(lgId).filter((p) => p.id[0] === "p" && p.a <= 28).sort((a, b) => pOvr(b) - pOvr(a)).slice(0, 3);
    for (const p of tops) {
      const up = LEAGUES[lgId + 1].clubs.filter((c) => c[1] <= p.o + 2).sort((a, b) => b[1] - a[1])[0];
      if (up && Math.random() < .6) moveToClub(p.id, up[0]);
    }
  }
}
