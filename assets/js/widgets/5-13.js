// Lecture 5.13 — Prediction models: a decision curve analysis explorer (net benefit vs threshold for a simulated
// model with adjustable discrimination and calibration) and an optimism demo (apparent vs bootstrap-corrected vs
// external performance as events per parameter change). Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  function logit(p) { return Math.log(p / (1 - p)); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // C-statistic by ranks (continuous scores, so ties are negligible).
  function cstat(score, y) {
    var n = score.length, idx = new Array(n), i;
    for (i = 0; i < n; i++) idx[i] = i;
    idx.sort(function (a, b) { return score[a] - score[b]; });
    var sumR = 0, n1 = 0;
    for (i = 0; i < n; i++) if (y[idx[i]]) { sumR += i + 1; n1++; }
    var n0 = n - n1;
    if (!n1 || !n0) return 0.5;
    return (sumR - n1 * (n1 + 1) / 2) / (n1 * n0);
  }

  // Logistic regression by Newton–Raphson with a tiny ridge for stability.
  // X: array of rows (first column 1), y: 0/1 array. Returns coefficient array.
  function fitLogit(X, y, rows) {
    var p = X[0].length, beta = new Float64Array(p), it, i, j, k;
    var n = rows ? rows.length : X.length;
    for (it = 0; it < 30; it++) {
      var g = new Float64Array(p), H = [];
      for (j = 0; j < p; j++) H.push(new Float64Array(p));
      for (var r = 0; r < n; r++) {
        var ii = rows ? rows[r] : r, x = X[ii], eta = 0;
        for (j = 0; j < p; j++) eta += x[j] * beta[j];
        eta = Math.max(-30, Math.min(30, eta));
        var mu = expit(eta), w = mu * (1 - mu), res = y[ii] - mu;
        for (j = 0; j < p; j++) {
          g[j] += x[j] * res;
          var wx = w * x[j];
          for (k = 0; k <= j; k++) H[j][k] += wx * x[k];
        }
      }
      for (j = 0; j < p; j++) {
        for (k = 0; k < j; k++) H[k][j] = H[j][k];
        if (j > 0) { H[j][j] += 0.01; g[j] -= 0.01 * beta[j]; }
        H[j][j] += 1e-9;
      }
      var d = solve(H, g), mx = 0;
      for (j = 0; j < p; j++) { var st = Math.max(-3, Math.min(3, d[j])); beta[j] += st; mx = Math.max(mx, Math.abs(st)); }
      if (mx < 1e-7) break;
    }
    return beta;
  }
  // Gaussian elimination with partial pivoting.
  function solve(A, b) {
    var n = b.length, M = [], i, j, k;
    for (i = 0; i < n; i++) { M.push(Array.prototype.slice.call(A[i])); M[i].push(b[i]); }
    for (i = 0; i < n; i++) {
      var piv = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
      var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
      var dv = M[i][i] || 1e-12;
      for (k = i + 1; k < n; k++) {
        var f = M[k][i] / dv;
        if (!f) continue;
        for (j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    var x = new Float64Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / (M[i][i] || 1e-12);
    }
    return x;
  }
  function linpred(X, beta) {
    return X.map(function (x) { var s = 0; for (var j = 0; j < beta.length; j++) s += x[j] * beta[j]; return s; });
  }
  // Calibration slope: logistic regression of y on the linear predictor.
  function calSlope(lp, y) {
    var X = lp.map(function (v) { return [1, v]; });
    return fitLogit(X, y)[1];
  }

  // ---------------------------------------------------------------------------
  // Decision curve analysis
  V.register("dca", function (root) {
    var N = 5000, MU = -2.7, SIG = 1.5;
    var r = stream(513013), z = [], e = [], y = [];
    for (var i = 0; i < N; i++) {
      var zi = V.normal(r), ei = V.normal(r), u = r();
      z.push(zi); e.push(ei); y.push(u < expit(MU + SIG * zi) ? 1 : 0);
    }
    var prev = y.reduce(function (a, b) { return a + b; }, 0) / N;

    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "Discrimination: how much of the true risk the model captures", min: 0.3, max: 1, step: 0.05, value: 0.8, fmt: function (v) { return "correlation " + v.toFixed(2); }, onInput: draw });
    var sB = V.slider(ctr, { label: "Calibration slope (below 1 = predictions too extreme)", min: 0.4, max: 1.6, step: 0.05, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sD = V.slider(ctr, { label: "Calibration-in-the-large (shift in predicted log-odds)", min: -1.5, max: 1.5, step: 0.1, value: 0, fmt: function (v) { return v === 0 ? "none" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(1) + (v > 0 ? " (too high)" : " (too low)"); }, onInput: draw });
    var sT = V.slider(ctr, { label: "Your threshold: refer for echo if predicted risk is at least", min: 2, max: 40, step: 1, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw });

    V.legend(root, [
      { cls: "s1", label: "Model as calibrated now" },
      { cls: "s4", label: "Same model, recalibrated", dashed: true },
      { cls: "s2", label: "Refer everyone" },
      { cls: "s5", label: "Refer no one", dashed: true }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Decision curves: net benefit against threshold probability for the model, the same model recalibrated, referring everyone and referring no one");
    var host = el("g", null, c);
    host.W = 640; host.H = 330;

    var out = V.readouts(root, [
      { key: "auc", label: "C-statistic (unchanged by calibration)" },
      { key: "mean", label: "Mean predicted risk vs observed" },
      { key: "nb", label: "Model: net true positives per 100 at your threshold" },
      { key: "cal", label: "Same model recalibrated: net true positives per 100" },
      { key: "all", label: "Refer everyone: net true positives per 100" },
      { key: "gain", label: "Model’s gain over the better default (refer all or none), per 100" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 5,000 simulated patients, about 12% with low ejection fraction. Net benefit counts true positives and subtracts false positives weighted by the threshold odds: at a 10% threshold, one true positive is worth nine false positives. A model is useful at a threshold only where its curve is above both default strategies." }, root);

    var aucCache = {};
    function scores(rho) {
      var k = Math.sqrt(1 - rho * rho), s = new Array(N);
      for (var i = 0; i < N; i++) s[i] = rho * z[i] + k * e[i];
      return s;
    }
    function nbCurve(p, ts) {
      return ts.map(function (t) {
        var tp = 0, fp = 0;
        for (var i = 0; i < N; i++) if (p[i] >= t) { if (y[i]) tp++; else fp++; }
        return (tp - fp * t / (1 - t)) / N;
      });
    }

    function draw() {
      var rho = sR.value(), b = sB.value(), d = sD.value(), T = sT.value() / 100;
      var s = scores(rho);
      var key = rho.toFixed(2);
      if (aucCache[key] === undefined) aucCache[key] = cstat(s, y);
      // Calibrated prediction given the score (probit approximation), then distort it.
      var v = SIG * SIG * (1 - rho * rho), cfac = 1 / Math.sqrt(1 + Math.PI * v / 8);
      var Lc = s.map(function (si) { return (MU + SIG * rho * si) * cfac; });
      var Lbar = Lc.reduce(function (a, x) { return a + x; }, 0) / N;
      var pCal = Lc.map(expit);
      var pMod = Lc.map(function (l) { return expit(Lbar + (l - Lbar) / b + d); });
      var meanP = pMod.reduce(function (a, x) { return a + x; }, 0) / N;

      var ts = [];
      for (var t = 0.01; t <= 0.4001; t += 0.005) ts.push(+t.toFixed(3));
      var nbM = nbCurve(pMod, ts), nbC = nbCurve(pCal, ts);
      var nbA = ts.map(function (t) { return prev - (1 - prev) * t / (1 - t); });

      clear(host);
      var YMIN = -0.04, YMAX = 0.14;
      var f = V.frame(host, { x: [0, 0.4], y: [YMIN, YMAX], xTicks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4], yTicks: [-0.04, 0, 0.04, 0.08, 0.12], fmtX: function (v) { return Math.round(v * 100) + "%"; }, fmtY: function (v) { return (v * 100).toFixed(0); }, xLabel: "Threshold probability for referral", yLabel: "Net benefit (per 100 patients)" });
      var g = f.inner;
      function path(vals, cls, style) {
        var pts = [], segs = [];
        ts.forEach(function (t, i) {
          if (vals[i] >= YMIN) pts.push([f.x(t), f.y(Math.min(YMAX, vals[i]))]);
          else if (pts.length) { segs.push(pts); pts = []; }
        });
        if (pts.length) segs.push(pts);
        segs.forEach(function (sg) { if (sg.length > 1) el("path", { d: V.line(sg), class: cls, style: style || "" }, g); });
      }
      el("line", { x1: f.x(T), x2: f.x(T), y1: f.y(YMIN), y2: f.y(YMAX), class: "edge", "stroke-dasharray": "3 4" }, g);
      el("line", { x1: f.x(0), x2: f.x(0.4), y1: f.y(0), y2: f.y(0), class: "stroke s5 dashed", style: "stroke-width:1.8" }, g);
      path(nbA, "stroke s2");
      path(nbC, "stroke s4 dashed", "stroke-width:2");
      path(nbM, "stroke s1", "stroke-width:3.2");
      el("text", { x: f.x(T) + 6, y: f.y(YMAX) + 12, class: "viz-small viz-muted", text: "threshold " + Math.round(T * 100) + "%" }, g);

      var i0 = Math.round((T - 0.01) / 0.005);
      i0 = Math.max(0, Math.min(ts.length - 1, i0));
      var m = nbM[i0], a = nbA[i0], mc = nbC[i0];
      el("circle", { cx: f.x(T), cy: f.y(Math.max(YMIN, Math.min(YMAX, m))), r: 5, class: "dot s1" }, g);

      out.auc(aucCache[key].toFixed(2));
      out.mean(V.fmt.pct1(meanP) + " vs " + V.fmt.pct1(prev));
      out.nb((m * 100).toFixed(1));
      out.cal((mc * 100).toFixed(1));
      out.all((a * 100).toFixed(1));
      out.gain(V.fmt.signed((m - Math.max(a, 0)) * 100, 1));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Optimism: apparent vs bootstrap-corrected vs external performance by events per parameter.
  V.register("optimism", function (root) {
    var P = 12, PREV = 0.25, B = 25, BETA = [0.8, 0.6, 0.5, 0.4], B0 = -1.37;
    var EPP = [2, 4, 6, 10, 15, 20, 30], NEXT = 5000;
    var resample = 0, results = [];

    function makeData(n, rand) {
      var X = [], y = [], lpTrue = [];
      for (var i = 0; i < n; i++) {
        var row = [1], lp = B0;
        for (var j = 0; j < P; j++) { var xv = V.normal(rand); row.push(xv); if (j < BETA.length) lp += BETA[j] * xv; }
        X.push(row); lpTrue.push(lp); y.push(rand() < expit(lp) ? 1 : 0);
      }
      return { X: X, y: y, lp: lpTrue };
    }
    var ext = makeData(NEXT, stream(5130001));
    var trueC = cstat(ext.lp, ext.y);

    var ctr = V.controls(root);
    var sE = V.slider(ctr, { label: "Events per candidate parameter (12 parameters: 4 real predictors, 8 pure noise)", min: 0, max: EPP.length - 1, step: 1, value: 1, fmt: function (v) { var k = EPP[v]; return k + " (≈" + V.fmt.int(k * P) + " events, n ≈ " + V.fmt.int(k * P / PREV) + ")"; }, onInput: draw });
    var mode = V.toggle(root, { options: [{ value: "c", label: "C-statistic" }, { value: "slope", label: "Calibration slope" }], value: "c", onChange: draw });
    var btnRow = el("div", { style: "margin:0.6rem 0" }, root);
    V.button(btnRow, "Draw a new development sample", function () { resample++; computeAll(); });

    V.legend(root, [
      { cls: "s3", label: "Apparent (judged on its own data)" },
      { cls: "s1", label: "Bootstrap optimism-corrected" },
      { cls: "s4", label: "External: 5,000 new patients, same population" },
      { cls: "s5", label: "True model", dashed: true }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Model performance against events per parameter: apparent, bootstrap-corrected and external");
    var host = el("g", null, c);
    host.W = 640; host.H = 300;
    var out = V.readouts(root, [
      { key: "app", label: "Apparent C-statistic" },
      { key: "cor", label: "Bootstrap-corrected C-statistic" },
      { key: "ext", label: "External C-statistic" },
      { key: "bs", label: "Bootstrap shrinkage factor (expected slope)" },
      { key: "es", label: "External calibration slope" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative simulation: logistic regression with all 12 candidate parameters, outcome in 25% of patients, 25 bootstrap resamples per point. The best any model can do with these predictors is a C-statistic of about " + trueC.toFixed(2) + " (dashed line)." }, root);

    function computePoint(ix) {
      var k = EPP[ix], n = Math.round(k * P / PREV);
      var rand = stream(51300 + 7919 * ix + 104729 * resample);
      var dev = makeData(n, rand);
      var beta = fitLogit(dev.X, dev.y);
      var lpDev = linpred(dev.X, beta);
      var app = cstat(lpDev, dev.y);
      var opt = 0, slopeSum = 0;
      for (var b = 0; b < B; b++) {
        var rows = [], yb = [], lpb = [];
        for (var i = 0; i < n; i++) rows.push(Math.floor(rand() * n));
        var bb = fitLogit(dev.X, dev.y, rows);
        var lpOrig = linpred(dev.X, bb);
        rows.forEach(function (rw) { lpb.push(lpOrig[rw]); yb.push(dev.y[rw]); });
        opt += cstat(lpb, yb) - cstat(lpOrig, dev.y);
        slopeSum += calSlope(lpOrig, dev.y);
      }
      var lpExt = linpred(ext.X, beta);
      return { app: app, cor: app - opt / B, ext: cstat(lpExt, ext.y), bs: slopeSum / B, es: calSlope(lpExt, ext.y) };
    }

    var token = 0;
    function computeAll() {
      var my = ++token; results = [];
      draw();
      var ix = 0;
      (function step() {
        if (my !== token) return;
        results[ix] = computePoint(ix);
        draw();
        ix++;
        if (ix < EPP.length) setTimeout(step, 0);
      })();
    }

    function draw() {
      var isC = mode.value() === "c", sel = sE.value();
      clear(host);
      var yr = isC ? [0.5, 1] : [0, 1.4];
      var f = V.frame(host, { x: [-0.4, EPP.length - 0.6], y: yr, xTicks: EPP.map(function (v, i) { return i; }), fmtX: function (i) { return EPP[i]; }, yTicks: isC ? [0.5, 0.6, 0.7, 0.8, 0.9, 1] : [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4], fmtY: function (v) { return v.toFixed(1); }, xLabel: "Events per candidate parameter", yLabel: isC ? "C-statistic" : "Calibration slope" });
      var g = f.inner;
      el("rect", { x: f.x(sel - 0.4), y: f.y(yr[1]), width: f.x(0.8) - f.x(0), height: f.y(yr[0]) - f.y(yr[1]), class: "fill-soft s5", style: "fill-opacity:0.15" }, g);
      var ref = isC ? trueC : 1;
      el("line", { x1: f.x(-0.4), x2: f.x(EPP.length - 0.6), y1: f.y(ref), y2: f.y(ref), class: "stroke s5 dashed", style: "stroke-width:1.8" }, g);
      if (!isC) el("text", { x: f.x(EPP.length - 0.6) - 4, y: f.y(ref) - 6, "text-anchor": "end", class: "viz-small viz-muted", text: "slope 1 = no overfitting" }, g);
      var series = isC ? [["app", "s3"], ["cor", "s1"], ["ext", "s4"]] : [["bs", "s1"], ["es", "s4"]];
      if (!isC) {
        el("line", { x1: f.x(-0.4), x2: f.x(EPP.length - 0.6), y1: f.y(0.9), y2: f.y(0.9), class: "edge", "stroke-dasharray": "2 4" }, g);
        el("text", { x: f.x(-0.4) + 4, y: f.y(0.9) + 14, class: "viz-small viz-muted", text: "0.9: Riley’s target shrinkage" }, g);
      }
      series.forEach(function (sr) {
        var pts = [];
        results.forEach(function (rs, i) { if (rs) pts.push([f.x(i), f.y(Math.max(yr[0], Math.min(yr[1], rs[sr[0]])))]); });
        if (pts.length > 1) el("path", { d: V.line(pts), class: "stroke " + sr[1] }, g);
        pts.forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 4, class: "dot " + sr[1] }, g); });
      });
      if (results.length < EPP.length) el("text", { x: f.x(EPP.length - 0.6) - 4, y: f.y(yr[0]) - 8, "text-anchor": "end", class: "viz-small viz-muted", text: "simulating…" }, g);

      var rs = results[sel];
      if (rs) {
        out.app(rs.app.toFixed(2)); out.cor(rs.cor.toFixed(2)); out.ext(rs.ext.toFixed(2));
        out.bs(rs.bs.toFixed(2)); out.es(rs.es.toFixed(2));
      } else { ["app", "cor", "ext", "bs", "es"].forEach(function (k) { out[k]("…"); }); }
    }
    computeAll();
  });
})();
