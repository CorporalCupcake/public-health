// Lecture 2.15 — Fagan nomogram (pre-test → post-test probability) and a calibration plot. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function logit(p) { return Math.log(p / (1 - p)); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  function sig2(x) { return x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toPrecision(2); }
  function pctAuto(p) { return p < 0.01 ? (p * 100).toFixed(2) + "%" : p < 0.1 ? (p * 100).toFixed(1) + "%" : Math.round(p * 100) + "%"; }

  // ---------------------------------------------------------------------------
  // Fagan nomogram. Left axis: logit(pre) downwards; right axis: logit(post) upwards;
  // middle axis: ln(LR) at half scale. A straight line through all three is Bayes' rule.
  V.register("fagan", function (root) {
    var ctr = V.controls(root);
    var sPre = V.slider(ctr, { label: "Pre-test probability", min: 0.5, max: 95, step: 0.5, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sLp = V.slider(ctr, { label: "LR+ (positive result)", min: 0, max: 2, step: 0.005, value: Math.log10(6), fmt: function (v) { return sig2(Math.pow(10, v)); }, onInput: draw });
    var sLn = V.slider(ctr, { label: "LR− (negative result)", min: -2, max: 0, step: 0.005, value: Math.log10(0.16), fmt: function (v) { return sig2(Math.pow(10, v)); }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Load:" }, pre);
    V.button(pre, "AI-ECG, Mayo test set (LR+ 6.0, LR− 0.16)", function () { sLp.set(Math.log10(6.0)); sLn.set(Math.log10(0.16)); draw(); });
    V.button(pre, "Same model, Russian cohort (LR+ 10, LR− 0.75)", function () { sLp.set(Math.log10(10.3)); sLn.set(Math.log10(0.75)); draw(); });
    V.button(pre, "Screening: pre-test 1%", function () { sPre.set(1); draw(); });
    V.button(pre, "Breathless patient: pre-test 20%", function () { sPre.set(20); draw(); });

    V.legend(root, [{ cls: "s1", label: "If the test is positive (LR+)" }, { cls: "s3", label: "If the test is negative (LR−)" }]);
    var c = V.svg(root, 640, 560);
    c.setAttribute("aria-label", "Fagan nomogram: a line from the pre-test probability through the likelihood ratio gives the post-test probability");
    var Y0 = 290, K = 47, XL = 150, XM = 320, XR = 490, TOP = 40, BOT = 540;
    function yL(p) { return Y0 + K * logit(p); }
    function yR(p) { return Y0 - K * logit(p); }
    function yM(lr) { return Y0 - K * Math.log(lr) / 2; }
    var defs = el("defs", null, c);
    var cp = el("clipPath", { id: "l215-fagan-clip" }, defs);
    el("rect", { x: 0, y: TOP - 2, width: 640, height: BOT - TOP + 4 }, cp);

    var g = el("g", null, c);
    [[XL, "Pre-test"], [XM, "Likelihood ratio"], [XR, "Post-test"]].forEach(function (a) {
      el("line", { x1: a[0], x2: a[0], y1: TOP, y2: BOT, class: "viz-axis" }, g);
      el("text", { x: a[0], y: 22, "text-anchor": "middle", class: "viz-bold", text: a[1] }, g);
    });
    var P = [0.5, 1, 2, 5, 10, 20, 30, 50, 70, 80, 90, 95, 98, 99, 99.5];
    P.forEach(function (p) {
      var yl = yL(p / 100), yr = yR(p / 100);
      el("line", { x1: XL - 5, x2: XL, y1: yl, y2: yl, class: "viz-axis" }, g);
      el("text", { x: XL - 9, y: yl, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-tick", text: p + "%" }, g);
      el("line", { x1: XR, x2: XR + 5, y1: yr, y2: yr, class: "viz-axis" }, g);
      el("text", { x: XR + 9, y: yr, "dominant-baseline": "middle", class: "viz-tick", text: p + "%" }, g);
    });

    var gl = el("g", { "clip-path": "url(#l215-fagan-clip)" }, c);
    var linePos = el("line", { class: "stroke s1" }, gl), lineNeg = el("line", { class: "stroke s3" }, gl);
    var gm = el("g", null, c);
    [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 1000].forEach(function (lr) {
      var y = yM(lr);
      el("line", { x1: XM - 4, x2: XM + 4, y1: y, y2: y, class: "viz-axis" }, gm);
      el("text", { x: XM + 9, y: y, "dominant-baseline": "middle", class: "viz-tick", style: "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round", text: String(lr) }, gm);
    });
    var dPre = el("circle", { r: 6, class: "dot s5", cx: XL }, c);
    var dPos = el("circle", { r: 6, class: "dot s1", cx: XR }, c), dNeg = el("circle", { r: 6, class: "dot s3", cx: XR }, c);
    var tPos = el("text", { x: 552, class: "viz-small viz-bold colour s1", "dominant-baseline": "middle" }, c);
    var tNeg = el("text", { x: 552, class: "viz-small viz-bold colour s3", "dominant-baseline": "middle" }, c);

    var out = V.readouts(root, [
      { key: "pos", label: "Post-test probability if positive", cls: "good" },
      { key: "neg", label: "Post-test probability if negative", cls: "bad" },
      { key: "dpos", label: "Change if positive (percentage points)" },
      { key: "dneg", label: "Change if negative (percentage points)" }
    ]);
    el("p", { class: "widget-note", text: "AI-ECG presets: likelihood ratios computed from published sensitivity and specificity for ejection fraction ≤35% (Attia et al. 2019, Mayo test set; Attia et al. 2021, Know Your Heart cohort at the original threshold). Pre-test presets are illustrative." }, root);

    function clampY(y) { return Math.max(TOP, Math.min(BOT, y)); }

    function draw() {
      var p = sPre.value() / 100, lp = Math.pow(10, sLp.value()), ln = Math.pow(10, sLn.value());
      var o = p / (1 - p), pp = o * lp / (1 + o * lp), pn = o * ln / (1 + o * ln);
      var y0 = yL(p);
      [[linePos, pp], [lineNeg, pn]].forEach(function (L) {
        var y1 = yR(L[1]);
        L[0].setAttribute("x1", XL); L[0].setAttribute("y1", y0);
        L[0].setAttribute("x2", XR); L[0].setAttribute("y2", y1);
      });
      dPre.setAttribute("cy", clampY(y0));
      dPos.setAttribute("cy", clampY(yR(pp))); dNeg.setAttribute("cy", clampY(yR(pn)));
      var ya = clampY(yR(pp)), yb = clampY(yR(pn));
      if (yb - ya < 16) { var mid = (ya + yb) / 2; ya = mid - 8; yb = mid + 8; }
      tPos.setAttribute("y", ya); tNeg.setAttribute("y", yb);
      tPos.textContent = "+ " + pctAuto(pp);
      tNeg.textContent = "− " + pctAuto(pn);

      out.pos(pctAuto(pp));
      out.neg(pctAuto(pn));
      out.dpos(V.fmt.signed((pp - p) * 100, Math.abs(pp - p) < 0.1 ? 1 : 0));
      out.dneg(V.fmt.signed((pn - p) * 100, Math.abs(pn - p) < 0.1 ? 1 : 0));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Calibration: the model's predicted log-odds = mean + shift + spread × (true log-odds − mean).
  // Shift breaks calibration-in-the-large; spread ≠ 1 breaks the slope. Ranking (C) never changes.
  V.register("calibration", function (root) {
    var N = 3000, M = -1.7, rand = V.rng(215), LP = [], Y = [];
    for (var i = 0; i < N; i++) {
      var lp = M + 1.1 * V.normal(rand);
      LP.push(lp); Y.push(rand() < expit(lp) ? 1 : 0);
    }
    // C-statistic from ranks (continuous predictor, no ties)
    var idx = LP.map(function (_, i) { return i; }).sort(function (a, b) { return LP[a] - LP[b]; });
    var n1 = 0, rs = 0;
    idx.forEach(function (k, r) { if (Y[k]) { n1++; rs += r + 1; } });
    var C = (rs - n1 * (n1 + 1) / 2) / (n1 * (N - n1)), obsRate = n1 / N;

    var ctr = V.controls(root);
    var sOff = V.slider(ctr, { label: "Shift (calibration-in-the-large)", min: -1.5, max: 1.5, step: 0.1, value: 0, fmt: function (v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1); }, onInput: draw });
    var sSpr = V.slider(ctr, { label: "Spread (1 = right; above 1 = too extreme)", min: 0.4, max: 2.5, step: 0.05, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Well calibrated", 0, 1], ["Overfitted (too extreme)", 0, 1.6], ["Too modest", 0, 0.6], ["New population, risk underestimated", -0.8, 1]].forEach(function (p) {
      V.button(pre, p[0], function () { sOff.set(p[1]); sSpr.set(p[2]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Perfect calibration", dashed: true },
      { cls: "s1", label: "This model’s calibration curve" },
      { cls: "s2", label: "Tenths of predicted risk (observed rate)" }
    ]);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Calibration plot of observed against predicted risk, with the diagonal of perfect calibration");
    var f = V.frame(c, { x: [0, 1], y: [0, 1], fmtX: V.fmt.pct, fmtY: V.fmt.pct, xLabel: "Predicted risk", yLabel: "Observed risk" });
    el("line", { x1: f.x(0), y1: f.y(0), x2: f.x(1), y2: f.y(1), class: "stroke s5 dashed" }, f.inner);
    var gH = el("g", null, f.inner);
    var curve = el("path", { class: "stroke s1" }, f.inner);
    var gD = el("g", null, f.inner);
    el("text", { x: f.x(0.99), y: f.y(0.075), "text-anchor": "end", class: "viz-small viz-muted", text: "grey bars: how many people get each predicted risk" }, f.inner);

    var out = V.readouts(root, [
      { key: "mp", label: "Average predicted risk" },
      { key: "or", label: "Observed event rate" },
      { key: "slope", label: "Calibration slope (1 = right; below 1 = overfitted)" },
      { key: "c", label: "C-statistic (AUC)", cls: "good" },
      { key: "brier", label: "Brier score (lower is better)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 3,000 simulated patients, about one in five has the event. Both sliders change the predicted risks but never their order, so the C-statistic cannot move." }, root);

    function draw() {
      var off = sOff.value(), spr = sSpr.value();
      var P = LP.map(function (lp) { return expit(M + off + spr * (lp - M)); });
      var mp = 0, brier = 0;
      for (var i = 0; i < N; i++) { mp += P[i]; brier += (P[i] - Y[i]) * (P[i] - Y[i]); }
      mp /= N; brier /= N;

      // histogram of predictions along the bottom
      clear(gH);
      var K = 40, bins = new Array(K).fill(0);
      P.forEach(function (p) { bins[Math.min(K - 1, Math.floor(p * K))]++; });
      var mx = Math.max.apply(null, bins);
      bins.forEach(function (n, k) {
        if (!n) return;
        var h = 0.06 * n / mx;
        el("rect", { x: f.x(k / K) + 0.5, y: f.y(h), width: f.x(1 / K) - f.x(0) - 1, height: f.y(0) - f.y(h), class: "fill-soft s5" }, gH);
      });

      // analytic calibration curve over the central 98% of predictions
      var sorted = P.slice().sort(function (a, b) { return a - b; });
      var lo = sorted[Math.floor(N * 0.01)], hi = sorted[Math.floor(N * 0.99)], pts = [];
      for (var j = 0; j <= 100; j++) {
        var ph = lo + (hi - lo) * j / 100, lpTrue = M + (logit(ph) - M - off) / spr;
        pts.push([f.x(ph), f.y(expit(lpTrue))]);
      }
      curve.setAttribute("d", V.line(pts));

      // deciles of predicted risk
      clear(gD);
      var order = P.map(function (_, i) { return i; }).sort(function (a, b) { return P[a] - P[b]; });
      for (var d = 0; d < 10; d++) {
        var sp = 0, sy = 0, a = Math.floor(N * d / 10), b = Math.floor(N * (d + 1) / 10);
        for (var t = a; t < b; t++) { sp += P[order[t]]; sy += Y[order[t]]; }
        el("circle", { cx: f.x(sp / (b - a)), cy: f.y(sy / (b - a)), r: 5, class: "dot s2" }, gD);
      }

      out.mp(V.fmt.pct1(mp));
      out.or(V.fmt.pct1(obsRate));
      out.slope((1 / spr).toFixed(2));
      out.c(C.toFixed(2));
      out.brier(brier.toFixed(3));
    }
    draw();
  });
})();
