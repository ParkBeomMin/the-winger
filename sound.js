/* 더 윙어 2 - 배경음악 · 관중 소리 · 추가 효과음
 * 파일 없이 WebAudio로 직접 연주해요(용량 0, 저작권 걱정 없음).
 * menu: 밝은 4마디 반복 (C-G-Am-F, 104bpm) / match: 관중 함성 앰비언스
 * 브라우저 정책상 첫 터치·클릭 뒤에 시작해요. */
"use strict";

const Bgm = (() => {
  let ac = null, master = null, mode = null, timer = 0, nextT = 0, step = 0, crowd = null, unlocked = false;
  let on = localStorage.getItem("w2-bgm") !== "0";
  const VOL = { menu: .07, match: .09 };
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); } catch { return null; } }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  const allowed = () => on && unlocked && !Sfx.muted && !document.hidden;
  function fade(to, sec = .8) { if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(master.gain.value, ac.currentTime); master.gain.linearRampToValueAtTime(to, ac.currentTime + sec); }

  /* ---- 메뉴 음악: 베이스 + 화음 + 아르페지오 + 가벼운 리듬 ---- */
  const BPM = 104, SPB = 60 / BPM / 2;                       // 8분음표 길이
  const CH = [[48, 55, 64, 67], [43, 50, 59, 67], [45, 52, 60, 64], [41, 48, 57, 65]];   // C G Am F (MIDI)
  const MEL = [76, null, 74, 72, 74, null, 76, 79, 79, null, 77, 76, 74, null, 72, 74, 72, null, 71, 72, 76, null, 74, 72, 69, null, 72, 74, 72, null, null, null];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function note(m, t, d, type, vol, out = master) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .02);
  }
  let nbuf = null;
  function noiseBuf() { if (nbuf) return nbuf; const len = ac.sampleRate; nbuf = ac.createBuffer(1, len, ac.sampleRate); const c = nbuf.getChannelData(0); for (let i = 0; i < len; i++) c[i] = Math.random() * 2 - 1; return nbuf; }
  function hat(t, vol) { const s = ac.createBufferSource(); s.buffer = noiseBuf(); const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + .06); }
  function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(master); o.start(t); o.stop(t + .18); }
  function schedMenu() {
    while (nextT < ac.currentTime + .25) {
      const bar = Math.floor(step / 8) % 4, s8 = step % 8, ch = CH[bar], t = nextT;
      if (s8 === 0) { ch.slice(1).forEach((m) => note(m, t, SPB * 7.5, "sine", .05)); note(ch[0] - 12, t, SPB * 3, "triangle", .22); }
      if (s8 === 4) note(ch[0] - 12, t, SPB * 3, "triangle", .18);
      note(ch[1 + (s8 % 3)] + 12, t, SPB * .9, "square", .018);
      const mm = MEL[step % 32]; if (mm) note(mm, t, SPB * 1.6, "triangle", .07);
      if (s8 % 4 === 0) kick(t);
      hat(t, s8 % 2 ? .02 : .035);
      nextT += SPB; step++;
    }
  }
  /* ---- 경기장: 관중 웅성임(느리게 출렁이는 노이즈) ---- */
  function startCrowd() {
    if (crowd) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 650; f.Q.value = .6;
    const g = ac.createGain(); g.gain.value = .5;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .13; lg.gain.value = .22; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(master); s.start(); lfo.start();
    crowd = { s, lfo, g };
  }
  function stopCrowd() { if (!crowd) return; try { crowd.s.stop(); crowd.lfo.stop(); } catch {} crowd = null; }
  function loop() { if (!ac) return; if (mode === "menu") schedMenu(); }
  function apply() {
    if (!allowed() || !mode) { if (ac) fade(0, .4); clearInterval(timer); timer = 0; setTimeout(() => { if (!allowed()) stopCrowd(); }, 450); return; }
    if (!ctx()) return;
    if (mode === "match") { clearInterval(timer); timer = 0; startCrowd(); fade(VOL.match); }
    else { stopCrowd(); if (!timer) { nextT = ac.currentTime + .1; timer = setInterval(loop, 90); } fade(VOL.menu); }
  }
  /* 관중 함성 크게 (골·찬스) */
  function roar(big = true) {
    if (!allowed() || !ctx()) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
    const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = big ? 900 : 600; f.Q.value = .5;
    const g = ac.createGain(), t = ac.currentTime, d = big ? 3 : 1.4;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(big ? 1.6 : .7, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + .1);
  }
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => { if (!unlocked) { unlocked = true; apply(); } }, { passive: true }));
  document.addEventListener("visibilitychange", apply);
  return {
    get on() { return on; },
    set(m) { if (m === mode) return; mode = m; apply(); },
    toggle() { on = !on; localStorage.setItem("w2-bgm", on ? "1" : "0"); apply(); return on; },
    refresh: apply, roar,
  };
})();

/* 효과음 더하기: 동전, 레벨업, 카드, 종료 휘슬, 페이지 */
(() => {
  let ac = null;
  const c = () => { if (Sfx.muted) return null; if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ac.state === "suspended") ac.resume(); return ac; };
  const tone = (f, d, type = "triangle", vol = .1, at = 0) => { const a = c(); if (!a) return; const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02); };
  Sfx.coin = () => { tone(988, .08, "square", .05); tone(1319, .2, "square", .05, .07); };
  Sfx.levelup = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, "triangle", .1, i * .07));
  Sfx.card = () => { tone(2600, .18, "sine", .07); tone(196, .25, "sawtooth", .05, .05); };
  Sfx.fulltime = () => { [0, .35, .7].forEach((d, i) => tone(2900, i === 2 ? .8 : .25, "sine", .07, d)); };
  Sfx.page = () => tone(1200, .04, "sine", .04);
  Sfx.fanfare = () => [[523, 0], [523, .12], [523, .24], [659, .36], [784, .6], [659, .78], [784, .9], [1047, 1.1]].forEach(([f, d]) => tone(f, .26, "triangle", .12, d));
})();
