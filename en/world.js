/* 더 윙어 2 - 축구 세계
 * 6개 리그 60개 클럽, 클럽마다 16명. 모든 선수가 6개 능력치·국적·나이·폼·부상·커리어 기록을 가져요.
 * 모든 경기(내 경기, AI 경기, 컵, 월드컵, 유스)는 같은 엔진으로 돌아가요:
 * 미드필드 싸움 → 찬스 수 → 슈터·패서·수비수·키퍼의 실제 능력치로 슈팅 결과 → 선수별 평점. */
"use strict";

const ROUNDS = 18;
const ROLE_XI = ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "wg", "wg", "fw"];
const ROLE_SQUAD = [...ROLE_XI, "gk", "df", "mf", "wg", "fw"];
const SLOTS = { gk: 1, df: 4, mf: 3, wg: 2, fw: 1 };
/* ---------- 감독 · 포메이션 · 전술 ----------
 * 포메이션마다 자리(역할)와 2D 위치가 달라요. 홈 기준(오른쪽으로 공격) 좌표예요. */
const FORMS = {
  "4-3-3": { roles: ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "wg", "fw", "wg"],
    pos: [[.05, .5], [.22, .14], [.2, .38], [.2, .62], [.22, .86], [.42, .3], [.38, .5], [.42, .7], [.64, .18], [.68, .5], [.64, .82]] },
  "4-2-3-1": { roles: ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "wg", "fw", "wg"],
    pos: [[.05, .5], [.22, .14], [.2, .38], [.2, .62], [.22, .86], [.35, .38], [.35, .62], [.52, .5], [.55, .17], [.7, .5], [.55, .83]] },
  "4-4-2": { roles: ["gk", "df", "df", "df", "df", "mf", "mf", "wg", "wg", "fw", "fw"],
    pos: [[.05, .5], [.22, .14], [.2, .38], [.2, .62], [.22, .86], [.4, .38], [.4, .62], [.44, .14], [.44, .86], [.65, .38], [.65, .62]] },
  "3-5-2": { roles: ["gk", "df", "df", "df", "mf", "mf", "mf", "wg", "wg", "fw", "fw"],
    pos: [[.05, .5], [.2, .26], [.18, .5], [.2, .74], [.38, .32], [.35, .5], [.38, .68], [.46, .1], [.46, .9], [.65, .4], [.65, .6]] },
  "5-3-2": { roles: ["gk", "df", "df", "df", "df", "df", "mf", "mf", "mf", "fw", "fw"],
    pos: [[.05, .5], [.27, .1], [.2, .3], [.18, .5], [.2, .7], [.27, .9], [.4, .3], [.38, .5], [.4, .7], [.62, .4], [.62, .6]] },
};
/* 전술 성향: 유닛 보정 + 찬스 수(나/상대) + 찬스 질 */
const STYLES = {
  pos: { name: "Possession", mid: 3, att: 1, def: 0, self: 1.04, opp: .96, xg: 0 },
  cnt: { name: "Counter", mid: -2, att: 2, def: 2, self: .9, opp: .98, xg: .04 },
  prs: { name: "High press", mid: 1, att: 1, def: -1, self: 1.08, opp: 1.03, xg: 0 },
  def: { name: "Defensive", mid: 0, att: -3, def: 4, self: .88, opp: .9, xg: 0 },
  bal: { name: "Balanced", mid: 0, att: 0, def: 0, self: 1, opp: 1, xg: 0 },
};
/* 다른 자리에서 뛸 때 능력 배수 (윙어는 최전방·윙백, 미드필더는 측면 등) */
const COMPAT = { fw: { wg: .92, mf: .8 }, wg: { fw: .9, mf: .9, df: .85 }, mf: { wg: .9, df: .88, fw: .82 }, df: { mf: .86, wg: .82 }, gk: {} };
const NO_POOL = { gk: [1, 12, 25, 31], df: [2, 3, 4, 5, 13, 15, 22, 23, 24], mf: [6, 8, 10, 14, 16, 18, 26], wg: [7, 11, 17, 19, 21, 29], fw: [9, 20, 27, 28, 30] };
function pickNo(club, role, prefer) {
  const used = new Set(W.c[club] ? W.c[club].ids.map((id) => id === "me" ? S.look.number : id === "rv" ? S.rival.look.number : W.p[id] && W.p[id].no).filter(Boolean) : []);
  if (prefer && !used.has(prefer)) return prefer;
  const n = [...(NO_POOL[role] || []), ...Array.from({ length: 60 }, (_, i) => i + 32)].find((x) => !used.has(x));
  return n || randi(32, 99);
}
function mkCoach(lgId, base) {
  const lg = LEAGUES[lgId];
  const nat = Math.random() < .7 ? lg.nat : pickNat(lg.mix);
  const big = base >= (lg.tier === 3 ? 82 : lg.tier === 2 ? 72 : 65);
  const fw = big ? [["4-3-3", 4], ["4-2-3-1", 4], ["4-4-2", 1], ["3-5-2", 1]] : [["4-4-2", 3], ["4-2-3-1", 2], ["5-3-2", 2], ["3-5-2", 2], ["4-3-3", 2]];
  const sw = big ? [["pos", 4], ["prs", 3], ["bal", 2], ["cnt", 1]] : [["cnt", 3], ["def", 3], ["bal", 3], ["prs", 1], ["pos", 1]];
  return { n: natName(nat, new Set()), nat, f: pickNat(fw), s: pickNat(sw), a: randi(38, 64), y: 0 };
}
function ensureCoaches() {
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const C = W.c[c[0]];
    if (!C.coach) C.coach = mkCoach(lg.id, C.base);
    const mine = new Set(C.ids.filter((id) => id === "me" || id === "rv").map((id) => id === "me" ? S.look.number : S.rival.look.number));
    for (const id of C.ids) { const p = W.p[id]; if (p && id !== "me" && id !== "rv" && (!p.no || mine.has(p.no))) { p.no = 0; p.no = pickNo(c[0], p.r); } }
  }
}
const coachOf = (club) => (W && W.c[club] && W.c[club].coach) || { f: "4-3-3", s: "bal", n: "-" };
const formOf = (club) => coachOf(club).f;
const ROLE_KO = { gk: "GK", df: "DF", mf: "MF", wg: "WG", fw: "FW" };
const GK_W = { def: .7, spd: .1, sta: .1, pas: .1 };
const G_W = { fw: 3.0, wg: 2.4, mf: 1.6, df: .5, gk: 0 };
const A_W = { mf: 4, wg: 3.4, fw: 2, df: 1, gk: .1 };
const D_W = { df: 3, mf: 1.4, wg: .35, fw: .2, gk: 0 };
const KR_GIVEN2 = ["Jaehyun", "Seungwoo", "Minjae", "Kangin", "Heechan", "Junho", "Hyunwoo", "Woojin", "Jihoon", "Seongmin", "Donghyun", "Taeyang", "Hangyeol", "Daon", "Sion", "Doyun",
  "Jungwoo", "Yunho", "Sanghoon", "Gyumin", "Beomjun", "Chanyoung", "Sejin", "Hyungjun"];
const NAT_KIT = { kr: ["#d6202a", "#1c3f94"], jp: ["#1c3f94", "#fff"], br: ["#f6d23a", "#1f8a4c"], ar: ["#8fc4ff", "#fff"], es: ["#c8102e", "#f6d23a"],
  pt: ["#8a1c2b", "#1f8a4c"], en: ["#f2f2f2", "#1c3f94"], fr: ["#1c3f94", "#fff"], de: ["#f2f2f2", "#111"], nl: ["#ff8c3a", "#111"], it: ["#2c6fd6", "#fff"] };

let W = null;   // S.world

