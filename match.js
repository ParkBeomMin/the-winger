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
    const mySlot = SLOT_BY_POS[me.pos] ?? 9;
    const homeStr = cfg.home.str, awayStr = cfg.away.str;
    let auto = !!cfg.auto, speed = 1, skipping = false;

    root.innerHTML = `
      <div class="m-board">
        <div class="m-team home"><i style="background:${cfg.home.kit[0]}"></i>${esc(cfg.home.name)}</div>
        <div class="m-score"><b id="m-gf">0</b><span>:</span><b id="m-ga">0</b><small id="m-min">0'</small></div>
        <div class="m-team away">${esc(cfg.away.name)}<i style="background:${cfg.away.kit[0]}"></i></div>
      </div>
      <div class="m-pitch-wrap"><canvas class="m-pitch"></canvas><div class="m-overlay" hidden></div><div class="m-flash" hidden></div></div>
      <div class="m-ctrl">
        <label class="tgl"><input type="checkbox" id="m-auto" ${auto ? "checked" : ""}/> 🤖 승부처 자동</label>
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
    root.querySelector("#m-auto").onchange = (e) => { auto = e.target.checked; cfg.onAutoChange && cfg.onAutoChange(auto); };
    root.querySelectorAll(".m-spd [data-s]").forEach((b) => b.onclick = () => {
      speed = +b.dataset.s; root.querySelectorAll(".m-spd [data-s]").forEach((x) => x.classList.toggle("on", x === b));
    });
    root.querySelector("#m-skip").onclick = () => { skipping = true; auto = true; speed = 40; };

    /* --- 선수 --- */
    function mkTeam(side) {
      return FORMATION.map((f, i) => ({ i, side, bx: side === "home" ? f[0] : 1 - f[0], by: side === "home" ? f[1] : 1 - f[1], x: 0, y: 0, ph: Math.random() * 6 }));
    }
    const teams = { home: mkTeam("home"), away: mkTeam("away") };
    const rivalSlot = cfg.rival ? (cfg.rival.slot ?? SLOT_BY_POS[cfg.rival.pos] ?? 9) : -1;
    let onPitch = me.starter ? true : false;           // 벤치면 60분 이후 교체 투입
    const subMin = me.starter ? 0 : randi(58, 70);

    let possession = "home", owner = 6, ball = { x: .5, y: .5 }, ballFrom = { x: .5, y: .5 }, ballT = 1;
    let minute = 0, paused = true, zoom = 1, zoomTarget = 1, focus = null;
    let seq = null, trail = [], replayMode = false, banner = null;
    let gf = 0, ga = 0;
    const st = { goals: 0, assists: 0, saves: 0, moments: [], events: [] };

    function playerPos(p) {
      const att = possession === p.side ? 1 : -1;
      const dir = p.side === "home" ? 1 : -1;
      const push = p.i === 0 ? 0.02 : 0.07;
      const x = p.bx + dir * att * push + (ball.x - .5) * (p.i === 0 ? .05 : .18);
      const y = p.by + (ball.y - p.by) * (p.i === 0 ? .1 : .14) + Math.sin(performance.now() / 900 + p.ph) * .012;
      return { x: clamp(x, .02, .98), y: clamp(y, .04, .96) };
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
      const x = px(pos.x), y = py(pos.y), r = highlight ? 7 : 5;
      if (highlight) {
        ctx.fillStyle = "rgba(255,230,90,.28)"; ctx.beginPath(); ctx.arc(x, y, r + 7 + Math.sin(performance.now() / 160) * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = p.i === 0 ? "#222" : kit[0];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = kit[1]; ctx.lineWidth = 1.5; ctx.stroke();
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
        let pos = playerPos(p);
        if (seq && seq.runner === p) pos = { x: ball.x - (seq.side === "home" ? .025 : -.025), y: ball.y + .02 };
        if (side === "home" && p.i === mySlot && !onPitch) continue;
        p.x = pos.x; p.y = pos.y; all.push([p, pos]);
      }
      for (const [p, pos] of all) {
        const kit = p.side === "home" ? cfg.home.kit : cfg.away.kit;
        const isMe = p.side === "home" && p.i === mySlot;
        const isRival = cfg.rival && p.side === (cfg.rival.side || "away") && p.i === rivalSlot;
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
    let passClock = 0;
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!paused && !seq) {
        minute = Math.min(90, minute + dt * 4.5 * speed);
        root.querySelector("#m-min").textContent = Math.floor(minute) + "'";
        if (!onPitch && minute >= subMin) { onPitch = true; feed(`🔁 ${subMin}' ${me.name} 교체 투입!`, "me"); }
        passClock -= dt * speed;
        if (passClock <= 0) {
          passClock = rand(.45, .9);
          // 점유 바뀜 — 전력 차를 조금 반영
          const pHome = clamp(.5 + (homeStr - awayStr) / 120, .3, .7);
          if (Math.random() < .22) possession = Math.random() < pHome ? "home" : "away";
          const team = teams[possession];
          const cand = team.filter((p) => p.i !== 0 && !(possession === "home" && p.i === mySlot && !onPitch));
          const next = Math.random() < .25 && possession === "home" && onPitch ? team[mySlot] : pick(cand);
          ballFrom = { x: ball.x, y: ball.y }; owner = next.i; ballT = 0;
        }
        waiters = waiters.filter((w) => { if (minute >= w.min) { w.res(); return false; } return true; });
      }
      if (seq) {
        seq.t += dt * seq.rate * (replayMode ? 1 : Math.min(speed, 3));
        const k = clamp(seq.t / seq.dur, 0, 1);
        const pts = seq.path, segs = pts.length - 1, f = k * segs, si = Math.min(segs - 1, Math.floor(f)), lt = f - si;
        const ease = lt * lt * (3 - 2 * lt);
        ball.x = pts[si].x + (pts[si + 1].x - pts[si].x) * ease;
        ball.y = pts[si].y + (pts[si + 1].y - pts[si].y) * ease;
        trail.push({ x: ball.x, y: ball.y }); if (trail.length > 40) trail.shift();
        if (k >= 1) { const done = seq.done; seq = null; done(); }
      } else {
        const tgt = teams[possession][owner];
        if (tgt) {
          ballT = Math.min(1, ballT + dt * 3 * speed);
          const tp = { x: tgt.x || .5, y: tgt.y || .5 };
          ball.x = ballFrom.x + (tp.x - ballFrom.x) * ballT; ball.y = ballFrom.y + (tp.y - ballFrom.y) * ballT;
        }
        if (trail.length) trail.shift();
      }
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const waitMin = (m) => new Promise((res) => waiters.push({ min: m, res }));

    /* 공격 시퀀스: 공이 path를 따라 움직여요 */
    function runSeq(side, runner, endPts, rate = 1, dur = 1.6) {
      return new Promise((done) => {
        const start = { x: ball.x, y: ball.y };
        seq = { side, runner, path: [start, ...endPts], t: 0, dur, rate, done };
        trail = [];
      });
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

    /* --- 시간표 만들기 --- */
    const lamFor = clamp(1.3 * Math.exp((homeStr - awayStr) / 20), .25, 3.6);
    const lamAg = clamp(1.15 * Math.exp((awayStr - homeStr) / 20), .2, 3.4);
    const myCount = me.starter ? randi(1, 2) + (Math.random() < .3 ? 1 : 0) : 1;
    const timeline = [];
    const mateGoals = Math.min(5, poisson(Math.max(.15, lamFor - myCount * .3)));
    const oppGoals = Math.min(5, poisson(lamAg));
    for (let i = 0; i < mateGoals; i++) timeline.push({ min: rand(3, 89), kind: "goalFor" });
    for (let i = 0; i < oppGoals; i++) timeline.push({ min: rand(3, 89), kind: "goalAg" });
    for (let i = 0; i < randi(2, 4); i++) timeline.push({ min: rand(5, 88), kind: "chance", side: Math.random() < .5 ? "home" : "away" });
    const startM = me.starter ? 8 : subMin + 3;
    for (let i = 0; i < myCount; i++) timeline.push({ min: rand(startM, 87), kind: "me", type: pick(POS[me.pos].moments) });
    if (cfg.rival && cfg.rival.side === "away") timeline.push({ min: rand(20, 85), kind: "rival" });
    timeline.sort((a, b) => a.min - b.min);

    /* --- 미니게임 --- */
    function statOf(type) { return type === "shot" ? me.stats.sho : type === "pass" ? me.stats.pas : type === "dribble" ? me.stats.dri : me.stats.def; }
    function autoP(type, oppStr) {
      return clamp(.3 + (statOf(type) - oppStr * .9) / 80 + (me.form || 0) * .04 + ((me.cond ?? 70) - 60) / 400, .1, .85);
    }
    function mini(type, oppStr, label) {
      const stat = statOf(type);
      if (auto) return Promise.resolve(Math.random() < autoP(type, oppStr));
      return new Promise((done) => {
        overlay.hidden = false;
        const L = MINI_LABEL[type];
        let finished = false;
        const end = (ok) => { if (finished) return; finished = true; clearInterval(tick); (ok ? Sfx.good : Sfx.bad)(); setTimeout(() => { overlay.hidden = true; overlay.innerHTML = ""; done(ok); }, 380); };
        const limit = type === "dribble" ? 4 : clamp(2.2 + stat / 90, 2.4, 3.6);
        let left = limit;
        overlay.innerHTML = `<div class="mg"><div class="mg-h"><b>${label || L.title}</b><span>${L.hint}</span></div><div class="mg-body"></div><div class="mg-timer"><i></i></div></div>`;
        const body = overlay.querySelector(".mg-body"), bar = overlay.querySelector(".mg-timer i");
        const tick = setInterval(() => {
          left -= .05; bar.style.width = clamp(left / limit, 0, 1) * 100 + "%";
          if (left <= 0) end(Math.random() < autoP(type, oppStr) * .35);
        }, 50);
        if (type === "shot") {
          body.innerHTML = `<div class="mg-goal">${[0, 1, 2, 3, 4, 5].map((z) => `<button data-z="${z}"></button>`).join("")}<div class="mg-keeper">🧤</div></div>`;
          const keeperCol = Math.random() < .4 ? 1 : (Math.random() < .5 ? 0 : 2);
          body.querySelectorAll("[data-z]").forEach((b) => b.onclick = () => {
            Sfx.kick();
            const z = +b.dataset.z, col = z % 3, top = z < 3;
            const kp = body.querySelector(".mg-keeper"); kp.style.left = (keeperCol * 33.3 + 16.6) + "%";
            b.classList.add("hit");
            const corner = col !== 1 && top;
            const missP = corner ? clamp(.3 - (stat - 40) / 220, .05, .3) : col !== 1 ? clamp(.12 - (stat - 40) / 500, .03, .12) : .02;
            const saveP = col === keeperCol ? clamp(.9 - stat / 300 + oppStr / 400, .45, .88) : Math.abs(col - keeperCol) === 1 ? .15 : .05;
            end(Math.random() > missP && Math.random() > saveP);
          });
        } else if (type === "pass") {
          const open = randi(0, 2), spots = [[22, 30], [55, 18], [80, 42]];
          body.innerHTML = `<div class="mg-field">${spots.map((s, k) => `<button class="mate" data-k="${k}" style="left:${s[0]}%;top:${s[1]}%">${k + 1}</button>`).join("")}
            ${spots.map((s, k) => `<i class="def ${k === open ? "away" : ""}" style="left:${s[0] + (k === open ? 26 : 8)}%;top:${s[1] + (k === open ? 40 : 10)}%"></i>`).join("")}<b class="me" style="left:48%;top:78%">나</b></div>`;
          setTimeout(() => body.querySelectorAll(".def").forEach((d, k) => { if (k !== open) { d.style.transform = "translate(-6px,-4px)"; } }), 30);
          body.querySelectorAll(".mate").forEach((b) => b.onclick = () => {
            Sfx.kick();
            const ok = +b.dataset.k === open ? Math.random() < .86 + stat / 1000 : Math.random() < .12 + stat / 400;
            end(ok);
          });
        } else if (type === "dribble") {
          const zw = clamp(10 + stat / 5, 12, 30), zc = rand(25, 75);
          body.innerHTML = `<div class="mg-bar"><i class="zone" style="left:${zc - zw / 2}%;width:${zw}%"></i><i class="mk"></i></div><button class="btn btn-primary mg-tap">탭!</button>`;
          const mk = body.querySelector(".mk"); let t = 0, v = 1.15 + oppStr / 120;
          const anim = setInterval(() => { t += .016 * v; const p = (Math.sin(t * Math.PI) * .5 + .5) * 100; mk.style.left = p + "%"; mk.dataset.p = p; if (finished) clearInterval(anim); }, 16);
          body.querySelector(".mg-tap").onclick = () => { Sfx.tap(); const p = +mk.dataset.p; clearInterval(anim); end(Math.abs(p - zc) <= zw / 2 + 1); };
        } else {
          const goLeft = Math.random() < .5;
          const truthful = Math.random() < clamp(.55 + stat / 220, .55, .95);
          const tell = truthful === goLeft ? "left" : "right";
          body.innerHTML = `<div class="mg-tackle"><div class="att lean-${tell}">🏃</div><div class="mg-two"><button data-d="left">⬅️ 왼쪽</button><button data-d="right">오른쪽 ➡️</button></div></div>`;
          body.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => {
            Sfx.tap();
            const right = (b.dataset.d === "left") === goLeft;
            end(right ? Math.random() < .9 : Math.random() < .15 + (me.stats.spd || 40) / 400);
          });
        }
      });
    }

    /* --- 사건 처리 --- */
    const myP = () => teams.home[mySlot];
    function zoomOn(p) { focus = p; zoomTarget = skipping ? 1 : 1.7; }
    function unzoom() { zoomTarget = 1; }
    async function goalFor(scorerIdx, fromMe, desc) {
      possession = "home";
      const runner = teams.home[scorerIdx];
      const path = attackPath("home", true, fromMe);
      await runSeq("home", runner, path, 1, fromMe ? 1.1 : 1.6);
      gf++; updScore(); Sfx.goal();
      feed(desc, fromMe ? "me goal" : "goal");
      await flashText("GOAL!!", "goal");
      return path;
    }
    async function goalAg(desc, idx) {
      possession = "away";
      const runner = teams.away[idx ?? pick([8, 9, 10])];
      await runSeq("away", runner, attackPath("away", true, false), 1, 1.5);
      ga++; updScore(); Sfx.miss();
      feed(desc, "bad");
      await flashText("실점…", "bad", 800);
    }
    async function replay(path) {
      if (skipping) return;
      replayMode = true; banner = `${me.name}의 골`;
      ball.x = path[0].x - .15; ball.y = path[0].y;
      zoomOn({ x: path[path.length - 1].x - .1, y: path[path.length - 1].y });
      await runSeq("home", myP(), path, .35, 1.1);
      await sleepMs(500);
      replayMode = false; unzoom(); trail = [];
    }

    async function handle(ev) {
      if (ev.kind === "goalFor") {
        const scorer = pick([8, 9, 10, 9, 5, 7].filter((i) => !(i === mySlot && onPitch)));
        // 내가 뛰고 있으면 가끔 도움이 붙어요
        const assisted = onPitch && Math.random() < (me.pos === "mf" ? .3 : me.pos === "wg" ? .22 : .1);
        if (assisted) st.assists++;
        await goalFor(scorer, false, assisted ? `⚽ 동료의 골! <b>${me.name}</b>의 도움 🅰️` : "⚽ 동료의 골! 팀이 앞서 나가요");
      } else if (ev.kind === "goalAg") {
        await goalAg(`😱 ${esc(cfg.away.name)}에 실점`);
      } else if (ev.kind === "chance") {
        possession = ev.side;
        await runSeq(ev.side, teams[ev.side][pick([8, 9, 10])], attackPath(ev.side, false, false), 1, 1.4);
        feed(ev.side === "home" ? "💨 아쉽게 빗나간 슛" : "😮 상대 슛이 골대를 비껴가요");
      } else if (ev.kind === "rival") {
        const rv = cfg.rival;
        possession = "away";
        feed(`🔥 라이벌 <b>${esc(josa(rv.name, "이/가"))}</b> 공을 잡았어요!`, "rival");
        const canStop = onPitch && (me.pos === "df" || me.pos === "mf");
        if (canStop) {
          zoomOn(teams.away[rivalSlot]); paused = true;
          await sleepMs(skipping ? 0 : 500);
          const ok = await mini("tackle", rv.ovr, `🛡️ 라이벌 ${rv.name}의 돌파!`);
          unzoom();
          st.moments.push({ type: "tackle", ok, rival: true });
          if (ok) { st.saves++; feed(`🛡️ <b>${me.name}</b>, 라이벌을 완벽하게 막아냅니다!`, "me"); await flashText("라이벌 봉쇄!", "goal", 800); }
          else await goalAg(`💥 라이벌 <b>${esc(rv.name)}</b>의 골… 막지 못했어요`, rivalSlot);
          if (!ok) st.rivalGoal = true;
        } else {
          const p = clamp(.35 + (rv.ovr - homeStr) / 60, .15, .7);
          if (Math.random() < p) { st.rivalGoal = true; await goalAg(`💥 라이벌 <b>${esc(rv.name)}</b>의 골!`, rivalSlot); }
          else { await runSeq("away", teams.away[rivalSlot], attackPath("away", false, false), 1, 1.3); feed(`😤 라이벌의 슛, 골대를 벗어나요`); }
        }
      } else if (ev.kind === "me") {
        if (!onPitch) return;
        const type = ev.type;
        possession = "home"; owner = mySlot; ballFrom = { x: ball.x, y: ball.y }; ballT = 0;
        feed("🔥 승부처! 공이 <b>" + me.name + "</b>에게", "me");
        const p = myP(); zoomOn(p);
        await sleepMs(skipping ? 0 : 650);
        const ok = await mini(type, awayStr);
        st.moments.push({ type, ok });
        unzoom();
        if (type === "shot") {
          if (ok) { st.goals++; const path = await goalFor(mySlot, true, `⚽ <b>${me.name}</b>의 골!!`); await replay(path); }
          else { await runSeq("home", p, attackPath("home", false, true), 1, 1); Sfx.miss(); feed(`🙈 ${me.name}의 슛, 막혔어요`); }
        } else if (type === "dribble") {
          if (ok) {
            feed(`🏃 <b>${me.name}</b>, 수비를 제쳤다!`, "me");
            if (Math.random() < (me.pos === "wg" || me.pos === "fw" ? .45 : .3)) { st.goals++; const path = await goalFor(mySlot, true, `⚽ 돌파에 이은 <b>${me.name}</b>의 골!!`); await replay(path); }
            else if (Math.random() < .6) { st.assists++; await goalFor(9 === mySlot ? 8 : 9, false, `⚽ <b>${me.name}</b>의 돌파 후 컷백, 동료가 마무리! 🅰️`); }
            else feed("💨 돌파 후 크로스, 아쉽게 머리에 안 맞았어요");
          } else feed(`😵 ${me.name}, 공을 뺏겼어요`);
        } else if (type === "pass") {
          if (ok) {
            if (Math.random() < .68) { st.assists++; await goalFor(mySlot === 9 ? 10 : 9, false, `⚽ <b>${me.name}</b>의 킬패스! 동료가 마무리 🅰️`); }
            else feed(`🎯 ${me.name}의 패스가 찬스를 만들었지만 키퍼 선방`);
          } else feed(`🙈 ${me.name}의 패스가 끊겼어요`);
        } else {
          if (ok) { st.saves++; feed(`🛡️ <b>${me.name}</b>의 완벽한 태클!`, "me"); }
          else await goalAg(`😱 ${josa(me.name, "이/가")} 뚫리며 실점`);
        }
      }
    }

    /* --- 진행 --- */
    (async () => {
      feed(`🏟️ ${esc(cfg.home.name)} vs ${esc(cfg.away.name)} 킥오프!`);
      if (cfg.rival) feed(`⚔️ 상대에 라이벌 <b>${esc(josa(cfg.rival.name, "이/가"))}</b> 뛰어요`, "rival");
      if (!me.starter) feed(`🪑 ${josa(me.name, "은/는")} 벤치에서 시작해요`);
      Sfx.whistle();
      await sleepMs(400);
      paused = false;
      for (const ev of timeline) {
        await waitMin(ev.min);
        paused = true;
        await handle(ev);
        if (!skipping) await sleepMs(250);
        paused = false;
      }
      await waitMin(90);
      paused = true; Sfx.whistle(true);
      feed("🔔 경기 종료!");
      const res = gf > ga ? "W" : gf < ga ? "L" : "D";
      let r = 6.0;
      for (const m of st.moments) r += m.ok ? .45 : -.25;
      r += st.goals * .9 + st.assists * .6 + st.saves * .3;
      r += res === "W" ? .3 : res === "L" ? -.3 : 0;
      if (me.pos === "df" && ga === 0) r += .5;
      r += (me.form || 0) * .12 + ((me.cond ?? 70) < 35 ? -.4 : 0) + rand(-.3, .3);
      if (!me.starter) r = 6.2 + (r - 6.0) * .7;
      const rating = Math.round(clamp(r, 3.5, 10) * 10) / 10;
      const result = { gf, ga, res, rating, mom: rating >= 8, ...st };
      alive = false;
      resolve(result);
    })();
  });
}

