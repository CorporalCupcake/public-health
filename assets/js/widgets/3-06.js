// Lecture 3.6 — Survival analysis: a Kaplan–Meier builder (simulated two-arm trial, Cox HR, log-rank, RMST)
// and a proportional-hazards violation demo (crossing hazards). Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // Complementary error function (Abramowitz & Stegun 7.1.26); p-value for chi-square with 1 df.
  function erfc(x) {
    var t = 1 / (1 + 0.3275911 * x);
    var y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return y * Math.exp(-x * x);
  }
  function pChi1(chi) { return erfc(Math.sqrt(chi / 2)); }
  function fmtP(p) { return p < 0.001 ? "< 0.001" : p < 0.01 ? p.toFixed(3) : p.toFixed(2); }

  // Kaplan–Meier for one arm: steps [[t, S]], censoring times, and a function for numbers at risk.
  function km(data) {
    var d = data.slice().sort(function (a, b) { return a.t - b.t; });
    var n = d.length, S = 1, steps = [[0, 1]], cens = [];
    for (var i = 0; i < n; i++) {
      var atRisk = n - i;
      if (d[i].e) { S *= (atRisk - 1) / atRisk; steps.push([d[i].t, S]); }
      else cens.push([d[i].t, S]);
    }
    return {
      steps: steps, cens: cens, sorted: d,
      atRisk: function (t) { var k = 0; for (var j = 0; j < n; j++) if (d[j].t >= t) k++; return k; },
      survAt: function (t) { var s = 1; for (var j = 0; j < steps.length; j++) if (steps[j][0] <= t) s = steps[j][1]; return s; },
      rmst: function (tau) {
        var a = 0, prevT = 0, prevS = 1;
        for (var j = 1; j < steps.length && steps[j][0] < tau; j++) { a += prevS * (steps[j][0] - prevT); prevT = steps[j][0]; prevS = steps[j][1]; }
        return a + prevS * (tau - prevT);
      }
    };
  }

  // Cox model with one binary covariate (Newton–Raphson; continuous times so no ties) + log-rank test.
  function coxAndLogrank(all) {
    var d = all.slice().sort(function (a, b) { return a.t - b.t; });
    var n = d.length, b = 0, info = 1;
    for (var it = 0; it < 30; it++) {
      var U = 0, I = 0, s0 = 0, s1 = 0, eb = Math.exp(b);
      // walk backwards so the risk set sums accumulate
      var S0 = new Array(n), S1 = new Array(n);
      for (var i = n - 1; i >= 0; i--) { s0 += d[i].x ? eb : 1; s1 += d[i].x ? eb : 0; S0[i] = s0; S1[i] = s1; }
      for (var j = 0; j < n; j++) if (d[j].e) { var p = S1[j] / S0[j]; U += d[j].x - p; I += p * (1 - p); }
      if (I <= 0) break;
      var step = U / I; b += Math.max(-2, Math.min(2, step)); info = I;
      if (Math.abs(step) < 1e-7) break;
    }
    // log-rank (score test at b = 0)
    var n1 = 0, nn = n, O1 = 0, E1 = 0, Vr = 0;
    d.forEach(function (r) { if (r.x) n1++; });
    for (var k = 0; k < n; k++) {
      if (d[k].e) { var q = n1 / nn; O1 += d[k].x; E1 += q; Vr += q * (1 - q); }
      if (d[k].x) n1--; nn--;
    }
    var chi = Vr > 0 ? (O1 - E1) * (O1 - E1) / Vr : 0;
    return { b: b, se: 1 / Math.sqrt(info), p: pChi1(chi) };
  }

  // ---------------------------------------------------------------------------
  // Kaplan–Meier builder
  V.register("km-builder", function (root) {
    var NMAX = 500, TAU = 8, TMAX = 10, seed = 360021;
    var U = null;
    function draws() {
      var r = stream(seed); U = [];
      for (var i = 0; i < 2 * NMAX; i++) U.push([r(), r(), r()]);
    }
    draws();

    var ctr = V.controls(root);
    var sH = V.slider(ctr, { label: "Control-arm death rate (per 100 person-years)", min: 1, max: 30, step: 1, value: 8, onInput: draw });
    var sHR = V.slider(ctr, { label: "True hazard ratio (treated vs control)", min: 0.3, max: 2, step: 0.05, value: 0.65, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sC = V.slider(ctr, { label: "Drop-out rate (per 100 person-years)", min: 0, max: 30, step: 1, value: 5, onInput: draw });
    var sN = V.slider(ctr, { label: "Patients per arm", min: 20, max: 500, step: 10, value: 100, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New random sample", function () { seed += 2; draws(); draw(); });
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Small trial", 8, 0.65, 5, 40], ["Big trial", 8, 0.65, 5, 500], ["No true effect", 8, 1, 5, 100], ["Heavy drop-out", 8, 0.65, 25, 100]].forEach(function (p) {
      V.button(pre, p[0], function () { sH.set(p[1]); sHR.set(p[2]); sC.set(p[3]); sN.set(p[4]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Control" }, { cls: "s1", label: "Treated" },
      { cls: "s5", label: "Fewer than 10 still at risk (the tail)", dashed: true }
    ]);
    var c = V.svg(root, 640, 420);
    c.setAttribute("aria-label", "Kaplan–Meier survival curves for two simulated arms, with censoring ticks, the area between curves up to 8 years shaded, and a numbers-at-risk table underneath");

    var out = V.readouts(root, [
      { key: "hr", label: "Cox hazard ratio (95% CI), fitted in your browser", cls: "good" },
      { key: "p", label: "Log-rank p-value" },
      { key: "rmst", label: "RMST difference to 8 years (treated − control)", cls: "good" },
      { key: "ev", label: "Deaths: control / treated" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Constant hazards; recruitment is staggered, so each patient can be followed for 4 to 10 years (administrative censoring), plus random drop-out. RMST = restricted mean survival time, the area under each curve up to 8 years." }, root);

    function path(steps, x, y, tEnd) {
      var pts = [], prev = null;
      steps.forEach(function (s) {
        if (prev) pts.push([x(s[0]), y(prev[1])]);
        pts.push([x(s[0]), y(s[1])]);
        prev = s;
      });
      if (prev) pts.push([x(tEnd), y(prev[1])]);
      return pts;
    }

    function draw() {
      var lam0 = sH.value() / 100, hr = sHR.value(), lc = sC.value() / 100, n = sN.value();
      var arms = [[], []], all = [];
      for (var a = 0; a < 2; a++) for (var i = 0; i < n; i++) {
        var u = U[a * NMAX + i], lam = lam0 * (a ? hr : 1);
        var T = -Math.log(u[0]) / lam, C = lc > 0 ? -Math.log(u[1]) / lc : Infinity, A = 4 + 6 * u[2];
        var t = Math.min(T, C, A), rec = { t: t, e: T <= Math.min(C, A) ? 1 : 0, x: a };
        arms[a].push(rec); all.push(rec);
      }
      var K = [km(arms[0]), km(arms[1])], fit = coxAndLogrank(all);

      clear(c);
      var f = V.frame(c, { x: [0, TMAX], y: [0, 1], fmtY: V.fmt.pct, margin: { top: 14, bottom: 140, left: 84 }, xLabel: "", yLabel: "Surviving" });
      el("text", { x: (f.m.left + 624) / 2, y: c.H - 140 + 34, class: "viz-label", "text-anchor": "middle", text: "Years since randomisation" }, c);
      var g = f.inner;

      // shaded area between curves up to TAU (RMST difference)
      var grid = [];
      for (var k = 0; k <= 200; k++) grid.push(TAU * k / 200);
      var top = grid.map(function (t) { return [f.x(t), f.y(Math.max(K[0].survAt(t), K[1].survAt(t)))]; });
      var bot = grid.map(function (t) { return [f.x(t), f.y(Math.min(K[0].survAt(t), K[1].survAt(t)))]; });
      el("path", { d: V.area(top, bot), class: "fill-soft s2" }, g);
      el("line", { x1: f.x(TAU), x2: f.x(TAU), y1: f.y(0), y2: f.y(1), class: "viz-grid", "stroke-dasharray": "4 4" }, g);
      el("text", { x: f.x(TAU) + 5, y: f.y(0.97), class: "viz-small viz-muted", text: "RMST horizon" }, g);

      [[0, "s5"], [1, "s1"]].forEach(function (A) {
        var Kk = K[A[0]], steps = Kk.steps;
        // find where fewer than 10 remain at risk; split the curve there
        var srt = Kk.sorted, nArm = srt.length, tCut = Infinity;
        if (nArm >= 10) tCut = srt[nArm - 10].t; else tCut = 0;
        var tEnd = srt[nArm - 1].t;
        var solid = steps.filter(function (s) { return s[0] <= tCut; });
        var dashedSteps = [[tCut, Kk.survAt(tCut)]].concat(steps.filter(function (s) { return s[0] > tCut; }));
        el("path", { d: V.line(path(solid, f.x, f.y, Math.min(tCut, tEnd))), class: "stroke " + A[1] }, g);
        if (tCut < tEnd) el("path", { d: V.line(path(dashedSteps, f.x, f.y, tEnd)), class: "stroke dashed " + A[1], "stroke-width": 1.6, opacity: 0.8 }, g);
        Kk.cens.forEach(function (cz) {
          el("line", { x1: f.x(cz[0]), x2: f.x(cz[0]), y1: f.y(cz[1]) - 4, y2: f.y(cz[1]) + 4, class: "stroke " + A[1], "stroke-width": 1.2 }, g);
        });
      });

      // numbers-at-risk table
      var y0 = c.H - 140 + 62;
      el("text", { x: 8, y: y0 - 4, class: "viz-small viz-bold", text: "Number at risk" }, c);
      [[0, "Control", "s5"], [1, "Treated", "s1"]].forEach(function (A, r) {
        var yy = y0 + 20 + r * 22;
        el("text", { x: 8, y: yy, class: "viz-small viz-bold colour " + A[2], text: A[1] }, c);
        [0, 2, 4, 6, 8, 10].forEach(function (t) {
          el("text", { x: f.x(t), y: yy, "text-anchor": "middle", class: "viz-small", text: String(K[A[0]].atRisk(t)) }, c);
        });
      });
      el("text", { x: 8, y: y0 + 66, class: "viz-small viz-muted", text: "Ticks on the curves are censored patients. Read the curve only where the table still has decent numbers." }, c);

      var b = fit.b, se = fit.se;
      out.hr(Math.exp(b).toFixed(2) + " (" + Math.exp(b - 1.96 * se).toFixed(2) + "–" + Math.exp(b + 1.96 * se).toFixed(2) + ")");
      out.p(fmtP(fit.p));
      var dR = K[1].rmst(TAU) - K[0].rmst(TAU);
      out.rmst(V.fmt.signed(dR * 12, 1) + " months");
      var e0 = 0, e1 = 0;
      arms[0].forEach(function (r) { e0 += r.e; }); arms[1].forEach(function (r) { e1 += r.e; });
      out.ev(e0 + " / " + e1);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // PH violation: treated hazard = control × early HR before the switch, × late HR after it.
  // Large-sample (expected) curves; the "Cox HR" solves the expected partial-likelihood score.
  V.register("ph-violation", function (root) {
    var H0 = 0.1, TMAX = 10, DT = 0.005;

    var ctr = V.controls(root);
    var sE = V.slider(ctr, { label: "Hazard ratio early (before the switch)", min: 0.3, max: 4, step: 0.05, value: 3, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sL = V.slider(ctr, { label: "Hazard ratio late (after the switch)", min: 0.2, max: 2, step: 0.05, value: 0.45, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sS = V.slider(ctr, { label: "Switch time (years)", min: 0.25, max: 5, step: 0.25, value: 1.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sT = V.slider(ctr, { label: "Horizon τ for landmark and RMST (years)", min: 1, max: 10, step: 0.5, value: 10, fmt: function (v) { return v.toFixed(1); }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Scenarios:" }, pre);
    [["Surgery: early harm, late benefit", 3, 0.45, 1.5], ["Proportional (HR 0.7 throughout)", 0.7, 0.7, 1.5], ["Delayed benefit", 1, 0.55, 1.5], ["Benefit that wears off", 0.5, 1, 2]].forEach(function (p) {
      V.button(pre, p[0], function () { sE.set(p[1]); sL.set(p[2]); sS.set(p[3]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Control" }, { cls: "s1", label: "Treated" },
      { cls: "s3", label: "True hazard ratio over time" }, { cls: "s4", label: "What one Cox HR reports", dashed: true }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Survival curves for control and treated groups that cross, with the area between them up to the horizon shaded");
    var c2 = V.svg(root, 640, 190);
    c2.setAttribute("aria-label", "The true hazard ratio over time as a step, against the single averaged Cox hazard ratio");

    var out = V.readouts(root, [
      { key: "hr", label: "Cox HR (one number for the whole follow-up)", cls: "bad" },
      { key: "s1", label: "Survival at 1 year: control vs treated" },
      { key: "st", label: "Survival at τ: control vs treated" },
      { key: "rmst", label: "RMST difference to τ (treated − control)", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Control death rate 10 per 100 person-years, constant; follow-up ends at 10 years; no sampling error (expected curves). The Cox HR is the value a very large trial would report." }, root);

    function draw() {
      var e = sE.value(), l = sL.value(), sw = sS.value(), tau = sT.value();
      var G = [], S0 = 1, S1 = 1;
      for (var t = 0; t <= TMAX + 1e-9; t += DT) {
        var h1 = H0 * (t < sw ? e : l);
        G.push({ t: t, S0: S0, S1: S1, h1: h1 });
        S0 *= Math.exp(-H0 * DT); S1 *= Math.exp(-h1 * DT);
      }
      // expected Cox score U(b) = Σ [dN1 − p1(b)(dN0 + dN1)]
      function score(b) {
        var u = 0, eb = Math.exp(b);
        G.forEach(function (g) { var d0 = g.S0 * H0 * DT, d1 = g.S1 * g.h1 * DT; u += d1 - g.S1 * eb / (g.S0 + g.S1 * eb) * (d0 + d1); });
        return u;
      }
      var lo = -4, hi = 4;
      for (var i = 0; i < 50; i++) { var m = (lo + hi) / 2; if (score(m) > 0) lo = m; else hi = m; }
      var coxHR = Math.exp((lo + hi) / 2);
      function at(tt) { return G[Math.min(G.length - 1, Math.round(tt / DT))]; }
      var r0 = 0, r1 = 0;
      G.forEach(function (g) { if (g.t < tau) { r0 += g.S0 * DT; r1 += g.S1 * DT; } });

      // survival panel
      clear(c);
      var f = V.frame(c, { x: [0, TMAX], y: [0, 1], fmtY: V.fmt.pct, xLabel: "Years", yLabel: "Surviving" });
      var top = [], bot = [];
      G.forEach(function (g) { if (g.t <= tau) { top.push([f.x(g.t), f.y(Math.max(g.S0, g.S1))]); bot.push([f.x(g.t), f.y(Math.min(g.S0, g.S1))]); } });
      el("path", { d: V.area(top, bot), class: "fill-soft s2" }, f.inner);
      el("line", { x1: f.x(tau), x2: f.x(tau), y1: f.y(0), y2: f.y(1), class: "viz-grid", "stroke-dasharray": "4 4" }, f.inner);
      el("text", { x: f.x(tau) + (tau > 8.5 ? -5 : 5), y: f.y(0.96), "text-anchor": tau > 8.5 ? "end" : "start", class: "viz-small viz-muted", text: "τ = " + tau.toFixed(1) }, f.inner);
      el("line", { x1: f.x(sw), x2: f.x(sw), y1: f.y(0), y2: f.y(1), class: "viz-grid" }, f.inner);
      el("text", { x: f.x(sw) + 5, y: f.y(0.06), class: "viz-small viz-muted", text: "switch" }, f.inner);
      el("path", { d: V.line(G.map(function (g) { return [f.x(g.t), f.y(g.S0)]; })), class: "stroke s5" }, f.inner);
      el("path", { d: V.line(G.map(function (g) { return [f.x(g.t), f.y(g.S1)]; })), class: "stroke s1" }, f.inner);

      // hazard-ratio panel (log scale)
      clear(c2);
      var yT = [0.25, 0.5, 1, 2, 4];
      var ly = function (v) { return Math.log(Math.max(0.2, Math.min(5, v))); };
      var f2 = V.frame(c2, { x: [0, TMAX], y: [Math.log(0.2), Math.log(5)], yTicks: yT.map(Math.log), fmtY: function (v) { var r = Math.exp(v); return r < 1 ? r.toFixed(2) : r.toFixed(0); }, xLabel: "Years", yLabel: "Hazard ratio", margin: { top: 10, bottom: 38 } });
      el("line", { x1: f2.x(0), x2: f2.x(TMAX), y1: f2.y(0), y2: f2.y(0), class: "viz-axis", "stroke-dasharray": "2 3" }, f2.inner);
      el("path", { d: V.line([[f2.x(0), f2.y(ly(e))], [f2.x(sw), f2.y(ly(e))], [f2.x(sw), f2.y(ly(l))], [f2.x(TMAX), f2.y(ly(l))]]), class: "stroke s3" }, f2.inner);
      el("path", { d: V.line([[f2.x(0), f2.y(ly(coxHR))], [f2.x(TMAX), f2.y(ly(coxHR))]]), class: "stroke dashed s4" }, f2.inner);
      var lyC = f2.y(ly(coxHR));
      el("text", { x: f2.x(TMAX) - 4, y: lyC + (coxHR >= Math.max(e, l) * 0.9 ? 15 : -6), "text-anchor": "end", class: "viz-small viz-bold colour s4", style: "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round", text: "Cox HR " + coxHR.toFixed(2) }, f2.inner);

      out.hr(coxHR.toFixed(2));
      out.s1(V.fmt.pct(at(1).S0) + " vs " + V.fmt.pct(at(1).S1));
      out.st(V.fmt.pct(at(tau).S0) + " vs " + V.fmt.pct(at(tau).S1));
      out.rmst(V.fmt.signed((r1 - r0) * 12, 1) + " months");
    }
    draw();
  });
})();
