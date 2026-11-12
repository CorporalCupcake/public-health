// Lecture 4.9 — Regression discontinuity and instrumental variables.
// (1) RD explorer: local linear in a window vs global polynomials, with bias and spread over repeated samples.
// (2) IV / LATE demo: principal strata under an instrument, ITT, first stage, Wald, and weak-instrument instability.
// Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return r;
  }

  // Weighted least squares; X rows are arrays. Returns coefficient vector (or null if singular).
  function wls(X, y, w) {
    var p = X[0].length, A = [], b = [], i, j, k;
    for (i = 0; i < p; i++) { A.push(new Array(p).fill(0)); b.push(0); }
    for (k = 0; k < X.length; k++) {
      var xk = X[k], wk = w ? w[k] : 1;
      if (wk <= 0) continue;
      for (i = 0; i < p; i++) {
        b[i] += wk * xk[i] * y[k];
        for (j = i; j < p; j++) A[i][j] += wk * xk[i] * xk[j];
      }
    }
    for (i = 0; i < p; i++) for (j = 0; j < i; j++) A[i][j] = A[j][i];
    // Gaussian elimination with partial pivoting
    for (i = 0; i < p; i++) {
      var piv = i;
      for (j = i + 1; j < p; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp; var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      for (j = i + 1; j < p; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < p; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var beta = new Array(p);
    for (i = p - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < p; j++) s -= A[i][j] * beta[j];
      beta[i] = s / A[i][i];
    }
    return beta;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // ---------------------------------------------------------------------------
  // 1. RD explorer
  V.register("rd-explorer", function (root) {
    var N = 500, REPS = 200, C = 20, XMIN = 10, XMAX = 30, seed = 490057;
    var draws; // draws[r] = {x:[], e:[]}, r = 0 is the sample shown
    function makeDraws() {
      var r = stream(seed); draws = [];
      for (var k = 0; k < REPS; k++) {
        var xs = [], es = [];
        for (var i = 0; i < N; i++) { xs.push(XMIN + (XMAX - XMIN) * r()); es.push(V.normal(r)); }
        draws.push({ x: xs, e: es });
      }
    }
    makeDraws();

    var ctr = V.controls(root);
    var sJ = V.slider(ctr, { label: "True jump at the cut-off (mmol/L)", min: -1.5, max: 1.5, step: 0.1, value: -1, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw });
    var sK = V.slider(ctr, { label: "Curvature of the true relationship", min: 0, max: 2, step: 0.1, value: 1, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sH = V.slider(ctr, { label: "Bandwidth (± risk points)", min: 1, max: 10, step: 0.5, value: 4, fmt: function (v) { return "±" + v.toFixed(1); }, onInput: draw });
    var sS = V.slider(ctr, { label: "Noise (SD of LDL)", min: 0.1, max: 1.2, step: 0.05, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Fit:" }, row);
    var method = V.toggle(row, { options: [{ value: 1, label: "Local linear (window)" }, { value: 3, label: "Global cubic" }, { value: 5, label: "Global 5th-order" }], value: 1, onChange: draw });
    V.button(row, "New sample", function () { seed += 2; makeDraws(); draw(); });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Curved truth, wide window", -1, 1.5, 10, 0.5, 0], ["Same, narrow window", -1, 1.5, 2.5, 0.5, 0], ["5th-order, noisy", -1, 1, 4, 1, 2], ["No jump at all", 0, 0.5, 5, 0.6, 0]].forEach(function (p) {
      V.button(pre, p[0], function () {
        sJ.set(p[1]); sK.set(p[2]); sH.set(p[3]); sS.set(p[4]);
        row.querySelectorAll(".widget-toggle button")[p[5]].click();
      });
    });

    V.legend(root, [
      { cls: "s5", label: "Not treated (risk < 20%)" }, { cls: "s1", label: "Treated (risk ≥ 20%)" },
      { cls: "s2", label: "Fitted lines" }, { cls: "s5", label: "True curve", dashed: true }, { cls: "s3", label: "Estimated jump" }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Scatter of LDL cholesterol against 10-year cardiovascular risk, with a cut-off at 20%, fitted lines on each side and the estimated jump at the cut-off");

    var out = V.readouts(root, [
      { key: "est", label: "Estimate from this sample", cls: "good" },
      { key: "truth", label: "True jump" },
      { key: "bias", label: "Bias: average error over 200 samples", cls: "bad" },
      { key: "sd", label: "Spread: SD of the estimate over 200 samples" },
      { key: "n", label: "Points used (this sample)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 500 patients per sample, statin given to everyone at or above 20% 10-year risk (a sharp design). Local linear uses a triangular kernel inside the window; global polynomials use every point on each side. Bias and spread come from 200 fresh samples with the same settings." }, root);

    function truth(x, k) {
      var d = x - C;
      return 3.6 + 0.04 * d + k * (0.012 * d * d + 0.35 * Math.sin(d / 2.5));
    }

    // Returns {left, right, coefL, coefR, nUsed}; intercepts at the cut-off.
    function fit(xs, ys, deg, h) {
      var res = { nUsed: 0 };
      [-1, 1].forEach(function (side) {
        var X = [], Y = [], W = [];
        for (var i = 0; i < xs.length; i++) {
          var d = xs[i] - C;
          if ((side < 0 && d >= 0) || (side > 0 && d < 0)) continue;
          if (deg === 1) {
            if (Math.abs(d) >= h) continue;
            X.push([1, d / 10]); W.push(1 - Math.abs(d) / h);
          } else {
            var u = d / 10, rowv = [1];
            for (var p = 1; p <= deg; p++) rowv.push(Math.pow(u, p));
            X.push(rowv); W.push(1);
          }
          Y.push(ys[i]);
        }
        res.nUsed += X.length;
        var beta = X.length >= (deg === 1 ? 3 : deg + 2) ? wls(X, Y, W) : null;
        if (side < 0) { res.coefL = beta; res.left = beta ? beta[0] : NaN; }
        else { res.coefR = beta; res.right = beta ? beta[0] : NaN; }
      });
      res.jump = res.right - res.left;
      return res;
    }

    function evalPoly(beta, d) {
      var u = d / 10, s = 0;
      for (var p = 0; p < beta.length; p++) s += beta[p] * Math.pow(u, p);
      return s;
    }

    function draw() {
      var J = sJ.value(), K = sK.value(), H = sH.value(), S = sS.value(), deg = method.value();
      // repeated samples
      var ests = [], shown = null, ysShown = null;
      for (var r = 0; r < REPS; r++) {
        var xs = draws[r].x, es = draws[r].e, ys = new Array(N);
        for (var i = 0; i < N; i++) ys[i] = truth(xs[i], K) + (xs[i] >= C ? J : 0) + S * es[i];
        var f = fit(xs, ys, deg, H);
        if (r === 0) { shown = f; ysShown = ys; }
        if (isFinite(f.jump)) ests.push(f.jump);
      }
      var mean = ests.reduce(function (a, b) { return a + b; }, 0) / ests.length;
      var sd = Math.sqrt(ests.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Math.max(1, ests.length - 1));

      clear(c);
      var xs0 = draws[0].x;
      var lo = Infinity, hi = -Infinity;
      for (var q = 0; q < N; q++) { lo = Math.min(lo, ysShown[q]); hi = Math.max(hi, ysShown[q]); }
      lo = Math.floor(lo * 2) / 2 - 0.25; hi = Math.ceil(hi * 2) / 2 + 0.25;
      var fr = V.frame(c, { x: [XMIN, XMAX], y: [lo, hi], fmtX: function (v) { return v + "%"; }, fmtY: function (v) { return v.toFixed(1); }, xLabel: "10-year cardiovascular risk score (running variable)", yLabel: "LDL at follow-up (mmol/L)", margin: { top: 22 } });
      var g = fr.inner;

      // window shading
      if (deg === 1) {
        el("rect", { x: fr.x(Math.max(XMIN, C - H)), y: fr.y(hi), width: fr.x(Math.min(XMAX, C + H)) - fr.x(Math.max(XMIN, C - H)), height: fr.y(lo) - fr.y(hi), class: "fill-soft s1", style: "fill-opacity:0.08" }, g);
        el("text", { x: fr.x(C - H) + 4, y: fr.y(hi) + 14, class: "viz-small viz-muted", text: "window" }, g);
      }
      // points
      for (var p = 0; p < N; p++) {
        el("circle", { cx: fr.x(xs0[p]).toFixed(1), cy: fr.y(ysShown[p]).toFixed(1), r: 2.2, class: "fill-soft " + (xs0[p] >= C ? "s1" : "s5"), style: "fill-opacity:0.45" }, g);
      }
      // cut-off line
      el("line", { x1: fr.x(C), x2: fr.x(C), y1: fr.y(lo), y2: fr.y(hi), class: "viz-axis", "stroke-dasharray": "4 4" }, g);
      el("text", { x: fr.x(C), y: 14, "text-anchor": "middle", class: "viz-small viz-bold", text: "cut-off: statins from 20%" }, c);

      // true curve (each side, including jump)
      [[XMIN, C - 0.001], [C, XMAX]].forEach(function (seg) {
        var pts = [];
        for (var k = 0; k <= 80; k++) { var xv = seg[0] + (seg[1] - seg[0]) * k / 80; pts.push([fr.x(xv), fr.y(truth(xv, K) + (xv >= C ? J : 0))]); }
        el("path", { d: V.line(pts), class: "stroke dashed s5", style: "stroke-width:1.8" }, g);
      });

      // fitted lines
      [["coefL", -1], ["coefR", 1]].forEach(function (pair) {
        var beta = shown[pair[0]], side = pair[1];
        if (!beta) return;
        var d0 = 0, d1 = side < 0 ? (deg === 1 ? -Math.min(H, C - XMIN) : XMIN - C) : (deg === 1 ? Math.min(H, XMAX - C) : XMAX - C);
        var pts = [];
        for (var k = 0; k <= 80; k++) {
          var d = d0 + (d1 - d0) * k / 80, yv = evalPoly(beta, d);
          yv = Math.max(lo, Math.min(hi, yv));
          pts.push([fr.x(C + d), fr.y(yv)]);
        }
        el("path", { d: V.line(pts), class: "stroke s2" }, g);
      });

      // jump marker
      if (isFinite(shown.jump)) {
        var yl = Math.max(lo, Math.min(hi, shown.left)), yr = Math.max(lo, Math.min(hi, shown.right));
        el("line", { x1: fr.x(C), x2: fr.x(C), y1: fr.y(yl), y2: fr.y(yr), class: "stroke s3", style: "stroke-width:4" }, g);
        el("circle", { cx: fr.x(C), cy: fr.y(yl), r: 4, class: "dot s3" }, g);
        el("circle", { cx: fr.x(C), cy: fr.y(yr), r: 4, class: "dot s3" }, g);
        el("text", { x: fr.x(C) + 8, y: fr.y(hi) + 16, class: "viz-small viz-bold colour s3", style: "paint-order:stroke;stroke:var(--surface);stroke-width:4px", text: "estimated jump " + V.fmt.signed(shown.jump, 2) }, g);
      }

      out.est(isFinite(shown.jump) ? V.fmt.signed(shown.jump, 2) : "too few points");
      out.truth(V.fmt.signed(J, 2));
      out.bias(isFinite(mean) ? V.fmt.signed(mean - J, 2) : "–");
      out.sd(isFinite(sd) ? sd.toFixed(2) : "–");
      out.n(V.fmt.int(shown.nUsed));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // 2. IV / LATE demo
  V.register("iv-late", function (root) {
    var STUDIES = 400, seed = 490101;
    // baseline 1-year death risk by type (always-takers are picked for the procedure because they are fitter)
    var BASE = { a: 0.10, c: 0.18, n: 0.30, d: 0.18 }, EFF_N = -0.03, EFF_D = 0;

    var ctr = V.controls(root);
    var sC = V.slider(ctr, { label: "Compliers (instrument strength)", min: 1, max: 60, step: 1, value: 30, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sA = V.slider(ctr, { label: "Always-takers", min: 0, max: 40, step: 1, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sD = V.slider(ctr, { label: "Defiers (0 = monotonicity holds)", min: 0, max: 20, step: 1, value: 0, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sEC = V.slider(ctr, { label: "Effect in compliers", min: -15, max: 5, step: 1, value: -6, fmt: function (v) { return V.fmt.signed(v, 0) + " pp"; }, onInput: draw });
    var sEA = V.slider(ctr, { label: "Effect in always-takers", min: -20, max: 5, step: 1, value: -12, fmt: function (v) { return V.fmt.signed(v, 0) + " pp"; }, onInput: draw });
    var sN = V.slider(ctr, { label: "Patients per study", min: 500, max: 20000, step: 500, value: 4000, fmt: V.fmt.int, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New set of studies", function () { seed += 2; draw(); });
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Strong instrument", 30, 20, 0, -6, -12, 4000], ["Weak instrument", 3, 20, 0, -6, -12, 4000], ["Weak but huge study", 3, 20, 0, -6, -12, 20000], ["Defiers present", 25, 20, 10, -6, -12, 4000]].forEach(function (p) {
      V.button(pre, p[0], function () { sC.set(p[1]); sA.set(p[2]); sD.set(p[3]); sEC.set(p[4]); sEA.set(p[5]); sN.set(p[6]); draw(); });
    });

    V.legend(root, [
      { cls: "s2", label: "Always-takers" }, { cls: "s1", label: "Compliers" },
      { cls: "s5", label: "Never-takers" }, { cls: "s3", label: "Defiers" }
    ]);
    el("p", { class: "widget-note", style: "margin:0 0 0.4rem", text: "Filled dot = had catheterisation; hollow = did not. Each panel shows 200 typical patients." }, root);
    var pop = V.svg(root, 640, 196);
    pop.setAttribute("aria-label", "Two panels of 200 patients each, coloured by complier type, filled if they received the procedure. Left: lives near a catheterisation hospital. Right: lives far.");
    var hist = V.svg(root, 640, 230);
    hist.setAttribute("aria-label", "Histogram of Wald estimates across 400 simulated studies, with the true complier effect and the naive comparison marked");

    var out = V.readouts(root, [
      { key: "itt", label: "ITT: death risk, near minus far (this study)" },
      { key: "fs", label: "First stage: procedure rate, near minus far" },
      { key: "F", label: "First-stage F (this study)" },
      { key: "wald", label: "Wald = ITT ÷ first stage (this study)", cls: "good" },
      { key: "late", label: "True effect in compliers (LATE)" },
      { key: "naive", label: "Naive: treated minus untreated (this study)", cls: "bad" }
    ]);
    var note = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers. Instrument: living nearer a hospital that does cardiac catheterisation, assumed as-good-as-random. Baseline 1-year death risk: always-takers 10% (fitter, so chosen for the procedure), compliers 18%, never-takers 30%. Never-takers would gain 3 points and defiers nothing, but no study can see either." }, root);

    function binom(n, p, r) {
      if (n <= 0) return 0;
      p = Math.max(0, Math.min(1, p));
      var v = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * V.normal(r));
      return Math.max(0, Math.min(n, v));
    }

    function shares() {
      var c = sC.value(), a = sA.value(), d = sD.value(), tot = c + a + d;
      if (tot > 100) { c *= 100 / tot; a *= 100 / tot; d *= 100 / tot; }
      return { c: c / 100, a: a / 100, d: d / 100, n: Math.max(0, 1 - (c + a + d) / 100) };
    }

    // One simulated study. Returns ITT, FS, SEfs, Wald, naive.
    function study(r, sh, eff, n) {
      var arms = [];
      [1, 0].forEach(function (z) {
        var m = Math.round(n / 2), left = m, pLeft = 1, cnt = {};
        ["a", "c", "d", "n"].forEach(function (t, i) {
          if (i === 3) { cnt[t] = left; return; }
          var pr = pLeft > 0 ? sh[t] / pLeft : 0;
          cnt[t] = binom(left, pr, r); left -= cnt[t]; pLeft -= sh[t];
        });
        var treated = 0, deathsT = 0, deathsU = 0, untreated = 0;
        ["a", "c", "d", "n"].forEach(function (t) {
          var isT = t === "a" || (t === "c" && z === 1) || (t === "d" && z === 0);
          var p = BASE[t] + (isT ? eff[t] : 0), k = binom(cnt[t], Math.max(0.001, Math.min(0.999, p)), r);
          if (isT) { treated += cnt[t]; deathsT += k; } else { untreated += cnt[t]; deathsU += k; }
        });
        arms.push({ m: m, treated: treated, untreated: untreated, deathsT: deathsT, deathsU: deathsU });
      });
      var A1 = arms[0], A0 = arms[1];
      var y1 = (A1.deathsT + A1.deathsU) / A1.m, y0 = (A0.deathsT + A0.deathsU) / A0.m;
      var d1 = A1.treated / A1.m, d0 = A0.treated / A0.m;
      var fs = d1 - d0, se = Math.sqrt(d1 * (1 - d1) / A1.m + d0 * (1 - d0) / A0.m);
      var T = A1.treated + A0.treated, U = A1.untreated + A0.untreated;
      var naive = (T > 0 && U > 0) ? (A1.deathsT + A0.deathsT) / T - (A1.deathsU + A0.deathsU) / U : NaN;
      return { itt: y1 - y0, fs: fs, F: se > 0 ? (fs / se) * (fs / se) : 0, wald: (y1 - y0) / fs, naive: naive };
    }

    function drawPop(sh) {
      clear(pop);
      var counts = { a: Math.round(sh.a * 200), c: Math.round(sh.c * 200), d: Math.round(sh.d * 200) };
      counts.n = Math.max(0, 200 - counts.a - counts.c - counts.d);
      var order = [];
      ["a", "c", "d", "n"].forEach(function (t) { for (var i = 0; i < counts[t]; i++) order.push(t); });
      var cls = { a: "s2", c: "s1", n: "s5", d: "s3" };
      [[1, 12, "Lives near (Z = 1)"], [0, 332, "Lives far (Z = 0)"]].forEach(function (P) {
        var z = P[0], x0 = P[1];
        el("text", { x: x0 + 148, y: 14, "text-anchor": "middle", class: "viz-bold", text: P[2] }, pop);
        var nT = 0;
        order.forEach(function (t, i) {
          var col = i % 20, rowi = Math.floor(i / 20);
          var cx = x0 + 9 + col * 14.6, cy = 34 + rowi * 14.6;
          var isT = t === "a" || (t === "c" && z === 1) || (t === "d" && z === 0);
          if (isT) { nT++; el("circle", { cx: cx, cy: cy, r: 5.2, class: "dot " + cls[t] }, pop); }
          else el("circle", { cx: cx, cy: cy, r: 4.4, class: "stroke " + cls[t], style: "stroke-width:1.6" }, pop);
        });
        el("text", { x: x0 + 148, y: 190, "text-anchor": "middle", class: "viz-small viz-muted", text: "treated: " + Math.round(nT / 2) + "%" }, pop);
      });
    }

    function draw() {
      var sh = shares(), n = sN.value();
      var eff = { a: sEA.value() / 100, c: sEC.value() / 100, n: EFF_N, d: EFF_D };
      drawPop(sh);

      var r = stream(seed), res = [];
      for (var s = 0; s < STUDIES; s++) res.push(study(r, sh, eff, n));
      var first = res[0];
      var walds = res.map(function (o) { return o.wald * 100; }).filter(isFinite).sort(function (a, b) { return a - b; });
      var naiveMean = res.reduce(function (acc, o) { return acc + (isFinite(o.naive) ? o.naive : 0); }, 0) / STUDIES * 100;
      var late = eff.c * 100;
      var target = (sh.c - sh.d) !== 0 ? (sh.c * eff.c - sh.d * eff.d) / (sh.c - sh.d) * 100 : NaN;

      // histogram
      clear(hist);
      var LO = -40, HI = 30, BW = 2, nb = (HI - LO) / BW, bins = new Array(nb).fill(0), below = 0, above = 0;
      walds.forEach(function (w) {
        if (w < LO) below++; else if (w >= HI) above++; else bins[Math.floor((w - LO) / BW)]++;
      });
      var ymax = Math.max(10, Math.ceil(Math.max.apply(null, bins) * 1.15 / 10) * 10);
      var f = V.frame(hist, { x: [LO, HI], y: [0, ymax], fmtX: function (v) { return V.fmt.signed(v, 0); }, xLabel: "Wald estimate across 400 studies (percentage points of 1-year death risk)", yLabel: "Studies", margin: { top: 30, left: 52 } });
      var g = f.inner;
      bins.forEach(function (b, i) {
        if (!b) return;
        el("rect", { x: f.x(LO + i * BW) + 1, y: f.y(b), width: f.x(LO + BW) - f.x(LO) - 2, height: f.y(0) - f.y(b), class: "fill-soft s4" }, g);
      });
      function vline(v, cls, label, anchor, dy) {
        if (!(v >= LO && v <= HI)) return;
        el("line", { x1: f.x(v), x2: f.x(v), y1: f.y(0), y2: f.y(ymax), class: "stroke " + cls, style: "stroke-width:2" }, g);
        el("text", { x: f.x(v) + (anchor === "end" ? -5 : 5), y: f.y(ymax) + dy, "text-anchor": anchor, class: "viz-small viz-bold colour " + cls.replace(" dashed", ""), text: label }, g);
      }
      var lateLeft = late < naiveMean;
      vline(late, "s1", "complier effect " + V.fmt.signed(late, 0), lateLeft ? "end" : "start", 12);
      vline(naiveMean, "s3 dashed", "naive " + V.fmt.signed(naiveMean, 0), lateLeft ? "start" : "end", 12);
      if (sh.d > 0 && isFinite(target)) vline(target, "s2", "Wald target " + V.fmt.signed(target, 1), lateLeft ? "end" : "start", 28);
      el("text", { x: f.m.left + 4, y: 14, class: "viz-small viz-muted", text: below ? below + " studies below " + LO : "" }, hist);
      el("text", { x: 624, y: 14, "text-anchor": "end", class: "viz-small viz-muted", text: above ? above + " studies above +" + HI : "" }, hist);

      out.itt(V.fmt.signed(first.itt * 100, 1) + " pp");
      out.fs(V.fmt.signed(first.fs * 100, 1) + " pp");
      out.F(first.F >= 100 ? V.fmt.int(first.F) : first.F.toFixed(1));
      out.wald(isFinite(first.wald) ? V.fmt.signed(first.wald * 100, 1) + " pp" : "undefined");
      out.late(V.fmt.signed(late, 0) + " pp");
      out.naive(V.fmt.signed(first.naive * 100, 1) + " pp");
      var med = quantile(walds, 0.5);
      var rangeTxt = " Across 400 studies, the middle 80% of Wald estimates run from " + V.fmt.signed(quantile(walds, 0.1), 0) + " to " + V.fmt.signed(quantile(walds, 0.9), 0) + " pp; the median is " + V.fmt.signed(med, 1) + " pp.";
      var pulled = Math.abs(med - late) > 2 && Math.abs(med - naiveMean) < Math.abs(late - naiveMean);
      if (sh.d > 0) note.textContent = "Monotonicity fails: defiers take the procedure only when they live far. Wald now converges to " + V.fmt.signed(target, 1) + " pp, which is nobody’s effect." + rangeTxt;
      else if (first.F < 10) note.textContent = "Weak instrument (F below 10): the first stage is tiny, so small random wobbles in it swing the ratio wildly." + (pulled ? " The typical estimate is also pulled towards the confounded naive answer." : "") + rangeTxt;
      else if (first.F < 105 && sh.c < 0.1) note.textContent = "F is above 10, yet estimates still vary widely between studies: F above 10 limits bias, it does not make the usual 95% interval honest." + rangeTxt;
      else note.textContent = "Wald recovers the compliers’ effect, not the average over everyone. Always-takers’ death risk changes by " + V.fmt.signed(eff.a * 100, 0) + " pp, but the instrument never changes their treatment, so it cannot see them." + rangeTxt;
    }
    draw();
  });
})();
