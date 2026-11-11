// Lecture 3.9 — Time series decomposition with ACF, and naive vs honest SEs under AR(1) errors. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function draws(seed, n) {
    var r = V.rng(seed), out = [], i;
    for (i = 0; i < 200; i++) r();
    for (i = 0; i < n; i++) out.push(V.normal(r));
    return out;
  }
  function ar1(z, phi, sd) { // stationary AR(1) with marginal SD = sd
    var e = [], k = Math.sqrt(1 - phi * phi);
    for (var t = 0; t < z.length; t++) e.push(t === 0 ? sd * z[0] : phi * e[t - 1] + sd * k * z[t]);
    return e;
  }
  function acf(x, L) {
    var n = x.length, m = 0, c0 = 0, out = [], t, k;
    for (t = 0; t < n; t++) m += x[t];
    m /= n;
    for (t = 0; t < n; t++) c0 += (x[t] - m) * (x[t] - m);
    for (k = 1; k <= L; k++) { var c = 0; for (t = 0; t + k < n; t++) c += (x[t] - m) * (x[t + k] - m); out.push(c / c0); }
    return out;
  }
  // Least squares via normal equations and Gaussian elimination (small p).
  function ols(X, y) {
    var p = X[0].length, A = [], i, j, k;
    for (i = 0; i < p; i++) { A.push([]); for (j = 0; j <= p; j++) A[i].push(0); }
    X.forEach(function (row, r) {
      for (i = 0; i < p; i++) { for (j = 0; j < p; j++) A[i][j] += row[i] * row[j]; A[i][p] += row[i] * y[r]; }
    });
    for (i = 0; i < p; i++) {
      var piv = i;
      for (k = i + 1; k < p; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
      for (k = i + 1; k < p; k++) { var f = A[k][i] / A[i][i]; for (j = i; j <= p; j++) A[k][j] -= f * A[i][j]; }
    }
    var b = new Array(p);
    for (i = p - 1; i >= 0; i--) { var s = A[i][p]; for (j = i + 1; j < p; j++) s -= A[i][j] * b[j]; b[i] = s / A[i][i]; }
    return b;
  }
  function Phi(x) { // standard normal CDF (Abramowitz–Stegun 7.1.26)
    var t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function range(arr, pad) {
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), d = (hi - lo) || 1;
    return [lo - d * (pad || 0.08), hi + d * (pad || 0.08)];
  }

  // ---------------------------------------------------------------------------
  // Decomposition: y = 500 + trend + season + AR(1) noise, monthly, 2017–2024.
  V.register("ts-decompose", function (root) {
    var N = 96, seed = 90001, Z = draws(seed, N), acfOf = "resid";
    var ctr = V.controls(root);
    var sTr = V.slider(ctr, { label: "Trend (admissions per year)", min: -20, max: 60, step: 5, value: 20, fmt: function (v) { return V.fmt.signed(v, 0); }, onInput: draw });
    var sA = V.slider(ctr, { label: "Seasonal amplitude (summer peak)", min: 0, max: 150, step: 5, value: 80, fmt: String, onInput: draw });
    var sN = V.slider(ctr, { label: "Noise SD", min: 5, max: 80, step: 5, value: 25, fmt: String, onInput: draw });
    var sP = V.slider(ctr, { label: "Autocorrelation of noise, φ", min: 0, max: 0.95, step: 0.05, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.8rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(row, { options: [{ value: "raw", label: "ACF of raw series" }, { value: "resid", label: "ACF of residuals" }], value: acfOf, onChange: function (v) { acfOf = v; draw(); } });
    V.button(row, "New random draw", function () { seed += 2; Z = draws(seed, N); draw(); });

    V.legend(root, [{ cls: "s5", label: "Observed monthly admissions" }, { cls: "s1", label: "Fitted trend + season" }]);
    var cMain = V.svg(root, 640, 210);
    cMain.setAttribute("aria-label", "Simulated monthly admissions 2017 to 2024 with fitted trend and seasonal curve");
    var cComp = V.svg(root, 640, 228);
    cComp.setAttribute("aria-label", "Estimated components: trend, seasonal pattern and remainder");
    var cAcf = V.svg(root, 640, 190);
    cAcf.setAttribute("aria-label", "Autocorrelation function for lags 1 to 36 with 95% band");

    var out = V.readouts(root, [
      { key: "tr", label: "Estimated trend (admissions per year)" },
      { key: "amp", label: "Estimated seasonal peak above average" },
      { key: "r1", label: "Residual lag-1 autocorrelation", cls: "bad" },
      { key: "r12", label: "ACF at lag 12 (shown series)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: a simulated series of monthly admissions peaking in July, 96 months. The fit is ordinary least squares on a linear trend and two harmonics (12- and 6-month waves)." }, root);

    var X = [];
    for (var t = 0; t < N; t++) {
      var w = 2 * Math.PI * t / 12;
      X.push([1, t / 12, Math.sin(w), Math.cos(w), Math.sin(2 * w), Math.cos(2 * w)]);
    }
    function xFmt(v) { return String(2017 + v / 12); }

    function draw() {
      var tr = sTr.value(), A = sA.value(), sd = sN.value(), phi = sP.value();
      var e = ar1(Z, phi, sd), y = [];
      for (var t = 0; t < N; t++) {
        var w = 2 * Math.PI * (t - 6) / 12;
        y.push(500 + tr * t / 12 + A * (Math.cos(w) + 0.25 * Math.cos(2 * w)) + e[t]);
      }
      var b = ols(X, y), fit = [], trend = [], seas = [], res = [];
      X.forEach(function (r, i) {
        var tc = b[0] + b[1] * r[1], sc = b[2] * r[2] + b[3] * r[3] + b[4] * r[4] + b[5] * r[5];
        trend.push(tc); seas.push(sc); fit.push(tc + sc); res.push(y[i] - tc - sc);
      });

      // main panel
      clear(cMain);
      var yr = range(y.concat(fit));
      var f = V.frame(cMain, { x: [0, N], y: yr, xTicks: [0, 12, 24, 36, 48, 60, 72, 84, 96], fmtX: xFmt, margin: { bottom: 28 }, yLabel: "Admissions" });
      el("path", { d: V.line(y.map(function (v, i) { return [f.x(i + 0.5), f.y(v)]; })), class: "stroke s5", "stroke-width": 1.6 }, f.inner);
      el("path", { d: V.line(fit.map(function (v, i) { return [f.x(i + 0.5), f.y(v)]; })), class: "stroke s1", "stroke-width": 2.4 }, f.inner);

      // components
      clear(cComp);
      [["Trend", trend, "s2"], ["Season", seas, "s4"], ["Remainder", res, "s5"]].forEach(function (c, k) {
        var top = k * 72, g = el("g", null, cComp);
        var lo = Math.min.apply(null, c[1]), hi = Math.max.apply(null, c[1]);
        if (hi - lo < 1) { lo -= 1; hi += 1; }
        var x = V.scale(0, N, 52, 624), yy = V.scale(lo, hi, top + 62, top + 14);
        el("line", { x1: 52, x2: 624, y1: top + 66, y2: top + 66, class: "viz-grid" }, cComp);
        if (lo < 0 && hi > 0) el("line", { x1: 52, x2: 624, y1: yy(0), y2: yy(0), class: "viz-grid", "stroke-dasharray": "3 3" }, cComp);
        el("path", { d: V.line(c[1].map(function (v, i) { return [x(i + 0.5), yy(v)]; })), class: "stroke " + c[2], "stroke-width": 2 }, cComp);
        el("text", { x: 52, y: top + 11, class: "viz-small viz-bold colour " + c[2], text: c[0] }, g);
        el("text", { x: 624, y: top + 11, "text-anchor": "end", class: "viz-small viz-muted", text: "range " + Math.round(lo) + " to " + Math.round(hi) }, g);
      });
      [0, 24, 48, 72, 96].forEach(function (v) {
        el("text", { x: 52 + v * 572 / N, y: 224, "text-anchor": "middle", class: "viz-tick", text: xFmt(v) }, cComp);
      });

      // ACF
      clear(cAcf);
      var series = acfOf === "raw" ? y : res, L = 36, r = acf(series, L), band = 1.96 / Math.sqrt(N);
      var fa = V.frame(cAcf, { x: [0.5, L + 0.5], y: [-1, 1], yTicks: [-1, -0.5, 0, 0.5, 1], xTicks: [1, 6, 12, 18, 24, 30, 36], xLabel: "Lag (months)", yLabel: "ACF", margin: { bottom: 40 } });
      [band, -band].forEach(function (bv) { el("line", { x1: fa.x(0.5), x2: fa.x(L + 0.5), y1: fa.y(bv), y2: fa.y(bv), class: "stroke s3 dashed", "stroke-width": 1.4 }, fa.inner); });
      el("line", { x1: fa.x(0.5), x2: fa.x(L + 0.5), y1: fa.y(0), y2: fa.y(0), class: "viz-axis" }, fa.inner);
      r.forEach(function (v, i) {
        var x0 = fa.x(i + 1) - 4, ytop = fa.y(Math.max(0, v)), h = Math.abs(fa.y(v) - fa.y(0));
        el("rect", { x: x0, y: ytop, width: 8, height: Math.max(h, 0.5), class: "fill s1" }, fa.inner);
      });
      el("text", { x: fa.x(L + 0.5), y: 12, "text-anchor": "end", class: "viz-small viz-muted", text: acfOf === "raw" ? "raw series" : "residuals after trend + season" }, cAcf);

      var amp = Math.max.apply(null, seas);
      out.tr(V.fmt.signed(b[1], 1));
      out.amp("+" + Math.round(amp));
      out.r1(acf(res, 1)[0].toFixed(2));
      out.r12(r[11].toFixed(2));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Naive vs honest SE of a linear trend when residuals follow AR(1) with marginal SD 1. True slope = 0.
  V.register("ar1-se", function (root) {
    var seed = 70001, SIMS = 400;
    var ctr = V.controls(root);
    var sP = V.slider(ctr, { label: "Autocorrelation, φ", min: 0, max: 0.95, step: 0.05, value: 0.6, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sN = V.slider(ctr, { label: "Length of series (months)", min: 24, max: 240, step: 12, value: 60, fmt: String, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(row, "Draw a new series", function () { seed += 2; draw(); });

    V.legend(root, [{ cls: "s5", label: "Series (no true trend)" }, { cls: "s3", label: "OLS trend line" }]);
    var c1 = V.svg(root, 640, 200);
    c1.setAttribute("aria-label", "A simulated autocorrelated series with no true trend and its fitted OLS trend line");
    var c2 = V.svg(root, 640, 150);
    c2.setAttribute("aria-label", "Naive and honest 95% confidence intervals for the trend, with the true value of zero");

    var out = V.readouts(root, [
      { key: "ratio", label: "Honest SE ÷ naive SE", cls: "bad" },
      { key: "cov", label: "Real coverage of the naive “95%” CI" },
      { key: "fp", label: "No-trend series called significant (400 simulations)", cls: "bad" },
      { key: "ess", label: "Effective sample size ≈ n(1 − φ)/(1 + φ)", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Honest SE is the true sampling SE of the OLS slope under AR(1) errors; naive SE is what ordinary regression reports on average. Trend in SD units per year." }, root);

    function slopeFit(y) { // OLS on t (months) → slope per month, naive SE
      var n = y.length, tb = (n - 1) / 2, yb = 0, sxx = 0, sxy = 0, t;
      for (t = 0; t < n; t++) yb += y[t];
      yb /= n;
      for (t = 0; t < n; t++) { sxx += (t - tb) * (t - tb); sxy += (t - tb) * (y[t] - yb); }
      var b = sxy / sxx, a = yb - b * tb, rss = 0;
      for (t = 0; t < n; t++) { var r = y[t] - a - b * t; rss += r * r; }
      return { a: a, b: b, se: Math.sqrt(rss / (n - 2) / sxx) };
    }

    function draw() {
      var phi = sP.value(), n = sN.value(), i, j;
      // analytic variances for the slope (centred time)
      var tb = (n - 1) / 2, sxx = 0, s11 = 0, sOO = 0, sO1 = 0;
      var pw = [1]; for (i = 1; i < n; i++) pw.push(pw[i - 1] * phi);
      for (i = 0; i < n; i++) sxx += (i - tb) * (i - tb);
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        var s = pw[Math.abs(i - j)];
        s11 += (i - tb) * (j - tb) * s; sOO += s; sO1 += (j - tb) * s;
      }
      var varTrue = s11 / (sxx * sxx);
      var trHS = sOO / n + s11 / sxx; // trace of hat matrix × Σ, centred design
      var varNaive = (n - trHS) / (n - 2) / sxx;
      var seT = Math.sqrt(varTrue) * 12, seN = Math.sqrt(varNaive) * 12;
      var cover = 2 * Phi(1.96 * seN / seT) - 1;

      // this series
      var y = ar1(draws(seed, n), phi, 1), fit = slopeFit(y), est = fit.b * 12;
      // simulations
      var hits = 0;
      for (var k = 0; k < SIMS; k++) {
        var f2 = slopeFit(ar1(draws(seed * 7 + 2 * k + 1, n), phi, 1));
        if (Math.abs(f2.b / f2.se) > 1.96) hits++;
      }

      clear(c1);
      var yr = range(y.concat([-2.5, 2.5]), 0.02);
      var f = V.frame(c1, { x: [0, n], y: yr, xLabel: "Month", yLabel: "Value (SD units)", margin: { bottom: 40 } });
      el("path", { d: V.line(y.map(function (v, t) { return [f.x(t + 0.5), f.y(v)]; })), class: "stroke s5", "stroke-width": 1.6 }, f.inner);
      el("line", { x1: f.x(0.5), x2: f.x(n - 0.5), y1: f.y(fit.a + fit.b * 0), y2: f.y(fit.a + fit.b * (n - 1)), class: "stroke s3", "stroke-width": 2.6 }, f.inner);

      clear(c2);
      var hw = 1.96 * seT, lim = Math.max(Math.abs(est) + hw * 1.15, 0.05);
      lim = Math.ceil(lim * 20) / 20;
      var f2 = V.frame(c2, { x: [-lim, lim], y: [0, 2], yTicks: [], xTicks: V.ticks(-lim, lim, 6), fmtX: function (v) { return v === 0 ? "0" : V.fmt.signed(v, 2); }, xLabel: "Estimated trend per year, with 95% CI (SD units)", margin: { left: 16, right: 16, top: 10, bottom: 40 } });
      el("line", { x1: f2.x(0), x2: f2.x(0), y1: f2.y(2), y2: f2.y(0), class: "stroke s5 dashed", "stroke-width": 1.5 }, f2.inner);
      [[1.45, seN, "s3", "Naive OLS"], [0.6, seT, "s1", "Honest (allows for AR(1))"]].forEach(function (r) {
        var yy = f2.y(r[0]), lo = est - 1.96 * r[1], hi = est + 1.96 * r[1];
        el("line", { x1: f2.x(lo), x2: f2.x(hi), y1: yy, y2: yy, class: "stroke " + r[2], "stroke-width": 6 }, f2.inner);
        el("circle", { cx: f2.x(est), cy: yy, r: 6, class: "dot " + r[2] }, f2.inner);
        var miss = lo > 0 || hi < 0;
        el("text", { x: f2.x(-lim) + 4, y: yy - 12, class: "viz-small viz-bold colour " + r[2], text: r[3] + (miss ? " · excludes 0: “significant”" : " · includes 0") }, f2.inner);
      });

      out.ratio("× " + (seT / seN).toFixed(2));
      out.cov(V.fmt.pct(cover));
      out.fp(V.fmt.pct(hits / SIMS));
      out.ess(V.fmt.int(n * (1 - phi) / (1 + phi)) + " of " + n);
    }
    draw();
  });
})();
