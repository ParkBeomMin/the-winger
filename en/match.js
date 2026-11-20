/* 더 윙어 2 - 2D 경기 시뮬레이션 + 승부처 미니게임 + 리플레이 */
"use strict";

/* ---------- 효과음 (WebAudio, 외부 파일 없음) ---------- */
const Sfx = (() => {
  let ac = null, muted = localStorage.getItem("w2-mute") === "1";
  function ctx() {
    if (muted) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function tone(f, d, type = "sine", vol = .15, slide = 0) {
    const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, a.currentTime);
    if (slide) o.frequency.linearRampToValueAtTime(f + slide, a.currentTime + d);
    g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + d);
  }
  function noise(d, vol = .2, freq = 900, q = .7, swell = false) {
    const a = ctx(); if (!a) return;
    const len = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    if (swell) { g.gain.setValueAtTime(.001, a.currentTime); g.gain.linearRampToValueAtTime(vol, a.currentTime + d * .35); g.gain.linearRampToValueAtTime(.001, a.currentTime + d); }
    else { g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + d); }
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  return {
    get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem("w2-mute", muted ? "1" : "0"); return muted; },
    whistle(long) { tone(2900, long ? .7 : .28, "sine", .08, 0); setTimeout(() => tone(3100, long ? .5 : .2, "sine", .06), long ? 120 : 60); },
    kick() { noise(.08, .35, 300, 1.5); },
    goal() { noise(2.2, .22, 700, .5, true); tone(523, .15, "triangle", .12); setTimeout(() => tone(659, .15, "triangle", .12), 130); setTimeout(() => tone(784, .3, "triangle", .14), 260); },
    miss() { noise(1, .12, 400, .6, true); tone(300, .35, "sawtooth", .05, -120); },
    tap() { tone(880, .06, "square", .05); },
    good() { tone(660, .1, "triangle", .1); setTimeout(() => tone(990, .16, "triangle", .1), 90); },
    bad() { tone(220, .25, "sawtooth", .06, -60); },
  };
})();

/* ---------- 유틸 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
function poisson(lam) { let L = Math.exp(-lam), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* 잔디색과 비슷한 유니폼은 보조색으로 칠해요 */
function nearGrass(c) { const n = parseInt(c.slice(1), 16); return Math.hypot((n >> 16) - 42, ((n >> 8) & 255) - 127, (n & 255) - 68) < 70; }

/* 4-3-3, 홈이 오른쪽으로 공격 */
const FORMATION = [[.05, .5], [.22, .14], [.2, .38], [.2, .62], [.22, .86], [.42, .3], [.38, .5], [.42, .7], [.64, .18], [.68, .5], [.64, .82]];
const SLOT_BY_POS = { fw: 9, wg: 10, mf: 6, df: 2 };

const MINI_LABEL = {
  shot: { title: "⚽ Shot chance!", hint: "Tap an open spot in the goal! The keeper dives" },
  pass: { title: "🎯 Killer pass on!", hint: "Quickly tap the unmarked teammate" },
  dribble: { title: "🏃 1v1 take-on!", hint: "Tap when the bar hits the green zone" },
  tackle: { title: "🛡️ Counterattack!", hint: "Read which way they'll go and tap" },
};

/* ---------- 경기 ----------
 * cfg = { title, home:{name,kit,str}, away:{name,kit,str}, me:{name,look,pos,stats,form,cond,ovr,starter},
 *         rival:{name,look,ovr,side:"away"|"home"}|null, auto:bool }
 * 결과 Promise → { gf, ga, res, goals, assists, saves, moments:[{type,ok}], rating, mom, events:[] } */