const roleW = (r) => r === "gk" ? GK_W : POS[r].w;
function ovrRole(st, r) { const w = roleW(r); let s = 0; for (const k in w) s += st[k] * w[k]; return s; }
function sOf(p) { return p.id === "me" ? S.stats : p.id === "rv" ? S.rival.stats : p.st; }
function pOvr(p) { return p.id === "me" ? OVR() : p.id === "rv" ? ROVR() : p.o; }
function ageOf(p) { return p.id === "me" ? S.age : p.id === "rv" ? S.rival.age : p.a; }
const pAvg = (p) => p.s && p.s.ap ? p.s.rs / p.s.ap : 0;
function blankS() { return { ap: 0, st: 0, g: 0, a: 0, rs: 0, mom: 0 }; }
/* 시즌 기록은 저장 용량을 줄이려고 배열로 보관해요: [y, c, l, ap, g, a, r, o, pp, kp, tc, dc] (옛 세이브의 객체도 읽어요) */
const H_KEYS = ["y", "c", "l", "ap", "g", "a", "r", "o", "pp", "kp", "tc", "dc"];
function hObj(e) { if (!Array.isArray(e)) return e; const o = {}; H_KEYS.forEach((k, i) => { o[k] = e[i]; }); return o; }
const PASS_W = { gk: .45, df: 1.15, mf: 1.45, wg: .85, fw: .6 };
const PASS_ACC = { gk: -.1, df: .07, mf: .05, wg: -.03, fw: -.07 };
const DRIB_W = { fw: 2.2, wg: 3.2, mf: 1.3, df: .4, gk: 0 };
const TACK_W = { df: 2.6, mf: 2.2, wg: .9, fw: .5, gk: 0 };
const ITC_W = { df: 1.7, mf: 1.3, wg: .45, fw: .25, gk: .1 };   // 가로채기
const CLR_W = { df: 3.0, gk: 1.0, mf: .6, wg: .25, fw: .3 };    // 걷어내기
const passPct = (s) => s && s.pa ? Math.round(s.pc / s.pa * 100) : 0;

function natName(nat, used) {
  const one = () => nat === "kr" ? pick([...KR_GIVEN, ...KR_GIVEN2]) + " " + pick(KR_SUR) : pick(NAME_POOL[nat][0]) + " " + pick(NAME_POOL[nat][1]);
  for (let i = 0; i < 25; i++) { const n = one(); if (!used.has(n)) { used.add(n); return n; } }
  return one() + " Jr.";
}
function pickNat(mix) {
  let t = mix.reduce((a, [, w]) => a + w, 0) * Math.random();
  for (const [n, w] of mix) { if ((t -= w) <= 0) return n; }
  return mix[0][0];
}
/* 목표 종합에 맞춰 역할다운 능력치 6개를 만들어요 */
function genStats(role, target) {
  const w = roleW(role), st = {};
  for (const k of STAT_KEYS) { const x = w[k] || 0; st[k] = target + (x >= .15 ? rand(-3, 7) : x > 0 ? rand(-12, 2) : rand(-30, -10)); }
  for (let i = 0; i < 3; i++) { const d = target - ovrRole(st, role); for (const k of STAT_KEYS) st[k] = clamp(st[k] + d, 12, 99); }
  for (const k of STAT_KEYS) st[k] = Math.round(st[k]);
  return st;
}
function refreshO(p) { p.o = Math.round(ovrRole(p.st, p.r) * 10) / 10; }
function mkPlayer(nat, role, target, age, used) {
  const p = { id: "p" + W.n++, n: natName(nat, used), nat, r: role, st: genStats(role, target), a: age, pot: Math.round(rand(-3, 7)), s: blankS(), cs: blankS(), h: [], inj: 0, fm: 0 };
  aiEnsure(p); refreshO(p); return p;
}

/* ---------- 리그 소속 (승강) ----------
 * LEAGUES[i].clubs 는 "지금 그 리그에 있는 팀". 처음 배치는 data.js, 승강 후 배치는 세이브의 S.lgMem 에 저장해요 */
const CLUB_T = {}, LG_ORIG = LEAGUES.map((l) => l.clubs.map((c) => { CLUB_T[c[0]] = c; return c[0]; }));
function applyMem(mem) {
  LEAGUES.forEach((l, i) => { const names = mem && mem[i] ? mem[i] : LG_ORIG[i]; l.clubs = names.map((n) => CLUB_T[n]).filter(Boolean); });
}
/* 시즌 끝: 1부 하위 2팀 ↔ 2부 상위 2팀 */
function promoRelegate() {
  const out = [];
  if (S.prDone === (S.pro && S.pro.season)) return out;
  const moveLg = (name, to) => {
    const from = LEAGUES[W.c[name].l], i = from.clubs.findIndex((c) => c[0] === name);
    const tup = i >= 0 ? from.clubs.splice(i, 1)[0] : CLUB_T[name];
    LEAGUES[to].clubs.push(tup); W.c[name].l = to;
    for (const id of W.c[name].ids) if (W.p[id]) W.p[id].l = to;
  };
  for (const lg of LEAGUES) {
    if (lg.down == null) continue;
    const lo = LEAGUES[lg.down], T1 = S.lgs[lg.id], T2 = S.lgs[lo.id];
    if (!T1 || !T2) continue;
    const t1 = sortedTable(lg.id).map((x) => x[0]).filter((n) => W.c[n] && W.c[n].l === lg.id);
    const t2 = sortedTable(lo.id).map((x) => x[0]).filter((n) => W.c[n] && W.c[n].l === lo.id);
    if (t1.length < 4 || t2.length < 4 || !(Object.values(T1.table)[0] || {}).p) continue;
    const down = t1.slice(-2), up = t2.slice(0, 2);
    down.forEach((n) => { moveLg(n, lo.id); W.c[n].base = Math.round((W.c[n].base - 1.5) * 10) / 10; });
    up.forEach((n) => { moveLg(n, lg.id); W.c[n].base = Math.round((W.c[n].base + 1.5) * 10) / 10; });
    news(`🔁 ${lg.flag} ⬆️ Promoted to ${lg.name}: ${up.join(", ")} · ⬇️ Relegated to ${lo.name}: ${down.join(", ")}`);
    out.push({ lg: lg.id, lo: lo.id, up, down });
  }
  S.lgMem = LEAGUES.map((l) => l.clubs.map((c) => c[0]));
  S.prDone = S.pro && S.pro.season;
  if (S.rival && S.rival.club && W.c[S.rival.club]) S.rival.league = W.c[S.rival.club].l;
  return out;
}
/* 승강 미리보기 (시즌 결산 화면용, 실제 이동 전) */
function promoPreview() {
  return TOP_LEAGUES.filter((lg) => lg.down != null && S.lgs[lg.id] && S.lgs[lg.down]).map((lg) => ({
    lg: lg.id, lo: lg.down, down: sortedTable(lg.id).map((x) => x[0]).slice(-2), up: sortedTable(lg.down).map((x) => x[0]).slice(0, 2) }));
}
/* 옛 세이브(2부 없던 때): 2부 팀과 선수를 만들고, 이번 시즌 지나간 라운드도 채워요 */
function ensureDiv2() {
  const miss = LEAGUES.filter((l) => l.div === 2 && l.clubs.some((c) => !W.c[c[0]]));
  if (!miss.length) return false;
  const used = new Set(Object.values(W.p).map((p) => p.n));
  for (const lg of miss) for (const c of lg.clubs) {
    if (W.c[c[0]]) continue;
    const ids = [];
    ROLE_SQUAD.forEach((role, i) => {
      let o = c[1] + (i < 11 ? rand(-4, 4) : rand(-11, -4));
      if (i < 11 && role !== "gk" && Math.random() < .12) o += rand(3, 7);
      const p = mkPlayer(pickNat(lg.mix), role, clamp(o, 40, 92), randi(18, 33), used);
      p.c = c[0]; p.l = lg.id; W.p[p.id] = p; ids.push(p.id);
    });
    W.c[c[0]] = { l: lg.id, base: c[1], kit: [c[2], c[3]], ids };
    anchorClub(c[0], 1);
  }
  ensureCoaches();
  if (S.lgs) for (const lg of miss) {
    const names = lg.clubs.map((c) => c[0]).sort(() => Math.random() - .5);
    S.lgs[lg.id] = { rounds: makeRounds(names), table: Object.fromEntries(names.map((n) => [n, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])), res: [] };
    const done = S.pro ? S.pro.round || 0 : 0;
    for (let r = 0; r < done; r++) for (const [h, a] of S.lgs[lg.id].rounds[r]) credit(playAI(teamFor(h, { home: true }), teamFor(a)), "league", lg.id, h, a);
  }
  S.lgMem = LEAGUES.map((l) => l.clubs.map((c) => c[0]));
  return true;
}

