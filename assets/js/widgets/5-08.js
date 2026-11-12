// Lecture 5.8 — group-sequential boundaries (what peeking does to the false-positive rate)
// and the winner's curse in trials stopped early for benefit. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  function row(parent, label) {
    var r = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.7rem" }, parent);
    el("span", { class: "widget-note", style: "margin:0;min-width:7.5rem", text: label }, r);
    return r;
  }

  var K = 5;
  // Two-sided 5% (one-sided 2.5%) critical values for five equally spaced looks.
  var BOUNDS = {
    naive: [1.96, 1.96, 1.96, 1.96, 1.96],
    pocock: [2.413, 2.413, 2.413, 2.413, 2.413],
    obf: [4.562, 3.226, 2.634, 2.281, 2.040]
  };
  var NAMES = { naive: "Naive 1.96 every look", pocock: "Pocock", obf: "O’Brien–Fleming" };

  // ---------------------------------------------------------------------------
  // Peeking at a trial five times: z-statistic paths against boundaries.
  V.register("gs-boundaries", function (root) {
    var NSIM = 4000, NSHOW = 40, DRIFT = 3.2415; // drift gives 90% power for a single final test
    var bound = "naive", truth = "null", seed = 5080001;

    var r1 = row(root, "Stopping rule:");
    V.toggle(r1, { options: [{ value: "naive", label: NAMES.naive }, { value: "pocock", label: NAMES.pocock }, { value: "obf", label: NAMES.obf }], value: "naive", onChange: function (v) { bound = v; draw(); } });
    var r2 = row(root, "Truth:");
    V.toggle(r2, { options: [{ value: "null", label: "No effect" }, { value: "alt", label: "Real effect (90% power at the end)" }], value: "null", onChange: function (v) { truth = v; sim(); draw(); } });
    var r3 = row(root, "");
    V.button(r3, "Simulate new trials", function () { seed += 2; sim(); draw(); });

    V.legend(root, [
      { cls: "s3", label: "Trial crossed a boundary and stopped" },
      { cls: "s5", label: "Trial never crossed" },
      { cls: "s2", label: "Boundary", dashed: true }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Forty simulated z-statistic paths over five interim looks, with the stopping boundary drawn above and below zero. Paths that cross the boundary stop there.");

    var out = V.readouts(root, [
      { key: "rej", label: "Trials declaring an effect" },
      { key: "early", label: "Stopped before the final look" },
      { key: "info", label: "Average share of planned data used" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative simulation of 4,000 trials with five equally spaced looks, two-sided 5% overall. With no effect, “declaring an effect” is a false positive; with a real effect, it is power." }, root);

    var paths = [];
    function sim() {
      var r = stream(seed), dt = 1 / K, mu = truth === "alt" ? DRIFT : 0;
      paths = [];
      for (var i = 0; i < NSIM; i++) {
        var w = 0, z = [];
        for (var k = 1; k <= K; k++) {
          w += Math.sqrt(dt) * V.normal(r) + mu * dt;
          z.push(w / Math.sqrt(k * dt));
        }
        paths.push(z);
      }
    }

    function draw() {
      var b = BOUNDS[bound], rej = 0, early = 0, info = 0;
      var stopAt = paths.map(function (z) {
        for (var k = 0; k < K; k++) if (Math.abs(z[k]) >= b[k]) return k;
        return -1;
      });
      stopAt.forEach(function (s) {
        if (s >= 0) rej++;
        if (s >= 0 && s < K - 1) early++;
        info += (s >= 0 ? s + 1 : K) / K;
      });

      clear(c);
      var f = V.frame(c, {
        x: [0.6, 5.4], y: [-5, 6], xTicks: [1, 2, 3, 4, 5], yTicks: [-4, -2, 0, 2, 4, 6],
        fmtX: function (t) { return "look " + t; }, xLabel: "Interim look (equal shares of the planned data)", yLabel: "z-statistic",
        margin: { left: 52, right: 20, top: 14, bottom: 44 }
      });
      el("line", { x1: f.x(0.6), x2: f.x(5.4), y1: f.y(0), y2: f.y(0), class: "edge" }, f.inner);
      function cy(v) { return f.y(Math.max(-5, Math.min(6, v))); }
      for (var i = 0; i < NSHOW; i++) {
        var z = paths[i], s = stopAt[i], last = s >= 0 ? s : K - 1, pts = [];
        for (var k = 0; k <= last; k++) pts.push([f.x(k + 1), cy(z[k])]);
        var g = el("g", { class: s >= 0 ? "s3" : "s5" }, f.inner);
        el("path", { d: V.line(pts), class: "stroke", style: "stroke-width:1.3;opacity:" + (s >= 0 ? 0.9 : 0.45) }, g);
        if (s >= 0) el("circle", { cx: f.x(s + 1), cy: cy(z[s]), r: 3.5, class: "dot" }, g);
      }
      var gb = el("g", { class: "s2" }, f.inner);
      [1, -1].forEach(function (sg) {
        var pts = b.map(function (v, k) { return [f.x(k + 1), cy(sg * v)]; });
        el("path", { d: V.line(pts), class: "stroke dashed" }, gb);
        pts.forEach(function (p) { el("circle", { cx: p[0], cy: p[1], r: 4, class: "dot" }, gb); });
      });
      el("text", { x: f.x(1) + 8, y: cy(b[0]) - 8, class: "viz-small viz-bold colour s2", text: NAMES[bound] }, c);

      out.rej(V.fmt.pct1(rej / NSIM));
      out.early(V.fmt.pct1(early / NSIM));
      out.info(V.fmt.pct(info / NSIM));
    }

    sim(); draw();
  });

  // ---------------------------------------------------------------------------
  // Winner's curse: estimates from trials stopped early for benefit.
  V.register("truncated-bias", function (root) {
    var NSIM = 2000, NSHOW = 700, BLOCK = 80; // five looks at 80, 160, 240, 320, 400 events
    var rule = "naive";

    var ctl = V.controls(root);
    var sHR = V.slider(ctl, { label: "True hazard ratio", min: 0.6, max: 1.0, step: 0.05, value: 0.75, fmt: function (v) { return v.toFixed(2); }, onInput: function () { sim(); draw(); } });
    var r1 = row(root, "Stopping rule:");
    V.toggle(r1, { options: [{ value: "naive", label: "Stop if p < 0.05 at any look" }, { value: "obf", label: "O’Brien–Fleming" }], value: "naive", onChange: function (v) { rule = v; draw(); } });

    V.legend(root, [
      { cls: "s3", label: "Stopped early for benefit" },
      { cls: "s5", label: "Ran to 400 events" },
      { cls: "s2", label: "Average estimate at that look" }
    ]);
    var c = V.svg(root, 640, 310);
    c.setAttribute("aria-label", "Dot plot of estimated hazard ratios by the look at which each simulated trial stopped, on a log scale, with a dashed line at the true hazard ratio and a bar marking the average estimate at each look.");

    var out = V.readouts(root, [
      { key: "share", label: "Trials stopped early" },
      { key: "early", label: "Average HR, stopped early", cls: "bad" },
      { key: "full", label: "Average HR, ran to the end" },
      { key: "truth", label: "True HR", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each trial plans 400 events with looks every 80; it stops only for benefit. Dashed line: the true hazard ratio; solid line: no effect. Averages are geometric means. Trials that ran to the end are biased the other way, because their lucky draws already left early." }, root);

    var est = []; // est[i][k] = log HR estimate at look k
    function sim() {
      var r = stream(5080101), th = Math.log(sHR.value()), sd = Math.sqrt(4 / BLOCK);
      est = [];
      for (var i = 0; i < NSIM; i++) {
        var sum = 0, e = [];
        for (var k = 1; k <= K; k++) { sum += th + sd * V.normal(r); e.push(sum / k); }
        // jitter is fixed per trial so dots don't jump when the rule changes
        e.jit = r() - 0.5;
        est.push(e);
      }
    }

    function draw() {
      var b = rule === "naive" ? BOUNDS.naive : BOUNDS.obf;
      var byLook = [[], [], [], [], []], early = [], full = [];
      var res = est.map(function (e) {
        for (var k = 0; k < K - 1; k++) {
          var z = -e[k] / Math.sqrt(4 / (BLOCK * (k + 1)));
          if (z >= b[k]) return { k: k, v: e[k], early: true };
        }
        return { k: K - 1, v: e[K - 1], early: false };
      });
      res.forEach(function (o) { byLook[o.k].push(o.v); (o.early ? early : full).push(o.v); });

      clear(c);
      var lo = Math.log(0.3), hi = Math.log(1.6);
      var f = V.frame(c, {
        x: [0.5, 5.5], y: [lo, hi], xTicks: [1, 2, 3, 4, 5],
        yTicks: [0.3, 0.5, 0.7, 1, 1.4].map(Math.log),
        fmtX: function (t) { return (t * BLOCK) + " events"; },
        fmtY: function (t) { return (Math.round(Math.exp(t) * 10) / 10).toFixed(1); },
        xLabel: "Look at which the trial stopped", yLabel: "Estimated hazard ratio",
        margin: { left: 56, right: 20, top: 30, bottom: 44 }
      });
      function cy(v) { return f.y(Math.max(lo, Math.min(hi, v))); }
      el("line", { x1: f.x(0.5), x2: f.x(5.5), y1: f.y(0), y2: f.y(0), class: "edge" }, f.inner);
      for (var i = 0; i < NSHOW; i++) {
        var o = res[i], g = el("g", { class: o.early ? "s3" : "s5" }, f.inner);
        el("circle", { cx: f.x(o.k + 1 + est[i].jit * 0.55), cy: cy(o.v), r: 2.3, class: "dot", style: "opacity:0.6" }, g);
      }
      var th = Math.log(sHR.value());
      el("line", { x1: f.x(0.5), x2: f.x(5.5), y1: f.y(th), y2: f.y(th), class: "edge strong", "stroke-dasharray": "6 5" }, f.inner);
      var gm = el("g", { class: "s2" }, f.inner);
      byLook.forEach(function (arr, k) {
        if (!arr.length) return;
        var m = arr.reduce(function (a, v) { return a + v; }, 0) / arr.length;
        el("line", { x1: f.x(k + 1) - 26, x2: f.x(k + 1) + 26, y1: cy(m), y2: cy(m), class: "stroke", style: "stroke-width:4" }, gm);
        el("text", { x: f.x(k + 1), y: 16, "text-anchor": "middle", class: "viz-small viz-muted", text: "n=" + arr.length }, c);
      });

      function gmean(a) { return a.length ? Math.exp(a.reduce(function (s, v) { return s + v; }, 0) / a.length).toFixed(2) : "none"; }
      out.share(V.fmt.pct(early.length / NSIM));
      out.early(gmean(early));
      out.full(gmean(full));
      out.truth(sHR.value().toFixed(2));
    }

    sim(); draw();
  });
})();
