// Lecture 5.16 — a drift monitor with CUSUM and recalibration, and a feedback-loop demo. Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function expit(z) { return 1 / (1 + Math.exp(-z)); }
  function logit(p) { return Math.log(p / (1 - p)); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 300; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // AUC by ranks (Mann–Whitney), ties averaged.
  function auc(p, y) {
    var idx = p.map(function (v, i) { return i; }).sort(function (a, b) { return p[a] - p[b]; });
    var rank = new Array(p.length), i = 0;
    while (i < idx.length) {
      var j = i; while (j + 1 < idx.length && p[idx[j + 1]] === p[idx[i]]) j++;
      for (var k = i; k <= j; k++) rank[idx[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    var n1 = 0, s = 0;
    for (var m = 0; m < y.length; m++) if (y[m]) { n1++; s += rank[m]; }
    var n0 = y.length - n1;
    return n1 && n0 ? (s - n1 * (n1 + 1) / 2) / (n1 * n0) : NaN;
  }

  // Logistic regression by Newton–Raphson with case weights. X rows include the intercept column.
  function logistic(X, y, w) {
    var p = X[0].length, b = []; for (var j = 0; j < p; j++) b.push(0);
    for (var it = 0; it < 50; it++) {
      var g = [], H = [];
      for (var a = 0; a < p; a++) { g.push(0); H.push([]); for (var c = 0; c < p; c++) H[a].push(0); }
      for (var r = 0; r < X.length; r++) {
        var eta = 0; for (var q = 0; q < p; q++) eta += X[r][q] * b[q];
        var mu = expit(eta), wr = w ? w[r] : 1, v = wr * mu * (1 - mu);
        for (a = 0; a < p; a++) { g[a] += wr * (y[r] - mu) * X[r][a]; for (c = 0; c < p; c++) H[a][c] += v * X[r][a] * X[r][c]; }
      }
      var step = solve(H, g), mx = 0;
      for (a = 0; a < p; a++) { b[a] += step[a]; mx = Math.max(mx, Math.abs(step[a])); }
      if (mx < 1e-8) break;
    }
    return b;
  }
  function solve(A, bv) {
    var n = bv.length, M = A.map(function (row, i) { return row.concat([bv[i]]); });
    for (var i = 0; i < n; i++) {
      var piv = i; for (var r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      var t = M[i]; M[i] = M[piv]; M[piv] = t;
      for (r = 0; r < n; r++) if (r !== i) { var f = M[r][i] / M[i][i]; for (var c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
    }
    return M.map(function (row, i) { return row[n] / row[i]; });
  }

  // ---------------------------------------------------------------------------
  // Drift monitor. True risk logit = a + b·x. The deployed model is the true model at go-live.
  // After month T0: covariate shift (x sicker and more alike), prevalence shift (intercept), concept drift (b weakens).
  V.register("drift-monitor", function (root) {
    var M = 36, N = 600, A0 = -2.4, B0 = 1.1, K = 0.5, H = 5;
    var Zx = [], Uy = [];
    (function () {
      var r = stream(516017);
      for (var m = 0; m < M; m++) { var zx = [], uy = []; for (var i = 0; i < N; i++) { zx.push(V.normal(r)); uy.push(r()); } Zx.push(zx); Uy.push(uy); }
    })();
    var recal = false;

    var ctr = V.controls(root);
    var sT = V.slider(ctr, { label: "Drift starts in month", min: 6, max: 30, step: 1, value: 18, onInput: function () { recal = false; draw(); } });
    var sCov = V.slider(ctr, { label: "Covariate shift: sicker, more similar patients", min: 0, max: 100, step: 5, value: 0, fmt: function (v) { return v + "%"; }, onInput: function () { recal = false; draw(); } });
    var sPrev = V.slider(ctr, { label: "Prevalence shift: baseline odds ×", min: 0.5, max: 2, step: 0.05, value: 1.5, fmt: function (v) { return v.toFixed(2); }, onInput: function () { recal = false; draw(); } });
    var sCon = V.slider(ctr, { label: "Concept drift: risk factor matters less", min: 0, max: 70, step: 5, value: 0, fmt: function (v) { return v + "%"; }, onInput: function () { recal = false; draw(); } });

    var bar = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    var bRecal = V.button(bar, "Recalibrate after the alarm", function () { recal = !recal; draw(); });
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, bar);
    [["Prevalence shift", 0, 1.5, 0], ["Covariate shift", 80, 1, 0], ["Concept drift", 0, 1, 60], ["No drift", 0, 1, 0]].forEach(function (p) {
      V.button(bar, p[0], function () { sCov.set(p[1]); sPrev.set(p[2]); sCon.set(p[3]); recal = false; draw(); });
    });

    V.legend(root, [{ cls: "s1", label: "Observed event rate" }, { cls: "s2", label: "Mean predicted risk", dashed: true }]);
    var c1 = V.svg(root, 640, 190); c1.setAttribute("aria-label", "Monthly observed event rate and mean predicted risk");
    V.legend(root, [{ cls: "s4", label: "Monthly AUC" }]);
    var c2 = V.svg(root, 640, 170); c2.setAttribute("aria-label", "Monthly AUC of the deployed model");
    V.legend(root, [{ cls: "s3", label: "CUSUM: more events than predicted" }, { cls: "s4", label: "CUSUM: fewer events than predicted" }]);
    var c3 = V.svg(root, 640, 190); c3.setAttribute("aria-label", "Two-sided CUSUM of the standardised observed-minus-expected events, with the alarm limit");

    var out = V.readouts(root, [
      { key: "alarm", label: "CUSUM alarm (months after drift began)", cls: "bad" },
      { key: "oe", label: "Observed / expected, last 6 months" },
      { key: "auc", label: "AUC: before drift → last 6 months" },
      { key: "rc", label: "Recalibration" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 600 patients a month, about 10% with the event at go-live. CUSUM allowance k = 0.5, limit h = 5. Recalibration refits the intercept and slope on the 3 months after the alarm and applies them from then on; it cannot restore lost discrimination." }, root);

    function simulate() {
      var T0 = sT.value() - 1, cov = sCov.value() / 100, om = sPrev.value(), con = sCon.value() / 100;
      var months = [];
      for (var m = 0; m < M; m++) {
        var drift = m >= T0, xs = [], ys = [], ph = [];
        var a = A0 + (drift ? Math.log(om) : 0), b = B0 * (drift ? 1 - con : 1);
        for (var i = 0; i < N; i++) {
          var x = drift ? cov * 1.0 + (1 - 0.5 * cov) * Zx[m][i] : Zx[m][i];
          var y = Uy[m][i] < expit(a + b * x) ? 1 : 0;
          xs.push(x); ys.push(y); ph.push(expit(A0 + B0 * x));
        }
        months.push({ x: xs, y: ys, p: ph });
      }
      return { months: months, T0: T0 };
    }

    function cusum(months, key) {
      var sp = 0, sm = 0, SP = [], SM = [], alarm = -1;
      months.forEach(function (mo, m) {
        var O = 0, E = 0, Vv = 0;
        for (var i = 0; i < mo.y.length; i++) { O += mo.y[i]; E += mo[key][i]; Vv += mo[key][i] * (1 - mo[key][i]); }
        var z = (O - E) / Math.sqrt(Vv);
        sp = Math.max(0, sp + z - K); sm = Math.max(0, sm - z - K);
        SP.push(sp); SM.push(sm);
        if (alarm < 0 && (sp > H || sm > H)) alarm = m;
      });
      return { SP: SP, SM: SM, alarm: alarm };
    }

    function draw() {
      var sim = simulate(), months = sim.months, T0 = sim.T0;
      var cs = cusum(months, "p"), alarm = cs.alarm, recalFrom = -1, coef = null;
      if (recal && alarm >= 0 && alarm + 3 < M) {
        var X = [], Y = [];
        for (var m = alarm + 1; m <= alarm + 3; m++) months[m].p.forEach(function (pv, i) { X.push([1, logit(pv)]); Y.push(months[m].y[i]); });
        coef = logistic(X, Y);
        recalFrom = alarm + 4;
        months.forEach(function (mo, mm) { mo.q = mo.p.map(function (pv) { return mm >= recalFrom ? expit(coef[0] + coef[1] * logit(pv)) : pv; }); });
      } else months.forEach(function (mo) { mo.q = mo.p; });
      bRecal.textContent = recal ? "Undo recalibration" : "Recalibrate after the alarm";
      var csShown = recalFrom >= 0 ? cusum(months, "q") : cs;

      var obs = [], pred = [], A = [];
      months.forEach(function (mo) {
        var o = 0, e = 0; for (var i = 0; i < mo.y.length; i++) { o += mo.y[i]; e += mo.q[i]; }
        obs.push(o / mo.y.length); pred.push(e / mo.y.length); A.push(auc(mo.q, mo.y));
      });

      function marks(f, top) {
        el("line", { x1: f.x(T0 + 1), x2: f.x(T0 + 1), y1: f.y(f.y.domain[0]), y2: f.m.top, class: "viz-grid", "stroke-dasharray": "4 4" }, f.inner);
        el("text", { x: f.x(T0 + 1) - 4, y: f.m.top + 10, "text-anchor": "end", class: "viz-small viz-muted", text: "drift starts" }, f.inner);
        if (alarm >= 0) {
          el("line", { x1: f.x(alarm + 1), x2: f.x(alarm + 1), y1: f.y(f.y.domain[0]), y2: f.m.top, class: "stroke s3", style: "stroke-width:1.5" }, f.inner);
          if (top) el("text", { x: f.x(alarm + 1) + 4, y: f.m.top + 26, class: "viz-small colour s3", text: "alarm" }, f.inner);
        }
        if (recalFrom >= 0 && recalFrom < M) {
          el("line", { x1: f.x(recalFrom + 1), x2: f.x(recalFrom + 1), y1: f.y(f.y.domain[0]), y2: f.m.top, class: "stroke s1 dashed", style: "stroke-width:1.5" }, f.inner);
          if (top) el("text", { x: f.x(recalFrom + 1) + 4, y: f.m.top + 42, class: "viz-small colour s1", text: "recalibrated" }, f.inner);
        }
      }
      var xt = [1, 6, 12, 18, 24, 30, 36];
      var mx = Math.max(0.25, Math.ceil(Math.max.apply(null, obs.concat(pred)) * 20) / 20);

      clear(c1);
      var f1 = V.frame(c1, { x: [1, M], y: [0, mx], xTicks: xt, fmtY: V.fmt.pct, yLabel: "Event rate", margin: { bottom: 26 } });
      el("path", { d: V.line(obs.map(function (v, i) { return [f1.x(i + 1), f1.y(v)]; })), class: "stroke s1" }, f1.inner);
      el("path", { d: V.line(pred.map(function (v, i) { return [f1.x(i + 1), f1.y(v)]; })), class: "stroke s2 dashed" }, f1.inner);
      marks(f1, true);

      clear(c2);
      var f2 = V.frame(c2, { x: [1, M], y: [0.5, 0.9], xTicks: xt, yTicks: [0.5, 0.6, 0.7, 0.8, 0.9], fmtY: function (v) { return v.toFixed(1); }, yLabel: "AUC", margin: { bottom: 26 } });
      el("path", { d: V.line(A.map(function (v, i) { return [f2.x(i + 1), f2.y(Math.max(0.5, Math.min(0.9, v)))]; })), class: "stroke s4" }, f2.inner);
      marks(f2, false);

      clear(c3);
      var cmax = Math.max(8, Math.ceil(Math.max.apply(null, csShown.SP.concat(csShown.SM)) / 5) * 5);
      cmax = Math.min(cmax, 25);
      var f3 = V.frame(c3, { x: [1, M], y: [0, cmax], xTicks: xt, yLabel: "CUSUM", xLabel: "Month since go-live" });
      el("line", { x1: f3.x(1), x2: f3.x(M), y1: f3.y(H), y2: f3.y(H), class: "stroke s3 dashed", style: "stroke-width:1.5" }, f3.inner);
      el("text", { x: f3.x(M) - 4, y: f3.y(H) - 6, "text-anchor": "end", class: "viz-small colour s3", text: "limit h = 5" }, f3.inner);
      el("path", { d: V.line(csShown.SP.map(function (v, i) { return [f3.x(i + 1), f3.y(Math.min(cmax, v))]; })), class: "stroke s3" }, f3.inner);
      el("path", { d: V.line(csShown.SM.map(function (v, i) { return [f3.x(i + 1), f3.y(Math.min(cmax, v))]; })), class: "stroke s4" }, f3.inner);
      marks(f3, false);

      function mean(a, i0, i1) { var s = 0, n = 0; for (var i = i0; i < i1; i++) if (!isNaN(a[i])) { s += a[i]; n++; } return s / n; }
      var o6 = 0, e6 = 0;
      for (var mm = M - 6; mm < M; mm++) { o6 += obs[mm]; e6 += pred[mm]; }
      out.alarm(alarm < 0 ? "None" : alarm < T0 ? "False alarm, month " + (alarm + 1) : "+" + (alarm - T0 + 1) + " months");
      out.oe((o6 / e6).toFixed(2));
      out.auc(mean(A, 0, T0).toFixed(2) + " → " + mean(A, M - 6, M).toFixed(2));
      out.rc(recalFrom >= 0 ? "intercept " + V.fmt.signed(coef[0], 2) + ", slope " + coef[1].toFixed(2) : recal ? (alarm < 0 ? "No alarm to act on" : "Too late in the series") : "Not applied");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Feedback loop. Untreated risk p0(x) = expit(−2.2 + 1.2x), x ~ N(0,1). Patients whose
  // predicted risk exceeds the threshold get an intervention that cuts their risk by e.
  // Each round, a new model is fitted to that round's (expected) outcomes and used next round.
  V.register("feedback-loop", function (root) {
    var A = -2.2, B = 1.2, ROUNDS = 6;
    var grid = [], w = [];
    for (var x = -4; x <= 4.0001; x += 0.02) { grid.push(x); w.push(Math.exp(-x * x / 2)); }
    var ws = w.reduce(function (s, v) { return s + v; }, 0); w = w.map(function (v) { return v / ws; });

    var ctr = V.controls(root);
    var sE = V.slider(ctr, { label: "Intervention effect on flagged patients (risk reduction)", min: 0, max: 90, step: 5, value: 60, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sTh = V.slider(ctr, { label: "Alert threshold (predicted risk)", min: 10, max: 40, step: 1, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sR = V.slider(ctr, { label: "Retraining round shown", min: 0, max: ROUNDS, step: 1, value: 0, fmt: function (v) { return v === 0 ? "original" : v; }, onInput: draw });
    var tg = V.toggle(root, { options: [{ value: "naive", label: "Naive retraining" }, { value: "causal", label: "Retrain with treatment recorded" }], value: "naive", onChange: draw });

    V.legend(root, [
      { cls: "s5", label: "True risk without intervention" },
      { cls: "s1", label: "Observed risk this round" },
      { cls: "s2", label: "Model used this round", dashed: true }
    ]);
    var c1 = V.svg(root, 640, 280); c1.setAttribute("aria-label", "Risk against the risk factor: true untreated risk, observed risk after intervention, and the model in use, with the flagged region shaded");
    V.legend(root, [{ cls: "s1", label: "Share of patients flagged" }, { cls: "s3", label: "Observed PPV among flagged" }]);
    var c2 = V.svg(root, 640, 200); c2.setAttribute("aria-label", "Share flagged and observed PPV across retraining rounds");

    var out = V.readouts(root, [
      { key: "flag", label: "Patients flagged" },
      { key: "ppv", label: "Observed PPV among flagged", cls: "bad" },
      { key: "ppv0", label: "PPV had they not been treated" },
      { key: "ev", label: "Events per 1,000 patients" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Expected values, no sampling noise, so the pattern is the point. One risk factor; the intervention works and every flagged patient gets it. “Treatment recorded” fits risk ~ factor + treated and flags on the untreated risk." }, root);

    function runRounds(e, th, causal) {
      var model = [A, B], res = [];
      for (var r = 0; r <= ROUNDS; r++) {
        var flag = grid.map(function (x) { return expit(model[0] + model[1] * x) > th ? 1 : 0; });
        var p0 = grid.map(function (x) { return expit(A + B * x); });
        var p = p0.map(function (v, i) { return v * (1 - e * flag[i]); });
        var nf = 0, evf = 0, ev0f = 0, ev = 0;
        for (var i = 0; i < grid.length; i++) { ev += w[i] * p[i]; if (flag[i]) { nf += w[i]; evf += w[i] * p[i]; ev0f += w[i] * p0[i]; } }
        res.push({ model: model, flag: flag, p: p, share: nf, ppv: nf > 0 ? evf / nf : NaN, ppv0: nf > 0 ? ev0f / nf : NaN, ev: ev });
        // retrain on this round's expected outcomes: each grid point contributes y=1 with weight w·p and y=0 with weight w·(1−p)
        var X = [], Y = [], W = [], useT = causal && nf > 0 && nf < 0.999;
        for (i = 0; i < grid.length; i++) {
          var row = useT ? [1, grid[i], flag[i]] : [1, grid[i]];
          X.push(row); Y.push(1); W.push(w[i] * p[i]);
          X.push(row); Y.push(0); W.push(w[i] * (1 - p[i]));
        }
        var b = logistic(X, Y, W);
        model = [b[0], b[1]];
      }
      return res;
    }

    function draw() {
      var e = sE.value() / 100, th = sTh.value() / 100, rr = sR.value();
      var res = runRounds(e, th, tg.value() === "causal"), cur = res[rr];

      clear(c1);
      var xlo = -2, xhi = 3.5;
      var f = V.frame(c1, { x: [xlo, xhi], y: [0, 1], xTicks: [-2, -1, 0, 1, 2, 3], fmtX: function (v) { return (v > 0 ? "+" : "") + v + " SD"; }, fmtY: V.fmt.pct, xLabel: "Risk factor (standard deviations from average)", yLabel: "Risk of the event" });
      // shade flagged region
      var i0 = -1, i1 = -1;
      grid.forEach(function (x, i) { if (x >= xlo && x <= xhi && cur.flag[i]) { if (i0 < 0) i0 = i; i1 = i; } });
      if (i0 >= 0) {
        el("rect", { x: f.x(grid[i0]), y: f.y(1), width: f.x(grid[i1]) - f.x(grid[i0]), height: f.y(0) - f.y(1), class: "fill-soft s1", style: "fill-opacity:0.12" }, f.inner);
        el("text", { x: f.x(grid[i0]) + 6, y: f.y(1) + 14, class: "viz-small colour s1", text: "flagged and treated" }, f.inner);
      }
      el("line", { x1: f.x(xlo), x2: f.x(xhi), y1: f.y(th), y2: f.y(th), class: "viz-grid", "stroke-dasharray": "3 4" }, f.inner);
      el("text", { x: f.x(xlo) + 4, y: f.y(th) - 6, class: "viz-small viz-muted", text: "threshold" }, f.inner);
      function curve(fn) { var pts = []; grid.forEach(function (x, i) { if (x >= xlo && x <= xhi) pts.push([f.x(x), f.y(Math.min(1, fn(x, i)))]); }); return V.line(pts); }
      el("path", { d: curve(function (x) { return expit(A + B * x); }), class: "stroke s5", style: "stroke-width:3" }, f.inner);
      el("path", { d: curve(function (x, i) { return cur.p[i]; }), class: "stroke s1" }, f.inner);
      el("path", { d: curve(function (x) { return expit(cur.model[0] + cur.model[1] * x); }), class: "stroke s2 dashed" }, f.inner);

      clear(c2);
      var f2 = V.frame(c2, { x: [0, ROUNDS], y: [0, 0.6], xTicks: [0, 1, 2, 3, 4, 5, 6], fmtX: function (v) { return v === 0 ? "orig." : "R" + v; }, fmtY: V.fmt.pct, xLabel: "Retraining round" });
      el("path", { d: V.line(res.map(function (r, i) { return [f2.x(i), f2.y(r.share)]; })), class: "stroke s1" }, f2.inner);
      var pp = []; res.forEach(function (r, i) { if (!isNaN(r.ppv)) pp.push([f2.x(i), f2.y(Math.min(0.6, r.ppv))]); });
      if (pp.length > 1) el("path", { d: V.line(pp), class: "stroke s3" }, f2.inner);
      res.forEach(function (r, i) {
        el("circle", { cx: f2.x(i), cy: f2.y(r.share), r: i === rr ? 6 : 3.5, class: "dot s1" }, f2.inner);
        if (!isNaN(r.ppv)) el("circle", { cx: f2.x(i), cy: f2.y(Math.min(0.6, r.ppv)), r: i === rr ? 6 : 3.5, class: "dot s3" }, f2.inner);
      });

      out.flag(V.fmt.pct1(cur.share));
      out.ppv(isNaN(cur.ppv) ? "nobody flagged" : V.fmt.pct(cur.ppv));
      out.ppv0(isNaN(cur.ppv0) ? "–" : V.fmt.pct(cur.ppv0));
      out.ev(V.fmt.num(cur.ev * 1000, 0));
    }
    draw();
  });
})();
