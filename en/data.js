/* 더 윙어 2 : 라이벌 - 데이터 */
"use strict";

const VERSION = "v1.6 beta";

const STATS = [
  { key: "sho", name: "Shooting", emoji: "⚽", desc: "Finishing & composure" },
  { key: "pas", name: "Passing", emoji: "🎯", desc: "Vision & link-up" },
  { key: "dri", name: "Dribbling", emoji: "🏃", desc: "Take-ons & skills" },
  { key: "def", name: "Defense", emoji: "🛡️", desc: "Tackling & positioning" },
  { key: "sta", name: "Stamina", emoji: "🫀", desc: "Endurance & recovery" },
  { key: "spd", name: "Speed", emoji: "⚡", desc: "Acceleration & burst" },
];
const STAT_KEYS = STATS.map((s) => s.key);
const STAT_NAME = Object.fromEntries(STATS.map((s) => [s.key, s.name]));

const POS = {
  fw: { name: "Forward", short: "FW", emoji: "⚽", w: { sho: .36, spd: .2, dri: .2, pas: .1, sta: .1, def: .04 },
        moments: ["shot", "shot", "dribble", "pass", "shot", "dribble"], desc: "The front line that talks with goals" },
  wg: { name: "Winger", short: "WG", emoji: "🏃", w: { dri: .3, spd: .28, sho: .17, pas: .15, sta: .1, def: 0 },
        moments: ["dribble", "dribble", "shot", "pass", "shot"], desc: "Breaking down the flanks" },
  mf: { name: "Midfielder", short: "MF", emoji: "🎯", w: { pas: .36, sta: .2, dri: .15, def: .14, sho: .1, spd: .05 },
        moments: ["pass", "pass", "shot", "tackle", "dribble"], desc: "Running the game from midfield" },
  df: { name: "Defender", short: "DF", emoji: "🛡️", w: { def: .45, sta: .2, spd: .15, pas: .15, sho: 0, dri: .05 },
        moments: ["tackle", "tackle", "tackle", "pass", "shot"], desc: "The shield guarding the goal" },
};

/* 유스 출신 — 스탯별 훈련 배수, 시작 보너스, 유스팀 유니폼 */
const ORIGINS = {
  kr: { name: "K League Youth", flag: "🇰🇷", tag: "Steady growth", mul: { sho: 1, pas: 1.05, dri: 1, def: 1.1, sta: 1.15, spd: 1 },
        nat: "kr", fame: 0.9, kit: ["#d93a3a", "#ffffff"], team: "Hangang Youth", desc: "Stamina and grit. Few injuries, grows steadily" , injury: 0.7 },
  br: { name: "Brazil Youth", flag: "🇧🇷", tag: "Samba skills", mul: { sho: 1.05, pas: 1, dri: 1.3, def: .85, sta: .95, spd: 1.1 },
        nat: "br", fame: 1.2, kit: ["#f6d23a", "#1f7a3c"], team: "Rio Youth", desc: "Dribbling shoots up. Flashy play earns Fame fast", injury: 1 },
  en: { name: "England Academy", flag: "🇬🇧", tag: "Physique and speed", mul: { sho: 1.1, pas: .95, dri: .95, def: 1, sta: 1.15, spd: 1.25 },
        nat: "en", fame: 1.1, kit: ["#f2f2f2", "#1b2a6b"], team: "Northport Academy", desc: "Fast and strong. But rough in physical duels", injury: 1.2 },
  es: { name: "Spain Youth", flag: "🇪🇸", tag: "Passing football", mul: { sho: 1, pas: 1.3, dri: 1.1, def: 1, sta: .95, spd: .95 },
        nat: "es", fame: 1.0, kit: ["#7b1f3a", "#f2c14e"], team: "Marea Youth", desc: "Passing and vision. The best school for midfielders", injury: 1 },
};

