// Lecture 6.2 — SEIR simulator with an intervention window, and a fitting/identifiability demo. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function makeRand(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  function poisson(rand, lam) {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * V.normal(rand)));
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  // SEIR + cumulative onsets C, as fractions of N. betaFn(t) gives transmission rate.
  // Returns daily arrays (length days+1) of S, E, I and daily new onsets (sigma*E integrated).
  function seir(o) {
    var dt = 0.25, steps = Math.round(1 / dt), y = [o.S0, o.E0, o.I0, 0];
    var S = [y[0]], E = [y[1]], I = [y[2]], inc = [0];
    function f(t, v) {
      var b = o.betaFn(t), foi = b * v[0] * v[2];
      return [-foi, foi - o.sigma * v[1], o.sigma * v[1] - o.gamma * v[2], o.sigma * v[1]];
    }
    for (var d = 0; d < o.days; d++) {
      var c0 = y[3];
      for (var s = 0; s < steps; s++) {
        var t = d + s * dt, k1 = f(t, y);
        var y2 = y.map(function (v, i) { return v + dt / 2 * k1[i]; }), k2 = f(t + dt / 2, y2);
        var y3 = y.map(function (v, i) { return v + dt / 2 * k2[i]; }), k3 = f(t + dt / 2, y3);
        var y4 = y.map(function (v, i) { return v + dt * k3[i]; }), k4 = f(t + dt, y4);
        y = y.map(function (v, i) { return v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); });
      }
      S.push(y[0]); E.push(y[1]); I.push(y[2]); inc.push(y[3] - c0);
    }
    return { S: S, E: E, I: I, inc: inc };
  }
  function argmax(a) { var m = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; }

  // ---------------------------------------------------------------------------
  V.register("seir-sim", function (root) {
    var DAYS = 365;
    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "R₀", min: 1.1, max: 6, step: 0.1, value: 2.5, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sL = V.slider(ctr, { label: "Latent period (days)", min: 1, max: 10, step: 0.5, value: 4, fmt: String, onInput: draw });
    var sD = V.slider(ctr, { label: "Infectious period (days)", min: 2, max: 14, step: 0.5, value: 5, fmt: String, onInput: draw });
    var sT = V.slider(ctr, { label: "Intervention starts on day", min: 0, max: 200, step: 5, value: 50, fmt: String, onInput: draw });
    var sX = V.slider(ctr, { label: "Intervention cuts transmission by", min: 0, max: 0.8, step: 0.05, value: 0.4, fmt: V.fmt.pct, onInput: draw });
    var sW = V.slider(ctr, { label: "Intervention lasts (days)", min: 10, max: 300, step: 10, value: 60, fmt: String, onInput: draw });

    V.legend(root, [{ cls: "s1", label: "With intervention" }, { cls: "s5", dashed: true, label: "No intervention" }, { cls: "s4", label: "Intervention window" }]);
    var c1 = V.svg(root, 640, 230);
    c1.setAttribute("aria-label", "Share of the population infectious each day, with and without the intervention");
    var c2 = V.svg(root, 640, 170);
    c2.setAttribute("aria-label", "Share of the population still susceptible, with the threshold one over R0");
    var out = V.readouts(root, [
      { key: "pk", label: "Peak day (with intervention)" },
      { key: "ph", label: "Peak share infectious at once" },
      { key: "fs", label: "Final share ever infected", cls: "bad" },
      { key: "fs0", label: "Final share with no intervention" },
      { key: "rt", label: "Rₜ just before the intervention" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Deterministic SEIR model, one closed population, homogeneous mixing, starting from 1 infectious person per 100,000. The intervention multiplies transmission by (1 − cut) for its duration, then lifts." }, root);

    function draw() {
      var R0 = sR.value(), L = sL.value(), D = sD.value(), t0 = sT.value(), cut = sX.value(), w = sW.value();
      var g = 1 / D, b = R0 * g, sg = 1 / L, base = { S0: 1 - 1e-5, E0: 0, I0: 1e-5, sigma: sg, gamma: g, days: DAYS };
      var with_ = seir(Object.assign({}, base, { betaFn: function (t) { return (t >= t0 && t < t0 + w) ? b * (1 - cut) : b; } }));
      var none = seir(Object.assign({}, base, { betaFn: function () { return b; } }));
      var ymax = Math.max(Math.max.apply(null, none.I), Math.max.apply(null, with_.I));
      ymax = Math.max(0.01, Math.ceil(ymax * 100 / 2) * 2 / 100);

      clear(c1);
      var f = V.frame(c1, { x: [0, DAYS], y: [0, ymax], fmtY: V.fmt.pct, yTicks: V.ticks(0, ymax, 4), xTicks: [0, 50, 100, 150, 200, 250, 300, 350], xLabel: "Day", yLabel: "Infectious now", margin: { left: 56 } });
      var x1 = Math.min(DAYS, t0 + w);
      el("rect", { x: f.x(t0), width: Math.max(0, f.x(x1) - f.x(t0)), y: f.y(ymax), height: f.y(0) - f.y(ymax), class: "fill-soft s4" }, f.inner);
      el("path", { d: V.line(none.I.map(function (v, t) { return [f.x(t), f.y(v)]; })), class: "stroke s5 dashed", "stroke-width": 2 }, f.inner);
      el("path", { d: V.line(with_.I.map(function (v, t) { return [f.x(t), f.y(v)]; })), class: "stroke s1", "stroke-width": 2.6 }, f.inner);

      clear(c2);
      var f2 = V.frame(c2, { x: [0, DAYS], y: [0, 1], fmtY: V.fmt.pct, yTicks: [0, 0.5, 1], xTicks: [0, 50, 100, 150, 200, 250, 300, 350], xLabel: "Day", yLabel: "Susceptible", margin: { left: 56, top: 12 } });
      el("rect", { x: f2.x(t0), width: Math.max(0, f2.x(x1) - f2.x(t0)), y: f2.y(1), height: f2.y(0) - f2.y(1), class: "fill-soft s4" }, f2.inner);
      el("line", { x1: f2.x(0), x2: f2.x(DAYS), y1: f2.y(1 / R0), y2: f2.y(1 / R0), class: "stroke s3 dashed", "stroke-width": 1.6 }, f2.inner);
      el("text", { x: f2.x(DAYS) - 4, y: f2.y(1 / R0) - 6, "text-anchor": "end", class: "viz-small viz-bold colour s3", text: "threshold 1/R₀ = " + V.fmt.pct(1 / R0) }, f2.inner);
      el("path", { d: V.line(none.S.map(function (v, t) { return [f2.x(t), f2.y(v)]; })), class: "stroke s5 dashed", "stroke-width": 2 }, f2.inner);
      el("path", { d: V.line(with_.S.map(function (v, t) { return [f2.x(t), f2.y(v)]; })), class: "stroke s1", "stroke-width": 2.6 }, f2.inner);

      var pk = argmax(with_.I);
      out.pk(pk >= DAYS ? "after day 365" : "day " + pk);
      out.ph(V.fmt.pct1(with_.I[pk]));
      out.fs(V.fmt.pct(1 - with_.S[DAYS]));
      out.fs0(V.fmt.pct(1 - none.S[DAYS]));
      out.rt(V.fmt.num(R0 * with_.S[Math.min(t0, DAYS)], 2));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Fitting demo: the early curve pins down the growth rate, not R0 or the reporting fraction.
  V.register("seir-fit", function (root) {
    var N = 1e6, L = 3, DATA = 35, DAYS = 220;
    var TRUE = { D: 5, rho: 0.3, R0: 2 }, C0 = 12; // reported cases per day on day 0
    function growth(R0, D) { // SEIR early growth rate r from R0 = (1 + rL)(1 + rD)
      var a = L * D, bb = L + D, c = 1 - R0;
      return (-bb + Math.sqrt(bb * bb - 4 * a * c)) / (2 * a);
    }
    var r = growth(TRUE.R0, TRUE.D);
    function model(D, rho) {
      var R0 = (1 + r * L) * (1 + r * D), g = 1 / D, sg = 1 / L, b = R0 * g;
      var E0 = C0 / (rho * sg) / N, I0 = sg * E0 / (r + g);
      var res = seir({ S0: 1 - E0 - I0, E0: E0, I0: I0, sigma: sg, gamma: g, days: DAYS, betaFn: function () { return b; } });
      // Daily onsets over day t-1..t; report day t. Shift so index 0 holds day 0's cases.
      var rep = [];
      for (var t = 1; t <= DAYS; t++) rep.push(res.inc[t] * N * rho);
      return { R0: R0, rep: rep, S: res.S };
    }
    var truth = model(TRUE.D, TRUE.rho);
    var rand = makeRand(620003), data = [];
    for (var t = 0; t < DATA; t++) data.push(poisson(rand, truth.rep[t]));

    var reveal = false, logy = true;
    var ctr = V.controls(root);
    var sD = V.slider(ctr, { label: "Assumed infectious period (days)", min: 2, max: 12, step: 0.5, value: 9, fmt: String, onInput: draw });
    var sP = V.slider(ctr, { label: "Assumed share of infections reported", min: 0.05, max: 1, step: 0.05, value: 0.1, fmt: V.fmt.pct, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.8rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(row, { options: [{ value: true, label: "Log scale" }, { value: false, label: "Linear scale" }], value: logy, onChange: function (v) { logy = v; draw(); } });
    var btn = V.button(row, "Reveal what actually happened", function () { reveal = !reveal; btn.textContent = reveal ? "Hide the truth" : "Reveal what actually happened"; draw(); });

    V.legend(root, [{ cls: "s5", label: "Reported cases, days 0–34 (the data)" }, { cls: "s1", label: "Your fitted model’s forecast" }, { cls: "s3", dashed: true, label: "What actually happened (when revealed)" }]);
    var c = V.svg(root, 640, 260);
    c.setAttribute("aria-label", "Reported daily cases: 35 days of data, the fitted model forecast, and optionally the true epidemic");
    var out = V.readouts(root, [
      { key: "err", label: "Fit to the 35 days of data (mean error)", cls: "good" },
      { key: "r0", label: "Implied R₀" },
      { key: "pk", label: "Forecast peak day" },
      { key: "ar", label: "Forecast share ever infected", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. For each pair of assumptions, transmission is set so the model grows at the rate seen in the data, and the starting number of infections so it matches the reported level; the latent period is fixed at 3 days." }, root);

    function draw() {
      var D = sD.value(), rho = sP.value(), m = model(D, rho);
      var err = 0, mean = 0;
      for (var t = 0; t < DATA; t++) { err += Math.abs(m.rep[t] - data[t]); mean += data[t]; }
      var series = [m.rep]; if (reveal) series.push(truth.rep);
      var hi = Math.max.apply(null, data);
      series.forEach(function (s) { hi = Math.max(hi, Math.max.apply(null, s)); });

      clear(c);
      var tr = logy ? function (v) { return Math.log(Math.max(v, 1)) / Math.LN10; } : function (v) { return v; };
      var top = logy ? Math.ceil(tr(hi) * 2) / 2 + 0.3 : hi * 1.1;
      var yT = logy ? [0, 1, 2, 3, 4, 5].filter(function (k) { return k <= top; }) : V.ticks(0, top, 4);
      var f = V.frame(c, { x: [0, DAYS], y: [0, top], yTicks: yT, fmtY: logy ? function (k) { return V.fmt.int(Math.pow(10, k)); } : function (v) { return V.fmt.int(v); }, xTicks: [0, 35, 100, 150, 200], xLabel: "Day", yLabel: "Reported cases per day" + (logy ? " (log)" : ""), margin: { left: 62 } });
      el("rect", { x: f.x(0), width: f.x(DATA - 0.5) - f.x(0), y: f.y(top), height: f.y(0) - f.y(top), class: "fill-soft s5" }, f.inner);
      el("text", { x: f.x(DATA - 0.5) + 6, y: f.y(0) - 8, class: "viz-small viz-muted", text: "← data so far" }, f.inner);
      function pts(arr) { var o = []; arr.forEach(function (v, t) { if (!logy || v >= 1) o.push([f.x(t), f.y(tr(v))]); }); return o; }
      if (reveal) el("path", { d: V.line(pts(truth.rep)), class: "stroke s3 dashed", "stroke-width": 2.2 }, f.inner);
      el("path", { d: V.line(pts(m.rep)), class: "stroke s1", "stroke-width": 2.6 }, f.inner);
      data.forEach(function (v, t) { el("circle", { cx: f.x(t), cy: f.y(tr(v)), r: 2.8, class: "dot s5" }, f.inner); });

      var pk = argmax(m.rep);
      out.err(V.fmt.pct(err / mean));
      out.r0(V.fmt.num(m.R0, 2));
      out.pk("day " + pk);
      out.ar(V.fmt.pct(1 - m.S[DAYS]));
    }
    draw();
  });
})();
