// Lecture 5.9 — benchmarking emulations against trials: three agreement metrics in the style of
// RCT-DUPLICATE, on made-up trial–emulation pairs. Illustrative numbers.
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

  // Agreement metrics for one pair (log scale).
  function agree(p, k) {
    var rwe = p.th + k * p.bias + p.r * p.z2, rct = p.th + p.s * p.z1;
    var sigA = Math.abs(rct / p.s) >= 1.96, sigB = Math.abs(rwe / p.r) >= 1.96;
    return {
      rct: rct, rwe: rwe,
      sig: (sigA && sigB && (rct > 0) === (rwe > 0)) || (!sigA && !sigB),
      est: Math.abs(rwe - rct) <= 1.96 * p.s,
      sd: Math.abs(rwe - rct) / Math.sqrt(p.s * p.s + p.r * p.r) < 1.96
    };
  }

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 3) return NaN;
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < n; i++) { var dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxy / Math.sqrt(sxx * syy);
  }

  V.register("benchmark-agreement", function (root) {
    var N = 24, metric = "est", subset = "all";
    var r = stream(5090015), P = [];
    for (var i = 0; i < N; i++) {
      var close = i % 2 === 0;
      P.push({
        close: close,
        th: Math.log(0.55) + r() * (Math.log(1.15) - Math.log(0.55)),
        s: 0.05 + r() * 0.07,          // trial standard error of log HR
        r: 0.04 + r() * 0.08,          // emulation standard error
        bias: V.normal(r) * (close ? 0.05 : 0.22), // what the emulation differences add
        z1: V.normal(r), z2: V.normal(r)
      });
    }

    var ctl = V.controls(root);
    var sK = V.slider(ctl, { label: "Emulation differences left in", min: 0, max: 100, step: 5, value: 100, fmt: function (v) { return v + "%"; }, onInput: draw });
    var r1 = row(root, "Colour by:");
    V.toggle(r1, { options: [{ value: "sig", label: "Significance agreement" }, { value: "est", label: "Estimate agreement" }, { value: "sd", label: "Standardised difference" }], value: "est", onChange: function (v) { metric = v; draw(); } });
    var r2 = row(root, "Show:");
    V.toggle(r2, { options: [{ value: "all", label: "All 24 pairs" }, { value: "close", label: "Closely emulated" }, { value: "less", label: "Less closely emulated" }], value: "all", onChange: function (v) { subset = v; draw(); } });

    V.legend(root, [
      { cls: "s1", label: "Agrees on the chosen metric" },
      { cls: "s3", label: "Disagrees" }
    ]);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Scatter plot of emulation hazard ratio against trial hazard ratio on log scales, with the trial 95% confidence interval as a horizontal bar, a diagonal line of perfect agreement, and points coloured by whether the pair agrees on the chosen metric.");

    var out = V.readouts(root, [
      { key: "sig", label: "Significance agreement" },
      { key: "est", label: "Estimate agreement" },
      { key: "sd", label: "Standardised difference agreement" },
      { key: "r", label: "Correlation of log hazard ratios" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers, not the RCT-DUPLICATE trials. Filled dots: closely emulated pairs; hollow dots: less closely emulated. Horizontal bars are the trial’s 95% CI; the dashed diagonal is perfect agreement. At 0% the emulation targets exactly the trial’s question, so the remaining disagreement is chance." }, root);

    function draw() {
      var k = sK.value() / 100, lo = Math.log(0.45), hi = Math.log(1.8);
      clear(c);
      var tk = [0.5, 0.6, 0.8, 1, 1.25, 1.6].map(Math.log);
      var f = V.frame(c, {
        x: [lo, hi], y: [lo, hi], xTicks: tk, yTicks: tk,
        fmtX: function (t) { return String(Math.round(Math.exp(t) * 100) / 100); },
        fmtY: function (t) { return String(Math.round(Math.exp(t) * 100) / 100); },
        xLabel: "Trial hazard ratio", yLabel: "Emulation hazard ratio",
        margin: { left: 56, right: 20, top: 14, bottom: 44 }
      });
      function cl(v) { return Math.max(lo, Math.min(hi, v)); }
      el("line", { x1: f.x(lo), y1: f.y(lo), x2: f.x(hi), y2: f.y(hi), class: "edge strong", "stroke-dasharray": "6 5" }, f.inner);
      el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(lo), y2: f.y(hi), class: "edge" }, f.inner);
      el("line", { x1: f.x(lo), x2: f.x(hi), y1: f.y(0), y2: f.y(0), class: "edge" }, f.inner);

      var cnt = { sig: 0, est: 0, sd: 0 }, n = 0, xs = [], ys = [];
      P.forEach(function (p) {
        var inSet = subset === "all" || (subset === "close") === p.close;
        var a = agree(p, k);
        if (inSet) {
          n++; xs.push(a.rct); ys.push(a.rwe);
          if (a.sig) cnt.sig++; if (a.est) cnt.est++; if (a.sd) cnt.sd++;
        }
        var g = el("g", { class: inSet ? (a[metric] ? "s1" : "s3") : "s5", style: inSet ? null : "opacity:0.25" }, f.inner);
        var y = f.y(cl(a.rwe));
        el("line", { x1: f.x(cl(a.rct - 1.96 * p.s)), x2: f.x(cl(a.rct + 1.96 * p.s)), y1: y, y2: y, class: "stroke", style: "stroke-width:1.6;opacity:0.7" }, g);
        el("circle", { cx: f.x(cl(a.rct)), cy: y, r: 5.5, class: p.close ? "dot" : "node" }, g);
      });

      out.sig(V.fmt.pct(cnt.sig / n));
      out.est(V.fmt.pct(cnt.est / n));
      out.sd(V.fmt.pct(cnt.sd / n));
      var rr = pearson(xs, ys);
      out.r(isNaN(rr) ? "–" : rr.toFixed(2));
    }

    draw();
  });
})();
