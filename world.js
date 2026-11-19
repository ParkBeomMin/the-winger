/* 더 윙어 2 - 축구 세계
 * 6개 리그 60개 클럽, 클럽마다 16명. 모든 선수가 6개 능력치·국적·나이·폼·부상·커리어 기록을 가져요.
 * 모든 경기(내 경기, AI 경기, 컵, 월드컵, 유스)는 같은 엔진으로 돌아가요:
 * 미드필드 싸움 → 찬스 수 → 슈터·패서·수비수·키퍼의 실제 능력치로 슈팅 결과 → 선수별 평점. */
"use strict";

const ROUNDS = 18;
const ROLE_XI = ["gk", "df", "df", "df", "df", "mf", "mf", "mf", "wg", "wg", "fw"];
const ROLE_SQUAD = [...ROLE_XI, "gk", "df", "mf", "wg", "fw"];
const SLOTS = { gk: 1, df: 4, mf: 3, wg: 2, fw: 1 };
const ROLE_KO = { gk: "GK", df: "DF", mf: "MF", wg: "WG", fw: "FW" };
const GK_W = { def: .7, spd: .1, sta: .1, pas: .1 };
const G_W = { fw: 3.0, wg: 2.4, mf: 1.6, df: .5, gk: 0 };
const A_W = { mf: 4, wg: 3.4, fw: 2, df: 1, gk: .1 };
const D_W = { df: 3, mf: 1.4, wg: .35, fw: .2, gk: 0 };
const KR_GIVEN2 = ["재현", "승우", "민재", "강인", "희찬", "준호", "현우", "우진", "지훈", "성민", "동현", "태양", "한결", "다온", "시온", "도윤",
  "정우", "윤호", "상훈", "규민", "범준", "찬영", "세진", "형준"];
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

function natName(nat, used) {
  const one = () => nat === "kr" ? pick(KR_SUR) + pick([...KR_GIVEN, ...KR_GIVEN2]) : pick(NAME_POOL[nat][0]) + " " + pick(NAME_POOL[nat][1]);
  for (let i = 0; i < 25; i++) { const n = one(); if (!used.has(n)) { used.add(n); return n; } }
  return one() + " 주니어";
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
  refreshO(p); return p;
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
}
/* 클럽 베스트11 평균을 기준 전력 쪽으로 (k=1이면 완전히, .5면 절반) */
function anchorClub(name, k) {
  const c = W.c[name], diff = (c.base - xiAvg(name)) * k;
  c.ids.forEach((id) => {
    if (id === "me" || id === "rv") return;
    const p = W.p[id];
    for (const s of STAT_KEYS) p.st[s] = Math.round(clamp(p.st[s] + diff, 12, 99));
    refreshO(p);
  });
}
function clubStr(lg, name) { return W && W.c[name] ? xiAvg(name) : (clubData(lg, name) || [0, 60])[1]; }
function xiAvg(club) { const xi = bestXI(clubPlayers(club), false); return Math.round(xi.reduce((s, p) => s + pOvr(p), 0) / xi.length * 10) / 10; }

/* 선발 11명 — 자리별 능력치 순(폼·로테이션 반영). 부상자는 빠지고, 빈자리는 다른 자리 선수가 메워요 */
function available(p) { return !(p.id === "me" ? S.injured > 0 || (S.ban || 0) > 0 : p.id === "rv" ? S.rival.hurt > 0 || (S.rival.ban || 0) > 0 : p.inj > 0 || (p.ban || 0) > 0); }
function bestXI(players, noisy = true) {
  const pool = players.filter(available);
  const scored = pool.map((p) => {
    let v = pOvr(p) + (p.id === "me" ? S.form * 1.2 : (p.fm || 0) * 1.2);
    if (noisy) v += rand(-2.5, 2.5) - (Math.random() < .05 ? 12 : 0);
    if (p.id === "me" && noisy && S.flags && S.flags.forceStart) v += 100;
    return [p, v];
  });
  const used = new Set(), xi = [];
  for (const role of ROLE_XI) {
    let c = scored.filter(([p]) => !used.has(p) && p.r === role).sort((a, b) => b[1] - a[1])[0];
    if (!c) c = scored.filter(([p]) => !used.has(p) && p.r !== "gk").sort((a, b) => b[1] - a[1])[0];
    if (c) { used.add(c[0]); xi.push(c[0]); }
  }
  return xi;
}
function benchOf(players, xi) { return players.filter((p) => available(p) && !xi.includes(p)); }
const clubPlayers = (club) => W.c[club].ids.map((id) => W.p[id]);