/* ---------- 세계 만들기 ---------- */
function initWorld() {
  W = S.world = { p: {}, c: {}, n: 1 };
  const used = new Set([S.name, S.rival.name]);
  for (const lg of LEAGUES) for (const c of lg.clubs) {
    const ids = [];
    ROLE_SQUAD.forEach((role, i) => {
      let o = c[1] + (i < 11 ? rand(-4, 4) : rand(-11, -4));
      if (i < 11 && role !== "gk" && Math.random() < .12) o += rand(3, 7);
      const p = mkPlayer(pickNat(lg.mix), role, clamp(o, 40, 92), randi(18, 33), used);
      p.c = c[0]; p.l = lg.id; W.p[p.id] = p; ids.push(p.id);
    });
    W.c[c[0]] = { l: lg.id, base: c[1], kit: [c[2], c[3]], ids };
    anchorClub(c[0], 1);
  }
  W.p.me = { id: "me", n: S.name, nat: "kr", r: S.pos, c: null, l: null, s: blankS(), cs: blankS(), h: [], inj: 0, fm: 0 };
  W.p.rv = { id: "rv", n: S.rival.name, nat: ORIGINS[S.rival.origin].nat, r: S.rival.pos, c: null, l: null, s: blankS(), cs: blankS(), h: [], inj: 0, fm: 0 };
  S.lgs = {}; S.news = S.news || []; S.cups = {};
  ensureCoaches();
}
/* 클럽 베스트11 평균을 기준 전력 쪽으로 (k=1이면 완전히, .5면 절반) */
function anchorClub(name, k) {
  const c = W.c[name], diff = (c.base - xiAvg(name)) * k;
  c.ids.forEach((id) => {
    if (id === "me" || id === "rv") return;
    const p = W.p[id];
    STAT_KEYS.forEach((s, i) => { p.st[s] = Math.round(clamp(p.st[s] + diff, 12, p.tr ? aiCap(p, i) : 99)); });
    refreshO(p);
  });
}
function clubStr(lg, name) { return W && W.c[name] ? xiAvg(name) : (clubData(lg, name) || [0, 60])[1]; }
function xiAvg(club) { const xi = bestXI(clubPlayers(club), false, formOf(club)); return Math.round(xi.reduce((s, p) => s + pOvr(p), 0) / xi.length * 10) / 10; }

/* 선발 11명 — 자리별 능력치 순(폼·로테이션 반영). 부상자는 빠지고, 빈자리는 다른 자리 선수가 메워요 */
function available(p) { return !(p.id === "me" ? S.injured > 0 || (S.ban || 0) > 0 : p.id === "rv" ? S.rival.hurt > 0 || (S.rival.ban || 0) > 0 : p.inj > 0 || (p.ban || 0) > 0); }
function bestXI(players, noisy = true, form = "4-3-3") {
  const pool = players.filter(available);
  const scored = pool.map((p) => {
    let v = pOvr(p) + (p.id === "me" ? S.form * 1.2 : (p.fm || 0) * 1.2);
    if (noisy) v += rand(-2.5, 2.5) - (Math.random() < .05 ? 12 : 0);
    if (p.id === "me" && noisy && S.flags && S.flags.forceStart) v += 100;
    if (p.id === "me" && S.pro && S.trust != null && players.every((x) => x.id === "me" || x.c === S.pro.club)) v += (S.trust - 50) / 8;   // 감독 신뢰 ±6
    return [p, v];
  });
  const roles = (FORMS[form] || FORMS["4-3-3"]).roles;
  const used = new Set(), xi = [];
  xi.roles = [];
  // 1) 자리마다 원래 포지션 선수부터 (윙어 자리는 윙어로). 2) 벤치의 다른 포지션 선수가 확실히(+3) 나으면 교체.
  // 3) 그래도 빈 자리만 적성 맞는 다른 포지션 선수로. 원래 자리 주전이 엉뚱한 자리로 밀려나지 않게.
  const fill = new Array(roles.length).fill(null), fv = new Array(roles.length).fill(0);
  const byV = (arr) => arr.sort((x, y) => y[1] - x[1]);
  roles.forEach((role, i) => {
    const c = byV(scored.filter(([p]) => !used.has(p) && p.r === role))[0];
    if (c) { used.add(c[0]); fill[i] = c[0]; fv[i] = c[1]; }
  });
  roles.forEach((role, i) => {
    if (!fill[i] || role === "gk") return;
    const alt = byV(scored.filter(([p]) => !used.has(p) && p.r !== "gk" && p.r !== role && COMPAT[p.r][role]).map(([p, v]) => [p, v * COMPAT[p.r][role]]))[0];
    if (alt && alt[1] > fv[i] + 3) { used.delete(fill[i]); used.add(alt[0]); fill[i] = alt[0]; fv[i] = alt[1]; }
  });
  roles.forEach((role, i) => {
    if (fill[i]) return;
    let c = role === "gk" ? null : byV(scored.filter(([p]) => !used.has(p) && p.r !== "gk" && COMPAT[p.r][role]).map(([p, v]) => [p, v * COMPAT[p.r][role]]))[0];
    if (!c) c = byV(scored.filter(([p]) => !used.has(p) && (role === "gk" ? true : p.r !== "gk")))[0];
    if (c) { used.add(c[0]); fill[i] = c[0]; }
  });
  fill.forEach((p, i) => { if (p) { xi.push(p); xi.roles.push(roles[i]); } });
  return xi;
}
/* 선발 확률 — 그 감독 포메이션으로 여러 번 뽑아 봐요 */
function startChance(club, who = "me", n = 24) {
  const ps = clubPlayers(club).includes(W.p[who]) ? clubPlayers(club) : [...clubPlayers(club), W.p[who]];
  let k = 0; for (let i = 0; i < n; i++) if (bestXI(ps, true, formOf(club)).includes(W.p[who])) k++;
  return k / n;
}
function benchOf(players, xi) { return players.filter((p) => available(p) && !xi.includes(p)); }
const clubPlayers = (club) => W.c[club].ids.map((id) => W.p[id]);

/* 이 클럽에서 내(또는 라이벌) 자리 경쟁 */
function spotRace(club, who = "me") {
  const me = W.p[who], role = me.r, mine = pOvr(me), form = formOf(club);
  const slots = FORMS[form].roles.filter((r) => r === role).length;
  const rivals = clubPlayers(club).filter((p) => p.id !== who && p.r === role).sort((a, b) => pOvr(b) - pOvr(a));
  const kth = rivals[Math.max(0, slots - 1)];
  const margin = kth ? mine + (who === "me" ? S.form * 1.2 : 0) - pOvr(kth) : 20;
  return { role, slots, form, rivals, kth, margin, p: startChance(club, who) };
}
/* 이적: 들어가는 클럽의 같은 자리 가장 약한 선수와 맞바꿔요 */
function moveToClub(id, club) {
  const p = W.p[id], from = p.c;
  if (from === club) return null;
  if (from && W.c[from]) W.c[from].ids = W.c[from].ids.filter((x) => x !== id);
  const dest = W.c[club];
  const weakest = dest.ids.filter((x) => x !== "me" && x !== "rv" && W.p[x].r === p.r).sort((a, b) => W.p[a].o - W.p[b].o)[0];
  let out = null;
  if (weakest) {
    dest.ids = dest.ids.filter((x) => x !== weakest);
    out = W.p[weakest];
    if (from && W.c[from]) { out.c = from; out.l = W.c[from].l; W.c[from].ids.push(weakest); }
    else { out.c = null; delete W.p[weakest]; }
  }
  dest.ids.push(id); p.c = club; p.l = dest.l;
  if (id !== "me" && id !== "rv") p.no = pickNo(club, p.r, p.no);
  if (out && out.c) out.no = pickNo(out.c, out.r, out.no);
  return out;
}

