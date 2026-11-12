// Lecture 6.5 — Vaccination programmes: the screening-method curves (share of cases vaccinated
// vs population coverage, for several VE values) and a test-negative design bias explorer.
// Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }

  // Screening method: PCV = PPV(1-VE) / (1 - PPV*VE); VE = 1 - [PCV/(1-PCV)]*[(1-PPV)/PPV]
  function pcvFrom(ppv, ve) { return ppv * (1 - ve) / (1 - ppv * ve); }
  function veFrom(ppv, pcv) { return 1 - (pcv / (1 - pcv)) * ((1 - ppv) / ppv); }
  function fmtVE(v) { return isFinite(v) ? (v < -0.995 ? "below −99%" : Math.round(v * 100) + "%") : "–"; }

  V.register("screening-method", function (root) {
    var ctr = V.controls(root);
    var sP = V.slider(ctr, { label: "Population coverage (PPV)", min: 0.3, max: 0.98, step: 0.01, value: 0.9, fmt: V.fmt.pct, onInput: draw });
    var sC = V.slider(ctr, { label: "Share of cases who were vaccinated (PCV)", min: 0.02, max: 0.95, step: 0.01, value: 0.5, fmt: V.fmt.pct, onInput: draw });

    V.legend(root, [{ cls: "s5", label: "Curves of equal VE" }, { cls: "s1", label: "Your estimate" }, { cls: "s3", label: "If coverage is really 5 points higher or lower" }]);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Proportion of cases vaccinated against population coverage, with curves for vaccine effectiveness from 0 to 95 percent, and the chosen point");
    var out = V.readouts(root, [
      { key: "ve", label: "Estimated vaccine effectiveness", cls: "good" },
      { key: "lo", label: "If true coverage is 5 points lower" },
      { key: "hi", label: "If true coverage is 5 points higher" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each curve shows where cases would sit if the vaccine had that effectiveness and cases and population were otherwise comparable. Points above the 0% curve mean vaccinated people were over-represented among cases." }, root);

    var VES = [0, 0.5, 0.7, 0.8, 0.9, 0.95];
    function draw() {
      var ppv = sP.value(), pcv = sC.value();
      clear(c);
      var f = V.frame(c, { x: [0, 1], y: [0, 1], fmtX: V.fmt.pct, fmtY: V.fmt.pct, xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], yTicks: [0, 0.2, 0.4, 0.6, 0.8, 1], xLabel: "Population coverage (PPV)", yLabel: "Share of cases vaccinated (PCV)", margin: { right: 24 } });
      var G = f.inner;
      VES.forEach(function (ve) {
        var pts = []; for (var i = 0; i <= 100; i++) { var p = i / 100; pts.push([f.x(p), f.y(pcvFrom(p, ve))]); }
        el("path", { d: V.line(pts), class: "stroke s5", "stroke-width": 1.6 }, G);
      });
      // contour-style labels where each curve crosses PCV = 25%, drawn on top of all curves
      VES.forEach(function (ve) {
        var px = 0.25 / (1 - ve + 0.25 * ve);
        el("text", { x: f.x(px), y: f.y(0.25) + 4, "text-anchor": "middle", class: "viz-small viz-muted", style: "paint-order:stroke;stroke:var(--surface);stroke-width:6px;stroke-linejoin:round", text: Math.round(ve * 100) + "%" }, G);
      });
      el("text", { x: f.x(0.02), y: f.y(0.25) + 4, class: "viz-small viz-muted", text: "VE:" }, G);
      // sensitivity band
      [ppv - 0.05, ppv + 0.05].forEach(function (p) {
        if (p <= 0.01 || p >= 0.995) return;
        el("circle", { cx: f.x(p), cy: f.y(pcv), r: 4.5, class: "dot s3" }, G);
      });
      el("line", { x1: f.x(Math.max(0.01, ppv - 0.05)), x2: f.x(Math.min(0.995, ppv + 0.05)), y1: f.y(pcv), y2: f.y(pcv), class: "stroke s3", "stroke-width": 1.5 }, G);
      el("circle", { cx: f.x(ppv), cy: f.y(pcv), r: 7, class: "dot s1" }, G);
      var ve = veFrom(ppv, pcv);
      var tx = f.x(ppv) - 10, anchor = "end";
      if (tx < 140) { tx = f.x(ppv) + 12; anchor = "start"; }
      el("text", { x: tx, y: f.y(pcv) - 12, class: "viz-small viz-bold colour s1", "text-anchor": anchor, style: halo(), text: "VE ≈ " + fmtVE(ve) }, G);

      out.ve(fmtVE(ve));
      out.lo(ppv - 0.05 > 0.01 ? fmtVE(veFrom(ppv - 0.05, pcv)) : "–");
      out.hi(ppv + 0.05 < 0.995 ? fmtVE(veFrom(ppv + 0.05, pcv)) : "–");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Test-negative design bias explorer.
  V.register("tnd-bias", function (root) {
    var ctr = V.controls(root);
    var sVE = V.slider(ctr, { label: "True VE against the target infection", min: 0, max: 0.9, step: 0.05, value: 0.6, fmt: V.fmt.pct, onInput: draw });
    var sCare = V.slider(ctr, { label: "Vaccinated people’s care-seeking vs unvaccinated (×)", min: 0.5, max: 2, step: 0.1, value: 1.5, fmt: function (v) { return "× " + v.toFixed(1); }, onInput: draw });
    var sOth = V.slider(ctr, { label: "Vaccine effect on other respiratory illness", min: -0.3, max: 0.3, step: 0.05, value: 0, fmt: function (v) { return v === 0 ? "none" : (v > 0 ? "reduces " : "raises ") + Math.round(Math.abs(v) * 100) + "%"; }, onInput: draw });
    var sSens = V.slider(ctr, { label: "Test sensitivity", min: 0.6, max: 1, step: 0.01, value: 0.95, fmt: V.fmt.pct, onInput: draw });
    var sSpec = V.slider(ctr, { label: "Test specificity", min: 0.8, max: 1, step: 0.01, value: 1, fmt: V.fmt.pct, onInput: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;margin:0 0 0.8rem" }, root);
    V.button(pre, "Ideal conditions", function () { sCare.set(1.5); sOth.set(0); sSens.set(1); sSpec.set(1); draw(); });
    V.button(pre, "Imperfect test", function () { sSens.set(0.8); sSpec.set(0.9); sOth.set(0); draw(); });
    V.button(pre, "Vaccine also prevents other illness", function () { sOth.set(0.2); sSens.set(1); sSpec.set(1); draw(); });

    var c = V.svg(root, 640, 210);
    c.setAttribute("aria-label", "Bars comparing the true vaccine effectiveness with the test-negative estimate and a naive estimate based on medically attended cases");
    var out = V.readouts(root, [
      { key: "true", label: "True VE" },
      { key: "tnd", label: "Test-negative estimate", cls: "good" },
      { key: "naive", label: "Naive estimate: attended cases per person", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Per season, 5% of unvaccinated people get the target infection and 10% get another respiratory illness; 40% of unvaccinated ill people seek care and are tested. The naive estimate compares medically attended, test-positive cases per person, so it absorbs the difference in care-seeking." }, root);

    function draw() {
      var ve = sVE.value(), care = sCare.value(), oth = sOth.value(), se = sSens.value(), sp = sSpec.value();
      var incT = 0.05, incO = 0.10, c0 = 0.4, c1 = Math.min(1, c0 * care);
      function grp(vacc) {
        var T = incT * (vacc ? 1 - ve : 1), O = incO * (vacc ? 1 - oth : 1), cc = vacc ? c1 : c0;
        var pos = cc * (se * T + (1 - sp) * O), neg = cc * ((1 - se) * T + sp * O);
        return { pos: pos, neg: neg };
      }
      var g1 = grp(true), g0 = grp(false);
      var tnd = 1 - (g1.pos / g1.neg) / (g0.pos / g0.neg);
      var naive = 1 - g1.pos / g0.pos;

      clear(c);
      var x0 = 250, x1 = 600, sx = V.scale(-0.5, 1, x0, x1);
      var rows = [["True VE", ve, "fill s5"], ["Test-negative design", tnd, "fill s1"], ["Naive: attended cases", naive, "fill s3"]];
      [-0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
        el("line", { x1: sx(v), x2: sx(v), y1: 10, y2: 160, class: v === 0 ? "viz-axis" : "viz-grid" }, c);
        el("text", { x: sx(v), y: 178, "text-anchor": "middle", class: "viz-tick", text: Math.round(v * 100) + "%" }, c);
      });
      el("line", { x1: sx(ve), x2: sx(ve), y1: 10, y2: 160, class: "stroke dashed s5", "stroke-width": 1.5 }, c);
      rows.forEach(function (rw, i) {
        var y = 20 + i * 46, v = Math.max(-0.5, Math.min(1, rw[1]));
        el("text", { x: x0 - 10, y: y + 18, "text-anchor": "end", class: "viz-small", text: rw[0] }, c);
        var a = Math.min(sx(0), sx(v)), w = Math.abs(sx(v) - sx(0));
        el("rect", { x: a, y: y, width: Math.max(1, w), height: 28, class: rw[2] }, c);
        var lx = v >= 0 ? sx(v) + 6 : sx(v) - 6;
        el("text", { x: lx, y: y + 18, "text-anchor": v >= 0 ? "start" : "end", class: "viz-small viz-bold", style: halo(), text: fmtVE(rw[1]) }, c);
      });
      el("text", { x: (x0 + x1) / 2, y: 200, "text-anchor": "middle", class: "viz-label", text: "Vaccine effectiveness (negative = vaccinated look worse)" }, c);

      out["true"](fmtVE(ve));
      out.tnd(fmtVE(tnd));
      out.naive(fmtVE(naive));
    }
    draw();
  });
})();