function playMatch(root, cfg) {
  return new Promise((resolve) => {
    const me = cfg.me;
    const mySide0 = cfg.mySide || "home";
    const myT0 = mySide0 === "home" ? cfg.m.H : cfg.m.A, opT0 = mySide0 === "home" ? cfg.m.A : cfg.m.H;
    const roster = { home: [...myT0.xi], away: [...opT0.xi] };          // 화면 슬롯 순서 = 포메이션 자리 순서
    const formOfSide = { home: myT0.form || "4-3-3", away: opT0.form || "4-3-3" };
    let mySlot = roster.home.findIndex((p) => p.id === "me");
    if (mySlot < 0) { const s = myT0.subs.find((x) => x.in.id === "me"); mySlot = s ? roster.home.indexOf(s.out) : -1; }
    if (mySlot < 0) mySlot = 99;
    const homeStr = cfg.home.str || 60, awayStr = cfg.away.str || 60;
    let auto = !!cfg.auto, speed = 1, skipping = false;

    root.innerHTML = `
      <div class="m-board">
        <div class="m-team home">${crestId(cfg.home.name) ? crestHTML(cfg.home.name, 20) : `<i style="background:${cfg.home.kit[0]}"></i>`}${esc(cfg.home.name)}</div>
        <div class="m-score"><b id="m-gf">0</b><span>:</span><b id="m-ga">0</b><small id="m-min">0'</small></div>
        <div class="m-team away">${esc(cfg.away.name)}${crestId(cfg.away.name) ? crestHTML(cfg.away.name, 20) : `<i style="background:${cfg.away.kit[0]}"></i>`}</div>
      </div>
      <div class="m-pitch-wrap"><canvas class="m-pitch"></canvas><div class="m-overlay" hidden></div><div class="m-flash" hidden></div></div>
      <div class="m-ctrl">
        <button class="auto-sw ${auto ? "on" : ""}" id="m-auto" role="switch" aria-checked="${auto}"><span class="sw"><i></i></span><span class="sw-txt"><b>Key moment</b><em>${auto ? "🤖 Auto" : "🎮 Manual"}</em></span></button>
        <div class="m-spd"><button data-s="1" class="on">1x</button><button data-s="2">2x</button><button data-s="4">4x</button><button id="m-skip">⏭️ Result</button></div>
      </div>
      <div class="m-feed" id="m-feed"></div>
      <div class="m-result" id="m-result" hidden></div>`;
    const cv = root.querySelector(".m-pitch"), wrap = root.querySelector(".m-pitch-wrap");
    const overlay = root.querySelector(".m-overlay"), flash = root.querySelector(".m-flash");
    const feedEl = root.querySelector("#m-feed");
    const ctx = cv.getContext("2d");
    let W = 0, H = 0;
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth || 360; H = Math.round(W * 0.6);
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const autoBtn = root.querySelector("#m-auto");
    const paintAuto = () => { autoBtn.classList.toggle("on", auto); autoBtn.setAttribute("aria-checked", auto); autoBtn.querySelector("em").textContent = auto ? "🤖 Auto" : "🎮 Manual"; };
    autoBtn.onclick = () => { auto = !auto; paintAuto(); Sfx.tap(); cfg.onAutoChange && cfg.onAutoChange(auto); };
    root.querySelectorAll(".m-spd [data-s]").forEach((b) => b.onclick = () => {
      speed = +b.dataset.s; root.querySelectorAll(".m-spd [data-s]").forEach((x) => x.classList.toggle("on", x === b));
    });
    root.querySelector("#m-skip").onclick = () => { skipping = true; auto = true; speed = 40; paintAuto(); };

    /* --- 선수: 진짜 축구처럼 ---
     * 대형을 유지한 채 공 위치에 따라 라인 전체가 오르내리고 좌우로 쏠려요.
     * 공 가진 선수는 드리블·패스를 고르고, 가장 가까운 수비는 압박, 다음 수비는 커버,
     * 공격 3선은 박스 근처에서 침투해요. 패스는 실제로 날아가고, 길목에 수비가 있으면 끊겨요. */
    const DIR = { home: 1, away: -1 };
    const other = (s) => s === "home" ? "away" : "home";
    function kickPos(side, bx) { return side === "home" ? Math.min(bx * .9, .46) : Math.max(1 - (1 - bx) * .9, .54); }
    function mkTeam(side) {
      const F = FORMS[formOfSide[side]] || FORMS["4-3-3"];
      return roster[side].map((_, i) => F.pos[i] || F.pos[F.pos.length - 1]).map((f, i) => {
        const bx = side === "home" ? f[0] : 1 - f[0], by = side === "home" ? f[1] : 1 - f[1];
        return { i, side, role: (FORMS[formOfSide[side]] || FORMS["4-3-3"]).roles[i] || "mf", bx, by, x: kickPos(side, bx), y: by, vx: 0, vy: 0, ph: Math.random() * 6, runT: 0 };
      });
    }
    const teams = { home: mkTeam("home"), away: mkTeam("away") };
    const rvSide = cfg.rival ? cfg.rival.side || "away" : null;
    const rivalSlot = rvSide ? roster[rvSide].findIndex((p) => p.id === "rv") : -1;
    let onPitch = !!me.starter;                         // 벤치면 교체 시간에 들어와요
    const subMin = me.starter ? 0 : (me.subMin ?? 999);

    let possession = "home", ball = { x: .5, y: .5 };
    let carrier = teams.home[9], flight = null, decide = .6, director = null;
    let minute = 0, paused = true, zoom = 1, zoomTarget = 1, focus = null;
    let seq = null, trail = [], replayMode = false, banner = null;
    let gf = 0, ga = 0;
    const st = { goals: 0, assists: 0, saves: 0, moments: [], events: [], ge: [] };
    const strOf = (s) => s === "home" ? homeStr : awayStr;
    const isMeP = (p) => p.side === "home" && roster.home[p.i] && roster.home[p.i].id === "me";
    const active = (p) => !p.gone && !(isMeP(p) && !onPitch);
    const fwdIdx = (side) => { const t = teams[side]; const f = t.find((p) => p.role === "fw" && active(p)) || t.find((p) => p.role !== "gk" && active(p)); return f || t[t.length - 1]; };
    const numOf = (side, i) => { const p = roster[side][i]; if (!p) return ""; return p.id === "me" ? (me.look && me.look.number) || "" : p.id === "rv" ? (cfg.rival && cfg.rival.number) || "" : p.no || ""; };
    const shortN = (n) => { const s = String(n || ""); return s.includes(" ") ? s.split(" ").slice(-1)[0] : s; };
    const dist = (a, b) => Math.hypot((a.x - b.x) * 1.6, a.y - b.y);   // 경기장이 가로로 길어서 x를 늘려 재요
    const nearest = (side, pt, excl) => { let best = null, bd = 9; for (const p of teams[side]) { if (!active(p) || p === excl) continue; const d = dist(p, pt); if (d < bd) { bd = d; best = p; } } return [best, bd]; };
    const progOf = (side, x) => side === "home" ? x : 1 - x;   // 0 = 우리 골문, 1 = 상대 골문

    function kickoff(side) {
      for (const s of ["home", "away"]) for (const p of teams[s]) { p.x = kickPos(s, p.bx); p.y = p.by; p.vx = p.vy = 0; }
      possession = side; carrier = fwdIdx(side); carrier.x = .5 - DIR[side] * .01; carrier.y = .5;
      flight = null; ball = { x: .5, y: .5 }; decide = .5;
    }
    function goalKick(side) {
      possession = side; carrier = teams[side][0]; flight = null;
      ball = { x: carrier.x, y: carrier.y }; decide = .7;
    }
    function passTo(from, to, lofted) {
      const tgt = { x: to.x + DIR[to.side] * .03, y: to.y };
      const d = dist(from, tgt);
      // 길목 차단: 패스 경로 가운데 근처의 상대
      const mid = { x: (from.x + tgt.x) / 2, y: (from.y + tgt.y) / 2 };
      const [cut, cd] = nearest(other(from.side), mid);
      let recv = to;
      const cutP = lofted ? .1 : clamp(.5 - cd * 9, 0, .45) * Math.exp((strOf(other(from.side)) - strOf(from.side)) / 30);
      if (cut && Math.random() < cutP) recv = cut;
      flight = { from: { x: ball.x, y: ball.y }, to: recv === to ? tgt : { x: cut.x, y: cut.y }, t: 0, dur: clamp(d / .55, .25, 1.4), recv };
      carrier = null; Sfx.kick && d > .25 && Sfx.kick();
    }
    function carrierDecide() {
      const c = carrier, s = c.side, d = DIR[s], opp = other(s);
      const [presser, pd] = nearest(opp, c);
      // 감독(시간표): 곧 찬스가 나는 쪽으로 흐름을 몰아줘요
      const want = director && director.min - minute < 3 ? director.side : null;
      let loseP = pd < .05 ? .28 * Math.exp((strOf(opp) - strOf(s)) / 25) : .03;
      if (want && want !== s) loseP = Math.max(loseP, .55);
      if (want === s) loseP *= .3;
      if (presser && Math.random() < loseP) { possession = opp; carrier = presser; decide = rand(.4, .8); return; }
      const prog = progOf(s, c.x);
      // 앞에 공간이 있으면 드리블
      const ahead = { x: c.x + d * .08, y: c.y };
      const [, ad] = nearest(opp, ahead);
      if (c.i !== 0 && ad > .09 && Math.random() < (want === s ? .55 : .35) && !(want === s && prog > .72)) { decide = rand(.5, 1); return; }
      // 패스: 앞으로 + 빈 곳 + 너무 멀지 않게
      const mates = teams[s].filter((p) => p !== c && active(p) && p.i !== 0);
      let best = null, bs = -9;
      for (const m of mates) {
        const fwd = d * (m.x - c.x), len = dist(c, m), [, open] = nearest(opp, m);
        let sc = fwd * (want === s ? 3 : 1.6) + Math.min(open, .15) * 4 - Math.abs(len - .2) * 1.2 + rand(-.25, .25);
        if (want === s && prog > .72) sc -= 2;   // 찬스 직전엔 공을 지켜요
        if (sc > bs) { bs = sc; best = m; }
      }
      if (c.i === 0) best = pick(mates.filter((m) => m.role === "df" || m.role === "mf")) || best;
      if (best) passTo(c, best, c.i === 0 && Math.random() < .5);
      decide = rand(.5, 1.1);
    }
    function targetOf(p) {
      const s = p.side, d = DIR[s], has = possession === s, prog = progOf(s, ball.x);
      if (p.i === 0) {   // 골키퍼: 골문 앞에서 공 쪽으로만 조금
        const gx = s === "home" ? .03 : .97;
        return { x: gx + d * (.01 + prog * .05), y: .5 + (ball.y - .5) * .3 };
      }
      const shift = (prog - .5) * (has ? .62 : .5) + (has ? .05 : -.05);
      let x = p.bx + d * shift;
      const wide = has ? 1.08 : .78;
      let y = .5 + (p.by - .5) * wide + (ball.y - .5) * (has ? .18 : .32);
      // 수비 라인은 자기 진영 끝을 넘지 않게
      if (p.role === "df") x = s === "home" ? Math.min(x, .62) : Math.max(x, .38);
      // 공격 3선 침투: 공이 상대 진영이면 박스 쪽으로
      if (has && (p.role === "fw" || p.role === "wg") && prog > .55) { x = s === "home" ? Math.max(x, .78 + (p.role === "fw" ? .08 : 0)) : Math.min(x, .22 - (p.role === "fw" ? .08 : 0)); if (p.role === "fw") y = .5 + (ball.y - .5) * .3; }
      y += Math.sin(performance.now() / 1300 + p.ph) * .02;
      return { x: clamp(x, .03, .97), y: clamp(y, .05, .95) };
    }
    function stepPlayers(sdt) {
      const defSide = other(possession);
      // 압박 1명 + 커버 1명
      const ref = carrier || (flight ? flight.to : ball);
      const order = teams[defSide].filter((p) => active(p) && p.i !== 0).sort((a, b) => dist(a, ref) - dist(b, ref));
      const presser = order[0], cover = order[1];
      for (const s of ["home", "away"]) for (const p of teams[s]) {
        if (!active(p) || (seq && seq.runner === p)) continue;
        let t, maxV = .16;
        if (p === carrier) { const d = DIR[s]; t = { x: p.x + d * .1, y: p.y + (.5 - p.y) * .25 + Math.sin(performance.now() / 500 + p.ph) * .05 }; maxV = .12; }
        else if (flight && p === flight.recv) { t = flight.to; maxV = .2; }
        else if (p === presser) { t = { x: ref.x, y: ref.y }; maxV = .19; }
        else if (p === cover) { const g = defSide === "home" ? .04 : .96; t = { x: ref.x + (g - ref.x) * .3, y: ref.y + (.5 - ref.y) * .3 }; maxV = .17; }
        else t = targetOf(p);
        const dx = (t.x - p.x) * 1.6, dy = t.y - p.y, dd = Math.hypot(dx, dy) || 1e-6;
        const want = Math.min(maxV, dd * 2.2);
        p.vx += ((dx / dd) * want / 1.6 - p.vx) * Math.min(1, sdt * 5);
        p.vy += ((dy / dd) * want - p.vy) * Math.min(1, sdt * 5);
        p.x = clamp(p.x + p.vx * sdt, .01, .99); p.y = clamp(p.y + p.vy * sdt, .02, .98);
      }
    }
    function stepBall(sdt) {
      if (flight) {
        flight.t += sdt;
        const k = clamp(flight.t / flight.dur, 0, 1), e = 1 - (1 - k) * (1 - k);
        ball.x = flight.from.x + (flight.to.x - flight.from.x) * e; ball.y = flight.from.y + (flight.to.y - flight.from.y) * e;
        if (k >= 1) { carrier = flight.recv; possession = carrier.side; flight = null; decide = rand(.35, .8); }
      } else if (carrier) {
        if (!active(carrier)) { carrier = teams[possession].find((p) => active(p) && p.role === "mf") || teams[possession].find(active); }
        const d = DIR[carrier.side];
        ball.x += (carrier.x + d * .014 - ball.x) * Math.min(1, sdt * 12);
        ball.y += (carrier.y + .01 - ball.y) * Math.min(1, sdt * 12);
        decide -= sdt;
        if (decide <= 0) carrierDecide();
      }
    }


    /* --- 그리기 --- */
    function px(x) { return 12 + x * (W - 24); }
    function py(y) { return 10 + y * (H - 20); }
    function drawPitch() {
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? "#2f8a4a" : "#2a7f44"; ctx.fillRect((W / 10) * i, 0, W / 10 + 1, H); }
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(px(0), py(0), px(1) - px(0), py(1) - py(0));
      ctx.beginPath(); ctx.moveTo(px(.5), py(0)); ctx.lineTo(px(.5), py(1)); ctx.stroke();
      ctx.beginPath(); ctx.arc(px(.5), py(.5), H * .14, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(px(0), py(.22), (px(1) - px(0)) * .15, py(.78) - py(.22));
      ctx.strokeRect(px(.85), py(.22), (px(1) - px(0)) * .15, py(.78) - py(.22));
      ctx.strokeRect(px(0), py(.38), (px(1) - px(0)) * .05, py(.62) - py(.38));
      ctx.strokeRect(px(.95), py(.38), (px(1) - px(0)) * .05, py(.62) - py(.38));
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(px(0) - 6, py(.43), 6, py(.57) - py(.43));
      ctx.fillRect(px(1), py(.43), 6, py(.57) - py(.43));
    }
    function drawPlayer(p, pos, kit, highlight, label, ring) {
      const x = px(pos.x), y = py(pos.y), r = highlight ? 8 : 6.5;
      if (highlight) {
        ctx.fillStyle = "rgba(255,230,90,.28)"; ctx.beginPath(); ctx.arc(x, y, r + 7 + Math.sin(performance.now() / 160) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      const grassy = nearGrass(kit[0]);
      ctx.fillStyle = p.i === 0 ? "#222" : grassy ? kit[1] : kit[0];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = grassy ? kit[0] : kit[1]; ctx.lineWidth = 1.5; ctx.stroke();
      const no = numOf(p.side, p.i);
      if (no !== "") { ctx.font = `bold ${highlight ? 8 : 7}px Jua, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = p.i === 0 ? "#fff" : grassy ? kit[0] : kit[1]; ctx.fillText(String(no), x, y + .5); ctx.textBaseline = "alphabetic"; }
      if (!label && p === carrier && roster[p.side][p.i]) {
        const nmx = shortN(roster[p.side][p.i].n); ctx.font = "9px Jua, sans-serif"; ctx.textAlign = "center";
        const w = ctx.measureText(nmx).width + 6; ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(x - w / 2, y - r - 14, w, 11);
        ctx.fillStyle = "#fff"; ctx.fillText(nmx, x, y - r - 5.5);
      }
      if (label) {
        ctx.font = "bold 10px Jua, sans-serif"; ctx.textAlign = "center";
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x - w / 2, y - r - 17, w, 13);
        ctx.fillStyle = highlight ? "#ffe45a" : "#ff9a9a"; ctx.fillText(label, x, y - r - 7);
      }
    }
    function render() {
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      zoom += (zoomTarget - zoom) * .12;
      if (zoom > 1.01 && focus) {
        const fx = px(focus.x), fy = py(focus.y);
        ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom);
        ctx.translate(-clamp(fx, W / 2 / zoom, W - W / 2 / zoom), -clamp(fy, H / 2 / zoom, H - H / 2 / zoom));
      }
      drawPitch();
      const all = [];
      for (const side of ["home", "away"]) for (const p of teams[side]) {
        let pos = { x: p.x, y: p.y };
        if (seq && seq.runner === p && (seq.si || 0) >= (seq.follow || 0)) pos = { x: ball.x - (seq.side === "home" ? .025 : -.025), y: ball.y + .02 };
        if (!active(p)) continue;
        p.x = pos.x; p.y = pos.y; all.push([p, pos]);
      }
      for (const [p, pos] of all) {
        const kit = p.side === "home" ? cfg.home.kit : cfg.away.kit;
        const isMe = isMeP(p);
        const isRival = rvSide && p.side === rvSide && p.i === rivalSlot && roster[p.side][p.i] && roster[p.side][p.i].id === "rv";
        drawPlayer(p, pos, kit, isMe, isMe ? me.name : isRival ? cfg.rival.name : null, isRival ? "#ff5a5a" : null);
      }
      // 공과 궤적
      if (trail.length > 1) {
        ctx.strokeStyle = replayMode ? "rgba(255,230,90,.85)" : "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); trail.forEach((t, k) => k ? ctx.lineTo(px(t.x), py(t.y)) : ctx.moveTo(px(t.x), py(t.y))); ctx.stroke();
      }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px(ball.x), py(ball.y), 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      if (replayMode) {
        ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, 24);
        ctx.fillStyle = "#ffe45a"; ctx.font = "bold 13px Jua, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("● REPLAY  " + (banner || ""), 10, 16);
      }
    }

    /* --- 루프 --- */
    let last = performance.now(), alive = true, waiters = [];
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused && !seq) {
        minute = Math.min(90, minute + dt * 4.5 * speed);
        root.querySelector("#m-min").textContent = Math.floor(minute) + "'";
        if (!onPitch && minute >= subMin && teams.home[mySlot]) { onPitch = true; const s = myT0.subs.find((x) => x.in.id === "me"); if (s) roster.home[mySlot] = s.in; const mp = teams.home[mySlot]; mp.x = .5; mp.y = .02; feed(`🔁 ${me.name} comes on!`, "me"); }
        const sdt = dt * Math.min(speed, 4);
        stepBall(sdt); stepPlayers(sdt);
        waiters = waiters.filter((w) => { if (minute >= w.min) { w.res(); return false; } return true; });
      } else if (!replayMode) stepPlayers(dt * (seq ? Math.min(speed, 3) : .35));
      if (seq) {
        seq.t += dt * seq.rate * (replayMode ? 1 : Math.min(speed, 3));
        const k = clamp(seq.t / seq.dur, 0, 1);
        const pts = seq.path, segs = pts.length - 1, f = k * segs, si = Math.min(segs - 1, Math.floor(f)), lt = f - si;
        const ease = lt * lt * (3 - 2 * lt);
        ball.x = pts[si].x + (pts[si + 1].x - pts[si].x) * ease;
        ball.y = pts[si].y + (pts[si + 1].y - pts[si].y) * ease;
        trail.push({ x: ball.x, y: ball.y }); if (trail.length > 40) trail.shift();
        seq.si = si;
        if (k >= 1) { const done = seq.done; seq = null; done(); }
      } else if (trail.length) trail.shift();
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const waitMin = (m) => new Promise((res) => waiters.push({ min: m, res }));

    /* 공격 시퀀스: 공이 path를 따라 움직여요 */
    function runSeq(side, runner, endPts, rate = 1, dur = 1.6, follow = 0) {
      return new Promise((done) => {
        const start = { x: ball.x, y: ball.y };
        seq = { side, runner, path: [start, ...endPts], t: 0, dur, rate, done, follow, si: 0 };
        carrier = null; flight = null;
        trail = [];
      });
    }
    /* 찬스 장면: 슈터에게 패스 → (박스로 치고 들어가) → 슈팅 */
    function chancePath(side, runner, scored) {
      const d = DIR[side], gx = side === "home" ? 1 : 0;
      const recv = { x: clamp(runner.x, .05, .95), y: clamp(runner.y, .1, .9) };
      if (progOf(side, recv.x) < .6) recv.x = gx - d * rand(.3, .38);
      const box = { x: gx - d * rand(.1, .17), y: clamp(recv.y + (.5 - recv.y) * .5 + rand(-.08, .08), .3, .7) };
      const end = scored ? { x: gx + d * .005, y: rand(.45, .55) } : { x: gx + d * .01, y: Math.random() < .5 ? rand(.3, .4) : rand(.6, .7) };
      return [recv, box, end];
    }
    function attackPath(side, scored, fromMe) {
      const dir = side === "home" ? 1 : -1, gx = side === "home" ? 1 : 0;
      const sy = rand(.25, .75);
      const box = { x: gx - dir * rand(.12, .2), y: clamp(sy + rand(-.15, .15), .3, .7) };
      const mid = { x: gx - dir * rand(.3, .38), y: sy };
      const end = scored ? { x: gx + dir * .005, y: rand(.45, .55) } : { x: gx + dir * .01, y: Math.random() < .5 ? rand(.28, .4) : rand(.6, .72) };
      return fromMe ? [box, end] : [mid, box, end];
    }
    async function flashText(txt, cls = "", ms = 1100) {
      flash.textContent = txt; flash.className = "m-flash " + cls; flash.hidden = false;
      await sleepMs(skipping ? 150 : ms); flash.hidden = true;
    }
    function feed(text, cls = "") {
      const d = document.createElement("div");
      d.className = "fl " + cls; d.innerHTML = `<span>${Math.floor(minute)}'</span>${text}`;
      feedEl.prepend(d);
      st.events.push(`${Math.floor(minute)}' ${text.replace(/<[^>]+>/g, "")}`);
    }
    function updScore() { root.querySelector("#m-gf").textContent = gf; root.querySelector("#m-ga").textContent = ga; }

    /* --- 승부처 미니게임: 난이도는 엔진 확률에서 나와요 --- */
    /* --- 승부처 미니게임 (minigames.js). 자동이면 AI와 같은 확률 --- */
    async function mini(ev) {
      if (auto) return autoMoment(ev);
      overlay.hidden = false;
      const ms = me.stats, d = cfg.diffShot || 1;
      let r;
      if (ev.mom === "shot" || ev.mom === "pk") {
        const gkDef = eff(ev.gk, "def");
        const smart = ev.mom === "pk" ? clamp(.36 / d, .22, .5) : clamp((.5 - (ms.sho - gkDef) / 220) / d, .22, .72);
        const x = await MG.shot(overlay, { sho: ms.sho, gk: gkDef, smart, pk: ev.mom === "pk" });
        r = { ok: x.ok, out: x.out, why: x.why };
      } else if (ev.mom === "pass") {
        const x = await MG.pass(overlay, { pas: ms.pas, def: eff(ev.df, "def") });
        r = x.ok ? { ok: true, out: rollShot(ev, .12, true), why: x.why } : { ok: false, out: "block", why: x.why };
      } else if (ev.mom === "dribble") {
        const x = await MG.dribble(overlay, { dri: ms.dri, def: eff(ev.df, "def") });
        r = x.ok ? { ok: true, out: rollShot(ev, .15, true), why: x.why } : { ok: false, out: "block", why: x.why };
      } else {
        const x = await MG.tackle(overlay, { def: ms.def, dri: eff(ev.sh, "dri"), name: ev.sh.n });
        r = x.ok ? { ok: true, out: "block", why: x.why } : { ok: false, out: rollShot(ev, 0, true), why: x.why, foul: x.foul };
      }
      overlay.hidden = true; overlay.innerHTML = "";
      return r;
    }

    /* --- 사건 연출 --- */
    const mySide = cfg.mySide || "home";
    const vis = (s) => s === mySide ? "home" : "away";
    const slotOf = (p, side) => {
      if (p.id === "me" && side === "home") return mySlot;
      const i = roster[side].indexOf(p);
      if (i >= 0) return i;
      const t = teams[side].filter((q) => active(q) && q.role === p.r);
      return (t[0] || fwdIdx(side)).i;
    };
    function swapIn(side, out, inn) { const i = roster[side].indexOf(out); if (i >= 0) roster[side][i] = inn; return i; }
    const nm = (p) => !p ? "" : p.id === "me" ? `<b>${esc(me.name)}</b>` : p.id === "rv" ? `<b class="rvn">${esc(p.n)}⚔️</b>` : esc(p.n);
    const myP = () => teams.home[mySlot];
    function zoomOn(p) { focus = p; zoomTarget = skipping ? 1 : 1.7; }
    function unzoom() { zoomTarget = 1; }
    async function replay(path) {
      if (skipping) return;
      replayMode = true; banner = `${me.name}'s goal`;
      ball.x = path[0].x - DIR.home * .12; ball.y = path[0].y;
      zoomOn({ x: path[path.length - 1].x - .1, y: path[path.length - 1].y });
      await runSeq("home", myP(), path, .35, 1.1);
      await sleepMs(500);
      replayMode = false; unzoom(); trail = [];
    }
    async function showEv(ev) {
      const side = vis(ev.side), mine = side === "home";
      const runner = teams[side][slotOf(ev.sh, side)];
      if (ev.pen) { feed(`⚠️ Penalty given! Taker: ${nm(ev.sh)}`, mine ? "goal" : "bad"); await flashText("PK!", mine ? "goal" : "bad", 700); }
      if (ev.mom) {
        possession = mine ? "home" : "away";
        feed(ev.mom === "tackle" ? `🔥 Key moment! Stop ${nm(ev.sh)}'s run` : ev.mom === "pk" ? `🔥 <b>${esc(me.name)}</b> steps up to take the penalty` : `🔥 Key moment! The ball's with <b>${esc(me.name)}</b>`, "me");
        zoomOn(ev.mom === "tackle" ? runner : myP());
        await sleepMs(skipping ? 0 : 600);
        const r = await mini(ev); ev.res = r; ev.out = r.out;
        st.moments.push({ type: ev.mom, ok: r.ok });
        if (r.why && !auto) feed(`💬 ${r.why}`, "me");
        if (r.foul) {
          // 무리한 태클 → 경고 (이미 경고가 있으면 주심이 한 번 봐줘요)
          const inc = cfg.m.inc || (cfg.m.inc = []);
          if (!inc.some((i) => i.p === ev.df && i.kind === "yc")) { inc.push({ min: ev.min, side: ev.side === "home" ? "away" : "home", p: ev.df, kind: "yc" }); feed(`🟨 Yellow card: <b>${esc(me.name)}</b>`, "bad"); }
        }
        unzoom();
      }
      possession = side;
      if (ev.out === "goal") {
        const fromMe = ev.sh.id === "me";
        const path = ev.pen ? [{ x: side === "home" ? .89 : .11, y: .5 }, { x: side === "home" ? 1.005 : -.005, y: rand(.44, .56) }] : chancePath(side, runner, true);
        await runSeq(side, runner, path, 1, ev.pen ? 1.2 : fromMe ? 1.6 : 1.9, 1);
        mine ? gf++ : ga++; updScore(); mine ? Sfx.goal() : Sfx.miss(); if (typeof Bgm !== "undefined") Bgm.roar(mine);
        feed(`⚽ ${ev.pen ? "Penalty goal" : "Goal"} by ${nm(ev.sh)}!${ev.as ? ` (assist: ${nm(ev.as)})` : ""}`, (fromMe || (ev.as && ev.as.id === "me")) ? "me goal" : ev.rv ? "rival" : mine ? "goal" : "bad");
        await flashText(mine ? "GOAL!!" : "Conceded…", mine ? "goal" : "bad", mine ? 1100 : 800);
        if (fromMe) await replay(path.slice(1));
        kickoff(other(side));
      } else {
        await runSeq(side, runner, ev.pen ? [{ x: side === "home" ? .89 : .11, y: .5 }, { x: side === "home" ? .995 : .005, y: pick([.42, .58]) }] : chancePath(side, runner, false), 1, ev.pen ? 1.1 : 1.6, 1);
        if (ev.out === "block") { const [dp] = nearest(other(side), ball); possession = other(side); carrier = dp || teams[other(side)][2]; decide = .5; }
        else goalKick(other(side));
        const txt = ev.pen ? (ev.out === "save" ? `🧤 ${nm(ev.gk)} saves the penalty!` : `💨 ${nm(ev.sh)} misses the penalty`) : ev.out === "save" ? `🧤 Save by ${nm(ev.gk)}! (shot from ${nm(ev.sh)})` : ev.out === "block" ? `🛡️ ${nm(ev.df)} defends (blocks ${nm(ev.sh)})` : `💨 ${nm(ev.sh)}'s shot goes wide`;
        feed(txt, ev.mom ? "me" : ev.rv ? "rival" : "");
      }
    }

    async function showInc(i) {
      const mine = vis(i.side) === "home", isMe = i.p.id === "me";
      const t = i.kind === "yc" ? `🟨 Yellow card: ${nm(i.p)}` : i.kind === "yc2" ? `🟨🟥 ${nm(i.p)} sent off for a second yellow!` : i.kind === "rc" ? `🟥 ${nm(i.p)} red card, sent off!`
        : `🚑 ${nm(i.p)} injured${i.sub ? ` → ${nm(i.sub)} comes on` : " (no subs left, down to 10 men)"}`;
      feed(t + (mine ? "" : ` <small>(${esc(cfg.away.name)})</small>`), isMe ? "me" : i.kind === "yc" ? "" : "bad");
      if (Sfx.card) Sfx.card();
      if (i.kind !== "yc") { if (!mine) Sfx.good(); else Sfx.bad(); }
      const sd = vis(i.side), idx = roster[sd].indexOf(i.p);
      if (i.kind !== "yc" && idx >= 0) { if (i.kind === "inj" && i.sub) roster[sd][idx] = i.sub; else teams[sd][idx].gone = true; }
      if (isMe && i.kind !== "yc") { onPitch = false; await flashText(i.kind === "inj" ? "Injury…" : "Sent off…", "bad", 900); }
      else if (i.kind === "rc" || i.kind === "yc2") await flashText("🟥", mine ? "bad" : "goal", 600);
    }

    /* --- 진행 --- */
    (async () => {
      feed(`🏟️ ${esc(cfg.home.name)} vs ${esc(cfg.away.name)} kick-off!`);
      if (cfg.rival) feed(cfg.rival.side === "away" ? `⚔️ Rival <b>${esc(josa(cfg.rival.name, "이/가"))}</b> plays for the opponent` : `🤝 Playing alongside Rival <b>${esc(josa(cfg.rival.name, "과/와"))}</b>`, "rival");
      if (!me.starter) feed(subMin < 99 ? `🪑 ${josa(me.name, "은/는")} starts on the bench` : `🪑 ${josa(me.name, "은/는")} won't play today`);
      Sfx.whistle();
      await sleepMs(400);
      paused = false;
      const myT = mySide === "home" ? cfg.m.H : cfg.m.A;
      const items = [...cfg.m.evs.map((e) => ({ min: e.min, ev: e })), ...(cfg.m.inc || []).map((i) => ({ min: i.min, inc: i })),
        ...myT.subs.filter((s) => !s.inj && s.in.id !== "me").map((s) => ({ min: s.min, sub: s, side: "home" })),
        ...opT0.subs.filter((s) => !s.inj).map((s) => ({ min: s.min, sub: s, side: "away", quiet: true }))].sort((a, b) => a.min - b.min);
      for (const it of items) {
        director = it.ev ? { side: vis(it.ev.side), min: it.min } : null;
        await waitMin(it.min);
        paused = true;
        if (it.ev) await showEv(it.ev);
        else if (it.sub) { swapIn(it.side, it.sub.out, it.sub.in); if (!it.quiet) feed(`🔁 Sub: ${nm(it.sub.in)} IN · ${nm(it.sub.out)} OUT`); }
        else await showInc(it.inc);
        if (!skipping) await sleepMs(it.ev ? 180 : 80);
        paused = false;
      }
      await waitMin(90);
      paused = true; if (Sfx.fulltime) Sfx.fulltime(); else Sfx.whistle(true);
      feed("🔔 Full time!");
      alive = false;
      resolve(cfg.m);
    })();
  });
}

/* 결과만 보기 — 내 승부처를 AI와 같은 확률로 풀어요 */
function resolveAuto(m) {
  for (const ev of m.evs) if (ev.mom) { const r = autoMoment(ev); ev.res = r; ev.out = r.out; }
  return m;
}
