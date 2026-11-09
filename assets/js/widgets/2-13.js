// Lecture 2.13 — E-value curve, and a simple / probabilistic unmeasured-confounder adjuster. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function f2(x) { return x.toFixed(2); }
  // E-value for a risk ratio (VanderWeele & Ding 2017); protective ratios are inverted first.
  function evalue(rr) { if (rr < 1) rr = 1 / rr; return rr + Math.sqrt(rr * (rr - 1)); }

  // ---------------------------------------------------------------------------
  // E-value: every (RR_EU, RR_UD) pair on or above the curve could explain the estimate away.
  V.register("evalue-curve", function (root) {
    var ctr = V.controls(root);
    var sRR = V.slider(ctr, { label: "Observed risk ratio", min: 1.1, max: 5, step: 0.05, value: 2, fmt: f2, onInput: draw });
    var sLo = V.slider(ctr, { label: "Lower 95% limit (the one nearer 1)", min: 0.8, max: 5, step: 0.05, value: 1.5, fmt: f2, onInput: draw });
    var sA = V.slider(ctr, { label: "Suspected confounder: RR with the exposure", min: 1, max: 10, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sB = V.slider(ctr, { label: "Suspected confounder: RR with the outcome", min: 1, max: 10, step: 0.1, value: 2.5, fmt: function (v) { return v.toFixed(1); }, onInput: draw });

    V.legend(root, [
      { cls: "s3", label: "Strong enough to explain away the point estimate" },
      { cls: "s2", label: "Strong enough to pull the CI limit to 1", dashed: true },
      { cls: "s4", label: "Your suspected confounder" }
    ]);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Curve of confounder strengths that could explain away the observed risk ratio, with the E-value on the diagonal");
    var f = V.frame(c, { x: [1, 10], y: [1, 10], xTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      xLabel: "How much more common the confounder is in the exposed (RR, exposure–confounder)", yLabel: "How much it raises outcome risk (RR)" });
    var g = f.inner;
    el("line", { x1: f.x(1), y1: f.y(1), x2: f.x(10), y2: f.y(10), class: "viz-grid", "stroke-dasharray": "3 4" }, g);
    el("text", { x: f.x(9.6), y: f.y(9.6) + 16, "text-anchor": "end", class: "viz-small viz-muted", text: "equal strength" }, g);
    var region = el("path", { class: "fill-soft s3" }, g);
    var curve = el("path", { class: "stroke s3" }, g);
    var ciCurve = el("path", { class: "stroke s2 dashed" }, g);
    var eDot = el("circle", { r: 5, class: "dot s3" }, g);
    var eTxt = el("text", { class: "viz-small viz-bold colour s3" }, g);
    var ciDot = el("circle", { r: 4.5, class: "dot s2" }, g);
    var ciTxt = el("text", { class: "viz-small viz-bold colour s2" }, g);
    var you = el("circle", { r: 6, class: "dot s4" }, g);

    var out = V.readouts(root, [
      { key: "e", label: "E-value for the point estimate", cls: "bad" },
      { key: "eci", label: "E-value for the CI limit" },
      { key: "b", label: "Your confounder: most it could divide the RR by" },
      { key: "adj", label: "Point estimate after that worst case" },
      { key: "verdict", label: "Verdict for your confounder" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. The curve uses the bounding factor RR_EU × RR_UD ÷ (RR_EU + RR_UD − 1). It is a worst case: real confounders usually shift the estimate less than this." }, root);

    function curvePts(t) {
      // RR_UD needed for each RR_EU so that the bounding factor equals t
      var pts = [], a0 = Math.max(t * 1.0001, 9 * t / (10 - t));
      if (t >= 10) return pts;
      for (var i = 0; i <= 120; i++) {
        var a = a0 + (10 - a0) * i / 120, b = t * (a - 1) / (a - t);
        if (b <= 10.0001) pts.push([f.x(a), f.y(Math.min(10, b))]);
      }
      return pts;
    }

    function draw() {
      var rr = sRR.value(), lo = Math.min(sLo.value(), rr);
      var e = evalue(rr), eci = lo <= 1 ? 1 : evalue(lo);
      var pts = curvePts(rr);
      curve.setAttribute("d", V.line(pts));
      var top = pts.map(function (p) { return [p[0], f.y(10)]; });
      region.setAttribute("d", pts.length ? V.area(top, pts) : "");
      if (lo > 1.0001 && lo < rr - 0.0001) { ciCurve.setAttribute("d", V.line(curvePts(lo))); ciCurve.style.display = ""; }
      else ciCurve.style.display = "none";

      eDot.setAttribute("cx", f.x(e)); eDot.setAttribute("cy", f.y(e));
      eTxt.setAttribute("x", f.x(e) + 9); eTxt.setAttribute("y", f.y(e) - 9);
      eTxt.textContent = "E = " + f2(e);
      var showCi = lo > 1.0001 && lo < rr - 0.0001;
      ciDot.style.display = ciTxt.style.display = showCi ? "" : "none";
      ciDot.setAttribute("cx", f.x(eci)); ciDot.setAttribute("cy", f.y(eci));
      ciTxt.setAttribute("x", f.x(eci) + 9); ciTxt.setAttribute("y", f.y(eci) - 9);
      ciTxt.textContent = "E (CI) = " + f2(eci);

      var a = sA.value(), b = sB.value(), B = a * b / (a + b - 1);
      you.setAttribute("cx", f.x(a)); you.setAttribute("cy", f.y(b));

      out.e(f2(e));
      out.eci(lo <= 1 ? "1 (CI already includes 1)" : f2(eci));
      out.b(f2(B));
      out.adj(f2(rr / B));
      out.verdict(B >= rr ? "Could explain it all away" : (B >= lo ? "Could pull the CI to 1" : "Too weak to explain it"));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Simple and probabilistic bias analysis for one binary unmeasured confounder.
  V.register("confounder-adjust", function (root) {
    var N = 4000, LO = Math.log(0.25), HI = Math.log(4);
    var rand = V.rng(2013), U = [];
    for (var i = 0; i < N; i++) U.push([rand(), rand(), rand()]);
    function tri(u, c, h) { return u < 0.5 ? c - h + h * Math.sqrt(2 * u) : c + h - h * Math.sqrt(2 * (1 - u)); }
    function clamp01(p) { return Math.max(0, Math.min(1, p)); }
    function bias(p1, p0, r) { return (p1 * (r - 1) + 1) / (p0 * (r - 1) + 1); }

    var ctr = V.controls(root);
    var sObs = V.slider(ctr, { label: "Observed risk ratio (treated vs untreated)", min: 0.3, max: 3, step: 0.01, value: 0.8, fmt: f2, onInput: draw });
    var sP1 = V.slider(ctr, { label: "Confounder prevalence in the exposed", min: 0, max: 100, step: 1, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sP0 = V.slider(ctr, { label: "Confounder prevalence in the unexposed", min: 0, max: 100, step: 1, value: 40, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sR = V.slider(ctr, { label: "How much the confounder raises outcome risk (RR)", min: 1, max: 8, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sW = V.slider(ctr, { label: "Uncertainty in the prevalences (probabilistic only)", min: 0, max: 25, step: 1, value: 10, fmt: function (v) { return "± " + v + " points"; }, onInput: draw });
    var mode = V.toggle(root, { options: [{ value: "simple", label: "Simple (one value each)" }, { value: "prob", label: "Probabilistic (4,000 draws)" }], value: "simple", onChange: draw });

    V.legend(root, [
      { cls: "s5", label: "Observed estimate" },
      { cls: "s1", label: "Bias-adjusted estimate" },
      { cls: "s1", label: "95% simulation interval (probabilistic)", dashed: true }
    ]);
    var c = V.svg(root, 640, 250);
    c.setAttribute("aria-label", "Risk ratio axis on a log scale showing the observed and bias-adjusted estimates, and in probabilistic mode a histogram of adjusted estimates");
    var defs = el("defs", null, c);
    var mk = el("marker", { id: "l213-adj-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
    el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead accent" }, mk);
    var tv = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
    var f = V.frame(c, { x: [LO, HI], y: [0, 1], yTicks: [], xTicks: tv.map(Math.log), fmtX: function (v) { return Math.abs(v) < 1e-9 ? "1 = no effect" : String(+Math.exp(v).toFixed(2)); }, xLabel: "Risk ratio (log scale)", margin: { left: 20, right: 20 } });
    var gH = el("g", null, f.inner), gT = el("g", null, f.inner);
    el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(0), y2: f.y(1), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);

    var out = V.readouts(root, [
      { key: "bf", label: "Bias factor (how much confounding inflates or shrinks the RR)" },
      { key: "adj", label: "Bias-adjusted RR (median if probabilistic)", cls: "good" },
      { key: "si", label: "95% simulation interval (probabilistic mode)" },
      { key: "cross", label: "Draws where the adjusted RR is on the other side of 1" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Assumes the confounder’s effect on the outcome is the same in both groups. Probabilistic mode varies each prevalence by the ± amount and the confounder RR between ÷1.5 and ×1.5 (triangular distributions); it shows systematic error only, without random error." }, root);

    function X(rr) { return f.x(Math.log(Math.max(0.25, Math.min(4, rr)))); }

    function draw() {
      var obs = sObs.value(), p1 = sP1.value() / 100, p0 = sP0.value() / 100, r = sR.value(), w = sW.value() / 100;
      var B = bias(p1, p0, r), adj = obs / B, prob = mode.value() === "prob";
      clear(gH); clear(gT);
      var mid = adj, lo95 = null, hi95 = null, cross = null;

      if (prob) {
        var vals = [], hr = Math.log(1.5);
        U.forEach(function (u) {
          var q1 = clamp01(tri(u[0], p1, w)), q0 = clamp01(tri(u[1], p0, w));
          var rr = Math.max(1, Math.exp(tri(u[2], Math.log(r), hr)));
          vals.push(obs / bias(q1, q0, rr));
        });
        vals.sort(function (a, b) { return a - b; });
        mid = vals[Math.floor(N / 2)]; lo95 = vals[Math.floor(N * 0.025)]; hi95 = vals[Math.floor(N * 0.975)];
        cross = vals.filter(function (v) { return obs < 1 ? v >= 1 : (obs > 1 ? v <= 1 : false); }).length / N;
        var K = 60, bins = new Array(K).fill(0), bw = (HI - LO) / K;
        vals.forEach(function (v) { var k = Math.floor((Math.log(v) - LO) / bw); if (k >= 0 && k < K) bins[k]++; });
        var mx = Math.max.apply(null, bins) || 1;
        bins.forEach(function (n, k) {
          if (!n) return;
          var h = 0.62 * n / mx;
          el("rect", { x: f.x(LO + k * bw) + 0.5, y: f.y(h), width: Math.max(1, f.x(LO + bw) - f.x(LO) - 1), height: f.y(0) - f.y(h), class: "fill-soft s1" }, gH);
        });
        [lo95, hi95].forEach(function (v) { el("line", { x1: X(v), x2: X(v), y1: f.y(0), y2: f.y(0.64), class: "stroke s1 dashed" }, gH); });
      }

      // observed → adjusted arrow row
      var yRow = f.y(0.84), xo = X(obs), xa = X(mid);
      if (Math.abs(xa - xo) > 14) el("path", { d: "M" + xo + "," + yRow + "L" + (xa + (xa > xo ? -8 : 8)) + "," + yRow, class: "edge accent", "marker-end": "url(#l213-adj-arrow)" }, gT);
      el("circle", { cx: xo, cy: yRow, r: 6, class: "dot s5" }, gT);
      el("circle", { cx: xa, cy: yRow, r: 6, class: "dot s1" }, gT);
      el("text", { x: xo, y: yRow - 13, "text-anchor": "middle", class: "viz-small viz-muted", text: "observed " + f2(obs) }, gT);
      el("text", { x: xa, y: yRow + 22, "text-anchor": "middle", class: "viz-small viz-bold colour s1", text: (prob ? "median " : "adjusted ") + f2(mid) }, gT);

      out.bf(f2(B));
      out.adj(f2(mid));
      out.si(prob ? f2(lo95) + " to " + f2(hi95) : "–");
      out.cross(prob ? V.fmt.pct(cross) : "–");
    }
    draw();
  });
})();
