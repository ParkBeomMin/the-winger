/* 더 윙어 2 - 🎯 시즌 목표(감독 미션) · 🏅 업적 · 📅 출석 보상
 * share.js 뒤에 읽혀서 T(한국어, 영어)로 두 언어를 같이 써요 (영어판 빌드가 이 파일은 번역하지 않아요).
 * 업적과 출석은 기기 전체 기록이라 선수를 새로 만들어도 남아요. 보상은 지금 진행 중인 선수에게 들어가요. */
"use strict";
const ACH_PFX = window.W2_LANG === "en" ? "w2en-" : "w2-";
const ACH_KEY = ACH_PFX + "ach", DAILY_KEY = ACH_PFX + "daily";
const achRd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const achWr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

/* ---------- 🎯 시즌 목표 ---------- */
const GOAL_DEF = {
  g: { e: "⚽", n: () => T("리그 골", "League goals"), v: () => S.pro.s.g },
  ga: { e: "🔥", n: () => T("공격 포인트 (골+도움)", "Goals + assists"), v: () => S.pro.s.g + S.pro.s.a },
  a: { e: "🅰️", n: () => T("리그 도움", "League assists"), v: () => S.pro.s.a },
  cs: { e: "🧱", n: () => T("무실점 경기", "Clean sheets"), v: () => (W && W.p.me.s.cs) || 0 },
  tc: { e: "🛡️", n: () => T("태클 성공", "Tackles won"), v: () => (W && W.p.me.s.tc) || 0 },
  kp: { e: "🎩", n: () => T("키패스 (도움 포함)", "Key passes (incl. assists)"), v: () => (W && W.p.me.s.kp) || 0 },
  pp: { e: "🧭", n: () => T("패스 성공률 (9경기 이상)", "Pass accuracy (9+ apps)"), v: () => W && S.pro.s.apps >= 9 ? passPct(W.p.me.s) : 0, f: (x) => x ? x + "%" : "-" },
  df: { e: "🛡️", n: () => T("수비 기여 (태클+가로채기+차단)", "Defensive actions"), v: () => (W && defAct(W.p.me.s)) || 0 },
  ic: { e: "✋", n: () => T("가로채기", "Interceptions"), v: () => (W && W.p.me.s.ic) || 0 },
  dc: { e: "💨", n: () => T("드리블 성공", "Dribbles won"), v: () => (W && W.p.me.s.dc) || 0 },
  rt: { e: "⭐", n: () => T("평균 평점 (9경기 이상)", "Avg rating (9+ apps)"), v: () => S.pro.s.ratings.length >= 9 ? Math.round(avg(S.pro.s.ratings) * 100) / 100 : 0, f: (x) => x ? x.toFixed(2) : "-" },
  rk: { e: "🏆", n: () => T("팀 순위", "Team finish"), v: () => S.pro.round ? myRank() : 0, low: true, f: (x) => x ? T(`${x}위`, `#${x}`) : "-" },
};
function goalsInit() {
  if (S.phase !== "pro" || !W) return;
  // 팀보다 내가 너무 강해도 동료가 받쳐줘야 기록이 나와요 → 목표 계산에 쓰는 차이는 12까지만
  const P = S.pro, club = P.club, rel = Math.min(12, OVR() - clubStr(P.league, club));
  const order = LEAGUES[P.league].clubs.map((c) => [c[0], clubStr(P.league, c[0])]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const exp = order.indexOf(club) + 1;
  const cl = (v, a, b) => Math.round(clamp(v, a, b));
  // 포지션(미드필더는 세부 역할)마다 후보 목표가 여러 개 → 매 시즌 하나를 골라요 (지난 시즌과 다른 걸로)
  bestXI(clubPlayers(club), false, formOf(club));   // 감독 포메이션에서 내 세부 역할(공미·중미·수미)을 정해요
  const sr = S.pos === "mf" ? (W.p.me.sr || "cm") : S.pos;
  P.sr = sr;
  const POOL = {
    fw: [["g", cl(8 + rel * .6, 3, 25)], ["ga", cl(10 + rel * .6, 4, 28)]],
    wg: [["ga", cl(9 + rel * .6, 4, 28)], ["dc", cl(40 + rel * 1, 20, 70)], ["kp", cl(12 + rel * .5, 6, 26)]],
    am: [["ga", cl(5 + rel * .35, 3, 14)], ["kp", cl(18 + rel * .5, 10, 32)], ["a", cl(3 + rel * .25, 2, 9)]],
    cm: [["kp", cl(15 + rel * .5, 8, 28)], ["pp", cl(91 + rel * .3, 87, 96)], ["ga", cl(4 + rel * .3, 2, 10)], ["df", cl(25 + rel * .8, 12, 45)]],
    dm: [["df", cl(50 + rel * 1.2, 25, 75)], ["ic", cl(25 + rel * .6, 12, 40)], ["pp", cl(91 + rel * .3, 87, 96)], ["tc", cl(25 + rel * .8, 12, 42)]],
    df: [["tc", cl(38 + rel * .9, 18, 60)], ["df", cl(78 + rel * 1.2, 40, 100)], ["ic", cl(35 + rel * .6, 18, 50)]],
    gk: [["cs", cl(4 + rel * .2, 2, 9)]],
  }[sr] || [["ga", 8]];
  const lastK = P.prevGoal && P.prevGoal.k;
  const cand = POOL.length > 1 ? POOL.filter((x) => x[0] !== lastK) : POOL;
  const stat = cand[Math.floor(Math.random() * cand.length)].slice();
  // 지난 시즌에 해낸 만큼은 기대해요 (같은 팀이면 85%, 팀을 옮겼으면 70%) — 비율 목표(패스 성공률)는 빼고
  const pvV = P.prevVals && P.prevVals[stat[0]];
  if (pvV && stat[0] !== "pp") stat[1] = Math.max(stat[1], Math.round(pvV * (P.prevVals.club === club ? .85 : .7)));
  const goals = [{ k: stat[0], t: stat[1] }, { k: "rt", t: Math.round(clamp(6.7 + rel * .015, 6.4, 7.4) * 10) / 10 }, { k: "rk", t: exp <= 1 ? 1 : Math.min(LEAGUES[P.league].clubs.length, exp - (Math.random() < .5 ? 1 : 0)) }];
  if (S.pos === "df") goals.splice(1, 0, { k: "cs", t: cl(4 + (10 - exp) * .5, 2, 9) });
  P.goals = goals.slice(0, 3);
  P.goals.forEach((g) => { g.hit = false; });
}
function goalMet(g) { const v = GOAL_DEF[g.k].v(); return GOAL_DEF[g.k].low ? v > 0 && v <= g.t : v >= g.t; }
function goalsCard() {
  const P = S.pro;
  if (S.phase !== "pro" || !P || !P.goals) return "";
  const rows = P.goals.map((g) => {
    const D = GOAL_DEF[g.k], v = D.v(), f = D.f || ((x) => x);
    const pct = D.low ? (P.round ? clamp((LEAGUES[P.league].clubs.length - v + 1) / (LEAGUES[P.league].clubs.length - g.t + 1) * 100, 0, 100) : 0) : clamp(v / g.t * 100, 0, 100);
    const ok = goalMet(g);
    return `<div class="gl-row ${ok ? "ok" : ""}"><span>${D.e} ${D.n()}</span><div class="gl-bar"><i style="width:${ok ? 100 : pct}%"></i></div><b>${D.low ? T(`${f(v)} / ${g.t}위 안`, `${f(v)} / top ${g.t}`) : `${f(v)} / ${D.f ? D.f(g.t) : g.t}`}</b>${ok ? "<em>✅</em>" : ""}</div>`;
  }).join("");
  return `<div class="goals-card"><div class="gl-h">🎯 ${T("이번 시즌 감독 목표", "Coach's goals this season")} <small>${T("시즌 끝에 달성한 만큼 보상", "Rewards at season end")}</small></div>${rows}</div>`;
}
/* 경기 뒤: 시즌 중에 새로 채운 목표(골·도움 같은 누적 목표만) 알림 */
function goalsAfterMatch() {
  const P = S.pro, out = [];
  if (S.phase !== "pro" || !P || !P.goals) return out;
  for (const g of P.goals) if (!g.hit && g.k !== "rk" && g.k !== "rt" && goalMet(g)) { g.hit = true; out.push(`🎯 ${T("감독 목표 달성", "Goal reached")}: ${GOAL_DEF[g.k].n()} ${g.t}!`); }
  return out;
}
/* 시즌 결산: 목표 판정과 보상 */
function goalsSettle() {
  const P = S.pro;
  if (!P || !P.goals || P.goalsDone === P.season) return P && P.goalsHTML || "";
  const pay = salaryOf(P.league);
  let ok = 0;
  const rows = P.goals.map((g) => {
    const D = GOAL_DEF[g.k], v = D.v(), f = D.f || ((x) => x), met = goalMet(g);
    if (met) ok++;
    return `<div class="gl-row ${met ? "ok" : "no"}"><span>${D.e} ${D.n()}</span><b>${D.low ? T(`${f(v)} (목표 ${g.t}위 안)`, `${f(v)} (goal top ${g.t})`) : `${f(v)} / ${D.f ? D.f(g.t) : g.t}`}</b><em>${met ? "✅" : "❌"}</em></div>`;
  }).join("");
  const money = pay * 2 * ok, fame = 4 * ok, fail = P.goals.length - ok;
  S.money += money; S.fame += fame;
  if (typeof addTrust === "function") { if (ok) addTrust(4 * ok); if (fail) addTrust(-3 * fail); }
  const all = ok === P.goals.length;
  if (all) { S.career.goalsAll = (S.career.goalsAll || 0) + 1; S.money += pay * 3; }
  addLog(`🎯 ${T("감독 목표", "Coach goals")} ${ok}/${P.goals.length}`);
  P.goalsDone = P.season;
  P.prevGoal = { k: P.goals[0].k, v: GOAL_DEF[P.goals[0].k].v(), club: P.club };
  P.prevVals = { club: P.club }; for (const k of ["g", "ga", "a", "kp", "dc", "df", "ic", "tc"]) P.prevVals[k] = GOAL_DEF[k].v();
  P.goalsHTML = `<div class="ss-card goals-card"><h4>🎯 ${T("감독 목표", "Coach's goals")} ${ok}/${P.goals.length}</h4>${rows}
    <p class="small">${ok ? T(`💰 +${fmtMoney(money + (all ? pay * 3 : 0))} · ⭐ 명성 +${fame} · 👔 감독 신뢰 +${4 * ok}`, `💰 +${fmtMoney(money + (all ? pay * 3 : 0))} · ⭐ Fame +${fame} · 👔 Trust +${4 * ok}`) : ""}${fail ? T(` · 못 채운 목표 ${fail}개, 감독 신뢰 -${3 * fail}`, ` · ${fail} missed, trust -${3 * fail}`) : ""}${all ? T(" · 🎉 전부 달성 보너스!", " · 🎉 All-clear bonus!") : ""}</p></div>`;
  return P.goalsHTML;
}

/* ---------- 🏅 업적 ---------- */
const cG = () => S.career.g + (S.phase === "pro" && S.pro ? S.pro.s.g + S.pro.cup.g : 0) + (S.youth ? S.youth.g : 0);
const cA = () => S.career.a + (S.phase === "pro" && S.pro ? S.pro.s.a + S.pro.cup.a : 0) + (S.youth ? S.youth.a : 0);
const cApps = () => S.career.apps + (S.phase === "pro" && S.pro ? S.pro.s.apps + S.pro.cup.ap : 0);
const cMom = () => S.career.mom + (S.phase === "pro" && S.pro ? S.pro.s.mom : 0);
const hasAw = (re) => (S.career.awards || []).some((a) => re.test(a));
const ACH = [
  ["goal1", "⚽", ["첫 골", "First goal"], ["공식 경기에서 첫 골", "Score your first goal"], 1, (c) => cG() >= 1],
  ["hat", "🎩", ["해트트릭", "Hat-trick"], ["한 경기 3골", "3 goals in one match"], 2, (c) => c.r && c.r.goals >= 3],
  ["poker", "🃏", ["포트트릭", "Haul of four"], ["한 경기 4골 이상", "4+ goals in one match"], 3, (c) => c.r && c.r.goals >= 4],
  ["ten", "💯", ["평점 10.0", "Perfect 10"], ["한 경기 평점 10.0", "A 10.0 match rating"], 2, (c) => c.r && c.r.rating >= 9.95],
  ["mom10", "⭐", ["MOM 10회", "10 MOM awards"], ["프로 MOM 10번", "10 pro Man of the Match"], 2, () => cMom() >= 10],
  ["g50", "🥅", ["통산 50골", "50 goals"], ["유스 포함 통산 50골", "50 career goals"], 2, () => cG() >= 50],
  ["g100", "💥", ["통산 100골", "100 goals"], ["유스 포함 통산 100골", "100 career goals"], 3, () => cG() >= 100],
  ["a50", "🎯", ["통산 50도움", "50 assists"], ["유스 포함 통산 50도움", "50 career assists"], 2, () => cA() >= 50],
  ["apps100", "👟", ["100경기", "100 games"], ["프로 100경기 출전", "100 pro appearances"], 1, () => cApps() >= 100],
  ["apps300", "🦿", ["300경기", "300 games"], ["프로 300경기 출전", "300 pro appearances"], 3, () => cApps() >= 300],
  ["ycup", "🏆", ["유스 챔피언", "Youth champion"], ["유스 대회 우승", "Win a youth tournament"], 1, () => S.youth && S.youth.trophies >= 1],
  ["debut", "✍️", ["프로 데뷔", "Pro debut"], ["첫 프로 계약", "Sign your first pro contract"], 1, () => S.phase === "pro" || S.career.seasons.length > 0],
  ["big", "🌍", ["빅리그 입성", "Big league"], ["스페인·잉글랜드 1부에서 뛰기", "Play in Spain or England's top tier"], 2, () => S.phase === "pro" && LEAGUES[S.pro.league].tier >= 3],
  ["title", "🏆", ["리그 우승", "League champion"], ["리그 우승", "Win a league title"], 2, () => (S.career.trophies || []).some((t) => !/컵|Cup/i.test(t))],
  ["cup", "🏅", ["대륙 정복", "Continental glory"], ["대륙컵 우승", "Win a continental cup"], 3, () => (S.career.trophies || []).some((t) => /컵|Cup/i.test(t))],
  ["boot", "👟", ["득점왕", "Golden Boot"], ["리그 득점왕", "League top scorer"], 2, () => hasAw(/👟/)],
  ["mvp", "👑", ["리그 MVP", "League MVP"], ["리그 MVP 수상", "League MVP award"], 3, () => hasAw(/👑/)],
  ["top3", "🥉", ["발롱도르 후보", "Ballon d'Or podium"], ["발롱도르 3위 안", "Top 3 in the Ballon d'Or"], 3, () => (S.career.ballonTop3 || 0) + (S.career.ballon || 0) >= 1],
  ["ballon", "🏅", ["발롱도르", "Ballon d'Or"], ["발롱도르 수상", "Win the Ballon d'Or"], 3, () => (S.career.ballon || 0) >= 1],
  ["promo", "⬆️", ["승격의 기쁨", "Promoted"], ["우리 팀 1부 승격", "Get promoted with your club"], 2, () => S.flags && S.flags.achPro],
  ["relg", "⬇️", ["쓴맛", "Bitter taste"], ["우리 팀 2부 강등", "Get relegated with your club"], 1, () => S.flags && S.flags.achRel],
  ["rv5", "⚔️", ["라이벌 킬러", "Rival slayer"], ["라이벌 상대 5승", "Beat your rival 5 times"], 2, () => S.h2h && S.h2h.w >= 5],
  ["rv15", "🗡️", ["영원한 승자", "Eternal winner"], ["라이벌 상대 15승", "Beat your rival 15 times"], 3, () => S.h2h && S.h2h.w >= 15],
  ["star5", "🌟", ["재능 ★5", "Talent ★5"], ["능력치 하나를 재능 ★5로", "Raise a stat to ★5 talent"], 1, () => Object.values(S.talent || {}).some((t) => t >= 5)],
  ["trans", "🌌", ["초월", "Transcend"], ["능력치 하나 초월 Ⅰ 도달", "Reach Transcend I on a stat"], 2, () => Object.values(S.trans || {}).some((t) => t >= 1)],
  ["trans3", "♾️", ["초월 Ⅲ", "Transcend III"], ["능력치 하나 초월 Ⅲ 도달", "Reach Transcend III on a stat"], 3, () => Object.values(S.trans || {}).some((t) => t >= 3)],
  ["caps20", "🇰🇷", ["국가대표", "International"], ["A매치 20경기", "20 international caps"], 2, () => (S.career.caps || 0) >= 20],
  ["wc", "🌐", ["월드컵 무대", "World Cup stage"], ["월드컵 출전", "Play at a World Cup"], 2, () => (S.career.wc || []).length > 0],
  ["wcwin", "🏆", ["월드컵 우승", "World champion"], ["월드컵 우승", "Win the World Cup"], 3, () => (S.career.wc || []).some((x) => /🏆/.test(x))],
  ["goals3", "🎯", ["완벽한 시즌", "Perfect season"], ["감독 목표 전부 달성", "Clear all coach goals in a season"], 2, () => (S.career.goalsAll || 0) >= 1],
  ["cs10", "🧱", ["철벽", "The wall"], ["한 시즌 무실점 10경기", "10 clean sheets in a season"], 2, () => S.phase === "pro" && W && (W.p.me.s.cs || 0) >= 10],
  ["rich", "💰", ["10억 자산", "Big money"], ["돈 10억 모으기", "Save ₩1B"], 2, () => S.money >= 100000],
  ["icon", "👑", ["축구 아이콘", "Football icon"], ["명성 최고 등급", "Reach the top fame tier"], 3, () => typeof fameGrade === "function" && !fameGrade(S.fame).next],
  ["legend", "🏛️", ["전설의 은퇴", "Legendary farewell"], ["커리어 점수 1000점 이상으로 은퇴", "Retire with 1000+ career score"], 3, (c) => c.retire && typeof careerScore === "function" && careerScore() >= 1000],
];
const ACH_W = { 1: [2, 2], 2: [5, 5], 3: [12, 12] };   // [수당 배수, 명성]
function achAll() { return achRd(ACH_KEY, {}); }
function achCheck(ctx = {}) {
  if (!S || !S.career) return [];
  const got = achAll(), out = [];
  for (const [id, e, nm, , tier, fn] of ACH) {
    if (got[id]) continue;
    let ok = false; try { ok = !!fn(ctx); } catch { ok = false; }
    if (!ok) continue;
    got[id] = kstDay();
    const base = S.phase === "pro" && S.pro ? salaryOf(S.pro.league) : 15, [mx, fm] = ACH_W[tier];
    S.money += base * mx; S.fame += fm;
    out.push(`🏅 ${T("업적", "Achievement")}: ${e} ${T(nm[0], nm[1])} (💰 +${fmtMoney(base * mx)} · ⭐ +${fm})`);
    if (typeof track === "function") track("achievement", { id });
  }
  if (out.length) { achWr(ACH_KEY, got); if (Sfx.levelup) Sfx.levelup(); }
  if (typeof titleCheck === "function") out.push(...titleCheck());
  return out;
}
function achToast(ctx) { const o = achCheck(ctx); o.forEach((m, i) => setTimeout(() => toast(m, 3200), i * 1800)); o.forEach((m) => addLog(m)); return o; }
function achAfterMatch(r) { if (r && r.goals >= 3 && S.career) S.career.hat = (S.career.hat || 0) + 1; return [...goalsAfterMatch(), ...achCheck({ r })]; }
function openAch() {
  const got = achAll(), n = ACH.filter((a) => got[a[0]]).length;
  const rows = ACH.map(([id, e, nm, ds, tier]) => `<div class="ach ${got[id] ? "on" : ""}"><i>${got[id] ? e : "🔒"}</i><div><b>${T(nm[0], nm[1])}</b><small>${T(ds[0], ds[1])}</small></div><em>${got[id] ? got[id].slice(5).replace("-", "/") : "★".repeat(tier)}</em></div>`).join("");
  modal({ title: `🏅 ${T("업적", "Achievements")} ${n}/${ACH.length}`, wide: true,
    html: `<p class="small">${T("기기 기록이라 새 선수로 해도 남아요. 처음 달성할 때 지금 선수에게 보상이 들어가요.", "Saved on this device across careers. Rewards go to your current player the first time.")}</p><div class="ach-list">${rows}</div>`,
    buttons: [{ label: T("닫기", "Close"), value: 1, cls: "btn-primary" }] });
}

/* ---------- 📅 출석 보상 ---------- */
async function dailyCheck() {
  if (!S || !(S.phase === "pro" || S.phase === "youth") || S.pending) return;
  const d = achRd(DAILY_KEY, {}), today = kstDay();
  if (d.last === today) return;
  const yest = kstDay(Date.now() - 86400e3);
  const streak = d.last === yest ? Math.min((d.streak || 0) + 1, 7) : 1;
  achWr(DAILY_KEY, { last: today, streak });
  const base = S.phase === "pro" && S.pro ? salaryOf(S.pro.league) : 15;
  const money = Math.round(base * (1 + streak * .5)), cond = 10 + streak * 2;
  S.money += money; S.cond = clamp(S.cond + cond, 0, 100);
  if (streak === 7) addMast(mainStatOf(S.pos), 3);
  addLog(`📅 ${T(`출석 ${streak}일째`, `Day ${streak} check-in`)} 💰 +${fmtMoney(money)}`);
  save(); renderMain();
  const days = [1, 2, 3, 4, 5, 6, 7].map((i) => `<span class="${i < streak ? "on" : i === streak ? "now" : ""}">${i === 7 ? "🎁" : i}</span>`).join("");
  await modal({ emoji: "📅", title: T(`출석 ${streak}일째!`, `Day ${streak} check-in!`),
    html: `<div class="daily">${days}</div><p>💰 +${fmtMoney(money)} · 🩹 ${T("컨디션", "Condition")} +${cond}${streak === 7 ? T(" · 🎁 주력 능력치 숙련 +3", " · 🎁 Main stat mastery +3") : ""}</p><p class="small">${T("매일 들어오면 7일까지 보상이 커져요. 하루 빠지면 1일째부터 다시 시작해요.", "Rewards grow for 7 days in a row. Miss a day and it restarts.")}</p>`,
    buttons: [{ label: T("받기", "Claim"), value: 1, cls: "btn-primary" }] });
  achToast();
}

/* ---------- 🎖️ 칭호 ----------
 * 커리어 기록으로 열리고(기기 기록), 선수마다 하나를 골라 달아요. 메인 화면 이름 옆 · 명예의 전당에 보여요 */
const TITLE_KEY = ACH_PFX + "titles";
const ssn = () => (S.career && S.career.seasons) || [];
const curS = () => (S.phase === "pro" && S.pro && S.pro.s) || null;
const meS = () => (S.phase === "pro" && typeof W !== "undefined" && W && W.p && W.p.me && W.p.me.s) || {};
const anySeason = (f) => ssn().some(f);
const TITLES = [
  ["sniper", "⚽", ["골잡이", "Goal Hunter"], ["리그 한 시즌 20골", "20 league goals in a season"], () => (curS() && curS().g >= 20) || anySeason((s) => s.g >= 20)],
  ["hatmac", "🎩", ["해트트릭 머신", "Hat-trick Machine"], ["해트트릭 5번", "5 hat-tricks"], () => (S.career.hat || 0) >= 5],
  ["machine", "💥", ["득점 기계", "Goal Machine"], ["통산 200골", "200 career goals"], () => cG() >= 200],
  ["wizard", "🪄", ["마법사", "The Wizard"], ["리그 한 시즌 15도움", "15 league assists in a season"], () => (curS() && curS().a >= 15) || anySeason((s) => s.a >= 15)],
  ["maker", "🎯", ["플레이메이커", "Playmaker"], ["통산 100도움", "100 career assists"], () => cA() >= 100],
  ["wall", "🧱", ["통곡의 벽", "The Great Wall"], ["한 시즌 무실점 12경기", "12 clean sheets in a season"], () => (meS().cs || 0) >= 12],
  ["tackle", "✂️", ["태클 장인", "Tackle Master"], ["한 시즌 태클 성공 60번", "60 tackles won in a season"], () => (meS().tc || 0) >= 60 || anySeason((s) => (s.tc || 0) >= 60)],
  ["dribble", "🏃", ["질주 본능", "Born to Run"], ["한 시즌 드리블 성공 60번", "60 dribbles in a season"], () => (meS().dc || 0) >= 60],
  ["biggame", "🌟", ["빅게임 플레이어", "Big Game Player"], ["대륙컵 통산 10골", "10 continental cup goals"], () => ssn().reduce((x, s) => x + ((s.cup && s.cup.g) || 0), 0) + ((S.pro && S.pro.cup && S.pro.cup.g) || 0) >= 10],
  ["ucl", "🏆", ["챔스의 사나이", "Mr. Champions"], ["챔피언스 컵 2번 우승", "Win the Champions Cup twice"], () => (S.career.trophies || []).filter((t) => t.endsWith(" " + CUPS.eu.name) && !t.includes(CUPS.as.name)).length >= 2],
  ["treble", "🥇", ["더블 크라운", "Double Crown"], ["한 시즌 리그와 대륙컵 동시 우승", "League and continental cup in one season"], () => { const t = S.career.trophies || []; const by = {}; for (const x of t) { const k = x.split(" ")[0]; (by[k] = by[k] || []).push(x); } return Object.values(by).some((a) => a.some((x) => /컵|Cup/.test(x)) && a.some((x) => !/컵|Cup/.test(x))); }],
  ["wchero", "🌍", ["월드컵 영웅", "World Cup Hero"], ["월드컵 우승", "Win the World Cup"], () => (S.career.wc || []).some((x) => /🏆/.test(x))],
  ["taeguk", "🇰🇷", ["태극전사", "Taegeuk Warrior"], ["A매치 50경기", "50 international caps"], () => (S.career.caps || 0) >= 50],
  ["oneclub", "💙", ["원클럽맨", "One-Club Man"], ["한 팀에서 10시즌", "10 seasons at one club"], () => { const s = ssn(); if (s.length < 10) return false; const c = {}; s.forEach((x) => (c[x.club] = (c[x.club] || 0) + 1)); return Math.max(...Object.values(c)) >= 10; }],
  ["journey", "✈️", ["저니맨", "Journeyman"], ["6개 팀 이상에서 뛰기", "Play for 6+ clubs"], () => new Set(S.career.clubs || []).size >= 6],
  ["bottom", "🪜", ["밑바닥부터", "From the Bottom"], ["2부에서 시작해 빅리그 우승", "Start in a second tier, win a big-league title"], () => { const s = ssn(); return s.length && LEAGUES[s[0].league] && LEAGUES[s[0].league].div === 2 && s.some((x) => x.rank === 1 && LEAGUES[x.league] && LEAGUES[x.league].tier >= 3); }],
  ["rvkill", "⚔️", ["라이벌 킬러", "Rival Killer"], ["라이벌전 20승", "Beat your rival 20 times"], () => S.h2h && S.h2h.w >= 20],
  ["rival", "🤝", ["영원한 맞수", "Eternal Rivals"], ["라이벌과 함께 발롱도르 3위 안 3번", "You and your rival both top 3 in the Ballon d'Or, 3 times"], () => ssn().filter((s) => s.ballon && s.ballon <= 3 && s.rv && s.rv.b && s.rv.b <= 3).length >= 3],
  ["king", "👑", ["왕 중의 왕", "King of Kings"], ["발롱도르 3번", "3 Ballon d'Or wins"], () => (S.career.ballon || 0) >= 3],
  ["late", "🐢", ["대기만성", "Late Bloomer"], ["27세 이후 첫 발롱도르", "First Ballon d'Or at 27+"], () => { const f = ssn().find((s) => s.ballon === 1); return !!f && f.age >= 27; }],
  ["prodigy", "⚡", ["신성", "Wonderkid"], ["21세 이하 발롱도르", "Ballon d'Or at 21 or younger"], () => ssn().some((s) => s.ballon === 1 && s.age <= 21)],
  ["iron", "🎖️", ["철인", "Iron Man"], ["통산 400경기", "400 career games"], () => cApps() >= 400],
  ["perfect", "🎯", ["완벽주의자", "Perfectionist"], ["감독 목표 전부 달성 5시즌", "Clear all coach goals in 5 seasons"], () => (S.career.goalsAll || 0) >= 5],
  ["beyond", "🌌", ["초월자", "Transcendent"], ["초월 Ⅲ 능력치 2개", "Two stats at Transcend III"], () => Object.values(S.trans || {}).filter((t) => t >= 3).length >= 2],
  ["bad", "😈", ["악동", "Bad Boy"], ["한 시즌 퇴장 3번", "3 red cards in a season"], () => (meS().rc || 0) >= 3],
  ["fever", "🔥", ["피버 레전드", "Fever Legend"], ["피버 중에 발롱도르", "Win the Ballon d'Or during a Fever"], () => S.flags && S.flags.feverBallon],
];
function titleName(id) { const t = TITLES.find((x) => x[0] === id); return t ? `${t[1]} ${T(t[2][0], t[2][1])}` : ""; }
function titleTag() { return S && S.title ? `<span class="ttl">${titleName(S.title)}</span>` : ""; }
function titleCheck() {
  if (!S || !S.career) return [];
  const got = achRd(TITLE_KEY, {}), out = [];
  for (const [id, e, nm, , fn] of TITLES) {
    if (got[id]) continue;
    let ok = false; try { ok = !!fn(); } catch { ok = false; }
    if (!ok) continue;
    got[id] = kstDay();
    if (!S.title) S.title = id;
    out.push(`🎖️ ${T("칭호 획득", "New title")}: ${e} ${T(nm[0], nm[1])}`);
    if (typeof track === "function") track("title", { id });
  }
  if (out.length) achWr(TITLE_KEY, got);
  return out;
}
function openTitles() {
  const got = achRd(TITLE_KEY, {}), n = TITLES.filter((t) => got[t[0]]).length;
  const rows = TITLES.map(([id, e, nm, ds]) => `<button class="ach ttl-row ${got[id] ? "on" : ""} ${S && S.title === id ? "eq" : ""}" data-ttl="${got[id] ? id : ""}"><i>${got[id] ? e : "🔒"}</i><div><b>${T(nm[0], nm[1])}</b><small>${T(ds[0], ds[1])}</small></div><em>${S && S.title === id ? T("장착 중", "Equipped") : got[id] ? T("달기", "Equip") : ""}</em></button>`).join("");
  modal({ title: `🎖️ ${T("칭호", "Titles")} ${n}/${TITLES.length}`, wide: true,
    html: `<p class="small">${T("열린 칭호를 눌러 내 선수에게 달아요. 메인 화면과 명예의 전당에 보여요. 칭호는 기기에 남아서 새 선수도 쓸 수 있어요.", "Tap an unlocked title to equip it. It shows on the main screen and in the Hall of Fame. Titles stay on this device for future players.")}</p><div class="ach-list">${rows}</div>`,
    buttons: [{ label: T("칭호 떼기", "Remove title"), value: "off" }, { label: T("닫기", "Close"), value: 1, cls: "btn-primary" }] }).then((v) => { if (v === "off" && S) { S.title = null; save(); renderMain(); } });
  setTimeout(() => document.querySelectorAll("#modal [data-ttl]").forEach((b) => b.onclick = () => { if (!b.dataset.ttl || !S) return; S.title = b.dataset.ttl; save(); if (typeof renderMain === "function" && document.getElementById("scr-main").classList.contains("active")) renderMain(); openTitles(); }), 0);
}
