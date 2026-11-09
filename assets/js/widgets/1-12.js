// Lecture 1.12 — Uncertainty and value of information (illustrative numbers).
// A new salt policy against current practice. Each simulated PSA run gives
//   dE = DALYs averted and dC = extra cost (SAR million), both versus current practice.
// Incremental net monetary benefit in a run: NB = threshold × dE − dC (current practice has NB = 0).
// 1) "psa-cloud": the PSA cloud on the cost-effectiveness plane.
// 2) "psa-evpi":  acceptability curve, expected net benefit and EVPI, with a skewed-cost option.
(function () {
  var MEAN_E = 1000, MEAN_C = 20; // so the ICER at the means is SAR 20,000 per DALY

  function baseDraws(n, seed) {
    var r = Viz.rng(seed), z1 = [], z2 = [];
    for (var i = 0; i < n; i++) { z1.push(Viz.normal(r)); z2.push(Viz.normal(r)); }
    return { z1: z1, z2: z2, n: n };
  }
  var mean = function (a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  var thousands = function (v) { return v === 0 ? "0" : Viz.fmt.int(v / 1000) + "k"; };

  // ---------------------------------------------------------------- PSA cloud
  Viz.register("psa-cloud", function (root) {
    var V = Viz, el = V.el, D = baseDraws(1000, 1012);
    var X = [-1500, 3500], Y = [-30, 70];

    var ctr = V.controls(root);
    var pct = function (v) { return "SD " + v + "% of mean"; };
    var s = {
      e: V.slider(ctr, { label: "Uncertainty in health effect", min: 5, max: 80, step: 5, value: 40, fmt: pct, onInput: draw }),
      c: V.slider(ctr, { label: "Uncertainty in costs", min: 5, max: 80, step: 5, value: 40, fmt: pct, onInput: draw }),
      lam: V.slider(ctr, { label: "Threshold (SAR per DALY)", min: 1000, max: 60000, step: 1000, value: 30000, fmt: V.fmt.int, onInput: draw })
    };

    V.legend(root, [
      { cls: "s1", label: "Run: cost-effective" },
      { cls: "s3", label: "Run: not cost-effective" },
      { cls: "s4", label: "Mean of all runs" },
      { cls: "s2", label: "Threshold line", dashed: true }
    ]);
    var p = V.svg(root, 640, 400);
    p.setAttribute("aria-label", "Cost-effectiveness plane with 1,000 simulated PSA runs and the threshold line");
    var f = V.frame(p, {
      x: X, y: Y, xTicks: [-1000, 0, 1000, 2000, 3000], yTicks: [-20, 0, 20, 40, 60],
      fmtX: function (v) { return V.fmt.int(v).replace("-", "−"); }, fmtY: function (v) { return V.fmt.int(v).replace("-", "−"); },
      xLabel: "DALYs averted vs current practice", yLabel: "Extra cost (SAR million)", margin: { left: 58 }
    });
    el("line", { x1: f.x(X[0]), x2: f.x(X[1]), y1: f.y(0), y2: f.y(0), class: "edge strong" }, f.inner);
    el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(Y[0]), y2: f.y(Y[1]), class: "edge strong" }, f.inner);
    var dots = [];
    for (var i = 0; i < D.n; i++) dots.push(el("circle", { r: 2.3 }, f.inner));
    var thr = el("path", { class: "stroke dashed s2" }, f.inner);
    var ring = el("circle", { r: 10, class: "node s4" }, f.inner), mdot = el("circle", { r: 5, class: "dot s4" }, f.inner);

    var out = V.readouts(root, [
      { key: "e", label: "Mean DALYs averted" },
      { key: "c", label: "Mean extra cost (SAR million)" },
      { key: "icer", label: "ICER at the means (SAR per DALY)" },
      { key: "p", label: "Share of runs below the threshold line (chance cost-effective)", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 1,000 simulated runs with a fixed seed. Runs outside the axes are not drawn but are counted." }, root);

    function draw() {
      var ue = s.e.value() / 100, uc = s.c.value() / 100, k = s.lam.value() / 1e6, ce = 0, se = 0, sc = 0;
      for (var i = 0; i < D.n; i++) {
        var e = MEAN_E * (1 + ue * D.z1[i]), c = MEAN_C * (1 + uc * D.z2[i]), ok = k * e - c > 0;
        se += e; sc += c; if (ok) ce++;
        var inside = e >= X[0] && e <= X[1] && c >= Y[0] && c <= Y[1];
        dots[i].setAttribute("cx", f.x(e)); dots[i].setAttribute("cy", f.y(c));
        dots[i].setAttribute("class", "dot " + (ok ? "s1" : "s3"));
        dots[i].style.display = inside ? "" : "none";
      }
      var me = se / D.n, mc = sc / D.n;
      var xp = Math.min(X[1], Y[1] / k), xn = Math.max(X[0], Y[0] / k);
      thr.setAttribute("d", V.line([[f.x(xn), f.y(xn * k)], [f.x(xp), f.y(xp * k)]]));
      ring.setAttribute("cx", f.x(me)); ring.setAttribute("cy", f.y(mc));
      mdot.setAttribute("cx", f.x(me)); mdot.setAttribute("cy", f.y(mc));
      out.e(V.fmt.int(me));
      out.c(V.fmt.num(mc, 1));
      out.icer(V.fmt.int(mc * 1e6 / me));
      out.p(V.fmt.pct(ce / D.n));
    }
    draw();
  });

  // ---------------------------------------------------------------- CEAC + EVPI
  Viz.register("psa-evpi", function (root) {
    var V = Viz, el = V.el, D = baseDraws(2000, 4242), LMAX = 60000, STEP = 1000;

    var ctr = V.controls(root);
    var s = {
      lam: V.slider(ctr, { label: "Threshold (SAR per DALY)", min: 0, max: LMAX, step: STEP, value: 30000, fmt: V.fmt.int, onInput: draw }),
      u: V.slider(ctr, { label: "Overall uncertainty", min: 0.25, max: 2, step: 0.05, value: 1, fmt: function (v) { return "×" + v.toFixed(2); }, onInput: draw })
    };
    var shape = V.toggle(root, { options: [{ value: "sym", label: "Symmetric costs" }, { value: "skew", label: "Skewed costs" }], value: "sym", onChange: draw });

    V.legend(root, [
      { cls: "s1", label: "Chance the new policy is cost-effective (CEAC)" },
      { cls: "s5", label: "Shaded: new policy has the higher expected NMB" }
    ]);
    var c1 = V.svg(root, 640, 260);
    c1.setAttribute("aria-label", "Cost-effectiveness acceptability curve for the new policy across thresholds");
    V.legend(root, [{ cls: "s4", label: "EVPI: expected loss from deciding now (SAR million)" }]);
    var c2 = V.svg(root, 640, 230);
    c2.setAttribute("aria-label", "Expected value of perfect information across thresholds");

    var out = V.readouts(root, [
      { key: "p", label: "Chance the new policy is cost-effective" },
      { key: "enb", label: "Expected incremental NMB (SAR million)" },
      { key: "pick", label: "Choice by highest expected NMB", cls: "good" },
      { key: "evpi", label: "EVPI for this decision (SAR million)" }
    ]);
    var verdict = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers: 2,000 simulated runs with a fixed seed. Current practice is the comparator, so its net benefit is 0 in every run. EVPI = average of the best option in each run − the best average." }, root);

    function runs(u, skew) {
      var dE = [], dC = [], sg = 0.8 * u;
      for (var i = 0; i < D.n; i++) {
        dE.push(MEAN_E + 400 * u * D.z1[i]);
        dC.push(skew ? MEAN_C * Math.exp(sg * D.z2[i] - sg * sg / 2) : MEAN_C + 8 * u * D.z2[i]);
      }
      return { dE: dE, dC: dC, mE: mean(dE), mC: mean(dC) };
    }
    function at(R, lam) {
      var k = lam / 1e6, win = 0, best = 0;
      for (var i = 0; i < D.n; i++) { var nb = k * R.dE[i] - R.dC[i]; if (nb > 0) { win++; best += nb; } }
      var enb = k * R.mE - R.mC;
      return { p: win / D.n, enb: enb, evpi: best / D.n - Math.max(enb, 0) };
    }
    function clear(svgEl) { while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild); }

    function draw() {
      var lam = s.lam.value(), R = runs(s.u.value(), shape.value() === "skew");
      var grid = [];
      for (var l = 0; l <= LMAX; l += STEP) { var a = at(R, l); a.lam = l; grid.push(a); }
      var cur = at(R, lam), switchAt = R.mC * 1e6 / R.mE; // expected NMB = 0 here

      // CEAC
      clear(c1);
      var f = V.frame(c1, { x: [0, LMAX], y: [0, 1], xTicks: [0, 10000, 20000, 30000, 40000, 50000, 60000], fmtX: thousands, fmtY: V.fmt.pct, yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "Threshold (SAR per DALY)", yLabel: "Chance cost-effective" });
      var sx = Math.max(0, Math.min(LMAX, switchAt));
      el("rect", { x: f.x(sx), y: f.y(1), width: f.x(LMAX) - f.x(sx), height: f.y(0) - f.y(1), class: "fill-soft s5" }, f.inner);
      el("line", { x1: f.x(0), x2: f.x(LMAX), y1: f.y(0.5), y2: f.y(0.5), class: "edge", "stroke-dasharray": "3 4" }, f.inner);
      if (sx > 9000) el("text", { x: f.x(sx / 2), y: f.y(1) + 16, "text-anchor": "middle", class: "viz-small viz-muted", text: "Best on average:" }, f.inner);
      if (sx > 9000) el("text", { x: f.x(sx / 2), y: f.y(1) + 31, "text-anchor": "middle", class: "viz-small viz-muted", text: "current practice" }, f.inner);
      if (sx < 50000) el("text", { x: f.x((sx + LMAX) / 2), y: f.y(0) - 26, "text-anchor": "middle", class: "viz-small viz-muted", text: "Best on average:" }, f.inner);
      if (sx < 50000) el("text", { x: f.x((sx + LMAX) / 2), y: f.y(0) - 11, "text-anchor": "middle", class: "viz-small viz-muted", text: "new policy" }, f.inner);
      el("path", { d: V.line(grid.map(function (g) { return [f.x(g.lam), f.y(g.p)]; })), class: "stroke s1" }, f.inner);
      el("line", { x1: f.x(lam), x2: f.x(lam), y1: f.y(0), y2: f.y(1), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);
      el("circle", { cx: f.x(lam), cy: f.y(cur.p), r: 6, class: "dot s1" }, f.inner);

      // EVPI curve
      clear(c2);
      var emax = 0; grid.forEach(function (g) { emax = Math.max(emax, g.evpi); });
      var ytop = emax <= 2 ? 2 : emax <= 5 ? 5 : Math.ceil(emax / 5) * 5;
      var f2 = V.frame(c2, { x: [0, LMAX], y: [0, ytop], xTicks: [0, 10000, 20000, 30000, 40000, 50000, 60000], fmtX: thousands, yTicks: V.ticks(0, ytop, 4), xLabel: "Threshold (SAR per DALY)", yLabel: "EVPI (SAR m)" });
      el("path", { d: V.area(grid.map(function (g) { return [f2.x(g.lam), f2.y(g.evpi)]; }), grid.map(function (g) { return [f2.x(g.lam), f2.y(0)]; })), class: "fill-soft s4" }, f2.inner);
      el("path", { d: V.line(grid.map(function (g) { return [f2.x(g.lam), f2.y(g.evpi)]; })), class: "stroke s4" }, f2.inner);
      el("line", { x1: f2.x(lam), x2: f2.x(lam), y1: f2.y(0), y2: f2.y(ytop), class: "edge strong", "stroke-dasharray": "4 4" }, f2.inner);
      el("circle", { cx: f2.x(lam), cy: f2.y(cur.evpi), r: 6, class: "dot s4" }, f2.inner);

      // Readouts and verdict
      var pick = cur.enb > 0 ? "New policy" : cur.enb < 0 ? "Current practice" : "Either";
      out.p(V.fmt.pct(cur.p));
      out.enb(V.fmt.signed(cur.enb, 1));
      out.pick(pick);
      out.evpi(V.fmt.num(cur.evpi, 1));
      var pc = V.fmt.pct(cur.p), t;
      if (cur.p > 0.5 && cur.enb < 0) t = "Trap: the new policy wins in " + pc + " of runs, yet its expected NMB is negative. It wins by a little and loses by a lot. Choose current practice.";
      else if (cur.p < 0.5 && cur.enb > 0) t = "The new policy wins in only " + pc + " of runs, yet its expected NMB is positive: it wins by a lot when it wins. Choose the new policy.";
      else if (cur.enb === 0) t = "Both options have the same expected NMB.";
      else t = "Choose " + pick.toLowerCase() + ": it has the higher expected NMB. The new policy wins in " + pc + " of runs.";
      if (cur.evpi < 0.1) t += " EVPI is near zero: the same option wins in almost every run, so research could hardly change the decision.";
      else if (Math.abs(lam - switchAt) <= 3000) t += " The threshold is near the ICER, so the decision is close and EVPI is near its peak.";
      verdict.innerHTML = "";
      el("strong", { text: "Verdict: " }, verdict);
      verdict.appendChild(document.createTextNode(t));
    }
    draw();
  });
})();