/* 이 클럽에서 내(또는 라이벌) 자리 경쟁 */
function spotRace(club, who = "me") {
  const me = W.p[who], role = me.r, mine = pOvr(me);
  const rivals = clubPlayers(club).filter((p) => p.id !== who && p.r === role).sort((a, b) => pOvr(b) - pOvr(a));
  const kth = rivals[SLOTS[role] - 1];
  const margin = kth ? mine + (who === "me" ? S.form * 1.2 : 0) - pOvr(kth) : 20;
  return { role, slots: SLOTS[role], rivals, kth, margin, p: clamp(.5 + margin / 7, .04, .97) };
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
  return out;
}

/* ================= 경기 엔진 ================= */
function eff(p, k) {
  let v = sOf(p)[k];
  if (p.id === "me") v *= (S.cond < 35 ? .93 : 1) * (1 + S.form * .012);
  else v *= 1 + (p.fm || 0) * .012;
  return v;
}
function units(xi) {
  const by = (r) => xi.filter((p) => p.r === r);
  const mean = (arr, f) => arr.length ? arr.reduce((s, p) => s + f(p), 0) / arr.length : 45;
  return {
    att: mean([...by("fw"), ...by("wg")], (p) => eff(p, "sho") * .4 + eff(p, "dri") * .3 + eff(p, "spd") * .3) * .65 + mean(by("mf"), (p) => eff(p, "pas") * .6 + eff(p, "dri") * .4) * .35,
    mid: mean(by("mf"), (p) => eff(p, "pas") * .45 + eff(p, "sta") * .3 + eff(p, "def") * .25),
    def: mean(by("df"), (p) => eff(p, "def") * .6 + eff(p, "spd") * .2 + eff(p, "sta") * .2),
  };
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
    const injP = p.id === "me" ? .01 * DF().inj * (S.cond < 35 ? 2 : 1) : .01;
    if (Math.random() < injP) inc.push({ min: randi(a, b), side, p, kind: "inj" });
  }
  return inc.sort((x, y) => x.min - y.min);
}
/* 경기 하나의 찬스 목록. 결과(out)는 미리 굴려두고, 내가 끼면 승부처(mom)로 표시해요 */
function genMatch(H, A) {
  H.subs = H.subs || planSubs(H.xi, H.bench || [], H.meBench);
  A.subs = A.subs || planSubs(A.xi, A.bench || [], A.meBench);
  const uH = units(H.xi), uA = units(A.xi);
  const posH = clamp(.5 + (uH.mid - uA.mid) / 90 + (H.adv || 0) * .01, .35, .65);
  const lam = (pos, u1, u2) => clamp(6.3 * (pos / .5) * Math.exp((u1.att - u2.def) / 30), 1.5, 14);
  const nH = poisson(lam(posH, uH, uA)), nA = poisson(lam(1 - posH, uA, uH));
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
    const xg = .06 + Math.pow(Math.random(), 1.6) * .5;
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
  return { H, A, evs: evs2, inc };
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
  if (ev.mom === "pk") { const out = rollShot(ev, 0, true); return { ok: out === "goal", out }; }
  if (ev.mom === "tackle") return Math.random() < blockP(ev) * 1.3 ? { ok: true, out: "block" } : { ok: false, out: rollShot(ev, 0, true) };
  if (ev.mom === "pass" || ev.mom === "dribble") return Math.random() < 1 - blockP(ev) ? { ok: true, out: rollShot(ev, 0, true) } : { ok: false, out: "block" };
  const out = rollShot(ev); return { ok: out === "goal", out };
}
/* 경기 마무리: 평점·MOM */
function finishMatch(m) {
  const all = new Map();
  const add = (p, side, mins, start) => { if (!all.has(p)) all.set(p, { p, side, mins, start, g: 0, a: 0, sh: 0, kp: 0, blk: 0, sv: 0, fail: 0, okm: 0 }); };
  for (const [T, side] of [[m.H, "home"], [m.A, "away"]]) {
    const offAt = (p) => { const o = (T.off || []).find((x) => x.p === p); return o ? o.min : 90; };
    T.xi.forEach((p) => { const s = T.subs.find((x) => x.out === p); add(p, side, Math.min(s ? s.min : 90, offAt(p)), true); });
    T.subs.forEach((s) => add(s.in, side, Math.max(1, Math.min(offAt(s.in), (T.subs.find((x) => x.out === s.in) || { min: 90 }).min) - s.min), false));
  }
  let hg = 0, ag = 0;
  const goals = [];
  for (const ev of m.evs) {
    const sh = all.get(ev.sh), as = ev.as && all.get(ev.as), df = all.get(ev.df), gk = all.get(ev.gk);
    if (sh) sh.sh++;
    if (ev.out === "goal") {
      ev.side === "home" ? hg++ : ag++;
      if (sh) sh.g++; if (as) as.a++;
      goals.push({ min: ev.min, side: ev.side, sh: ev.sh, as: ev.as });
    } else {
      if (as) as.kp++;
      if (ev.out === "block" && df) df.blk++;
      if (ev.out === "save" && gk) gk.sv++;
    }
    if (ev.mom && ev.res) { const mine = all.get(W && W.p && W.p.me) || [...all.values()].find((x) => x.p.id === "me"); if (mine) ev.res.ok ? mine.okm++ : mine.fail++; }
  }
  const cards = [];
  for (const i of m.inc || []) {
    const x = all.get(i.p); if (!x) continue;
    if (i.kind === "yc") x.yc = 1; else if (i.kind === "yc2" || i.kind === "rc") x.rc = i.kind; else if (i.kind === "inj") x.inj = true;
    cards.push(i);
  }
  const ratings = new Map();
  for (const x of all.values()) {
    const p = x.p, gf = x.side === "home" ? hg : ag, ga = x.side === "home" ? ag : hg;
    let r = 6.3 + x.g * 1.0 + x.a * .65 + x.sh * .06 + x.kp * .12 + x.blk * .3 + x.sv * .3 + x.okm * .2 - x.fail * .2;
    r += gf > ga ? .3 : gf < ga ? -.3 : 0;
    if (p.r === "df" || p.r === "gk") r += ga === 0 ? .5 : -Math.max(0, ga - 1) * .18;
    r += (pOvr(p) - 70) / 60 + rand(-.35, .35) - (x.yc ? .2 : 0) - (x.rc ? 1.2 : 0);
    if (x.mins < 60) r = 6.2 + (r - 6.2) * Math.max(.3, x.mins / 60);
    ratings.set(p, Math.round(clamp(r, 3.5, 10) * 10) / 10);
  }
  let mom = null; for (const [p, r] of ratings) if (!mom || r > ratings.get(mom)) mom = p;
  return { hg, ag, goals, ratings, mom, all, cards };
}

