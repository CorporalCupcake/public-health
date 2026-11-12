// Lecture 4.8 — Synthetic control: a playground (weight sliders or optimise on the pre-period)
// and a placebo-in-space panel (each donor treated as fake-treated; post/pre RMSPE ratio ranks).
// Illustrative numbers throughout: six donor countries, annual data 2010–2022, tax from 2017.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function sg(x, d) { d = d === undefined ? 1 : d; return V.fmt.signed(Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x, d); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }

  // ---- shared illustrative data ------------------------------------------------
  var YRS = []; for (var yy = 2010; yy <= 2022; yy++) YRS.push(yy);
  var T = YRS.length, PRE = 7; // 2010–2016 pre-period
  var NAMES = ["A", "B", "C", "D", "E", "F"];
  var shock = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1.6, -0.8, -0.3]; // shared 2020 dip
  var SPEC = [[34, 0.25, 0.8], [41, 0.55, 1.0], [47, -0.35, 1.2], [52, 0.15, 0.9], [38, -0.5, 0.7], [58, 0.4, 1.1]];
  var r = V.rng(4800017); for (var i = 0; i < 300; i++) r();
  var DON = SPEC.map(function (d) { return YRS.map(function (_, k) { return d[0] + d[1] * k + d[2] * shock[k] + 0.6 * V.normal(r); }); });
  var W0 = [0, 0.5, 0, 0.5, 0, 0];
  var BASE = YRS.map(function (_, k) { var s = 0; for (var j = 0; j < 6; j++) s += W0[j] * DON[j][k]; return s + 0.35 * V.normal(r); });
  function treated(eff, off) { return BASE.map(function (v, k) { return v + off + (k >= PRE ? eff * Math.min(1, (k - PRE + 1) / 2) : 0); }); }

  function projSimplex(v) {
    var u = v.slice().sort(function (a, b) { return b - a; }), c = 0, th = 0;
    for (var i = 0; i < u.length; i++) { c += u[i]; var t = (c - 1) / (i + 1); if (u[i] - t > 0) th = t; }
    return v.map(function (x) { return Math.max(0, x - th); });
  }
  // Projected gradient descent on the simplex: minimise pre-period squared error.
  function fitW(y, X) {
    var J = X.length, w = X.map(function () { return 1 / J; }), tr = 0, j, k;
    for (j = 0; j < J; j++) for (k = 0; k < PRE; k++) tr += X[j][k] * X[j][k];
    var step = 1 / (2 * tr);
    for (var it = 0; it < 20000; it++) {
      var g = w.map(function () { return 0; });
      for (k = 0; k < PRE; k++) {
        var s = 0; for (j = 0; j < J; j++) s += w[j] * X[j][k];
        var e = s - y[k]; for (j = 0; j < J; j++) g[j] += 2 * e * X[j][k];
      }
      w = projSimplex(w.map(function (x, jj) { return x - step * g[jj]; }));
    }
    return w;
  }
  function synth(X, w) { return YRS.map(function (_, k) { var s = 0; for (var j = 0; j < X.length; j++) s += w[j] * X[j][k]; return s; }); }
  function stats(y, s) {
    var pre = 0, post = 0, gaps = [], pg = 0;
    for (var k = 0; k < T; k++) { var g = y[k] - s[k]; gaps.push(g); if (k < PRE) pre += g * g; else { post += g * g; pg += g; } }
    var a = Math.sqrt(pre / PRE), b = Math.sqrt(post / (T - PRE));
    return { pre: a, post: b, ratio: b / Math.max(a, 1e-9), gaps: gaps, meanPost: pg / (T - PRE) };
  }
  var cacheW = {};
  function treatedW(off) { if (!cacheW[off]) cacheW[off] = fitW(treated(0, off), DON); return cacheW[off]; }
  var placebos = null;
  function getPlacebos() {
    if (placebos) return placebos;
    placebos = DON.map(function (y, j) {
      var X = DON.filter(function (_, i) { return i !== j; });
      return stats(y, synth(X, fitW(y, X)));
    });
    return placebos;
  }
  function presetRow(root) { return el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root); }

  // ---------------------------------------------------------------------------
  V.register("sc-playground", function (root) {
    var EFF = -4, off = 0;
    var ctr = V.controls(root), sl = [];
    NAMES.forEach(function (n, j) {
      sl.push(V.slider(ctr, { label: "Donor " + n + " (raw weight)", min: 0, max: 1, step: 0.001, value: 1 / 6, fmt: function (v) { return v.toFixed(2); }, onInput: draw }));
    });
    var pre = presetRow(root);
    V.button(pre, "Optimise on 2010–2016", function () { treatedW(off).forEach(function (w, j) { sl[j].set(+w.toFixed(3)); }); draw(); });
    V.button(pre, "Equal weights", function () { sl.forEach(function (s) { s.set(1 / 6); }); draw(); });
    V.button(pre, "True mix (B, D)", function () { W0.forEach(function (w, j) { sl[j].set(w); }); draw(); });
    V.toggle(pre, { options: [{ value: 0, label: "Treated inside donors’ range" }, { value: 20, label: "Treated above every donor" }], value: 0, onChange: function (v) { off = v; draw(); } });

    V.legend(root, [
      { cls: "s1", label: "Taxed country" }, { cls: "s2", label: "Synthetic control", dashed: true }, { cls: "s5", label: "Donors A–F" }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Sugar supply for a taxed country, six donor countries and the weighted synthetic control, 2010 to 2022, with the tax starting in 2017");
    var wline = el("p", { class: "widget-note", style: "margin:0.4rem 0 0" }, root);
    var out = V.readouts(root, [
      { key: "pre", label: "Pre-period RMSPE (2010–2016): fit before the tax" },
      { key: "gap", label: "Average post gap (taxed − synthetic), 2017–2022", cls: "good" },
      { key: "truth", label: "True average effect, 2017–2022" },
      { key: "ratio", label: "Post/pre RMSPE ratio" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Sliders are rescaled to sum to 1 before use, so only their proportions matter. The treated country is an even mix of donors B and D plus noise; its true effect builds to −4 by 2018. Optimise uses projected gradient descent: weights stay non-negative and sum to 1." }, root);

    function draw() {
      var raw = sl.map(function (s) { return s.value(); }), tot = raw.reduce(function (a, b) { return a + b; }, 0);
      var w = tot > 0 ? raw.map(function (x) { return x / tot; }) : raw.map(function () { return 1 / 6; });
      var y = treated(EFF, off), s = synth(DON, w), st = stats(y, s), y0 = treated(0, off);
      var truth = 0; for (var k = PRE; k < T; k++) truth += y[k] - y0[k]; truth /= (T - PRE);

      clear(c);
      var vals = []; DON.forEach(function (d) { vals = vals.concat(d); }); vals = vals.concat(y, s);
      var lo = Math.floor((Math.min.apply(null, vals) - 2) / 10) * 10, hi = Math.ceil((Math.max.apply(null, vals) + 2) / 10) * 10;
      var f = V.frame(c, { x: [2009.6, 2023.2], y: [lo, hi], xTicks: [2010, 2012, 2014, 2016, 2018, 2020, 2022], xLabel: "Year", yLabel: "Sugar supply, kg/person/yr (illustrative)", margin: { right: 30 } });
      var G = f.inner;
      el("rect", { x: f.x(2016.5), y: f.y(hi), width: f.x(2023.2) - f.x(2016.5), height: f.y(lo) - f.y(hi), class: "fill-soft s5", opacity: 0.35 }, G);
      el("text", { x: f.x(2016.5) + 6, y: f.y(hi) + 14, class: "viz-small viz-muted", text: "after the tax" }, G);
      DON.forEach(function (d, j) {
        el("path", { d: V.line(d.map(function (v, k) { return [f.x(YRS[k]), f.y(v)]; })), class: "stroke s5", "stroke-width": 1.2 + 2.5 * w[j], opacity: 0.45 + 0.5 * Math.min(1, w[j] * 2) }, G);
        el("text", { x: f.x(2022) + 6, y: f.y(d[T - 1]) + 4, class: "viz-small viz-muted", text: NAMES[j] }, G);
      });
      el("path", { d: V.line(s.map(function (v, k) { return [f.x(YRS[k]), f.y(v)]; })), class: "stroke dashed s2" }, G);
      el("path", { d: V.line(y.map(function (v, k) { return [f.x(YRS[k]), f.y(v)]; })), class: "stroke s1" }, G);

      wline.textContent = "Weights used: " + w.map(function (x, j) { return NAMES[j] + " " + Math.round(x * 100) + "%"; }).join(" · ");
      out.pre(st.pre.toFixed(2) + " kg");
      out.gap(sg(st.meanPost, 2) + " kg");
      out.truth(sg(truth, 2) + " kg");
      out.ratio(st.ratio.toFixed(1));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  V.register("sc-placebo", function (root) {
    var off = 0, drop = false;
    var ctr = V.controls(root);
    var sE = V.slider(ctr, { label: "True effect of the tax (kg, reached by 2018)", min: -8, max: 2, step: 0.5, value: -4, fmt: function (v) { return sg(v, 1); }, onInput: draw });
    V.toggle(ctr, { options: [{ value: 0, label: "Treated inside" }, { value: 20, label: "Treated above every donor" }], value: 0, onChange: function (v) { off = v; draw(); } });
    V.toggle(ctr, { options: [{ value: false, label: "All placebos" }, { value: true, label: "Drop poor pre-fits (> 5× treated)" }], value: false, onChange: function (v) { drop = v; draw(); } });

    V.legend(root, [{ cls: "s1", label: "Taxed country: real gap" }, { cls: "s5", label: "Each donor as a fake-treated unit" }]);
    var c = V.svg(root, 640, 280);
    c.setAttribute("aria-label", "Gap between each unit and its synthetic control over time: the taxed country and six placebo donors");
    var c2 = V.svg(root, 640, 200);
    c2.setAttribute("aria-label", "Post- to pre-period RMSPE ratio for each unit, sorted, with the taxed country highlighted");
    var out = V.readouts(root, [
      { key: "rank", label: "Rank of the taxed country by post/pre ratio" },
      { key: "p", label: "Permutation p-value (rank ÷ units in the test)", cls: "good" },
      { key: "min", label: "Smallest p-value this test can ever give", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each donor’s synthetic control uses the other five donors (the taxed country is never a donor). RMSPE = root mean squared prediction error, the typical gap between a unit and its synthetic control." }, root);

    function draw() {
      var eff = sE.value(), y = treated(eff, off), wt = treatedW(off), st = stats(y, synth(DON, wt));
      var P = getPlacebos().map(function (p, j) { return { name: "Donor " + NAMES[j], st: p, real: false }; });
      if (drop) P = P.filter(function (p) { return p.st.pre <= 5 * st.pre; });
      var units = [{ name: "Taxed", st: st, real: true }].concat(P);
      var rank = units.filter(function (u) { return u.st.ratio >= st.ratio - 1e-12; }).length;

      clear(c);
      var all = []; units.forEach(function (u) { all = all.concat(u.st.gaps); });
      var m = Math.max(4, Math.ceil(Math.max.apply(null, all.map(Math.abs)) + 1));
      var f = V.frame(c, { x: [2009.6, 2022.4], y: [-m, m], xTicks: [2010, 2012, 2014, 2016, 2018, 2020, 2022], xLabel: "Year", yLabel: "Gap: unit − its synthetic (kg)" });
      el("line", { x1: f.x(2016.5), x2: f.x(2016.5), y1: f.y(m), y2: f.y(-m), class: "viz-grid", "stroke-dasharray": "5 4" }, f.inner);
      el("text", { x: f.x(2016.5) + 5, y: f.y(m) + 13, class: "viz-small viz-muted", text: "tax" }, f.inner);
      el("line", { x1: f.x(2009.6), x2: f.x(2022.4), y1: f.y(0), y2: f.y(0), class: "viz-axis" }, f.inner);
      P.forEach(function (p) { el("path", { d: V.line(p.st.gaps.map(function (g, k) { return [f.x(YRS[k]), f.y(g)]; })), class: "stroke s5", "stroke-width": 1.5, opacity: 0.75 }, f.inner); });
      el("path", { d: V.line(st.gaps.map(function (g, k) { return [f.x(YRS[k]), f.y(g)]; })), class: "stroke s1", "stroke-width": 3.2 }, f.inner);

      clear(c2);
      var sorted = units.slice().sort(function (a, b) { return b.st.ratio - a.st.ratio; });
      var rmax = Math.max.apply(null, sorted.map(function (u) { return u.st.ratio; })) * 1.1;
      var x0 = 110, x1 = 600, bh = 18, gap = 6, top = 14;
      var sx = V.scale(0, rmax, x0, x1);
      sorted.forEach(function (u, i) {
        var yb = top + i * (bh + gap);
        el("text", { x: x0 - 8, y: yb + bh / 2 + 4, "text-anchor": "end", class: "viz-small" + (u.real ? " viz-bold colour s1" : ""), text: u.name }, c2);
        el("rect", { x: x0, y: yb, width: Math.max(1, sx(u.st.ratio) - x0), height: bh, class: u.real ? "fill s1" : "fill s5", opacity: u.real ? 1 : 0.6 }, c2);
        el("text", { x: sx(u.st.ratio) + 6, y: yb + bh / 2 + 4, class: "viz-small", text: u.st.ratio.toFixed(1) }, c2);
      });
      el("text", { x: x0, y: top + sorted.length * (bh + gap) + 14, class: "viz-small viz-muted", text: "Post/pre RMSPE ratio: how much worse the synthetic fits after 2017 than before. Sorted, largest first." }, c2);

      out.rank(rank + " of " + units.length);
      out.p((rank / units.length).toFixed(2));
      out.min("1/" + units.length + " = " + (1 / units.length).toFixed(2));
    }
    draw();
  });
})();
