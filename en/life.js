/* 더 윙어 2 - 선수 생활: 명성 등급 · 상점(장비·전담팀·소모품·기부) · 감독 신뢰 · 계약 */
"use strict";

/* ---------- ⭐ 명성 등급 ---------- */
const FAME_GRADES = [
  [0, "🌱 Unknown"], [30, "🌿 Prospect"], [100, "⭐ Rising Talent"], [170, "👕 First-team Regular"], [250, "🌟 League Star"],
  [370, "📣 Fan Favourite"], [500, "🏅 International Class"], [680, "🎯 Face of the League"], [900, "💫 World Star"], [1200, "🚀 Superstar"],
  [1600, "👑 Legend Class"], [2100, "🏛️ Living Legend"], [2800, "🐐 Football Icon"], [3800, "⚡ God of Football"],
];
function fameGrade(f) {
  let i = 0; for (let k = 0; k < FAME_GRADES.length; k++) if (f >= FAME_GRADES[k][0]) i = k;
  const next = FAME_GRADES[i + 1];
  return { i, name: FAME_GRADES[i][1], next: next ? next[1] : null, need: next ? Math.ceil(next[0] - f) : 0, pct: next ? (f - FAME_GRADES[i][0]) / (next[0] - FAME_GRADES[i][0]) : 1 };
}

/* ---------- 🛍️ 상점 ----------
 * gear: 한 번 사면 영구 / staff: 고용(시즌마다 유지비) / item: 바로 쓰는 소모품 / give: 기부·라이프스타일(명성) */