/* ---------- 세계에 기록 ---------- */
function credit(res, kind, lgId, hName, aName) {
  for (const [p, r] of res.ratings) {
    if (!p.s) continue;
    const x = res.all.get(p), st = kind === "league" ? p.s : p.cs;
    st.ap++; if (x.start) st.st++;
    st.g += x.g; st.a += x.a; st.rs += r; if (res.mom === p && r >= 7.3) st.mom++;
    if (p.id !== "me") {
      const tgt = p.id === "rv" ? S.rival : p;
      if (x.yc && kind === "league") { st.yc = (st.yc || 0) + 1; if (st.yc % 5 === 0) tgt.ban = 1; }
      if (x.rc) { tgt.ban = x.rc === "rc" ? 2 : 1; if (pOvr(p) >= 80 || p.id === "rv") news(`🟥 ${p.n}(${shortName(p.c || "")}) 퇴장, ${tgt.ban}경기 출전 정지`); }
      if (x.inj) {
        const n = randi(1, 5);
        if (p.id === "rv") { S.rival.hurt = Math.max(S.rival.hurt || 0, n); news(`🚑 라이벌 ${p.n} 경기 중 부상, ${n}경기 결장`); }
        else { p.inj = n; if (pOvr(p) >= 80 || (S.pro && p.c === S.pro.club)) news(`🚑 ${p.n}(${shortName(p.c || "")}) 부상, ${n}경기 결장 예상`); }
      }
    }
    if (p.id !== "me") p.fm = clamp((p.fm || 0) + (r >= 7.6 ? .5 : r <= 5.8 ? -.5 : 0), -2, 2);
  }
  if (kind === "league") {
    recordGame(lgId, hName, aName, res.hg, res.ag);
    S.lgs[lgId].res.push({ h: hName, a: aName, hg: res.hg, ag: res.ag, g: res.goals.map((g) => [g.min, g.side === "home" ? 0 : 1, g.sh.n, g.as ? g.as.n : ""]), mom: res.mom ? [res.mom.n, res.ratings.get(res.mom)] : null, rc: (res.cards || []).filter((c) => c.kind !== "yc").map((c) => [c.min, c.p.n, c.kind]) });
    if (S.lgs[lgId].res.length > 10) S.lgs[lgId].res.splice(0, S.lgs[lgId].res.length - 10);
    for (const x of res.all.values()) if (x.g >= 3) news(`⚽⚽⚽ ${x.p.n}(${shortName(x.p.c || "")}) 해트트릭! ${LEAGUES[lgId].flag} ${hName} ${res.hg}:${res.ag} ${aName}`);
    if (Math.abs(res.hg - res.ag) >= 4) news(`💥 ${LEAGUES[lgId].flag} ${hName} ${res.hg}:${res.ag} ${aName}`);
  }
}
function teamFor(club, opts = {}) {
  const ps = clubPlayers(club), xi = bestXI(ps);
  const bench = benchOf(ps, xi);
  return { name: club, kit: W.c[club].kit, xi, bench, adv: opts.home ? 1.5 : 0, meBench: bench.some((p) => p.id === "me") };
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
    if (round >= 5 && leader !== leaderBefore) news(`📈 ${lg.flag} ${leader}, ${lg.name} 선두 등극`);
  }
  for (const id in W.p) { const p = W.p[id]; if (p.inj > 0) p.inj--; if (p.ban > 0) p.ban--; }
  if (S.rival.ban > 0) S.rival.ban--;
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
    pk = ` (승부차기 ${so ? `${so.a}:${so.b}` : ""} ${win} 승)`;
  }
  c.log.push(`${CUP_STAGE[c.stage] || c.stage + "강"} ${h} ${res.hg}:${res.ag} ${a}${pk}`);
  credit(res, "cup");
  return { win, pk };
}
function cupAdvance(key, winners) {
  const c = S.cups[key];
  c.alive = winners; c.stage = winners.length;
  if (winners.length === 1) { c.winner = winners[0]; news(`${CUPS[key].emoji} ${winners[0]}, ${CUPS[key].name} 우승!`); }
}