/* 리그 — 전부 가상 클럽. mix: 그 리그 선수들의 국적 비율 */
const LEAGUES = [
  { id: 0, name: "K League 1", flag: "🇰🇷", nat: "kr", tier: 1, pay: 30, prestige: 1, mix: [["kr", 86], ["br", 6], ["jp", 3], ["pt", 2], ["ar", 3]],
    clubs: [["Seoul Redstorm", 68, "#c62f3a", "#111"], ["Hangang United", 66, "#2a62c9", "#fff"], ["Busan Sea Breeze FC", 64, "#1c8fb5", "#fff"],
            ["Incheon Marines", 62, "#14325c", "#59b4ff"], ["Daegu Sky", 61, "#69b8f0", "#123"], ["Ulsan Whales FC", 65, "#1a4ea0", "#ffd23f"],
            ["Gwangju Thunder", 58, "#f2c21b", "#222"], ["Jeonju Green", 67, "#16733a", "#fff"], ["Jeju Oreum FC", 59, "#ef7a1a", "#fff"], ["Gangwon Ridge FC", 57, "#ff8c3a", "#16325c"]] },
  { id: 1, name: "J.League", flag: "🇯🇵", nat: "jp", tier: 1, pay: 34, prestige: 1, mix: [["jp", 85], ["br", 8], ["kr", 4], ["es", 3]],
    clubs: [["Yokohama Blue Wind", 69, "#1c3f94", "#fff"], ["Kawasaki Frontiers", 68, "#2c9fd6", "#111"], ["Osaka Cherry FC", 65, "#e05a8a", "#fff"],
            ["Nagoya Grampustone", 64, "#d6202a", "#ffd23f"], ["Kashima Antlers", 66, "#8a1c2b", "#fff"], ["Urawa Red Diamonds", 67, "#c8102e", "#111"],
            ["Sapporo Snow", 60, "#222", "#e03030"], ["Fukuoka Wave", 61, "#1a4ea0", "#c0c0c0"], ["Sendai Gold", 58, "#f2c21b", "#1c3f94"], ["Kyoto Purple Sanga", 62, "#5a2a82", "#fff"]] },
  { id: 2, name: "Dutch League", flag: "🇳🇱", nat: "nl", tier: 2, pay: 80, prestige: 2, mix: [["nl", 55], ["br", 8], ["de", 8], ["fr", 6], ["kr", 4], ["jp", 5], ["ar", 4], ["es", 4], ["en", 6]],
    clubs: [["Eind FC", 77, "#d6202a", "#fff"], ["Haarlem Star", 75, "#ffffff", "#c22"], ["Zwolle United", 70, "#2457b7", "#fff"],
            ["Leiden SV", 69, "#1f8a4c", "#fff"], ["Breda Kings", 68, "#f6d23a", "#222"], ["Tilburg FC", 66, "#5a2a82", "#fff"],
            ["Arnhem Rovers", 67, "#111", "#ffd23f"], ["Maastricht VV", 64, "#e4572e", "#fff"], ["Utrecht SC", 72, "#c8102e", "#fff"], ["Delft 09", 63, "#0e6e8c", "#fff"]] },
  { id: 3, name: "Portuguese League", flag: "🇵🇹", nat: "pt", tier: 2, pay: 85, prestige: 2, mix: [["pt", 50], ["br", 22], ["ar", 8], ["es", 6], ["fr", 5], ["jp", 3], ["kr", 3], ["nl", 3]],
    clubs: [["Lisboa Eagles", 78, "#c8102e", "#fff"], ["Porto Dragons", 77, "#1c3f94", "#fff"], ["Braga Warriors", 72, "#e03030", "#fff"],
            ["Lisboa Lions", 75, "#16733a", "#fff"], ["Guimarães FC", 68, "#fff", "#111"], ["Coimbra Académica", 64, "#111", "#fff"],
            ["Faro Ocean", 62, "#2c9fd6", "#fff"], ["Madeira SC", 63, "#1f8a4c", "#ffd23f"], ["Aveiro FC", 65, "#1a4ea0", "#ffd23f"], ["Setúbal Vitória", 66, "#222", "#1f8a4c"]] },
  { id: 4, name: "Spanish Liga", flag: "🇪🇸", nat: "es", tier: 3, pay: 210, prestige: 3, mix: [["es", 48], ["ar", 10], ["br", 10], ["fr", 9], ["pt", 5], ["de", 4], ["en", 4], ["nl", 4], ["kr", 3], ["jp", 3]],
    clubs: [["Madrid Royal", 86, "#ffffff", "#d4af37"], ["Barcelo Blau", 85, "#1c3f94", "#a50044"], ["Madrid Atlético", 81, "#c8102e", "#fff"],
            ["Sevilla Estrella", 77, "#fff", "#d6202a"], ["Valencia Orange", 75, "#111", "#ff8c3a"], ["Bilbao Leones", 76, "#e03030", "#fff"],
            ["Villa Yellow", 74, "#f6d23a", "#1c3f94"], ["Sociedad Blue", 75, "#2c9fd6", "#fff"], ["Bética Verde", 74, "#1f8a4c", "#fff"], ["Celta Sky", 71, "#9fd3ff", "#c8102e"]] },
  { id: 5, name: "Premier Division", flag: "🇬🇧", nat: "en", tier: 3, pay: 220, prestige: 3, mix: [["en", 40], ["fr", 9], ["br", 8], ["es", 7], ["pt", 6], ["ar", 6], ["nl", 6], ["de", 6], ["kr", 4], ["jp", 3], ["it", 5]],
    clubs: [["Kingsbridge United", 86, "#c8102e", "#fff"], ["Northport City", 85, "#7fc4ee", "#123"], ["Milburn Rovers", 82, "#1b3f94", "#fff"],
            ["Harbour City FC", 80, "#1c1c1c", "#ffd23f"], ["Stonegate", 78, "#6a0d34", "#9ed0f0"], ["Redmill FC", 77, "#e03030", "#111"],
            ["Ashfield", 75, "#f5f5f5", "#122"], ["Brightwater", 74, "#2d7ad6", "#fff"], ["Westholm", 73, "#7a2b4a", "#9fd3ff"], ["Crown Park", 71, "#0b5b3a", "#fff"]] },
];
const TIER_OF = (lgId) => LEAGUES[lgId].tier;

