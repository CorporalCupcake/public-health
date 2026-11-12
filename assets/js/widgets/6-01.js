// Lecture 6.1 — Branching-process outbreaks (R, k, generation interval) and herd immunity with an unvaccinated pocket. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function makeRand(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  // Gamma(shape a, scale s): Marsaglia–Tsang.
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
  function offspring(rand, R, k) { return poisson(rand, k >= 50 ? R : gamma(rand, k, R / k)); }

  // Tiny binary min-heap of infection times.
  function Heap() { this.a = []; }
  Heap.prototype.push = function (v) {
    var a = this.a, i = a.length; a.push(v);
    while (i > 0) { var p = (i - 1) >> 1; if (a[p] <= a[i]) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; }
  };
  Heap.prototype.pop = function () {
    var a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; var i = 0, n = a.length;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && a[l] < a[m]) m = l;
        if (r < n && a[r] < a[m]) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };

  // ---------------------------------------------------------------------------
  // Branching process: 20 outbreaks, each seeded by one case on day 0.
  V.register("branching", function (root) {
    var KS = [0.1, 0.16, 0.26, 0.5, 1, 2, 5, 100];
    var KLAB = ["0.1", "0.16 (SARS)", "0.26 (MERS)", "0.5", "1", "2", "5", "∞ (everyone alike)"];
    var DAYS = 60, CAP = 5000, RUNS = 20, SIMS = 400, GSHAPE = 4, seed = 610001;

    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "Reproduction number R", min: 0.5, max: 4, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sK = V.slider(ctr, { label: "Dispersion k", min: 0, max: 7, step: 1, value: 2, fmt: function (i) { return KLAB[i]; }, onInput: draw });
    var sT = V.slider(ctr, { label: "Mean generation interval (days)", min: 3, max: 14, step: 1, value: 6, fmt: String, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(row, "Run 20 new introductions", function () { seed += 2; draw(); });

    V.legend(root, [{ cls: "s1", label: "Outbreak still going at day 60" }, { cls: "s5", label: "Outbreak died out" }]);
    var c1 = V.svg(root, 640, 250);
    c1.setAttribute("aria-label", "Cumulative cases over 60 days for 20 simulated outbreaks, log scale");
    var c2 = V.svg(root, 640, 175);
    c2.setAttribute("aria-label", "Distribution of the number of secondary cases per case");
    var out = V.readouts(root, [
      { key: "fizz", label: "Introductions that die out (400 simulations)" },
      { key: "zero", label: "Cases that infect nobody", cls: "bad" },
      { key: "top", label: "Share of transmission from the most infectious 20%" },
      { key: "dbl", label: "Doubling time while growing", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each case’s number of secondary cases is negative binomial with mean R and dispersion k; generation intervals are gamma-distributed with SD half the mean. Runs stop at 5,000 cases." }, root);

    function runOne(rand, R, k, T) {
      var h = new Heap(), times = [], dropped = false, capped = false;
      h.push(0);
      while (h.a.length) {
        var t = h.pop();
        times.push(t);
        if (times.length >= CAP) { capped = true; break; }
        var n = offspring(rand, R, k);
        for (var j = 0; j < n; j++) {
          var tc = t + gamma(rand, GSHAPE, T / GSHAPE);
          if (tc <= DAYS) h.push(tc); else dropped = true;
        }
      }
      return { times: times, extinct: !dropped && !capped && h.a.length === 0, capped: capped };
    }
    function fizzleShare(R, k) {
      var rand = makeRand(seed * 3 + 1), died = 0;
      for (var s = 0; s < SIMS; s++) {
        var active = 1, total = 1;
        while (active > 0 && total < 200) {
          var next = 0;
          for (var i = 0; i < active; i++) next += offspring(rand, R, k);
          active = next; total += next;
        }
        if (active === 0) died++;
      }
      return died / SIMS;
    }
    function topShare(R, k) {
      if (k >= 50) return 0.2;
      var rand = makeRand(seed * 5 + 3), nu = [], i, tot = 0, top = 0;
      for (i = 0; i < 20000; i++) { var v = gamma(rand, k, R / k); nu.push(v); tot += v; }
      nu.sort(function (a, b) { return b - a; });
      for (i = 0; i < 4000; i++) top += nu[i];
      return top / tot;
    }
    function lg(v) { return Math.log(v) / Math.LN10; }

    function draw() {
      var R = sR.value(), k = KS[sK.value()], T = sT.value();
      var rand = makeRand(seed), runs = [], r;
      for (r = 0; r < RUNS; r++) runs.push(runOne(rand, R, k, T));

      clear(c1);
      var f = V.frame(c1, { x: [0, DAYS], y: [0, lg(CAP)], yTicks: [0, 1, 2, 3], fmtY: function (t) { return V.fmt.int(Math.pow(10, t)); }, xLabel: "Days since the first case", yLabel: "Cumulative cases (log)", margin: { left: 58 } });
      runs.sort(function (a, b) { return (a.extinct ? 0 : 1) - (b.extinct ? 0 : 1); });
      runs.forEach(function (run, idx) {
        var pts = [], c = 0, ts = run.times, i = 0, lastT = run.capped ? ts[ts.length - 1] : DAYS;
        for (var d = 0; d <= DAYS; d += 0.5) {
          if (d > lastT) break;
          while (i < ts.length && ts[i] <= d) { c++; i++; }
          pts.push([f.x(d), f.y(lg(Math.max(c, 1)) + (idx - RUNS / 2) * 0.004)]);
        }
        if (run.capped) pts.push([f.x(lastT), f.y(lg(CAP))]);
        el("path", { d: V.line(pts), class: "stroke " + (run.extinct ? "s5" : "s1"), "stroke-width": run.extinct ? 1.4 : 2, "stroke-opacity": run.extinct ? 0.75 : 0.9 }, f.inner);
      });

      // Offspring distribution (negative binomial pmf)
      clear(c2);
      var p = [], kk = Math.min(k, 1e6), P0 = Math.pow(kk / (kk + R), kk), cum = 0, n;
      p.push(P0);
      for (n = 0; n < 10; n++) p.push(p[n] * (n + kk) / (n + 1) * R / (kk + R));
      for (n = 0; n <= 10; n++) cum += p[n];
      p.push(Math.max(0, 1 - cum));
      var ymax = Math.max(0.2, Math.ceil(Math.max.apply(null, p) * 10) / 10);
      var f2 = V.frame(c2, { x: [-0.5, 11.5], y: [0, ymax], xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fmtX: function (t) { return t === 11 ? "11+" : String(t); }, fmtY: V.fmt.pct, yTicks: V.ticks(0, ymax, 4), xLabel: "Secondary cases caused by one case", yLabel: "Share of cases", margin: { left: 58, top: 10 } });
      p.forEach(function (v, i) {
        el("rect", { x: f2.x(i - 0.36), width: f2.x(0.36) - f2.x(-0.36), y: f2.y(v), height: f2.y(0) - f2.y(v), class: "fill " + (i === 0 ? "s3" : "s1") }, f2.inner);
      });

      var fz = fizzleShare(R, k);
      out.fizz(V.fmt.pct(fz));
      out.zero(V.fmt.pct(P0));
      out.top(V.fmt.pct(topShare(R, k)));
      if (R <= 1) out.dbl("No growth");
      else {
        var th = T / GSHAPE, rr = (Math.pow(R, 1 / GSHAPE) - 1) / th;
        out.dbl(V.fmt.num(Math.LN2 / rr, 1) + " days");
      }
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Herd immunity with an under-vaccinated community (10% of the population).
  V.register("herd-pocket", function (root) {
    var NP = 0.1; // pocket's share of the population
    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "Basic reproduction number R₀", min: 1.5, max: 18, step: 0.5, value: 15, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sV = V.slider(ctr, { label: "Vaccine effectiveness against infection", min: 0.6, max: 0.99, step: 0.01, value: 0.97, fmt: V.fmt.pct, onInput: draw });
    var sG = V.slider(ctr, { label: "Coverage gap in the pocket (points below national)", min: 0, max: 0.6, step: 0.05, value: 0.3, fmt: function (v) { return Math.round(v * 100) + " pts"; }, onInput: draw });
    var sE = V.slider(ctr, { label: "Share of contacts within own community", min: 0, max: 0.9, step: 0.05, value: 0.6, fmt: V.fmt.pct, onInput: draw });

    V.legend(root, [{ cls: "s1", label: "Coverage spread evenly" }, { cls: "s3", label: "Same national coverage, with an under-vaccinated pocket (10% of people)" }, { cls: "s5", dashed: true, label: "R = 1" }]);
    var c = V.svg(root, 640, 260);
    c.setAttribute("aria-label", "Effective reproduction number against national vaccine coverage, with and without an under-vaccinated pocket");
    var out = V.readouts(root, [
      { key: "hit", label: "Herd-immunity threshold, 1 − 1/R₀" },
      { key: "even", label: "Coverage needed if spread evenly", cls: "good" },
      { key: "pock", label: "Coverage needed with the pocket", cls: "bad" },
      { key: "r95", label: "R with the pocket at 95% national coverage" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative model: two communities, 10% and 90% of the population. Each person makes a set share of contacts in their own community and spreads the rest across everyone in proportion to size. R is the leading eigenvalue of the two-group next-generation matrix. The kink near the top is where everyone outside the pocket is already vaccinated, so further gains must come from the pocket." }, root);

    function covs(cn, gap) {
      var cp = Math.max(0, cn - gap), cr = (cn - NP * cp) / (1 - NP);
      if (cr > 1) { cr = 1; cp = (cn - (1 - NP)) / NP; }
      return [cp, cr];
    }
    function reff(R0, ve, cn, gap, eps) {
      var cc = covs(cn, gap), n = [NP, 1 - NP], s = [1 - cc[0] * ve, 1 - cc[1] * ve];
      var K = [[0, 0], [0, 0]];
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) K[i][j] = R0 * s[i] * ((i === j ? eps : 0) + (1 - eps) * n[i]);
      var tr = K[0][0] + K[1][1], det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
      return tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    }
    function needed(fn) {
      if (fn(1) > 1) return null;
      if (fn(0) <= 1) return 0;
      var lo = 0, hi = 1;
      for (var it = 0; it < 40; it++) { var m = (lo + hi) / 2; if (fn(m) > 1) lo = m; else hi = m; }
      return hi;
    }

    function draw() {
      var R0 = sR.value(), ve = sV.value(), gap = sG.value(), eps = sE.value();
      var X0 = 0.5, evenF = function (cn) { return R0 * (1 - cn * ve); };
      var pockF = function (cn) { return reff(R0, ve, cn, gap, eps); };
      var ytop = Math.max(2, pockF(X0), evenF(X0));
      ytop = ytop > 6 ? Math.ceil(ytop / 2) * 2 : Math.ceil(ytop);
      clear(c);
      var f = V.frame(c, { x: [X0, 1], y: [0, ytop], fmtX: V.fmt.pct, xLabel: "National vaccine coverage", yLabel: "Effective reproduction number R", yTicks: V.ticks(0, ytop, 5) });
      el("line", { x1: f.x(X0), x2: f.x(1), y1: f.y(1), y2: f.y(1), class: "stroke s5 dashed", "stroke-width": 1.5 }, f.inner);
      var pe = [], pp = [];
      for (var cn = X0; cn <= 1.0001; cn += 0.005) { pe.push([f.x(cn), f.y(evenF(cn))]); pp.push([f.x(cn), f.y(pockF(cn))]); }
      el("path", { d: V.line(pp), class: "stroke s3", "stroke-width": 2.6 }, f.inner);
      el("path", { d: V.line(pe), class: "stroke s1", "stroke-width": 2.6 }, f.inner);
      var ne = needed(evenF), np = needed(pockF);
      [[ne, "s1"], [np, "s3"]].forEach(function (q) {
        if (q[0] !== null && q[0] >= X0) el("circle", { cx: f.x(q[0]), cy: f.y(1), r: 6, class: "dot " + q[1] }, f.inner);
      });
      out.hit(V.fmt.pct(1 - 1 / R0));
      out.even(ne === null ? "Not reachable" : V.fmt.pct1(ne));
      out.pock(np === null ? "Not reachable" : V.fmt.pct1(np));
      out.r95(V.fmt.num(pockF(0.95), 2));
    }
    draw();
  });
})();