const SHOP2 = [
  { id: "boots", cat: "gear", emoji: "👟", name: "Custom boots", desc: "Shooting·Dribbling +2", price: [150, 500, 1500, 5000, 15000] },
  { id: "insole", cat: "gear", emoji: "🦶", name: "Speed insoles", desc: "Speed +2", price: [200, 800, 3000, 10000] },
  { id: "shin", cat: "gear", emoji: "🛡️", name: "Carbon shin guards", desc: "Injury risk -20%", price: [300, 1200, 5000] },
  { id: "gps", cat: "gear", emoji: "📡", name: "GPS tracking vest", desc: "Training efficiency +6%", price: [400, 1500, 6000] },
  { id: "trainer", cat: "staff", emoji: "🧑‍🏫", name: "Personal trainer team", desc: "Training efficiency +10%", price: [300, 1000, 3000] },
  { id: "recovery", cat: "staff", emoji: "🧊", name: "Rehab & recovery center", desc: "Rest +8 · Training fatigue -2", price: [200, 700, 2000] },
  { id: "nutrition", cat: "staff", emoji: "🥗", name: "Personal nutritionist", desc: "Condition +2 every turn", price: [250, 900, 3000] },
  { id: "mental", cat: "staff", emoji: "🧘", name: "Mental coach", desc: "25% chance to keep Form after bad games", price: [400, 1500, 5000] },
  { id: "analyst", cat: "staff", emoji: "📊", name: "Match analyst", desc: "Auto Key moment success +4%p", price: [600, 2500, 8000] },
  { id: "agent", cat: "staff", emoji: "💼", name: "Agent", desc: "Transfer offers +1 · Salary talks +8%", price: [300, 2000, 10000] },
  { id: "massage", cat: "item", emoji: "💆", name: "Sports massage", desc: "Condition +30", cost: () => Math.max(30, payRef() * 1.5) },
  { id: "camp", cat: "item", emoji: "🏕️", name: "Special personal camp", desc: "Next training x2", cost: () => Math.max(80, payRef() * 4) },
  { id: "cryo", cat: "item", emoji: "❄️", name: "Cryotherapy", desc: "Recover from injury 1 turn sooner", cost: () => Math.max(100, payRef() * 6) },
  { id: "talentlab", cat: "item", emoji: "🧬", name: "Talent development program", desc: "Chosen stat Mastery +6 (pick a stat on the button)", cost: () => Math.max(150, payRef() * 8) },
  { id: "clinic", cat: "give", emoji: "⚽", name: "Sponsor a youth football school", desc: "Fame +30 (once per season)", price: [1000], repeat: true },
  { id: "car", cat: "give", emoji: "🏎️", name: "Supercar", desc: "Fame +15", price: [20000] },
  { id: "house", cat: "give", emoji: "🏠", name: "Beachfront mansion", desc: "Fame +25", price: [30000] },
  { id: "foundation", cat: "give", emoji: "🤝", name: "Found a charity", desc: "Fame +150 · Career score +20", price: [10000] },
  { id: "stadium", cat: "give", emoji: "🏟️", name: "Donate a hometown pitch", desc: "Fame +400 · Career score +40", price: [50000] },
];
const SHOP_CAT = [["gear", "🎽 Gear"], ["staff", "👥 Staff"], ["item", "🧴 Consumables"], ["give", "💝 Giving & Life"]];
const G = (id) => (S && S.gear && S.gear[id]) || 0;
function payRef() { return S.contract && S.phase === "pro" ? S.contract.sal : 20; }
function staffFee() { return SHOP2.filter((x) => x.cat === "staff").reduce((s, x) => s + (G(x.id) ? Math.round(x.price[G(x.id) - 1] * .25) : 0), 0); }
/* 시즌이 시작될 때 전담팀 유지비를 내요. 돈이 모자라면 비싼 쪽부터 계약이 끝나요 */
function payStaff() {
  let fee = staffFee();
  if (!fee) return null;
  const lapsed = [];
  while (fee > S.money) {
    const it = SHOP2.filter((x) => x.cat === "staff" && G(x.id)).sort((a, b) => b.price[G(b.id) - 1] - a.price[G(a.id) - 1])[0];
    if (!it) break;
    S.gear[it.id]--; lapsed.push(it.name); fee = staffFee();
  }
  S.money -= fee;
  return { fee, lapsed };
}
function shopBuy(it, key) {
  const lv = G(it.id);
  if (it.cat === "item") {
    const c = Math.round(it.cost());
    if (S.money < c) return toast("Not enough money");
    if (it.id === "cryo" && !(S.injured > 0)) return toast("You're not injured right now");
    S.money -= c;
    if (it.id === "massage") S.cond = clamp(S.cond + 30, 0, 100);
    if (it.id === "camp") S.buff = Math.max(S.buff || 1, 2);
    if (it.id === "cryo") S.injured = Math.max(0, S.injured - 1);
    if (it.id === "talentlab") { const o = addMast(key, 6); toast(o.length ? o.map((x) => x.msg).join(" · ") : `🧬 ${STAT_NAME[key]} Mastery +6`, 3000); if (S.awake) S.awake.length = 0; }
    addLog(`🛍️ ${it.name} (${fmtMoney(c)})`); Sfx.good(); return save();
  }
  const once = it.cat === "give" && !it.repeat;
  if (once && lv) return;
  if (it.repeat && S.flags["give_" + it.id] === (S.pro ? S.pro.season : S.year)) return toast("Already sponsored this season");
  const price = it.price[it.repeat ? 0 : lv];
  if (price == null || S.money < price) return toast("Not enough money");
  S.money -= price;
  if (!it.repeat) S.gear[it.id] = lv + 1;
  if (it.id === "boots") { S.stats.sho = clamp(S.stats.sho + 2, 1, statCap("sho")); S.stats.dri = clamp(S.stats.dri + 2, 1, statCap("dri")); }
  if (it.id === "insole") S.stats.spd = clamp(S.stats.spd + 2, 1, statCap("spd"));
  const fameAdd = { clinic: 30, car: 15, house: 25, foundation: 150, stadium: 400 }[it.id];
  if (fameAdd) { S.fame += fameAdd; if (it.id === "foundation" || it.id === "stadium") S.career.awardScore = (S.career.awardScore || 0) + (it.id === "stadium" ? 40 : 20); news(`💝 ${S.name}, ${it.name}${it.id === "clinic" ? "" : "!"}`); }
  if (it.repeat) S.flags["give_" + it.id] = S.pro ? S.pro.season : S.year;
  addLog(`🛍️ ${it.name}${it.cat === "gear" || it.cat === "staff" ? ` Lv.${S.gear[it.id]}` : ""} (${fmtMoney(price)})`);
  if (typeof track === "function") track("shop_buy", { item: it.id });
  Sfx.good(); save();
}
async function openShop(cat = "gear") {
  const row = (it) => {
    const lv = G(it.id);
    if (it.id === "talentlab") return `<div class="shop-row tl"><span>${it.emoji}</span><div><b>${it.name} · ${fmtMoney(Math.round(it.cost()))}</b><small>${it.desc}</small><div class="tl-keys">${STATS.map((s) => { const nd = mastNeed(s.key); return `<button class="btn btn-ghost sm" data-buy="talentlab" data-k="${s.key}" ${S.money < it.cost() || (!nd && trOf(s.key) >= 3) ? "disabled" : ""}>${s.emoji}${s.name} ${nd ? `${(S.mast && S.mast[s.key]) || 0}/${nd}` : trOf(s.key) < 3 ? `🌌${Math.round(tgOf(s.key))}%` : T("완성", "Done")}</button>`; }).join("")}</div></div></div>`;
    if (it.cat === "item") return `<div class="shop-row"><span>${it.emoji}</span><div><b>${it.name}</b><small>${it.desc}</small></div><button class="btn btn-primary sm" data-buy="${it.id}" ${S.money < it.cost() ? "disabled" : ""}>${fmtMoney(Math.round(it.cost()))}</button></div>`;
    const max = it.cat === "give" ? (it.repeat ? 99 : 1) : it.price.length;
    const done = !it.repeat && lv >= max;
    const price = it.price[it.repeat ? 0 : lv];
    const fee = it.cat === "staff" && lv ? ` · Upkeep ${fmtMoney(Math.round(it.price[lv - 1] * .25))}/season` : "";
    const given = it.repeat && S.flags["give_" + it.id] === (S.pro ? S.pro.season : S.year);
    return `<div class="shop-row"><span>${it.emoji}</span><div><b>${it.name}${it.cat === "gear" || it.cat === "staff" ? ` Lv.${lv}/${max}` : lv ? " ✓" : ""}</b><small>${it.desc}${fee}</small></div>${done ? "<em>Owned</em>" : given ? "<em>Donated</em>" : `<button class="btn btn-primary sm" data-buy="${it.id}" ${S.money < price ? "disabled" : ""}>${fmtMoney(price)}</button>`}</div>`;
  };
  const html = () => `<p class="small">💰 Balance <b>${fmtMoney(S.money)}</b>${staffFee() ? ` · Staff upkeep ${fmtMoney(staffFee())}/season` : ""}</p>
    <div class="seg wrap lg-seg">${SHOP_CAT.map(([k, n]) => `<button class="${k === cat ? "on" : ""}" data-cat="${k}">${n}</button>`).join("")}</div>
    ${cat === "staff" ? `<p class="small">Staff upkeep is paid at the start of every season. If you run out of money, their contracts end.</p>` : ""}
    ${SHOP2.filter((x) => x.cat === cat).map(row).join("")}`;
  const p = modal({ title: "🛍️ Shop", wide: true, html: `<div id="shop-in">${html()}</div>`, buttons: [{ label: "Close", value: 1, cls: "btn-ghost" }] });
  const bind = () => {
    document.querySelectorAll("#shop-in [data-cat]").forEach((b) => b.onclick = () => { cat = b.dataset.cat; $("shop-in").innerHTML = html(); bind(); });
    document.querySelectorAll("#shop-in [data-buy]").forEach((b) => b.onclick = () => { shopBuy(SHOP2.find((x) => x.id === b.dataset.buy), b.dataset.k); $("shop-in").innerHTML = html(); bind(); });
  };
  bind();
  await p; renderMain();
}

