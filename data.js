/* 더 윙어 2 : 라이벌 - 데이터 */
"use strict";

const VERSION = "v0.1 베타";

const STATS = [
  { key: "sho", name: "슛", emoji: "⚽", desc: "결정력·마무리" },
  { key: "pas", name: "패스", emoji: "🎯", desc: "시야·연계" },
  { key: "dri", name: "드리블", emoji: "🏃", desc: "돌파·개인기" },
  { key: "def", name: "수비", emoji: "🛡️", desc: "태클·위치선정" },
  { key: "sta", name: "체력", emoji: "🫀", desc: "지구력·회복" },
  { key: "spd", name: "스피드", emoji: "⚡", desc: "가속·순간 속도" },
];
const STAT_KEYS = STATS.map((s) => s.key);
const STAT_NAME = Object.fromEntries(STATS.map((s) => [s.key, s.name]));

const POS = {
  fw: { name: "공격수", short: "FW", emoji: "⚽", w: { sho: .36, spd: .2, dri: .2, pas: .1, sta: .1, def: .04 },
        moments: ["shot", "shot", "dribble", "pass", "shot", "dribble"], desc: "골로 말하는 최전방" },
  wg: { name: "윙어", short: "WG", emoji: "🏃", w: { dri: .3, spd: .28, sho: .17, pas: .15, sta: .1, def: 0 },
        moments: ["dribble", "dribble", "shot", "pass", "shot"], desc: "측면을 허무는 돌파" },
  mf: { name: "미드필더", short: "MF", emoji: "🎯", w: { pas: .36, sta: .2, dri: .15, def: .14, sho: .1, spd: .05 },
        moments: ["pass", "pass", "shot", "tackle", "dribble"], desc: "경기를 지휘하는 중원" },
  df: { name: "수비수", short: "DF", emoji: "🛡️", w: { def: .45, sta: .2, spd: .15, pas: .15, sho: 0, dri: .05 },
        moments: ["tackle", "tackle", "tackle", "pass", "shot"], desc: "골문을 지키는 방패" },
};

/* 유스 출신 — 스탯별 훈련 배수, 시작 보너스, 유스팀 유니폼 */
const ORIGINS = {
  kr: { name: "K리그 유스", flag: "🇰🇷", tag: "안정적인 성장", mul: { sho: 1, pas: 1.05, dri: 1, def: 1.1, sta: 1.15, spd: 1 },
        fame: 0.9, kit: ["#d93a3a", "#ffffff"], team: "한강 유스", desc: "체력과 성실함. 부상이 적고 무난하게 자라요" , injury: 0.7 },
  br: { name: "브라질 유스", flag: "🇧🇷", tag: "삼바 개인기", mul: { sho: 1.05, pas: 1, dri: 1.3, def: .85, sta: .95, spd: 1.1 },
        fame: 1.2, kit: ["#f6d23a", "#1f7a3c"], team: "히우 유스", desc: "드리블이 쑥쑥. 화려해서 명성이 잘 붙어요", injury: 1 },
  en: { name: "잉글랜드 아카데미", flag: "🇬🇧", tag: "피지컬과 속도", mul: { sho: 1.1, pas: .95, dri: .95, def: 1, sta: 1.15, spd: 1.25 },
        fame: 1.1, kit: ["#f2f2f2", "#1b2a6b"], team: "노스포트 아카데미", desc: "빠르고 강하게. 대신 몸싸움이 거칠어요", injury: 1.2 },
  es: { name: "스페인 유스", flag: "🇪🇸", tag: "패스 축구", mul: { sho: 1, pas: 1.3, dri: 1.1, def: 1, sta: .95, spd: .95 },
        fame: 1.0, kit: ["#7b1f3a", "#f2c14e"], team: "마레아 유스", desc: "패스와 시야. 미드필더에게 최고의 학교", injury: 1 },
};

