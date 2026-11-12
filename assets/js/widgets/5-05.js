// Lecture 5.5 — SCCS builder: simulated cases with a vaccine risk window, an age effect,
// and optional event-dependent exposure (the event rules out later vaccination).
// Fits the SCCS conditional Poisson model with and without age groups. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function solve(A, b) {
    var n = b.length, M = A.map(function (row, i) { return row.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (r = c + 1; r < n; r++) {
        var f = M[r][c] / M[c][c];
        for (var j = c; j <= n; j++) M[r][j] -= f * M[c][j];
      }
    }
    var x = new Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (var k = i + 1; k < n; k++) s -= M[i][k] * x[k];
      x[i] = s / M[i][i];
    }
    return x;
  }

  // SCCS likelihood: each case contributes a multinomial over its intervals,
  // P(event in interval k) ∝ length_k × exp(x_k · θ). Newton–Raphson on θ.
  // cases: [{ivs: [{len, x: [...]}], ev: index of interval holding the event}]
  function fitSCCS(cases, p) {
    var th = new Array(p).fill(0), H, it;
    for (it = 0; it < 40; it++) {
      var g = new Array(p).fill(0);
      H = [];
      for (var a = 0; a < p; a++) { H.push(new Array(p).fill(0)); H[a][a] = 1e-9; }
      cases.forEach(function (cs) {
        var w = cs.ivs.map(function (iv) {
          var e = 0; for (var j = 0; j < p; j++) e += iv.x[j] * th[j];
          return iv.len * Math.exp(e);
        });
        var W = w.reduce(function (s, v) { return s + v; }, 0);
        var xb = new Array(p).fill(0);
        cs.ivs.forEach(function (iv, k) { for (var j = 0; j < p; j++) xb[j] += w[k] / W * iv.x[j]; });
        var xe = cs.ivs[cs.ev].x;
        for (var j = 0; j < p; j++) g[j] += xe[j] - xb[j];
        cs.ivs.forEach(function (iv, k) {
          var pk = w[k] / W;
          for (var j = 0; j < p; j++) for (var l = 0; l < p; l++) H[j][l] += pk * (iv.x[j] - xb[j]) * (iv.x[l] - xb[l]);
        });
      });
      var d = solve(H, g), mx = 0;
      for (var j2 = 0; j2 < p; j2++) { th[j2] += d[j2]; mx = Math.max(mx, Math.abs(d[j2])); }
      if (mx < 1e-9) break;
    }
    var e0 = new Array(p).fill(0); e0[0] = 1;
    var v0 = solve(H, e0)[0];
    return { beta: th[0], se: Math.sqrt(Math.max(v0, 0)) };
  }

  var A0 = 366, A1 = 731; // observation: ages 366–730 days (12–24 months)
  var CUTS = [366, 427, 488, 549, 610, 671, 731];

  // Split [s, e) into intervals by age group and exposure window [w0, w1).
  function intervals(s, e, w0, w1, withAge) {
    var pts = [s, e];
    if (w0 !== null) { if (w0 > s && w0 < e) pts.push(w0); if (w1 > s && w1 < e) pts.push(w1); }
    if (withAge) CUTS.forEach(function (c) { if (c > s && c < e) pts.push(c); });
    pts = pts.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], mid = (a + b) / 2;
      var expd = w0 !== null && mid >= w0 && mid < w1 ? 1 : 0;
      var x = [expd];
      if (withAge) for (var gI = 2; gI < CUTS.length; gI++) x.push(mid >= CUTS[gI - 1] && mid < CUTS[gI] ? 1 : 0);
      out.push({ a: a, b: b, len: b - a, x: x });
    }
    return out;
  }

  V.register("sccs-builder", function (root) {
    var N = 500, SEED = 305897;
    var r = V.rng(SEED); for (var b = 0; b < 300; b++) r();
    var draws = [];
    for (var i = 0; i < N; i++) draws.push({ uv: r(), ut: r() });

    var ctr = V.controls(root);
    var sIRR = V.slider(ctr, { label: "True incidence rate ratio in the risk window", min: 1, max: 8, step: 0.25, value: 3, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sL = V.slider(ctr, { label: "Length of the risk window", min: 7, max: 84, step: 7, value: 42, fmt: function (v) { return v + " days"; }, onInput: draw });
    var sAge = V.slider(ctr, { label: "Age effect: incidence at 24 vs 12 months", min: -2, max: 2, step: 0.25, value: 1.5, fmt: function (v) { var m = Math.pow(2, v); return (m < 1 ? m.toFixed(2) : m.toFixed(1)) + "×"; }, onInput: draw });
    var tg = V.toggle(root, { options: [
      { value: "indep", label: "Event doesn’t affect vaccination" },
      { value: "dep", label: "Event rules out vaccination" },
      { value: "fix", label: "… analysed from vaccination only" }
    ], value: "indep", onChange: draw });

    V.legend(root, [
      { cls: "s3", label: "Event in risk window" },
      { cls: "s5", label: "Event in control time" },
      { cls: "s1", label: "Risk window after vaccination" },
      { cls: "s2", label: "Baseline incidence by age", dashed: true }
    ]);
    var c = V.svg(root, 640, 470);
    c.setAttribute("aria-label", "Top: histogram of event ages, split by whether the event fell in a vaccine risk window, with the baseline age curve. Bottom: timelines of 14 example cases showing observation period, risk window and event.");
    var host = el("g", null, c);
    var out = V.readouts(root, [
      { key: "truth", label: "True IRR" },
      { key: "crude", label: "SCCS estimate, no age adjustment" },
      { key: "adj", label: "SCCS estimate, age-adjusted (95% CI)" },
      { key: "n", label: "Cases analysed · events in risk windows" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 500 simulated cases observed from 12 to 24 months of age, vaccinated between about 12½ and 19 months. Age-adjusted fits use six two-month age groups, as in the classic MMR–ITP analysis. The last option is a simple fix; the formal model for this problem is eventdepenexp() in the R package SCCS." }, root);

    function draw() {
      var irr = sIRR.value(), L = sL.value(), ageLog = sAge.value() * Math.LN2, mode = tg.value();
      var lb = Math.log(irr);
      var cases = [];
      draws.forEach(function (d) {
        var v = Math.round(380 + 190 * Math.pow(d.uv, 1.2)); // scheduled vaccination age
        var w1 = Math.min(A1, v + L);
        // sample event day from density ∝ exp(age effect) × IRR in [v, v+L)
        var cum = [], tot = 0;
        for (var t = A0; t < A1; t++) {
          var lam = Math.exp(ageLog * (t - A0) / (A1 - A0)) * (t >= v && t < w1 ? irr : 1);
          tot += lam; cum.push(tot);
        }
        var u = d.ut * tot, lo = 0, hi = cum.length - 1;
        while (lo < hi) { var m = (lo + hi) >> 1; if (cum[m] < u) lo = m + 1; else hi = m; }
        var ev = A0 + lo + 0.5;
        var vacc = !(mode !== "indep" && ev < v); // event before scheduled dose → never vaccinated
        cases.push({ v: v, w1: w1, ev: ev, vacc: vacc });
      });

      function build(withAge) {
        var list = [];
        cases.forEach(function (cs) {
          var s = A0, e = A1;
          if (mode === "fix") { if (!cs.vacc) return; s = cs.v; }
          var ivs = intervals(s, e, cs.vacc ? cs.v : null, cs.vacc ? cs.w1 : null, withAge);
          var k = 0;
          for (var j = 0; j < ivs.length; j++) if (cs.ev >= ivs[j].a && cs.ev < ivs[j].b) k = j;
          // a case contributes to the exposure estimate only if it has some exposed and unexposed time
          list.push({ ivs: ivs, ev: k });
        });
        return list;
      }
      var crude = fitSCCS(build(false), 1);
      var adj = fitSCCS(build(true), 1 + CUTS.length - 2);
      var used = mode === "fix" ? cases.filter(function (cs) { return cs.vacc; }).length : cases.length;
      var inRisk = cases.filter(function (cs) { return cs.vacc && cs.ev >= cs.v && cs.ev < cs.w1 && (mode !== "fix" || cs.vacc); }).length;

      // ---- drawing
      clear(host);
      var x = V.scale(A0, A1, 70, 548);
      // top: histogram of event ages (stacked), 16-day bins
      var NB = 23, bw = (A1 - A0) / NB, hr = new Array(NB).fill(0), hc = new Array(NB).fill(0);
      cases.forEach(function (cs) {
        if (mode === "fix" && !cs.vacc) return;
        var bI = Math.min(NB - 1, Math.floor((cs.ev - A0) / bw));
        if (cs.vacc && cs.ev >= cs.v && cs.ev < cs.w1) hr[bI]++; else hc[bI]++;
      });
      var maxH = Math.max.apply(null, hr.map(function (v, i) { return v + hc[i]; })) || 1;
      var yT = V.scale(0, maxH * 1.1, 180, 30);
      el("text", { x: 70, y: 16, class: "viz-small viz-bold", text: "Ages at which the cases had their event" + (mode === "fix" ? " (vaccinated cases only)" : "") }, host);
      for (var bI = 0; bI < NB; bI++) {
        var x0 = x(A0 + bI * bw) + 1, wd = x(A0 + bw) - x(A0) - 2;
        el("rect", { x: x0, y: yT(hc[bI]), width: wd, height: yT(0) - yT(hc[bI]), class: "fill s5", style: "fill-opacity:0.55" }, host);
        el("rect", { x: x0, y: yT(hc[bI] + hr[bI]), width: wd, height: yT(hc[bI]) - yT(hc[bI] + hr[bI]), class: "fill s3" }, host);
      }
      // baseline age curve, scaled to the control-time histogram's mean height
      var meanC = hc.reduce(function (s, v) { return s + v; }, 0) / NB;
      var gm = 0; for (var q = 0; q < NB; q++) gm += Math.exp(ageLog * (q + 0.5) / NB); gm /= NB;
      var pts = [];
      for (var t2 = A0; t2 <= A1; t2 += 5) pts.push([x(t2), yT(meanC * Math.exp(ageLog * (t2 - A0) / (A1 - A0)) / gm)]);
      el("path", { d: V.line(pts), class: "stroke s2 dashed", style: "stroke-width:2" }, host);
      el("line", { x1: 70, x2: 548, y1: yT(0), y2: yT(0), class: "viz-axis" }, host);
      el("text", { x: 62, y: yT(0), "text-anchor": "end", "dominant-baseline": "middle", class: "viz-tick", text: "0" }, host);
      el("text", { x: 62, y: yT(maxH), "text-anchor": "end", "dominant-baseline": "middle", class: "viz-tick", text: String(maxH) }, host);

      // bottom: 14 example cases
      var y0 = 214;
      el("text", { x: 70, y: y0 - 6, class: "viz-small viz-bold", text: "Fourteen example cases" }, host);
      var shown = 0;
      for (var ci = 0; ci < cases.length && shown < 14; ci++) {
        var cs = cases[ci];
        // show a mix: include some event-before-vaccination cases
        if (shown < 10 && ci % 3 !== 0 && !(cs.ev < cs.v)) continue;
        var yy = y0 + 12 + shown * 15;
        var s0 = mode === "fix" && cs.vacc ? cs.v : A0;
        if (mode === "fix") {
          el("line", { x1: x(A0), x2: x(cs.vacc ? cs.v : A1), y1: yy, y2: yy, class: "stroke s5 dashed", style: "stroke-width:1.2;opacity:0.5" }, host);
        }
        if (!(mode === "fix" && !cs.vacc)) el("line", { x1: x(s0), x2: x(A1), y1: yy, y2: yy, class: "stroke s5", style: "stroke-width:2" }, host);
        if (cs.vacc) {
          el("rect", { x: x(cs.v), y: yy - 5, width: Math.max(2, x(cs.w1) - x(cs.v)), height: 10, rx: 2, class: "fill s1", style: "fill-opacity:0.6" }, host);
        } else {
          el("text", { x: x(A1) + 4, y: yy, "dominant-baseline": "middle", class: "viz-small viz-muted", text: "unvaccinated" }, host);
        }
        var inR = cs.vacc && cs.ev >= cs.v && cs.ev < cs.w1;
        el("circle", { cx: x(cs.ev), cy: yy, r: 4.5, class: "dot " + (inR ? "s3" : "s5"), style: inR ? "" : "stroke:var(--text);stroke-width:1" }, host);
        shown++;
      }
      var yAx = y0 + 12 + 14 * 15 + 4;
      el("line", { x1: 70, x2: 548, y1: yAx, y2: yAx, class: "viz-axis" }, host);
      [12, 14, 16, 18, 20, 22, 24].forEach(function (mo) {
        var dd = A0 + (mo - 12) * (A1 - A0) / 12;
        el("text", { x: x(dd), y: yAx + 16, "text-anchor": "middle", class: "viz-tick", text: mo }, host);
      });
      el("text", { x: 309, y: yAx + 36, "text-anchor": "middle", class: "viz-label", text: "Age (months)" }, host);

      function f(fit) { return Math.exp(fit.beta).toFixed(2); }
      out.truth(irr.toFixed(2));
      out.crude(f(crude));
      out.adj(f(adj) + " (" + Math.exp(adj.beta - 1.96 * adj.se).toFixed(2) + "–" + Math.exp(adj.beta + 1.96 * adj.se).toFixed(2) + ")");
      out.n(used + " · " + inRisk);
    }
    draw();
  });
})();