/* ---------- 👔 감독 신뢰 ----------
 * 0~100. 선발 경쟁에 ±6 정도로 실려요. 감독이 바뀌거나 이적하면 다시 쌓아야 해요. */
function syncTrust() {
  if (!S.pro || !W) return false;
  const co = coachOf(S.pro.club);
  if (S.trustCoach !== co.n) {
    const changed = !!S.trustCoach && S.trustClub === S.pro.club;
    S.trustCoach = co.n; S.trustClub = S.pro.club; S.trust = changed ? 45 : 50;
    return changed;
  }
  return false;
}
function addTrust(v, why) {
  if (S.trust == null) S.trust = 50;
  const before = S.trust;
  S.trust = clamp(Math.round(S.trust + v), 0, 100);
  return S.trust !== before ? `👔 Coach trust ${v > 0 ? "+" : ""}${S.trust - before}${why ? ` (${why})` : ""}` : null;
}
function trustLabel(t = S.trust ?? 50) { return t >= 80 ? "💚 Total faith" : t >= 60 ? "🙂 Trusted" : t >= 40 ? "😐 Neutral" : t >= 20 ? "😟 Doubtful" : "🧊 Cold shoulder"; }

/* ---------- ✍️ 계약 ----------
 * 기간(년) · 라운드 수당 · 바이아웃. 계약 중 이적은 구단 동의가 필요해요. */
