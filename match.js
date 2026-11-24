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
  shot: { title: "⚽ 슛 찬스!", hint: "골문 빈 곳을 탭! 키퍼가 몸을 날려요" },
  pass: { title: "🎯 킬패스 각!", hint: "수비가 붙지 않은 동료를 빠르게 탭" },
  dribble: { title: "🏃 1:1 돌파!", hint: "막대가 초록 구간에 오면 탭" },
  tackle: { title: "🛡️ 상대 역습!", hint: "상대가 어느 쪽으로 칠지 읽고 탭" },
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
        <button class="auto-sw ${auto ? "on" : ""}" id="m-auto" role="switch" aria-checked="${auto}"><span class="sw"><i></i></span><span class="sw-txt"><b>승부처</b><em>${auto ? "🤖 자동" : "🎮 직접"}</em></span></button>
        <div class="m-spd"><button data-s="1" class="on">1x</button><button data-s="2">2x</button><button data-s="4">4x</button><button id="m-skip">⏭️ 결과</button></div>
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
    const paintAuto = () => { autoBtn.classList.toggle("on", auto); autoBtn.setAttribute("aria-checked", auto); autoBtn.querySelector("em").textContent = auto ? "🤖 자동" : "🎮 직접"; };
    autoBtn.onclick = () => { auto = !auto; paintAuto(); Sfx.tap(); cfg.onAutoChange && cfg.onAutoChange(auto); };
    root.querySelectorAll(".m-spd [data-s]").forEach((b) => b.onclick = () => {
      speed = +b.dataset.s; root.querySelectorAll(".m-spd [data-s]").forEach((x) => x.classList.toggle("on", x === b));
    });
    root.querySelector("#m-skip").onclick = () => { skipping = true; auto = true; speed = 40; paintAuto(); };

    /* ================= 2D 경기 연출 엔진 v3 =================
     * 결과(골·선방·카드·교체)는 world.js 엔진이 정해요. 여기서는 그걸 실제 축구처럼 보여줘요.
     * 참고: Mat Buckland "Simple Soccer"(팀 상태 · 서포트 스팟 · 패스 안전 검사), 실제 경기 속도 비율.
     *  · 모든 움직임을 미터 단위로 계산(경기장 105 x 68 m). 선수 3.5~7.5 m/s, 패스 12~20 m/s, 슈팅 28 m/s
     *    → 화면에선 시간만 VIS배 빠르게(공과 선수 속도 비율은 실제와 같아요)
     *  · 공 가진 선수는 잠깐 보고(0.6~1.8초) 판단: 안전한 패스(상대가 길목에 먼저 못 오는 패스)만 골라요
     *  · 받는 선수가 공 쪽으로 마중 나가고, 길목에 들어온 상대는 실제로 공을 끊어요
     *  · 팀 블록: 수비 땐 좁고 짧게(공 쪽으로 쏠림), 공격 땐 넓고 길게. 서포트 스팟(Buckland)으로 패스 각 만들기
     *  · 압박 1 + 커버 1 + 지역 마킹, 수비 라인 맞추기(오프사이드 라인), 선수끼리 겹치지 않게 밀어내기
     *  · 태클로 흘러나온 공 다툼, 스로인 · 코너킥 · 골킥 · 프리킥, 찬스 장면은 playChance */
    const DIR = { home: 1, away: -1 };
    const other = (s) => s === "home" ? "away" : "home";
    const PW = 105, PH = 68, VIS = 1.9;               // 경기장 크기(m), 화면 시간 배속
    const SPD = { walk: 2, jog: 4, run: 6, sprint: 7.6 }; // m/s
    function kickPos(side, bx) { return side === "home" ? Math.min(bx * .9, .46) : Math.max(1 - (1 - bx) * .9, .54); }
    function mkTeam(side) {
      const F = FORMS[formOfSide[side]] || FORMS["4-3-3"];
      return roster[side].map((_, i) => F.pos[i] || F.pos[F.pos.length - 1]).map((f, i) => {
        const bx = side === "home" ? f[0] : 1 - f[0], by = side === "home" ? f[1] : 1 - f[1];
        return { i, side, role: F.roles[i] || "mf", fx: f[0], bx, by, x: kickPos(side, bx), y: by, vx: 0, vy: 0, ph: Math.random() * 6, runT: 0, stun: 0, dive: 0, diveY: 0, lunge: 0 };
      });
    }
    const teams = { home: mkTeam("home"), away: mkTeam("away") };
    const rvSide = cfg.rival ? cfg.rival.side || "away" : null;
    const rivalSlot = rvSide ? roster[rvSide].findIndex((p) => p.id === "rv") : -1;
    let onPitch = !!me.starter;                         // 벤치면 교체 시간에 들어와요
    const subMin = me.starter ? 0 : (me.subMin ?? 999);

    let possession = "home", ball = { x: .5, y: .5, z: 0 }, lastTouch = "home";
    let carrier = teams.home[9], flight = null, loose = null, decide = .6, director = null, restart = null, tag = null;
    let minute = 0, paused = true, zoom = 1, zoomTarget = 1, focus = null;
    let script = null, trail = [], replayMode = false, banner = null, rec = null, playback = null;
    let gf = 0, ga = 0, support = [], supT = 0, tackleT = 0;
    const st = { goals: 0, assists: 0, saves: 0, moments: [], events: [], ge: [] };
    const strOf = (s) => s === "home" ? homeStr : awayStr;
    const isMeP = (p) => p.side === "home" && roster.home[p.i] && roster.home[p.i].id === "me";
    const active = (p) => !p.gone && !(isMeP(p) && !onPitch);
    const fwdIdx = (side) => { const t = teams[side]; const f = t.find((p) => p.role === "fw" && active(p)) || t.find((p) => p.role !== "gk" && active(p)); return f || t[t.length - 1]; };
    const numOf = (side, i) => { const p = roster[side][i]; if (!p) return ""; return p.id === "me" ? (me.look && me.look.number) || "" : p.id === "rv" ? (cfg.rival && cfg.rival.number) || "" : p.no || ""; };
    const shortN = (n) => { const s = String(n || ""); return s.includes(" ") ? s.split(" ").slice(-1)[0] : s; };
    const dist = (a, b) => Math.hypot((a.x - b.x) * 1.6, a.y - b.y);   // 옛 단위(찬스 장면이 써요)
    const dm = (a, b) => Math.hypot((a.x - b.x) * PW, (a.y - b.y) * PH); // 미터
    const nearest = (side, pt, excl) => { let best = null, bd = 9; for (const p of teams[side]) { if (!active(p) || p === excl || p.stun > 0) continue; const d = dist(p, pt); if (d < bd) { bd = d; best = p; } } return [best, bd]; };
    const nearestM = (side, pt, excl) => { let best = null, bd = 999; for (const p of teams[side]) { if (!active(p) || p === excl || p.stun > 0) continue; const d = dm(p, pt); if (d < bd) { bd = d; best = p; } } return [best, bd]; };
    const progOf = (side, x) => side === "home" ? x : 1 - x;   // 0 = 우리 골문, 1 = 상대 골문
    const absX = (side, pr) => side === "home" ? pr : 1 - pr;
    const goalX = (side) => side === "home" ? 1 : 0;           // side가 공격하는 골문
    const paceOf = (p) => { const pl = roster[p.side][p.i]; let v = 70; try { v = pl ? (pl.id === "me" ? me.stats.spd : eff(pl, "spd")) : 70; } catch { /* 기본값 */ } return .86 + clamp(v, 35, 105) / 420; };
    const statOf = (p, k) => { const pl = roster[p.side][p.i]; try { return pl ? (pl.id === "me" ? me.stats[k] : eff(pl, k)) : 65; } catch { return 65; } };
    const isFB = (p) => p.role === "df" && Math.abs(p.by - .5) > .28;
    const say = (t) => { tag = { t, until: performance.now() + 1100 }; };

    function kickoff(side) {
      for (const s of ["home", "away"]) for (const p of teams[s]) { p.x = kickPos(s, p.bx); p.y = p.by; p.vx = p.vy = 0; p.runT = 0; p.stun = 0; p.dive = 0; }
      possession = side; lastTouch = side; carrier = fwdIdx(side); carrier.x = .5 - DIR[side] * .01; carrier.y = .5;
      flight = null; loose = null; restart = null; ball = { x: .5, y: .5, z: 0 }; decide = .9;
    }
    function takeBall(p) { carrier = p; possession = p.side; lastTouch = p.side; flight = null; loose = null; p.drib = null; decide = rand(.5, 1.1); }

    /* ---- 공 차기: 거리/속도(m/s)로 비행 시간 계산. 땅볼은 점점 느려지고, 띄운 공은 포물선 ---- */
    function kick(from, to, o = {}) {
      const d = dm(ball, to);
      let v = o.mps || (o.speed ? o.speed * 20 : o.kind === "shot" ? 28 : o.h ? 19 : 14);
      flight = { from: { x: ball.x, y: ball.y }, to: { x: to.x, y: to.y }, t: 0, dur: clamp(d / v, .25, 3.2), h: o.h || 0, recv: o.recv || null, onEnd: o.onEnd || null, kind: o.kind || "pass", owner: from && from.side };
      if (from && from.side) lastTouch = from.side;
      if (carrier) carrier.drib = null;
      carrier = null; loose = null;
      if (Sfx.kick && (d > 18 || o.kind === "shot")) Sfx.kick();
    }
    const flyDone = () => new Promise((res) => { if (flight) flight.onEnd = res; else res(); });

    /* Buckland: 패스 길목 안전 검사. 상대가 공보다 먼저 길목에 닿으면 위험(0), 여유 있으면 1 */
    function passSafety(from, to, v) {
      const ax = from.x * PW, ay = from.y * PH, bx = to.x * PW, by = to.y * PH, L = Math.hypot(bx - ax, by - ay) || 1;
      let worst = 1;
      for (const o of teams[other(from.side || possession)]) {
        if (!active(o)) continue;
        const ox = o.x * PW, oy = o.y * PH;
        const tproj = clamp(((ox - ax) * (bx - ax) + (oy - ay) * (by - ay)) / (L * L), 0, 1);
        const px = ax + (bx - ax) * tproj, py = ay + (by - ay) * tproj;
        const tb = (L * tproj) / v, to_ = Math.max(0, Math.hypot(ox - px, oy - py) - 1.2) / (SPD.sprint * paceOf(o)) + .25;
        worst = Math.min(worst, clamp((to_ - tb) / .8 + .5, 0, 1));
      }
      return worst;
    }
    function passTo(from, to, o = {}) {
      const v = o.h ? 19 : 14;
      const lead = o.lead != null ? o.lead : 2.5;                  // 받는 사람 앞쪽(m)
      const tgt = { x: clamp(to.x + DIR[to.side] * lead / PW, .01, .99), y: to.y };
      const [, pd] = nearestM(other(from.side), from);
      let err = .05 + (dm(from, tgt) > 30 ? .08 : 0) + (o.h ? .06 : 0) + (pd < 3 ? .07 : 0) + Math.max(0, (70 - statOf(from, "pas")) / 400);
      if (director && director.side === other(from.side) && director.min - minute < 3) err += .1;   // 곧 상대 찬스
      if (Math.random() < err) { tgt.x += rand(-8, 8) / PW; tgt.y += rand(-7, 7) / PH; kick(from, tgt, { h: o.h, mps: v, kind: "miss" }); return; }
      kick(from, tgt, { h: o.h, recv: to, mps: v });
    }
    /* 띄운 공 착지: 근처에서 공중볼 다툼 (수비가 이기면 걷어내기) */
    function aerial(pt, atkSide) {
      const near = [];
      for (const s of ["home", "away"]) for (const p of teams[s]) if (active(p) && p.i !== 0 && dm(p, pt) < 5) near.push(p);
      const gk = teams[other(atkSide)][0];
      if (active(gk) && Math.abs(progOf(atkSide, pt.x) - 1) < .13 && Math.abs(pt.y - .5) < .25 && Math.random() < .55) { takeBall(gk); say(T("키퍼 캐치", "Keeper claims")); return; }
      if (!near.length) { loose = { vx: rand(-3, 3), vy: rand(-3, 3) }; return; }
      const w = near.map((p) => (p.side === atkSide ? 1 : 1.5) * Math.exp((strOf(p.side) - strOf(other(p.side))) / 40) * Math.random());
      const win = near[w.indexOf(Math.max(...w))];
      lastTouch = win.side;
      if (win.side !== atkSide && progOf(win.side, pt.x) < .35) {   // 자기 진영 수비: 머리로 걷어내기
        kick(win, { x: absX(win.side, clamp(progOf(win.side, pt.x) + rand(.22, .4), 0, 1.05)), y: clamp(pt.y + rand(-.35, .35), -.05, 1.05) }, { h: .7, mps: 20, kind: "clear" });
      } else { const m = teams[win.side].filter((q) => q !== win && active(q) && q.i !== 0).sort((a, b) => dm(a, win) - dm(b, win))[Math.floor(Math.random() * 2)]; if (m) passTo(win, m, { lead: .5 }); else takeBall(win); }
    }
    /* 태클: 공이 흘러나오거나 깔끔하게 뺏어요 */
    function tackle(by, victim) {
      by.lunge = .35; victim.stun = .5; lastTouch = by.side;
      if (Math.random() < .5) { takeBall(by); return; }
      const a = Math.random() * Math.PI * 2;
      carrier = null; flight = null;
      loose = { vx: Math.cos(a) * rand(3, 7), vy: Math.sin(a) * rand(3, 7) };
    }

    /* ---- 서포트 스팟(Buckland): 공 가진 선수 앞쪽 격자에서 패스 안전 + 전진 + 공간 + 거리로 점수 ---- */
    function supportSpots(c) {
      const s = c.side, cp = progOf(s, c.x), out = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
        const pr = clamp(cp - .06 + i * .07, .05, .92), y = .1 + j * .2;
        const pt = { x: absX(s, pr), y }, d = dm(c, pt);
        if (d < 9 || d > 34) continue;
        const [, sp] = nearestM(other(s), pt);
        const sc = passSafety(c, pt, 14) * 2 + (pr - cp) * 3 + Math.min(sp, 10) / 10 - Math.abs(d - 18) / 30;
        out.push({ pt, sc });
      }
      return out.sort((a, b) => b.sc - a.sc);
    }

    /* ---- 공 가진 선수의 판단 ---- */
    function carrierDecide() {
      const c = carrier, s = c.side, d = DIR[s], opp = other(s), prog = progOf(s, c.x);
      const [, pdm] = nearestM(opp, c);
      const want = director && director.min - minute < 3 ? director.side : null;
      const mates = teams[s].filter((p) => p !== c && active(p) && p.i !== 0 && p.stun <= 0);
      if (!mates.length) { decide = .5; return; }
      // 골키퍼: 짧게 수비수에게, 압박이 있으면 길게
      if (c.i === 0) {
        const dfs = mates.filter((m) => m.role === "df").map((m) => [m, passSafety(c, m, 14)]).sort((a, b) => b[1] - a[1]);
        if (dfs.length && dfs[0][1] > .6 && Math.random() < .65) passTo(c, dfs[0][0], { lead: 1 });
        else { const f = pick(mates.filter((m) => m.role === "fw" || m.role === "wg" || m.role === "mf")) || pick(mates); const pt = { x: f.x, y: f.y }; kick(c, pt, { h: .9, mps: 22, kind: "long", onEnd: () => aerial(pt, s) }); }
        decide = rand(.8, 1.4); return;
      }
      // 자기 진영 깊은 곳에서 강하게 압박받는 수비: 걷어내기
      if (c.role === "df" && prog < .2 && pdm < 2.5 && Math.random() < .55) {
        kick(c, { x: absX(s, prog + rand(.3, .5)), y: clamp(c.y + rand(-.45, .45), -.05, 1.05) }, { h: .8, mps: 22, kind: "clear" });
        decide = 1; return;
      }
      const wide = Math.abs(c.y - .5) > .27;
      // 측면 깊은 곳: 크로스
      if (prog > .78 && wide && Math.random() < (want === s ? .3 : .55)) {
        const pt = { x: absX(s, rand(.87, .93)), y: rand(.38, .62) };
        kick(c, pt, { h: 1, mps: 19, kind: "cross", onEnd: () => aerial(pt, s) }); say(T("크로스", "Cross"));
        decide = 1; return;
      }
      // 패스 후보 점수: 안전 × (전진 + 받는 사람 주변 공간) - 거리 부담
      let best = null, bs = -9, bestSafe = 0;
      const kF = prog < .33 ? .7 : prog < .66 ? 1.4 : 1;
      for (const m of mates) {
        const len = dm(c, m); if (len < 5 || len > 45) continue;
        const safe = passSafety(c, m, len > 30 ? 19 : 14), fwd = (progOf(s, m.x) - prog) * PW;
        const [, open] = nearestM(opp, m);
        let sc = safe * 2.2 + fwd / 20 * kF * (want === s ? 1.5 : 1) + Math.min(open, 8) / 8 - Math.abs(len - 16) / 40 + rand(-.3, .3);
        if (m.runT > 0 && fwd > 5) sc += .5;                     // 뒷공간으로 뛰는 동료
        if (support.includes(m)) sc += .35;                      // 패스 각을 만든 동료
        if (want === s && prog > .72) sc -= 1;
        if (sc > bs) { bs = sc; best = m; bestSafe = safe; }
      }
      // 앞이 비었으면 몰고 가기(드리블), 아니면 안전한 패스, 막혔으면 공 지키며 방향 전환
      const ahead = { x: c.x + d * 8 / PW, y: c.y };
      const [, ad] = nearestM(opp, ahead);
      const dribP = (c.role === "wg" ? .55 : c.role === "fw" ? .45 : c.role === "mf" ? .3 : .2) * (want === s ? 1.3 : 1);
      if (ad > 7 && Math.random() < dribP && !(want === s && prog > .72)) {
        let ba = 0, bsc = -9;
        for (const ang of [-.8, -.4, 0, .4, .8]) { const pt = { x: c.x + d * Math.cos(ang) * 10 / PW, y: c.y + Math.sin(ang) * 10 / PH }; if (pt.y < .05 || pt.y > .95) continue; const sc = nearestM(opp, pt)[1] + Math.cos(ang) * 3; if (sc > bsc) { bsc = sc; ba = ang; } }
        c.drib = { ang: ba, t: rand(.8, 1.6) }; decide = c.drib.t; return;
      }
      if (best && (bestSafe > .45 || pdm < 3)) {
        const isThrough = best.runT > 0 && (progOf(s, best.x) - prog) * PW > 12 && (best.role === "fw" || best.role === "wg");
        passTo(c, best, { lead: isThrough ? 7 : 2.5 });
        if (isThrough) { say(T("스루패스", "Through ball")); best.runT = 0; }
        else if (Math.abs(best.y - c.y) > .5 && dm(c, best) > 30) say(T("측면 전환", "Switch"));
        decide = rand(.7, 1.3); return;
      }
      // 마땅한 패스가 없으면: 공 지키며 옆/뒤로
      c.drib = { ang: (Math.random() < .5 ? 1 : -1) * rand(1.3, 2.2), t: rand(.5, .9) };
      decide = c.drib.t;
    }

    /* ---- 공이 밖으로: 스로인 · 코너킥 · 골킥 ---- */
    function outOfPlay() {
      const bx = ball.x, by = ball.y;
      let kind, side, at;
      if (by < 0 || by > 1) { kind = "throw"; side = other(lastTouch); at = { x: clamp(bx, .03, .97), y: by < 0 ? .005 : .995 }; }
      else {
        const endSide = bx > 1 ? "home" : "away";   // 이 골라인을 공격하는 팀
        if (lastTouch === endSide) { kind = "goalkick"; side = other(endSide); at = { x: endSide === "home" ? .95 : .05, y: rand(.4, .6) }; }
        else { kind = "corner"; side = endSide; at = { x: bx > 1 ? .995 : .005, y: by < .5 ? .01 : .99 }; }
      }
      setRestart(kind, side, at);
    }
    function setRestart(kind, side, at) {
      flight = null; loose = null; carrier = null; possession = side;
      ball = { x: at.x, y: at.y, z: 0 };
      const taker = kind === "goalkick" ? teams[side][0] : nearestM(side, at)[0] || teams[side][5];
      restart = { kind, side, at, taker, wait: kind === "corner" ? 1.6 : kind === "free" ? 1.2 : .9 };
      say(kind === "throw" ? T("스로인", "Throw-in") : kind === "corner" ? T("코너킥", "Corner") : kind === "goalkick" ? T("골킥", "Goal kick") : T("프리킥", "Free kick"));
    }
    function runRestart(sdt) {
      const r = restart, t = r.taker;
      if (!active(t)) { r.taker = nearestM(r.side, r.at)[0]; return; }
      r.wait -= sdt;
      if (dm(t, r.at) > 1.2 || r.wait > 0) return;
      restart = null; lastTouch = r.side;
      const mates = teams[r.side].filter((m) => m !== t && active(m) && m.i !== 0);
      if (r.kind === "corner") { const pt = { x: absX(r.side, rand(.87, .93)), y: rand(.36, .64) }; kick(t, pt, { h: 1, mps: 19, kind: "cross", onEnd: () => aerial(pt, r.side) }); return; }
      if (r.kind === "goalkick" && Math.random() < .5) { const f = pick(mates.filter((m) => m.role !== "df")) || pick(mates); const pt = { x: f.x, y: f.y }; kick(t, pt, { h: .9, mps: 22, kind: "long", onEnd: () => aerial(pt, r.side) }); return; }
      const near = mates.map((m) => [m, passSafety(t, m, 14) - dm(t, m) / 40]).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]);
      const to = pick(near); if (to) passTo(t, to, { h: r.kind === "throw" ? .25 : 0, lead: 1 }); else takeBall(t);
    }

    /* ---- 공 없는 선수의 자리: 팀 블록(수비 땐 좁고 짧게, 공격 땐 넓고 길게) ---- */
    function lineOf(side) {   // 이 팀 마지막 수비수(골키퍼 제외)의 진행도 = 상대 오프사이드 기준
      let m = 1; for (const p of teams[side]) if (active(p) && p.i !== 0) m = Math.min(m, progOf(side, p.x)); return m;
    }
    function homeOf(p) {
      const s = p.side, has = possession === s, prog = progOf(s, ball.x);
      const back = has ? clamp(prog - .34, .12, .52) : clamp(prog - .24, .07, .4);   // 수비 라인 높이
      const span = has ? .5 : .34;                                                   // 수비 ~ 최전방 길이
      const depth = clamp((p.fx - .2) / .48, 0, 1.1);
      let pr = back + depth * span;
      const wide = has ? 1.05 : .66;
      let y = .5 + (p.by - .5) * wide + (ball.y - .5) * (has ? .12 : .4);
      if (has) {
        if (p.role === "wg") y = .5 + (p.by - .5) * 1.3;                             // 윙어는 터치라인 쪽
        if (isFB(p) && Math.sign(ball.y - .5) === Math.sign(p.by - .5) && prog > .5) { pr += .22; y = p.by < .5 ? .08 : .92; }   // 오버래핑
        if (p.runT > 0) pr = Math.max(pr, 1 - lineOf(other(s)) + .08);              // 뒷공간 침투
        else if (p.role !== "df") pr = Math.min(pr, 1 - lineOf(other(s)) - .006);    // 오프사이드 라인
      } else {
        if (p.role === "fw") pr = Math.max(pr, .44); else if (p.role === "wg") pr = Math.max(pr, .34);   // 역습 대비
      }
      return { x: clamp(absX(s, pr), .03, .97), y: clamp(y, .05, .95) };
    }
    function targetOf(p) {
      const s = p.side, d = DIR[s], has = possession === s, prog = progOf(s, ball.x), opp = other(s);
      if (p.i === 0) {   // 골키퍼: 공과 골문 중앙을 잇는 선 위에서 골라인 가까이
        const gx = s === "home" ? .02 : .98, out = has ? .1 : clamp((.5 - prog) * .12, .01, .07);
        return { x: gx + d * out, y: .5 + (ball.y - .5) * .25 };
      }
      let t = homeOf(p);
      if (!has && p.role !== "fw") {   // 지역 마킹: 내 구역의 상대 골문 쪽에 2 m
        const [mk, md] = nearestM(opp, t);
        if (mk && md < 11 && mk !== carrier) t = { x: mk.x - d * 2 / PW, y: mk.y + (.5 - mk.y) * .05 };
      }
      t.y += Math.sin(performance.now() / 1500 + p.ph) * .008;
      return t;
    }
    function steer(p, t, vmax, sdt) {   // 도착(arrive) 조향 + 가속 한계 (키퍼 다이빙은 순간 가속)
      const dxm = (t.x - p.x) * PW, dym = (t.y - p.y) * PH, dd = Math.hypot(dxm, dym) || 1e-6;
      const want = Math.min(vmax, dd * 1.4);
      const tvx = dxm / dd * want, tvy = dym / dd * want;
      const cvx = p.vx * PW, cvy = p.vy * PH, ax = tvx - cvx, ay = tvy - cvy, am = Math.hypot(ax, ay), lim = (p.dive > 0 ? 60 : 9) * sdt;
      const k = am > lim ? lim / am : 1;
      p.vx = (cvx + ax * k) / PW; p.vy = (cvy + ay * k) / PH;
    }
    function stepPlayers(dt) {
      if (playback) return;
      const sdt = dt * VIS;
      const defSide = other(possession);
      const ref = carrier || (flight ? flight.to : ball);
      const order = teams[defSide].filter((p) => active(p) && p.i !== 0 && p.stun <= 0).sort((a, b) => dm(a, ref) - dm(b, ref));
      const presser = order[0], cover = order[1];
      // 서포트(패스 각): 공 가진 선수 주변 두 명 (0.6초마다 다시 계산)
      supT -= sdt;
      if (carrier && !restart && supT <= 0) {
        supT = .6; support = [];
        const spots = supportSpots(carrier).slice(0, 4), used = new Set();
        const cand = teams[carrier.side].filter((p) => p !== carrier && active(p) && p.i !== 0 && p.role !== "df");
        for (const sp of spots) { if (support.length >= 2) break; const q = cand.filter((p) => !used.has(p)).sort((a, b) => dm(a, sp.pt) - dm(b, sp.pt))[0]; if (q && dm(q, sp.pt) < 22) { used.add(q); support.push(q); q.supPt = sp.pt; } }
        // 공격수는 가끔 뒷공간으로
        if (progOf(carrier.side, carrier.x) > .35) for (const p of teams[carrier.side]) if ((p.role === "fw" || p.role === "wg") && p.runT <= 0 && Math.random() < .12) p.runT = rand(1.4, 2.4);
      }
      if (!carrier) support = [];
      const chasers = loose ? [nearestM("home", ball)[0], nearestM("away", ball)[0]] : [];
      for (const s of ["home", "away"]) for (const p of teams[s]) {
        if (!active(p)) continue;
        p.runT = Math.max(0, p.runT - sdt); p.stun = Math.max(0, p.stun - sdt); p.lunge = Math.max(0, p.lunge - sdt); p.dive = Math.max(0, p.dive - sdt);
        if (p.stun > 0) { p.vx *= .85; p.vy *= .85; p.x = clamp(p.x + p.vx * sdt, .005, .995); p.y = clamp(p.y + p.vy * sdt, .01, .99); continue; }
        const pace = paceOf(p);
        let t, v = SPD.jog;
        const sc = script && script.targets.get(p);
        if (sc) { t = sc; v = script.fast && script.fast.has(p) ? SPD.sprint : SPD.run; }
        else if (restart) { t = p === restart.taker ? restart.at : restartSpot(p); v = p === restart.taker ? SPD.run : SPD.jog; }
        else if (p === carrier) {
          const d = DIR[s], ang = p.drib ? p.drib.ang : 0;
          t = { x: p.x + d * Math.cos(ang) * 6 / PW, y: clamp(p.y + Math.sin(ang) * 6 / PH, .04, .96) };
          v = p.drib ? SPD.run * .9 : SPD.walk * 1.2;   // 몰고 갈 땐 달리고, 고민할 땐 천천히
        } else if (flight && p === flight.recv) { t = flight.to; v = SPD.run; }
        else if (loose && chasers.includes(p)) { t = { x: ball.x, y: ball.y }; v = SPD.sprint; }
        else if (p === presser && !restart) { const g = { x: defSide === "home" ? 0 : 1, y: .5 }; t = { x: ref.x + (g.x - ref.x) * .02, y: ref.y + (g.y - ref.y) * .02 }; v = SPD.sprint * .95; }
        else if (p === cover && !restart) { const g = defSide === "home" ? .03 : .97; t = { x: ref.x + (g - ref.x) * .25, y: ref.y + (.5 - ref.y) * .3 }; v = SPD.run; }
        else if (support.includes(p) && p.supPt) { t = p.supPt; v = SPD.run; }
        else { t = targetOf(p); const far = dm(p, t); v = far > 12 ? SPD.run : far > 4 ? SPD.jog : SPD.walk; if (p.runT > 0) v = SPD.sprint; }
        if (p.dive > 0) { t = { x: p.x, y: p.diveY }; v = 14; }
        steer(p, t, v * pace, sdt);
      }
      // 겹치지 않게 밀어내기(2 m)
      const all = [...teams.home, ...teams.away].filter(active);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j]; if (a === carrier || b === carrier) continue;
        const dx = (b.x - a.x) * PW, dy = (b.y - a.y) * PH, d = Math.hypot(dx, dy);
        if (d > 0 && d < 2) { const push = (2 - d) / 2 * .5; a.x -= dx / d * push / PW; a.y -= dy / d * push / PH; b.x += dx / d * push / PW; b.y += dy / d * push / PH; }
      }
      for (const p of all) { p.x = clamp(p.x + p.vx * sdt, .005, .995); p.y = clamp(p.y + p.vy * sdt, .01, .99); }
      // 압박 수비가 붙으면 태클 시도 (0.35초마다)
      tackleT -= sdt;
      if (carrier && presser && !script && !restart && tackleT <= 0 && dm(presser, carrier) < 1.8) {
        tackleT = .35;
        const want = director && director.min - minute < 3 ? director.side : null;
        let p = .2 * Math.exp((statOf(presser, "def") - statOf(carrier, "dri")) / 30) * Math.exp((strOf(presser.side) - strOf(carrier.side)) / 30);
        if (want === presser.side) p = Math.max(p, .5); if (want === carrier.side) p *= .3;
        if (Math.random() < p) tackle(presser, carrier);
      }
    }
    /* 세트피스 자리: 코너킥이면 박스에 모이고, 스로인·프리킥이면 대형 그대로 */
    function restartSpot(p) {
      const r = restart;
      if (r.kind === "corner" && p.i !== 0) {
        const atk = p.side === r.side, s = r.side;
        if (atk && p.role === "df" && !isFB(p)) return { x: absX(s, .88 + (p.i % 2) * .04), y: .42 + (p.i % 3) * .08 };
        if (atk && (p.role === "fw" || p.role === "wg" || (p.role === "mf" && p.i % 2))) return { x: absX(s, .87 + (p.i % 3) * .03), y: .36 + (p.i % 4) * .09 };
        if (!atk && p.role !== "fw") return { x: absX(s, .9 + (p.i % 2) * .04), y: .36 + (p.i % 5) * .07 };
      }
      return targetOf(p);
    }
    function stepBall(dt) {
      const sdt = dt * VIS;
      if (restart) { runRestart(sdt); ball.z = 0; return; }
      if (flight) {
        flight.t += sdt;
        const k = clamp(flight.t / flight.dur, 0, 1);
        const ek = flight.h ? k : (k * (2 - k) * .6 + k * .4);   // 땅볼: 처음 빠르고 점점 느려져요
        ball.x = flight.from.x + (flight.to.x - flight.from.x) * ek; ball.y = flight.from.y + (flight.to.y - flight.from.y) * ek;
        ball.z = flight.h * 4 * k * (1 - k);
        // 땅볼은 길목에 들어온 상대가 실제로 끊어요
        if (!script && !flight.h && flight.kind !== "shot" && k > .12) {
          for (const o of teams[other(flight.owner || possession)]) {
            if (!active(o) || o.stun > 0) continue;
            if (dm(o, ball) < 1.3 && Math.random() < .55) { lastTouch = o.side; takeBall(o); return; }
          }
        }
        if (k >= 1) {
          const f = flight; flight = null; ball.z = 0;
          if (f.onEnd) { f.onEnd(); return; }
          if (!script && (ball.x < 0 || ball.x > 1 || ball.y < 0 || ball.y > 1)) return outOfPlay();
          if (f.recv && active(f.recv) && dm(f.recv, ball) < 3.5) takeBall(f.recv);
          else { const sp = Math.min(6, dm(f.from, f.to) / f.dur * .4); const dx = (f.to.x - f.from.x) * PW, dy = (f.to.y - f.from.y) * PH, L = Math.hypot(dx, dy) || 1; loose = { vx: dx / L * sp, vy: dy / L * sp }; }
        }
      } else if (loose) {
        ball.x += loose.vx / PW * sdt; ball.y += loose.vy / PH * sdt;
        const f = Math.pow(.25, sdt); loose.vx *= f; loose.vy *= f;
        if (!script && (ball.x < 0 || ball.x > 1 || ball.y < 0 || ball.y > 1)) return outOfPlay();
        let got = null, gd = 1.2;
        for (const s of ["home", "away"]) for (const p of teams[s]) if (active(p) && p.stun <= 0) { const dd = dm(p, ball); if (dd < gd) { gd = dd; got = p; } }
        if (got && !script) takeBall(got);
      } else if (carrier) {
        if (!active(carrier)) { carrier = teams[possession].find((p) => active(p) && p.role === "mf") || teams[possession].find(active); }
        const d = DIR[carrier.side], ang = carrier.drib ? carrier.drib.ang : 0;
        ball.x += (carrier.x + d * Math.cos(ang) * .9 / PW - ball.x) * Math.min(1, sdt * 10);
        ball.y += (carrier.y + Math.sin(ang) * .9 / PH + .004 - ball.y) * Math.min(1, sdt * 10);
        ball.z = 0;
        if (script) return;
        decide -= sdt;
        if (carrier.drib && (carrier.drib.t -= sdt) <= 0) carrier.drib = null;
        if (decide <= 0) carrierDecide();
      }
    }

    /* --- 그리기 --- */
    let flip = false;   // 후반: 진영 교체 (그릴 때만 180도 돌려요)
    function px(x) { return 12 + (flip ? 1 - x : x) * (W - 24); }
    function py(y) { return 10 + (flip ? 1 - y : y) * (H - 20); }
    function drawPitch() {
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? "#2f8a4a" : "#2a7f44"; ctx.fillRect((W / 10) * i, 0, W / 10 + 1, H); }
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(px(0), py(0), px(1) - px(0), py(1) - py(0));
      ctx.beginPath(); ctx.moveTo(px(.5), py(0)); ctx.lineTo(px(.5), py(1)); ctx.stroke();
      ctx.beginPath(); ctx.arc(px(.5), py(.5), H * .14, 0, Math.PI * 2); ctx.stroke();
      const bw = (px(1) - px(0)) * .15, sw = (px(1) - px(0)) * .05;
      ctx.strokeRect(Math.min(px(0), px(.15)), Math.min(py(.22), py(.78)), bw, Math.abs(py(.78) - py(.22)));
      ctx.strokeRect(Math.min(px(.85), px(1)), Math.min(py(.22), py(.78)), bw, Math.abs(py(.78) - py(.22)));
      ctx.strokeRect(Math.min(px(0), px(.05)), Math.min(py(.38), py(.62)), sw, Math.abs(py(.62) - py(.38)));
      ctx.strokeRect(Math.min(px(.95), px(1)), Math.min(py(.38), py(.62)), sw, Math.abs(py(.62) - py(.38)));
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(px(.11), py(.5), 1.6, 0, Math.PI * 2); ctx.arc(px(.89), py(.5), 1.6, 0, Math.PI * 2); ctx.fill();
      // 골대(그물)
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5;
      for (const gx of [0, 1]) { const x0 = px(gx), w = (gx === 0) !== flip ? -7 : 7, y0 = Math.min(py(.43), py(.57)), h = Math.abs(py(.57) - py(.43)); ctx.fillRect(Math.min(x0, x0 + w), y0, 7, h); ctx.strokeRect(Math.min(x0, x0 + w), y0, 7, h); }
    }
    function drawPlayer(p, pos, kit, highlight, label, ring) {
      const x = px(pos.x), y = py(pos.y), r = highlight ? 8 : 6.5;
      const sp = Math.hypot(p.vx * 1.6, p.vy), bob = sp > .03 ? Math.sin(performance.now() / 70 + p.ph) * .6 : 0;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(x + 1.5, y + r * .8, r * .9, r * .35, 0, 0, Math.PI * 2); ctx.fill();
      if (highlight) { ctx.fillStyle = "rgba(255,230,90,.28)"; ctx.beginPath(); ctx.arc(x, y, r + 7 + Math.sin(performance.now() / 160) * 1.5, 0, Math.PI * 2); ctx.fill(); }
      if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      const grassy = nearGrass(kit[0]);
      ctx.fillStyle = p.i === 0 ? "#222" : grassy ? kit[1] : kit[0];
      ctx.beginPath();
      if (p.dive > 0) ctx.ellipse(x, y, r * .8, r * 1.7, 0, 0, Math.PI * 2);   // 키퍼 다이빙
      else ctx.arc(x, y - bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = grassy ? kit[0] : kit[1]; ctx.lineWidth = 1.5; ctx.stroke();
      // 달리는 방향 표시
      if (sp > .03 && p.dive <= 0) { const a = Math.atan2(py(p.y + p.vy) - py(p.y), px(p.x + p.vx) - px(p.x)); ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r + 1.5), y - bob + Math.sin(a) * (r + 1.5), 1.6, 0, Math.PI * 2); ctx.fill(); }
      if (p.lunge > 0) { ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y + r); ctx.stroke(); }
      const no = numOf(p.side, p.i);
      if (no !== "") { ctx.font = `bold ${highlight ? 8 : 7}px Jua, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = p.i === 0 ? "#fff" : grassy ? kit[0] : kit[1]; ctx.fillText(no, x, y - bob + .5); ctx.textBaseline = "alphabetic"; }
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
      for (const side of ["home", "away"]) for (const p of teams[side]) {
        if (!active(p)) continue;
        const kit = p.side === "home" ? cfg.home.kit : cfg.away.kit;
        const isMe = isMeP(p);
        const isRival = rvSide && p.side === rvSide && p.i === rivalSlot && roster[p.side][p.i] && roster[p.side][p.i].id === "rv";
        drawPlayer(p, p, kit, isMe, isMe ? me.name : isRival ? cfg.rival.name : null, isRival ? "#ff5a5a" : null);
      }
      if (trail.length > 1) {
        ctx.strokeStyle = replayMode ? "rgba(255,230,90,.85)" : "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); trail.forEach((t, k) => k ? ctx.lineTo(px(t.x), py(t.y) - t.z * 26) : ctx.moveTo(px(t.x), py(t.y) - t.z * 26)); ctx.stroke();
      }
      // 공: 땅 그림자 + 높이만큼 위로, 조금 크게
      const bxp = px(ball.x), byp = py(ball.y), bz = ball.z || 0;
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(bxp + 1, byp + 2, 3.4 - bz, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bxp, byp - bz * 26, 3.6 + bz * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.stroke();
      if (tag && performance.now() < tag.until && !replayMode) {
        ctx.font = "bold 10px Jua, sans-serif"; ctx.textAlign = "center";
        const w = ctx.measureText(tag.t).width + 10, tx = clamp(bxp, w / 2 + 4, W - w / 2 - 4), ty = clamp(byp - 22, 14, H - 6);
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(tx - w / 2, ty - 10, w, 14); ctx.fillStyle = "#fff"; ctx.fillText(tag.t, tx, ty + 1);
      }
      ctx.restore();
      if (replayMode) {
        ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(0, 0, W, 24);
        ctx.fillStyle = "#ffe45a"; ctx.font = "bold 13px Jua, sans-serif"; ctx.textAlign = "left";
        ctx.fillText("● REPLAY  " + (banner || ""), 10, 16);
      }
    }

    /* --- 루프 --- */
    const MIN_PER_SEC = 3;   // 1배속: 1초에 3분 (90분 ≈ 30초 + 찬스 장면)
    let last = performance.now(), alive = true, waiters = [];
    function snap() { return { b: { ...ball }, ps: ["home", "away"].map((s) => teams[s].map((p) => [p.x, p.y, p.vx, p.vy, p.dive, p.diveY])) }; }
    function loadSnap(f) { ball = { ...f.b }; ["home", "away"].forEach((s, k) => teams[s].forEach((p, i) => { const q = f.ps[k][i]; if (q) { p.x = q[0]; p.y = q[1]; p.vx = q[2]; p.vy = q[3]; p.dive = q[4]; p.diveY = q[5]; } })); }
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (playback) {
        playback.i += dt * 60 * playback.rate;
        const f = playback.frames[Math.min(playback.frames.length - 1, Math.floor(playback.i))];
        if (f) { loadSnap(f); trail.push({ x: ball.x, y: ball.y, z: ball.z }); if (trail.length > 60) trail.shift(); focus = { x: ball.x, y: ball.y }; }
        if (playback.i >= playback.frames.length - 1) { const d = playback.done; playback = null; d(); }
      } else if (script) {
        const sdt = dt * Math.min(speed, 3) * (script.slow || 1);
        stepBall(sdt); stepPlayers(sdt);
        if (rec) rec.push(snap());
        trail.push({ x: ball.x, y: ball.y, z: ball.z }); if (trail.length > 40) trail.shift();
        if (zoomTarget > 1) focus = { x: ball.x, y: ball.y };
      } else if (!paused) {
        minute = Math.min(90, minute + dt * MIN_PER_SEC * speed);
        root.querySelector("#m-min").textContent = (minute < 45 ? "전반 " : "후반 ") + Math.floor(minute) + "'";
        if (!onPitch && minute >= subMin && teams.home[mySlot]) { onPitch = true; const s = myT0.subs.find((x) => x.in.id === "me"); if (s) roster.home[mySlot] = s.in; const mp = teams.home[mySlot]; mp.x = .5; mp.y = .02; feed(`🔁 ${me.name} 교체 투입!`, "me"); }
        const sdt = dt * Math.min(speed, 4);
        stepBall(sdt); stepPlayers(sdt);
        if (trail.length) trail.shift();
        waiters = waiters.filter((w) => { if (minute >= w.min) { w.res(); return false; } return true; });
      } else if (!replayMode) { stepPlayers(dt * .35); if (trail.length) trail.shift(); }
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const waitMin = (m) => new Promise((res) => waiters.push({ min: m, res }));
    const until = (fn, max = 2.5) => new Promise((res) => { const t0 = performance.now(); const tick = () => { if (fn() || performance.now() - t0 > max * 1000 / Math.min(speed, 3)) res(); else requestAnimationFrame(tick); }; tick(); });

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
    /* ---- 찬스 장면: 엔진이 고른 슈터 · 도움 · 수비 · 키퍼가 직접 움직여요 ----
     * 공 뺏기/전개 → (도움 선수) 측면이면 크로스, 가운데면 스루패스 → 슈터 쇄도 → 슈팅 → 키퍼 다이빙
     * 결과는 ev.out 그대로: goal(그물) · save(키퍼 선방 → 코너킥 또는 캐치) · block(몸으로 막기) · miss(빗나감 → 골킥) */
    function spriteOf(pl, side) { const i = slotOf(pl, side); return (teams[side][i] && active(teams[side][i])) ? teams[side][i] : fwdIdx(side); }
    async function playChance(ev, side) {
      const opp = other(side), d = DIR[side], gx = goalX(side), out = ev.out;
      const shP = spriteOf(ev.sh, side);
      const asP0 = ev.as ? spriteOf(ev.as, side) : null, asP = asP0 && asP0 !== shP ? asP0 : null;
      const dfP = (ev.df && spriteOf(ev.df, opp)) || nearest(opp, shP)[0];
      const gkP = teams[opp][0];
      const after = { kind: null };
      if (skipping) {   // 결과 보기: 장면 없이 결과만
        ball = { x: out === "goal" ? gx + d * .012 : absX(side, .9), y: .5, z: 0 };
        return after;
      }
      restart = null; loose = null; flight = null;
      script = { targets: new Map(), fast: new Set(), slow: 1 };
      const TG = script.targets, F = script.fast;
      const header = !!asP && Math.abs(asP.by - .5) > .25 && !ev.pen;   // 측면 도움이면 크로스 → 헤더
      rec = (ev.sh.id === "me" && out === "goal") ? [] : null;
      zoomTarget = 1.35; focus = { x: ball.x, y: ball.y };
      const boxY = rand(.38, .62), shotPt = { x: absX(side, header ? rand(.89, .93) : rand(.83, .89)), y: boxY };
      // 공격수는 박스로, 수비는 박스 앞으로 내려와요
      for (const p of teams[side]) if (active(p) && p !== shP && p !== asP && p.i !== 0) TG.set(p, (p.role === "fw" || p.role === "wg") ? { x: absX(side, rand(.8, .9)), y: clamp(.5 + (p.by - .5) * .6, .3, .7) } : targetOf(p));
      for (const p of teams[opp]) if (active(p) && p.i !== 0 && p !== dfP) TG.set(p, { x: absX(side, p.role === "df" ? rand(.86, .92) : rand(.72, .8)), y: clamp(.5 + (p.by - .5) * .55, .25, .75) });
      TG.set(gkP, { x: absX(side, .975), y: .5 });
      const mark = () => TG.set(dfP, { x: shP.x + d * .035, y: shP.y + (.5 - shP.y) * .2 });

      if (ev.pen) {
        // 페널티킥: 공은 페널티 지점, 다른 선수는 박스 밖, 키퍼는 골라인
        const spot = { x: absX(side, .89), y: .5 };
        carrier = null; ball = { ...spot, z: 0 };
        for (const p of [...teams.home, ...teams.away]) if (active(p) && p !== shP && p !== gkP) TG.set(p, { x: absX(side, rand(.76, .8)), y: rand(.25, .75) });
        TG.set(shP, { x: spot.x - d * .03, y: .5 }); TG.set(gkP, { x: absX(side, .99), y: .5 });
        await until(() => dist(shP, { x: spot.x - d * .03, y: .5 }) < .02, 2.2);
        await sleepMs(500);
        TG.set(shP, spot); F.add(shP);
        await until(() => dist(shP, spot) < .02, 1);
      } else {
        // 1) 공 확보: 상대 공이면 가로채요
        const builder = asP || teams[side].filter((p) => active(p) && p !== shP && (p.role === "mf" || p.role === "wg")).sort((a, b) => dist(a, ball) - dist(b, ball))[0] || shP;
        if (!carrier || carrier.side !== side) {
          const victim = carrier;
          TG.set(builder, { x: ball.x, y: ball.y }); F.add(builder);
          await until(() => dist(builder, ball) < .035, 1.2);
          if (victim) { builder.lunge = .35; victim.stun = .5; }
          takeBall(builder);
        } else if (carrier !== builder) {
          kick(carrier, { x: builder.x + d * .03, y: builder.y }, { recv: builder, onEnd: () => {} });
          await flyDone(); takeBall(builder);
        }
        // 2) 전개: 도움 선수가 크로스 지점/스루패스 지점까지 몰고 가요
        const dest = header ? { x: absX(side, rand(.8, .87)), y: builder.by < .5 ? .1 : .9 } : { x: absX(side, rand(.62, .7)), y: clamp(builder.y, .28, .72) };
        TG.set(builder, dest); F.add(builder);
        TG.set(shP, { x: absX(side, .72), y: boxY }); F.add(shP); mark();
        await until(() => dist(builder, dest) < .03, 2);
        // 3) 패스: 크로스(띄운 공) 또는 스루패스(빠른 땅볼), 슈터는 그 자리로 쇄도
        TG.set(shP, shotPt); mark();
        if (builder !== shP) {
          if (header) say(T("크로스", "Cross")); else say(T("스루패스", "Through ball"));
          kick(builder, shotPt, { h: header ? 1 : 0, speed: header ? .7 : .95, onEnd: () => {} });
          await flyDone();
          await until(() => dist(shP, shotPt) < .04, .6);
          takeBall(shP);
        }
        // 슈터가 직접 몰고 들어가는 경우(도움 없음): 수비를 제치며 박스로
        if (!asP) {
          TG.set(shP, shotPt); mark();
          if (ev.mom === "dribble" || Math.random() < .5) setTimeout(() => { dfP.lunge = .35; }, 350);
          await until(() => dist(shP, shotPt) < .03, 1.6);
        }
      }
      // 4) 슈팅
      carrier = null;
      const fromPt = { x: ball.x, y: ball.y };
      let tgt;
      if (out === "goal") tgt = { x: gx + d * .012, y: rand(.45, .55) };
      else if (out === "save") tgt = { x: absX(side, .985), y: clamp(gkP.y + rand(-.05, .05), .44, .56) };
      else if (out === "block") { const bp = { x: fromPt.x + d * .06, y: fromPt.y + (.5 - fromPt.y) * .2 }; TG.set(dfP, bp); F.add(dfP); await until(() => dist(dfP, bp) < .03, .4); tgt = { x: dfP.x, y: dfP.y }; }
      else tgt = Math.random() < .4 ? { x: gx + d * .03, y: rand(.46, .54), over: true } : { x: gx + d * .03, y: Math.random() < .5 ? rand(.33, .41) : rand(.59, .67) };
      if (out !== "block") {
        gkP.dive = .55;
        gkP.diveY = out === "save" ? tgt.y : out === "goal" ? clamp(tgt.y + (Math.random() < .5 ? -.08 : .08), .38, .62) : clamp(tgt.y, .4, .6);
      }
      script.slow = out === "goal" ? .75 : 1;
      kick(shP, tgt, { kind: "shot", speed: 1.5, h: tgt.over ? .55 : header ? .15 : .1, onEnd: () => {} });
      await flyDone();
      script.slow = 1;
      // 5) 결과 처리
      if (out === "save") {
        if (Math.random() < .45) { kick(gkP, { x: gx + d * .02, y: tgt.y < .5 ? .3 : .7 }, { h: .5, onEnd: () => {} }); await flyDone(); after.kind = "corner"; after.at = { x: gx > .5 ? .995 : .005, y: tgt.y < .5 ? .01 : .99 }; }
        else takeBall(gkP);
      } else if (out === "block") {
        if (Math.random() < .35) { kick(dfP, { x: gx + d * .02, y: Math.random() < .5 ? .2 : .8 }, { h: .3, onEnd: () => {} }); await flyDone(); after.kind = "corner"; after.at = { x: gx > .5 ? .995 : .005, y: ball.y < .5 ? .01 : .99 }; }
        else { lastTouch = opp; takeBall(dfP); }
      } else if (out !== "goal") { after.kind = "goalkick"; }
      await sleepMs(out === "goal" ? 250 : 150);
      script = null;
      return after;
    }
    async function replayGoal() {
      if (skipping || !rec || rec.length < 10) { rec = null; return; }
      const frames = rec; rec = null;
      replayMode = true; banner = `${me.name}의 골`; trail = [];
      zoomTarget = 1.6;
      await new Promise((done) => { playback = { frames, i: Math.max(0, frames.length - 260), rate: .45, done }; });
      await sleepMs(450);
      replayMode = false; unzoom(); trail = [];
    }

    async function showEv(ev) {
      const side = vis(ev.side), mine = side === "home";
      const runner = teams[side][slotOf(ev.sh, side)];
      if (ev.pen) { feed(`⚠️ 페널티킥 선언! 키커 ${nm(ev.sh)}`, mine ? "goal" : "bad"); await flashText("PK!", mine ? "goal" : "bad", 700); }
      if (ev.mom) {
        possession = mine ? "home" : "away";
        feed(ev.mom === "tackle" ? `🔥 승부처! ${nm(ev.sh)}의 돌파를 막아라` : ev.mom === "pk" ? `🔥 <b>${esc(me.name)}</b>, 페널티킥 키커로 나서요` : `🔥 승부처! 공이 <b>${esc(me.name)}</b>에게`, "me");
        zoomOn(ev.mom === "tackle" ? runner : myP());
        await sleepMs(skipping ? 0 : 600);
        const r = await mini(ev); ev.res = r; ev.out = r.out;
        st.moments.push({ type: ev.mom, ok: r.ok });
        if (r.why && !auto) feed(`💬 ${r.why}`, "me");
        if (r.foul) {
          // 무리한 태클 → 경고 (이미 경고가 있으면 주심이 한 번 봐줘요)
          const inc = cfg.m.inc || (cfg.m.inc = []);
          if (!inc.some((i) => i.p === ev.df && i.kind === "yc")) { inc.push({ min: ev.min, side: ev.side === "home" ? "away" : "home", p: ev.df, kind: "yc" }); feed(`🟨 <b>${esc(me.name)}</b> 경고`, "bad"); }
        }
        unzoom();
      }
      possession = side;
      if (ev.out === "goal") {
        const fromMe = ev.sh.id === "me";
        await playChance(ev, side);
        mine ? gf++ : ga++; updScore(); mine ? Sfx.goal() : Sfx.miss(); if (typeof Bgm !== "undefined") Bgm.roar(mine);
        feed(`⚽ ${nm(ev.sh)}의 ${ev.pen ? "페널티킥 " : ""}골!${ev.as ? ` (도움 ${nm(ev.as)})` : ""}`, (fromMe || (ev.as && ev.as.id === "me")) ? "me goal" : ev.rv ? "rival" : mine ? "goal" : "bad");
        await flashText(mine ? "GOAL!!" : "실점…", mine ? "goal" : "bad", mine ? 1100 : 800);
        if (fromMe) await replayGoal();
        unzoom(); kickoff(other(side));
      } else {
        const aft = await playChance(ev, side);
        const txt = ev.pen ? (ev.out === "save" ? `🧤 ${nm(ev.gk)}, 페널티킥 선방!` : `💨 ${nm(ev.sh)} 페널티킥 실축`) : ev.out === "save" ? `🧤 ${nm(ev.gk)} 선방! (${nm(ev.sh)}의 슈팅)` : ev.out === "block" ? `🛡️ ${nm(ev.df)}의 수비 (${nm(ev.sh)} 차단)` : `💨 ${nm(ev.sh)}의 슈팅이 빗나가요`;
        feed(txt, ev.mom ? "me" : ev.rv ? "rival" : "");
        unzoom();
        if (aft.kind === "corner") setRestart("corner", side, aft.at);
        else if (aft.kind === "goalkick") setRestart("goalkick", other(side), { x: side === "home" ? .95 : .05, y: rand(.4, .6) });
      }
    }

    async function showInc(i) {
      const mine = vis(i.side) === "home", isMe = i.p.id === "me";
      const t = i.kind === "yc" ? `🟨 ${nm(i.p)} 경고` : i.kind === "yc2" ? `🟨🟥 ${nm(i.p)} 경고 누적 퇴장!` : i.kind === "rc" ? `🟥 ${nm(i.p)} 레드카드, 퇴장!`
        : `🚑 ${nm(i.p)} 부상${i.sub ? ` → ${nm(i.sub)} 교체 투입` : " (교체 카드가 없어 10명으로)"}`;
      feed(t + (mine ? "" : ` <small>(${esc(cfg.away.name)})</small>`), isMe ? "me" : i.kind === "yc" ? "" : "bad");
      if (Sfx.card) Sfx.card();
      if (i.kind !== "yc") { if (!mine) Sfx.good(); else Sfx.bad(); }
      const sd = vis(i.side), idx = roster[sd].indexOf(i.p);
      if (i.kind !== "yc" && idx >= 0) { if (i.kind === "inj" && i.sub) roster[sd][idx] = i.sub; else teams[sd][idx].gone = true; }
      if (isMe && i.kind !== "yc") { onPitch = false; await flashText(i.kind === "inj" ? "부상…" : "퇴장…", "bad", 900); }
      else if (i.kind === "rc" || i.kind === "yc2") await flashText("🟥", mine ? "bad" : "goal", 600);
      if (i.kind !== "inj" && !skipping) setRestart("free", other(vis(i.side)), { x: clamp(ball.x, .05, .95), y: clamp(ball.y, .05, .95) });
    }

    /* --- 진행 --- */
    (async () => {
      feed(`🏟️ ${esc(cfg.home.name)} vs ${esc(cfg.away.name)} 킥오프!`);
      if (cfg.rival) feed(cfg.rival.side === "away" ? `⚔️ 상대에 라이벌 <b>${esc(josa(cfg.rival.name, "이/가"))}</b> 뛰어요` : `🤝 라이벌 <b>${esc(josa(cfg.rival.name, "과/와"))}</b> 같은 편으로 뛰어요`, "rival");
      if (!me.starter) feed(subMin < 99 ? `🪑 ${josa(me.name, "은/는")} 벤치에서 시작해요` : `🪑 ${josa(me.name, "은/는")} 오늘 출전하지 못해요`);
      Sfx.whistle();
      await sleepMs(400);
      paused = false;
      const myT = mySide === "home" ? cfg.m.H : cfg.m.A;
      const items = [...cfg.m.evs.map((e) => ({ min: e.min, ev: e })), ...(cfg.m.inc || []).map((i) => ({ min: i.min, inc: i })),
        ...myT.subs.filter((s) => !s.inj && s.in.id !== "me").map((s) => ({ min: s.min, sub: s, side: "home" })),
        ...opT0.subs.filter((s) => !s.inj).map((s) => ({ min: s.min, sub: s, side: "away", quiet: true })), { min: 45.5, ht: true }].sort((a, b) => a.min - b.min);
      for (const it of items) {
        director = it.ev ? { side: vis(it.ev.side), min: it.min } : null;
        await waitMin(it.min);
        paused = true;
        if (it.ht) {
          // ⏸️ 하프타임: 휘슬 → 스코어 → 진영 바꿔 후반 킥오프 (후반은 원정팀이 차요)
          Sfx.whistle(); feed(`⏸️ 전반 종료 ${gf} : ${ga}`);
          root.querySelector("#m-min").textContent = "HT";
          if (!skipping) await flashText("HALF TIME", "", 1000);
          flip = true; kickoff("away"); unzoom(); trail = [];
          if (!skipping) await sleepMs(500);
          Sfx.whistle(); feed("▶️ 후반 시작! 진영을 바꿨어요");
        } else if (it.ev) await showEv(it.ev);
        else if (it.sub) { swapIn(it.side, it.sub.out, it.sub.in); if (!it.quiet) feed(`🔁 교체: ${nm(it.sub.in)} IN · ${nm(it.sub.out)} OUT`); }
        else await showInc(it.inc);
        if (!skipping) await sleepMs(it.ev ? 180 : 80);
        paused = false;
      }
      await waitMin(90);
      paused = true; if (Sfx.fulltime) Sfx.fulltime(); else Sfx.whistle(true);
      feed("🔔 경기 종료!");
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