/* ---------- 기록 조회 ---------- */
function leaguePlayers(lgId) { return Object.values(W.p).filter((p) => p.l === lgId && p.c); }
function topBy(lgId, key, n = 10) {
  const ps = leaguePlayers(lgId).filter((p) => p.s.ap > 0);
  if (key === "rt") return ps.filter((p) => p.s.ap >= Math.max(3, Math.floor((S.pro.round || ROUNDS) * .55))).sort((a, b) => pAvg(b) - pAvg(a)).slice(0, n);
  return ps.sort((a, b) => b.s[key] - a.s[key] || (key === "g" ? b.s.a - a.s.a : b.s.g - a.s.g) || pAvg(b) - pAvg(a)).slice(0, n);
}
function marketValue(p) {
  const o = pOvr(p), a = ageOf(p);
  const af = a <= 21 ? 1.5 : a <= 24 ? 1.25 : a <= 27 ? 1 : a <= 30 ? .65 : .35;
  return Math.max(1, Math.round(Math.pow(Math.max(0, o - 50), 2.3) * af * .06));
}
const fmtMV = (v) => v >= 10000 ? (v / 10000).toFixed(1) + "조" : v + "억";

/* ---------- 뉴스 ---------- */
function news(m) {
  if (!S.news) S.news = [];
  const when = S.phase === "pro" && S.pro ? (S.pro.round >= ROUNDS ? `${S.pro.season}시즌 오프시즌` : `${S.pro.season}시즌 R${(S.pro.round || 0) + 1}`) : "";
  S.news.unshift({ t: when, m });
  if (S.news.length > 80) S.news.length = 80;
}