function baseSalary(lg, str) {
  return Math.round(LEAGUES[lg].pay * Math.pow(OVR() / 65, 2) * (1 + (str - 70) / 80) * (1 + G("agent") * .08));
}
function defaultYears() { return S.age <= 23 ? 4 : S.age <= 28 ? 3 : 2; }
function releaseOf(sal) { return Math.max(1, Math.round(Math.max(marketValue(W.p.me) * 1.6, sal * 36 / 10000))); }   // 억 단위 (시장가치의 1.6배, 최소 두 시즌 연봉)
/* 협상: 그대로 / 조금 더 / 크게. 실패하면 처음 제안으로 */
async function negotiate(o, title) {
  const base = baseSalary(o.league, o.str), yrs = defaultYears();
  const pAsk = clamp(.72 + G("agent") * .08 + (S.fame >= 250 ? .08 : 0) + (S.flags.renewWill && S.pro && o.club === S.pro.club ? .1 : 0), .3, .95), pBig = clamp(.38 + G("agent") * .1 + (S.fame >= 500 ? .1 : 0), .15, .85);
  const v = await modal({
    emoji: "✍️", title: title || `${esc(o.club)} contract talks`, wide: true,
    html: `<p>Club offer: <b>${yrs} yrs</b> · Match fee <b>${fmtMoney(base)}</b><br/><small>Release clause ${fmtMV(releaseOf(base))} · 15% fee bonus per goal/assist</small></p>
      <p class="small">Agent Lv.${G("agent")} · Fame ${fameGrade(S.fame).name}</p>`,
    buttons: [
      { label: `🤝 Sign as is (${fmtMoney(base)})`, value: 1, cls: "btn-primary" },
      { label: `📈 Ask a bit more (+15%)`, hint: `Success chance ${Math.round(pAsk * 100)}%`, value: 2 },
      { label: `💰 Ask big (+35%)`, hint: `Success chance ${Math.round(pBig * 100)}% · Fail: Coach trust -5`, value: 3 },
    ],
  });
  let sal = base, msg = "Signed the offer as is";
  if (v === 2) { if (Math.random() < pAsk) { sal = Math.round(base * 1.15); msg = "Talks succeeded! Fee +15%"; } else msg = "The club refused, so you signed the original offer"; }
  if (v === 3) { if (Math.random() < pBig) { sal = Math.round(base * 1.35); msg = "Huge deal! Fee +35%"; } else { msg = "The club was annoyed. Signed the original offer"; S.trustPenalty = 5; } }
  S.contract = { club: o.club, years: yrs, sal, rel: releaseOf(sal), since: S.pro ? S.pro.season || 1 : 1 };
  addLog(`✍️ ${o.club} ${yrs}-yr contract · Match fee ${fmtMoney(sal)} · ${msg}`);
  toast(`✍️ ${msg}`, 2800);
  return S.contract;
}
/* 계약 중 다른 구단 제안을 받아들이면 지금 구단이 동의해야 해요 */
function releaseChance(o) {
  const c = S.contract;
  if (!c || c.club !== S.pro.club || c.years <= 0) return 1;
  const up = LEAGUES[o.league].tier - LEAGUES[S.pro.league].tier;
  let p = .35 + up * .22 + (c.years <= 1 ? .35 : 0) + ((S.trust ?? 50) < 35 ? .15 : 0) + (S.pro.lastBench ? .1 : 0);
  return clamp(p, .12, .95);
}
function contractLine() {
  const c = S.contract;
  if (!c || !S.pro || c.club !== S.pro.club) return "";
  return `✍️ ${c.years} yrs left on contract · Match fee ${fmtMoney(c.sal)} · Release clause ${fmtMV(c.rel)}`;
}