/* 리그 — 전부 가상 클럽 */
const LEAGUES = [
  { id: 0, name: "K리그", flag: "🇰🇷", tier: 1, pay: 30, prestige: 1,
    clubs: [["서울 레드스톰", 68, "#c62f3a", "#111"], ["한강 유나이티드", 66, "#2a62c9", "#fff"], ["부산 해풍FC", 64, "#1c8fb5", "#fff"],
            ["인천 마린스", 62, "#14325c", "#59b4ff"], ["대구 스카이", 61, "#69b8f0", "#123"], ["울산 고래FC", 63, "#1a4ea0", "#ffd23f"],
            ["광주 썬더", 58, "#f2c21b", "#222"], ["전주 그린", 65, "#16733a", "#fff"], ["제주 오름FC", 57, "#ef7a1a", "#fff"], ["강원 산맥FC", 56, "#ff8c3a", "#16325c"]] },
  { id: 1, name: "네덜란드 리그", flag: "🇳🇱", tier: 2, pay: 80, prestige: 2,
    clubs: [["에인드 FC", 76, "#d6202a", "#fff"], ["하를럼 스타", 74, "#ffffff", "#c22"], ["즈볼 유나이티드", 70, "#2457b7", "#fff"],
            ["레이던 SV", 69, "#1f8a4c", "#fff"], ["브레다 킹스", 68, "#f6d23a", "#222"], ["틸뷔르 FC", 66, "#5a2a82", "#fff"],
            ["아른험 로버스", 67, "#111", "#ffd23f"], ["마스트리 VV", 64, "#e4572e", "#fff"], ["위트레 SC", 71, "#c8102e", "#fff"], ["델프 09", 63, "#0e6e8c", "#fff"]] },
  { id: 2, name: "프리미어 디비전", flag: "🇬🇧", tier: 3, pay: 220, prestige: 3,
    clubs: [["킹스브리지 유나이티드", 88, "#c8102e", "#fff"], ["노스포트 시티", 87, "#7fc4ee", "#123"], ["밀번 로버스", 84, "#1b3f94", "#fff"],
            ["하버시티 FC", 82, "#1c1c1c", "#ffd23f"], ["스톤게이트", 80, "#6a0d34", "#9ed0f0"], ["레드밀 FC", 79, "#e03030", "#111"],
            ["애쉬필드", 77, "#f5f5f5", "#122"], ["브라이트워터", 76, "#2d7ad6", "#fff"], ["웨스트홀름", 75, "#7a2b4a", "#9fd3ff"], ["크라운파크", 73, "#0b5b3a", "#fff"]] },
];

/* 세계 스타 (발롱도르 경쟁자) — 가상 인물 */
const WORLD_STARS = [
  ["마테오 칼데라", 91, 27], ["루카 반더르", 89, 29], ["엔조 모레티", 88, 25], ["카이 린드블롬", 88, 31],
  ["니코 델가도", 87, 24], ["티모 라이너", 86, 28], ["지안 포르테", 86, 30], ["다니 솔레르", 85, 23],
];

const KR_SUR = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const KR_GIVEN = ["도현", "시우", "주원", "하준", "은우", "서준", "민준", "지호", "예준", "선우", "태오", "건우", "로운", "이안", "유찬", "준혁"];
const EU_FIRST = ["리오", "카이", "마테오", "루카", "니코", "티모", "엔조", "다니", "알렉스", "파블로", "미로", "에릭"];
const EU_LAST = ["실바", "베르너", "포르테", "카스티요", "모레노", "반더르", "라이너", "델가도", "그레이", "할로", "솔레르", "아단"];

/* 라이벌 성격 */
const RIVAL_TYPES = [
  { id: "genius", name: "오만한 천재", quote: "너? 기억해 둘게. 내 하이라이트 배경으로.", mood: "😏" },
  { id: "grinder", name: "지독한 노력파", quote: "재능? 난 그런 거 몰라. 너보다 한 번 더 뛸 뿐이야.", mood: "😤" },
  { id: "showman", name: "타고난 쇼맨", quote: "카메라는 늘 나를 따라와. 너도 곧 알게 될 거야.", mood: "😎" },
];

/* 아바타 팔레트 */
const SKINS = ["#f6d7b8", "#eac09a", "#d39a6a", "#a8693f", "#7a4a2a"];
const HAIR_COLORS = ["#1b1b1b", "#4a2e1a", "#8a5a2b", "#d9b25a", "#c0392b", "#e8e8e8", "#3a6bd6"];
const HAIR_STYLES = ["짧은 머리", "투블럭", "곱슬", "장발", "모히칸", "삭발"];

/* 상점 */
const SHOP = [
  { id: "boots", name: "맞춤 축구화", emoji: "👟", desc: "슛·드리블 +2", price: [150, 500, 1500] },
  { id: "trainer", name: "개인 트레이너", emoji: "🧑‍🏫", desc: "훈련 효율 +10%", price: [300, 1000, 3000] },
  { id: "recovery", name: "회복 센터", emoji: "🧊", desc: "휴식 +8 · 훈련 피로 -2", price: [200, 700, 2000] },
];

const CAREER_GRADES = [
  [0, "🌱 짧지만 빛났던 커리어"], [200, "🧢 꾸준했던 주전"], [350, "💪 리그를 대표한 선수"],
  [550, "🌟 한 시대를 풍미한 선수"], [800, "👑 세계가 인정한 선수"], [1100, "🐐 축구 역사에 남을 레전드"],
  [1500, "🌍 축구사를 다시 쓴 선수"],
];

/* 받침에 맞는 조사 — josa("마테오", "이/가") → "마테오가" */
function josa(w, pair) {
  const c = String(w).charCodeAt(String(w).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  const [a, b] = pair.split("/");
  return w + (has ? a : b);
}
