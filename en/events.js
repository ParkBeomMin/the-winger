/* 더 윙어 2 - 선택형 이벤트
 * when(S): 나올 수 있나 / once: 커리어에 한 번 / cd: 다시 나오기까지 턴 수
 * choices[].fx(S) → 결과 문장 (S를 직접 바꿔요) */
"use strict";

const R = (S) => S.rival.name;
const mainStat = (S) => Object.entries(POS[S.pos].w).sort((a, b) => b[1] - a[1])[0][0];
const addStat = (S, k, v) => { S.stats[k] = clamp(S.stats[k] + v, 1, typeof statCap === "function" ? statCap(k) : 99); return `${STAT_NAME[k]} ${v > 0 ? "+" : ""}${v}`; };
const addRel = (S, v) => { S.rival.rel = clamp(S.rival.rel + v, -100, 100); return `Rivalry ${v > 0 ? "+" : ""}${v}`; };
const addFame = (S, v) => { S.fame = Math.max(0, S.fame + v); return `Fame ${v > 0 ? "+" : ""}${v}`; };
const addCond = (S, v) => { S.cond = clamp(S.cond + v, 0, 100); return `Condition ${v > 0 ? "+" : ""}${v}`; };
const addForm = (S, v) => { S.form = clamp(S.form + v, -3, 3); return `Form ${v > 0 ? "▲" : "▼"}`; };
const addMoney = (S, v) => { S.money = Math.max(0, S.money + v); return `💰 ${v > 0 ? "+" : ""}${fmtMoney(v)}`; };
const isPro = (S) => S.phase === "pro";