/* ---------- 오프시즌: 기록 보관, 성장·노쇠, 은퇴·신인, AI 이적 ---------- */
function archiveSeason(season) {
  for (const p of Object.values(W.p)) {
    if (!p.c || (!p.s.ap && !p.cs.ap)) continue;
    p.h.push({ y: season, c: p.c, l: p.l, ap: p.s.ap + p.cs.ap, g: p.s.g + p.cs.g, a: p.s.a + p.cs.a, r: Math.round(pAvg(p) * 100) / 100, o: Math.round(pOvr(p)) });
    if (p.h.length > 16) p.h.shift();
  }
}
function growAI(p) {
  const a = p.a;
  const d = a <= 21 ? rand(1.5, 4) + p.pot * .35 : a <= 24 ? rand(.3, 2.5) + p.pot * .2 : a <= 28 ? rand(-.6, 1) : a <= 31 ? -rand(0, 1.8) : -rand(1, 3.2);
  const w = roleW(p.r);
  for (const k of STAT_KEYS) {
    const kk = (w[k] || 0) >= .15 ? 1.15 : (k === "spd" || k === "sta") ? (a >= 30 ? 1.5 : .8) : .7;
    p.st[k] = Math.round(clamp(p.st[k] + d * kk + rand(-.6, .6), 12, 99));
  }
  refreshO(p);
}
function worldOffseason() {
  const used = new Set(Object.values(W.p).map((p) => p.n));
  for (const id of Object.keys(W.p)) {
    const p = W.p[id];
    if (id === "me" || id === "rv" || !p.c) continue;
    p.a++; p.fm = 0; p.inj = 0;
    growAI(p);
    if (p.a >= 37 || (p.a >= 34 && Math.random() < .35) || (p.a >= 32 && p.o < W.c[p.c].base - 12)) {
      const club = W.c[p.c];
      if (p.o >= 80) news(`👋 ${p.n}(${p.a}세), 은퇴 발표. 통산 ${p.h.reduce((s, x) => s + x.g, 0)}골`);
      const nat = pickNat(LEAGUES[club.l].mix);
      const np = mkPlayer(nat, p.r, club.base - rand(3, 10), randi(17, 19), used);
      if (Math.random() < .08) np.pot = randi(7, 11);   // 원더키드
      np.c = p.c; np.l = club.l; W.p[np.id] = np;
      club.ids = club.ids.map((x) => x === id ? np.id : x);
      delete W.p[id];
    }
  }
  for (const name in W.c) anchorClub(name, .5);
  aiTransfers();
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
    if (shown < 10 && (p.o >= 76 || dest.tier === 3)) { news(`🔁 ${p.n}(${NATIONS[p.nat].flag}) ${from} → ${dest.name}, 이적료 ${fmtMV(fee)}`); shown++; }
  }
}

/* ---------- 월드컵 (4시즌마다) ---------- */
function nationSquads(minN = 16) {
  const byNat = {};
  for (const p of Object.values(W.p)) { if (!p.c) continue; (byNat[p.nat] = byNat[p.nat] || []).push(p); }
  const out = {};
  for (const [nat, ps] of Object.entries(byNat)) {
    if (ps.length < minN) continue;
    const xi = bestXI(ps, false), bench = benchOf(ps, xi).sort((a, b) => pOvr(b) - pOvr(a)).slice(0, 7);
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
function natTeam(sq, nat) {
  const ps = [...sq[nat].xi, ...sq[nat].bench], xi = bestXI(ps);
  const bench = benchOf(ps, xi);
  return { name: NATIONS[nat].name, nat, kit: NAT_KIT[nat], xi, bench, adv: 0, meBench: bench.some((p) => p.id === "me") };
}
