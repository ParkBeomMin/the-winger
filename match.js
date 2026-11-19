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
    const mySlot = SLOT_BY_POS[me.pos] ?? 9;
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
    let onPitch = !!me.starter;                         // 벤치면 교체 시간에 들어와요
    const subMin = me.starter ? 0 : (me.subMin ?? 999);

    let possession = "home", owner = 6, ball = { x: .5, y: .5 }, ballFrom = { x: .5, y: .5 }, ballT = 1;
    let minute = 0, paused = true, zoom = 1, zoomTarget = 1, focus = null;
    let seq = null, trail = [], replayMode = false, banner = null;
    let gf = 0, ga = 0;
    const st = { goals: 0, assists: 0, saves: 0, moments: [], events: [], ge: [] };

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
      const grassy = nearGrass(kit[0]);
      ctx.fillStyle = p.i === 0 ? "#222" : grassy ? kit[1] : kit[0];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = grassy ? kit[0] : kit[1]; ctx.lineWidth = 1.5; ctx.stroke();
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
        if (!onPitch && minute >= subMin) { onPitch = true; feed(`🔁 ${me.name} 교체 투입!`, "me"); }
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
    const ROLE_SLOTS = { gk: [0], df: [1, 2, 3, 4], mf: [5, 6, 7], wg: [8, 10], fw: [9] };
    const slotOf = (p, side) => {
      if (p.id === "me" && side === "home") return mySlot;
      if (p.id === "rv" && rivalSlot >= 0) return rivalSlot;
      const l = ROLE_SLOTS[p.r] || [9]; return l[(p.n || "").length % l.length];
    };
    const nm = (p) => !p ? "" : p.id === "me" ? `<b>${esc(me.name)}</b>` : p.id === "rv" ? `<b class="rvn">${esc(p.n)}⚔️</b>` : esc(p.n);
    const myP = () => teams.home[mySlot];
    function zoomOn(p) { focus = p; zoomTarget = skipping ? 1 : 1.7; }
    function unzoom() { zoomTarget = 1; }
    async function replay(path) {
      if (skipping) return;
      replayMode = true; banner = `${me.name}의 골`;
      ball.x = path[0].x - .15; ball.y = path[0].y;
      zoomOn({ x: path[path.length - 1].x - .1, y: path[path.length - 1].y });
      await runSeq("home", myP(), path, .35, 1.1);
      await sleepMs(500);
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
        const path = attackPath(side, true, fromMe);
        await runSeq(side, runner, path, 1, fromMe ? 1.1 : 1.5);
        mine ? gf++ : ga++; updScore(); mine ? Sfx.goal() : Sfx.miss();
        feed(`⚽ ${nm(ev.sh)}의 ${ev.pen ? "페널티킥 " : ""}골!${ev.as ? ` (도움 ${nm(ev.as)})` : ""}`, (fromMe || (ev.as && ev.as.id === "me")) ? "me goal" : ev.rv ? "rival" : mine ? "goal" : "bad");
        await flashText(mine ? "GOAL!!" : "실점…", mine ? "goal" : "bad", mine ? 1100 : 800);
        if (fromMe) await replay(path);
      } else {
        await runSeq(side, runner, attackPath(side, false, false), 1, 1.1);
        const txt = ev.pen ? (ev.out === "save" ? `🧤 ${nm(ev.gk)}, 페널티킥 선방!` : `💨 ${nm(ev.sh)} 페널티킥 실축`) : ev.out === "save" ? `🧤 ${nm(ev.gk)} 선방! (${nm(ev.sh)}의 슈팅)` : ev.out === "block" ? `🛡️ ${nm(ev.df)}의 수비 (${nm(ev.sh)} 차단)` : `💨 ${nm(ev.sh)}의 슈팅이 빗나가요`;
        feed(txt, ev.mom ? "me" : ev.rv ? "rival" : "");
      }
    }

    async function showInc(i) {
      const mine = vis(i.side) === "home", isMe = i.p.id === "me";
      const t = i.kind === "yc" ? `🟨 ${nm(i.p)} 경고` : i.kind === "yc2" ? `🟨🟥 ${nm(i.p)} 경고 누적 퇴장!` : i.kind === "rc" ? `🟥 ${nm(i.p)} 레드카드, 퇴장!`
        : `🚑 ${nm(i.p)} 부상${i.sub ? ` → ${nm(i.sub)} 교체 투입` : " (교체 카드가 없어 10명으로)"}`;
      feed(t + (mine ? "" : ` <small>(${esc(cfg.away.name)})</small>`), isMe ? "me" : i.kind === "yc" ? "" : "bad");
      if (i.kind !== "yc") { if (!mine) Sfx.good(); else Sfx.bad(); }
      if (isMe && i.kind !== "yc") { onPitch = false; await flashText(i.kind === "inj" ? "부상…" : "퇴장…", "bad", 900); }
      else if (i.kind === "rc" || i.kind === "yc2") await flashText("🟥", mine ? "bad" : "goal", 600);
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
        ...myT.subs.filter((s) => !s.inj && s.in.id !== "me").map((s) => ({ min: s.min, sub: s }))].sort((a, b) => a.min - b.min);
      for (const it of items) {
        await waitMin(it.min);
        paused = true;
        if (it.ev) await showEv(it.ev);
        else if (it.sub) feed(`🔁 교체: ${nm(it.sub.in)} IN · ${nm(it.sub.out)} OUT`);
        else await showInc(it.inc);
        if (!skipping) await sleepMs(it.ev ? 180 : 80);
        paused = false;
      }
      await waitMin(90);
      paused = true; Sfx.whistle(true);
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
