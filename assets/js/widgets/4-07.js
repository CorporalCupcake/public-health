// Lecture 4.7 — Interrupted time series builder: segmented regression on a simulated series with
// AR(1) errors; naive OLS vs Newey–West intervals, and the "honest" SE you would get if φ were known.
// Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function sg(x, d) { d = d === undefined ? 1 : d; return V.fmt.signed(Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x, d); }

  function draws(seed, n) {
    var r = V.rng(seed), z = [];
    for (var i = 0; i < 200; i++) r();
    for (i = 0; i < n; i++) z.push(V.normal(r));
    return z;
  }
  // Solve A x = b (small dense, Gaussian elimination with pivoting); also inverse.
  function inv(A) {
    var n = A.length, M = A.map(function (r, i) { return r.concat(A.map(function (_, j) { return i === j ? 1 : 0; })); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      var d = M[c][c]; for (var k = 0; k < 2 * n; k++) M[c][k] /= d;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c]; for (k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (row) { return row.slice(n); });
  }
  function mm(A, B) { return A.map(function (r) { return B[0].map(function (_, j) { var s = 0; for (var k = 0; k < r.length; k++) s += r[k] * B[k][j]; return s; }); }); }
  function tr(A) { return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); }
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  function tq(df) { // 97.5% t quantile, Cornish–Fisher expansion
    var z = 1.959964, z3 = z * z * z, z5 = z3 * z * z, z7 = z5 * z * z;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df) + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df * df * df);
  }

  V.register("its-builder", function (root) {
    var NMAX = 60, seed = 470043, Z = draws(seed, 2 * NMAX);

    var ctr = V.controls(root);
    var sT = V.slider(ctr, { label: "Pre-intervention trend (per period)", min: -1, max: 1, step: 0.05, value: 0.3, fmt: function (v) { return sg(v, 2); }, onInput: draw });
    var sL = V.slider(ctr, { label: "True level change", min: -15, max: 10, step: 0.5, value: -6, fmt: function (v) { return sg(v, 1); }, onInput: draw });
    var sS = V.slider(ctr, { label: "True slope change (per period)", min: -1, max: 1, step: 0.05, value: 0, fmt: function (v) { return sg(v, 2); }, onInput: draw });
    var sN = V.slider(ctr, { label: "Noise (SD)", min: 0.5, max: 8, step: 0.5, value: 3, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sP = V.slider(ctr, { label: "Autocorrelation φ (lag 1)", min: 0, max: 0.9, step: 0.05, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sA = V.slider(ctr, { label: "Points before", min: 3, max: 60, step: 1, value: 24, onInput: draw });
    var sB = V.slider(ctr, { label: "Points after", min: 2, max: 60, step: 1, value: 24, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New random series", function () { seed += 2; Z = draws(seed, 2 * NMAX); draw(); });
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Monthly, 2 years each side", 0.3, -6, 0, 3, 0.5, 24, 24],
     ["Annual, FAOSTAT-like (7 before, 5 after)", 0.3, -3, 0, 1.5, 0.3, 7, 5],
     ["No effect, strong memory", 0.3, 0, 0, 3, 0.8, 24, 24]].forEach(function (p) {
      V.button(pre, p[0], function () { sT.set(p[1]); sL.set(p[2]); sS.set(p[3]); sN.set(p[4]); sP.set(p[5]); sA.set(p[6]); sB.set(p[7]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Observed" }, { cls: "s1", label: "Fitted segments" },
      { cls: "s2", label: "Counterfactual: pre-trend carried on", dashed: true }
    ]);
    var c = V.svg(root, 640, 320);
    c.setAttribute("aria-label", "A simulated time series with an intervention at time zero, fitted pre- and post-intervention segments, and the pre-intervention trend extended as a dashed counterfactual");
    var out = V.readouts(root, [
      { key: "lvN", label: "Level change ± naive 95% margin" },
      { key: "lvW", label: "Level change ± Newey–West 95% margin", cls: "good" },
      { key: "slN", label: "Slope change ± naive 95% margin" },
      { key: "slW", label: "Slope change ± Newey–West 95% margin", cls: "good" },
      { key: "cov", label: "Real coverage of the naive “95%” CI for the level change", cls: "bad" }
    ]);
    var note = el("p", { class: "widget-note" }, root);

    function draw() {
      var b1 = sT.value(), L = sL.value(), S = sS.value(), sd = sN.value(), phi = sP.value(), na = sA.value(), nb = sB.value();
      var n = na + nb, t = [], y = [], X = [], e = [], k = Math.sqrt(1 - phi * phi);
      for (var i = 0; i < n; i++) {
        var ti = i - na, post = ti >= 0 ? 1 : 0;
        e.push(i === 0 ? sd * Z[0] : phi * e[i - 1] + sd * k * Z[i]);
        t.push(ti); X.push([1, ti, post, post * ti]);
        y.push(50 + b1 * ti + L * post + S * post * ti + e[i]);
      }
      var XtX = mm(tr(X), X), XtXi = inv(XtX), Xty = mm(tr(X), y.map(function (v) { return [v]; }));
      var b = mm(XtXi, Xty).map(function (r) { return r[0]; });
      var res = y.map(function (v, i) { return v - (b[0] + b[1] * X[i][1] + b[2] * X[i][2] + b[3] * X[i][3]); });
      var df = n - 4, rss = 0; res.forEach(function (r) { rss += r * r; });
      var s2 = rss / df, seN = [Math.sqrt(s2 * XtXi[2][2]), Math.sqrt(s2 * XtXi[3][3])];
      // Newey–West with Bartlett kernel, lag by the usual rule of thumb
      var lag = Math.max(1, Math.floor(4 * Math.pow(n / 100, 2 / 9)));
      var Sm = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], a, bb;
      for (i = 0; i < n; i++) for (a = 0; a < 4; a++) for (bb = 0; bb < 4; bb++) Sm[a][bb] += res[i] * res[i] * X[i][a] * X[i][bb];
      for (var l = 1; l <= lag; l++) {
        var w = 1 - l / (lag + 1);
        for (i = l; i < n; i++) for (a = 0; a < 4; a++) for (bb = 0; bb < 4; bb++)
          Sm[a][bb] += w * res[i] * res[i - l] * (X[i][a] * X[i - l][bb] + X[i - l][a] * X[i][bb]);
      }
      var VW = mm(mm(XtXi, Sm), XtXi), seW = [Math.sqrt(Math.max(0, VW[2][2])), Math.sqrt(Math.max(0, VW[3][3]))];
      // honest (true-φ) sampling SE and the expected naive SE, for the level change
      var R = []; for (i = 0; i < n; i++) { R.push([]); for (var j = 0; j < n; j++) R[i].push(Math.pow(phi, Math.abs(i - j))); }
      var XtRX = mm(mm(tr(X), R), X), Vh = mm(mm(XtXi, XtRX), XtXi);
      var trH = 0, P = mm(XtXi, XtRX); for (a = 0; a < 4; a++) trH += P[a][a];
      var Es2 = sd * sd * (n - trH) / df;
      var seHon = sd * Math.sqrt(Vh[2][2]), seNaiveExp = Math.sqrt(Es2 * XtXi[2][2]);
      var q = tq(df), cov = erf(q * seNaiveExp / seHon / Math.SQRT2);

      // chart
      clear(c);
      var lo = Math.min.apply(null, y), hi = Math.max.apply(null, y);
      var cfEnd = b[0] + b[1] * (nb - 1); lo = Math.min(lo, cfEnd); hi = Math.max(hi, cfEnd);
      var pad = (hi - lo) * 0.12 + 1; lo -= pad; hi += pad;
      var f = V.frame(c, { x: [-na - 0.5, nb - 0.5], y: [lo, hi], xLabel: "Time (periods; 0 = first period after the intervention)", yLabel: "Outcome", fmtY: function (v) { return V.fmt.num(v, 0); } });
      var G = f.inner;
      el("rect", { x: f.x(-0.5), y: f.y(hi), width: f.x(nb - 0.5) - f.x(-0.5), height: f.y(lo) - f.y(hi), class: "fill-soft s5", opacity: 0.35 }, G);
      el("text", { x: f.x(-0.5) + 6, y: f.y(hi) + 14, class: "viz-small viz-muted", text: "after" }, G);
      var r = n > 60 ? 2.4 : 3.2;
      for (i = 0; i < n; i++) el("circle", { cx: f.x(t[i]), cy: f.y(y[i]), r: r, class: "dot s5" }, G);
      function fit(tt, p) { return b[0] + b[1] * tt + (p ? b[2] + b[3] * tt : 0); }
      el("path", { d: V.line([[f.x(-1), f.y(fit(-1, 0))], [f.x(nb - 1), f.y(fit(nb - 1, 0))]]), class: "stroke dashed s2", "stroke-width": 2 }, G);
      el("path", { d: V.line([[f.x(-na), f.y(fit(-na, 0))], [f.x(-1), f.y(fit(-1, 0))]]), class: "stroke s1" }, G);
      el("path", { d: V.line([[f.x(0), f.y(fit(0, 1))], [f.x(nb - 1), f.y(fit(nb - 1, 1))]]), class: "stroke s1" }, G);

      function ci(est, se, d) { return sg(est, d) + " ± " + (q * se).toFixed(d); }
      out.lvN(ci(b[2], seN[0], 1));
      out.lvW(ci(b[2], seW[0], 1));
      out.slN(ci(b[3], seN[1], 2));
      out.slW(ci(b[3], seW[1], 2));
      out.cov(Math.round(cov * 100) + "%");
      note.textContent = "Illustrative numbers. True level change " + sg(L, 1) + ", true slope change " + sg(S, 2) + ". Newey–West uses lag " + lag +
        ". If φ were known, the level change’s true SE would be " + (seHon / seNaiveExp).toFixed(1) + "× the naive one on average. With few points Newey–West cannot estimate the autocorrelation well and is still too narrow.";
    }
    draw();
  });
})();
