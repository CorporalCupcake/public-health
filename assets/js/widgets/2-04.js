// Lecture 2.4 — ecological fallacy: within-group vs between-group slopes. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function slope(xs, ys) {
    var n = xs.length, mx = 0, my = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
    return { b: sxy / sxx, mx: mx, my: my };
  }

  // ---------------------------------------------------------------------------
  // Five groups of 40 people. Group means of exposure are 2, 4, 6, 8, 10.
  // Group mean outcome follows the between-group slope; individuals scatter
  // around their group mean following the within-group slope.
  V.register("ecological-fallacy", function (root) {
    var G = 5, n = 40, SX = 0.9, SY = 0.7;
    var rand = V.rng(404);
    for (var w0 = 0; w0 < 200; w0++) rand();
    var Z = [], GN = [];
    for (var g = 0; g < G; g++) {
      GN.push(0.3 * V.normal(rand));
      var zg = [];
      for (var i = 0; i < n; i++) zg.push([V.normal(rand), V.normal(rand)]);
      Z.push(zg);
    }

    var ctr = V.controls(root);
    var sb = V.slider(ctr, { label: "Slope for individuals within each group", min: -2, max: 2, step: 0.1, value: -0.8, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw });
    var sB = V.slider(ctr, { label: "Slope linking the group averages", min: -2, max: 2, step: 0.1, value: 1.2, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw });
    var bw = el("div", { class: "widget-controls" }, root);
    function preset(b, B) { return function () { sb.set(b); sB.set(B); draw(); }; }
    V.button(bw, "Opposite signs", preset(-0.8, 1.2));
    V.button(bw, "Same slope at both levels", preset(1, 1));
    V.button(bw, "No effect on individuals", preset(0, 1.2));

    var leg = V.legend(root, [
      { cls: "s1", label: "Within-group lines (one per group)" },
      { cls: "s5", label: "Dotted: pooled line, all people, groups ignored", dashed: true }
    ]);
    var li = el("span", { class: "widget-legend-item" }, null);
    el("span", { class: "swatch dashed", style: "--sc: var(--text)" }, li);
    el("span", { text: "Dashed: ecological line through the group means" }, li);
    leg.insertBefore(li, leg.children[1]);
    var c = V.svg(root, 640, 340);
    c.setAttribute("aria-label", "Scatter plot of 200 people in five coloured groups, with group means, within-group lines, the ecological line through the means and the pooled line");
    var out = V.readouts(root, [
      { key: "w", label: "Within-group slope (the effect for individuals)", cls: "good" },
      { key: "e", label: "Ecological slope (5 group means)", cls: "bad" },
      { key: "p", label: "Pooled slope (ignores groups)" },
      { key: "v", label: "Would an ecological study mislead?" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Exposure and outcome are in arbitrary units. Each group could be a country, a region or a clinic." }, root);

    function draw() {
      var b = sb.value(), B = sB.value();
      var X = [], Y = [], allX = [], allY = [], mX = [], mY = [], wxy = 0, wxx = 0;
      for (var g = 0; g < G; g++) {
        var cx = 2 + 2 * g, cy = 10 + B * (cx - 6) + GN[g], xs = [], ys = [];
        for (var i = 0; i < n; i++) {
          var x = cx + SX * Z[g][i][0], y = cy + b * (x - cx) + SY * Z[g][i][1];
          xs.push(x); ys.push(y); allX.push(x); allY.push(y);
        }
        var s = slope(xs, ys);
        mX.push(s.mx); mY.push(s.my);
        for (i = 0; i < n; i++) { wxy += (xs[i] - s.mx) * (ys[i] - s.my); wxx += (xs[i] - s.mx) * (xs[i] - s.mx); }
        X.push(xs); Y.push(ys);
      }
      var within = wxy / wxx, eco = slope(mX, mY), pooled = slope(allX, allY);

      var ylo = Math.floor(Math.min.apply(null, allY) - 0.5), yhi = Math.ceil(Math.max.apply(null, allY) + 0.5);
      clear(c);
      var f = V.frame(c, { x: [0, 12], y: [ylo, yhi], xTicks: [0, 2, 4, 6, 8, 10, 12], fmtY: function (v) { return V.fmt.num(v, 0); }, xLabel: "Exposure", yLabel: "Outcome" });
      var gi = f.inner;
      for (g = 0; g < G; g++) {
        var cls = "s" + (g + 1);
        for (i = 0; i < n; i++) el("circle", { cx: f.x(X[g][i]), cy: f.y(Y[g][i]), r: 3, class: "dot " + cls, "fill-opacity": 0.5 }, gi);
      }
      // pooled line
      el("line", { x1: f.x(0.3), x2: f.x(11.7), y1: f.y(pooled.my + pooled.b * (0.3 - pooled.mx)), y2: f.y(pooled.my + pooled.b * (11.7 - pooled.mx)), class: "edge", "stroke-dasharray": "2 5" }, gi);
      // ecological line
      el("line", { x1: f.x(1), x2: f.x(11), y1: f.y(eco.my + eco.b * (1 - eco.mx)), y2: f.y(eco.my + eco.b * (11 - eco.mx)), class: "edge strong", "stroke-dasharray": "8 5", style: "stroke-width:2.5" }, gi);
      // within-group lines and group means
      for (g = 0; g < G; g++) {
        cls = "s" + (g + 1);
        el("line", { x1: f.x(mX[g] - 1.6), x2: f.x(mX[g] + 1.6), y1: f.y(mY[g] - 1.6 * within), y2: f.y(mY[g] + 1.6 * within), class: "stroke " + cls }, gi);
        el("circle", { cx: f.x(mX[g]), cy: f.y(mY[g]), r: 7, class: "node " + cls }, gi);
      }

      out.w(V.fmt.signed(within, 2));
      out.e(V.fmt.signed(eco.b, 2));
      out.p(V.fmt.signed(pooled.b, 2));
      var verdict;
      if (Math.abs(within) < 0.15 && Math.abs(eco.b) >= 0.15) verdict = "Yes: effect only between groups";
      else if (within * eco.b < 0) verdict = "Yes: opposite signs";
      else if (Math.abs(eco.b - within) > 0.5 * Math.max(Math.abs(within), 0.3)) verdict = "Partly: same sign, wrong size";
      else verdict = "No: the levels agree";
      out.v(verdict);
    }
    draw();
  });
})();
