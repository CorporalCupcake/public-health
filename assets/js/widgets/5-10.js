// Lecture 5.10 — Bayesian dynamic borrowing of an external control arm. Illustrative numbers.
// Binary endpoint (control response rate). Concurrent control arm n = 40, true rate 30%.
// External controls: n_e patients whose rate differs from the trial population by "drift".
// Fixed power prior: Beta(1 + a0*y_e, 1 + a0*(n_e - y_e)).
// Adaptive: the same informative prior mixed 80:20 with a vague Beta(1,1) (robust mixture);
// the data update the mixture weight, so borrowing falls as prior-data conflict grows.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function lgamma(x) {
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function lbeta(a, b) { return lgamma(a) + lgamma(b) - lgamma(a + b); }
  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
  function betaPdf(p, a, b) { return Math.exp((a - 1) * Math.log(p) + (b - 1) * Math.log(1 - p) - lbeta(a, b)); }
  function bMean(a, b) { return a / (a + b); }
  function bVar(a, b) { return a * b / ((a + b) * (a + b) * (a + b + 1)); }

  V.register("dynamic-borrowing", function (root) {
    var P0 = 0.30, NC = 40, WI = 0.8;
    var ctr = V.controls(root);
    var sD = V.slider(ctr, { label: "Drift: external rate minus trial rate", min: -0.25, max: 0.25, step: 0.01, value: 0.05,
      fmt: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.round(Math.abs(v) * 100) + " points"; }, onInput: draw });
    var sA = V.slider(ctr, { label: "Prior weight on external data (a₀)", min: 0, max: 1, step: 0.05, value: 0.5,
      fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sN = V.slider(ctr, { label: "External control patients", min: 50, max: 400, step: 10, value: 200, fmt: V.fmt.int, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "Trial control arm alone (n = 40)" },
      { cls: "s2", label: "External controls alone", dashed: true },
      { cls: "s1", label: "Posterior: fixed power prior" },
      { cls: "s4", label: "Posterior: adaptive (robust mixture)" }
    ]);
    var c1 = V.svg(root, 640, 250);
    c1.setAttribute("aria-label", "Distributions for the control response rate: from the trial control arm alone, from the external controls alone, and the two posteriors that borrow from the external data, with the true rate marked");
    var h1 = el("g", null, c1); h1.W = 640; h1.H = 250;

    var c2 = V.svg(root, 640, 250);
    c2.setAttribute("aria-label", "Root mean squared error of the control-rate estimate against drift, for no borrowing, a fixed power prior and an adaptive prior");
    var h2 = el("g", null, c2); h2.W = 640; h2.H = 250;

    var out = V.readouts(root, [
      { key: "essF", label: "Patients borrowed: fixed prior (ESS)" },
      { key: "essA", label: "Patients borrowed: adaptive prior (ESS)" },
      { key: "biasF", label: "Bias, fixed prior (percentage points)" },
      { key: "biasA", label: "Bias, adaptive prior (percentage points)" },
      { key: "rmse", label: "Error (RMSE): none / fixed / adaptive" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. True control response in the trial population is 30%. The top chart uses a typical trial result (12 of 40). Bias and error average over all trial results the 40 patients could produce. ESS = effective sample size: how many trial patients the borrowed information is worth." }, root);

    // Posterior summaries for one observed x.
    function fixedPost(x, a0, ye, ne) {
      var a = 1 + a0 * ye + x, b = 1 + a0 * (ne - ye) + NC - x;
      return { mean: bMean(a, b), a: a, b: b };
    }
    function adaptivePost(x, a0, ye, ne) {
      var aI = 1 + a0 * ye, bI = 1 + a0 * (ne - ye);
      var lmI = lbeta(aI + x, bI + NC - x) - lbeta(aI, bI);
      var lmV = lbeta(1 + x, 1 + NC - x) - lbeta(1, 1);
      var m = Math.max(lmI, lmV);
      var wI = WI * Math.exp(lmI - m), wV = (1 - WI) * Math.exp(lmV - m);
      var w = wI / (wI + wV);
      var mI = bMean(aI + x, bI + NC - x), mV = bMean(1 + x, 1 + NC - x);
      return { mean: w * mI + (1 - w) * mV, w: w, aI: aI + x, bI: bI + NC - x, aV: 1 + x, bV: 1 + NC - x };
    }
    // Bias and RMSE over x ~ Binomial(NC, P0).
    function operating(fn) {
      var bias = 0, mse = 0;
      for (var x = 0; x <= NC; x++) {
        var px = Math.exp(lchoose(NC, x) + x * Math.log(P0) + (NC - x) * Math.log(1 - P0));
        var m = fn(x);
        bias += px * (m - P0); mse += px * (m - P0) * (m - P0);
      }
      return { bias: bias, rmse: Math.sqrt(mse) };
    }
    function extRate(d) { return Math.min(0.98, Math.max(0.02, P0 + d)); }

    function draw() {
      var d = sD.value(), a0 = sA.value(), ne = sN.value();
      var ye = ne * extRate(d), xT = Math.round(NC * P0);

      // ---------- Chart 1: distributions at a typical trial result ----------
      clear(h1);
      var fp = fixedPost(xT, a0, ye, ne), ap = adaptivePost(xT, a0, ye, ne);
      var curves = [
        { cls: "s5", dashed: false, f: function (p) { return betaPdf(p, 1 + xT, 1 + NC - xT); } },
        { cls: "s2", dashed: true, f: function (p) { return betaPdf(p, 1 + ye, 1 + ne - ye); } },
        { cls: "s1", dashed: false, f: function (p) { return betaPdf(p, fp.a, fp.b); } },
        { cls: "s4", dashed: false, f: function (p) { return ap.w * betaPdf(p, ap.aI, ap.bI) + (1 - ap.w) * betaPdf(p, ap.aV, ap.bV); } }
      ];
      var grid = [], i;
      for (i = 1; i < 300; i++) grid.push(0.8 * i / 300);
      var ymax = 0;
      curves.forEach(function (cv) { cv.pts = grid.map(function (p) { var y = cv.f(p); if (y > ymax) ymax = y; return [p, y]; }); });
      ymax *= 1.08;
      var f = V.frame(h1, { x: [0, 0.8], y: [0, ymax], yTicks: [], xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], fmtX: V.fmt.pct, xLabel: "Control response rate", yLabel: "Plausibility", margin: { left: 30, top: 22 } });
      var g = f.inner;
      el("line", { x1: f.x(P0), x2: f.x(P0), y1: f.y(0), y2: f.y(ymax), class: "stroke s3 dashed", style: "stroke-width:1.5" }, g);
      el("text", { x: f.x(P0) + 5, y: f.m.top - 6, class: "viz-small colour s3", text: "true rate in the trial population" }, g);
      curves.forEach(function (cv) {
        el("path", { d: V.line(cv.pts.map(function (q) { return [f.x(q[0]), f.y(q[1])]; })), class: "stroke " + cv.cls + (cv.dashed ? " dashed" : ""), style: "stroke-width:" + (cv.cls === "s1" || cv.cls === "s4" ? 3 : 2) }, g);
      });

      // ---------- Chart 2: RMSE across drift ----------
      clear(h2);
      var drifts = [];
      for (i = 0; i <= 50; i++) drifts.push(-0.25 + 0.5 * i / 50);
      var none = operating(function (x) { return bMean(1 + x, 1 + NC - x); });
      var serF = [], serA = [], top = none.rmse;
      drifts.forEach(function (dd) {
        var y2 = ne * extRate(dd);
        var oF = operating(function (x) { return fixedPost(x, a0, y2, ne).mean; });
        var oA = operating(function (x) { return adaptivePost(x, a0, y2, ne).mean; });
        serF.push([dd, oF.rmse]); serA.push([dd, oA.rmse]);
        top = Math.max(top, oF.rmse, oA.rmse);
      });
      top = Math.ceil(top * 100 / 2) * 2 / 100 + 0.01;
      var f2 = V.frame(h2, { x: [-0.25, 0.25], y: [0, top], xTicks: [-0.2, -0.1, 0, 0.1, 0.2], fmtX: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.round(Math.abs(v) * 100); }, fmtY: function (v) { return Math.round(v * 100); }, xLabel: "Drift between external and trial control rate (percentage points)", yLabel: "Error (RMSE, points)", margin: { top: 22 } });
      var g2 = f2.inner;
      el("line", { x1: f2.x(d), x2: f2.x(d), y1: f2.y(0), y2: f2.y(top), class: "stroke s5", style: "stroke-width:1.2" }, g2);
      el("line", { x1: f2.x(-0.25), x2: f2.x(0.25), y1: f2.y(none.rmse), y2: f2.y(none.rmse), class: "stroke s5 dashed", style: "stroke-width:2" }, g2);
      el("text", { x: f2.x(0.25) - 4, y: f2.y(none.rmse) - 6, "text-anchor": "end", class: "viz-small viz-muted", text: "no borrowing" }, g2);
      el("path", { d: V.line(serF.map(function (q) { return [f2.x(q[0]), f2.y(q[1])]; })), class: "stroke s1", style: "stroke-width:3" }, g2);
      el("path", { d: V.line(serA.map(function (q) { return [f2.x(q[0]), f2.y(q[1])]; })), class: "stroke s4", style: "stroke-width:3" }, g2);
      el("text", { x: f2.x(0), y: f2.m.top - 8, "text-anchor": "middle", class: "viz-small viz-muted", text: "lower = better · below the dashed line, borrowing helps" }, g2);

      // ---------- Readouts ----------
      var oF = operating(function (x) { return fixedPost(x, a0, ye, ne).mean; });
      var oA = operating(function (x) { return adaptivePost(x, a0, ye, ne).mean; });
      out.essF(V.fmt.int(a0 * ne));
      out.essA("≈ " + V.fmt.int(ap.w * a0 * ne));
      out.biasF(V.fmt.signed(oF.bias * 100, 1));
      out.biasA(V.fmt.signed(oA.bias * 100, 1));
      out.rmse((none.rmse * 100).toFixed(1) + " / " + (oF.rmse * 100).toFixed(1) + " / " + (oA.rmse * 100).toFixed(1));
    }
    draw();
  });
})();
