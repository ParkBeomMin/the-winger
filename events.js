/* 더 윙어 2 - 선택형 이벤트
 * when(S): 나올 수 있나 / once: 커리어에 한 번 / cd: 다시 나오기까지 턴 수
 * choices[].fx(S) → 결과 문장 (S를 직접 바꿔요) */
"use strict";

const R = (S) => S.rival.name;
const mainStat = (S) => Object.entries(POS[S.pos].w).sort((a, b) => b[1] - a[1])[0][0];
const addStat = (S, k, v) => { S.stats[k] = clamp(S.stats[k] + v, 1, typeof statCap === "function" ? statCap(k) : 99); return `${STAT_NAME[k]} ${v > 0 ? "+" : ""}${v}`; };
const addRel = (S, v) => { S.rival.rel = clamp(S.rival.rel + v, -100, 100); return `라이벌 관계 ${v > 0 ? "+" : ""}${v}`; };
const addFame = (S, v) => { S.fame = Math.max(0, S.fame + v); return `명성 ${v > 0 ? "+" : ""}${v}`; };
const addCond = (S, v) => { S.cond = clamp(S.cond + v, 0, 100); return `컨디션 ${v > 0 ? "+" : ""}${v}`; };
const addForm = (S, v) => { S.form = clamp(S.form + v, -3, 3); return `폼 ${v > 0 ? "▲" : "▼"}`; };
const addMoney = (S, v) => { S.money = Math.max(0, S.money + v); return `💰 ${v > 0 ? "+" : ""}${v}만`; };
const isPro = (S) => S.phase === "pro";
/* 상황 도우미: 해외에서 뛰는 중인지 · 지금 팀에서 끝낸 시즌 수 */
const abroadNow = (S) => isPro(S) && LEAGUES[S.pro.league] && ORIGINS[S.origin] && LEAGUES[S.pro.league].nat !== ORIGINS[S.origin].nat;
const clubSeasons = (S) => { let n = 0; const ss = (S.career && S.career.seasons) || []; for (let i = ss.length - 1; i >= 0 && ss[i].club === S.pro.club; i--) n++; return n; };

