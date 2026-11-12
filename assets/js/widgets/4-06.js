// Lecture 4.6 — Difference-in-differences: a 2×2 explorer (parallel trends, hidden divergence)
// and a staggered-adoption demo (TWFE vs true average vs a clean Callaway–Sant'Anna-style estimate).
// Illustrative numbers throughout; no sampling noise, so every gap you see is bias.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }
  function presetRow(root) { return el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root); }
  function sg(x, d) { d = d === undefined ? 2 : d; return V.fmt.signed(Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x, d); }
  function mean(a) { var s = 0; a.forEach(function (v) { s += v; }); return s / a.length; }

  // ---------------------------------------------------------------------------
  // 2×2 DiD explorer: annual data 2010–2022, policy from 2017.
  V.register("did-2x2", function (root) {
    var Y0 = 2010, Y1 = 2022, POL = 2017;
    var wig = [0, 0.6, -0.4, 0.3, 0.9, -0.2, 0.4, -0.5, 0.2, 0.7, -1.4, -0.6, 0.3]; // common year shocks

    var ctr = V.controls(root);
    var sG = V.slider(ctr, { label: "Pre-trend gap: treated slope − control slope (per year)", min: -1, max: 1, step: 0.05, value: 0, fmt: function (v) { return V.fmt.signed(v, 2); }, onInput: draw });
    var sE = V.slider(ctr, { label: "True effect of the tax (constant, from 2017)", min: -8, max: 3, step: 0.5, value: -4, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw });
    var sS = V.slider(ctr, { label: "Divergence after 2017 not caused by the tax (per year)", min: -1, max: 1, step: 0.05, value: 0, fmt: function (v) { return V.fmt.signed(v, 2); }, onInput: draw });

    var pre = presetRow(root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Parallel trends", 0, -4, 0], ["Diverging pre-trends", -0.5, -4, 0], ["Looks parallel, isn’t", 0, -4, -0.6], ["No effect, but a pre-trend", 0.4, 0, 0]].forEach(function (p) {
      V.button(pre, p[0], function () { sG.set(p[1]); sE.set(p[2]); sS.set(p[3]); draw(); });
    });

    V.legend(root, [
      { cls: "s1", label: "Taxed country" }, { cls: "s5", label: "Comparison country" },
      { cls: "s2", label: "Counterfactual DiD assumes", dashed: true }, { cls: "s4", label: "True counterfactual (no tax)", dashed: true }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Outcome lines for a taxed and a comparison country from 2010 to 2022, with the counterfactual difference-in-differences assumes and the true counterfactual after 2017");
    var out = V.readouts(root, [
      { key: "did", label: "DiD estimate (post-mean change minus comparison change)", cls: "good" },
      { key: "truth", label: "True effect" },
      { key: "bias", label: "Bias (estimate − truth)", cls: "bad" },
      { key: "pt", label: "Pre-period slope gap: what a pre-trend check sees" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: sugar supply per person in arbitrary units. Both countries share the same year-to-year shocks (including a 2020 dip). DiD here averages all pre years and all post years." }, root);

    function draw() {
      var g = sG.value(), E = sE.value(), s = sS.value();
      var yrs = [], C = [], T = [], T0 = [];
      for (var y = Y0; y <= Y1; y++) {
        var k = y - Y0, post = y >= POL, w = wig[k];
        var cc = 50 - 0.3 * k + w;
        var t0 = 60 + (-0.3 + g) * k + w + (post ? s * (y - POL + 1) : 0);
        yrs.push(y); C.push(cc); T0.push(t0); T.push(t0 + (post ? E : 0));
      }
      var preI = [], postI = [];
      yrs.forEach(function (y, i) { (y < POL ? preI : postI).push(i); });
      function m(arr, idx) { return mean(idx.map(function (i) { return arr[i]; })); }
      var did = (m(T, postI) - m(T, preI)) - (m(C, postI) - m(C, preI));
      var truth = E;
      var gapPre = m(T, preI) - m(C, preI);

      var all = C.concat(T, T0), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
      lo = Math.floor((lo - 2) / 5) * 5; hi = Math.ceil((hi + 2) / 5) * 5;
      clear(c);
      var f = V.frame(c, { x: [Y0 - 0.3, Y1 + 0.3], y: [lo, hi], xTicks: [2010, 2012, 2014, 2016, 2018, 2020, 2022], xLabel: "Year", yLabel: "Sugar supply (illustrative)" });
      var G = f.inner;
      el("rect", { x: f.x(POL - 0.5), y: f.y(hi), width: f.x(Y1 + 0.3) - f.x(POL - 0.5), height: f.y(lo) - f.y(hi), class: "fill-soft s5", opacity: 0.35 }, G);
      el("text", { x: f.x(POL - 0.5) + 6, y: f.y(hi) + 14, class: "viz-small viz-muted", text: "after the tax" }, G);
      function pts(arr, idx) { return idx.map(function (i) { return [f.x(yrs[i]), f.y(arr[i])]; }); }
      var allI = yrs.map(function (_, i) { return i; });
      var bridge = [preI[preI.length - 1]].concat(postI);
      // assumed counterfactual: comparison + pre-period gap
      var CF = C.map(function (v) { return v + gapPre; });
      el("path", { d: V.line(pts(T0, bridge)), class: "stroke dashed s4", "stroke-width": 4 }, G);
      el("path", { d: V.line(pts(CF, bridge)), class: "stroke dashed s2", "stroke-width": 2 }, G);
      el("path", { d: V.line(pts(C, allI)), class: "stroke s5" }, G);
      el("path", { d: V.line(pts(T, allI)), class: "stroke s1" }, G);
      [[C, "s5"], [T, "s1"]].forEach(function (p) {
        allI.forEach(function (i) { el("circle", { cx: f.x(yrs[i]), cy: f.y(p[0][i]), r: 3, class: "dot " + p[1] }, G); });
      });

      out.did(sg(did));
      out.truth(sg(truth));
      out.bias(sg(did - truth));
      out.pt(Math.abs(g) < 0.001 ? "none" : sg(g) + " per year");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Staggered adoption: three cohorts (adopt in year 4, 7, 10) + optional never-treated unit.
  // Y_it = unit effect + year effect + tau_it * D_it, tau = −(base + growth × years since adoption).
  V.register("twfe-stagger", function (root) {
    var T = 12, COH = [4, 7, 10], NAMES = ["Early (year 4)", "Middle (year 7)", "Late (year 10)", "Never taxed"], CLS = ["s1", "s2", "s3", "s5"];
    var ALPHA = [30, 26, 22, 18];
    function lam(t) { return 0.4 * t + 0.8 * Math.sin(t * 0.9); }

    var ctr = V.controls(root);
    var sB = V.slider(ctr, { label: "Effect in the year of adoption (reduction)", min: 0, max: 4, step: 0.25, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sR = V.slider(ctr, { label: "Extra reduction for each year since adoption", min: 0, max: 4, step: 0.25, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var tg = V.toggle(ctr, { options: [{ value: true, label: "With a never-taxed unit" }, { value: false, label: "All units eventually taxed" }], value: true, onChange: draw });

    var pre = presetRow(root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Constant effect", 2, 0, true], ["Growing effect", 1, 1, true], ["Sign flip", 1, 3, false]].forEach(function (p) {
      V.button(pre, p[0], function () {
        sB.set(p[1]); sR.set(p[2]);
        var want = p[3] ? 0 : 1, b = tg.value() ? 0 : 1;
        if (want !== b) ctr.querySelectorAll(".widget-toggle button")[want].click(); else draw();
      });
    });

    V.legend(root, NAMES.map(function (n, i) { return { cls: CLS[i], label: n }; }));
    var c = V.svg(root, 640, 270);
    c.setAttribute("aria-label", "Outcome over 12 years for three cohorts that adopt a tax in years 4, 7 and 10, and an optional never-taxed unit");
    var c2 = V.svg(root, 640, 220);
    c2.setAttribute("aria-label", "The weight two-way fixed effects silently gives each treated unit-year, by years since adoption; some weights are negative");
    var out = V.readouts(root, [
      { key: "truth", label: "True average effect (all taxed unit-years)" },
      { key: "twfe", label: "TWFE estimate (unit + year fixed effects)", cls: "bad" },
      { key: "cs", label: "Clean estimate: compare only with not-yet- or never-taxed", cls: "good" },
      { key: "neg", label: "Taxed unit-years with a negative TWFE weight" }
    ]);
    var note = el("p", { class: "widget-note" }, root);

    function draw() {
      var base = sB.value(), gr = sR.value(), never = tg.value();
      var units = COH.slice(); if (never) units.push(Infinity);
      var N = units.length;
      function tau(g, t) { return t >= g ? -(base + gr * (t - g)) : 0; }
      function Y(i, t) { return ALPHA[i] + lam(t) + tau(units[i], t); }
      var D = units.map(function (g) { var r = []; for (var t = 1; t <= T; t++) r.push(t >= g ? 1 : 0); return r; });
      var Di = D.map(function (r) { return mean(r); }), Dt = [], Db;
      for (var t = 0; t < T; t++) { var s = 0; for (var i = 0; i < N; i++) s += D[i][t]; Dt.push(s / N); }
      Db = mean(Di);
      var cells = [], den = 0, num = 0, truth = 0, neg = 0;
      for (i = 0; i < N; i++) for (t = 0; t < T; t++) if (D[i][t]) {
        var dd = D[i][t] - Di[i] - Dt[t] + Db, tv = tau(units[i], t + 1);
        cells.push({ i: i, e: t + 1 - units[i], w: dd, tau: tv });
        den += dd; num += dd * tv; truth += tv; if (dd < -1e-12) neg++;
      }
      var twfe = num / den; truth /= cells.length;
      cells.forEach(function (cl) { cl.w /= den; });
      // clean (CS-style) group-time ATTs vs not-yet/never treated, base year g−1, then simple average
      var cs = 0, ncs = 0, csTruth = 0;
      for (i = 0; i < N; i++) {
        var g = units[i]; if (!isFinite(g)) continue;
        for (t = g; t <= T; t++) {
          var ctl = []; for (var j = 0; j < N; j++) if (units[j] > t) ctl.push(j);
          if (!ctl.length) continue;
          var dc = mean(ctl.map(function (jj) { return Y(jj, t) - Y(jj, g - 1); }));
          cs += (Y(i, t) - Y(i, g - 1)) - dc; csTruth += tau(g, t); ncs++;
        }
      }
      cs /= ncs; csTruth /= ncs;

      // outcome panel
      clear(c);
      var vals = []; for (i = 0; i < N; i++) for (t = 1; t <= T; t++) vals.push(Y(i, t));
      var lo = Math.floor((Math.min.apply(null, vals) - 2) / 5) * 5, hi = Math.ceil((Math.max.apply(null, vals) + 2) / 5) * 5;
      var f = V.frame(c, { x: [0.6, T + 0.4], y: [lo, hi], xTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], xLabel: "Year", yLabel: "Outcome" });
      for (i = 0; i < N; i++) {
        var pts = []; for (t = 1; t <= T; t++) pts.push([f.x(t), f.y(Y(i, t))]);
        el("path", { d: V.line(pts), class: "stroke " + CLS[i] }, f.inner);
        if (isFinite(units[i])) {
          var gx = f.x(units[i] - 0.5);
          el("line", { x1: gx, x2: gx, y1: f.y(hi), y2: f.y(lo), class: "stroke dashed " + CLS[i], "stroke-width": 1.2, opacity: 0.7 }, f.inner);
        }
      }

      // weight panel
      clear(c2);
      var ws = cells.map(function (cl) { return cl.w; }), wmax = Math.max(0.15, Math.max.apply(null, ws) * 1.15), wmin = Math.min(-0.05, Math.min.apply(null, ws) * 1.15);
      var f2 = V.frame(c2, { x: [-0.6, 8.6], y: [wmin, wmax], xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8], fmtY: function (v) { return v.toFixed(2); }, xLabel: "Years since the unit was taxed", yLabel: "TWFE weight", margin: { top: 14, bottom: 40, left: 58 } });
      el("line", { x1: f2.x(-0.6), x2: f2.x(8.6), y1: f2.y(0), y2: f2.y(0), class: "viz-axis" }, f2.inner);
      var eq = 1 / cells.length;
      el("line", { x1: f2.x(-0.6), x2: f2.x(8.6), y1: f2.y(eq), y2: f2.y(eq), class: "viz-grid", "stroke-dasharray": "5 4" }, f2.inner);
      el("text", { x: f2.x(8.5), y: f2.y(eq) - 5, "text-anchor": "end", class: "viz-small viz-muted", style: halo(), text: "equal weight (what the true average uses)" }, f2.inner);
      var off = [-0.18, 0, 0.18];
      cells.forEach(function (cl) {
        el("circle", { cx: f2.x(cl.e + off[cl.i]), cy: f2.y(cl.w), r: 4.5, class: "dot " + CLS[cl.i] }, f2.inner);
      });

      out.truth(sg(truth));
      out.twfe(sg(twfe));
      out.cs(sg(cs));
      out.neg(neg + " of " + cells.length);
      note.textContent = "Illustrative numbers, no noise. Dashed verticals mark when each cohort is taxed. The clean estimate averages group-time effects, each a 2×2 against units not yet taxed (or never taxed) with the year before adoption as baseline. " +
        (ncs < cells.length ? "Without a never-taxed unit it can only use " + ncs + " of " + cells.length + " taxed unit-years (nobody is left to compare with after year 10); the true average over those same unit-years is " + sg(csTruth) + "." : "It uses all " + cells.length + " taxed unit-years.");
    }
    draw();
  });
})();
