// Lecture 3.8 — Partial pooling of hospital rates, and conditional vs marginal effects. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function logit(p) { return Math.log(p / (1 - p)); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  function pp(x) { return (x * 100).toFixed(1) + " pp"; }
  function presets(root, label, items) {
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: label }, row);
    items.forEach(function (it) { V.button(row, it[0], it[1]); });
  }

  // ---------------------------------------------------------------------------
  // Partial pooling. 12 hospitals; true 30-day mortality varies around 9% (SD 0.35 on the log-odds scale).
  // Observed deaths are binomial. Shrinkage uses the normal approximation:
  //   estimate_j = w_j × raw_j + (1 − w_j) × overall, w_j = τ² / (τ² + p(1 − p)/n_j).
  V.register("partial-pooling", function (root) {
    var N = [6, 10, 15, 22, 30, 45, 60, 90, 130, 200, 320, 500], K = N.length;
    var rand = V.rng(1001), i, k;
    for (i = 0; i < 200; i++) rand();
    var P = [], D = [];
    N.forEach(function (n) {
      var p = expit(logit(0.09) + 0.35 * V.normal(rand)), d = 0;
      for (k = 0; k < n; k++) if (rand() < p) d++;
      P.push(p); D.push(d);
    });
    var raw = D.map(function (d, j) { return d / N[j]; });
    var sumD = D.reduce(function (a, b) { return a + b; }, 0), sumN = N.reduce(function (a, b) { return a + b; }, 0);
    var pbar = sumD / sumN;
    var vw = N.map(function (n) { return pbar * (1 - pbar) / n; });
    // DerSimonian–Laird style moment estimate of τ², standing in for what glmer would estimate
    var w = vw.map(function (v) { return 1 / v; }), sw = 0, sw2 = 0, yw = 0, Q = 0;
    w.forEach(function (x, j) { sw += x; sw2 += x * x; yw += x * raw[j]; });
    yw /= sw;
    w.forEach(function (x, j) { Q += x * (raw[j] - yw) * (raw[j] - yw); });
    var tauHat = Math.sqrt(Math.max(0, (Q - (K - 1)) / (sw - sw2 / sw)));
    var TMAX = 16, tauHatPP = Math.round(tauHat * 100 * 5) / 5;

    var ctr = V.controls(root);
    var sTau = V.slider(ctr, {
      label: "Between-hospital SD, τ (percentage points)", min: 0, max: TMAX, step: 0.2, value: tauHatPP,
      fmt: function (v) { return v >= TMAX ? "∞ (no pooling)" : v === 0 ? "0 (complete pooling)" : v.toFixed(1); }, onInput: draw
    });
    presets(root, "Set:", [
      ["Complete pooling", function () { sTau.set(0); draw(); }],
      ["Model’s estimate (τ ≈ " + tauHatPP.toFixed(1) + ")", function () { sTau.set(tauHatPP); draw(); }],
      ["No pooling", function () { sTau.set(TMAX); draw(); }]
    ]);

    V.legend(root, [
      { cls: "s2", label: "Raw rate (no pooling)" },
      { cls: "s1", label: "Partially pooled estimate" },
      { cls: "s3", label: "True rate (known only because simulated)" },
      { cls: "s5", label: "Overall rate (complete pooling)", dashed: true }
    ]);
    var ROW = 28, TOP = 34;
    var c = V.svg(root, 640, TOP + K * ROW + 44);
    c.setAttribute("aria-label", "Dot plot of twelve hospitals' 30-day mortality: raw rate, partially pooled estimate and true rate, smallest hospital at the top");
    var f = V.frame(c, {
      x: [0, 0.35], y: [K, 0], yTicks: [], xTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
      fmtX: V.fmt.pct, xLabel: "30-day mortality", margin: { top: TOP, left: 112, bottom: 44, right: 16 }
    });
    for (i = 0; i < K; i++) {
      var yy = TOP + i * ROW + ROW / 2;
      el("line", { x1: f.x(0), x2: f.x(0.35), y1: yy, y2: yy, class: "viz-grid" }, f.g);
      el("text", { x: 104, y: yy, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-small", text: D[i] + " of " + N[i] + " died" }, f.g);
    }
    el("line", { x1: f.x(pbar), x2: f.x(pbar), y1: TOP - 4, y2: TOP + K * ROW, class: "stroke s5 dashed", "stroke-width": 1.6 }, f.inner);
    el("text", { x: f.x(pbar) + 6, y: TOP - 12, class: "viz-small viz-muted", text: "overall " + V.fmt.pct1(pbar) }, f.inner);
    var gRows = el("g", null, f.inner);

    var out = V.readouts(root, [
      { key: "e0", label: "Typical error vs truth: no pooling (RMSE)", cls: "bad" },
      { key: "e1", label: "Typical error: complete pooling (RMSE)" },
      { key: "e2", label: "Typical error: partial pooling at this τ (RMSE)", cls: "good" },
      { key: "wS", label: "Weight on own data: smallest hospital (6 patients)" },
      { key: "wL", label: "Weight on own data: largest hospital (500 patients)" },
      { key: "worst", label: "Hospital ranked worst at this τ" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: simulated hospitals whose true mortality varies around 9%. The widget uses the normal approximation on the percentage scale; glmer does the same thing on the log-odds scale. pp = percentage points." }, root);

    function draw() {
      var t = sTau.value(), inf = t >= TMAX, tau = t / 100;
      var est = raw.map(function (r, j) {
        var wj = inf ? 1 : (tau === 0 ? 0 : tau * tau / (tau * tau + vw[j]));
        return { e: wj * r + (1 - wj) * pbar, w: wj };
      });
      clear(gRows);
      est.forEach(function (o, j) {
        var yy = TOP + j * ROW + ROW / 2;
        el("line", { x1: f.x(raw[j]), x2: f.x(o.e), y1: yy, y2: yy, class: "stroke s5", "stroke-width": 1.5 }, gRows);
        el("circle", { cx: f.x(P[j]), cy: yy, r: 7, class: "stroke s3", "stroke-width": 1.8 }, gRows);
        el("circle", { cx: f.x(raw[j]), cy: yy, r: 5, class: "dot s2" }, gRows);
        el("circle", { cx: f.x(o.e), cy: yy, r: 5, class: "dot s1" }, gRows);
      });
      function rmse(a) { var s = 0; a.forEach(function (x, j) { s += (x - P[j]) * (x - P[j]); }); return Math.sqrt(s / K); }
      out.e0(pp(rmse(raw)));
      out.e1(pp(rmse(raw.map(function () { return pbar; }))));
      out.e2(pp(rmse(est.map(function (o) { return o.e; }))));
      out.wS(V.fmt.pct(est[0].w));
      out.wL(V.fmt.pct(est[K - 1].w));
      var wi = 0;
      est.forEach(function (o, j) { if (o.e > est[wi].e + 1e-12) wi = j; });
      out.worst(t === 0 ? "all tied" : D[wi] + " of " + N[wi]);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Conditional (subject-specific) vs marginal (population-averaged) curves.
  // Logistic: P(y=1 | x, u) = expit(β x + u), u ~ N(0, σ²). Marginal = average over u (numerical integration).
  V.register("marginal-conditional", function (root) {
    var mode = "logit";
    var ctr = V.controls(root);
    V.toggle(ctr, { options: [{ value: "logit", label: "Logistic link" }, { value: "linear", label: "Linear link" }], value: mode, onChange: function (v) { mode = v; draw(); } });
    var sSig = V.slider(ctr, { label: "Random-intercept SD, σ (log-odds scale)", min: 0, max: 4, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sOR = V.slider(ctr, { label: "Subject-specific odds ratio per unit of x", min: 1, max: 8, step: 0.1, value: 3, fmt: function (v) { return v.toFixed(1); }, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "Individual people (different random intercepts)" },
      { cls: "s1", label: "Typical person (random intercept 0)" },
      { cls: "s2", label: "Population average" }
    ]);
    var c = V.svg(root, 640, 340);
    c.setAttribute("aria-label", "Probability of the outcome against exposure x: individual S-curves, the curve of a typical person, and the flatter population-average curve");
    var f = V.frame(c, { x: [-4, 4], y: [0, 1], fmtY: V.fmt.pct, xLabel: "Exposure x (standardised)", yLabel: "Probability of outcome" });
    var yLab = f.g.lastChild;
    var defs = el("defs", null, c), cp = el("clipPath", { id: "l38-mc-clip" }, defs);
    el("rect", { x: f.x(-4), y: f.y(1), width: f.x(4) - f.x(-4), height: f.y(0) - f.y(1) }, cp);
    var g = el("g", { "clip-path": "url(#l38-mc-clip)" }, f.inner);

    var out = V.readouts(root, [
      { key: "ss", label: "Subject-specific effect (mixed model)", cls: "good" },
      { key: "pa", label: "Population-averaged effect (GEE)" },
      { key: "att", label: "Attenuation (ratio of log-odds ratios)", cls: "bad" },
      { key: "apx", label: "Rule-of-thumb OR: log OR ÷ √(1 + 0.35σ²)" },
      { key: "icc", label: "ICC on the latent scale" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative model with no other covariates. Population-averaged OR is measured at the centre (x from −0.5 to +0.5); away from the centre the marginal curve is not exactly logistic. In linear mode the slope is in arbitrary units." }, root);

    var Z = [], W = [], sw = 0;
    for (var z = -6; z <= 6.0001; z += 0.05) { var wt = Math.exp(-z * z / 2); Z.push(z); W.push(wt); sw += wt; }
    W = W.map(function (x) { return x / sw; });
    var QS = [-1.64, -1.04, -0.52, 0.52, 1.04, 1.64];

    function draw() {
      var s = sSig.value(), b = Math.log(sOR.value()), lin = mode === "linear";
      var bl = b / 16, sl = 0.06; // linear: slope per unit and SD scale in outcome units
      function cond(x, u) { return lin ? 0.5 + bl * x + sl * u : expit(b * x + u); }
      function marg(x) { if (lin) return 0.5 + bl * x; var m = 0; for (var i = 0; i < Z.length; i++) m += W[i] * expit(b * x + s * Z[i]); return m; }
      clear(g);
      function curve(fn, cls, sw) {
        var pts = [];
        for (var x = -4; x <= 4.0001; x += 0.05) pts.push([f.x(x), f.y(fn(x))]);
        el("path", { d: V.line(pts), class: "stroke " + cls, "stroke-width": sw }, g);
      }
      QS.forEach(function (q) { curve(function (x) { return cond(x, s * q); }, "s5", 1.4); });
      curve(function (x) { return cond(x, 0); }, "s1", 3);
      curve(marg, "s2 dashed", 3);
      yLab.textContent = lin ? "Mean outcome" : "Probability of outcome";

      if (lin) {
        out.ss("slope " + bl.toFixed(3));
        out.pa("slope " + bl.toFixed(3));
        out.att("1.00");
        out.apx("not needed");
        out.icc("–");
      } else {
        var bm = logit(marg(0.5)) - logit(marg(-0.5));
        out.ss("OR " + Math.exp(b).toFixed(2));
        out.pa("OR " + Math.exp(bm).toFixed(2));
        out.att(b > 0 ? (bm / b).toFixed(2) : "1.00");
        out.apx("OR " + Math.exp(b / Math.sqrt(1 + 0.346 * s * s)).toFixed(2));
        out.icc((s * s / (s * s + Math.PI * Math.PI / 3)).toFixed(2));
      }
    }
    draw();
  });
})();
