// Lecture 5.4 — love plot (balance before/after IPTW, matching, overlap weights) and
// IPTW vs overlap weights under extreme propensity scores. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Simulated ICU cohort: new-onset AF, anticoagulated or not. Covariates and a
  // treatment model whose strength k controls how different the groups are.
  var COVS = [
    { key: "age", label: "Age (years)", cont: true },
    { key: "sofa", label: "SOFA score", cont: true },
    { key: "vaso", label: "On vasopressors" },
    { key: "plt", label: "Platelets < 100" },
    { key: "surg", label: "Surgery this admission" },
    { key: "bleed", label: "Prior major bleed" },
    { key: "ckd", label: "Chronic kidney disease" },
    { key: "hf", label: "Heart failure" },
    { key: "stroke", label: "Prior stroke" }
  ];
  // log-odds coefficients for receiving anticoagulation (per SD for continuous)
  var BETA = { age: 0.15, sofa: -0.55, vaso: -0.6, plt: -1.2, surg: -0.9, bleed: -1.3, ckd: -0.3, hf: 0.5, stroke: 0.8 };

  function simulate(n, k, seed) {
    var r = V.rng(seed);
    for (var b = 0; b < 300; b++) r();
    var rows = [];
    for (var i = 0; i < n; i++) {
      var age = 68 + 12 * V.normal(r);
      var sev = V.normal(r); // latent illness severity
      var sofa = Math.max(0, Math.min(20, 6 + 2.6 * sev + 1.2 * V.normal(r)));
      var vaso = r() < 1 / (1 + Math.exp(-(-0.6 + 1.1 * sev))) ? 1 : 0;
      var plt = r() < 1 / (1 + Math.exp(-(-2 + 0.6 * sev))) ? 1 : 0;
      var surg = r() < 0.25 ? 1 : 0;
      var bleed = r() < 0.1 ? 1 : 0;
      var ckd = r() < 1 / (1 + Math.exp(-(-1.5 + 0.03 * (age - 68)))) ? 1 : 0;
      var hf = r() < 0.3 ? 1 : 0;
      var stroke = r() < 0.12 ? 1 : 0;
      var x = { age: age, sofa: sofa, vaso: vaso, plt: plt, surg: surg, bleed: bleed, ckd: ckd, hf: hf, stroke: stroke };
      var lp = 0.1 + k * (BETA.age * (age - 68) / 12 + BETA.sofa * (sofa - 6) / 3 + BETA.vaso * vaso + BETA.plt * plt +
        BETA.surg * surg + BETA.bleed * bleed + BETA.ckd * ckd + BETA.hf * hf + BETA.stroke * stroke);
      x.t = r() < 1 / (1 + Math.exp(-lp)) ? 1 : 0;
      rows.push(x);
    }
    return rows;
  }

  // Solve A x = b (Gaussian elimination with partial pivoting).
  function solve(A, b) {
    var n = b.length, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      for (r = c + 1; r < n; r++) {
        var f = M[r][c] / M[c][c];
        for (var j = c; j <= n; j++) M[r][j] -= f * M[c][j];
      }
    }
    var x = new Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (var j2 = i + 1; j2 < n; j2++) s -= M[i][j2] * x[j2];
      x[i] = s / M[i][i];
    }
    return x;
  }

  // Logistic regression by Newton–Raphson; returns fitted probabilities.
  function fitPS(rows, keys) {
    var X = rows.map(function (d) {
      return [1].concat(keys.map(function (k) { return k === "age" ? (d.age - 68) / 12 : k === "sofa" ? (d.sofa - 6) / 3 : d[k]; }));
    });
    var y = rows.map(function (d) { return d.t; }), p = X[0].length, beta = new Array(p).fill(0);
    for (var it = 0; it < 30; it++) {
      var g = new Array(p).fill(0), H = [];
      for (var a = 0; a < p; a++) { H.push(new Array(p).fill(0)); H[a][a] = 1e-6; }
      for (var i = 0; i < X.length; i++) {
        var eta = 0;
        for (var j = 0; j < p; j++) eta += X[i][j] * beta[j];
        var mu = 1 / (1 + Math.exp(-eta)), w = mu * (1 - mu);
        for (j = 0; j < p; j++) {
          g[j] += X[i][j] * (y[i] - mu);
          for (var l = j; l < p; l++) H[j][l] += w * X[i][j] * X[i][l];
        }
      }
      for (j = 0; j < p; j++) for (l = 0; l < j; l++) H[j][l] = H[l][j];
      var d = solve(H, g), mx = 0;
      for (j = 0; j < p; j++) { beta[j] += d[j]; mx = Math.max(mx, Math.abs(d[j])); }
      if (mx < 1e-8) break;
    }
    return X.map(function (row) {
      var eta = 0;
      for (var j = 0; j < p; j++) eta += row[j] * beta[j];
      return Math.min(1 - 1e-6, Math.max(1e-6, 1 / (1 + Math.exp(-eta))));
    });
  }

  function weights(rows, ps, method) {
    return rows.map(function (d, i) {
      var e = ps[i];
      if (method === "none") return 1;
      if (method === "iptw") return d.t ? 1 / e : 1 / (1 - e);
      if (method === "trim") return (e < 0.1 || e > 0.9) ? 0 : (d.t ? 1 / e : 1 / (1 - e));
      if (method === "ow") return d.t ? 1 - e : e;
      return 1;
    });
  }

  // Greedy 1:1 nearest-neighbour matching on the logit PS, caliper 0.2 SD, no replacement.
  function matchWeights(rows, ps, seed) {
    var lg = ps.map(function (e) { return Math.log(e / (1 - e)); });
    var m = lg.reduce(function (a, b) { return a + b; }, 0) / lg.length;
    var sd = Math.sqrt(lg.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (lg.length - 1));
    var cal = 0.2 * sd, w = rows.map(function () { return 0; });
    var tr = [], co = [];
    rows.forEach(function (d, i) { (d.t ? tr : co).push(i); });
    var r = V.rng(seed); for (var b = 0; b < 300; b++) r();
    for (var i = tr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = tr[i]; tr[i] = tr[j]; tr[j] = t; }
    var used = {};
    tr.forEach(function (ti) {
      var best = -1, bd = Infinity;
      co.forEach(function (ci) {
        if (used[ci]) return;
        var dd = Math.abs(lg[ti] - lg[ci]);
        if (dd < bd) { bd = dd; best = ci; }
      });
      if (best >= 0 && bd <= cal) { used[best] = 1; w[ti] = 1; w[best] = 1; }
    });
    return w;
  }

  // Standardised mean difference; denominator = unweighted pooled SD (as cobalt does).
  function smd(rows, w, key) {
    var s = [[0, 0, 0], [0, 0, 0]]; // per group: sum w, sum w x, (unweighted) for SD
    var raw = [[], []];
    rows.forEach(function (d, i) {
      var g = d.t; s[g][0] += w[i]; s[g][1] += w[i] * d[key]; raw[g].push(d[key]);
    });
    function vr(a) { var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length; return a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / (a.length - 1); }
    var sd = Math.sqrt((vr(raw[0]) + vr(raw[1])) / 2) || 1;
    return (s[1][1] / s[1][0] - s[0][1] / s[0][0]) / sd;
  }

  function ess(rows, w, g) {
    var a = 0, b = 0;
    rows.forEach(function (d, i) { if (d.t === g) { a += w[i]; b += w[i] * w[i]; } });
    return b > 0 ? a * a / b : 0;
  }

  // ---------------------------------------------------------------------------
  // Widget 1: love plot
  V.register("love-plot", function (root) {
    var N = 1500, SEED = 900001;
    var ctr = V.controls(root);
    var sK = V.slider(ctr, { label: "How strongly severity drives treatment", min: 0.5, max: 2.5, step: 0.25, value: 1.5, fmt: function (v) { return "× " + v.toFixed(2); }, onInput: draw });
    var tg = V.toggle(root, { options: [{ value: "iptw", label: "IPTW (ATE)" }, { value: "match", label: "1:1 matching (ATT)" }, { value: "ow", label: "Overlap weights (ATO)" }], value: "iptw", onChange: draw });
    el("div", { style: "height:0.5rem" }, root);
    var tm = V.toggle(root, { options: [{ value: "all", label: "PS model: all 9 covariates" }, { value: "nosofa", label: "PS model misses SOFA" }], value: "all", onChange: draw });

    V.legend(root, [
      { cls: "s5", label: "Before adjustment" },
      { cls: "s1", label: "After adjustment" },
      { cls: "s3", label: "|SMD| = 0.1 threshold", dashed: true }
    ]);
    var c = V.svg(root, 640, 360);
    c.setAttribute("aria-label", "Love plot: absolute standardised mean difference for nine covariates before and after propensity score adjustment, with a dashed line at 0.1");
    var host = el("g", null, c); host.W = 640; host.H = 360;
    var out = V.readouts(root, [
      { key: "max", label: "Largest |SMD| after adjustment" },
      { key: "essT", label: "Effective sample size, treated" },
      { key: "essC", label: "Effective sample size, untreated" },
      { key: "who", label: "Who the estimate is about" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: a simulated cohort of 1,500 ICU patients with new-onset AF. Anticoagulation is less likely with high SOFA, vasopressors, low platelets, recent surgery or prior bleeding, and more likely with heart failure or prior stroke. The propensity score is a logistic regression fitted to the simulated data." }, root);

    var cache = {};
    function draw() {
      var k = sK.value(), method = tg.value(), model = tm.value();
      var key = k + "|" + model;
      if (!cache[key]) {
        var rows = simulate(N, k, SEED);
        var keys = COVS.map(function (cv) { return cv.key; }).filter(function (x) { return model === "all" || x !== "sofa"; });
        cache[key] = { rows: rows, ps: fitPS(rows, keys) };
      }
      var rows = cache[key].rows, ps = cache[key].ps;
      var w0 = weights(rows, ps, "none");
      var w = method === "match" ? matchWeights(rows, ps, 77777) : weights(rows, ps, method);
      var before = COVS.map(function (cv) { return Math.abs(smd(rows, w0, cv.key)); });
      var after = COVS.map(function (cv) { return Math.abs(smd(rows, w, cv.key)); });
      var order = COVS.map(function (cv, i) { return i; }).sort(function (a, b) { return before[b] - before[a]; });
      var xmax = Math.max(0.5, Math.ceil(Math.max.apply(null, before.concat(after)) * 10) / 10);

      clear(host);
      var f = V.frame(host, { x: [0, xmax], y: [0, COVS.length], margin: { left: 178, right: 20, top: 10, bottom: 42 }, yTicks: [], xTicks: V.ticks(0, xmax, 6), fmtX: function (v) { return v.toFixed(1); }, xLabel: "Absolute standardised mean difference" });
      var g = f.inner;
      el("line", { x1: f.x(0.1), x2: f.x(0.1), y1: f.y(0), y2: f.y(COVS.length), class: "stroke s3 dashed", style: "stroke-width:1.5" }, g);
      order.forEach(function (ci, row) {
        var yy = f.y(COVS.length - row - 0.5);
        var cv = COVS[ci];
        var omitted = model === "nosofa" && cv.key === "sofa";
        el("line", { x1: f.m.left, x2: 640 - f.m.right, y1: yy, y2: yy, class: "viz-grid", style: "stroke-dasharray:2 4" }, g);
        el("text", { x: f.m.left - 10, y: yy, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-small" + (omitted ? " viz-bold colour s3" : ""), text: cv.label + (omitted ? " (not in model)" : "") }, g);
        el("line", { x1: f.x(before[ci]), x2: f.x(after[ci]), y1: yy, y2: yy, class: "stroke s5", style: "stroke-width:1.2" }, g);
        el("circle", { cx: f.x(before[ci]), cy: yy, r: 6, class: "s5", style: "fill:var(--surface);stroke:var(--sc);stroke-width:2" }, g);
        el("circle", { cx: f.x(after[ci]), cy: yy, r: 6, class: "dot s1" }, g);
      });

      var mx = Math.max.apply(null, after);
      out.max(mx.toFixed(2) + (mx <= 0.1 ? " ✓" : " ✗"));
      var nT = rows.filter(function (d) { return d.t; }).length, nC = N - nT;
      out.essT(V.fmt.int(ess(rows, w, 1)) + " of " + nT);
      out.essC(V.fmt.int(ess(rows, w, 0)) + " of " + nC);
      out.who({ iptw: "Everyone (ATE)", match: "Matched treated (ATT)", ow: "The clinical grey zone (ATO)" }[method]);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Widget 2: weights under extreme propensity scores
  V.register("weights-extreme", function (root) {
    var N = 1500, SEED = 700001;
    var ctr = V.controls(root);
    var sK = V.slider(ctr, { label: "Separation between the groups", min: 0.5, max: 4.5, step: 0.25, value: 3, fmt: function (v) { return "× " + v.toFixed(2); }, onInput: draw });
    var tg = V.toggle(root, { options: [{ value: "iptw", label: "IPTW" }, { value: "trim", label: "IPTW, trimmed to 0.1–0.9" }, { value: "ow", label: "Overlap weights" }], value: "iptw", onChange: draw });

    V.legend(root, [
      { cls: "s1", label: "Anticoagulated" },
      { cls: "s2", label: "Not anticoagulated" },
      { cls: "s5", label: "Outline = weighted (pseudo-population) shape", dashed: true }
    ]);
    var c = V.svg(root, 640, 520);
    c.setAttribute("aria-label", "Top: mirrored histograms of the propensity score for treated and untreated patients, with weighted shapes outlined. Bottom: each patient's weight against their propensity score on a log scale.");
    var host = el("g", null, c); host.W = 640; host.H = 520;
    var out = V.readouts(root, [
      { key: "essT", label: "ESS, treated (% of n)" },
      { key: "essC", label: "ESS, untreated (% of n)" },
      { key: "top", label: "Largest single weight, as share of its group’s total" },
      { key: "drop", label: "Patients given zero weight" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. ESS = effective sample size, (Σw)² / Σw²: how many equally weighted people the weighted group is worth. Overlap weights never exceed 1, so no single patient can dominate." }, root);

    var cache = {};
    function draw() {
      var k = sK.value(), method = tg.value();
      if (!cache[k]) {
        var rr = simulate(N, k, SEED);
        cache[k] = { rows: rr, ps: fitPS(rr, COVS.map(function (cv) { return cv.key; })) };
      }
      var rows = cache[k].rows, ps = cache[k].ps, w = weights(rows, ps, method);
      clear(host);

      // --- top panel: mirrored histograms
      var NB = 20, top = { y0: 20, mid: 140, y1: 260 };
      var hu = [new Array(NB).fill(0), new Array(NB).fill(0)], hw = [new Array(NB).fill(0), new Array(NB).fill(0)];
      var tot = [0, 0], totw = [0, 0];
      rows.forEach(function (d, i) {
        var b = Math.min(NB - 1, Math.floor(ps[i] * NB));
        hu[d.t][b] += 1; hw[d.t][b] += w[i]; tot[d.t] += 1; totw[d.t] += w[i];
      });
      var maxP = [0, 0];
      for (var g = 0; g < 2; g++) for (var b = 0; b < NB; b++) {
        hu[g][b] /= tot[g]; hw[g][b] = totw[g] ? hw[g][b] / totw[g] : 0;
        maxP[g] = Math.max(maxP[g], hu[g][b], hw[g][b]);
      }
      // each half scaled to its own maximum: compare shapes, not heights
      var x = V.scale(0, 1, 60, 620), hyG = [(top.y1 - top.mid - 6) / maxP[0], (top.mid - top.y0 - 6) / maxP[1]];
      el("text", { x: 60, y: 12, class: "viz-small viz-bold", text: "Propensity score distribution (share of each group per bin)" }, host);
      for (b = 0; b < NB; b++) {
        var x0 = x(b / NB) + 1, wd = x(1 / NB) - x(0) - 2;
        el("rect", { x: x0, y: top.mid - hu[1][b] * hyG[1], width: wd, height: hu[1][b] * hyG[1], class: "fill-soft s1", style: "fill-opacity:0.45" }, host);
        el("rect", { x: x0, y: top.mid, width: wd, height: hu[0][b] * hyG[0], class: "fill-soft s2", style: "fill-opacity:0.45" }, host);
      }
      // weighted outlines as step paths
      function step(gp, sign) {
        var pts = [[x(0), top.mid]];
        for (var bb = 0; bb < NB; bb++) {
          var yy = top.mid - sign * hw[gp][bb] * hyG[gp];
          pts.push([x(bb / NB), yy]); pts.push([x((bb + 1) / NB), yy]);
        }
        pts.push([x(1), top.mid]);
        return V.line(pts);
      }
      el("path", { d: step(1, 1), class: "stroke s1 dashed", style: "stroke-width:2" }, host);
      el("path", { d: step(0, -1), class: "stroke s2 dashed", style: "stroke-width:2" }, host);
      el("line", { x1: 60, x2: 620, y1: top.mid, y2: top.mid, class: "viz-axis" }, host);
      if (method === "trim") {
        [0.1, 0.9].forEach(function (v) { el("line", { x1: x(v), x2: x(v), y1: top.y0, y2: top.y1, class: "stroke s3 dashed", style: "stroke-width:1.5" }, host); });
      }
      el("text", { x: 616, y: top.y0 + 14, "text-anchor": "end", class: "viz-small colour s1", text: "anticoagulated ↑" }, host);
      el("text", { x: 616, y: top.y1 - 4, "text-anchor": "end", class: "viz-small colour s2", text: "not anticoagulated ↓" }, host);
      [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(function (v) { el("text", { x: x(v), y: top.y1 + 14, "text-anchor": "middle", class: "viz-tick", text: v.toFixed(1) }, host); });

      // --- bottom panel: weight vs PS (log scale)
      var bt = { y0: 318, y1: 480 };
      var ly = V.scale(Math.log10(0.01), Math.log10(1000), bt.y1, bt.y0);
      [0.01, 0.1, 1, 10, 100, 1000].forEach(function (v) {
        el("line", { x1: 60, x2: 620, y1: ly(Math.log10(v)), y2: ly(Math.log10(v)), class: "viz-grid" }, host);
        el("text", { x: 52, y: ly(Math.log10(v)), "text-anchor": "end", "dominant-baseline": "middle", class: "viz-tick", text: v >= 1 ? String(v) : v.toString() }, host);
      });
      el("text", { x: 60, y: bt.y0 - 16, class: "viz-small viz-bold", text: "Each patient’s weight (log scale)" }, host);
      rows.forEach(function (d, i) {
        if (i % 2) return; // thin for speed
        if (w[i] <= 0) return;
        el("circle", { cx: x(ps[i]), cy: ly(Math.log10(Math.max(0.01, Math.min(1000, w[i])))), r: 2.2, class: "dot " + (d.t ? "s1" : "s2"), style: "opacity:0.6" }, host);
      });
      el("line", { x1: 60, x2: 620, y1: bt.y1, y2: bt.y1, class: "viz-axis" }, host);
      [0, 0.2, 0.4, 0.6, 0.8, 1].forEach(function (v) { el("text", { x: x(v), y: bt.y1 + 16, "text-anchor": "middle", class: "viz-tick", text: v.toFixed(1) }, host); });
      el("text", { x: 340, y: 512, "text-anchor": "middle", class: "viz-label", text: "Propensity score (probability of anticoagulation)" }, host);

      var nT = tot[1], nC = tot[0];
      var eT = ess(rows, w, 1), eC = ess(rows, w, 0);
      out.essT(V.fmt.int(eT) + " (" + V.fmt.pct(eT / nT) + ")");
      out.essC(V.fmt.int(eC) + " (" + V.fmt.pct(eC / nC) + ")");
      var mxShare = 0;
      rows.forEach(function (d, i) { if (totw[d.t] > 0) mxShare = Math.max(mxShare, w[i] / totw[d.t]); });
      out.top(V.fmt.pct1(mxShare));
      out.drop(V.fmt.int(w.filter(function (v) { return v === 0; }).length));
    }
    draw();
  });
})();