/* ---------- 🇰🇷 A매치: 실제 국가대표 명단(세계 선수 풀에서 뽑은 베스트)으로 소집 · 실제 경기 ---------- */
function callUp() {
  if (!W || S.injured > 0) return;
  const sq = nationSquads(11), kr = sq.kr;
  if (!kr) return;
  const inXI = kr.xi.some((p) => p.id === "me"), inBench = kr.bench.some((p) => p.id === "me");
  const opps = Object.keys(sq).filter((n) => n !== "kr");
  news(`🇰🇷 International squad announced · Captain ${[...kr.xi].sort((a, b) => pOvr(b) - pOvr(a))[0].n}${inXI || inBench ? ` · ${S.name} called up` : ""}`);
  if (inXI || inBench) pushSig("national", { xi: inXI, opp: pick(opps) });
}
function aMatch(S, d) {
  const sq = nationSquads(11);
  if (!d || !sq.kr || !sq[d.opp]) return "The international match was canceled";
  const A = natTeam(sq, "kr"), B = natTeam(sq, d.opp), m = genMatch(A, B);
  resolveAuto(m);
  const res = finishMatch(m), x = [...res.all.values()].find((v) => v.p.id === "me");
  const out = [`🇰🇷 South Korea ${res.hg}:${res.ag} ${NATIONS[d.opp].flag} ${NATIONS[d.opp].name}`];
  if (x) {
    S.career.caps = (S.career.caps || 0) + 1; S.career.ig = (S.career.ig || 0) + x.g;
    out.push(`${x.mins} mins played · Rating ${res.ratings.get(x.p)}${x.g ? ` · ⚽${x.g}` : ""}${x.a ? ` · 🅰️${x.a}` : ""} · ${S.career.caps} caps`);
    out.push(addFame(S, 8 + x.g * 6 + (res.mom === x.p ? 6 : 0)));
    if (x.g) news(`🇰🇷 ${S.name} scores vs ${NATIONS[d.opp].name} in an international match!`);
  } else out.push("Watched from the bench · " + addFame(S, 3));
  out.push(addCond(S, -12));
  return out.join(" · ");
}
/* 신호 이벤트 하나 꺼내기 (오래된 건 버려요) */
function takeSig() {
  if (!S.sig || !S.sig.length) return null;
  S.sig = S.sig.filter((x) => S.turn - x.t <= 4 && SIG_EVENTS[x.k]);
  while (S.sig.length) {
    const s = S.sig.shift();
    if (S.ev["sig_" + s.k] != null && S.turn - S.ev["sig_" + s.k] < 3) continue;
    return s;
  }
  return null;
}
const EV_IMG = new Set(["ad", "agent", "bench", "boots", "coachpos", "fan", "interview", "knee", "mentor", "mom", "national", "night", "no10", "party", "rivalhurt", "scout", "taunt", "together", "youtube"]);
const SIG_IMG = { benched3: "bench", awful: "bench", superb: "interview", newclub: "together", rivalhattrick: "taunt", matchinjury: "knee", contractlast: "agent", transferblocked: "agent", winning4: "party", losing3: "night", newcoach: "coachpos", wcdropped: "night" };
function evImg(id) { const k = SIG_IMG[id] || id; return EV_IMG.has(k) ? `assets/ev_${k}.webp` : null; }
/* 명성 등급이 오르면 알려줘요 */
function checkFameUp() {
  const g = fameGrade(S.fame).i;
  if (S.fameI == null || S.fameV !== 2) { S.fameI = g; S.fameV = 2; return; }   // v2: 등급이 14단계로 늘어 옛 번호는 다시 맞춰요
  if (g > S.fameI) { S.fameI = g; const n = FAME_GRADES[g][1]; addLog(`⭐ Fame grade up: ${n}`); toast(`⭐ Fame grade UP! ${n}`, 3000); if (g >= 4) news(`⭐ ${S.name} is now '${n.replace(/^\S+\s/, "")}'`); }
  else if (g < S.fameI) S.fameI = g;
}