const abroadCost = (S) => Math.round(Math.max(200, (S.contract && S.phase === "pro" ? S.contract.sal : 30) * 10));
const EVENTS = [
  { id: "abroad", emoji: "✈️", title: "Short Training Abroad", cd: 22,
    when: (S) => S.turn > 8 && S.money >= abroadCost(S),
    text: (S) => `A top European academy offered you a special 2-week camp. It costs ${fmtMoney(abroadCost(S))}. It might wake up a hidden talent.`,
    choices: [
      { label: "🧬 Focus on main stat", hint: "💰 · Main Mastery +12", fx: (S) => { S.money -= abroadCost(S); return mastLine(mainStat(S), 12); } },
      { label: "🔀 Fix weak spots", hint: "💰 · Lowest key stat +3 · Mastery +8", fx: (S) => { const k = Object.entries(POS[S.pos].w).filter(([, w]) => w >= .1).sort((a, b) => S.stats[a[0]] - S.stats[b[0]])[0][0]; S.money -= abroadCost(S); return [addStat(S, k, 3), mastLine(k, 8)].join(" · "); } },
      { label: "🙅 Not this time", hint: "Condition↑", fx: (S) => addCond(S, 6) },
    ] },
  { id: "taunt", emoji: "📱", title: "Rival's Taunt", cd: 10,
    when: (S) => S.turn > 2,
    text: (S) => `${josa(R(S), "\uc774/\uac00")} posted on social media.\n"${S.name}? Still miles away from my level lol"`,
    choices: [
      { label: "🔥 Fire back", hint: "Fame↑ Form↑ Relation↓", fx: (S) => [addFame(S, 6), addForm(S, 1), addRel(S, -15)].join(" · ") },
      { label: "🤐 Let my play talk", hint: "Next training x1.6", fx: (S) => { S.buff = 1.6; return "Next training efficiency x1.6"; } },
      { label: "😄 Laugh it off", hint: "Relation↑", fx: (S) => [addRel(S, 12), addFame(S, 2)].join(" · ") },
    ] },
  { id: "night", emoji: "🌙", title: "Secret Night Training?", cd: 6,
    when: (S) => S.cond >= 25,
    text: (S) => `Everyone's asleep, but the training ground lights are still on.\nPractice some more ${STAT_NAME[mainStat(S)]}?`,
    choices: [
      { label: "💪 Do it", hint: "Main stat↑ Condition↓", fx: (S) => [addStat(S, mainStat(S), 3), addCond(S, -16)].join(" · ") },
      { label: "😴 Sleep well", hint: "Condition↑", fx: (S) => addCond(S, 12) },
    ] },
  { id: "coachpos", emoji: "🧑‍🏫", title: "Coach's Position Test", once: true,
    when: (S) => S.phase === "youth" && S.pos !== "df" && S.turn > 4,
    text: () => `"Want to play in the back line in today's scrimmage? It'll widen your vision."`,
    choices: [
      { label: "🙆 I'll try", hint: "Defense·Stamina↑", fx: (S) => [addStat(S, "def", 4), addStat(S, "sta", 2)].join(" · ") },
      { label: "🙅 I'll stay in my spot", hint: "Main stat↑ Form↓", fx: (S) => [addStat(S, mainStat(S), 2), addForm(S, -1)].join(" · ") },
    ] },
  { id: "party", emoji: "🎉", title: "Party Invite", cd: 12,
    when: (S) => S.phase === "youth",
    text: (S) => `Your Youth teammates are throwing a weekend party. Rumor says ${R(S)} is coming too…`,
    choices: [
      { label: "🕺 Go", hint: "Form↑ Relation↑ Condition↓", fx: (S) => [addForm(S, 1), addRel(S, 8), addCond(S, -10)].join(" · ") },
      { label: "🏠 Rest", hint: "Condition↑ Next training x1.2", fx: (S) => { S.buff = Math.max(S.buff, 1.2); return addCond(S, 6) + " · Next training x1.2"; } },
    ] },
  { id: "mom", emoji: "📞", title: "Call from Mom", cd: 14,
    when: (S) => S.cond < 70,
    text: () => `"Are you eating well? It's been too long since I saw your face…"`,
    choices: [
      { label: "🏡 Visit home", hint: "Condition big↑ Form↑", fx: (S) => [addCond(S, 25), addForm(S, 1)].join(" · ") },
      { label: "📱 Just a video call", hint: "Condition↑", fx: (S) => addCond(S, 8) },
    ] },
  { id: "scout", emoji: "🕵️", title: "A Scout Is Watching", cd: 8,
    when: (S) => S.phase === "youth" && S.year >= 2,
    text: () => `There's a scout from a foreign club in the stands at today's scrimmage.`,
    choices: [
      { label: "✨ Skill show", hint: "Gamble: Fame big↑ or↓", fx: (S) => Math.random() < .5 + (S.stats.dri - 50) / 150 ? "Huge success! " + addFame(S, 14) : "Lost the ball… " + addFame(S, -5) },
      { label: "🤝 Team play", hint: "Fame↑ Passing↑", fx: (S) => [addFame(S, 5), addStat(S, "pas", 2)].join(" · ") },
    ] },
  { id: "together", emoji: "🤝", title: "Rival's Offer", cd: 10,
    when: (S) => S.rival.rel >= 5,
    text: (S) => `${R(S)}: "…Hey. Wanna train together after this? Going against you helps me improve the most."`,
    choices: [
      { label: "👊 Sure", hint: "Two weak stats↑ Relation↑ (Rival grows too)", fx: (S) => {
        const low = STAT_KEYS.filter((k) => POS[S.pos].w[k] > 0).sort((a, b) => S.stats[a] - S.stats[b]).slice(0, 2);
        low.forEach((k) => { S.stats[k] = clamp(S.stats[k] + 3, 1, statCap(k)); });
        S.rival.stats[mainStatOf(S.rival.pos)] += 2;
        return `${low.map((k) => STAT_NAME[k]).join("·")} +3 · ` + addRel(S, 10);
      } },
      { label: "🙅 I'll go solo", hint: "Next training x1.4 Relation↓", fx: (S) => { S.buff = 1.4; return "Next training x1.4 · " + addRel(S, -6); } },
    ] },
  { id: "knee", emoji: "🦵", title: "Sore Knee", cd: 6,
    when: (S) => S.cond < 40,
    text: () => `You felt a sharp twinge in your knee during training. The trainer says to rest…`,
    choices: [
      { label: "🧊 Rest", hint: "Condition↑ Safe", fx: (S) => addCond(S, 22) },
      { label: "😤 Play through it", hint: "Gamble: Injury risk", fx: (S) => {
        if (Math.random() < .45) { S.injured = 1; return "Injured after all… out 1 turn"; }
        return "Held up! " + addStat(S, mainStat(S), 2);
      } },
    ] },
  { id: "mentor", emoji: "🧓", title: "Legend's One-Point Lesson", cd: 18,
    when: (S) => S.money >= 120,
    text: () => `A retired legend offered you a private lesson. The fee is ₩1.2M.`,
    choices: [
      { label: "🙇 Accept (₩1.2M)", hint: "Main stat big↑ Mastery↑", fx: (S) => [addMoney(S, -120), addStat(S, mainStat(S), 5), mastLine(mainStat(S), 5)].join(" · ") },
      { label: "🙏 Decline", hint: "", fx: () => "Maybe next time…" },
    ] },
  { id: "youtube", emoji: "🎬", title: "YouTuber Collab Offer", cd: 12,
    when: (S) => S.fame >= 20,
    text: () => `A football YouTuber with 800K subscribers wants to film a challenge video with you.`,
    choices: [
      { label: "📸 Film it", hint: "Fame↑ 💰↑ Condition↓", fx: (S) => [addFame(S, 10), addMoney(S, 30), addCond(S, -8)].join(" · ") },
      { label: "⚽ Focus on training", hint: "Next training x1.3", fx: (S) => { S.buff = Math.max(S.buff, 1.3); return "Next training x1.3"; } },
    ] },
  { id: "agent", emoji: "💼", title: "An Agent Approaches", once: true,
    when: (S) => isPro(S) || (S.year === 3 && S.month >= 6),
    text: () => `A well-known agent hands you a business card.\n"My fee is 10% of your salary. In return, I'll bring you better offers."`,
    choices: [
      { label: "✍️ Sign", hint: "Transfer offers↑ Salary talks↑", fx: (S) => { S.gear.agent = Math.max(S.gear.agent || 0, 1); return "Agent signed! More transfer offers incoming"; } },
      { label: "🙅 Go solo", hint: "", fx: () => "I'll manage my own Career" },
    ] },
  { id: "ad", emoji: "📺", title: "Ad Shoot Offer", cd: 9,
    when: (S) => isPro(S) && S.fame >= 40,
    text: () => `You got an offer to model for a sports drink ad. The shoot takes a full day.`,
    choices: [
      { label: "🎥 Shoot it", hint: "💰 big↑ Fame↑ Condition↓", fx: (S) => [addMoney(S, 60 * LEAGUES[S.pro.league].prestige), addFame(S, 8), addCond(S, -12)].join(" · ") },
      { label: "🙅 Decline", hint: "Form↑", fx: (S) => addForm(S, 1) },
    ] },
  { id: "bench", emoji: "🪑", title: "Playing Time Issue", cd: 4,
    when: (S) => isPro(S) && S.pro.lastBench,
    text: () => `On the Bench again. You're standing at the coach's office door.`,
    choices: [
      { label: "🗣️ Confront", hint: "Gamble: Start next match or Fame↓", fx: (S) => {
        if (Math.random() < .3 + ((S.trust ?? 50) - 50) / 100) { S.flags.forceStart = true; return "Coach: \"Fine, you start next match. Prove it.\""; }
        return "The coach's face hardened… " + [addFame(S, -5), addForm(S, -1), addTrust(-8)].filter(Boolean).join(" · ");
      } },
      { label: "🏋️ Train quietly", hint: "Next training x1.4", fx: (S) => { S.buff = 1.4; return "Next training x1.4"; } },
    ] },
  { id: "interview", emoji: "🎤", title: "Post-match Interview", cd: 6,
    when: (S) => isPro(S) && S.pro.round > 0,
    text: (S) => `Reporter: "You're often compared with ${R(S)}. Any comment?"`,
    choices: [
      { label: "🙇 Stay humble", hint: "Fame↑ Relation↑", fx: (S) => [addFame(S, 3), addRel(S, 6)].join(" · ") },
      { label: "😎 Be confident", hint: "Fame↑ Form↑", fx: (S) => [addFame(S, 6), addForm(S, 1)].join(" · ") },
      { label: "🔥 Call out Rival", hint: "Fame big↑ Relation big↓", fx: (S) => [addFame(S, 12), addRel(S, -18)].join(" · ") },
    ] },
  { id: "rivalhurt_old", emoji: "🏥", title: "Rival Injured", cd: 30,
    when: () => false,
    text: (S) => `${josa(R(S), "\uc774/\uac00")} was carried off with an ankle Injury. Expected out for a few weeks.`,
    choices: [
      { label: "💐 Visit", hint: "Relation big↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 20); } },
      { label: "💬 Just a message", hint: "Relation↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 8); } },
      { label: "😶 Ignore it", hint: "Next training x1.3 Relation↓", fx: (S) => { S.rival.hurt = 2; S.buff = 1.3; return "Next training x1.3 · " + addRel(S, -8); } },
    ] },
  { id: "national_old", emoji: "🇰🇷", title: "National Team Call-up!", cd: 9,
    when: () => false,
    text: () => `It's the international match break, and you made the national team squad!`,
    choices: [
      { label: "🫡 Answer the call", hint: "Fame big↑ Form↑ Condition↓", fx: (S) => { S.career.caps = (S.career.caps || 0) + 1; return [addFame(S, 15), addForm(S, 1), addCond(S, -15)].join(" · ") + ` · ${S.career.caps} international caps`; } },
      { label: "🩹 Focus on club", hint: "Condition↑", fx: (S) => addCond(S, 12) },
    ] },
  { id: "no10", emoji: "🔟", title: "No. 10 Shirt Offer", once: true,
    when: (S) => isPro(S) && S.fame >= 80 && S.look.number !== 10,
    text: () => `The club wants you to wear the iconic No. 10. Big expectations, big pressure.`,
    choices: [
      { label: "🔟 Take it", hint: "Fame big↑", fx: (S) => { S.look.number = 10; return "You're the No. 10 now! " + addFame(S, 12); } },
      { label: "🙂 Keep my number", hint: "Form↑", fx: (S) => addForm(S, 1) },
    ] },
  { id: "boots", emoji: "👟", title: "Boot Sponsor Deal", once: true,
    when: (S) => isPro(S) && S.fame >= 30,
    text: () => `A sports brand offered you a boot sponsorship. Which line will you pick?`,
    choices: [
      { label: "⚡ Speed line", hint: "Speed +3", fx: (S) => addStat(S, "spd", 3) },
      { label: "💥 Power line", hint: "Shooting +3", fx: (S) => addStat(S, "sho", 3) },
      { label: "🎯 Control line", hint: "Passing·Dribbling +2", fx: (S) => [addStat(S, "pas", 2), addStat(S, "dri", 2)].join(" · ") },
    ] },
  { id: "fan", emoji: "✉️", title: "Letter from a Young Fan", cd: 15,
    when: (S) => S.fame >= 15,
    text: (S) => `"I want to be like ${S.name}! I'm a ${POS[S.pos].name} too!"`,
    choices: [
      { label: "📹 Video reply", hint: "Fame↑ Form↑", fx: (S) => [addFame(S, 4), addForm(S, 1)].join(" · ") },
      { label: "✍️ Send signed ball", hint: "Form↑", fx: (S) => addForm(S, 1) },
    ] },
];

function mainStatOf(pos) { return Object.entries(POS[pos].w).sort((a, b) => b[1] - a[1])[0][0]; }

function pickEvent(S) {
  const ok = EVENTS.filter((e) => {
    const seen = S.ev[e.id];
    if (e.once && seen != null) return false;
    if (seen != null && S.turn - seen < (e.cd || 8)) return false;
    try { return e.when(S); } catch { return false; }
  });
  return ok.length ? pick(ok) : null;
}

/* ---------- 실제 세계에서 일어난 일에 반응하는 이벤트 (신호 → 이벤트) ----------
 * game.js·world.js가 S.sig에 { k, d }를 넣으면, 다음 턴에 우선해서 떠요. */
const tr = (S, v) => addTrust(v) || "Coach trust unchanged";
const SIG_EVENTS = {
  hattrick: { emoji: "🎩", title: "Hat-trick Ball", text: (S, d) => `Hat-trick vs ${d.opp || "the opponent"}! The referee handed you the match ball. What will you do?`,
    choices: [
      { label: "👪 Give to family", hint: "Form↑ Condition↑", fx: (S) => [addForm(S, 1), addCond(S, 10)].join(" · ") },
      { label: "✍️ Fan event prize", hint: "Fame big↑", fx: (S) => addFame(S, 20) },
      { label: "🏛️ Donate to club museum", hint: "Coach trust↑ Fame↑", fx: (S) => [tr(S, 6), addFame(S, 8)].join(" · ") },
    ] },
  superb: { emoji: "📰", title: "Media Praise", text: (S, d) => `Rating ${d.r}! Headlines everywhere: "${S.name} was the star of the day"`,
    choices: [
      { label: "🙇 Thanks to the team", hint: "Coach trust↑ Fame↑", fx: (S) => [tr(S, 4), addFame(S, 5)].join(" · ") },
      { label: "😎 This is just the start", hint: "Fame big↑ Form↑", fx: (S) => [addFame(S, 12), addForm(S, 1)].join(" · ") },
    ] },
  awful: { emoji: "😞", title: "After a Terrible Match", text: (S, d) => `Rating ${d.r}. The coach didn't say a word in the locker room.`,
    choices: [
      { label: "🙇 Apologize first", hint: "Coach trust↑", fx: (S) => tr(S, 5) },
      { label: "🎞️ All-night video study", hint: "Next training x1.5 Condition↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "Next training x1.5 · " + addCond(S, -10); } },
      { label: "🧘 Shake it off", hint: "Form↑", fx: (S) => addForm(S, 1) },
    ] },
  redcard: { emoji: "🟥", title: "Red Card Fallout", text: () => `Your sending-off keeps replaying in the highlights. Reporters want a statement.`,
    choices: [
      { label: "🙇 Public apology", hint: "Coach trust↑ Fame↑", fx: (S) => [tr(S, 5), addFame(S, 3)].join(" · ") },
      { label: "📢 Protest the call", hint: "Fame↑ Coach trust↓", fx: (S) => [addFame(S, 6), tr(S, -8)].join(" · ") },
      { label: "🤐 Reflect quietly", hint: "Next training x1.3", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.3); return "Next training x1.3 · " + tr(S, 2); } },
    ] },
  matchinjury: { emoji: "🚑", title: "Rehab Plan", text: (S) => `You're out for ${S.injured} games with an Injury. The medical team asks how you want to rehab.`,
    choices: [
      { label: "🛌 Rest fully", hint: "Condition big↑", fx: (S) => addCond(S, 20) },
      { label: "⚡ Early return", hint: "Out -1 · 30% relapse", fx: (S) => { if (Math.random() < .3) { S.injured += 2; return "Pushed too hard and relapsed… Out +2"; } S.injured = Math.max(0, S.injured - 1); return "Early return worked! Out -1"; } },
      { label: "🏥 Specialist clinic abroad", hint: "💰 8 match fees · Out -1", fx: (S) => { const c = Math.round(payRef() * 8); if (S.money < c) return "Not enough money, so you just rested · " + addCond(S, 10); S.money -= c; S.injured = Math.max(0, S.injured - 1); return `💰 -${fmtMoney(c)} · Out -1`; } },
    ] },
  losing3: { emoji: "🌧️", title: "3 Losses in a Row, Grim Locker Room", text: (S) => `${S.pro.club} lost 3 games in a row. Everyone's heads are down.`,
    choices: [
      { label: "🗣️ Call a team meeting", hint: "Coach trust↑ · Gamble: Form", fx: (S) => [tr(S, 6), Math.random() < .55 ? "Turned it around! " + addForm(S, 1) : "Your words fell flat " + addForm(S, -1)].join(" · ") },
      { label: "🏋️ Focus on solo training", hint: "Next training x1.4", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "Next training x1.4"; } },
      { label: "📵 Take a social media break", hint: "Condition↑", fx: (S) => addCond(S, 8) },
    ] },
  winning4: { emoji: "🔥", title: "4-Game Win Streak", text: (S) => `${S.pro.club} won 4 in a row! Teammates want a team dinner.`,
    choices: [
      { label: "🍖 Join the dinner", hint: "Form↑ Condition↓", fx: (S) => [addForm(S, 1), addCond(S, -8)].join(" · ") },
      { label: "🧊 Stay grounded", hint: "Coach trust↑", fx: (S) => tr(S, 4) },
    ] },
  newcoach: { emoji: "👔", title: "New Coach Arrives", text: (S, d) => `${d.n} is the new coach of ${S.pro.club}. ${d.f} · ${STYLES[d.s].name} football. You'll have to build trust from scratch.`,
    choices: [
      { label: "🤝 Go say hello first", hint: "Coach trust big↑", fx: (S) => tr(S, 10) },
      { label: "📋 Study tactics", hint: "Coach trust↑ Passing↑", fx: (S) => [tr(S, 5), addStat(S, "pas", 1)].join(" · ") },
      { label: "⚽ Let my play talk", hint: "Next training x1.5", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "Next training x1.5"; } },
    ] },
  newclub: { emoji: "🧳", title: "Settling In", text: (S) => `First week at ${S.pro.club}. New locker room, new tactics.`,
    choices: [
      { label: "🍻 Join team dinner", hint: "Form↑ Condition↓", fx: (S) => [addForm(S, 1), addCond(S, -8)].join(" · ") },
      { label: "📚 Study language & tactics", hint: "Coach trust↑", fx: (S) => tr(S, 7) },
      { label: "📹 Hello video for home fans", hint: "Fame↑", fx: (S) => addFame(S, 10) },
    ] },
  cupfinal: { emoji: "🏆", title: "Night Before the Final", text: (S, d) => `${S.pro.club} made the ${d.cup} Final! You can't sleep before the big game.`,
    choices: [
      { label: "😴 Sleep early", hint: "Condition big↑", fx: (S) => addCond(S, 20) },
      { label: "🎞️ Study opponent footage", hint: "Form↑", fx: (S) => addForm(S, 1) },
      { label: "👪 Invite family to the stadium", hint: "Form↑ Fame↑", fx: (S) => [addForm(S, 1), addFame(S, 5)].join(" · ") },
    ] },
  titlerace: { emoji: "🥇", title: "Title Race", text: (S, d) => `#${d.rank} in the league, ${d.gap} pts behind the leader! Every game left is a Final.`,
    choices: [
      { label: "🎤 Hype it up in interviews", hint: "Fame↑ Coach trust↑", fx: (S) => [addFame(S, 8), tr(S, 2)].join(" · ") },
      { label: "🧊 One game at a time", hint: "Condition↑", fx: (S) => addCond(S, 12) },
    ] },
  rivalhurt: { emoji: "🏥", title: "Rival Injured", text: (S, d) => `${josa(R(S), "\uc774/\uac00")} was carried off injured. Out for ${d.n} games.`,
    choices: [
      { label: "💐 Visit", hint: "Relation big↑", fx: (S) => addRel(S, 20) },
      { label: "💬 Just a message", hint: "Relation↑", fx: (S) => addRel(S, 8) },
      { label: "😶 Ignore it", hint: "Next training x1.3 Relation↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.3); return "Next training x1.3 · " + addRel(S, -8); } },
    ] },
  rivalmate: { emoji: "🤝", title: "Rival Teammate", text: (S) => `This season you wear the same shirt as ${josa(R(S), "\uacfc/\uc640")}. You ran into each other at training.`,
    choices: [
      { label: "🤝 Offer a handshake", hint: "Relation big↑", fx: (S) => addRel(S, 15) },
      { label: "🔥 Declare starting battle", hint: "Next training x1.4 Relation↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "Next training x1.4 · " + addRel(S, -10); } },
    ] },
  rivalhattrick: { emoji: "😤", title: "Rival's Hat-trick", text: (S, d) => `Breaking: ${R(S)} scores a hat-trick for ${d.club}! The highlights are everywhere.`,
    choices: [
      { label: "👏 Send congrats", hint: "Relation↑", fx: (S) => addRel(S, 8) },
      { label: "🔥 Train fired up", hint: "Next training x1.5", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "Next training x1.5"; } },
    ] },
  benched3: { emoji: "🪑", title: "3rd Game on the Bench", text: () => `Third straight game on the Bench. At this rate, your growth will stall.`,
    choices: [
      { label: "🗣️ Talk to the coach", hint: "Start next match based on trust", fx: (S) => { if (Math.random() < .35 + ((S.trust ?? 50) - 50) / 80) { S.flags.forceStart = true; return "Coach: \"I'll give you a shot next match.\" · " + tr(S, 2); } return "Coach: \"Not yet.\" · " + tr(S, -3); } },
      { label: "📤 Request a transfer", hint: "More offers at season end · Coach trust big↓", fx: (S) => { S.flags.wantMove = true; return "Your agent is on the move · " + tr(S, -12); } },
      { label: "🏋️ Train quietly", hint: "Next training x1.4 · Trust↑", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "Next training x1.4 · " + tr(S, 3); } },
    ] },
  contractlast: { emoji: "✍️", title: "Final contract season", text: (S) => `Your contract with ${S.pro.club} ends this season. The club is sounding you out.`,
    choices: [
      { label: "🤝 Say you want to stay", hint: "Coach trust↑ · Better renewal", fx: (S) => { S.flags.renewWill = true; return tr(S, 5); } },
      { label: "🌍 Test the market", hint: "More offers at season end · Trust↓", fx: (S) => { S.flags.wantMove = true; return "Your agent contacted other clubs · " + tr(S, -5); } },
    ] },
  national: { emoji: "🇰🇷", title: "International call-up!", text: (S, d) => `You made the South Korea squad! (${d.xi ? "Starter" : "Sub list"}) Opponent: ${NATIONS[d.opp].flag} ${NATIONS[d.opp].name}.`,
    choices: [
      { label: "🫡 Answer the call", hint: "Play international match · Fame↑ · Condition↓", fx: (S) => aMatch(S, S._d) },
      { label: "🩹 Decline (injury care)", hint: "Condition↑ · Coach trust↑", fx: (S) => [addCond(S, 10), tr(S, 2)].join(" · ") },
    ] },
  wcdropped: { emoji: "📋", title: "Left out of World Cup squad", text: () => `You're not on the final World Cup squad. The next one is 4 years away.`,
    choices: [
      { label: "😤 Grit your teeth", hint: "Next training x1.5", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "Next training x1.5"; } },
      { label: "🏟️ Focus on my club", hint: "Coach trust↑", fx: (S) => tr(S, 4) },
    ] },
  transferblocked: { emoji: "⛔", title: "The club blocked the transfer", text: (S, d) => `You accepted ${d.club}'s offer, but ${S.pro.club} refused the transfer.`,
    choices: [
      { label: "🤝 Accept it", hint: "Coach trust↑", fx: (S) => tr(S, 5) },
      { label: "📢 Complain publicly", hint: "Fame↑ Trust big↓ · Better odds of release next time", fx: (S) => { S.flags.wantMove = true; return [addFame(S, 5), tr(S, -15)].join(" · "); } },
    ] },
};
function pushSig(k, d = {}) {
  if (!S.sig) S.sig = [];
  if (S.sig.some((x) => x.k === k)) return;
  S.sig.push({ k, d, t: S.turn });
  if (S.sig.length > 4) S.sig.shift();
}