/* 대륙컵 — 지난 시즌 순위 상위 팀이 나가요. at: 그 리그 라운드가 끝난 뒤 열리는 단계 */
const CUPS = {
  eu: { name: "Champions Cup", emoji: "🏆", leagues: [2, 3, 4, 5], spots: [1, 1, 3, 3], at: [6, 12, 17], prize: [150, 300, 800], weight: 3 },
  as: { name: "Asian Champions Cup", emoji: "🌏", leagues: [0, 1], spots: [2, 2], at: [8, 16], prize: [60, 150], weight: 1.5 },
};
const CUP_STAGE = { 8: "Quarter-final", 4: "Semi-final", 2: "Final" };

/* 국적 — 이름은 그 나라 말맛을 살린 가상 조합이에요 */
const NATIONS = {
  kr: { name: "South Korea", flag: "🇰🇷" }, jp: { name: "Japan", flag: "🇯🇵" }, br: { name: "Brazil", flag: "🇧🇷" }, ar: { name: "Argentina", flag: "🇦🇷" },
  es: { name: "Spain", flag: "🇪🇸" }, pt: { name: "Portugal", flag: "🇵🇹" }, en: { name: "England", flag: "🏴" }, fr: { name: "France", flag: "🇫🇷" },
  de: { name: "Germany", flag: "🇩🇪" }, nl: { name: "Netherlands", flag: "🇳🇱" }, it: { name: "Italy", flag: "🇮🇹" },
};
NATIONS.en.flag = "🇬🇧";
const NAME_POOL = {
  jp: [["Haruto", "Sota", "Yuto", "Ren", "Daiki", "Kaito", "Hiro", "Ryo", "Shinji", "Kento", "Aoi", "Takumi", "Yuma", "Kota"], ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Mori", "Ishikawa", "Maeda"]],
  br: [["Gabriel", "Lucas", "Matheus", "Rafael", "Tiago", "Felipe", "Bruno", "Diego", "Everton", "Raul", "Vini", "Caio", "Danilo", "Júnior"], ["Silva", "Santos", "Oliveira", "Souza", "Ferreira", "Costa", "Rodrigues", "Almeida", "Lima", "Carvalho", "Gomes", "Menezes"]],
  ar: [["Matías", "Nicolás", "Ezequiel", "Gonzalo", "Facundo", "Enzo", "Rodrigo", "Mauro", "Leandro", "Julián", "Agustín"], ["Fernández", "González", "Rodríguez", "López", "Díaz", "Martínez", "Pérez", "Álvarez", "Romero", "Suárez"]],
  es: [["Alejandro", "Pablo", "Daniel", "Adrián", "Javier", "Sergio", "Iker", "Marcos", "Unai", "Álvaro", "Pedro", "Mikel"], ["García", "López", "Sánchez", "Romero", "Navarro", "Torres", "Ruiz", "Moreno", "Jiménez", "Molina", "Castillo", "Ortiz"]],
  pt: [["João", "Tiago", "Diogo", "Rúben", "Nuno", "Gonçalo", "Rafael", "André", "Bernardo", "Rafa", "Miguel"], ["Ferreira", "Correia", "Pires", "Marques", "Nunes", "Mendes", "Carvalho", "Soares", "Moreira", "Rocha"]],
  en: [["Jack", "Harry", "Oliver", "Charlie", "Mason", "George", "Thomas", "William", "James", "Declan", "Reece", "Connor"], ["Smith", "Jones", "Taylor", "Brown", "Walker", "Wright", "Green", "Hall", "Wood", "Clarke", "Hughes", "Baker"]],
  fr: [["Antoine", "Théo", "Kylian", "Hugo", "Lucas", "Mathis", "Rafael", "Olivier", "Adrien", "Nolan", "Baptiste"], ["Martin", "Bernard", "Dubois", "Leroux", "Moreau", "Laurent", "Girard", "Bonnet", "Lefebvre", "Fontaine", "Durand"]],
  de: [["Lucas", "Leon", "Finn", "Jonas", "Niklas", "Tim", "Julian", "Kai", "Maxi", "Florian", "Yannick"], ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch"]],
  nl: [["Daan", "Sem", "Luca", "Memphis", "Frenkie", "Matthijs", "Steven", "Denny", "Jasper", "Timmy"], ["De Jong", "Jansen", "De Vries", "Van der Berg", "Bakker", "Visser", "Smit", "Meijer", "De Baar", "Bos"]],
  it: [["Marco", "Lorenzo", "Federico", "Alessandro", "Niccolò", "Davide", "Matteo", "Gianluca", "Andrea"], ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"]],
};
NAME_POOL.nl[0][1] = "Sem";
/* 세계 스타 (발롱도르 경쟁자) — 가상 인물 */
const WORLD_STARS = [
  ["Matteo Caldera", 91, 27], ["Luca Vander", 89, 29], ["Enzo Moretti", 88, 25], ["Kai Lindblom", 88, 31],
  ["Nico Delgado", 87, 24], ["Timo Reiner", 86, 28], ["Gian Forte", 86, 30], ["Dani Soler", 85, 23],
];

const KR_SUR = ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Jo", "Yoon", "Jang", "Lim", "Han", "Oh", "Seo", "Shin", "Kwon"];
const KR_GIVEN = ["Dohyun", "Siwoo", "Juwon", "Hajun", "Eunwoo", "Seojun", "Minjun", "Jiho", "Yejun", "Sunwoo", "Taeo", "Gunwoo", "Rowoon", "Ian", "Yuchan", "Junhyuk"];
const EU_FIRST = ["Rio", "Kai", "Matteo", "Luca", "Nico", "Timo", "Enzo", "Dani", "Alex", "Pablo", "Miro", "Eric"];
const EU_LAST = ["Silva", "Werner", "Forte", "Castillo", "Moreno", "Vander", "Reiner", "Delgado", "Grey", "Harlow", "Soler", "Adan"];

/* 라이벌 성격 */
const RIVAL_TYPES = [
  { id: "genius", name: "Arrogant Genius", quote: "You? I'll remember you. As the backdrop to my highlights.", mood: "😏" },
  { id: "grinder", name: "Relentless Grinder", quote: "Talent? Never heard of it. I just run one more time than you.", mood: "😤" },
  { id: "showman", name: "Born Showman", quote: "The cameras always follow me. You'll see soon enough.", mood: "😎" },
];

/* 아바타 팔레트 */
const SKINS = ["#f6d7b8", "#eac09a", "#d39a6a", "#a8693f", "#7a4a2a"];
const HAIR_COLORS = ["#1b1b1b", "#4a2e1a", "#8a5a2b", "#d9b25a", "#c0392b", "#e8e8e8", "#3a6bd6"];
const HAIR_STYLES = ["Short hair", "Two-block", "Curly", "Long hair", "Mohawk", "Buzz cut"];

/* 상점 */

const CAREER_GRADES = [
  [0, "🌱 A short but shining career"], [260, "🧢 A reliable regular starter"], [460, "💪 One of the league's finest"],
  [700, "🌟 A star who defined an era"], [1000, "👑 Recognized by the whole world"], [1400, "🐐 A legend for the history books"],
  [1900, "🌍 The one who rewrote football history"],
];

/* 받침에 맞는 조사 — josa("마테오", "이/가") → "마테오가" */
function josa(w, pair) {
  const c = String(w).charCodeAt(String(w).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  const [a, b] = pair.split("/");
  return w + (has ? a : b);
}

/* Muse 엠블럼이 준비된 구단 (assets/crests/) */
const CREST_READY = new Set(["crest_0_0","crest_0_1","crest_0_2","crest_0_3","crest_0_4","crest_0_5","crest_0_6","crest_0_7","crest_0_8","crest_0_9","crest_1_0","crest_1_1","crest_1_2","crest_1_3","crest_1_4","crest_1_5","crest_1_6","crest_1_7","crest_1_8","crest_1_9","crest_2_0","crest_2_1","crest_2_2","crest_2_3","crest_2_4","crest_2_5","crest_2_6","crest_2_7","crest_2_8","crest_2_9","crest_3_0","crest_3_1","crest_3_2","crest_3_3","crest_3_4","crest_3_5","crest_3_6","crest_3_7","crest_3_8","crest_3_9","crest_4_0","crest_4_1","crest_4_2","crest_4_3","crest_4_4","crest_4_5","crest_4_6","crest_4_7","crest_4_8","crest_4_9","crest_5_0","crest_5_1","crest_5_2","crest_5_3","crest_5_4","crest_5_5","crest_5_6","crest_5_7","crest_5_8","crest_5_9"]);