/* ---------- 🧬 재능 각성 · 🌌 초월 ----------
 * 99 전: 능력치마다 숙련도가 쌓여요(훈련 1, 🔥버프 훈련 2, MOM 2, 연수·프로그램). 다 차면 재능 별 +1 (훈련 성장 배율).
 * 99(최대치)부터: 그 능력치 훈련은 🌌 초월 도전. 성공 확률 = 기본(단계별) + 재능 ★ + 초월 게이지 × 0.1,
 *   실패할 때마다 게이지가 차고 꽉 차면 다음 도전은 확정 성공(천장). 성공하면 최대치 +2, 능력치 +1~2.
 *   ★5가 됐거나 최대치에 닿은 능력치의 숙련 보상(MOM·연수·프로그램)은 게이지로 들어가요.
 * 초월 III(105) 다음은 🎯 감각 훈련: 다음 경기에서만 그 능력치 +5. 라이벌과 AI 선수도 같은 확률 규칙. */
const MAST_NEED = [0, 12, 18, 26, 36];   // [지금 별] → 다음 별까지
const TR_BASE = [5, 2, 1], TR_PITY = [16, 24, 32];   // 초월 I·II·III: 기본 확률(%), 천장(실패 횟수)
const TRANS_NAME = ["", "Transcend I", "Transcend II", "Transcend III"];
const trOf = (k, E = S) => (E.trans && E.trans[k]) || 0;
const talentLv = (k, E = S) => E.talent[k] + trOf(k, E);
function mastNeed(k, E = S) { return E.talent[k] < 5 ? MAST_NEED[E.talent[k]] : 0; }
function statCap(k, E = S) { return 99 + trOf(k, E) * 2; }
const atCapOf = (k, E = S) => E.stats[k] >= statCap(k, E) - .05;
const tgOf = (k, E = S) => (E.tg && E.tg[k]) || 0;
const trStep = (tr) => 100 / TR_PITY[Math.min(2, tr)];
function addTg(k, pts, E = S) { if (!E.tg) E.tg = {}; E.tg[k] = Math.round(Math.min(100, (E.tg[k] || 0) + pts) * 10) / 10; }
function transChance(k, E = S) {
  const tr = trOf(k, E); if (tr >= 3) return 0;
  const g = tgOf(k, E); return g >= 100 ? 100 : Math.min(100, Math.round(TR_BASE[tr] + E.talent[k] + g * .1));
}
function talentStr(k, tal = S.talent[k], tr = trOf(k)) {
  return `${"★".repeat(tal)}${"☆".repeat(5 - tal)}${tr ? `<i class="trs">${"✦".repeat(tr)}</i>` : ""}`;
}
function awakeNotify(out, k, E) {
  if (E !== S) {   // 라이벌: 뉴스와 내 로그로만
    for (const o of out) if (o.kind === "trans" || E.talent[k] === 5) { news(`${o.kind === "trans" ? "🌌" : "🧬"} Rival ${E.name}: ${STAT_NAME[k]} ${o.kind === "trans" ? TRANS_NAME[E.trans[k]] + " reached" : "Talent ★5 awakened"}`); addLog(`⚔️ Rival ${E.name}: ${o.msg.replace(/^\S+\s/, "")}`); }
    return out;
  }
  for (const o of out) { addLog(o.msg); if (o.kind === "trans" || S.talent[k] === 5) news(`${o.kind === "trans" ? "🌌" : "🧬"} ${S.name}: ${STAT_NAME[k]} ${o.kind === "trans" ? TRANS_NAME[S.trans[k]] + " reached" : "Talent ★5 awakened"}`); }
  if (out.length) (S.awake = S.awake || []).push(...out);
  return out;
}
function addMast(k, n, E = S) {
  if (E === S && typeof F === "function" && F("mast")) { const x = n * (1 + F("mast")); n = Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); }
  if (!E.mast) E.mast = {};
  if (!E.trans) E.trans = {};
  const out = [];
  if (E.talent[k] < 5) {   // ★5 전에는 최대치여도 숙련은 별(재능)로
    E.mast[k] = (E.mast[k] || 0) + n;
    while (E.talent[k] < 5 && E.mast[k] >= MAST_NEED[E.talent[k]]) {
      E.mast[k] -= MAST_NEED[E.talent[k]];
      E.talent[k]++; out.push({ k, kind: "awake", msg: `🧬 Talent awakening! ${STAT_NAME[k]} ★${E.talent[k] - 1} → ★${E.talent[k]}` });
    }
    if (E.talent[k] >= 5) { const left = E.mast[k]; E.mast[k] = 0; if (left && trOf(k, E) < 3) addTg(k, left * trStep(trOf(k, E)) / 2, E); }
  } else if (trOf(k, E) < 3) addTg(k, n * trStep(trOf(k, E)) / 2, E);
  return awakeNotify(out, k, E);
}
/* 🌌 초월 도전 한 번: 성공하면 단계 +1(최대치 +2, 능력치 +1~2), 실패하면 게이지 +천장 한 칸(× mult)
 * 🔥 모험 도전(bold): 성공 확률 2배, 대신 실패하면 그 능력치 -1 (다시 훈련으로 채워야 도전 가능) */
