// Lecture 2.17 — toy 10-year cardiovascular risk score with recalibration.
// Illustrative coefficients only. NOT a clinical tool.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // A labelled segmented toggle that sits in the controls grid.
  function labelledToggle(parent, label, options, value, onChange) {
    var wrap = el("div", { class: "widget-slider" }, parent);
    el("span", { class: "widget-slider-label", text: label }, wrap);
    return V.toggle(wrap, { options: options, value: value, onChange: onChange });
  }

  V.register("cvd-risk", function (root) {
    // Cox-style score: risk = 1 − (1 − base)^exp(LP), LP measured from a reference person
    // (age 55, SBP 130, cholesterol 5.5, non-smoker, no diabetes).
    var B = { age: 0.06, sbp: 0.015, chol: 0.18, smoke: 0.55, diab: 0.5 };
    var BASE = { orig: 0.06, high: 0.12 };

    var ctr = V.controls(root);
    var sAge = V.slider(ctr, { label: "Age", min: 40, max: 75, step: 1, value: 55, fmt: function (v) { return v + " years"; }, onInput: draw });
    var sSbp = V.slider(ctr, { label: "Systolic blood pressure", min: 100, max: 180, step: 2, value: 140, fmt: function (v) { return v + " mmHg"; }, onInput: draw });
    var sChol = V.slider(ctr, { label: "Total cholesterol", min: 3.5, max: 8, step: 0.1, value: 5.5, fmt: function (v) { return v.toFixed(1) + " mmol/L"; }, onInput: draw });
    var sRrr = V.slider(ctr, { label: "Treatment cuts risk by (relative)", min: 0, max: 40, step: 5, value: 25, fmt: function (v) { return v + "%"; }, onInput: draw });
    var tSmoke = labelledToggle(ctr, "Current smoker", [{ value: 0, label: "No" }, { value: 1, label: "Yes" }], 0, draw);
    var tDiab = labelledToggle(ctr, "Diabetes", [{ value: 0, label: "No" }, { value: 1, label: "Yes" }], 0, draw);
    var tPop = labelledToggle(ctr, "Baseline risk used", [{ value: "orig", label: "As built" }, { value: "high", label: "Higher-risk population" }], "orig", draw);

    // Icon array: 100 people like this one
    var ic = V.svg(root, 640, 150);
    ic.setAttribute("aria-label", "One hundred people with this risk profile; coloured dots show who has a cardiovascular event in ten years, and who is spared by treatment");
    V.legend(root, [
      { cls: "s3", label: "Event even with treatment" },
      { cls: "s2", label: "Event prevented by treatment" },
      { cls: "s5", label: "No event in 10 years" }
    ]);

    // Risk by age for this profile, both calibrations
    var c = V.svg(root, 640, 270);
    c.setAttribute("aria-label", "Ten-year risk by age for this profile, as built and after recalibration to a higher-risk population");
    V.legend(root, [
      { cls: "s1", label: "Score as built (derivation population)" },
      { cls: "s3", label: "Recalibrated to a population with twice the baseline risk", dashed: true }
    ]);

    var out = V.readouts(root, [
      { key: "risk", label: "10-year risk of a heart attack or stroke", cls: "bad" },
      { key: "other", label: "Same person under the other calibration" },
      { key: "arr", label: "Absolute risk reduction with treatment", cls: "good" },
      { key: "nnt", label: "Number needed to treat for 10 years" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative coefficients, not for clinical use. Recalibration here resets only the baseline risk (6% → 12% for the reference person); the coefficients, and so the ranking of people, stay the same." }, root);

    function lp(age, sbp, chol, smoke, diab) {
      return B.age * (age - 55) + B.sbp * (sbp - 130) + B.chol * (chol - 5.5) + B.smoke * smoke + B.diab * diab;
    }
    function risk(l, base) { return 1 - Math.pow(1 - base, Math.exp(l)); }

    function draw() {
      var age = sAge.value(), sbp = sSbp.value(), chol = sChol.value(), sm = tSmoke.value(), di = tDiab.value();
      var pop = tPop.value(), other = pop === "orig" ? "high" : "orig";
      var rrr = sRrr.value() / 100;
      var r = risk(lp(age, sbp, chol, sm, di), BASE[pop]);
      var rOther = risk(lp(age, sbp, chol, sm, di), BASE[other]);
      var rTx = r * (1 - rrr);

      // --- icon array
      clear(ic);
      var nEv = Math.round(r * 100), nTx = Math.round(rTx * 100);
      el("text", { x: 54, y: 16, class: "viz-small viz-muted", text: "100 people with this profile, followed for 10 years" }, ic);
      for (var i = 0; i < 100; i++) {
        var col = i % 20, row = Math.floor(i / 20);
        var cls = i < nTx ? "fill s3" : i < nEv ? "fill s2" : "fill-soft s5";
        el("circle", { cx: 64 + col * 27.5, cy: 40 + row * 24, r: 9.5, class: cls }, ic);
      }

      // --- risk-by-age chart
      clear(c);
      var maxR = 0, ages = [];
      for (var a = 40; a <= 75; a++) ages.push(a);
      var curves = { orig: [], high: [] };
      ages.forEach(function (a) {
        var l = lp(a, sbp, chol, sm, di);
        ["orig", "high"].forEach(function (k) { var v = risk(l, BASE[k]); curves[k].push([a, v]); if (v > maxR) maxR = v; });
      });
      var ymax = [0.2, 0.4, 0.6, 0.8, 1].filter(function (v) { return v >= maxR; })[0] || 1;
      var f = V.frame(c, { x: [40, 75], y: [0, ymax], fmtY: V.fmt.pct, xLabel: "Age (years)", yLabel: "10-year risk" });
      function path(pts) { return V.line(pts.map(function (p) { return [f.x(p[0]), f.y(p[1])]; })); }
      el("path", { d: path(curves.orig), class: "stroke s1" }, f.inner);
      el("path", { d: path(curves.high), class: "stroke dashed s3" }, f.inner);
      el("line", { x1: f.x(age), x2: f.x(age), y1: f.y(0), y2: f.y(ymax), class: "edge", "stroke-dasharray": "4 4" }, f.inner);
      el("circle", { cx: f.x(age), cy: f.y(r), r: 6, class: "dot " + (pop === "orig" ? "s1" : "s3") }, f.inner);
      // Curves rise to the right, so put the label above-left (or below-right near the left edge).
      var left = age > 48;
      el("text", { x: f.x(age) + (left ? -10 : 10), y: f.y(r) + (left ? -10 : 20), "text-anchor": left ? "end" : "start", class: "viz-small viz-bold colour " + (pop === "orig" ? "s1" : "s3"), text: V.fmt.pct(r) + " at age " + age }, f.inner);

      out.risk(V.fmt.pct1(r));
      out.other(V.fmt.pct1(rOther));
      var arr = r - rTx;
      out.arr(arr > 0 ? V.fmt.pct1(arr) + " points" : "–");
      out.nnt(arr > 0.0005 ? V.fmt.int(Math.ceil(1 / arr)) : "–");
    }
    draw();
  });
})();
