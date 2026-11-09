// Lecture 2.3 — case-control sampling from a simulated cohort. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // A closed cohort of 40,000 people, 30% exposed, followed for one period.
  // Exposure doubles the disease rate (constant hazards). All cases are taken,
  // plus m controls per case from one of three pools. Exposed people can be made
  // more (or less) likely to be picked as controls.
  V.register("cc-sample", function (root) {
    var N = 40000, PEXP = 0.3, HR = 2;
    var rand = V.rng(11);
    for (var w0 = 0; w0 < 200; w0++) rand();
    var EXP = [], E = [];
    for (var i = 0; i < N; i++) { EXP.push(rand() < PEXP); E.push(-Math.log(rand())); }
    var seed = 1;

    var ctr = V.controls(root);
    var sp = V.slider(ctr, { label: "Risk of disease in the unexposed over follow-up", min: 1, max: 50, step: 1, value: 2, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sm = V.slider(ctr, { label: "Controls per case", min: 1, max: 10, step: 1, value: 2, fmt: String, onInput: draw });
    var sk = V.slider(ctr, { label: "Exposed people’s chance of being picked as controls", min: 0.5, max: 2, step: 0.05, value: 1, fmt: function (v) { return "×" + v.toFixed(2) + (Math.abs(v - 1) < 1e-9 ? " (fair)" : ""); }, onInput: draw });
    var pool = V.toggle(root, { options: [
      { value: "cum", label: "Controls: non-cases at the end" },
      { value: "base", label: "Controls: everyone at the start" },
      { value: "rs", label: "Controls: at risk at each case’s time" }
    ], value: "cum", onChange: draw });
    var bwrap = el("div", { class: "widget-controls" }, root);
    V.button(bwrap, "Draw a new sample of controls", function () { seed += 1; draw(); });

    var c = V.svg(root, 640, 250);
    c.setAttribute("aria-label", "The case-control estimate with its confidence interval, compared with the risk ratio, rate ratio and odds ratio from the full cohort, on a log scale");
    var out = V.readouts(root, [
      { key: "cases", label: "Cases: exposed / unexposed" },
      { key: "ctrl", label: "Controls: exposed / unexposed" },
      { key: "est", label: "Case-control odds ratio" },
      { key: "tgt", label: "What this design targets (full cohort)", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Exposure truly doubles the disease rate. With controls drawn at each case’s time, the estimate is the matched (Mantel–Haenszel) odds ratio. The bar is an approximate 95% confidence interval." }, root);

    function draw() {
      var p0 = sp.value() / 100, m = sm.value(), k = sk.value(), mode = pool.value();
      var lam0 = -Math.log(1 - p0), lam1 = lam0 * HR;

      // cohort
      var end = new Array(N), cas = new Array(N), cases = [], nonc = [];
      var a = 0, b = 0, n1 = 0, n0 = 0, pt1 = 0, pt0 = 0;
      for (var i = 0; i < N; i++) {
        var t = E[i] / (EXP[i] ? lam1 : lam0);
        cas[i] = t <= 1; end[i] = Math.min(t, 1);
        if (EXP[i]) { n1++; pt1 += end[i]; if (cas[i]) a++; } else { n0++; pt0 += end[i]; if (cas[i]) b++; }
        if (cas[i]) cases.push(i); else nonc.push(i);
      }
      var truth = {
        rr: (a / n1) / (b / n0),
        rate: (a / pt1) / (b / pt0),
        or: (a / (n1 - a)) / (b / (n0 - b))
      };

      // sampling
      var r = V.rng(1000 + seed * 7919);
      for (var w = 0; w < 200; w++) r();
      var wmax = Math.max(k, 1);
      function pick(arr, lo) {   // weighted pick from arr[lo..]
        for (var tries = 0; tries < 1000; tries++) {
          var j = arr[lo + Math.floor(r() * (arr.length - lo))];
          if (r() < (EXP[j] ? k : 1) / wmax) return j;
        }
        return arr[lo];
      }
      var ce = 0, cu = 0, est, num = 0, den = 0;
      if (mode === "rs") {
        var order = []; for (i = 0; i < N; i++) order.push(i);
        order.sort(function (x, y) { return end[x] - end[y]; });
        for (var q = 0; q < N; q++) {
          var id = order[q];
          if (!cas[id] || q === N - 1) continue;
          var e = 0;
          for (var s = 0; s < m; s++) { if (EXP[pick(order, q + 1)]) e++; }
          ce += e; cu += m - e;
          if (EXP[id]) num += (m - e) / (m + 1); else den += e / (m + 1);
        }
        est = num / den;
      } else {
        var src = mode === "cum" ? nonc : (function () { var all = []; for (var i2 = 0; i2 < N; i2++) all.push(i2); return all; })();
        for (var s2 = 0; s2 < m * cases.length; s2++) { if (EXP[pick(src, 0)]) ce++; else cu++; }
        est = (a / b) / (ce / cu);
      }
      var se = Math.sqrt(1 / a + 1 / b + 1 / ce + 1 / cu);
      var lo = est * Math.exp(-1.96 * se), hi = est * Math.exp(1.96 * se);

      var tgtKey = mode === "cum" ? "or" : (mode === "base" ? "rr" : "rate");
      var tgtName = { or: "Odds ratio", rr: "Risk ratio", rate: "Rate ratio" }[tgtKey];
      out.cases(V.fmt.int(a) + " / " + V.fmt.int(b));
      out.ctrl(V.fmt.int(ce) + " / " + V.fmt.int(cu));
      out.est(V.fmt.num(est, 2));
      out.tgt(tgtName + " " + V.fmt.num(truth[tgtKey], 2));

      // chart: log2 scale from 0.25 to 16
      clear(c);
      var L = function (v) { return Math.log(v) / Math.LN2; };
      var X0 = 214, X1 = 616, x = function (v) { return X0 + (Math.max(-2, Math.min(4, L(v))) + 2) / 6 * (X1 - X0); };
      var rows = [
        { y: 34, label: "Case-control estimate", key: "est" },
        { y: 92, label: "Risk ratio, full cohort", key: "rr" },
        { y: 136, label: "Rate ratio, full cohort", key: "rate" },
        { y: 180, label: "Odds ratio, full cohort", key: "or" }
      ];
      var axisY = 206;
      [0.25, 0.5, 1, 2, 4, 8, 16].forEach(function (t) {
        el("line", { x1: x(t), x2: x(t), y1: 14, y2: axisY, class: "viz-grid" }, c);
        el("text", { x: x(t), y: axisY + 16, "text-anchor": "middle", class: "viz-tick", text: t < 1 ? String(t) : String(t) }, c);
      });
      el("line", { x1: X0, x2: X1, y1: axisY, y2: axisY, class: "viz-axis" }, c);
      el("text", { x: (X0 + X1) / 2, y: axisY + 38, "text-anchor": "middle", class: "viz-label", text: "Ratio (log scale)" }, c);
      el("line", { x1: 8, x2: X1, y1: 63, y2: 63, class: "viz-grid" }, c);

      // estimate row
      var ey = rows[0].y;
      el("line", { x1: x(est), x2: x(est), y1: ey, y2: axisY, class: "edge", "stroke-dasharray": "4 4" }, c);
      el("line", { x1: x(lo), x2: x(hi), y1: ey, y2: ey, class: "stroke s4" }, c);
      el("circle", { cx: x(est), cy: ey, r: 7, class: "dot s4" }, c);
      el("text", { x: x(est), y: ey - 13, "text-anchor": "middle", class: "viz-small viz-bold colour s4", text: V.fmt.num(est, 2) }, c);

      rows.forEach(function (row, idx) {
        var isT = row.key === tgtKey;
        el("text", { x: 8, y: row.y + 4, class: "viz-small" + (idx === 0 || isT ? " viz-bold" : " viz-muted"), text: row.label }, c);
        if (idx === 0) return;
        var v = truth[row.key];
        el("circle", { cx: x(v), cy: row.y, r: isT ? 7 : 5, class: "dot " + (isT ? "s1" : "s5") }, c);
        el("text", { x: 204, y: row.y + 4, "text-anchor": "end", class: "viz-small" + (isT ? " viz-bold colour s1" : " viz-muted"), text: V.fmt.num(v, 2) }, c);
      });
    }
    draw();
  });
})();