const boldCh = (ch) => Math.min(100, ch * 2);
function transAttempt(k, E = S, mult = 1, bold = false) {
  const tr = trOf(k, E); if (tr >= 3 || E.talent[k] < 5) return null;   // 초월은 ★5부터
  if (!E.trans) E.trans = {};
  const ch = bold ? boldCh(transChance(k, E)) : transChance(k, E);
  if (Math.random() * 100 < ch) {
    E.trans[k] = tr + 1; if (E.tg) E.tg[k] = 0;
    const up = randi(1, 2), b = E.stats[k];
    E.stats[k] = Math.min(statCap(k, E), E.stats[k] + up);
    awakeNotify([{ k, kind: "trans", msg: `🌌 Transcend! ${STAT_NAME[k]} ${TRANS_NAME[E.trans[k]]} · Max ${statCap(k, E)}` }], k, E);
    return { ok: true, ch, up: E.stats[k] - b };
  }
  addTg(k, trStep(tr) * mult, E);
  if (bold) E.stats[k] = Math.max(1, E.stats[k] - 1);
  return { ok: false, ch, next: bold ? boldCh(transChance(k, E)) : transChance(k, E), lost: bold ? 1 : 0 };
}

/* ---------- 세계의 AI 선수도 같은 규칙 ----------
 * p.tl = 재능 별 6자리("342513"), p.tr = 초월 6자리, p.ms = 숙련 6칸. STAT_KEYS 순서. */
