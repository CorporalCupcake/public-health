// Lecture 3.4 — Complex surveys: (1) design effect from cluster sampling; (2) oversampling and weights.
// Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function seeded(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  // Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf).
  function pnorm(z) {
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }

  // ---------------------------------------------------------------------------
  V.register("survey-deff", function (root) {
    var NT = 1200, MU = 125, SD = 15, R = 80, seed = 34001;

    var ctr = V.controls(root);
    var sRho = V.slider(ctr, { label: "Intra-cluster correlation (ρ)", min: 0, max: 0.3, step: 0.01, value: 0.05, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sM = V.slider(ctr, { label: "People per cluster (m)", min: 1, max: 60, step: 1, value: 20, onInput: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Biomarker, weak clustering (ρ 0.02)", 0.02, 20], ["Diet in villages (ρ 0.10)", 0.1, 20], ["Same ρ, smaller clusters", 0.1, 5]].forEach(function (p) {
      V.button(pre, p[0], function () { sRho.set(p[1]); sM.set(p[2]); draw(); });
    });
    V.button(pre, "New samples", function () { seed += 7919; draw(); });

    V.legend(root, [{ cls: "s1", label: "Simple random sample" }, { cls: "s3", label: "Cluster sample" }, { cls: "s5", label: "True mean", dashed: true }]);
    var c1 = V.svg(root, 640, 200);
    c1.setAttribute("aria-label", "Strip plot of 80 repeated survey estimates of mean blood pressure under simple random sampling and under cluster sampling");
    var c2 = V.svg(root, 640, 220);
    c2.setAttribute("aria-label", "Effective sample size against cluster size for the chosen intra-cluster correlation");
    var out = V.readouts(root, [
      { key: "deff", label: "Design effect, 1 + (m − 1)ρ" },
      { key: "neff", label: "Effective sample size (of 1,200)", cls: "good" },
      { key: "ciS", label: "95% CI half-width (mmHg), simple random sample" },
      { key: "ciC", label: "95% CI half-width (mmHg), cluster sample" },
      { key: "cov", label: "Coverage if you analyse the cluster sample as SRS", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: systolic blood pressure, mean 125 mmHg, SD 15. Each dot is the mean from one simulated survey of about 1,200 people; shaded bands span ±1.96 standard errors around the truth." }, root);

    function draw() {
      var rho = sRho.value(), m = sM.value(), k = Math.max(1, Math.round(NT / m)), n = k * m;
      var deff = 1 + (m - 1) * rho, se0 = SD / Math.sqrt(n), se1 = se0 * Math.sqrt(deff);
      var rand = seeded(seed + Math.round(rho * 100) * 61 + m * 7);

      clear(c1);
      var span = 4.5, L = 160, Rr = 624, xs = V.scale(MU - span, MU + span, L, Rr);
      [-4, -2, 0, 2, 4].forEach(function (d) {
        el("line", { x1: xs(MU + d), x2: xs(MU + d), y1: 18, y2: 166, class: "viz-grid" }, c1);
        el("text", { x: xs(MU + d), y: 182, "text-anchor": "middle", class: "viz-tick", text: String(MU + d) }, c1);
      });
      el("text", { x: (L + Rr) / 2, y: 198, "text-anchor": "middle", class: "viz-label", text: "Estimated mean systolic BP (mmHg)" }, c1);
      [[58, "Simple random", "sample", se0, "s1", false], [128, "Cluster sample", k + " clusters × " + m, se1, "s3", true]].forEach(function (row) {
        var y = row[0], se = row[3];
        el("rect", { x: xs(Math.max(MU - span, MU - 1.96 * se)), y: y - 22, width: xs(Math.min(MU + span, MU + 1.96 * se)) - xs(Math.max(MU - span, MU - 1.96 * se)), height: 44, rx: 6, class: "fill-soft " + row[4] }, c1);
        el("text", { x: L - 12, y: y - 3, "text-anchor": "end", class: "viz-small viz-bold", text: row[1] }, c1);
        el("text", { x: L - 12, y: y + 13, "text-anchor": "end", class: "viz-small viz-muted", text: row[2] }, c1);
        for (var i = 0; i < R; i++) {
          var est = row[5] ? MU + V.normal(rand) * SD * Math.sqrt(rho / k) + V.normal(rand) * SD * Math.sqrt((1 - rho) / n)
                           : MU + V.normal(rand) * se0;
          var jit = (rand() - 0.5) * 30, cx = Math.max(L, Math.min(Rr, xs(est)));
          el("circle", { cx: cx, cy: y + jit, r: 3, class: "dot " + row[4], "fill-opacity": 0.75 }, c1);
        }
      });
      el("line", { x1: xs(MU), x2: xs(MU), y1: 18, y2: 166, class: "stroke s5 dashed", "stroke-width": 1.5 }, c1);

      clear(c2);
      var f = V.frame(c2, { x: [1, 60], y: [0, 1200], xTicks: [1, 10, 20, 30, 40, 50, 60], yTicks: [0, 300, 600, 900, 1200], fmtY: V.fmt.int, margin: { left: 58, top: 18 }, xLabel: "People per cluster (m), total n fixed near 1,200", yLabel: "Effective n" });
      var pts = [];
      for (var mm = 1; mm <= 60; mm++) pts.push([f.x(mm), f.y(Math.round(NT / mm) * mm / (1 + (mm - 1) * rho))]);
      el("path", { d: V.line(pts), class: "stroke s3" }, f.inner);
      var ne = n / deff;
      el("line", { x1: f.x(m), x2: f.x(m), y1: f.y(0), y2: f.y(ne), class: "viz-grid", "stroke-dasharray": "4 4" }, f.inner);
      el("circle", { cx: f.x(m), cy: f.y(ne), r: 6, class: "dot s3" }, f.inner);
      var right = m > 40;
      el("text", { x: f.x(m) + (right ? -10 : 10), y: Math.max(30, f.y(ne) - 10), "text-anchor": right ? "end" : "start", class: "viz-small viz-bold", text: "effective n ≈ " + V.fmt.int(ne) }, f.inner);

      out.deff(deff.toFixed(2));
      out.neff(V.fmt.int(ne));
      out.ciS("±" + (1.96 * se0).toFixed(2));
      out.ciC("±" + (1.96 * se1).toFixed(2));
      out.cov(V.fmt.pct(2 * pnorm(1.96 / Math.sqrt(deff)) - 1));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  V.register("survey-weights", function (root) {
    var BASE = 120, NPOP = 10e6, NS = 5000;

    var ctr = V.controls(root);
    var sP = V.slider(ctr, { label: "Group A’s share of the population", min: 5, max: 40, step: 1, value: 12, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sS = V.slider(ctr, { label: "Group A’s share of the sample (oversampling)", min: 5, max: 70, step: 1, value: 40, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sD = V.slider(ctr, { label: "Group A’s mean SBP minus others’ (mmHg)", min: 0, max: 20, step: 1, value: 12, fmt: function (v) { return "+" + v; }, onInput: draw });

    var c = V.svg(root, 640, 270);
    c.setAttribute("aria-label", "Bars showing group A's share of the population and of the sample, then the true, unweighted and weighted mean blood pressure on one axis");
    var out = V.readouts(root, [
      { key: "wA", label: "Weight of each group A respondent (people represented)" },
      { key: "wB", label: "Weight of each other respondent" },
      { key: "bias", label: "Unweighted mean minus truth", cls: "bad" },
      { key: "wbias", label: "Weighted mean minus truth", cls: "good" },
      { key: "kish", label: "Precision cost of the weights (Kish design effect, 1 + CV²)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 10 million adults, 5,000 respondents; others’ mean SBP 120 mmHg. Expected values with no sampling noise, so the weighted mean is exactly right; in a real survey it is right on average." }, root);

    function draw() {
      var pA = sP.value() / 100, sA = sS.value() / 100, d = sD.value();
      var truth = BASE + pA * d, naive = BASE + sA * d, weighted = truth;
      var rA = pA / sA, rB = (1 - pA) / (1 - sA);
      var kish = sA * rA * rA + (1 - sA) * rB * rB;

      clear(c);
      var L = 150, R = 624;
      [[24, "Population", pA], [70, "Survey sample", sA]].forEach(function (row) {
        var y = row[0], w = (R - L) * row[2];
        el("text", { x: L - 12, y: y + 17, "text-anchor": "end", class: "viz-small viz-bold", text: row[1] }, c);
        el("rect", { x: L, y: y, width: R - L, height: 26, class: "fill-soft s5" }, c);
        el("rect", { x: L, y: y, width: w, height: 26, class: "fill s2" }, c);
        el("text", { x: w > 70 ? L + 8 : L + w + 8, y: y + 17, class: "viz-small viz-bold", text: "A " + Math.round(row[2] * 100) + "%" }, c);
        el("text", { x: R - 8, y: y + 17, "text-anchor": "end", class: "viz-small", text: "others " + Math.round((1 - row[2]) * 100) + "%" }, c);
      });

      var lo = 118, hi = 136, xs = V.scale(lo, hi, L, R), top = 128, bot = 236;
      for (var t = lo; t <= hi; t += 2) {
        el("line", { x1: xs(t), x2: xs(t), y1: top, y2: bot, class: "viz-grid" }, c);
        el("text", { x: xs(t), y: bot + 16, "text-anchor": "middle", class: "viz-tick", text: String(t) }, c);
      }
      el("text", { x: (L + R) / 2, y: 268, "text-anchor": "middle", class: "viz-label", text: "Mean systolic BP (mmHg)" }, c);
      el("line", { x1: xs(truth), x2: xs(truth), y1: top - 6, y2: bot, class: "stroke s5 dashed", "stroke-width": 1.5 }, c);
      [[148, "Truth (population)", truth, "s5"], [182, "Unweighted mean", naive, "s3"], [216, "Weighted mean", weighted, "s1"]].forEach(function (r) {
        el("text", { x: L - 12, y: r[0] + 4, "text-anchor": "end", class: "viz-small", text: r[1] }, c);
        var x = xs(Math.max(lo, Math.min(hi, r[2])));
        el("circle", { cx: x, cy: r[0], r: 7, class: "dot " + r[3] }, c);
        var rightSide = x < R - 60;
        el("text", { x: rightSide ? x + 12 : x - 12, y: r[0] + 4, "text-anchor": rightSide ? "start" : "end", class: "viz-small viz-bold colour " + r[3], text: r[2].toFixed(1) }, c);
      });

      out.wA(V.fmt.int(pA * NPOP / (sA * NS)));
      out.wB(V.fmt.int((1 - pA) * NPOP / ((1 - sA) * NS)));
      out.bias(V.fmt.signed(naive - truth, 1) + " mmHg");
      out.wbias(V.fmt.signed(weighted - truth, 1) + " mmHg");
      out.kish(kish.toFixed(2));
    }
    draw();
  });
})();