/* ================= 경기 엔진 ================= */
function eff(p, k) {
  let v = sOf(p)[k];
  if (p.id === "me") v = (v + ((S.sharp && S.sharp[k]) || 0)) * (S.cond < 35 ? .93 : 1) * (1 + S.form * .012);   // 🎯 감각 훈련 버프(다음 경기만)
  else v *= 1 + (p.fm || 0) * .012;
  return v;
}
function units(xi, T) {
  const roleAt = (p) => (xi.roles && xi.roles[xi.indexOf(p)]) || p.r;
  const by = (r) => xi.filter((p) => roleAt(p) === r);
  const mean = (arr, f) => arr.length ? arr.reduce((s, p) => s + f(p), 0) / arr.length : 45;
  return {
    att: mean([...by("fw"), ...by("wg")], (p) => eff(p, "sho") * .4 + eff(p, "dri") * .3 + eff(p, "spd") * .3) * .65 + mean(by("mf"), (p) => eff(p, "pas") * .6 + eff(p, "dri") * .4) * .35,
    mid: mean(by("mf"), (p) => eff(p, "pas") * .45 + eff(p, "sta") * .3 + eff(p, "def") * .25),
    def: mean(by("df"), (p) => eff(p, "def") * .6 + eff(p, "spd") * .2 + eff(p, "sta") * .2),
  };
}
function unitsT(T) {
  const u = units(T.xi, T), st = STYLES[T.style] || STYLES.bal, rs = T.xi.roles || [];
  const n = (r) => rs.filter((x) => x === r).length;
  u.att += st.att + (n("fw") + n("wg") - 3) * 1.2;
  u.def += st.def + (n("df") - 4) * 1.6;
  u.mid += st.mid + (n("mf") - 3) * 1.5;
  return u;
}
function weighted(list, wfn) {
  const ws = list.map((p) => Math.max(0, wfn(p)));
  let t = ws.reduce((a, b) => a + b, 0) * Math.random();
  for (let i = 0; i < list.length; i++) { if ((t -= ws[i]) <= 0) return list[i]; }
  return list[0];
}
/* 교체: 60~80분 사이 2명. 벤치에 내가 있으면 같은 자리 선수와 바꿔 들어가요 */
function planSubs(xi, bench, meIn) {
  const subs = [];
  const cand = bench.filter((p) => p.r !== "gk");
  const mine = meIn && cand.find((p) => p.id === "me");
  const order = mine ? [mine, ...cand.filter((p) => p !== mine && p.id !== "me").sort(() => Math.random() - .5)] : cand.filter((p) => p.id !== "me").sort(() => Math.random() - .5);
  for (const inP of order.slice(0, 2)) {
    const outs = xi.filter((p) => p.r === inP.r && p.id !== "me" && !subs.some((s) => s.out === p));
    const out = outs.length ? outs[outs.length - 1] : xi.filter((p) => p.r !== "gk" && p.id !== "me" && !subs.some((s) => s.out === p)).slice(-1)[0];
    if (out) subs.push({ min: randi(58, 76), in: inP, out });
  }
  return subs;
}
function onPitchAt(xi, subs, min, off = []) {
  return xi.map((p) => { let q = p, s; while ((s = subs.find((x) => x.out === q && x.min <= min))) q = s.in; return q; })
    .filter((p) => !off.some((o) => o.p === p && o.min <= min));
}
const offCount = (T, min) => (T.off || []).filter((o) => o.min <= min && !o.replaced).length;
/* 반칙·부상: 경고(두 번이면 퇴장), 다이렉트 퇴장, 경기 중 부상(교체 카드가 남으면 교체, 없으면 10명) */
const CARD_P = { df: .2, mf: .16, wg: .09, fw: .08, gk: .015 };
function genIncidents(T, side) {
  const inc = [];
  const span = (p) => {
    const sOut = T.subs.find((x) => x.out === p), sIn = T.subs.find((x) => x.in === p);
    return [sIn ? sIn.min + 1 : 3, sOut ? sOut.min : 90];
  };
  for (const p of [...T.xi, ...T.subs.map((s) => s.in)]) {
    const [a, b] = span(p); if (b <= a) continue;
    if (Math.random() < CARD_P[p.r]) {
      const m1 = randi(a, b); inc.push({ min: m1, side, p, kind: "yc" });
      if (Math.random() < .035 && m1 < b) inc.push({ min: randi(m1 + 1, b), side, p, kind: "yc2" });
    }
    if (Math.random() < CARD_P[p.r] * .025) inc.push({ min: randi(Math.max(a, 15), b), side, p, kind: "rc" });
    const injP = p.id === "me" ? .01 * DF().inj * (S.cond < 35 ? 2 : 1) * (1 - ((S.gear && S.gear.shin) || 0) * .2) : .01;
    if (Math.random() < injP) inc.push({ min: randi(a, b), side, p, kind: "inj" });
  }
  return inc.sort((x, y) => x.min - y.min);
}
/* 경기 하나의 찬스 목록. 결과(out)는 미리 굴려두고, 내가 끼면 승부처(mom)로 표시해요 */
function genMatch(H, A) {
  H.subs = H.subs || planSubs(H.xi, H.bench || [], H.meBench);
  A.subs = A.subs || planSubs(A.xi, A.bench || [], A.meBench);
  const uH = unitsT(H), uA = unitsT(A);
  const sH = STYLES[H.style] || STYLES.bal, sA = STYLES[A.style] || STYLES.bal;
  const posH = clamp(.5 + (uH.mid - uA.mid) / 90 + (H.adv || 0) * .01, .35, .65);
  const lam = (pos, u1, u2) => clamp(6.3 * (pos / .5) * Math.exp((u1.att - u2.def) / 30), 1.5, 14);
  const nH = poisson(lam(posH, uH, uA) * sH.self * sA.opp), nA = poisson(lam(1 - posH, uA, uH) * sA.self * sH.opp);
  // 반칙·부상 먼저 — 나간 선수는 그 뒤 찬스에 못 끼고, 사람이 적은 팀은 찬스가 줄어요
  const inc = [];
  for (const [T, side] of [[H, "home"], [A, "away"]]) {
    T.off = [];
    for (const i of genIncidents(T, side)) {
      if (T.off.some((o) => o.p === i.p)) continue;
      if (i.kind === "yc" && inc.some((x) => x.p === i.p && x.kind === "yc")) continue;
      inc.push(i);
      if (i.kind === "rc" || i.kind === "yc2") T.off.push({ p: i.p, min: i.min });
      if (i.kind === "inj") {
        const used = new Set(T.subs.map((s) => s.in));
        const sub = T.subs.length < 3 ? (T.bench || []).find((b) => !used.has(b) && b.r === i.p.r && b.id !== "me") || (T.bench || []).find((b) => !used.has(b) && b.r !== "gk" && b.id !== "me") : null;
        T.subs = T.subs.filter((s) => !(s.out === i.p && s.min > i.min));
        if (sub) { T.subs.push({ min: i.min, in: sub, out: i.p, inj: true }); i.sub = sub; }
        else T.off.push({ p: i.p, min: i.min });
      }
    }
  }
  inc.sort((a, b) => a.min - b.min);
  const evs = [];
  const mk = (side, minFrom = 1) => {
    const T = side === "home" ? H : A, D = side === "home" ? A : H;
    const min = randi(minFrom, 90);
    if (offCount(T, min) > offCount(D, min) && Math.random() < .3 * (offCount(T, min) - offCount(D, min))) return null;
    const on = onPitchAt(T.xi, T.subs, min, T.off), dOn = onPitchAt(D.xi, D.subs, min, D.off);
    if (!on.length || !dOn.length) return null;
    // 페널티킥 — 팀에서 슈팅이 가장 좋은 선수가 차요
    if (Math.random() < .018) {
      const taker = on.filter((p) => p.r !== "gk").sort((a, b) => eff(b, "sho") - eff(a, "sho"))[0];
      const gk = dOn.find((p) => p.r === "gk") || dOn[0];
      const df = weighted(dOn.filter((p) => p.r !== "gk"), (p) => D_W[p.r]);
      const ev = { min, side, sh: taker, as: null, df, gk, xg: .78, pen: true };
      ev.out = rollShot(ev, 0, true);
      if (taker.id === "me") ev.mom = "pk";
      if (taker.id === "rv") ev.rv = true;
      return ev;
    }
    const sh = weighted(on, (p) => G_W[p.r] * Math.pow(eff(p, "sho") / 70, 1.5));
    const as = Math.random() < .72 ? weighted(on.filter((p) => p !== sh), (p) => A_W[p.r] * Math.pow(eff(p, "pas") / 70, 1.5)) : null;
    const df = weighted(dOn.filter((p) => p.r !== "gk"), (p) => D_W[p.r] * Math.pow(eff(p, "def") / 70, 2));
    const gk = dOn.find((p) => p.r === "gk") || dOn[0];
    const xg = .06 + Math.pow(Math.random(), 1.6) * .5 + ((side === "home" ? sH : sA).xg || 0);
    const ev = { min, side, sh, as, df, gk, xg };
    ev.out = rollShot(ev);
    if (sh.id === "me") ev.mom = (S.pos === "wg" || S.pos === "fw") && Math.random() < .45 ? "dribble" : "shot";
    else if (as && as.id === "me") ev.mom = "pass";
    else if (df.id === "me") ev.mom = "tackle";
    if (sh.id === "rv" || (as && as.id === "rv")) ev.rv = true;
    return ev;
  };
  for (let i = 0; i < nH; i++) evs.push(mk("home"));
  for (let i = 0; i < nA; i++) evs.push(mk("away"));
  // 수적 우위: 상대가 퇴장당하면 남은 시간만큼 찬스가 더 나요
  for (const [T, side, n] of [[H, "away", nA], [A, "home", nH]]) for (const o of T.off) {
    const extra = poisson(.4 * n * (90 - o.min) / 90);
    for (let i = 0; i < extra; i++) evs.push(mk(side, o.min + 1));
  }
  const evs2 = evs.filter(Boolean).sort((a, b) => a.min - b.min);
  return { H, A, evs: evs2, inc, posH, uH, uA };
}
/* 슈팅 결과 — 블록(수비 vs 드리블) → 득점 확률(xg × 슈팅 vs 키퍼) */
function blockP(ev) { return clamp(.12 + (eff(ev.df, "def") - eff(ev.sh, "dri")) / 160, .03, .3); }
function goalP(ev, bonus = 0) { return clamp((ev.xg + bonus) * (.75 + (eff(ev.sh, "sho") - eff(ev.gk, "def") * .92) / 70), .02, .85); }
function rollShot(ev, bonus = 0, noBlock = false) {
  if (!noBlock && Math.random() < blockP(ev)) return "block";
  return Math.random() < goalP(ev, bonus) ? "goal" : Math.random() < .6 ? "save" : "miss";
}
/* 내 승부처를 자동으로 풀 때 — AI와 같은 확률 */
function autoMoment(ev) {
  const an = typeof S !== "undefined" && S && S.gear ? (S.gear.analyst || 0) * .04 : 0;
  if (an && ev.mom !== "pk" && Math.random() < an) { const r = autoMoment0(ev); if (!r.ok) return autoMoment0(ev); return r; }   // 전력 분석관: 한 번 더 기회
  return autoMoment0(ev);
}
function autoMoment0(ev) {
  if (ev.mom === "pk") { const out = rollShot(ev, 0, true); return { ok: out === "goal", out }; }
  if (ev.mom === "tackle") return Math.random() < blockP(ev) * 1.3 ? { ok: true, out: "block" } : { ok: false, out: rollShot(ev, 0, true) };
  if (ev.mom === "pass" || ev.mom === "dribble") return Math.random() < 1 - blockP(ev) ? { ok: true, out: rollShot(ev, 0, true) } : { ok: false, out: "block" };
  const out = rollShot(ev); return { ok: out === "goal", out };
}
/* 경기 마무리: 평점·MOM */
function finishMatch(m) {
  const all = new Map();
  const add = (p, side, mins, start) => { if (!all.has(p)) all.set(p, { p, side, mins, start, g: 0, a: 0, sh: 0, sot: 0, xg: 0, kp: 0, blk: 0, sv: 0, fail: 0, okm: 0, okmG: 0, pa: 0, pc: 0, da: 0, dc: 0, ta: 0, tc: 0, ic: 0, cl: 0 }); };
  for (const [T, side] of [[m.H, "home"], [m.A, "away"]]) {
    const offAt = (p) => { const o = (T.off || []).find((x) => x.p === p); return o ? o.min : 90; };
    T.xi.forEach((p) => { const s = T.subs.find((x) => x.out === p); add(p, side, Math.min(s ? s.min : 90, offAt(p)), true); });
    T.subs.forEach((s) => add(s.in, side, Math.max(1, Math.min(offAt(s.in), (T.subs.find((x) => x.out === s.in) || { min: 90 }).min) - s.min), false));
  }
  let hg = 0, ag = 0;
  const goals = [];
  for (const ev of m.evs) {
    const sh = all.get(ev.sh), as = ev.as && all.get(ev.as), df = all.get(ev.df), gk = all.get(ev.gk);
    if (sh) { sh.sh++; sh.xg += ev.xg; if (ev.out === "goal" || ev.out === "save") sh.sot++; }
    if (ev.mom === "dribble" && sh && ev.res) { sh.da++; if (ev.res.ok) sh.dc++; }
    if (ev.mom === "tackle" && df && ev.res) { df.ta++; if (ev.res.ok) df.tc++; }
    if (ev.out === "goal") {
      ev.side === "home" ? hg++ : ag++;
      if (sh) sh.g++; if (as) as.a++;
      goals.push({ min: ev.min, side: ev.side, sh: ev.sh, as: ev.as });
    } else {
      if (as) as.kp++;
      if (ev.out === "block" && df) df.blk++;
      if (ev.out === "save" && gk) gk.sv++;
    }
    if (ev.mom && ev.res) { const mine = all.get(W && W.p && W.p.me) || [...all.values()].find((x) => x.p.id === "me"); if (mine) { if (!ev.res.ok) mine.fail++; else if (ev.mom === "tackle" || (ev.out === "goal" && (ev.sh === mine.p || ev.as === mine.p))) mine.okmG++; else mine.okm++; } }   // 승부처 성공: 평점엔 똑같이 +0.2, MOM 비교에선 골·도움·수비로 안 이어진 성공은 절반만
  }
  const cards = [];
  for (const i of m.inc || []) {
    const x = all.get(i.p); if (!x) continue;
    if (i.kind === "yc") x.yc = 1; else if (i.kind === "yc2" || i.kind === "rc") x.rc = i.kind; else if (i.kind === "inj") x.inj = true;
    cards.push(i);
  }
  // 패스·드리블·태클 — 점유율과 선수 능력치로 같은 기준을 모든 선수에게
  const posH = m.posH ?? .5, team = {};
  for (const [T, side, pos, oppU] of [[m.H, "home", posH, m.uA], [m.A, "away", 1 - posH, m.uH]]) {
    const xs = [...all.values()].filter((x) => x.side === side);
    const total = Math.round(pos * rand(820, 960) * (xs.length >= 11 ? 1 : .9));
    const wsum = xs.reduce((s, x) => s + PASS_W[x.p.r] * (x.mins / 90) * (.7 + eff(x.p, "pas") / 200), 0) || 1;
    const press = oppU ? oppU.mid : 65, oppDef = oppU ? oppU.def : 65, oppAtt = oppU ? oppU.att : 65;
    for (const x of xs) {
      const k = x.mins / 90, r = x.p.r;
      x.pa = Math.round(total * PASS_W[r] * k * (.7 + eff(x.p, "pas") / 200) / wsum);
      const acc = clamp(.76 + (eff(x.p, "pas") - press) / 220 + PASS_ACC[r] + (pos - .5) * .15 + rand(-.04, .04), .45, .96);
      x.pc = Math.round(x.pa * acc);
      const da = poisson(k * DRIB_W[r] * eff(x.p, "dri") / 70);
      x.da += da; x.dc += Math.round(da * clamp(.45 + (eff(x.p, "dri") - oppDef) / 120, .2, .85));
      const ta = poisson(k * TACK_W[r] * eff(x.p, "def") / 70) + x.blk;
      x.ta += ta; x.tc += Math.min(ta, x.blk + Math.round((ta - x.blk) * clamp(.55 + (eff(x.p, "def") - oppAtt) / 120, .3, .9)));
      // 수비 기록: 공을 덜 가질수록(상대가 더 공격할수록) 많아져요
      const dfn = k * (1.4 - pos * .8);
      x.ic += poisson(dfn * ITC_W[r] * eff(x.p, "def") / 70);
      x.cl += poisson(dfn * CLR_W[r] * oppAtt / 70);
    }
    team[side] = { pos: Math.round(pos * 100), sh: xs.reduce((s, x) => s + x.sh, 0), sot: xs.reduce((s, x) => s + x.sot, 0), xg: Math.round(xs.reduce((s, x) => s + x.xg, 0) * 10) / 10,
      pa: xs.reduce((s, x) => s + x.pa, 0), pc: xs.reduce((s, x) => s + x.pc, 0), ta: xs.reduce((s, x) => s + x.ta, 0) };
  }
  const ratings = new Map();
  for (const x of all.values()) {
    const p = x.p, gf = x.side === "home" ? hg : ag, ga = x.side === "home" ? ag : hg;
    let r = 6.15 + x.g * 1.0 + x.a * .65 + x.sh * .05 + x.kp * .12 + x.blk * .2 + x.sv * .3 + (x.okmG + x.okm) * .2 - x.fail * .2
      + x.dc * .07 + (x.tc - x.blk) * .1 + x.ic * .07 + x.cl * .03 + (x.pa >= 15 ? (x.pc / x.pa - .79 - PASS_ACC[p.r]) * 1.2 : 0);
    r += gf > ga ? .3 : gf < ga ? -.3 : 0;
    if (p.r === "df" || p.r === "gk") r += ga === 0 ? .5 : -Math.max(0, ga - 1) * .18;
    r += (pOvr(p) - 70) / 60 + rand(-.35, .35) - (x.yc ? .2 : 0) - (x.rc ? 1.2 : 0);
    if (x.mins < 60) r = 6.2 + (r - 6.2) * Math.max(.3, x.mins / 60);
    if (p.id === "me" && typeof F === "function") r += F("rate");
    ratings.set(p, Math.round(clamp(r, 3.5, 10) * 10) / 10);
  }
  // MOM: 평점에 결과(골 +0.3, 도움 +0.2)를 더하고, 골·도움으로 안 이어진 승부처 성공은 절반(-0.1)만 쳐서 뽑아요
  const momSc = (p) => { const x = all.get(p); return ratings.get(p) + (x ? x.g * .3 + x.a * .2 - x.okm * .1 : 0); };
  let mom = null; for (const p of ratings.keys()) if (!mom || momSc(p) > momSc(mom)) mom = p;
  return { hg, ag, goals, ratings, mom, all, cards, team };
}

