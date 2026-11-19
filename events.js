/* 더 윙어 2 - 선택형 이벤트
 * when(S): 나올 수 있나 / once: 커리어에 한 번 / cd: 다시 나오기까지 턴 수
 * choices[].fx(S) → 결과 문장 (S를 직접 바꿔요) */
"use strict";

const R = (S) => S.rival.name;
const mainStat = (S) => Object.entries(POS[S.pos].w).sort((a, b) => b[1] - a[1])[0][0];
const addStat = (S, k, v) => { S.stats[k] = clamp(S.stats[k] + v, 1, 99); return `${STAT_NAME[k]} ${v > 0 ? "+" : ""}${v}`; };
const addRel = (S, v) => { S.rival.rel = clamp(S.rival.rel + v, -100, 100); return `라이벌 관계 ${v > 0 ? "+" : ""}${v}`; };
const addFame = (S, v) => { S.fame = Math.max(0, S.fame + v); return `명성 ${v > 0 ? "+" : ""}${v}`; };
const addCond = (S, v) => { S.cond = clamp(S.cond + v, 0, 100); return `컨디션 ${v > 0 ? "+" : ""}${v}`; };
const addForm = (S, v) => { S.form = clamp(S.form + v, -3, 3); return `폼 ${v > 0 ? "▲" : "▼"}`; };
const addMoney = (S, v) => { S.money = Math.max(0, S.money + v); return `💰 ${v > 0 ? "+" : ""}${v}만`; };
const isPro = (S) => S.phase === "pro";

const EVENTS = [
  { id: "taunt", emoji: "📱", title: "라이벌의 도발", cd: 10,
    when: (S) => S.turn > 2,
    text: (S) => `${josa(R(S), "이/가")} SNS에 글을 올렸어요.\n"${S.name}? 같은 무대에 서려면 한참 멀었지 ㅋ"`,
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
        low.forEach((k) => { S.stats[k] = clamp(S.stats[k] + 3, 1, 99); });
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
      { label: "🙇 받는다 (120만)", hint: "주력 스탯 크게↑", fx: (S) => [addMoney(S, -120), addStat(S, mainStat(S), 5)].join(" · ") },
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
      { label: "✍️ 계약한다", hint: "이적 제안↑ 수입 -10%", fx: (S) => { S.flags.agent = true; return "에이전트 계약! 이적 제안이 늘어나요"; } },
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
        if (Math.random() < .5) { S.flags.forceStart = true; return "감독: \"좋다, 다음 경기 선발이다. 증명해 봐.\""; }
        return "감독의 표정이 굳었어요… " + [addFame(S, -5), addForm(S, -1)].join(" · ");
      } },
      { label: "🏋️ 묵묵히 훈련", hint: "다음 훈련 1.4배", fx: (S) => { S.buff = 1.4; return "다음 훈련 1.4배"; } },
    ] },
  { id: "interview", emoji: "🎤", title: "경기 후 인터뷰", cd: 6,
    when: (S) => isPro(S) && S.pro.round > 0,
    text: (S) => `기자: "${R(S)} 선수와 자주 비교되는데요, 한 말씀 해주시죠."`,
    choices: [
      { label: "🙇 겸손하게", hint: "명성↑ 관계↑", fx: (S) => [addFame(S, 3), addRel(S, 6)].join(" · ") },
      { label: "😎 자신 있게", hint: "명성↑ 폼↑", fx: (S) => [addFame(S, 6), addForm(S, 1)].join(" · ") },
      { label: "🔥 라이벌 저격", hint: "명성 크게↑ 관계 크게↓", fx: (S) => [addFame(S, 12), addRel(S, -18)].join(" · ") },
    ] },
  { id: "rivalhurt", emoji: "🏥", title: "라이벌 부상 소식", cd: 30,
    when: (S) => isPro(S) && S.turn > 20,
    text: (S) => `${josa(R(S), "이/가")} 경기 중 발목 부상으로 실려 나갔대요. 몇 주 결장이 예상된대요.`,
    choices: [
      { label: "💐 병문안 간다", hint: "관계 크게↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 20); } },
      { label: "💬 메시지만", hint: "관계↑", fx: (S) => { S.rival.hurt = 2; return addRel(S, 8); } },
      { label: "😶 모른 척", hint: "다음 훈련 1.3배 관계↓", fx: (S) => { S.rival.hurt = 2; S.buff = 1.3; return "다음 훈련 1.3배 · " + addRel(S, -8); } },
    ] },
  { id: "national", emoji: "🇰🇷", title: "국가대표 소집!", cd: 9,
    when: (S) => isPro(S) && ovrOf(S.stats, S.pos) >= 70,
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