const abroadCost = (S) => Math.round(Math.max(200, (S.contract && S.phase === "pro" ? S.contract.sal : 30) * 10));
const EVENTS = [
  { id: "abroad", emoji: "✈️", title: "해외 단기 연수 제안", cd: 22,
    when: (S) => S.turn > 8 && S.money >= abroadCost(S) && (S.phase === "youth" || S.age <= 24),
    text: (S) => `유럽 명문 아카데미에서 2주 특별 연수를 제안했어요. 비용은 ${fmtMoney(abroadCost(S))}. 잠든 재능이 깨어날지도 몰라요.`,
    choices: [
      { label: "🧬 주력 능력치 집중 연수", hint: "💰 · 주력 숙련 +12", fx: (S) => { S.money -= abroadCost(S); return mastLine(mainStat(S), 12); } },
      { label: "🔀 약점 보완 연수", hint: "💰 · 가장 낮은 주요 능력치 +3 · 숙련 +8", fx: (S) => { const k = Object.entries(POS[S.pos].w).filter(([, w]) => w >= .1).sort((a, b) => S.stats[a[0]] - S.stats[b[0]])[0][0]; S.money -= abroadCost(S); return [addStat(S, k, 3), mastLine(k, 8)].join(" · "); } },
      { label: "🙅 이번엔 사양", hint: "컨디션↑", fx: (S) => addCond(S, 6) },
    ] },
  { id: "taunt", emoji: "📱", title: "라이벌의 도발", cd: 10,
    when: (S) => S.turn > 2,
    text: (S) => { const gap = (typeof OVR === "function" && typeof ROVR === "function") ? OVR() - ROVR() : 0, mate = isPro(S) && S.rival.club === S.pro.club;
      if (mate) return T(`${josa(R(S), "이/가")} 단체 사진에 혼자 가운데 서서 글을 올렸어요.\n"이 팀 에이스는 누구? ㅋ"`, `${R(S)} posted a team photo, standing alone in the middle.\n"Guess who the ace is? lol"`);
      if (gap >= 4) return T(`${josa(R(S), "이/가")} SNS에 글을 올렸어요.\n"요즘 좀 한다고? 한 시즌 반짝이겠지 ㅋ"`, `${R(S)} posted on social.\n"Doing well lately? Just a one-season wonder lol"`);
      return `${josa(R(S), "이/가")} SNS에 글을 올렸어요.\n"${S.name}? 같은 무대에 서려면 한참 멀었지 ㅋ"`; },
    choices: [
      { label: "🔥 맞받아친다", hint: "명성↑ 폼↑ 관계↓", fx: (S) => [addFame(S, 6), addForm(S, 1), addRel(S, -15)].join(" · ") },
      { label: "🤐 실력으로 보여준다", hint: "다음 훈련 1.6배", fx: (S) => { S.buff = 1.6; return "다음 훈련 효율 1.6배"; } },
      { label: "😄 웃으며 넘긴다", hint: "관계↑", fx: (S) => [addRel(S, 12), addFame(S, 2)].join(" · ") },
    ] },
  { id: "night", emoji: "🌙", title: "몰래 야간 훈련?", cd: 6,
    when: (S) => S.cond >= 25,
    text: (S) => `다들 잠든 밤, 훈련장 불이 아직 켜져 있어요.\n${STAT_NAME[mainStat(S)]} 연습을 조금 더 해볼까요?`,
    choices: [
      { label: "💪 한다", hint: "주력 스탯↑ 컨디션↓", fx: (S) => [addStat(S, mainStat(S), 3), addCond(S, -16)].join(" · ") },
      { label: "😴 푹 잔다", hint: "컨디션↑", fx: (S) => addCond(S, 12) },
    ] },
  { id: "coachpos", emoji: "🧑‍🏫", title: "감독님의 포지션 실험", once: true,
    when: (S) => S.phase === "youth" && S.pos !== "df" && S.turn > 4,
    text: () => `"오늘 연습경기는 수비 라인에서 뛰어볼래? 보는 눈이 넓어질 거다."`,
    choices: [
      { label: "🙆 해볼게요", hint: "수비·체력↑", fx: (S) => [addStat(S, "def", 4), addStat(S, "sta", 2)].join(" · ") },
      { label: "🙅 제 자리에서 뛸게요", hint: "주력 스탯↑ 폼↓", fx: (S) => [addStat(S, mainStat(S), 2), addForm(S, -1)].join(" · ") },
    ] },
  { id: "party", emoji: "🎉", title: "동기들의 파티 초대", cd: 12,
    when: (S) => S.phase === "youth",
    text: (S) => `유스 동기들이 주말 파티를 연대요. ${R(S)}도 온다는 소문이…`,
    choices: [
      { label: "🕺 간다", hint: "폼↑ 관계↑ 컨디션↓", fx: (S) => [addForm(S, 1), addRel(S, 8), addCond(S, -10)].join(" · ") },
      { label: "🏠 쉰다", hint: "컨디션↑ 다음 훈련 1.2배", fx: (S) => { S.buff = Math.max(S.buff, 1.2); return addCond(S, 6) + " · 다음 훈련 1.2배"; } },
    ] },
  { id: "mom", emoji: "📞", title: "엄마의 전화", cd: 14,
    when: (S) => S.cond < 70,
    text: () => `"밥은 잘 먹고 다니니? 얼굴 본 지 너무 오래됐다…"`,
    choices: [
      { label: "🏡 집에 다녀온다", hint: "컨디션 크게↑ 폼↑", fx: (S) => [addCond(S, 25), addForm(S, 1)].join(" · ") },
      { label: "📱 영상통화만", hint: "컨디션↑", fx: (S) => addCond(S, 8) },
    ] },
  { id: "scout", emoji: "🕵️", title: "스카우트가 지켜본다", cd: 8,
    when: (S) => S.phase === "youth" && S.year >= 2,
    text: () => `오늘 연습경기 관중석에 해외 구단 스카우트가 보여요.`,
    choices: [
      { label: "✨ 개인기 쇼", hint: "도박: 명성 크게↑ 또는↓", fx: (S) => Math.random() < .5 + (S.stats.dri - 50) / 150 ? "대성공! " + addFame(S, 14) : "공을 뺏겼어요… " + addFame(S, -5) },
      { label: "🤝 팀플레이", hint: "명성↑ 패스↑", fx: (S) => [addFame(S, 5), addStat(S, "pas", 2)].join(" · ") },
    ] },
  { id: "together", emoji: "🤝", title: "라이벌의 제안", cd: 10,
    when: (S) => S.rival.rel >= 5,
    text: (S) => `${R(S)}: "…야. 오늘 끝나고 같이 좀 뛸래? 너 상대로 연습하는 게 제일 늘더라."`,
    choices: [
      { label: "👊 좋아", hint: "약한 스탯 둘↑ 관계↑ (라이벌도 성장)", fx: (S) => {
        const low = STAT_KEYS.filter((k) => POS[S.pos].w[k] > 0).sort((a, b) => S.stats[a] - S.stats[b]).slice(0, 2);
        low.forEach((k) => { S.stats[k] = clamp(S.stats[k] + 3, 1, statCap(k)); });
        S.rival.stats[mainStatOf(S.rival.pos)] += 2;
        return `${low.map((k) => STAT_NAME[k]).join("·")} +3 · ` + addRel(S, 10);
      } },
      { label: "🙅 혼자 할게", hint: "다음 훈련 1.4배 관계↓", fx: (S) => { S.buff = 1.4; return "다음 훈련 1.4배 · " + addRel(S, -6); } },
    ] },
  { id: "knee", emoji: "🦵", title: "무릎이 시큰거려요", cd: 6,
    when: (S) => S.cond < 40,
    text: () => `훈련 중 무릎에 찌릿한 느낌이 왔어요. 트레이너는 쉬라고 하는데…`,
    choices: [
      { label: "🧊 쉰다", hint: "컨디션↑ 안전", fx: (S) => addCond(S, 22) },
      { label: "😤 참고 뛴다", hint: "도박: 부상 위험", fx: (S) => {
        if (Math.random() < .45) { S.injured = 1; return "결국 부상… 1턴 결장"; }
        return "버텼어요! " + addStat(S, mainStat(S), 2);
      } },
    ] },
  { id: "mentor", emoji: "🧓", title: "레전드의 원포인트 레슨", cd: 18,
    when: (S) => S.money >= 120,
    text: () => `은퇴한 레전드 선배가 개인 레슨을 해준대요. 레슨비는 120만.`,
    choices: [
      { label: "🙇 받는다 (120만)", hint: "주력 스탯 크게↑ 숙련↑", fx: (S) => [addMoney(S, -120), addStat(S, mainStat(S), 5), mastLine(mainStat(S), 5)].join(" · ") },
      { label: "🙏 사양한다", hint: "", fx: () => "다음 기회에…" },
    ] },
  { id: "youtube", emoji: "🎬", title: "유튜버 협업 제안", cd: 12,
    when: (S) => S.fame >= 20,
    text: () => `구독자 80만 축구 유튜버가 챌린지 영상을 같이 찍자고 해요.`,
    choices: [
      { label: "📸 찍는다", hint: "명성↑ 💰↑ 컨디션↓", fx: (S) => [addFame(S, 10), addMoney(S, 30), addCond(S, -8)].join(" · ") },
      { label: "⚽ 훈련에 집중", hint: "다음 훈련 1.3배", fx: (S) => { S.buff = Math.max(S.buff, 1.3); return "다음 훈련 1.3배"; } },
    ] },
  { id: "agent", emoji: "💼", title: "에이전트의 접근", once: true,
    when: (S) => isPro(S) || (S.year === 3 && S.month >= 6),
    text: () => `업계에서 이름난 에이전트가 명함을 내밀어요.\n"수수료는 연봉의 10%. 대신 더 좋은 오퍼를 물어오죠."`,
    choices: [
      { label: "✍️ 계약한다", hint: "이적 제안↑ 연봉 협상↑", fx: (S) => { S.gear.agent = Math.max(S.gear.agent || 0, 1); return "에이전트 계약! 이적 제안이 늘어나요"; } },
      { label: "🙅 혼자 간다", hint: "", fx: () => "내 커리어는 내가 챙긴다" },
    ] },
  { id: "ad", emoji: "📺", title: "광고 촬영 제안", cd: 9,
    when: (S) => isPro(S) && S.fame >= 40,
    text: () => `스포츠 음료 광고 모델 제의가 왔어요. 촬영은 하루 꼬박 걸린대요.`,
    choices: [
      { label: "🎥 찍는다", hint: "💰 크게↑ 명성↑ 컨디션↓", fx: (S) => [addMoney(S, 60 * LEAGUES[S.pro.league].prestige), addFame(S, 8), addCond(S, -12)].join(" · ") },
      { label: "🙅 거절", hint: "폼↑", fx: (S) => addForm(S, 1) },
    ] },
  { id: "bench", emoji: "🪑", title: "출전 시간 문제", cd: 4,
    when: (S) => isPro(S) && S.pro.lastBench,
    text: () => `또 벤치였어요. 감독실 문 앞에 섰어요.`,
    choices: [
      { label: "🗣️ 따진다", hint: "도박: 다음 경기 선발 또는 명성↓", fx: (S) => {
        if (Math.random() < .3 + ((S.trust ?? 50) - 50) / 100) { S.flags.forceStart = true; return "감독: \"좋다, 다음 경기 선발이다. 증명해 봐.\""; }
        return "감독의 표정이 굳었어요… " + [addFame(S, -5), addForm(S, -1), addTrust(-8)].filter(Boolean).join(" · ");
      } },
      { label: "🏋️ 묵묵히 훈련", hint: "다음 훈련 1.4배", fx: (S) => { S.buff = 1.4; return "다음 훈련 1.4배"; } },
    ] },
  { id: "interview", emoji: "🎤", title: "경기 후 인터뷰", cd: 6,
    when: (S) => isPro(S) && S.pro.round > 0,
    text: (S) => { const st = (S.pro && S.pro.streak) || 0; if (st >= 3) return T(`기자: "${st}연승 중인데요, 비결이 뭔가요? ${R(S)} 선수와의 비교도 한 말씀 해주시죠."`, `Reporter: "${st} wins in a row. What's the secret? And a word on comparisons with ${R(S)}?"`); if (st <= -2) return T(`기자: "팀이 ${-st}연패인데요, 분위기 어떤가요? ${R(S)} 선수는 잘나가던데요."`, `Reporter: "${-st} straight defeats. How's the mood? ${R(S)} seems to be flying."`); return `기자: "${R(S)} 선수와 자주 비교되는데요, 한 말씀 해주시죠."`; },
    choices: [
      { label: "🙇 겸손하게", hint: "명성↑ 관계↑", fx: (S) => [addFame(S, 3), addRel(S, 6)].join(" · ") },
      { label: "😎 자신 있게", hint: "명성↑ 폼↑", fx: (S) => [addFame(S, 6), addForm(S, 1)].join(" · ") },
      { label: "🔥 라이벌 저격", hint: "명성 크게↑ 관계 크게↓", fx: (S) => [addFame(S, 12), addRel(S, -18)].join(" · ") },
    ] },
  { id: "rivalhurt_old", emoji: "🏥", title: "라이벌 부상 소식", cd: 30,
    when: () => false,
    text: (S) => `${josa(R(S), "이/가")} 경기 중 발목 부상으로 실려 나갔대요. 몇 주 결장이 예상된대요.`,
    choices: [
      { label: "💐 병문안 간다", hint: "관계 크게↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 20); } },
      { label: "💬 메시지만", hint: "관계↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 8); } },
      { label: "😶 모른 척", hint: "다음 훈련 1.3배 관계↓", fx: (S) => { S.rival.hurt = 2; S.buff = 1.3; return "다음 훈련 1.3배 · " + addRel(S, -8); } },
    ] },
  { id: "national_old", emoji: "🇰🇷", title: "국가대표 소집!", cd: 9,
    when: () => false,
    text: () => `A매치 기간, 국가대표 명단에 이름이 올랐어요!`,
    choices: [
      { label: "🫡 응한다", hint: "명성 크게↑ 폼↑ 컨디션↓", fx: (S) => { S.career.caps = (S.career.caps || 0) + 1; return [addFame(S, 15), addForm(S, 1), addCond(S, -15)].join(" · ") + ` · A매치 ${S.career.caps}경기`; } },
      { label: "🩹 소속팀에 집중", hint: "컨디션↑", fx: (S) => addCond(S, 12) },
    ] },
  { id: "no10", emoji: "🔟", title: "등번호 10번 제안", once: true,
    when: (S) => isPro(S) && S.fame >= 80 && S.look.number !== 10,
    text: () => `구단이 상징적인 10번을 달아달래요. 기대와 부담이 함께 따라와요.`,
    choices: [
      { label: "🔟 받는다", hint: "명성 크게↑", fx: (S) => { S.look.number = 10; return "이제 당신이 10번! " + addFame(S, 12); } },
      { label: "🙂 지금 번호로", hint: "폼↑", fx: (S) => addForm(S, 1) },
    ] },
  { id: "boots", emoji: "👟", title: "스폰서 축구화 계약", once: true,
    when: (S) => isPro(S) && S.fame >= 30,
    text: () => `스포츠 브랜드가 축구화 스폰서를 제안했어요. 어떤 라인을 고를까요?`,
    choices: [
      { label: "⚡ 스피드 라인", hint: "스피드 +3", fx: (S) => addStat(S, "spd", 3) },
      { label: "💥 파워 라인", hint: "슛 +3", fx: (S) => addStat(S, "sho", 3) },
      { label: "🎯 컨트롤 라인", hint: "패스·드리블 +2", fx: (S) => [addStat(S, "pas", 2), addStat(S, "dri", 2)].join(" · ") },
    ] },
  { id: "fan", emoji: "✉️", title: "꼬마 팬의 편지", cd: 15,
    when: (S) => S.fame >= 15,
    text: (S) => `"${S.name} 선수처럼 되고 싶어요! 저도 ${POS[S.pos].name}예요!"`,
    choices: [
      { label: "📹 답장 영상", hint: "명성↑ 폼↑", fx: (S) => [addFame(S, 4), addForm(S, 1)].join(" · ") },
      { label: "✍️ 사인볼 보내기", hint: "폼↑", fx: (S) => addForm(S, 1) },
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
const tr = (S, v) => addTrust(v) || "감독 신뢰 그대로";
const SIG_EVENTS = {
  hattrick: { emoji: "🎩", title: "해트트릭 기념구", text: (S, d) => `${d.opp || "상대"}전 해트트릭! 주심이 경기 공을 건네줬어요. 어떻게 할까요?`,
    choices: [
      { label: "👪 가족에게 선물", hint: "폼↑ 컨디션↑", fx: (S) => [addForm(S, 1), addCond(S, 10)].join(" · ") },
      { label: "✍️ 팬 사인회 경품으로", hint: "명성 크게↑", fx: (S) => addFame(S, 20) },
      { label: "🏛️ 구단 박물관에 기증", hint: "감독 신뢰↑ 명성↑", fx: (S) => [tr(S, 6), addFame(S, 8)].join(" · ") },
    ] },
  superb: { emoji: "📰", title: "언론의 극찬", text: (S, d) => `평점 ${d.r}! "오늘의 주인공은 ${S.name}" 헤드라인이 쏟아졌어요.`,
    choices: [
      { label: "🙇 팀 덕분이에요", hint: "감독 신뢰↑ 명성↑", fx: (S) => [tr(S, 4), addFame(S, 5)].join(" · ") },
      { label: "😎 이제 시작일 뿐", hint: "명성 크게↑ 폼↑", fx: (S) => [addFame(S, 12), addForm(S, 1)].join(" · ") },
    ] },
  awful: { emoji: "😞", title: "최악의 경기 뒤", text: (S, d) => `평점 ${d.r}. 감독이 라커룸에서 한마디도 하지 않았어요.`,
    choices: [
      { label: "🙇 먼저 사과한다", hint: "감독 신뢰↑", fx: (S) => tr(S, 5) },
      { label: "🎞️ 밤새 영상 분석", hint: "다음 훈련 1.5배 컨디션↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "다음 훈련 1.5배 · " + addCond(S, -10); } },
      { label: "🧘 털어버린다", hint: "폼↑", fx: (S) => addForm(S, 1) },
    ] },
  redcard: { emoji: "🟥", title: "퇴장 후폭풍", text: () => `퇴장 장면이 하이라이트로 계속 돌아요. 기자들이 입장을 물어요.`,
    choices: [
      { label: "🙇 공개 사과", hint: "감독 신뢰↑ 명성↑", fx: (S) => [tr(S, 5), addFame(S, 3)].join(" · ") },
      { label: "📢 판정에 항의", hint: "명성↑ 감독 신뢰↓", fx: (S) => [addFame(S, 6), tr(S, -8)].join(" · ") },
      { label: "🤐 조용히 반성", hint: "다음 훈련 1.3배", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.3); return "다음 훈련 1.3배 · " + tr(S, 2); } },
    ] },
  matchinjury: { emoji: "🚑", title: "재활 방법", text: (S) => `경기 중 부상으로 ${S.injured}경기 결장 예정이에요. 의무팀이 재활 방법을 물어요.`,
    choices: [
      { label: "🛌 확실히 쉰다", hint: "컨디션 크게↑", fx: (S) => addCond(S, 20) },
      { label: "⚡ 조기 복귀", hint: "결장 -1 · 30% 재발", fx: (S) => { if (Math.random() < .3) { S.injured += 2; return "무리하다 재발… 결장 +2"; } S.injured = Math.max(0, S.injured - 1); return "조기 복귀 성공! 결장 -1"; } },
      { label: "🏥 해외 전문 병원", hint: "💰 수당 8경기치 · 결장 -1", fx: (S) => { const c = Math.round(payRef() * 8); if (S.money < c) return "돈이 모자라 그냥 쉬었어요 · " + addCond(S, 10); S.money -= c; S.injured = Math.max(0, S.injured - 1); return `💰 -${fmtMoney(c)} · 결장 -1`; } },
    ] },
  losing3: { emoji: "🌧️", title: "3연패, 라커룸 분위기 최악", text: (S) => `${S.pro.club}가 3경기 연속 졌어요. 다들 고개를 숙이고 있어요.`,
    choices: [
      { label: "🗣️ 선수단 미팅을 연다", hint: "감독 신뢰↑ · 도박: 폼", fx: (S) => [tr(S, 6), Math.random() < .55 ? "분위기 반전! " + addForm(S, 1) : "말이 겉돌았어요 " + addForm(S, -1)].join(" · ") },
      { label: "🏋️ 개인 훈련에 집중", hint: "다음 훈련 1.4배", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "다음 훈련 1.4배"; } },
      { label: "📵 SNS 잠시 끊기", hint: "컨디션↑", fx: (S) => addCond(S, 8) },
    ] },
  winning4: { emoji: "🔥", title: "4연승 상승세", text: (S) => `${S.pro.club}가 4연승! 동료들이 회식을 하자고 해요.`,
    choices: [
      { label: "🍖 회식 참석", hint: "폼↑ 컨디션↓", fx: (S) => [addForm(S, 1), addCond(S, -8)].join(" · ") },
      { label: "🧊 들뜨지 말자", hint: "감독 신뢰↑", fx: (S) => tr(S, 4) },
    ] },
  newcoach: { emoji: "👔", title: "새 감독 부임", text: (S, d) => `${S.pro.club}에 ${d.n} 감독이 왔어요. ${d.f} · ${STYLES[d.s].name} 축구를 해요. 신뢰는 처음부터 다시 쌓아야 해요.`,
    choices: [
      { label: "🤝 먼저 찾아가 인사", hint: "감독 신뢰 크게↑", fx: (S) => tr(S, 10) },
      { label: "📋 전술 공부", hint: "감독 신뢰↑ 패스↑", fx: (S) => [tr(S, 5), addStat(S, "pas", 1)].join(" · ") },
      { label: "⚽ 실력으로 보여준다", hint: "다음 훈련 1.5배", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "다음 훈련 1.5배"; } },
    ] },
  newclub: { emoji: "🧳", title: "새 팀 적응", text: (S) => `${S.pro.club}에서의 첫 주. 낯선 라커룸, 낯선 전술이에요.`,
    choices: [
      { label: "🍻 팀 회식 참석", hint: "폼↑ 컨디션↓", fx: (S) => [addForm(S, 1), addCond(S, -8)].join(" · ") },
      { label: "📚 언어·전술 공부", hint: "감독 신뢰↑", fx: (S) => tr(S, 7) },
      { label: "📹 홈 팬 인사 영상", hint: "명성↑", fx: (S) => addFame(S, 10) },
    ] },
  cupfinal: { emoji: "🏆", title: "결승 전야", text: (S, d) => `${S.pro.club}가 ${d.cup} 결승에 올랐어요! 결승을 앞두고 잠이 잘 안 와요.`,
    choices: [
      { label: "😴 일찍 잔다", hint: "컨디션 크게↑", fx: (S) => addCond(S, 20) },
      { label: "🎞️ 상대 영상 분석", hint: "폼↑", fx: (S) => addForm(S, 1) },
      { label: "👪 가족을 경기장에 초대", hint: "폼↑ 명성↑", fx: (S) => [addForm(S, 1), addFame(S, 5)].join(" · ") },
    ] },
  titlerace: { emoji: "🥇", title: "우승 경쟁", text: (S, d) => `리그 ${d.rank}위, 선두와 ${d.gap}점 차이! 남은 경기가 결승이에요.`,
    choices: [
      { label: "🎤 인터뷰로 분위기 띄우기", hint: "명성↑ 감독 신뢰↑", fx: (S) => [addFame(S, 8), tr(S, 2)].join(" · ") },
      { label: "🧊 한 경기씩 집중", hint: "컨디션↑", fx: (S) => addCond(S, 12) },
    ] },
  rivalhurt: { emoji: "🏥", title: "라이벌 부상 소식", text: (S, d) => `${josa(R(S), "이/가")} 경기 중 부상으로 실려 나갔대요. ${d.n}경기 결장이래요.`,
    choices: [
      { label: "💐 병문안 간다", hint: "관계 크게↑", fx: (S) => addRel(S, 20) },
      { label: "💬 메시지만", hint: "관계↑", fx: (S) => addRel(S, 8) },
      { label: "😶 모른 척", hint: "다음 훈련 1.3배 관계↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.3); return "다음 훈련 1.3배 · " + addRel(S, -8); } },
    ] },
  rivalmate: { emoji: "🤝", title: "라이벌과 한 팀", text: (S) => `이번 시즌 ${josa(R(S), "과/와")} 같은 유니폼을 입어요. 훈련장에서 마주쳤어요.`,
    choices: [
      { label: "🤝 먼저 손을 내민다", hint: "관계 크게↑", fx: (S) => addRel(S, 15) },
      { label: "🔥 주전 경쟁 선언", hint: "다음 훈련 1.4배 관계↓", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "다음 훈련 1.4배 · " + addRel(S, -10); } },
    ] },
  rivalhattrick: { emoji: "😤", title: "라이벌의 해트트릭", text: (S, d) => `뉴스 속보: ${R(S)}, ${d.club}에서 해트트릭! 하이라이트가 계속 떠요.`,
    choices: [
      { label: "👏 축하 메시지", hint: "관계↑", fx: (S) => addRel(S, 8) },
      { label: "🔥 자극받아 훈련", hint: "다음 훈련 1.5배", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "다음 훈련 1.5배"; } },
    ] },
  benched3: { emoji: "🪑", title: "3경기째 벤치", text: () => `세 경기 연속 벤치예요. 이대로는 성장도 멈출 것 같아요.`,
    choices: [
      { label: "🗣️ 감독과 면담", hint: "신뢰에 따라 다음 경기 선발", fx: (S) => { if (Math.random() < .35 + ((S.trust ?? 50) - 50) / 80) { S.flags.forceStart = true; return "감독: \"다음 경기 기회를 주겠다.\" · " + tr(S, 2); } return "감독: \"아직은 아니야.\" · " + tr(S, -3); } },
      { label: "📤 이적 요청", hint: "시즌 끝 제안↑ · 감독 신뢰 크게↓", fx: (S) => { S.flags.wantMove = true; return "에이전트가 움직이기 시작했어요 · " + tr(S, -12); } },
      { label: "🏋️ 묵묵히 훈련", hint: "다음 훈련 1.4배 · 신뢰↑", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.4); return "다음 훈련 1.4배 · " + tr(S, 3); } },
    ] },
  contractlast: { emoji: "✍️", title: "계약 마지막 시즌", text: (S) => `${S.pro.club}와의 계약이 이번 시즌으로 끝나요. 구단이 의중을 떠봐요.`,
    choices: [
      { label: "🤝 남고 싶다고 말한다", hint: "감독 신뢰↑ · 재계약 유리", fx: (S) => { S.flags.renewWill = true; return tr(S, 5); } },
      { label: "🌍 시장 반응을 본다", hint: "시즌 끝 제안↑ · 신뢰↓", fx: (S) => { S.flags.wantMove = true; return "에이전트가 다른 구단에 연락했어요 · " + tr(S, -5); } },
    ] },
  national: { emoji: "🇰🇷", title: "A매치 소집!", text: (S, d) => `대한민국 대표팀 명단에 이름이 올랐어요! (${d.xi ? "주전" : "교체 명단"}) 상대는 ${NATIONS[d.opp].flag} ${NATIONS[d.opp].name}이에요.`,
    choices: [
      { label: "🫡 응한다", hint: "A매치 출전 · 명성↑ · 컨디션↓", fx: (S) => aMatch(S, S._d) },
      { label: "🩹 부상 관리로 고사", hint: "컨디션↑ · 감독 신뢰↑", fx: (S) => [addCond(S, 10), tr(S, 2)].join(" · ") },
    ] },
  wcdropped: { emoji: "📋", title: "월드컵 명단 탈락", text: () => `월드컵 최종 명단에 이름이 없어요. 다음 대회까지 4년이에요.`,
    choices: [
      { label: "😤 이를 악문다", hint: "다음 훈련 1.5배", fx: (S) => { S.buff = Math.max(S.buff || 1, 1.5); return "다음 훈련 1.5배"; } },
      { label: "🏟️ 소속팀에 집중", hint: "감독 신뢰↑", fx: (S) => tr(S, 4) },
    ] },
  transferblocked: { emoji: "⛔", title: "구단이 이적을 막았어요", text: (S, d) => `${d.club}의 제안을 받아들였지만 ${S.pro.club}가 이적을 거부했어요.`,
    choices: [
      { label: "🤝 받아들인다", hint: "감독 신뢰↑", fx: (S) => tr(S, 5) },
      { label: "📢 공개 불만", hint: "명성↑ 신뢰 크게↓ · 다음엔 풀어줄 확률↑", fx: (S) => { S.flags.wantMove = true; return [addFame(S, 5), tr(S, -15)].join(" · "); } },
    ] },
};
function pushSig(k, d = {}) {
  if (!S.sig) S.sig = [];
  if (S.sig.some((x) => x.k === k)) return;
  S.sig.push({ k, d, t: S.turn });
  if (S.sig.length > 4) S.sig.shift();
}