/* ---------- 세계에 기록 ---------- */
function credit(res, kind, lgId, hName, aName) {
  for (const [p, r] of res.ratings) {
    if (!p.s) continue;
    const x = res.all.get(p), st = kind === "league" ? p.s : p.cs;
    st.ap++; if (x.start) st.st++;
    st.g += x.g; st.a += x.a; st.rs += r; if (res.mom === p && r >= 7.3) st.mom++;
    st.pa = (st.pa || 0) + x.pa; st.pc = (st.pc || 0) + x.pc; st.sh = (st.sh || 0) + x.sh; st.sot = (st.sot || 0) + x.sot; st.xg = (st.xg || 0) + Math.round(x.xg * 100);
    st.kp = (st.kp || 0) + x.kp + x.a; st.da = (st.da || 0) + x.da; st.dc = (st.dc || 0) + x.dc; st.ta = (st.ta || 0) + x.ta; st.tc = (st.tc || 0) + x.tc; st.sv = (st.sv || 0) + x.sv;
    if (p.id === "me" && x.rc) st.rc = (st.rc || 0) + 1;
    st.ic = (st.ic || 0) + x.ic; st.cl = (st.cl || 0) + x.cl; st.bk = (st.bk || 0) + x.blk;
    if ((p.r === "df" || p.r === "gk") && x.mins >= 60 && (x.side === "home" ? res.ag : res.hg) === 0) st.cs = (st.cs || 0) + 1;
    if (p.id !== "me") {
      const tgt = p.id === "rv" ? S.rival : p;
      if (x.yc && kind === "league") { st.yc = (st.yc || 0) + 1; if (st.yc % 5 === 0) { tgt.ban = 1; tgt.nw = 1; } }
      if (x.rc) { st.rc = (st.rc || 0) + 1; tgt.ban = x.rc === "rc" ? 2 : 1; tgt.nw = 1; if (pOvr(p) >= 80 || p.id === "rv") news(`🟥 ${p.n}(${shortName(p.c || "")}) sent off, ${tgt.ban}-game suspension`); }
      if (x.inj) {
        const n = randi(1, 5);
        if (p.id === "rv") { S.rival.hurt = Math.max(S.rival.hurt || 0, n); S.rival.nw = 1; news(`🚑 Rival ${p.n} injured in a match, out ${n} games`); if (typeof pushSig === "function") pushSig("rivalhurt", { n }); }
        else { p.inj = n; p.nw = 1; if (pOvr(p) >= 80 || (S.pro && p.c === S.pro.club)) news(`🚑 ${p.n}(${shortName(p.c || "")}) injured, expected out ${n} games`); }
      }
    }
    if (p.id !== "me") p.fm = clamp((p.fm || 0) + (r >= 7.6 ? .5 : r <= 5.8 ? -.5 : 0), -2, 2);
  }
  if (kind === "league") {
    recordGame(lgId, hName, aName, res.hg, res.ag);
    S.lgs[lgId].res.push({ h: hName, a: aName, hg: res.hg, ag: res.ag, g: res.goals.map((g) => [g.min, g.side === "home" ? 0 : 1, g.sh.n, g.as ? g.as.n : ""]), mom: res.mom ? [res.mom.n, res.ratings.get(res.mom)] : null, rc: (res.cards || []).filter((c) => c.kind !== "yc").map((c) => [c.min, c.p.n, c.kind]), ts: res.team ? [res.team.home.pos, res.team.home.sh, res.team.home.sot, res.team.home.xg, res.team.away.sh, res.team.away.sot, res.team.away.xg, passPct(res.team.home), passPct(res.team.away)] : null });
    if (S.lgs[lgId].res.length > 10) S.lgs[lgId].res.splice(0, S.lgs[lgId].res.length - 10);
    for (const x of res.all.values()) if (x.g >= 3 && x.p.id === "rv" && typeof pushSig === "function") pushSig("rivalhattrick", { club: x.p.c });
    for (const x of res.all.values()) if (x.g >= 3) news(`⚽⚽⚽ ${x.p.n}(${shortName(x.p.c || "")}) hat-trick! ${LEAGUES[lgId].flag} ${hName} ${res.hg}:${res.ag} ${aName}`);
    if (Math.abs(res.hg - res.ag) >= 4) news(`💥 ${LEAGUES[lgId].flag} ${hName} ${res.hg}:${res.ag} ${aName}`);
  }
}
function teamFor(club, opts = {}) {
  const co = coachOf(club), ps = clubPlayers(club), xi = bestXI(ps, true, co.f);
  const bench = benchOf(ps, xi);
  return { name: club, kit: W.c[club].kit, xi, bench, form: co.f, style: co.s, coach: co.n, adv: opts.home ? 1.5 : 0, meBench: bench.some((p) => p.id === "me") };
}
function playAI(H, A) { const m = genMatch(H, A), r = finishMatch(m); r.m = m; return r; }

