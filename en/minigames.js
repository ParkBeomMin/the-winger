/* 더 윙어 2 - 승부처 미니게임 (포지션별)
 *  ⚽ 슈팅  : 골문 9칸 중 코스 고르고 → 파워 게이지 타이밍. 키퍼 위치를 보고 빈 쪽으로!
 *  🎯 침투 패스 : 달려드는 동료 셋. 오프사이드 라인을 넘기 전, 마크 없는 동료를 탭
 *  🏃 1:1 돌파 : 수비수 무게중심이 쏠린 순간 반대쪽으로 치고 나가기
 *  🛡️ 태클  : 상대가 공을 길게 친 순간 태클. 너무 빠르면 파울!
 *  🥅 페널티킥 : 코스 + 파워. 키퍼는 끝까지 기다렸다 몸을 날려요
 * 모두 Promise로 { ok, out?, foul? } 를 돌려줘요. 능력치가 높을수록 판정 구간이 넓어요. */
"use strict";

const MG = (() => {
  function frame(host, title, hint, limit, onTimeout) {
    host.innerHTML = `<div class="mg"><div class="mg-h"><b>${title}</b><span>${hint}</span></div><div class="mg-body"></div><div class="mg-timer"><i></i></div></div>`;
    const body = host.querySelector(".mg-body"), bar = host.querySelector(".mg-timer i");
    let left = limit, done = false;
    const t = setInterval(() => {
      left -= .05; bar.style.width = clamp(left / limit, 0, 1) * 100 + "%";
      if (left <= 0 && !done) { done = true; clearInterval(t); onTimeout(); }
    }, 50);
    return { body, stop() { done = true; clearInterval(t); }, get done() { return done; } };
  }
  const finish = (fr, resolve, res, delay = 650) => { fr.stop(); (res.ok ? Sfx.good : Sfx.bad)(); setTimeout(() => resolve(res), delay); };

  /* ---------- ⚽ 슈팅 / 🥅 페널티킥 ---------- */
  function shot(host, o) {
    // o: { sho, gk, smart(0~1 키퍼가 코스를 읽을 확률), pk }
    return new Promise((resolve) => {
      const pk = !!o.pk;
      const fr = frame(host, pk ? "🥅 Penalty!" : "⚽ Shooting chance!", pk ? "① Pick a spot ② Stop the power gauge in the green" : "Watch the keeper: ① tap an open spot → ② stop the power in the green", pk ? 7 : 6,
        () => finish(fr, resolve, { ok: false, out: "miss", why: "You hesitated and missed the chance" }));
      // 키퍼가 한쪽으로 살짝 치우쳐 서 있어요 (페널티킥은 가운데)
      const lean = pk ? 1 : pick([0, 1, 1, 2]);
      fr.body.innerHTML = `
        <div class="mg-goal3">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((z) => `<button data-z="${z}"></button>`).join("")}
          <div class="mg-gk" style="left:${16.6 + lean * 33.3}%">🧤</div>
          <div class="mg-ball">⚽</div>
        </div>
        <div class="mg-power" hidden><i class="sweet"></i><i class="mk"></i><span>Power</span></div>
        <button class="btn btn-primary mg-tap" hidden>Shoot!</button>`;
      const goal = fr.body.querySelector(".mg-goal3"), gkEl = fr.body.querySelector(".mg-gk"), ball = fr.body.querySelector(".mg-ball");
      const pw = fr.body.querySelector(".mg-power"), mk = pw.querySelector(".mk"), sweet = pw.querySelector(".sweet"), tap = fr.body.querySelector(".mg-tap");
      const sw = clamp(14 + (o.sho - 50) / 3, 12, 32), sc = rand(55, 80);   // 초록 구간: 슈팅이 좋을수록 넓어요
      sweet.style.left = (sc - sw / 2) + "%"; sweet.style.width = sw + "%";
      let zone = null, raf = 0;
      goal.querySelectorAll("[data-z]").forEach((b) => b.onclick = () => {
        if (zone !== null || fr.done) return;
        Sfx.tap(); zone = +b.dataset.z; b.classList.add("pick");
        pw.hidden = false; tap.hidden = false;
        let t = 0; const speed = 1.25 - clamp((o.sho - 50) / 120, 0, .45);
        const loop = () => { t += .016 * speed; const q = (Math.sin(t * Math.PI * 1.6 - Math.PI / 2) * .5 + .5) * 100; mk.style.left = q + "%"; mk.dataset.q = q; raf = requestAnimationFrame(loop); };
        loop();
      });
      tap.onclick = () => {
        if (zone === null || fr.done) return;
        cancelAnimationFrame(raf); Sfx.kick();
        const q = +mk.dataset.q, col = zone % 3, row = Math.floor(zone / 3);
        const power = Math.abs(q - sc) <= sw / 2 + 1 ? "good" : q > sc ? "over" : "weak";
        // 키퍼 판단: 서 있던 쪽 + 코스 읽기
        const read = Math.random() < o.smart;
        const kCol = read ? col : Math.random() < .55 ? lean : pick([0, 1, 2].filter((c) => c !== col));
        const kRow = pk ? (Math.random() < .5 ? 1 : 2) : 1;
        gkEl.style.left = (16.6 + kCol * 33.3) + "%";
        gkEl.style.transform = `translate(-50%,0) rotate(${kCol < 1 ? -60 : kCol > 1 ? 60 : 0}deg)`;
        ball.style.left = (16.6 + col * 33.3) + "%"; ball.style.top = (16 + row * 30) + "%"; ball.classList.add("fly");
        let out = "goal", why = "";
        const corner = col !== 1 && row !== 1;
        if (power === "over" && (row === 0 || Math.random() < .35)) { out = "miss"; why = row === 0 ? "Too much power, it flew over the bar" : "Too much power, it went wide"; }
        else if (corner && Math.random() < clamp(.14 - (o.sho - 55) / 300, .03, .14)) { out = "miss"; why = "Went for the corner, hit the post and out"; }
        else {
          let save = 0;
          if (kCol === col) save = row === 0 ? .4 : row === 1 ? .78 : .7;
          else if (Math.abs(kCol - col) === 1 && row !== 0) save = .12;
          if (power === "weak") save += .3;
          save += (o.gk - o.sho) / 250;
          if (Math.random() < clamp(save, 0, .95)) { out = "save"; why = power === "weak" ? "Too weak, the keeper saved it" : "The keeper read your shot"; }
        }
        if (out === "goal") why = corner ? "A perfect shot into the corner!" : "Calmly sent the keeper the wrong way!";
        setTimeout(() => { host.querySelector(".mg-h span").textContent = why; }, 250);
        finish(fr, resolve, { ok: out === "goal", out, why }, 1100);
      };
    });
  }

  /* ---------- 🎯 침투 패스 ---------- */
  function pass(host, o) {
    // o: { pas, def }
    return new Promise((resolve) => {
      const fr = frame(host, "🎯 Through ball!", "Tap the unmarked teammate before they cross the offside line (dotted)", 5,
        () => finish(fr, resolve, { ok: false, why: "You missed the passing window" }));
      fr.body.innerHTML = `<div class="mg-pitch"><i class="line"></i>${[0, 1, 2].map((k) => `<button class="run" data-k="${k}">${k + 1}</button>`).join("")}<i class="dfn"></i><i class="dfn"></i><b class="me">Me</b></div>`;
      const pitch = fr.body.querySelector(".mg-pitch"), runs = [...pitch.querySelectorAll(".run")], dfs = [...pitch.querySelectorAll(".dfn")];
      const LINE = 34;
      const R = [0, 1, 2].map((k) => ({ x: 18 + k * 32, y: 88, v: rand(9, 15), delay: rand(0, .9) }));
      // 수비 둘이 셋 중 둘을 따라붙고, 중간에 마크를 바꿔요
      let marks = [0, 1, 2].sort(() => Math.random() - .5).slice(0, 2);
      const D = marks.map((k) => ({ x: R[k].x + rand(-10, 10), y: LINE - 4, k }));
      const lag = clamp(.05 - (o.pas - o.def) / 2000, .02, .07), tol = clamp((o.pas - 50) / 12, 0, 4);
      let t = 0, raf = 0, switched = false;
      const loop = () => {
        t += .016;
        if (!switched && t > rand(1.2, 1.8)) { switched = true; const free = [0, 1, 2].find((k) => !marks.includes(k)); D[0].k = free; marks = D.map((d) => d.k); }
        R.forEach((r, k) => { if (t > r.delay) r.y -= r.v * .016 * 3.2; runs[k].style.left = r.x + "%"; runs[k].style.top = r.y + "%"; runs[k].classList.toggle("off", r.y < LINE - tol); });
        D.forEach((d, i) => { d.x += (R[d.k].x - d.x) * lag * 3; d.y += (Math.max(R[d.k].y - 6, LINE - 8) - d.y) * lag * 2; dfs[i].style.left = d.x + "%"; dfs[i].style.top = d.y + "%"; });
        if (!fr.done) raf = requestAnimationFrame(loop);
      };
      loop();
      runs.forEach((b) => b.onclick = () => {
        if (fr.done) return;
        cancelAnimationFrame(raf); Sfx.kick();
        const k = +b.dataset.k, r = R[k];
        const near = Math.min(...D.map((d) => Math.hypot(d.x - r.x, (d.y - r.y) * 1.4)));
        let res;
        if (r.y < LINE - tol) res = { ok: false, why: "🚩 Offside! A beat too late" };
        else if (near < 11) res = { ok: Math.random() < .2, why: "Blocked by the marker" };
        else res = { ok: true, why: "Perfectly split the defense!" };
        if (res.ok && near < 11) res.why = "Threaded through a tiny gap!";
        host.querySelector(".mg-h span").textContent = res.why;
        finish(fr, resolve, res, 800);
      });
    });
  }

  /* ---------- 🏃 1:1 돌파 (페인트) ---------- */
  function dribble(host, o) {
    // o: { dri, def }
    return new Promise((resolve) => {
      const fr = frame(host, "🏃 1v1 take-on!", "When the defender leans one way (red arrow), tap the other side!", 5,
        () => finish(fr, resolve, { ok: false, why: "You hesitated and lost the ball" }));
      fr.body.innerHTML = `<div class="mg-duel"><div class="dfn-big">🧍<i class="arrow"></i></div><div class="att">🏃</div></div>
        <div class="mg-two"><button data-d="L">⬅️ Go left</button><button data-d="R">Go right ➡️</button></div>`;
      const df = fr.body.querySelector(".dfn-big"), ar = df.querySelector(".arrow");
      const win = clamp(.32 + (o.dri - o.def) / 250, .2, .55);   // 쏠림이 유지되는 시간(초)
      let state = "mid", raf = 0, t = 0, next = rand(.5, .9), until = 0;
      const loop = () => {
        t += .016;
        if (state === "mid" && t > next) { state = Math.random() < .5 ? "L" : "R"; until = t + win; df.className = "dfn-big lean-" + state; ar.textContent = state === "L" ? "⬅" : "➡"; }
        else if (state !== "mid" && t > until) { state = "mid"; next = t + rand(.35, .8); df.className = "dfn-big"; ar.textContent = ""; }
        if (!fr.done) raf = requestAnimationFrame(loop);
      };
      loop();
      fr.body.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => {
        if (fr.done) return;
        cancelAnimationFrame(raf); Sfx.tap();
        const d = b.dataset.d;
        let res;
        if (state === "mid") res = { ok: Math.random() < .25, why: "The defender held his ground" };
        else if (d !== state) res = { ok: true, why: "Totally wrong-footed him!" };
        else res = { ok: false, why: "You went the way the defender leaned" };
        if (res.ok && state === "mid") res.why = "Powered right through!";
        fr.body.querySelector(".att").classList.add(res.ok ? "go-" + d : "stop");
        host.querySelector(".mg-h span").textContent = res.why;
        finish(fr, resolve, res, 800);
      });
    });
  }

  /* ---------- 🛡️ 태클 타이밍 ---------- */
  function tackle(host, o) {
    // o: { def, dri, name }
    return new Promise((resolve) => {
      const fr = frame(host, `🛡️ ${o.name ? esc(o.name) + "'s " : ""}take-on!`, "Tackle when they knock it long (green)! Too early = foul", 5,
        () => finish(fr, resolve, { ok: false, why: "Backed off and got beaten" }));
      fr.body.innerHTML = `<div class="mg-touch"><span class="att">🏃</span><i class="zone"></i><span class="ball">⚽</span></div><button class="btn btn-primary mg-tap">Tackle!</button>`;
      const ballEl = fr.body.querySelector(".ball"), zone = fr.body.querySelector(".zone");
      const zw = clamp(16 + (o.def - o.dri) / 4, 9, 30);
      zone.style.left = (88 - zw) + "%"; zone.style.width = zw + "%";
      let t = 0, raf = 0, q = 20;
      const sp = 1.1 + o.dri / 140;
      const loop = () => { t += .016 * sp; q = 18 + (Math.abs(Math.sin(t * Math.PI * .9)) ** 1.6) * 70; ballEl.style.left = q + "%"; if (!fr.done) raf = requestAnimationFrame(loop); };
      loop();
      fr.body.querySelector(".mg-tap").onclick = () => {
        if (fr.done) return;
        cancelAnimationFrame(raf); Sfx.tap();
        let res;
        if (q >= 88 - zw - 1) res = { ok: true, why: "Cleanly won the ball!" };
        else if (q < 45) res = { ok: false, foul: Math.random() < .55, why: "You stuck your foot out too early" };
        else res = { ok: Math.random() < .3, why: "Just got a toe on it!" };
        if (!res.ok && res.foul) res.why = "🟨 Reckless tackle, foul!";
        host.querySelector(".mg-h span").textContent = res.why;
        finish(fr, resolve, res, 800);
      };
    });
  }

  return { shot, pass, dribble, tackle };
})();
