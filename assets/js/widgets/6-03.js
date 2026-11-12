// Lecture 6.3 — Aberration detection on a simulated seasonal weekly count series with an injected outbreak. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function makeRand(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  function gamma(rand, a, s) {
    if (a < 1) return gamma(rand, a + 1, s) * Math.pow(rand() || 1e-12, 1 / a);
    var d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x = V.normal(rand), v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      var u = rand();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v * s;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * s;
    }
  }
  function poisson(rand, lam) {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * V.normal(rand)));
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }

  V.register("aberration", function (root) {
    var W = 260, MON = 156, SIZE_PHI = 12, PROFILE = [0.08, 0.2, 0.3, 0.22, 0.13, 0.07], SIMS = 300;
    var timing = "low", seed = 630001, stats = null, shown = null;

    var ctr = V.controls(root);
    var sZ = V.slider(ctr, { label: "Alarm threshold (SDs above expected)", min: 1, max: 4, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: paint });
    var sS = V.slider(ctr, { label: "Outbreak size (extra cases over 6 weeks)", min: 0, max: 200, step: 10, value: 60, fmt: String, onInput: rebuild });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.8rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(row, { options: [{ value: "low", label: "Outbreak in the low season" }, { value: "high", label: "Outbreak in the high season" }], value: timing, onChange: function (v) { timing = v; rebuild(); } });
    V.button(row, "New data", function () { seed += 2; rebuild(); });

    V.legend(root, [{ cls: "s5", label: "Weekly cases" }, { cls: "s2", dashed: true, label: "Alarm threshold" }, { cls: "s4", label: "Outbreak weeks" }, { cls: "s1", label: "True alarm" }, { cls: "s3", label: "False alarm" }]);
    var c1 = V.svg(root, 640, 250);
    c1.setAttribute("aria-label", "Weekly case counts over three years with the alarm threshold, the injected outbreak and alarms");
    var c2 = V.svg(root, 640, 210);
    c2.setAttribute("aria-label", "Trade-off between false alarms per year and outbreaks detected within 3 weeks, across thresholds");
    var out = V.readouts(root, [
      { key: "this", label: "This series: outbreak detected?" },
      { key: "det", label: "Outbreaks detected within 3 weeks (300 simulations)", cls: "good" },
      { key: "fa", label: "False alarms per year", cls: "bad" },
      { key: "ppv", label: "Share of alarms that are real (PPV)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Counts are negative binomial around a seasonal mean (peaking each winter), with no trend. Each monitored week is compared with weeks 3 either side of the same week in the previous 3 years (a simplified historical-limits method in the spirit of Farrington’s); an alarm fires when the count exceeds the threshold." }, root);

    function mu(t) { return Math.exp(Math.log(18) + 0.55 * Math.cos(2 * Math.PI * (t - 5) / 52)); }
    function outStart() { return timing === "low" ? 208 + 28 : 208 + 1; }
    function simulate(rand, size) {
      var y = [], s0 = outStart();
      for (var t = 0; t < W; t++) {
        var m = mu(t);
        if (t >= s0 && t < s0 + PROFILE.length) m += size * PROFILE[t - s0];
        y.push(poisson(rand, gamma(rand, SIZE_PHI, m / SIZE_PHI)));
      }
      return y;
    }
    function zscores(y) { // for monitored weeks: z = (y - mean) / (sd * sqrt(1 + 1/n)); also return threshold pieces
      var z = [], ex = [], sc = [];
      for (var t = MON; t < W; t++) {
        var b = [];
        for (var k = 1; k <= 3; k++) for (var j = -3; j <= 3; j++) if (t - 52 * k + j >= 0) b.push(y[t - 52 * k + j]);
        var n = b.length, m = 0, v = 0;
        b.forEach(function (x) { m += x; }); m /= n;
        b.forEach(function (x) { v += (x - m) * (x - m); }); v /= (n - 1);
        var sd = Math.max(Math.sqrt(v), Math.sqrt(Math.max(m, 1))) * Math.sqrt(1 + 1 / n);
        z.push((y[t] - m) / sd); ex.push(m); sc.push(sd);
      }
      return { z: z, ex: ex, sc: sc };
    }
    function rebuild() {
      var size = sS.value(), rand = makeRand(seed);
      var y = simulate(rand, size);
      shown = { y: y, zs: zscores(y) };
      var r2 = makeRand(seed * 7 + 11);
      stats = [];
      for (var s = 0; s < SIMS; s++) stats.push(zscores(simulate(r2, size)).z);
      paint();
    }
    function evaluate(zlist, zthr) {
      var s0 = outStart() - MON, s1 = s0 + PROFILE.length, det = 0, fa = 0, ta = 0, n = zlist.length;
      zlist.forEach(function (z) {
        var hit = false;
        for (var i = 0; i < z.length; i++) {
          var al = z[i] > zthr, inOut = i >= s0 && i < s1;
          if (!al) continue;
          if (inOut) { ta++; if (i < s0 + 3) hit = true; } else fa++;
        }
        if (hit) det++;
      });
      var years = (W - MON - PROFILE.length) / 52;
      return { det: det / n, fa: fa / n / years, ppv: (ta + fa) ? ta / (ta + fa) : 0 };
    }

    function paint() {
      var zthr = sZ.value(), size = sS.value(), y = shown.y, zs = shown.zs, s0 = outStart();
      // Chart 1: last 3 years
      clear(c1);
      var X0 = 104, ymax = Math.max.apply(null, y.slice(X0)) * 1.12;
      zs.ex.forEach(function (m, i) { ymax = Math.max(ymax, (m + zthr * zs.sc[i]) * 1.05); });
      var f = V.frame(c1, { x: [X0, W], y: [0, ymax], xTicks: [104, 156, 208, 260], fmtX: function (t) { return t === 260 ? "" : "Year " + (t / 52 + 1); }, yTicks: V.ticks(0, ymax, 4), xLabel: "Week", yLabel: "Cases per week", margin: { left: 54, top: 22 } });
      if (size > 0) el("rect", { x: f.x(s0 - 0.5), width: f.x(s0 + PROFILE.length - 0.5) - f.x(s0 - 0.5), y: f.y(ymax), height: f.y(0) - f.y(ymax), class: "fill-soft s4" }, f.inner);
      el("line", { x1: f.x(MON), x2: f.x(MON), y1: f.y(0), y2: f.y(ymax), class: "stroke s5 dashed", "stroke-width": 1.2 }, f.inner);
      el("text", { x: f.x(MON) + 5, y: f.y(ymax) - 6, class: "viz-small viz-muted", text: "monitoring starts →" }, f.inner);
      el("path", { d: V.line(y.slice(X0).map(function (v, i) { return [f.x(X0 + i), f.y(v)]; })), class: "stroke s5", "stroke-width": 1.5 }, f.inner);
      el("path", { d: V.line(zs.ex.map(function (m, i) { return [f.x(MON + i), f.y(m + zthr * zs.sc[i])]; })), class: "stroke s2 dashed", "stroke-width": 2 }, f.inner);
      var firstHit = null, nFalse = 0;
      zs.z.forEach(function (z, i) {
        if (z <= zthr) return;
        var t = MON + i, inOut = size > 0 && t >= s0 && t < s0 + PROFILE.length;
        if (inOut && firstHit === null) firstHit = t - s0 + 1;
        if (!inOut) nFalse++;
        el("circle", { cx: f.x(t), cy: f.y(y[t]), r: 4.5, class: "dot " + (inOut ? "s1" : "s3") }, f.inner);
      });

      // Chart 2: trade-off curve across thresholds
      clear(c2);
      var grid = [], z;
      for (z = 1; z <= 4.0001; z += 0.1) grid.push([z, evaluate(stats, z)]);
      var cur = evaluate(stats, zthr);
      var xmax = Math.max(2, Math.ceil(grid[0][1].fa / 2) * 2);
      var f2 = V.frame(c2, { x: [0, xmax], y: [0, 1], fmtY: V.fmt.pct, yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "False alarms per year", yLabel: "Detected ≤ 3 weeks", margin: { left: 54, top: 14 } });
      if (size > 0) {
        el("path", { d: V.line(grid.map(function (g) { return [f2.x(g[1].fa), f2.y(g[1].det)]; })), class: "stroke s1", "stroke-width": 2.4 }, f2.inner);
        el("circle", { cx: f2.x(cur.fa), cy: f2.y(cur.det), r: 7, class: "dot s2" }, f2.inner);
        var lx = f2.x(cur.fa), anchor = lx > 420 ? "end" : "start";
        el("text", { x: lx + (anchor === "end" ? -12 : 12), y: f2.y(cur.det) + (cur.det > 0.85 ? 18 : -10), "text-anchor": anchor, class: "viz-small viz-bold colour s2", text: "threshold " + zthr.toFixed(1) }, f2.inner);
      } else {
        el("text", { x: 340, y: 100, "text-anchor": "middle", class: "viz-small viz-muted", text: "No outbreak injected: every alarm is a false alarm." }, f2.inner);
      }

      out.this(size === 0 ? "no outbreak" : firstHit === null ? "missed" : "week " + firstHit + " of 6");
      out.det(size === 0 ? "–" : V.fmt.pct(cur.det));
      out.fa(V.fmt.num(cur.fa, 1));
      out.ppv(V.fmt.pct(cur.ppv));
    }
    rebuild();
  });
})();