function aiEnsure(p) {
  if (p.tl) return;
  const w = roleW(p.r);
  p.tl = STAT_KEYS.map((k) => Math.min(5, rollTalent() + ((p.pot || 0) >= 7 && (w[k] || 0) >= .15 ? 1 : 0))).join("");
  p.tr = "000000"; p.ms = [0, 0, 0, 0, 0, 0];
}
const aiTal = (p, i) => +p.tl[i], aiTr = (p, i) => +(p.tr || "000000")[i];
const aiCap = (p, i) => 99 + aiTr(p, i) * 2;
function aiTalentStr(p, k) { aiEnsure(p); const i = STAT_KEYS.indexOf(k); return talentStr(k, aiTal(p, i), aiTr(p, i)); }
function aiAddMast(p, i, n) {
  aiEnsure(p);
  const out = [], k = STAT_KEYS[i], set = (s, v) => s.slice(0, i) + v + s.slice(i + 1);
  const tg = () => { if (!p.tg) p.tg = [0, 0, 0, 0, 0, 0]; return p.tg; };
  // 옛 저장: ★5 뒤에 쌓아 둔 숙련은 같은 비율만큼 초월 게이지로
  if (aiTal(p, i) >= 5 && p.ms[i] > 0) { if (aiTr(p, i) < 3) tg()[i] = Math.min(95, Math.round(tg()[i] + p.ms[i] / [30, 40, 50][aiTr(p, i)] * 100)); p.ms[i] = 0; }
  for (let u = 0; u < n; u++) {
    const tr = aiTr(p, i), cap = p.st[k] >= aiCap(p, i);
    if (aiTal(p, i) < 5) {
      if (++p.ms[i] >= MAST_NEED[aiTal(p, i)]) { p.ms[i] = 0; p.tl = set(p.tl, aiTal(p, i) + 1); if (aiTal(p, i) === 5) out.push("★5"); }
    } else if (tr < 3) {
      const g = tg();
      if (!cap) { g[i] = Math.min(100, Math.round((g[i] + trStep(tr) / 2) * 10) / 10); continue; }
      const ch = g[i] >= 100 ? 100 : TR_BASE[tr] + aiTal(p, i) + g[i] * .1;
      if (Math.random() * 100 < ch) { p.tr = set(p.tr, tr + 1); g[i] = 0; p.st[k] = Math.min(aiCap(p, i), p.st[k] + randi(1, 2)); out.push(TRANS_NAME[tr + 1]); }
      else g[i] = Math.min(100, Math.round((g[i] + trStep(tr)) * 10) / 10);
    }
  }
  return out;
}
/* 한 시즌 동안 쌓인 숙련 — 나와 같은 규칙: 프로 한 시즌 훈련 18번(포지션 가중치대로 고르고 10%는 아무 능력치) + MOM 1회당 주력 +2 */
function aiSeasonMast(p) {
  aiEnsure(p);
  const w = roleW(p.r), gain = [0, 0, 0, 0, 0, 0], hit = [];
  const ent = STAT_KEYS.map((k, i) => [i, w[k] || 0]).filter(([, x]) => x > 0), tot = ent.reduce((s, [, x]) => s + x, 0);
  for (let t = 0; t < ROUNDS; t++) {
    let i;
    if (Math.random() < .1) i = randi(0, 5);
    else { let r = Math.random() * tot; i = ent[ent.length - 1][0]; for (const [j, x] of ent) { if ((r -= x) <= 0) { i = j; break; } } }
    gain[i]++;
  }
  const main = ent.reduce((b, e) => e[1] > b[1] ? e : b, ent[0])[0];
  gain[main] += ((p.s && p.s.mom) || 0) * 2;
  gain.forEach((n, i) => { if (n) for (const t of aiAddMast(p, i, n)) hit.push(`${STAT_NAME[STAT_KEYS[i]]} ${t}`); });
  return hit;
}
const mastLine = (k, n) => { const o = addMast(k, n); return `${STAT_NAME[k]} Mastery +${n}${o.length ? " · " + o.map((x) => x.msg).join(" · ") : ""}`; };
/* 각성·초월이 생기면 크게 알려줘요 */
async function showAwake() {
  if (!S.awake || !S.awake.length) return;
  const list = S.awake.splice(0);
  const tr = list.some((x) => x.kind === "trans");
  (Sfx.levelup || Sfx.good)();
  await modal({ emoji: tr ? "🌌" : "🧬", title: tr ? "You broke through your limit!" : "Your talent awakened!",
    html: `${list.map((x) => `<p class="awake ${x.kind}">${x.msg}</p>`).join("")}<p class="small">${tr ? "Transcended stats can grow past 99 and decline less with age." : "More stars means faster growth from training. After ★5 comes Transcend."}</p>`,
    buttons: [{ label: "Nice!", value: 1, cls: "btn-primary" }] });
}
/* 재능 별 확률 (만들 때): ★1 20% · ★2 27% · ★3 27% · ★4 21% · ★5 5% */
function rollTalent() { const r = Math.random(); return r < .2 ? 1 : r < .47 ? 2 : r < .74 ? 3 : r < .95 ? 4 : 5; }
