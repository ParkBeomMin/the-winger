/* 더 윙어 2 - 아바타 그리기 (캔버스, 외부 그림 없음) */
"use strict";

/* look: { skin, hair, hairColor, number }  kit: [주색, 보조색]
 * (cx, top) 기준, size = 전체 높이 */
/* ---------- Muse 초상화 (assets/faces/pXX.webp) ----------
 * 셔츠는 마젠타로 그려져 있어서, 그릴 때 팀 유니폼 색으로 바꿔 입혀요 (명암은 그대로) */
const FACE_IDS = Array.from({ length: 20 }, (_, i) => "p" + String(i + 1).padStart(2, "0"));
const FACE_IMG = {};
const faceCache = new Map();
function preloadFaces() {
  if (typeof Image === "undefined") return;
  for (const id of FACE_IDS) { if (!FACE_IMG[id]) { const im = new Image(); im.src = `assets/faces/${id}.webp`; FACE_IMG[id] = im; } }
}
function faceReady(id) { const im = FACE_IMG[id]; return !!(im && im.complete && im.naturalWidth); }
function hexRgb(h) { const n = parseInt((h || "#888888").slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function faceSprite(id, kit) {
  const key = id + "|" + (kit ? kit[0] : "");
  if (faceCache.has(key)) return faceCache.get(key);
  if (!faceReady(id)) return null;
  const im = FACE_IMG[id], c = document.createElement("canvas");
  c.width = c.height = 320;
  const x = c.getContext("2d");
  x.drawImage(im, 0, 0, 320, 320);
  if (kit) {
    const d = x.getImageData(0, 0, 320, 320), p = d.data;
    let [kr, kg, kb] = hexRgb(kit[0]);
    // 아주 어두운 유니폼은 살짝 밝혀야 명암이 보여요
    const lum = (kr * .3 + kg * .59 + kb * .11);
    if (lum < 40) { kr += 30; kg += 30; kb += 30; }
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) continue;
      const r = p[i], g = p[i + 1], b = p[i + 2];
      const m = Math.min(r, b) - g;              // 마젠타다움
      if (m < 40) continue;
      const k = clamp((m - 40) / 80, 0, 1);       // 가장자리는 부드럽게 섞어요
      const shade = clamp((r + b) / 2 / 235, .25, 1.15);
      p[i] = Math.round(r * (1 - k) + clamp(kr * shade, 0, 255) * k);
      p[i + 1] = Math.round(g * (1 - k) + clamp(kg * shade, 0, 255) * k);
      p[i + 2] = Math.round(b * (1 - k) + clamp(kb * shade, 0, 255) * k);
    }
    x.putImageData(d, 0, 0);
  }
  faceCache.set(key, c);
  return c;
}

