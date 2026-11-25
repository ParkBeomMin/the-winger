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
/* 상황 도우미: 해외에서 뛰는 중인지 · 지금 팀에서 끝낸 시즌 수 */
const abroadNow = (S) => isPro(S) && LEAGUES[S.pro.league] && ORIGINS[S.origin] && LEAGUES[S.pro.league].nat !== ORIGINS[S.origin].nat;
const clubSeasons = (S) => { let n = 0; const ss = (S.career && S.career.seasons) || []; for (let i = ss.length - 1; i >= 0 && ss[i].club === S.pro.club; i--) n++; return n; };

const abroadCost = (S) => Math.round(Math.max(200, (S.contract && S.phase === "pro" ? S.contract.sal : 30) * 10));
const EVENTS = [
  { id: "abroad", emoji: "✈️", title: "Short Training Abroad", cd: 22,
    when: (S) => S.turn > 8 && S.money >= abroadCost(S) && (S.phase === "youth" || S.age <= 24),
    text: (S) => `A top European academy offered you a special 2-week camp. It costs ${fmtMoney(abroadCost(S))}. It might wake up a hidden talent.`,
    choices: [
      { label: "🧬 Focus on main stat", hint: "💰 · Main Mastery +12", fx: (S) => { S.money -= abroadCost(S); return mastLine(mainStat(S), 12); } },
      { label: "🔀 Fix weak spots", hint: "💰 · Lowest key stat +3 · Mastery +8", fx: (S) => { const k = Object.entries(POS[S.pos].w).filter(([, w]) => w >= .1).sort((a, b) => S.stats[a[0]] - S.stats[b[0]])[0][0]; S.money -= abroadCost(S); return [addStat(S, k, 3), mastLine(k, 8)].join(" · "); } },
      { label: "🙅 Not this time", hint: "Condition↑", fx: (S) => addCond(S, 6) },
    ] },
  { id: "taunt", emoji: "📱", title: "Rival's Taunt", cd: 10,
    when: (S) => S.turn > 2,
    text: (S) => { const gap = (typeof OVR === "function" && typeof ROVR === "function") ? OVR() - ROVR() : 0, mate = isPro(S) && S.rival.club === S.pro.club;
      if (mate) return T(`${josa(R(S), "이/가")} 단체 사진에 혼자 가운데 서서 글을 올렸어요.\n"이 팀 에이스는 누구? ㅋ"`, `${R(S)} posted a team photo, standing alone in the middle.\n"Guess who the ace is? lol"`);
      if (gap >= 4) return T(`${josa(R(S), "이/가")} SNS에 글을 올렸어요.\n"요즘 좀 한다고? 한 시즌 반짝이겠지 ㅋ"`, `${R(S)} posted on social.\n"Doing well lately? Just a one-season wonder lol"`);
      return `${josa(R(S), "\uc774/\uac00")} posted on social media.\n"${S.name}? Still miles away from my level lol"`; },
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
    text: (S) => { const st = (S.pro && S.pro.streak) || 0; if (st >= 3) return T(`기자: "${st}연승 중인데요, 비결이 뭔가요? ${R(S)} 선수와의 비교도 한 말씀 해주시죠."`, `Reporter: "${st} wins in a row. What's the secret? And a word on comparisons with ${R(S)}?"`); if (st <= -2) return T(`기자: "팀이 ${-st}연패인데요, 분위기 어떤가요? ${R(S)} 선수는 잘나가던데요."`, `Reporter: "${-st} straight defeats. How's the mood? ${R(S)} seems to be flying."`); return `Reporter: "You're often compared with ${R(S)}. Any comment?"`; },
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
  /* ---------- 상황 맞춤 이벤트 (v2.5): 나이 · 해외 생활 · 팀 순위 · 폼 · 감독 신뢰 · 다음 상대 · 돈 ---------- */
  { id: "homesick", emoji: "🏠", title: T("해외 생활 향수병", "Homesick abroad"), cd: 16,
    when: (S) => abroadNow(S) && clubSeasons(S) <= 1 && S.pro.round >= 3 && S.flags.hsClub !== S.pro.club,   // 팀마다 한 번
    text: (S) => (S.flags.hsClub = S.pro.club, T(`${LEAGUES[S.pro.league].flag} 타지 생활 몇 주째. 밤마다 고향 음식이 생각나고, 혼자 먹는 저녁이 길게 느껴져요.`, `A few weeks into life in ${LEAGUES[S.pro.league].flag}. You miss food from home, and dinners alone feel long.`)),
    choices: [
      { label: T("✈️ 가족을 초대한다", "✈️ Fly the family over"), hint: T("💰 · 컨디션↑ 폼↑", "💰 · Cond↑ Form↑"), fx: (S) => [addMoney(S, -Math.max(80, Math.round((S.contract ? S.contract.sal : 50) * 2))), addCond(S, 14), addForm(S, 1)].join(" · ") },
      { label: T("🍜 동네 한식당 단골 되기", "🍜 Find a local spot from home"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 8) },
      { label: T("📘 현지어 공부를 시작한다", "📘 Start learning the language"), hint: T("감독 신뢰↑", "Coach trust↑"), fx: (S) => tr(S, 6) },
    ] },
  { id: "language", emoji: "🗣️", title: T("통역 없는 전술 미팅", "Tactics meeting, no interpreter"), cd: 40,
    when: (S) => abroadNow(S) && clubSeasons(S) === 0 && S.pro.round >= 1 && S.pro.round <= 8 && S.flags.lgClub !== S.pro.club,
    text: (S) => (S.flags.lgClub = S.pro.club, T("감독이 빠르게 전술판을 짚어 가며 설명해요. 절반은 알아듣고 절반은 감으로…", "The coach races through the tactics board. You catch half of it and guess the rest…")),
    choices: [
      { label: T("🙋 끝나고 따로 물어본다", "🙋 Ask afterwards"), hint: T("감독 신뢰↑", "Coach trust↑"), fx: (S) => tr(S, 5) },
      { label: T("👀 동료 움직임을 보고 따라 한다", "👀 Copy your teammates"), hint: T("폼↑", "Form↑"), fx: (S) => addForm(S, 1) },
      { label: T("😅 대충 고개만 끄덕인다", "😅 Just nod along"), hint: T("감독 신뢰↓", "Coach trust↓"), fx: (S) => tr(S, -4) },
    ] },
  { id: "captain", emoji: "©️", title: T("주장 완장 제안", "The captain's armband"), once: true,
    when: (S) => isPro(S) && S.age >= 26 && (S.trust || 0) >= 75 && S.fame >= 120 && clubSeasons(S) >= 2,
    text: (S) => T(`${S.pro.club} 감독이 불렀어요. "이번 시즌부터 주장을 맡아 줬으면 한다."`, `The ${S.pro.club} coach calls you in. "I want you to be captain from this season."`),
    choices: [
      { label: T("©️ 영광입니다", "©️ It's an honour"), hint: T("명성 크게↑ 감독 신뢰↑", "Fame↑↑ Trust↑"), fx: (S) => [addFame(S, 25), tr(S, 8)].join(" · ") },
      { label: T("🙏 아직은 실력에 집중할게요", "🙏 I'd rather focus on my game"), hint: T("다음 훈련 1.6배", "Next training x1.6"), fx: (S) => { S.buff = 1.6; return T("다음 훈련 효율 1.6배", "Next training x1.6"); } },
    ] },
  { id: "veteran", emoji: "🧓", title: T("은퇴 시기를 묻는 기자", "When will you retire?"), cd: 20,
    when: (S) => isPro(S) && S.age >= 32,
    text: (S) => T(`기자: "${S.age}세인데요, 은퇴 시기를 생각해 보셨나요?"`, `Reporter: "You're ${S.age} now. Have you thought about retiring?"`),
    choices: [
      { label: T("🔥 아직 보여줄 게 많아요", "🔥 I've got plenty left"), hint: T("폼↑ 명성↑", "Form↑ Fame↑"), fx: (S) => [addForm(S, 1), addFame(S, 5)].join(" · ") },
      { label: T("🙂 몸이 허락할 때까지", "🙂 As long as my body allows"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 10) },
      { label: T("🌱 후배들에게 길을 열어 줘야죠", "🌱 Time to make way for the kids"), hint: T("감독 신뢰↑ 명성↑", "Trust↑ Fame↑"), fx: (S) => [tr(S, 5), addFame(S, 4)].join(" · ") },
    ] },
  { id: "rookie", emoji: "🐣", title: T("신인 후배의 부탁", "A rookie asks for help"), cd: 18,
    when: (S) => isPro(S) && S.age >= 27,
    text: (S) => T(`팀에 새로 온 열여덟 살 신인이 다가와요. "선배님처럼 ${STAT_NAME[mainStat(S)]} 잘하고 싶어요. 훈련 끝나고 봐 주실 수 있나요?"`, `An 18-year-old rookie comes over. "I want to be as good at ${STAT_NAME[mainStat(S)]} as you. Could you help me after training?"`),
    choices: [
      { label: T("🤝 같이 남아서 훈련", "🤝 Stay and train together"), hint: T("감독 신뢰↑ 명성↑ 컨디션↓", "Trust↑ Fame↑ Cond↓"), fx: (S) => [tr(S, 5), addFame(S, 4), addCond(S, -8)].join(" · ") },
      { label: T("🗒️ 요점만 짧게 알려 준다", "🗒️ Give a few quick tips"), hint: T("감독 신뢰↑", "Trust↑"), fx: (S) => tr(S, 2) },
      { label: T("🙅 내 훈련도 바빠", "🙅 I'm busy with my own"), hint: T("다음 훈련 1.3배", "Next training x1.3"), fx: (S) => { S.buff = 1.3; return T("다음 훈련 효율 1.3배", "Next training x1.3"); } },
    ] },
  { id: "relegation", emoji: "😰", title: T("강등권 위기", "Relegation scrap"), cd: 6,
    when: (S) => isPro(S) && S.pro.round >= 8 && myRank() >= sortedTable().length - 2,
    text: (S) => T(`${S.pro.club}는 리그 ${myRank()}위. 라커룸 공기가 무거워요. 남은 경기에 팀의 운명이 걸렸어요.`, `${S.pro.club} sit ${myRank()}th. The dressing room is tense. The club's fate rides on the remaining games.`),
    choices: [
      { label: T("📣 동료들을 모아 다독인다", "📣 Rally the squad"), hint: T("감독 신뢰↑ 폼↑", "Trust↑ Form↑"), fx: (S) => [tr(S, 6), addForm(S, 1)].join(" · ") },
      { label: T("💪 말보다 훈련으로", "💪 Let training do the talking"), hint: T("다음 훈련 1.6배", "Next training x1.6"), fx: (S) => { S.buff = 1.6; return T("다음 훈련 효율 1.6배", "Next training x1.6"); } },
      { label: T("📞 에이전트에게 이적 문의", "📞 Ask your agent about a move"), hint: T("감독 신뢰↓ 이적 의향", "Trust↓ Wants a move"), fx: (S) => { S.flags.wantMove = 1; return [tr(S, -8), T("이적 시장에서 제안이 조금 더 와요", "A few more offers next window")].join(" · "); } },
    ] },
  { id: "derbyeve", emoji: "⚔️", title: T("라이벌 팀과의 맞대결 전야", "Eve of the rival showdown"), cd: 5,
    when: (S) => isPro(S) && S.rival.club !== S.pro.club && S.pro.schedule && S.pro.schedule[S.pro.round] === S.rival.club,
    text: (S) => T(`다음 경기 상대는 ${S.rival.club}. ${josa(R(S), "이/가")} 기자회견에서 "이번엔 확실히 이긴다"고 했대요.`, `Next up: ${S.rival.club}. ${R(S)} told the press, "This time we win for sure."`),
    choices: [
      { label: T("🎯 상대 영상을 분석한다", "🎯 Study their tapes"), hint: T("폼↑ 감독 신뢰↑", "Form↑ Trust↑"), fx: (S) => [addForm(S, 1), tr(S, 3)].join(" · ") },
      { label: T("🔥 SNS로 맞받아친다", "🔥 Fire back on social"), hint: T("명성↑ 관계↓", "Fame↑ Rivalry↓"), fx: (S) => [addFame(S, 8), addRel(S, -12)].join(" · ") },
      { label: T("😴 평소처럼 푹 잔다", "😴 Sleep like usual"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 12) },
    ] },
  { id: "slump", emoji: "📉", title: T("슬럼프", "In a slump"), cd: 8,
    when: (S) => S.form <= -2 && S.turn > 4,
    text: () => T("최근 경기가 잘 안 풀려요. 공이 발에 안 붙고, 자꾸 생각이 많아져요.", "Nothing's clicking lately. The ball won't stick, and you're overthinking everything."),
    choices: [
      { label: T("🎬 내 경기 영상을 돌려 본다", "🎬 Rewatch your games"), hint: T("폼↑", "Form↑"), fx: (S) => addForm(S, 1) },
      { label: T("🧘 하루 푹 쉬며 머리를 비운다", "🧘 Take a full day off"), hint: T("컨디션↑ 폼↑", "Cond↑ Form↑"), fx: (S) => [addCond(S, 15), addForm(S, 1)].join(" · ") },
      { label: T("🏃 기본기 훈련을 두 배로", "🏃 Double the basics"), hint: T("주력 스탯↑ 컨디션↓", "Main stat↑ Cond↓"), fx: (S) => [addStat(S, mainStat(S), 2), addCond(S, -12)].join(" · ") },
    ] },
  { id: "rumor", emoji: "📰", title: T("빅클럽 이적설", "Big-club transfer rumours"), cd: 14,
    when: (S) => isPro(S) && S.form >= 2 && OVR() >= clubStr(S.pro.league, S.pro.club) + 6,
    text: (S) => T(`"${S.name}, 빅클럽들이 주목" 기사가 떴어요. ${S.pro.club} 팬들이 술렁여요.`, `"${S.name} on big clubs' radar," says the headline. ${S.pro.club} fans are restless.`),
    choices: [
      { label: T("🏟️ \"지금 팀에 집중할게요\"", "🏟️ \"I'm focused on this club\""), hint: T("감독 신뢰↑ 명성↑", "Trust↑ Fame↑"), fx: (S) => [tr(S, 6), addFame(S, 4)].join(" · ") },
      { label: T("😏 \"제안이 오면 생각해 보죠\"", "😏 \"We'll see if offers come\""), hint: T("이적 의향 · 감독 신뢰↓", "Wants a move · Trust↓"), fx: (S) => { S.flags.wantMove = 1; return [tr(S, -5), T("이적 시장에서 제안이 조금 더 와요", "A few more offers next window")].join(" · "); } },
      { label: T("🤐 노코멘트", "🤐 No comment"), hint: T("변화 없음", "No change"), fx: () => T("기사는 금방 잠잠해졌어요", "The story soon died down") },
    ] },
  { id: "lowtrust", emoji: "😶", title: T("감독과의 거리", "Distance from the coach"), cd: 8,
    when: (S) => isPro(S) && (S.trust || 50) < 35,
    text: (S) => T(`요즘 ${S.pro.club} 감독이 눈을 잘 안 마주쳐요. 훈련에서도 지시가 짧아졌어요.`, `The ${S.pro.club} coach barely looks at you lately. Instructions in training are short.`),
    choices: [
      { label: T("🚪 면담을 신청한다", "🚪 Ask for a meeting"), hint: T("감독 신뢰↑", "Trust↑"), fx: (S) => tr(S, 8) },
      { label: T("💪 훈련장에 제일 먼저 나온다", "💪 Be first at training"), hint: T("감독 신뢰↑ 컨디션↓", "Trust↑ Cond↓"), fx: (S) => [tr(S, 5), addCond(S, -8)].join(" · ") },
      { label: T("🙄 신경 쓰지 않는다", "🙄 Ignore it"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 6) },
    ] },
  { id: "fanboo", emoji: "📣", title: T("홈 팬들의 야유", "Booed at home"), cd: 8,
    when: (S) => isPro(S) && (S.pro.streak || 0) <= -2,
    text: (S) => T(`연패 중인 ${S.pro.club}. 홈 경기장에 야유가 쏟아졌어요.`, `${S.pro.club} keep losing, and the home crowd lets them hear it.`),
    choices: [
      { label: T("🙇 경기 뒤 팬들에게 사과한다", "🙇 Apologise to the fans"), hint: T("명성↑", "Fame↑"), fx: (S) => addFame(S, 6) },
      { label: T("🔥 다음 경기로 보여준다", "🔥 Answer on the pitch"), hint: T("폼↑ 컨디션↓", "Form↑ Cond↓"), fx: (S) => [addForm(S, 1), addCond(S, -6)].join(" · ") },
      { label: T("🎧 귀를 막고 집중", "🎧 Tune it out"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 8) },
    ] },
  { id: "teammate", emoji: "😠", title: T("동료와의 언쟁", "A row with a teammate"), cd: 16,
    when: (S) => isPro(S) && S.pro.round >= 2,
    text: () => T("훈련 중 거친 태클에 동료와 말다툼이 붙었어요. 다들 쳐다보고 있어요.", "A rough tackle in training sparks a shouting match. Everyone's watching."),
    choices: [
      { label: T("🤝 먼저 손을 내민다", "🤝 Offer a handshake"), hint: T("감독 신뢰↑", "Trust↑"), fx: (S) => tr(S, 5) },
      { label: T("😤 물러서지 않는다", "😤 Stand your ground"), hint: T("폼↑ 감독 신뢰↓", "Form↑ Trust↓"), fx: (S) => [addForm(S, 1), tr(S, -5)].join(" · ") },
    ] },
  { id: "charity", emoji: "💝", title: T("자선 행사 초대", "Charity invitation"), cd: 20,
    when: (S) => S.money >= 3000 && S.fame >= 100,
    text: () => T("소아 병동 아이들을 위한 자선 경기와 기부 행사에 초대받았어요.", "You're invited to a charity match and fundraiser for a children's ward."),
    choices: [
      { label: T("💝 크게 기부하고 참석", "💝 Donate big and attend"), hint: T("💰 · 명성 크게↑", "💰 · Fame↑↑"), fx: (S) => [addMoney(S, -Math.round(S.money * .1)), addFame(S, 30)].join(" · ") },
      { label: T("⚽ 경기만 뛰어 준다", "⚽ Just play the match"), hint: T("명성↑ 컨디션↓", "Fame↑ Cond↓"), fx: (S) => [addFame(S, 10), addCond(S, -6)].join(" · ") },
      { label: T("🙏 이번엔 사양", "🙏 Not this time"), hint: T("변화 없음", "No change"), fx: () => T("다음 기회를 약속했어요", "You promised to come next time") },
    ] },
  { id: "invest", emoji: "💸", title: T("친구의 투자 제안", "A friend's investment pitch"), cd: 25,
    when: (S) => S.money >= 5000,
    text: () => T("어릴 적 친구가 카페 창업에 투자해 달래요. 잘되면 크게 남지만, 장담은 못 한대요.", "A childhood friend wants you to back his cafe. Big upside, no guarantees."),
    choices: [
      { label: T("💸 투자한다", "💸 Invest"), hint: T("💰 운에 맡기기", "💰 Roll the dice"), fx: (S) => { const bet = Math.round(S.money * .15); if (Math.random() < .45) return addMoney(S, Math.round(bet * 1.8)) + T(" (대박!)", " (it paid off!)"); return addMoney(S, -bet) + T(" (가게가 문을 닫았어요)", " (the cafe closed)"); } },
      { label: T("🙅 정중히 거절", "🙅 Politely decline"), hint: T("변화 없음", "No change"), fx: () => T("친구는 아쉬워했지만 이해했어요", "Your friend understood") },
    ] },
  { id: "exam", emoji: "📚", title: T("유스팀 학업 시험", "Academy school exams"), cd: 10,
    when: (S) => S.phase === "youth" && (S.month === 5 || S.month === 11),
    text: () => T("다음 주가 기말고사예요. 유스팀은 성적이 너무 낮으면 출전을 제한해요.", "Exams are next week. The academy limits match time for very low grades."),
    choices: [
      { label: T("📖 밤새 공부한다", "📖 Pull an all-nighter"), hint: T("명성↑ 컨디션↓", "Fame↑ Cond↓"), fx: (S) => [addFame(S, 3), addCond(S, -10)].join(" · ") },
      { label: T("⚖️ 공부와 훈련을 반반", "⚖️ Split study and training"), hint: T("컨디션↓ 조금", "Cond↓ a bit"), fx: (S) => addCond(S, -4) },
      { label: T("⚽ 축구만 한다", "⚽ Only football"), hint: T("다음 훈련 1.4배 · 폼↓", "Next training x1.4 · Form↓"), fx: (S) => { S.buff = 1.4; return [T("다음 훈련 효율 1.4배", "Next training x1.4"), addForm(S, -1)].join(" · "); } },
    ] },
  { id: "youthcap", emoji: "🎖️", title: T("유스팀 주장 선임", "Academy captain"), once: true,
    when: (S) => S.phase === "youth" && S.year >= 2 && S.fame >= 10,
    text: () => T("유스팀 코치가 이번 시즌 주장을 맡아 보래요. 동기들도 고개를 끄덕여요.", "The academy coach wants you as captain this season. Your teammates nod along."),
    choices: [
      { label: T("🎖️ 맡을게요", "🎖️ I'll do it"), hint: T("명성↑ 컨디션↓", "Fame↑ Cond↓"), fx: (S) => [addFame(S, 8), addCond(S, -5)].join(" · ") },
      { label: T("🙏 아직은 부담돼요", "🙏 Not ready yet"), hint: T("컨디션↑", "Cond↑"), fx: (S) => addCond(S, 6) },
    ] },
  { id: "hometown", emoji: "🏫", title: T("모교 축구교실 방문", "Visiting your old school"), cd: 30,
    when: (S) => isPro(S) && S.fame >= 60,
    text: () => T("처음 축구를 시작한 동네 축구교실에서 아이들 앞에 서 달래요.", "Your first football school asks you to come talk to the kids."),
    choices: [
      { label: T("⚽ 같이 공을 찬다", "⚽ Play with the kids"), hint: T("명성↑ 폼↑", "Fame↑ Form↑"), fx: (S) => [addFame(S, 8), addForm(S, 1)].join(" · ") },
      { label: T("🎁 축구공을 선물한다", "🎁 Gift footballs"), hint: T("💰 · 명성↑", "💰 · Fame↑"), fx: (S) => [addMoney(S, -50), addFame(S, 12)].join(" · ") },
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
  // 지금 상황에 딱 맞는 이벤트(라이벌 팀전 전야, 강등권, 야유, 슬럼프, 해외 적응 등)가 있으면 절반 확률로 먼저
  const PRI = ["derbyeve", "relegation", "fanboo", "slump", "homesick", "language", "captain", "lowtrust", "rumor", "veteran", "exam"];
  const pri = ok.filter((e) => PRI.includes(e.id));
  if (pri.length && Math.random() < .5) return pick(pri);
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
