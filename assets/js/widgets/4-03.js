// Lecture 4.3 — Inverse probability weighting and the g-formula.
// Widgets: ipw-pseudo (a two-stratum pseudo-population) and weight-diagnostics
// (propensity model, weights, truncation and balance). Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }
  function toggleRow(parent, label, opts, value, onChange) {
    var tw = el("div", {}, parent);
    el("div", { class: "widget-slider-label", style: "font-size:0.88rem;margin-bottom:0.3rem", text: label }, tw);
    return V.toggle(tw, { options: opts, value: value, onChange: onChange });
  }
  function pts(x) { return V.fmt.signed(x * 100, 1) + " pts"; }

  // ---------------------------------------------------------------------------
  // Pseudo-population: two severity strata, expected counts.
  V.register("ipw-pseudo", function (root) {
    var NL = 600, NH = 400, rL = 0.10, rH = 0.40;

    var ctr = V.controls(root);
    var sPL = V.slider(ctr, { label: "Chance of treatment, low severity", min: 0.05, max: 0.95, step: 0.05, value: 0.2, fmt: V.fmt.pct, onInput: draw });
    var sPH = V.slider(ctr, { label: "Chance of treatment, high severity", min: 0.05, max: 0.95, step: 0.05, value: 0.7, fmt: V.fmt.pct, onInput: draw });
    var sD = V.slider(ctr, { label: "True effect of treatment on risk of death", min: -0.1, max: 0.1, step: 0.01, value: -0.05, fmt: function (v) { return V.fmt.signed(v * 100, 0) + " pts"; }, onInput: draw });
    var stab = false;
    toggleRow(ctr, "Weights", [{ value: false, label: "Unstabilised" }, { value: true, label: "Stabilised" }], false, function (v) { stab = v; draw(); });

    V.legend(root, [
      { cls: "s5", label: "Untreated" }, { cls: "s1", label: "Treated" }
    ]);
    var c = V.svg(root, 640, 290);
    c.setAttribute("aria-label", "Two bar charts side by side. Left: observed numbers of untreated and treated patients in the low- and high-severity strata. Right: the same cells after inverse probability weighting, with the weight shown above each bar.");

    var out = V.readouts(root, [
      { key: "crude", label: "Crude risk difference (treated − untreated)", cls: "bad" },
      { key: "ipw", label: "IPW risk difference", cls: "good" },
      { key: "std", label: "Standardised (g-formula) risk difference" },
      { key: "truth", label: "True average effect" },
      { key: "share", label: "High severity among treated: observed → weighted" },
      { key: "sum", label: "Size of pseudo-population · largest weight" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 1,000 patients: 600 low severity (10% die untreated) and 400 high severity (40% die untreated); treatment shifts everyone’s risk by the same amount. The brighter lower part of each bar is deaths. Bars show expected counts, so with this simple, saturated set-up IPW and standardisation agree exactly. Stabilising shrinks the pseudo-population back to 1,000 but does not change the estimate." }, root);

    function draw() {
      var pL = sPL.value(), pH = sPH.value(), d = sD.value();
      var pA = (NL * pL + NH * pH) / (NL + NH);
      // cells: [label, stratum size, P(A=a|L), risk, arm]
      var cells = [
        ["Low", NL, 1 - pL, rL, 0], ["Low", NL, pL, rL + d, 1],
        ["High", NH, 1 - pH, rH, 0], ["High", NH, pH, rH + d, 1]
      ];
      var obs = [], wts = [], pse = [];
      cells.forEach(function (k) {
        var n = k[1] * k[2];
        var w = (stab ? (k[4] ? pA : 1 - pA) : 1) / k[2];
        obs.push(n); wts.push(w); pse.push(n * w);
      });

      // estimates
      var nT = obs[1] + obs[3], nU = obs[0] + obs[2];
      var crude = (obs[1] * cells[1][3] + obs[3] * cells[3][3]) / nT - (obs[0] * cells[0][3] + obs[2] * cells[2][3]) / nU;
      var wT = pse[1] + pse[3], wU = pse[0] + pse[2];
      var ipw = (pse[1] * cells[1][3] + pse[3] * cells[3][3]) / wT - (pse[0] * cells[0][3] + pse[2] * cells[2][3]) / wU;
      var std = (NL * (rL + d) + NH * (rH + d)) / (NL + NH) - (NL * rL + NH * rH) / (NL + NH);

      clear(c);
      var M = Math.max.apply(null, obs.concat(pse));
      M = Math.ceil(M * 1.15 / 100) * 100;
      var panels = [["Observed", obs, 52, 316], ["Pseudo-population (weighted)", pse, 360, 624]];
      var y = V.scale(0, M, 240, 34);
      // y axis on the left panel
      V.ticks(0, M, 5).forEach(function (t) {
        el("line", { x1: 52, x2: 624, y1: y(t), y2: y(t), class: "viz-grid" }, c);
        el("text", { x: 44, y: y(t), class: "viz-tick", "text-anchor": "end", "dominant-baseline": "middle", text: V.fmt.int(t) }, c);
      });
      el("text", { x: 12, y: 137, class: "viz-label", "text-anchor": "middle", transform: "rotate(-90 12 137)", text: "Patients" }, c);
      panels.forEach(function (P, pi) {
        var x0 = P[2], x1 = P[3], bw = (x1 - x0) / 4;
        el("line", { x1: x0, x2: x1, y1: y(0), y2: y(0), class: "viz-axis" }, c);
        el("text", { x: (x0 + x1) / 2, y: 18, "text-anchor": "middle", class: "viz-bold", text: P[0] }, c);
        for (var j = 0; j < 4; j++) {
          var n = P[1][j], risk = cells[j][3], cls = cells[j][4] ? "s1" : "s5";
          var bx = x0 + j * bw + bw * 0.14, bwid = bw * 0.72;
          el("rect", { x: bx, y: y(n), width: bwid, height: y(0) - y(n), class: "fill-soft " + cls }, c);
          el("rect", { x: bx, y: y(n * risk), width: bwid, height: y(0) - y(n * risk), class: "fill " + cls }, c);
          el("text", { x: bx + bwid / 2, y: y(n) - 5, "text-anchor": "middle", class: "viz-small", text: pi ? "×" + V.fmt.num(wts[j], 2) : V.fmt.int(n) }, c);
          el("text", { x: bx + bwid / 2, y: 256, "text-anchor": "middle", class: "viz-tick", text: cells[j][4] ? "treated" : "untreated" }, c);
        }
        el("text", { x: x0 + bw, y: 276, "text-anchor": "middle", class: "viz-small viz-muted", text: "low severity" }, c);
        el("text", { x: x0 + 3 * bw, y: 276, "text-anchor": "middle", class: "viz-small viz-muted", text: "high severity" }, c);
      });

      out.crude(pts(crude)); out.ipw(pts(ipw)); out.std(pts(std)); out.truth(pts(d));
      out.share(V.fmt.pct(obs[3] / nT) + " → " + V.fmt.pct(pse[3] / wT) + " (all: 40%)");
      out.sum(V.fmt.int(wT + wU) + " · " + V.fmt.num(Math.max.apply(null, wts), 1));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Weight diagnostics with a propensity model fitted in the browser.
  function solve(A, b) { // Gaussian elimination with partial pivoting
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
    for (var i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (var j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }
  function logistic(X, y) { // IRLS
    var n = y.length, p = X[0].length, beta = [];
    for (var j = 0; j < p; j++) beta.push(0);
    for (var it = 0; it < 25; it++) {
      var H = [], g = [];
      for (var a = 0; a < p; a++) { g.push(0); H.push(new Array(p).fill(0)); }
      for (var i = 0; i < n; i++) {
        var eta = 0, xi = X[i];
        for (var j2 = 0; j2 < p; j2++) eta += xi[j2] * beta[j2];
        var mu = expit(eta), w = mu * (1 - mu), res = y[i] - mu;
        for (var a2 = 0; a2 < p; a2++) {
          g[a2] += xi[a2] * res;
          for (var b2 = a2; b2 < p; b2++) H[a2][b2] += w * xi[a2] * xi[b2];
        }
      }
      for (var a3 = 0; a3 < p; a3++) { H[a3][a3] += 1e-8; for (var b3 = 0; b3 < a3; b3++) H[a3][b3] = H[b3][a3]; }
      var step = solve(H, g), mx = 0;
      for (var j3 = 0; j3 < p; j3++) { beta[j3] += step[j3]; mx = Math.max(mx, Math.abs(step[j3])); }
      if (mx < 1e-7) break;
    }
    return beta;
  }

  V.register("weight-diagnostics", function (root) {
    var N = 2000, r = stream(43031);
    var names = ["Age", "SOFA", "SOFA²", "Bleeding risk", "Creatinine", "Female"];
    var Z = [], U = [], R0 = [], R1 = [];
    for (var i = 0; i < N; i++) {
      var age = Math.min(95, Math.max(18, 65 + 13 * V.normal(r)));
      var sofa = Math.min(18, Math.max(0, Math.round(7 + 3 * V.normal(r))));
      var bleed = Math.min(6, Math.max(0, Math.round(2 + 1.2 * V.normal(r))));
      var creat = Math.exp(Math.log(1.1) + 0.45 * V.normal(r));
      var fem = r() < 0.42 ? 1 : 0;
      var zs = (sofa - 7) / 3.5;
      Z.push([(age - 65) / 13, zs, zs * zs, (bleed - 2) / 1.2, (creat - 1.15) / 0.55, fem]);
      U.push(r());
      var lp = -1.6 + 0.45 * Z[i][0] + 0.35 * zs + 0.4 * zs * zs + 0.2 * Z[i][3] + 0.3 * Z[i][4] - 0.1 * fem;
      R0.push(expit(lp)); R1.push(expit(lp - 0.4));
    }
    var trueATE = 0;
    for (var i2 = 0; i2 < N; i2++) trueATE += (R1[i2] - R0[i2]) / N;

    var ctr = V.controls(root);
    var sS = V.slider(ctr, { label: "How strongly covariates drive treatment", min: 0.5, max: 2.5, step: 0.25, value: 1, fmt: function (v) { return "×" + v.toFixed(2); }, onInput: draw });
    var model = "main", trunc = 1;
    toggleRow(ctr, "Propensity model", [{ value: "main", label: "Main terms" }, { value: "sq", label: "Main terms + SOFA²" }], "main", function (v) { model = v; draw(); });
    toggleRow(ctr, "Truncate weights at percentile", [{ value: 1, label: "None" }, { value: 0.99, label: "99th" }, { value: 0.95, label: "95th" }], 1, function (v) { trunc = v; draw(); });

    V.legend(root, [
      { cls: "s5", label: "|SMD| before weighting" }, { cls: "s1", label: "|SMD| after weighting" },
      { cls: "s3", label: "0.1 threshold", dashed: true }
    ]);
    var c = V.svg(root, 640, 250);
    c.setAttribute("aria-label", "Love plot: absolute standardised mean difference for six covariates before and after weighting, with a dashed line at 0.1");

    var out = V.readouts(root, [
      { key: "bal", label: "Largest |SMD| after weighting" },
      { key: "mw", label: "Largest stabilised weight · mean weight" },
      { key: "ess", label: "Effective sample size: treated · untreated" },
      { key: "est", label: "IPW risk difference", cls: "good" },
      { key: "crude", label: "Crude risk difference", cls: "bad" },
      { key: "truth", label: "True average effect" }
    ]);
    var boxes = root.querySelector(".widget-readouts").children;
    el("p", { class: "widget-note", text: "Illustrative numbers. 2,000 simulated ICU patients. Clinicians are least likely to anticoagulate at very low and very high SOFA, and SOFA raises the risk of death along a curve, so SOFA² is a confounder. The propensity model is a logistic regression fitted in your browser; risk differences use each patient’s true risk to remove outcome noise, so remaining gaps are bias from the weights." }, root);

    function draw() {
      var s = sS.value(), A = [], nT = 0;
      for (var i = 0; i < N; i++) {
        var z = Z[i];
        var lp = -0.1 + s * (0.25 * z[0] + 0.1 * z[1] - 0.5 * z[2] - 0.5 * z[3] - 0.3 * z[4] + 0.15 * z[5]);
        A.push(U[i] < expit(lp) ? 1 : 0); nT += A[i];
      }
      var X = Z.map(function (z) { return model === "sq" ? [1, z[0], z[1], z[2], z[3], z[4], z[5]] : [1, z[0], z[1], z[3], z[4], z[5]]; });
      var beta = logistic(X, A), pA = nT / N, W = [];
      for (var i2 = 0; i2 < N; i2++) {
        var eta = 0;
        for (var j = 0; j < beta.length; j++) eta += X[i2][j] * beta[j];
        var e = Math.min(1 - 1e-6, Math.max(1e-6, expit(eta)));
        W.push(A[i2] ? pA / e : (1 - pA) / (1 - e));
      }
      if (trunc < 1) {
        var sorted = W.slice().sort(function (a, b) { return a - b; });
        var cap = sorted[Math.floor(trunc * (N - 1))];
        W = W.map(function (w) { return Math.min(w, cap); });
      }

      // SMDs before and after; denominator = unweighted pooled SD
      var before = [], after = [];
      for (var k = 0; k < 6; k++) {
        var m = [[0, 0, 0, 0], [0, 0, 0, 0]]; // per arm: n, sum, sumsq, (unused)
        var wm = [[0, 0], [0, 0]];
        for (var i3 = 0; i3 < N; i3++) {
          var a = A[i3], v = Z[i3][k];
          m[a][0]++; m[a][1] += v; m[a][2] += v * v;
          wm[a][0] += W[i3]; wm[a][1] += W[i3] * v;
        }
        var mu1 = m[1][1] / m[1][0], mu0 = m[0][1] / m[0][0];
        var v1 = m[1][2] / m[1][0] - mu1 * mu1, v0 = m[0][2] / m[0][0] - mu0 * mu0;
        var sd = Math.sqrt((v1 + v0) / 2) || 1;
        before.push(Math.abs(mu1 - mu0) / sd);
        after.push(Math.abs(wm[1][1] / wm[1][0] - wm[0][1] / wm[0][0]) / sd);
      }

      // effect estimates
      var s1 = 0, s0 = 0, w1 = 0, w0 = 0, q1 = 0, q0 = 0, c1 = 0, c0 = 0, n1 = 0, n0 = 0, mw = 0, sw = 0;
      for (var i4 = 0; i4 < N; i4++) {
        var w = W[i4]; sw += w; if (w > mw) mw = w;
        if (A[i4]) { s1 += w * R1[i4]; w1 += w; q1 += w * w; c1 += R1[i4]; n1++; }
        else { s0 += w * R0[i4]; w0 += w; q0 += w * w; c0 += R0[i4]; n0++; }
      }
      var ipw = s1 / w1 - s0 / w0, crude = c1 / n1 - c0 / n0;

      // Love plot
      clear(c);
      var xmax = Math.max(0.5, Math.ceil(Math.max.apply(null, before.concat(after)) * 10 + 0.5) / 10);
      var f = V.frame(c, { x: [0, xmax], y: [0, 6], yTicks: [], fmtX: function (t) { return t.toFixed(1); }, margin: { top: 10, bottom: 42, left: 112, right: 20 }, xLabel: "Absolute standardised mean difference (treated vs untreated)" });
      var g = f.inner;
      el("line", { x1: f.x(0.1), x2: f.x(0.1), y1: f.y(0), y2: f.y(6), class: "stroke dashed s3", "stroke-width": 1.8 }, g);
      for (var k2 = 0; k2 < 6; k2++) {
        var yy = f.y(5.5 - k2);
        el("line", { x1: f.x(0), x2: f.x(xmax), y1: yy, y2: yy, class: "viz-grid" }, g);
        el("text", { x: f.m.left - 8, y: yy, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-tick", text: names[k2] }, g);
        el("line", { x1: f.x(before[k2]), x2: f.x(after[k2]), y1: yy, y2: yy, class: "stroke s5", "stroke-width": 1, opacity: 0.6 }, g);
        el("circle", { cx: f.x(before[k2]), cy: yy, r: 5.5, class: "stroke s5", fill: "none", "stroke-width": 2 }, g);
        el("circle", { cx: f.x(after[k2]), cy: yy, r: 5.5, class: "fill s1" }, g);
      }

      var maxA = Math.max.apply(null, after);
      out.bal(maxA.toFixed(2) + " (" + names[after.indexOf(maxA)] + ")");
      out.mw(V.fmt.num(mw, 1) + " · " + V.fmt.num(sw / N, 2));
      out.ess(V.fmt.pct(w1 * w1 / q1 / n1) + " · " + V.fmt.pct(w0 * w0 / q0 / n0) + " of real size");
      out.est(pts(ipw)); out.crude(pts(crude)); out.truth(pts(trueATE));
      boxes[0].classList.toggle("good", maxA < 0.1);
      boxes[0].classList.toggle("bad", maxA >= 0.1);
    }
    draw();
  });
})();