/* ---------- 리그 일정 / 순위 ---------- */
function makeRounds(names) {
  const arr = [...names], first = [];
  for (let r = 0; r < 9; r++) {
    const pairs = [];
    for (let i = 0; i < 5; i++) pairs.push(r % 2 ? [arr[9 - i], arr[i]] : [arr[i], arr[9 - i]]);
    first.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  return [...first, ...first.map((ps) => ps.map(([h, a]) => [a, h]))];
}
function initLeagues() {
  for (const lg of LEAGUES) {
    const names = lg.clubs.map((c) => c[0]).sort(() => Math.random() - .5);
    S.lgs[lg.id] = { rounds: makeRounds(names), table: Object.fromEntries(names.map((n) => [n, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])), res: [] };
  }
  for (const id in W.p) { W.p[id].s = blankS(); W.p[id].cs = blankS(); }
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
function simRoundRest(round, skip) {
  for (const lg of LEAGUES) {
    const leaderBefore = sortedTable(lg.id)[0][0];
    for (const [h, a] of S.lgs[lg.id].rounds[round]) {
      if (skip && (h === skip || a === skip)) continue;
      credit(playAI(teamFor(h, { home: true }), teamFor(a)), "league", lg.id, h, a);
    }
    const leader = sortedTable(lg.id)[0][0];
    if (round >= 5 && leader !== leaderBefore && (lg.div === 1 || (S.pro && lg.id === S.pro.league))) news(`📈 ${lg.flag} ${leader} takes the lead in ${lg.name}`);
  }
}
/* 결장 카운트: "N경기 결장"이면 다음 N경기를 정확히 쉬어요.
 * 라운드가 시작할 때 줄이되, 방금 다친(정지된) 선수(nw)는 이번 라운드가 첫 결장이라 줄이지 않아요.
 * (예전엔 다친 그 라운드 끝에 바로 하나 줄여서, 1경기 결장이 다음 경기에 그냥 뛰었어요) */
function tickAvailability() {
  const tick = (o, ks) => { if (o.nw) { o.nw = 0; return; } for (const k of ks) if (o[k] > 0) o[k]--; };
  for (const id in W.p) { const p = W.p[id]; if (p.inj > 0 || p.ban > 0 || p.nw) tick(p, ["inj", "ban"]); }
  tick(S.rival, ["ban", "hurt"]);
}

/* ---------- 승부차기 ---------- */
function pkTakers(on) { return on.filter((p) => p.r !== "gk").sort((a, b) => eff(b, "sho") - eff(a, "sho")).slice(0, 5); }
function pkP(sh, gk) { return clamp(.74 + (eff(sh, "sho") - eff(gk, "def")) / 160, .55, .9); }
function shootoutAuto(onA, onB) {
  const A = pkTakers(onA), B = pkTakers(onB), gA = onA.find((p) => p.r === "gk") || onA[0], gB = onB.find((p) => p.r === "gk") || onB[0];
  let a = 0, b = 0;
  for (let i = 0; i < 30; i++) {
    if (Math.random() < pkP(A[i % A.length], gB)) a++;
    if (Math.random() < pkP(B[i % B.length], gA)) b++;
    if (i >= 4 && a !== b) break;
  }
  return { aWin: a > b, a, b };
}

/* ---------- 대륙컵 ---------- */
function initCups(prevTables) {
  S.cups = {};
  for (const [key, cup] of Object.entries(CUPS)) {
    const teams = [];
    cup.leagues.forEach((lgId, i) => {
      const order = prevTables && prevTables[lgId] ? prevTables[lgId] : [...LEAGUES[lgId].clubs].sort((a, b) => b[1] - a[1]).map((c) => c[0]);
      teams.push(...order.slice(0, cup.spots[i]));
    });
    S.cups[key] = { teams, alive: teams.slice().sort(() => Math.random() - .5), stage: teams.length, log: [], winner: null };
  }
}
function cupsAt(roundDone) { return Object.entries(CUPS).filter(([, c]) => c.at.includes(roundDone)).map(([k]) => k); }
function cupPairs(key) { const a = S.cups[key].alive, out = []; for (let i = 0; i + 1 < a.length; i += 2) out.push([a[i], a[i + 1]]); return out; }
function cupResolve(key, h, a, res, so) {
  const c = S.cups[key];
  let win = res.hg > res.ag ? h : res.ag > res.hg ? a : null, pk = "";
  if (!win) {
    if (!so && res.m) { const H = res.m.H, A = res.m.A; so = shootoutAuto(onPitchAt(H.xi, H.subs, 90, H.off), onPitchAt(A.xi, A.subs, 90, A.off)); }
    win = so ? (so.aWin ? h : a) : (Math.random() < .5 ? h : a);
    pk = ` (${win} win ${so ? `${so.a}:${so.b}` : ""} on pens)`;
  }
  c.log.push(`${CUP_STAGE[c.stage] || "Round of " + c.stage} ${h} ${res.hg}:${res.ag} ${a}${pk}`);
  (c.res = c.res || []).push({ h, a, hg: res.hg, ag: res.ag, win, so: so ? `${so.a}:${so.b}` : "" });
  credit(res, "cup");
  return { win, pk };
}
function cupAdvance(key, winners) {
  const c = S.cups[key];
  c.alive = winners; c.stage = winners.length;
  if (winners.length === 1) { c.winner = winners[0]; news(`${CUPS[key].emoji} ${winners[0]} wins the ${CUPS[key].name}!`); }
}

/* ---------- 기록 조회 ---------- */
function leaguePlayers(lgId) { return Object.values(W.p).filter((p) => p.l === lgId && p.c); }
function topBy(lgId, key, n = 10) {
  const ps = leaguePlayers(lgId).filter((p) => p.s.ap > 0);
  const minAp = Math.max(3, Math.floor((S.pro.round || ROUNDS) * .55));
  if (key === "rt") return ps.filter((p) => p.s.ap >= minAp).sort((a, b) => pAvg(b) - pAvg(a)).slice(0, n);
  if (key === "pp") return ps.filter((p) => p.s.ap >= minAp && (p.s.pa || 0) >= p.s.ap * 20).sort((a, b) => passPct(b.s) - passPct(a.s) || b.s.pa - a.s.pa).slice(0, n);
  return ps.sort((a, b) => (b.s[key] || 0) - (a.s[key] || 0) || (key === "g" ? b.s.a - a.s.a : b.s.g - a.s.g) || pAvg(b) - pAvg(a)).slice(0, n);
}
function marketValue(p) {
  const o = pOvr(p), a = ageOf(p);
  const af = a <= 21 ? 1.5 : a <= 24 ? 1.25 : a <= 27 ? 1 : a <= 30 ? .65 : .35;
  return Math.max(1, Math.round(Math.pow(Math.max(0, o - 50), 2.3) * af * .06));
}
const fmtMV = (v) => v >= 10 ? "₩" + (v / 10).toFixed(v >= 100 ? 0 : 1) + "B" : "₩" + (v * 100) + "M";

/* ---------- 뉴스 ---------- */
function news(m) {
  if (!S.news) S.news = [];
  const when = S.phase === "pro" && S.pro ? (S.pro.round >= ROUNDS ? `Season ${S.pro.season} off-season` : `Season ${S.pro.season} R${(S.pro.round || 0) + 1}`) : "";
  S.news.unshift({ t: when, m });
  if (S.news.length > 80) S.news.length = 80;
}

/* ---------- 오프시즌: 기록 보관, 성장·노쇠, 은퇴·신인, AI 이적 ---------- */
function archiveSeason(season) {
  for (const p of Object.values(W.p)) {
    if (!p.c || (!p.s.ap && !p.cs.ap)) continue;
    p.h.push([season, p.c, p.l, p.s.ap + p.cs.ap, p.s.g + p.cs.g, p.s.a + p.cs.a, Math.round(pAvg(p) * 100) / 100, Math.round(pOvr(p)), passPct(p.s), p.s.kp || 0, p.s.tc || 0, p.s.dc || 0]);
    if (p.h.length > 16) p.h.shift();
  }
}
function growAI(p) {
  const a = p.a;
  aiEnsure(p);
  const d = a <= 21 ? rand(1.5, 4) + p.pot * .35 : a <= 24 ? rand(.3, 2.5) + p.pot * .2 : a <= 28 ? rand(-.6, 1) : a <= 31 ? -rand(0, 1.8) : -rand(1, 3.2);
  const w = roleW(p.r);
  STAT_KEYS.forEach((k, i) => {
    const kk = (w[k] || 0) >= .15 ? 1.15 : (k === "spd" || k === "sta") ? (a >= 30 ? 1.5 : .8) : .7;
    let delta = d * kk + rand(-.6, .6);
    // 재능 별: 성장은 별 배율(평균 1.1에 맞춰), 초월: 떨어지는 폭 -25%씩
    delta = delta > 0 ? delta * talentMul(aiTal(p, i)) / 1.1 : delta * (1 - aiTr(p, i) * .25);
    p.st[k] = Math.round(clamp(p.st[k] + delta, 12, aiCap(p, i)));
  });
  refreshO(p);
}
function worldOffseason() {
  const used = new Set(Object.values(W.p).map((p) => p.n));
  let awNews = 0;
  for (const id of Object.keys(W.p)) {
    const p = W.p[id];
    if (id === "me" || id === "rv" || !p.c) continue;
    p.a++; p.fm = 0; p.inj = 0;
    const hit = aiSeasonMast(p);
    growAI(p);
    if (hit.length && p.o >= 80 && awNews < 6) { awNews++; news(`${hit.some((h) => !h.includes("★5")) ? "🌌" : "🧬"} ${p.n}(${shortName(p.c)}) Talent awakening: ${hit.join(", ")}`); }
    if (p.a >= 37 || (p.a >= 34 && Math.random() < .35) || (p.a >= 32 && p.o < W.c[p.c].base - 12)) {
      const club = W.c[p.c];
      if (p.o >= 80) news(`👋 ${p.n} (age ${p.a}) announces retirement. Career ${p.h.reduce((s, x) => s + hObj(x).g, 0)} goals`);
      const nat = pickNat(LEAGUES[club.l].mix);
      const np = mkPlayer(nat, p.r, club.base - rand(3, 10), randi(17, 19), used);
      if (Math.random() < .08) np.pot = randi(7, 11);   // 원더키드
      np.c = p.c; np.l = club.l; W.p[np.id] = np;
      club.ids = club.ids.map((x) => x === id ? np.id : x);
      delete W.p[id];
    }
  }
  clubMomentum();
  for (const name in W.c) anchorClub(name, .5);
  for (const lg of LEAGUES) {
    const tbl = S.lgs[lg.id] && S.lgs[lg.id].table && Object.values(S.lgs[lg.id].table)[0].p ? sortedTable(lg.id).map((x) => x[0]) : null;
    if (!tbl) continue;
    tbl.forEach((club, i) => {
      const C = W.c[club], co = C.coach || (C.coach = mkCoach(lg.id, C.base));
      co.y = (co.y || 0) + 1; co.a++;
      const expect = [...lg.clubs].sort((a, b) => b[1] - a[1]).findIndex((x) => x[0] === club);
      const bad = i >= 8 || i - expect >= 4;
      if ((bad && Math.random() < .6) || co.a >= 68) {
        const nc = mkCoach(lg.id, C.base);
        news(`🔄 ${club}: coach ${co.n} ${co.a >= 68 ? "retires" : "sacked"} → new coach ${nc.n}(${NATIONS[nc.nat].flag}) · ${nc.f} ${STYLES[nc.s].name}`);
        C.coach = nc;
      }
    });
  }
  ensureCoaches();
  aiTransfers();
}
/* 📈 팀 전력 흐름: 매 시즌 기준 전력(base)이 움직여요
 *  · 성적: 우승 +, 2~3위 +, 하위권 −, 강등권 − (MOM_W)
 *  · 원래 전력 쪽으로 조금씩 돌아가요(평균 회귀) → 한 팀이 끝없이 강해지지 않게
 *  · 투자·리빌딩: 리그마다 랜덤으로 한두 팀이 크게 오르거나 내려가요(뉴스)
 *  · 원래 전력(data.js) ±BASE_SWING 안에서만 */
const MOM_W = [.3, .15, -.15, -.3], BASE_REV = .2, BASE_SWING = 7, INV_P = .8, INV_UP = [2.5, 4.5], INV_DN = [2, 4];
function shiftBase(club, d) {
  const C = W.c[club]; if (!C) return 0;
  const o = (CLUB_T[club] || [0, C.base])[1], b0 = C.base;
  C.base = Math.round(clamp(C.base + d, o - BASE_SWING, o + BASE_SWING) * 10) / 10;
  return C.base - b0;
}
function clubMomentum() {
  for (const lg of LEAGUES) {
    const TB = S.lgs && S.lgs[lg.id], row = TB && TB.table && Object.values(TB.table)[0];
    if (!row || !row.p) continue;
    const tbl = sortedTable(lg.id).map((x) => x[0]), n = tbl.length;
    tbl.forEach((club, i) => {
      const o = (CLUB_T[club] || [0, W.c[club].base])[1];
      const res = i === 0 ? MOM_W[0] : i < 3 ? MOM_W[1] : i >= n - 2 ? MOM_W[3] : i >= n - 4 ? MOM_W[2] : 0;
      shiftBase(club, res + (o - W.c[club].base) * BASE_REV);
    });
    // 투자(중하위 팀) 한 팀, 리빌딩(상위 절반 팀) 한 팀, 각각 INV_P 확률
    if (Math.random() < INV_P) {
      const club = pick(tbl.slice(Math.floor(n / 3))), d = shiftBase(club, rand(INV_UP[0], INV_UP[1]));
      if (d > .5 && lg.div !== 2) news(T(`📈 ${club}, 대규모 투자로 전력 보강 (전력 +${d.toFixed(1)})`, `📈 ${club} invest big to strengthen the squad (+${d.toFixed(1)})`));
    }
    if (Math.random() < INV_P) {
      const club = pick(tbl.slice(0, Math.ceil(n / 2))), d = shiftBase(club, -rand(INV_DN[0], INV_DN[1]));
      if (d < -.5 && lg.div !== 2) news(T(`📉 ${club}, 주축 세대교체로 리빌딩 (전력 ${d.toFixed(1)})`, `📉 ${club} rebuild as a generation moves on (${d.toFixed(1)})`));
    }
  }
}
/* AI 이적시장: 리그보다 잘하는 젊은 선수는 위로, 늙고 떨어진 스타는 아래로 */
function aiTransfers() {
  const moves = [];
  const allClubs = LEAGUES.flatMap((l) => l.clubs.map((c) => ({ l: l.id, tier: l.tier, name: c[0], base: W.c[c[0]].base })));
  for (const p of Object.values(W.p)) {
    if (!p.c || p.id === "me" || p.id === "rv") continue;
    const club = W.c[p.c], tier = TIER_OF(club.l);
    if (p.a <= 28 && p.o >= club.base + 4 && Math.random() < .55) {
      const cands = allClubs.filter((c) => c.tier >= tier && c.name !== p.c && c.base > club.base && c.base <= p.o + 2).sort((a, b) => b.base - a.base).slice(0, 5);
      if (cands.length) moves.push([p, pick(cands)]);
    } else if (p.a >= 30 && p.o < club.base - 5 && tier >= 2 && Math.random() < .5) {
      const cands = allClubs.filter((c) => c.tier < tier && c.base <= p.o + 3).sort((a, b) => b.base - a.base).slice(0, 5);
      if (cands.length) moves.push([p, pick(cands)]);
    }
  }
  moves.sort((a, b) => b[0].o - a[0].o);
  let shown = 0;
  const inCount = {};
  for (const [p, dest] of moves.slice(0, 40)) {
    if (!W.p[p.id] || p.c === dest.name) continue;
    if ((inCount[dest.name] = (inCount[dest.name] || 0) + 1) > 2) continue;   // 한 클럽은 한 번에 2명까지만 영입해요
    const from = p.c, fee = marketValue(p);
    moveToClub(p.id, dest.name);
    if (shown < 10 && (p.o >= 76 || dest.tier === 3)) { news(`🔁 ${p.n}(${NATIONS[p.nat].flag}) ${from} → ${dest.name}, transfer fee ${fmtMV(fee)}`); shown++; }
  }
}

/* ---------- 월드컵 (4시즌마다) ---------- */
function nationSquads(minN = 16) {
  const byNat = {};
  for (const p of Object.values(W.p)) { if (!p.c) continue; (byNat[p.nat] = byNat[p.nat] || []).push(p); }
  const out = {};
  for (const [nat, ps] of Object.entries(byNat)) {
    if (ps.length < minN) continue;
    const xi = bestXI(ps, false, NAT_FORM[nat] || "4-3-3"), bench = benchOf(ps, xi).sort((a, b) => pOvr(b) - pOvr(a)).slice(0, 7);
    out[nat] = { nat, xi, bench, str: xi.reduce((s, p) => s + pOvr(p), 0) / xi.length };
  }
  return out;
}
function wcField() {
  let sq = nationSquads();
  if (Object.keys(sq).length < 8) sq = nationSquads(11);
  const asia = ["kr", "jp"].filter((n) => sq[n]);
  const rest = Object.values(sq).filter((s) => !asia.includes(s.nat)).sort((a, b) => b.str - a.str).slice(0, 8 - asia.length).map((s) => s.nat);
  const field = [...asia, ...rest];
  return { sq, field };
}
const NAT_FORM = { kr: "4-2-3-1", jp: "4-2-3-1", br: "4-3-3", ar: "4-4-2", es: "4-3-3", pt: "4-3-3", en: "4-2-3-1", fr: "4-3-3", de: "4-2-3-1", nl: "4-3-3", it: "3-5-2" };
const NAT_STYLE = { kr: "prs", jp: "pos", br: "bal", ar: "cnt", es: "pos", pt: "bal", en: "prs", fr: "cnt", de: "prs", nl: "pos", it: "def" };
function natTeam(sq, nat) {
  const ps = [...sq[nat].xi, ...sq[nat].bench], xi = bestXI(ps, true, NAT_FORM[nat] || "4-3-3");
  const bench = benchOf(ps, xi);
  return { name: NATIONS[nat].name, nat, kit: NAT_KIT[nat], xi, bench, form: NAT_FORM[nat] || "4-3-3", style: NAT_STYLE[nat] || "bal", adv: 0, meBench: bench.some((p) => p.id === "me") };
}
