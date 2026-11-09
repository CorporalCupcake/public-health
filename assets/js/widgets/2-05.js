// Lecture 2.5 — Random error: repeated-sampling confidence intervals, and the
// "significance filter" (winner's curse / type M error). Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation to erf).
  function Phi(z) {
    var s = z < 0 ? -1 : 1, x = Math.abs(z) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + s * y);
  }
  // Student t quantile from the normal quantile (Cornish–Fisher expansion; fine for df ≥ 9).
  function tq(z, df) {
    var z3 = z * z * z, z5 = z3 * z * z;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
  }

  // ---------------------------------------------------------------------------
  // Repeated-sampling CI simulator.
  // Truth: mean salt intake 10 g/day, between-person SD 4 g/day.
  V.register("ci-coverage", function (root) {
    var TRUE = 10, SD = 4, K = 50;
    var NS = [10, 20, 50, 100, 200, 500, 1000, 2000];
    var LEVELS = { 80: 1.2816, 95: 1.96, 99: 2.5758 };
    var batch = 0, hits = 0, total = 0;

    var ctr = V.controls(root);
    var sn = V.slider(ctr, { label: "People per study (sample size)", min: 0, max: NS.length - 1, step: 1, value: 3, fmt: function (i) { return V.fmt.int(NS[i]); }, onInput: function () { reset(); } });
    var lvl = V.toggle(ctr, { options: [{ value: 80, label: "80% CI" }, { value: 95, label: "95% CI" }, { value: 99, label: "99% CI" }], value: 95, onChange: function () { reset(); } });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.6rem" }, root);
    V.button(row, "Run 50 more studies", function () { batch++; draw(); });
    V.button(row, "Start again", function () { reset(); });

    V.legend(root, [
      { cls: "s1", label: "Interval covers the true mean" },
      { cls: "s3", label: "Interval misses it" },
      { cls: "s2", label: "True mean (10 g/day)", dashed: true }
    ]);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Fifty confidence intervals from fifty simulated studies, with the true mean marked; misses are shown in red");

    var out = V.readouts(root, [
      { key: "batch", label: "This batch: intervals that cover the truth" },
      { key: "all", label: "All batches so far", cls: "good" },
      { key: "width", label: "Typical half-width (precision)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each study samples people whose usual salt intake averages 10 g/day (SD 4 g/day between people) and reports a t-based interval for the mean. No bias is simulated: this is random error only." }, root);

    function reset() { batch = 0; hits = 0; total = 0; draw(); }

    function draw() {
      var n = NS[sn.value()], level = lvl.value(), z = LEVELS[level];
      var crit = tq(z, n - 1);
      var rand = V.rng(1000 + 97 * sn.value() + 13 * level + 7919 * batch);
      clear(c);
      var f = V.frame(c, { x: [4, 16], y: [0, K + 1], yTicks: [], margin: { top: 30, left: 30 }, xLabel: "Each study’s estimate of mean salt intake, with its interval (g/day)" });
      var g = f.inner, inBatch = 0, wsum = 0;
      el("line", { x1: f.x(TRUE), x2: f.x(TRUE), y1: f.y(0), y2: f.y(K + 1), class: "stroke s2 dashed" }, g);
      el("text", { x: f.x(TRUE), y: 18, "text-anchor": "middle", class: "viz-small colour s2", text: "true mean 10 g/day" }, g);
      for (var k = 0; k < K; k++) {
        var s = 0, ss = 0;
        for (var i = 0; i < n; i++) { var v = TRUE + SD * V.normal(rand); s += v; ss += v * v; }
        var m = s / n, sd = Math.sqrt(Math.max(0, (ss - n * m * m) / (n - 1)));
        var h = crit * sd / Math.sqrt(n), lo = m - h, hi = m + h, ok = lo <= TRUE && TRUE <= hi;
        if (ok) inBatch++;
        wsum += h;
        var y = f.y(K - k), cls = ok ? "s1" : "s3";
        el("line", { x1: f.x(Math.max(4, lo)), x2: f.x(Math.min(16, hi)), y1: y, y2: y, class: "stroke " + cls, "stroke-width": 2 }, g);
        el("circle", { cx: f.x(Math.max(4, Math.min(16, m))), cy: y, r: 2.2, class: "dot " + cls }, g);
      }
      hits += inBatch; total += K;
      out.batch(inBatch + " / " + K);
      out.all(V.fmt.pct1(hits / total) + " of " + V.fmt.int(total));
      out.width("± " + V.fmt.num(wsum / K, 2) + " g");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // The significance filter: with low power, the results that reach p < 0.05
  // exaggerate the true effect. Fixed draws so sliding is smooth.
  V.register("winners-curse", function (root) {
    var NSTUDY = 400, EV = [10, 20, 30, 50, 100, 200, 500, 1000, 2000];
    var rand = V.rng(2025), Z = [], J = [];
    for (var i = 0; i < NSTUDY; i++) { Z.push(V.normal(rand)); J.push(rand()); }

    var ctr = V.controls(root);
    var sr = V.slider(ctr, { label: "True relative risk", min: 1.05, max: 2, step: 0.05, value: 1.2, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var se = V.slider(ctr, { label: "Outcome events per group (study size)", min: 0, max: EV.length - 1, step: 1, value: 3, fmt: function (i) { return V.fmt.int(EV[i]); }, onInput: draw });

    V.legend(root, [
      { cls: "s2", label: "Study reached p < 0.05 (gets the headline)" },
      { cls: "s5", label: "Not significant (often unpublished)" },
      { cls: "s1", label: "True RR", dashed: true }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Dot plot of 400 simulated study estimates on a log relative-risk axis; significant ones highlighted, with the true value and the average significant estimate marked");

    var out = V.readouts(root, [
      { key: "power", label: "Power: share of studies reaching p < 0.05" },
      { key: "sig", label: "Average RR among significant studies", cls: "bad" },
      { key: "m", label: "Exaggeration of the log RR (type M)", cls: "bad" },
      { key: "s", label: "Significant results pointing the wrong way (type S)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Standard error of the log RR ≈ √(2 ÷ events per group). Readouts are exact for this model; the 400 dots are one simulated literature." }, root);

    var LX = [Math.log(0.25), Math.log(8)];
    function draw() {
      var th = Math.log(sr.value()), sd = Math.sqrt(2 / EV[se.value()]), cut = 1.96 * sd;
      clear(c);
      var f = V.frame(c, { x: LX, y: [0, 1], yTicks: [], margin: { top: 44, left: 24 },
        xTicks: [0.25, 0.5, 1, 2, 4, 8].map(Math.log), fmtX: function (t) { return +Math.exp(t).toFixed(2) + ""; },
        xLabel: "Estimated relative risk (log scale)" });
      var g = f.inner;
      function cx(v) { return f.x(Math.max(LX[0], Math.min(LX[1], v))); }
      el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(0), y2: f.y(1), class: "edge" }, g);
      el("text", { x: f.x(0) - 6, y: f.y(1) - 6, "text-anchor": "end", class: "viz-small viz-muted", text: "no effect" }, g);
      var sigSum = 0, sigN = 0;
      Z.forEach(function (z, i) {
        var est = th + sd * z, sig = Math.abs(est) > cut;
        if (sig) { sigSum += est; sigN++; }
        el("circle", { cx: cx(est), cy: f.y(0.05 + 0.9 * J[i]), r: sig ? 3 : 2.6, class: sig ? "dot s2" : "fill-soft s5" }, g);
      });
      el("line", { x1: f.x(th), x2: f.x(th), y1: f.y(0), y2: f.y(1), class: "stroke s1 dashed" }, g);
      el("text", { x: f.x(th), y: 16, "text-anchor": "middle", class: "viz-small colour s1", text: "true " + sr.value().toFixed(2) }, g);
      if (sigN) {
        var ms = sigSum / sigN;
        el("line", { x1: cx(ms), x2: cx(ms), y1: f.y(0), y2: f.y(1), class: "stroke s2" }, g);
        el("text", { x: cx(ms), y: 32, "text-anchor": "middle", class: "viz-small colour s2", text: "average significant " + Math.exp(ms).toFixed(2) }, g);
      }

      // Exact quantities by numerical integration over est ~ N(th, sd).
      var lo = th - 8 * sd, hi = th + 8 * sd, N = 4000, dx = (hi - lo) / N, pS = 0, absS = 0, sumS = 0, wrong = 0;
      for (var k = 0; k < N; k++) {
        var x = lo + (k + 0.5) * dx, d = Math.exp(-0.5 * Math.pow((x - th) / sd, 2)) / (sd * Math.sqrt(2 * Math.PI)) * dx;
        if (Math.abs(x) > cut) { pS += d; absS += Math.abs(x) * d; sumS += x * d; if (x < 0) wrong += d; }
      }
      var power = 1 - Phi((cut - th) / sd) + Phi((-cut - th) / sd);
      out.power(V.fmt.pct(power));
      out.sig(Math.exp(sumS / pS).toFixed(2));
      out.m("× " + V.fmt.num(absS / pS / th, 1));
      out.s(V.fmt.pct1(wrong / pS));
    }
    draw();
  });
})();