/* ---------- 결과만 보기 (연출 없이 같은 규칙으로) ---------- */
function simMatch(cfg) {
  const me = cfg.me, homeStr = cfg.home.str, awayStr = cfg.away.str;
  const statOf = (t) => t === "shot" ? me.stats.sho : t === "pass" ? me.stats.pas : t === "dribble" ? me.stats.dri : me.stats.def;
  const autoP = (t, o) => clamp(.3 + (statOf(t) - o * .9) / 80 + (me.form || 0) * .04 + ((me.cond ?? 70) - 60) / 400, .1, .85);
  const lamFor = clamp(1.3 * Math.exp((homeStr - awayStr) / 20), .25, 3.6);
  const lamAg = clamp(1.15 * Math.exp((awayStr - homeStr) / 20), .2, 3.4);
  const k = me.absent ? 0 : me.starter ? randi(1, 2) + (Math.random() < .3 ? 1 : 0) : (Math.random() < .6 ? 1 : 0);
  let gf = Math.min(5, poisson(Math.max(.15, lamFor - k * .3))), ga = Math.min(5, poisson(lamAg));
  const st = { goals: 0, assists: 0, saves: 0, moments: [], events: [] };
  if (!me.absent && gf > 0) for (let i = 0; i < gf; i++) if (Math.random() < (me.pos === "mf" ? .3 : me.pos === "wg" ? .22 : .1) * (me.starter ? 1 : .4)) st.assists++;
  for (let i = 0; i < k; i++) {
    const t = pick(POS[me.pos].moments), ok = Math.random() < autoP(t, awayStr);
    st.moments.push({ type: t, ok });
    if (t === "shot" && ok) { st.goals++; gf++; }
    else if (t === "dribble" && ok) { const r = Math.random(); if (r < (me.pos === "wg" || me.pos === "fw" ? .45 : .3)) { st.goals++; gf++; } else if (r < .72) { st.assists++; gf++; } }
    else if (t === "pass" && ok && Math.random() < .68) { st.assists++; gf++; }
    else if (t === "tackle") { if (ok) st.saves++; else ga++; }
  }
  if (cfg.rival && cfg.rival.side === "away") {
    const canStop = !me.absent && me.starter && (me.pos === "df" || me.pos === "mf");
    if (canStop) {
      const ok = Math.random() < autoP("tackle", cfg.rival.ovr);
      st.moments.push({ type: "tackle", ok, rival: true });
      if (ok) st.saves++; else { ga++; st.rivalGoal = true; }
    } else if (Math.random() < clamp(.35 + (cfg.rival.ovr - homeStr) / 60, .15, .7)) { ga++; st.rivalGoal = true; }
  }
  const res = gf > ga ? "W" : gf < ga ? "L" : "D";
  let r = 6.0;
  for (const m of st.moments) r += m.ok ? .45 : -.25;
  r += st.goals * .9 + st.assists * .6 + st.saves * .3 + (res === "W" ? .3 : res === "L" ? -.3 : 0);
  if (me.pos === "df" && ga === 0) r += .5;
  r += (me.form || 0) * .12 + ((me.cond ?? 70) < 35 ? -.4 : 0) + rand(-.3, .3);
  if (!me.starter) r = 6.2 + (r - 6.0) * .7;
  const rating = me.absent ? 0 : Math.round(clamp(r, 3.5, 10) * 10) / 10;
  return { gf, ga, res, rating, mom: rating >= 8, ...st };
}
