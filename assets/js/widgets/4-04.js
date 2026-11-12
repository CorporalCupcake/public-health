// Lecture 4.4 — Doubly robust estimation: a misspecification simulator.
// One confounder X with a curved (X²) effect on both treatment and outcome. Fit the outcome model and the
// propensity-score model either correctly (with X²) or wrongly (linear in X only), and compare regression
// (g-formula), IPW and AIPW over 100 simulated studies. Illustrative numbers; true effect = 1.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return r;
  }

  // Small dense linear solve (Gaussian elimination with partial pivoting).
  function solve(A, b) {
    var n = b.length, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (var r2 = c + 1; r2 < n; r2++) {
        var f = M[r2][c] / M[c][c];
        for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
      }
    }
    var x = new Array(n);
    for (var r3 = n - 1; r3 >= 0; r3--) {
      var s = M[r3][n];
      for (var k2 = r3 + 1; k2 < n; k2++) s -= M[r3][k2] * x[k2];
      x[r3] = s / M[r3][r3];
    }
    return x;
  }
  function zeros(p) { var a = []; for (var i = 0; i < p; i++) a.push(0); return a; }
  function zmat(p) { var a = []; for (var i = 0; i < p; i++) a.push(zeros(p)); return a; }
  function dot(u, v) { var s = 0; for (var i = 0; i < u.length; i++) s += u[i] * v[i]; return s; }

  function ols(rows, y) {
    var p = rows[0].length, A = zmat(p), b = zeros(p);
    for (var n = 0; n < y.length; n++) {
      var x = rows[n];
      for (var i = 0; i < p; i++) { b[i] += x[i] * y[n]; for (var j = 0; j < p; j++) A[i][j] += x[i] * x[j]; }
    }
    return solve(A, b);
  }
  function logistic(rows, a) {
    var p = rows[0].length, beta = zeros(p);
    for (var it = 0; it < 25; it++) {
      var H = zmat(p), g = zeros(p);
      for (var n = 0; n < a.length; n++) {
        var x = rows[n], m = 1 / (1 + Math.exp(-dot(x, beta))), w = m * (1 - m);
        for (var i = 0; i < p; i++) { g[i] += x[i] * (a[n] - m); for (var j = 0; j < p; j++) H[i][j] += w * x[i] * x[j]; }
      }
      var d = solve(H, g), mx = 0;
      for (var i2 = 0; i2 < p; i2++) { beta[i2] += d[i2]; mx = Math.max(mx, Math.abs(d[i2])); }
      if (mx < 1e-8) break;
    }
    return beta;
  }

  // One simulated study → [regression, IPW, AIPW]
  function study(r, n, curve, outOK, psOK) {
    var TAU = 1, X = [], A = [], Y = [];
    for (var i = 0; i < n; i++) {
      var x = -2 + 4 * r(), q = x * x - 4 / 3;            // centred X² (mean 0 on Uniform(−2, 2))
      var e = 1 / (1 + Math.exp(-(-0.3 + 0.4 * x + 0.9 * curve * q)));
      var a = r() < e ? 1 : 0;
      X.push(x); A.push(a); Y.push(TAU * a + 0.8 * x + 1.6 * curve * q + V.normal(r));
    }
    var fo = function (x, a) { return outOK ? [1, a, x, x * x] : [1, a, x]; };
    var fp = function (x) { return psOK ? [1, x, x * x] : [1, x]; };
    var bo = ols(X.map(function (x, i) { return fo(x, A[i]); }), Y);
    var bp = logistic(X.map(fp), A);
    var reg = 0, s1 = 0, w1 = 0, s0 = 0, w0 = 0, dr = 0;
    for (var k = 0; k < n; k++) {
      var m1 = dot(bo, fo(X[k], 1)), m0 = dot(bo, fo(X[k], 0));
      var ps = 1 / (1 + Math.exp(-dot(bp, fp(X[k]))));
      reg += m1 - m0;
      if (A[k]) { s1 += Y[k] / ps; w1 += 1 / ps; } else { s0 += Y[k] / (1 - ps); w0 += 1 / (1 - ps); }
      dr += m1 - m0 + A[k] * (Y[k] - m1) / ps - (1 - A[k]) * (Y[k] - m0) / (1 - ps);
    }
    return [reg / n, s1 / w1 - s0 / w0, dr / n];
  }

  V.register("dr-misspec", function (root) {
    var REPS = 100, seed = 4040001;
    var outOK = true, psOK = false, n = 800;

    var ctr = V.controls(root);
    var g1 = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
    el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Outcome model (correct = includes X²)" }, g1);
    V.toggle(g1, { options: [{ value: true, label: "Correct" }, { value: false, label: "Wrong" }], value: outOK, onChange: function (v) { outOK = v; run(); } });
    var g2 = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
    el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Propensity-score model (correct = includes X²)" }, g2);
    V.toggle(g2, { options: [{ value: true, label: "Correct" }, { value: false, label: "Wrong" }], value: psOK, onChange: function (v) { psOK = v; run(); } });
    var sCurve = V.slider(ctr, { label: "How curved the confounder’s effect is", min: 0, max: 1, step: 0.25, value: 1, fmt: function (v) { return v === 0 ? "straight line" : v === 1 ? "strongly curved" : v.toFixed(2); }, onInput: run });
    var g3 = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
    el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Patients per study" }, g3);
    V.toggle(g3, { options: [{ value: 200, label: "200" }, { value: 800, label: "800" }, { value: 3200, label: "3,200" }], value: n, onChange: function (v) { n = v; run(); } });

    var bar = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.6rem" }, root);
    V.button(bar, "New set of 100 studies", function () { seed += 7919 * 2; run(); });

    V.legend(root, [{ cls: "s5", label: "One simulated study" }, { cls: "s3", label: "Average over 100 studies" }, { cls: "s1", label: "True effect (1.0)", dashed: true }]);
    var c = V.svg(root, 640, 250);
    c.setAttribute("aria-label", "Dot plot of estimates from 100 simulated studies for regression, IPW and AIPW, with the true effect marked");

    var out = V.readouts(root, [
      { key: "reg", label: "Regression (g-formula): average bias" },
      { key: "ipw", label: "IPW: average bias" },
      { key: "dr", label: "AIPW (doubly robust): average bias" }
    ]);
    var boxes = root.querySelectorAll(".widget-readout");
    var msg = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each study: X uniform on −2 to 2; treatment and outcome both depend on X and X². “Wrong” models leave out X². Bias = average estimate − 1. Spread = how far single studies scatter." }, root);

    function run() {
      var r = stream(seed), curve = sCurve.value(), res = [];
      for (var k = 0; k < REPS; k++) res.push(study(r, n, curve, outOK, psOK));
      draw(res);
    }

    function draw(res) {
      clear(c);
      var lo = -0.5, hi = 3.5;
      var f = V.frame(c, { x: [lo, hi], y: [0, 3], yTicks: [], xTicks: [-0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], margin: { left: 150, right: 20, top: 10, bottom: 42 }, xLabel: "Estimated effect of treatment (truth = 1)", fmtX: function (v) { return v.toFixed(1); } });
      var g = f.inner, names = ["Regression", "IPW", "AIPW"], subs = ["outcome model only", "PS model only", "both models"];
      el("line", { x1: f.x(1), x2: f.x(1), y1: f.y(3), y2: f.y(0), class: "stroke s1 dashed", "stroke-width": 2 }, g);
      var jr = stream(99991);
      var stats = [];
      for (var m = 0; m < 3; m++) {
        var yc = f.y(2.5 - m), vals = res.map(function (x) { return x[m]; });
        var mean = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
        var sd = Math.sqrt(vals.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (vals.length - 1));
        stats.push([mean, sd]);
        el("text", { x: 140, y: yc - 4, "text-anchor": "end", class: "viz-bold", text: names[m] }, c);
        el("text", { x: 140, y: yc + 13, "text-anchor": "end", class: "viz-small viz-muted", text: subs[m] }, c);
        vals.forEach(function (v) {
          var vx = Math.max(lo, Math.min(hi, v));
          el("circle", { cx: f.x(vx), cy: yc + (jr() - 0.5) * 30, r: 2.6, class: "dot s5", "fill-opacity": 0.6 }, g);
        });
        var mx = f.x(Math.max(lo, Math.min(hi, mean)));
        el("line", { x1: mx, x2: mx, y1: yc - 24, y2: yc + 24, class: "stroke s3", "stroke-width": 3.5 }, g);
      }
      var bias = stats.map(function (s) { return s[0] - 1; });
      ["reg", "ipw", "dr"].forEach(function (k, i) {
        out[k](V.fmt.signed(bias[i], 2) + "  (spread " + stats[i][1].toFixed(2) + ")");
        var bad = Math.abs(bias[i]) > 0.15;
        boxes[i].classList.toggle("bad", bad);
        boxes[i].classList.toggle("good", !bad);
      });
      var t;
      if (sCurve.value() === 0) t = "The confounder’s effect is a straight line, so the “wrong” models are not actually wrong: every method is close to the truth.";
      else if (outOK && psOK) t = "Both models right: all three are unbiased. AIPW is about as precise as regression and tighter than IPW.";
      else if (outOK) t = "PS model wrong: IPW is biased, but AIPW is rescued by the correct outcome model. First chance used.";
      else if (psOK) t = "Outcome model wrong: regression is biased, but AIPW is rescued by the correct PS model. Second chance used.";
      else t = "Both models wrong: AIPW has no chance left and is as biased as the others. Double robustness is not a licence to be careless.";
      msg.textContent = t;
    }
    run();
  });
})();