function drawAvatar(ctx, cx, top, size, look, kit, opt = {}) {
  if (look && look.face) {
    const sp = faceSprite(look.face, kit);
    if (sp) { ctx.drawImage(sp, cx - size / 2, top, size, size); return; }
  }
  const s = size / 112;
  const skin = SKINS[look.skin] || SKINS[0];
  const hc = HAIR_COLORS[look.hairColor] || HAIR_COLORS[0];
  const k1 = (kit && kit[0]) || "#2a62c9", k2 = (kit && kit[1]) || "#ffffff";
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(s, s);
  ctx.translate(0, 12);
  ctx.lineJoin = "round";

  // 몸통 (유니폼)
  ctx.fillStyle = k1;
  ctx.beginPath();
  ctx.moveTo(-34, 100); ctx.lineTo(-30, 74); ctx.quadraticCurveTo(-26, 62, -12, 60);
  ctx.lineTo(12, 60); ctx.quadraticCurveTo(26, 62, 30, 74); ctx.lineTo(34, 100); ctx.closePath();
  ctx.fill();
  // 소매 줄 / 목 칼라
  ctx.fillStyle = k2;
  ctx.beginPath(); ctx.moveTo(-10, 60); ctx.lineTo(0, 70); ctx.lineTo(10, 60); ctx.lineTo(6, 60); ctx.lineTo(0, 65); ctx.lineTo(-6, 60); ctx.closePath(); ctx.fill();
  ctx.fillRect(-33, 84, 6, 3); ctx.fillRect(27, 84, 6, 3);
  // 등번호
  if (look.number != null && !opt.noNumber) {
    ctx.fillStyle = k2;
    ctx.font = "bold 18px Jua, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(look.number), 0, 86);
  }
  // 목
  ctx.fillStyle = shade(skin, -12);
  ctx.fillRect(-7, 50, 14, 12);

  // 장발은 머리 뒤로
  if (look.hair === 3) {
    ctx.fillStyle = hc;
    ctx.beginPath(); ctx.ellipse(0, 36, 25, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-25, 30, 50, 22);
  }
  // 귀
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(-21, 33, 5, 0, Math.PI * 2); ctx.arc(21, 33, 5, 0, Math.PI * 2); ctx.fill();
  // 얼굴
  ctx.beginPath(); ctx.ellipse(0, 31, 20, 23, 0, 0, Math.PI * 2); ctx.fill();

  // 머리카락
  ctx.fillStyle = hc;
  switch (look.hair) {
    case 0: // 짧은 머리
      ctx.beginPath(); ctx.ellipse(0, 16, 21, 13, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-21, 17); ctx.quadraticCurveTo(-6, 10, 4, 18); ctx.quadraticCurveTo(14, 10, 21, 17); ctx.lineTo(21, 12); ctx.lineTo(-21, 12); ctx.fill();
      ctx.fillRect(-21, 12, 4, 12); ctx.fillRect(17, 12, 4, 12);
      break;
    case 1: // 투블럭
      ctx.beginPath(); ctx.ellipse(0, 14, 22, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-22, 14); ctx.quadraticCurveTo(-4, 24, 22, 12); ctx.lineTo(22, 10); ctx.lineTo(-22, 10); ctx.fill();
      ctx.globalAlpha = .45; ctx.fillRect(-20, 14, 3, 14); ctx.fillRect(17, 14, 3, 14); ctx.globalAlpha = 1;
      break;
    case 2: // 곱슬
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(i * 5, 9 + Math.abs(i) * 1.6, 7, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 6, 3 + Math.abs(i), 6, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 3: // 장발 (앞머리)
      ctx.beginPath(); ctx.ellipse(0, 14, 22, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-22, 14); ctx.quadraticCurveTo(-10, 22, 0, 12); ctx.quadraticCurveTo(10, 22, 22, 14); ctx.lineTo(22, 10); ctx.lineTo(-22, 10); ctx.fill();
      break;
    case 4: // 모히칸
      ctx.beginPath(); ctx.moveTo(-7, 16); ctx.lineTo(-5, -6); ctx.lineTo(0, -10); ctx.lineTo(5, -6); ctx.lineTo(7, 16); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .35; ctx.beginPath(); ctx.ellipse(0, 16, 20, 11, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      break;
    case 5: // 삭발
      ctx.globalAlpha = .4; ctx.beginPath(); ctx.ellipse(0, 18, 20, 12, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      break;
  }
  if (opt.headband) { ctx.fillStyle = k2; ctx.fillRect(-21, 16, 42, 4); }

  // 눈썹
  ctx.strokeStyle = shade(hc, 0); ctx.lineWidth = 2.4; ctx.lineCap = "round";
  const brow = opt.mood === "angry" ? 3 : opt.mood === "smug" ? -1 : 0;
  ctx.beginPath(); ctx.moveTo(-13, 24 - brow); ctx.lineTo(-5, 24 + brow); ctx.moveTo(13, 24 - brow); ctx.lineTo(5, 24 + brow); ctx.stroke();
  // 눈
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath(); ctx.ellipse(-9, 31, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.ellipse(9, 31, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(-8.2, 30, 1, 0, Math.PI * 2); ctx.arc(9.8, 30, 1, 0, Math.PI * 2); ctx.fill();
  // 볼
  ctx.fillStyle = "rgba(240,110,110,.25)";
  ctx.beginPath(); ctx.ellipse(-13, 39, 4, 2.4, 0, 0, Math.PI * 2); ctx.ellipse(13, 39, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  // 입
  ctx.strokeStyle = "#5a2a1a"; ctx.lineWidth = 2;
  ctx.beginPath();
  if (opt.mood === "smug") { ctx.moveTo(-5, 43); ctx.quadraticCurveTo(2, 46, 7, 41); }
  else if (opt.mood === "angry") { ctx.moveTo(-5, 45); ctx.quadraticCurveTo(0, 42, 5, 45); }
  else if (opt.mood === "joy") { ctx.fillStyle = "#5a2a1a"; ctx.moveTo(-6, 41); ctx.quadraticCurveTo(0, 49, 6, 41); ctx.closePath(); ctx.fill(); }
  else { ctx.moveTo(-5, 42); ctx.quadraticCurveTo(0, 46, 5, 42); }
  ctx.stroke();
  ctx.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/* 작은 캔버스 하나에 아바타를 그려 돌려줘요 */
function avatarCanvas(look, kit, px = 64, opt = {}) {
  const c = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = px * dpr; c.height = px * dpr;
  c.style.width = px + "px"; c.style.height = px + "px";
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const paint = () => { ctx.clearRect(0, 0, px, px); look && look.face && faceReady(look.face) ? drawAvatar(ctx, px / 2, 0, px, look, kit, opt) : drawAvatar(ctx, px / 2, px * 0.06, px * 0.94, look, kit, opt); };
  paint();
  if (look && look.face && !faceReady(look.face) && FACE_IMG[look.face]) FACE_IMG[look.face].addEventListener("load", paint, { once: true });
  return c;
}

/* ---------- 구단 엠블럼 ----------
 * Muse로 만든 엠블럼(assets/crests/crest_리그_번호.webp)이 있으면 그걸, 없으면 유니폼 색 방패를 그려요 */
function crestId(club) {
  if (CREST_ID[club]) return CREST_ID[club];
  return null;
}
const CREST_ID = {}, CREST_KIT = {};
LEAGUES.forEach((l) => l.clubs.forEach((c, i) => { CREST_ID[c[0]] = `crest_${l.id}_${i}`; CREST_KIT[c[0]] = [c[2], c[3]]; }));
function crestKit(club) { return CREST_KIT[club] || null; }
function crestHTML(club, size = 22, cls = "") {
  const id = crestId(club);
  if (!id) return "";
  if (typeof CREST_READY !== "undefined" && CREST_READY.has(id)) return `<img class="crest-img ${cls}" src="assets/crests/${id}.webp" width="${size}" height="${size}" alt="" loading="lazy" />`;
  const [a, b] = crestKit(club);
  const ch = club.replace(/^(FC|SC)\s*/, "").slice(0, 1);
  return `<svg class="crest-img ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2.5h18v8.5c0 6.5-4.6 10.2-9 12-4.4-1.8-9-5.5-9-12z" fill="${a}" stroke="${b}" stroke-width="1.6"/><path d="M3 9.5h18v2.6H3z" fill="${b}" opacity=".55"/><text x="12" y="16.2" text-anchor="middle" font-size="9" font-family="Jua,sans-serif" fill="${b === a ? "#fff" : b}" stroke="rgba(0,0,0,.35)" stroke-width=".4">${ch}</text></svg>`;
}
