// Lecture 5.15 — the accuracy-to-impact chain and a stepped-wedge simulator. Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 300; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // ---------------------------------------------------------------------------
  // Accuracy-to-impact chain: a funnel from cases to events prevented, per 1,000 patients.
  V.register("ai-impact-chain", function (root) {
    var N = 1000, PREV = 0.08, CASES = N * PREV;
    var ctr = V.controls(root);
    var pct = function (v) { return v + "%"; };
    var sSe = V.slider(ctr, { label: "Sensitivity", min: 30, max: 99, step: 1, value: 85, fmt: pct, onInput: draw });
    var sPPV = V.slider(ctr, { label: "PPV: share of alerts that are true cases", min: 5, max: 80, step: 1, value: 25, fmt: pct, onInput: draw });
    var sKnown = V.slider(ctr, { label: "Cases clinicians would have found anyway", min: 0, max: 90, step: 5, value: 40, fmt: pct, onInput: draw });
    var sAdh = V.slider(ctr, { label: "Clinician adherence: alerts acted on", min: 0, max: 100, step: 5, value: 60, fmt: pct, onInput: draw });
    var sEff = V.slider(ctr, { label: "Treatment effect if acted on (relative risk reduction)", min: 0, max: 60, step: 5, value: 30, fmt: pct, onInput: draw });
    var sRisk = V.slider(ctr, { label: "Baseline risk of the bad outcome in an untreated case", min: 5, max: 60, step: 1, value: 30, fmt: pct, onInput: draw });

    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    var tg = V.toggle(row, { options: [{ value: "off", label: "Alert fatigue off" }, { value: "on", label: "Alert fatigue on" }], value: "off", onChange: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Default", 85, 25, 40, 60, 30, 30],
     ["Excellent model, weak pathway", 95, 50, 70, 20, 15, 20],
     ["Modest model, strong pathway", 70, 20, 10, 85, 40, 40]].forEach(function (p) {
      V.button(pre, p[0], function () { sSe.set(p[1]); sPPV.set(p[2]); sKnown.set(p[3]); sAdh.set(p[4]); sEff.set(p[5]); sRisk.set(p[6]); draw(); });
    });

    var c = V.svg(root, 640, 270);
    c.setAttribute("aria-label", "Funnel of horizontal bars per 1,000 patients: patients with the condition, flagged by the model, not already known to clinicians, acted on, and bad outcomes prevented");

    var out = V.readouts(root, [
      { key: "alerts", label: "Alerts fired per 1,000 patients" },
      { key: "spec", label: "Implied specificity" },
      { key: "prev", label: "Bad outcomes prevented per 1,000", cls: "good" },
      { key: "nna", label: "Alerts per outcome prevented" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 1,000 patients, 8% with the condition. Cases clinicians find anyway are assumed to be treated in usual care, so the model adds nothing for them. Alert fatigue scales adherence down as the share of false alerts grows. In reality the model tends to flag the obvious cases clinicians already know, which makes things worse than shown." }, root);

    function draw() {
      var se = sSe.value() / 100, ppv = sPPV.value() / 100, known = sKnown.value() / 100;
      var adh = sAdh.value() / 100, eff = sEff.value() / 100, risk = sRisk.value() / 100;
      if (tg.value() === "on") adh *= Math.min(1, 0.4 + 1.2 * ppv);
      var tp = CASES * se, alerts = tp / ppv, fp = alerts - tp;
      var spec = Math.max(0, 1 - fp / (N - CASES));
      var fresh = tp * (1 - known), acted = fresh * adh, prevented = acted * risk * eff;

      clear(c);
      var x0 = 236, x1 = 560;
      function bx(v) { return x0 + (x1 - x0) * v / CASES; }
      var rows = [
        ["Have the condition", CASES, "s5"],
        ["Flagged by the model", tp, "s1"],
        ["… and new to clinicians", fresh, "s1"],
        ["… and acted on", acted, "s2"],
        ["Bad outcomes prevented", prevented, "s3"]
      ];
      rows.forEach(function (r, i) {
        var y = 14 + i * 42;
        el("text", { x: x0 - 12, y: y + 15, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-small", text: r[0] }, c);
        el("rect", { x: x0, y: y, width: x1 - x0, height: 30, rx: 4, class: "fill-soft s5", style: "fill-opacity:0.08" }, c);
        el("rect", { x: x0, y: y, width: Math.max(1.5, bx(r[1]) - x0), height: 30, rx: 4, class: "fill " + r[2] }, c);
        el("text", { x: Math.min(bx(r[1]) + 8, x1 + 8), y: y + 15, "dominant-baseline": "middle", class: "viz-small viz-bold", text: r[1] < 10 ? r[1].toFixed(1) : Math.round(r[1]) }, c);
      });
      el("text", { x: 20, y: 236, class: "viz-small viz-muted", text: "To get these, the model fired " + Math.round(alerts) + " alerts per 1,000 patients, of which " + Math.round(fp) + " were false." }, c);
      if (fp > N - CASES) el("text", { x: 20, y: 256, class: "viz-small colour s3", text: "This PPV is impossible at this sensitivity and prevalence: raise it." }, c);
      else el("text", { x: 20, y: 256, class: "viz-small viz-muted", text: "Effective adherence used: " + Math.round(adh * 100) + "%" + (tg.value() === "on" ? " (after alert fatigue)" : "") }, c);

      out.alerts(V.fmt.int(alerts));
      out.spec(V.fmt.pct1(spec));
      out.prev(prevented.toFixed(1));
      out.nna(prevented > 0.005 ? V.fmt.int(alerts / prevented) : "∞");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Stepped-wedge simulator: 8 hospitals, 9 periods, one crossover per step in random order.
  // Naive estimate = mean of exposed cells − mean of unexposed cells.
  // Model estimate = OLS with hospital and period fixed effects on cell proportions.
  V.register("stepped-wedge", function (root) {
    var K = 8, T = 9, n = 150, BASE = 0.22, seed = 515001;
    var U, Z, order;

    function draws() {
      var r = stream(seed);
      Z = []; U = [];
      for (var k = 0; k < K; k++) { Z.push(V.normal(r)); U.push([]); for (var t = 0; t < T; t++) { var cell = []; for (var i = 0; i < n; i++) cell.push(r()); U[k].push(cell); } }
      // random rollout order: hospital order[s] crosses at period s+1
      order = []; for (var j = 0; j < K; j++) order.push(j);
      for (var a = K - 1; a > 0; a--) { var b = Math.floor(r() * (a + 1)); var tmp = order[a]; order[a] = order[b]; order[b] = tmp; }
    }
    draws();

    var ctr = V.controls(root);
    var pp = function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pts"; };
    var sEff = V.slider(ctr, { label: "True effect of the AI tool on risk", min: -6, max: 2, step: 0.5, value: -3, fmt: pp, onInput: draw });
    var sTr = V.slider(ctr, { label: "Secular trend per period (same everywhere)", min: -1.5, max: 1.5, step: 0.25, value: -1, fmt: pp, onInput: draw });
    var sSd = V.slider(ctr, { label: "Between-hospital differences (SD)", min: 0, max: 6, step: 0.5, value: 3, fmt: function (v) { return v.toFixed(1) + " pts"; }, onInput: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New random sample", function () { seed += 2; draws(); draw(); });
    V.button(pre, "No true effect, improving trend", function () { sEff.set(0); sTr.set(-1); draw(); });

    V.legend(root, [{ cls: "s1", label: "AI switched on" }, { cls: "s5", label: "Not yet (control)" }]);
    var g1 = V.svg(root, 640, 282);
    g1.setAttribute("aria-label", "Grid of 8 hospitals by 9 periods showing which hospital-periods have the AI tool and the observed outcome rate in each");
    V.legend(root, [{ cls: "s1", label: "Mean of AI cells" }, { cls: "s5", label: "Mean of control cells" }, { cls: "s2", label: "Underlying trend without AI", dashed: true }]);
    var g2 = V.svg(root, 640, 250);
    g2.setAttribute("aria-label", "Mean outcome rate per period in AI-exposed and control hospital-periods, with the underlying secular trend");

    var out = V.readouts(root, [
      { key: "truth", label: "True effect" },
      { key: "naive", label: "Naive: AI periods vs control periods", cls: "bad" },
      { key: "model", label: "Model with period + hospital effects (95% CI)", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 150 patients per hospital-period, baseline risk 22%. Effects are in percentage points of risk. The model here is linear with fixed effects for hospital and period, fitted in your browser; a real analysis would use the mixed model in the code below." }, root);

    // Solve normal equations; return coefficients and the inverse of X'X.
    function ols(X, y) {
      var p = X[0].length, A = [], i, j, r;
      for (i = 0; i < p; i++) { A.push([]); for (j = 0; j < 2 * p + 1; j++) A[i].push(0); }
      for (r = 0; r < X.length; r++) for (i = 0; i < p; i++) {
        if (!X[r][i]) continue;
        for (j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j];
        A[i][2 * p] += X[r][i] * y[r];
      }
      for (i = 0; i < p; i++) A[i][p + i] = 1;
      for (i = 0; i < p; i++) {
        var piv = i;
        for (r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
        var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
        var d = A[i][i];
        for (j = 0; j < 2 * p + 1; j++) A[i][j] /= d;
        for (r = 0; r < p; r++) if (r !== i) { var f = A[r][i]; if (f) for (j = 0; j < 2 * p + 1; j++) A[r][j] -= f * A[i][j]; }
      }
      return { b: A.map(function (row) { return row[2 * p]; }), inv00: A[0][p] };
    }

    function draw() {
      var eff = sEff.value() / 100, tr = sTr.value() / 100, sd = sSd.value() / 100;
      var cross = []; order.forEach(function (h, s) { cross[h] = s + 1; });
      var Y = [], X = [], cells = [];
      for (var k = 0; k < K; k++) for (var t = 0; t < T; t++) {
        var ai = t >= cross[k] ? 1 : 0;
        var p = Math.min(0.98, Math.max(0.01, BASE + sd * Z[k] + tr * t + eff * ai));
        var ev = 0; for (var i = 0; i < n; i++) if (U[k][t][i] < p) ev++;
        var yv = ev / n;
        cells.push({ k: k, t: t, ai: ai, y: yv });
        Y.push(yv);
        var row = [ai];
        for (var kk = 0; kk < K; kk++) row.push(kk === k ? 1 : 0);
        for (var tt = 1; tt < T; tt++) row.push(tt === t ? 1 : 0);
        X.push(row);
      }
      var fit = ols(X, Y), theta = fit.b[0];
      var rss = 0;
      for (var r = 0; r < X.length; r++) { var yh = 0; for (var j = 0; j < X[r].length; j++) yh += X[r][j] * fit.b[j]; rss += (Y[r] - yh) * (Y[r] - yh); }
      var s2 = rss / (X.length - X[0].length), se = Math.sqrt(s2 * fit.inv00);
      var sA = 0, nA = 0, sC = 0, nC = 0;
      cells.forEach(function (cl) { if (cl.ai) { sA += cl.y; nA++; } else { sC += cl.y; nC++; } });
      var naive = sA / nA - sC / nC;

      // Grid
      clear(g1);
      var left = 92, cw = (630 - left) / T, top = 30, rh = 27;
      for (var t2 = 0; t2 < T; t2++) el("text", { x: left + cw * (t2 + 0.5), y: 18, "text-anchor": "middle", class: "viz-tick", text: "P" + t2 }, g1);
      for (var k2 = 0; k2 < K; k2++) {
        el("text", { x: left - 10, y: top + rh * k2 + rh / 2, "text-anchor": "end", "dominant-baseline": "middle", class: "viz-small", text: "Hospital " + (k2 + 1) }, g1);
      }
      cells.forEach(function (cl) {
        var x = left + cw * cl.t + 2, y = top + rh * cl.k + 2;
        el("rect", { x: x, y: y, width: cw - 4, height: rh - 4, rx: 3, class: cl.ai ? "fill s1" : "fill-soft s5", style: cl.ai ? "fill-opacity:0.45" : null }, g1);
        el("text", { x: x + (cw - 4) / 2, y: y + (rh - 4) / 2, "text-anchor": "middle", "dominant-baseline": "middle", class: "viz-small", text: Math.round(cl.y * 100) + "%" }, g1);
      });
      el("text", { x: left, y: top + rh * K + 22, class: "viz-small viz-muted", text: "Each cell: observed outcome rate in that hospital-period. Rollout order was randomised." }, g1);

      // Period means
      clear(g2);
      var f = V.frame(g2, { x: [0, T - 1], y: [0, 0.45], xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8], fmtX: function (v) { return "P" + v; }, fmtY: V.fmt.pct, xLabel: "Period", yLabel: "Outcome rate" });
      var ptsA = [], ptsC = [], trend = [];
      for (var t3 = 0; t3 < T; t3++) {
        var a = 0, na = 0, cc = 0, nc = 0, hs = 0;
        cells.forEach(function (cl) { if (cl.t === t3) { if (cl.ai) { a += cl.y; na++; } else { cc += cl.y; nc++; } } });
        for (var k3 = 0; k3 < K; k3++) hs += sd * Z[k3];
        if (na) ptsA.push([f.x(t3), f.y(a / na)]);
        if (nc) ptsC.push([f.x(t3), f.y(cc / nc)]);
        trend.push([f.x(t3), f.y(Math.max(0, BASE + hs / K + tr * t3))]);
      }
      el("path", { d: V.line(trend), class: "stroke s2 dashed", style: "stroke-width:2" }, f.inner);
      el("path", { d: V.line(ptsC), class: "stroke s5" }, f.inner);
      el("path", { d: V.line(ptsA), class: "stroke s1" }, f.inner);
      ptsC.forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 4, class: "dot s5" }, f.inner); });
      ptsA.forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 4, class: "dot s1" }, f.inner); });

      var fmtpp = function (v) { return V.fmt.signed(v * 100, 1) + " pts"; };
      out.truth(fmtpp(eff));
      out.naive(fmtpp(naive));
      out.model(fmtpp(theta) + " (" + V.fmt.signed((theta - 1.96 * se) * 100, 1) + " to " + V.fmt.signed((theta + 1.96 * se) * 100, 1) + ")");
    }
    draw();
  });
})();
