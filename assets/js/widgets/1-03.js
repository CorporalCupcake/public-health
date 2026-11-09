// Lecture 1.3 — the social gradient and the slope index of inequality (illustrative numbers).
// Two salt policies lower the average by about the same amount. A campaign relies on people acting,
// so better-off groups gain more; reformulation changes the food at source, so every group falls by
// the same share. The slope index of inequality (SII) is the fitted gap between the very bottom
// (rank 0) and the very top (rank 1) of the income ladder.
Viz.register("social-gradient", function (root) {
  var V = Viz, el = V.el;
  var GROUPS = ["Poorest", "2nd", "3rd", "4th", "Richest"];
  var RANK = [0.1, 0.3, 0.5, 0.7, 0.9];               // midpoint of each fifth on the ladder
  var BASE = [150, 133, 117, 101, 85];                 // stroke deaths per 100,000 a year
  var POLICIES = {
    none: { cut: [0, 0, 0, 0, 0], text: "No policy yet. Each step up the income ladder brings fewer deaths: a gradient, not a cliff." },
    campaign: { cut: [0.04, 0.08, 0.12, 0.16, 0.20], text: "A campaign asks people to notice, decide and act. Groups with more money, time and education respond more, so they gain more." },
    reform: { cut: [0.11, 0.11, 0.11, 0.11, 0.11], text: "Reformulation lowers salt in food at source. It works whether or not anyone notices, so every group falls by the same share, and the worst-off, who start highest, gain the most deaths avoided." }
  };

  var mode = V.toggle(root, { options: [{ value: "none", label: "No policy" }, { value: "campaign", label: "Campaign" }, { value: "reform", label: "Reformulation" }], value: "none", onChange: draw });
  var desc = el("p", { class: "widget-note", style: "margin:0.6rem 0 0.4rem;min-height:3.3em" }, root);

  V.legend(root, [{ cls: "s5", label: "Before", dashed: true }, { cls: "s1", label: "With the policy" }, { cls: "s3", label: "Slope across the groups", dashed: true }]);
  var s = V.svg(root, 640, 280);
  var f = V.frame(s, { x: [0, 1], y: [0, 160], yTicks: [0, 40, 80, 120, 160], xTicks: [], margin: { left: 56, bottom: 46 }, xLabel: "Income fifth", yLabel: "Stroke deaths per 100,000" });
  var BW = 66;
  var bars = BASE.map(function (b, i) {
    var x = f.x(RANK[i]);
    el("text", { x: x, y: f.y(0) + 17, "text-anchor": "middle", class: "viz-tick", text: GROUPS[i] }, f.g);
    var now = el("rect", { x: x - BW / 2, width: BW, class: "fill s1" }, f.inner);
    el("rect", { x: x - BW / 2, width: BW, y: f.y(b), height: f.y(0) - f.y(b), class: "stroke dashed s5" }, f.inner);
    var lab = el("text", { x: x, "text-anchor": "middle", class: "viz-small viz-bold" }, f.inner);
    return { now: now, lab: lab };
  });
  var slope = el("path", { class: "stroke dashed s3" }, f.inner);

  var out = V.readouts(root, [
    { key: "avg", label: "Average across the five groups" },
    { key: "gap", label: "Gap between poorest and richest fifth" },
    { key: "sii", label: "Slope index of inequality (fitted bottom-to-top gap)" },
    { key: "verdict", label: "What happened to the gap" }
  ]);
  var vBox = root.querySelectorAll(".widget-readout")[3];
  el("p", { class: "widget-note", text: "Illustrative numbers. Both policies are set to lower the average by about the same amount." }, root);

  // Least-squares line through (rank, value); returns [value at rank 0, value at rank 1].
  function fit(v) {
    var mx = 0.5, my = v.reduce(function (a, b) { return a + b; }, 0) / v.length, sxy = 0, sxx = 0;
    v.forEach(function (y, i) { sxy += (RANK[i] - mx) * (y - my); sxx += (RANK[i] - mx) * (RANK[i] - mx); });
    var b = sxy / sxx;
    return [my - b * mx, my + b * (1 - mx)];
  }
  function mean(v) { return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
  var r0 = fit(BASE), sii0 = r0[0] - r0[1];

  function draw() {
    var p = POLICIES[mode.value()];
    desc.textContent = p.text;
    var v = BASE.map(function (b, i) { return b * (1 - p.cut[i]); });
    v.forEach(function (y, i) {
      bars[i].now.setAttribute("y", f.y(y)); bars[i].now.setAttribute("height", f.y(0) - f.y(y));
      bars[i].lab.setAttribute("y", f.y(Math.max(y, BASE[i])) - 7);
      bars[i].lab.textContent = Math.round(y);
    });
    var r = fit(v), sii = r[0] - r[1];
    slope.setAttribute("d", V.line([[f.x(0), f.y(r[0])], [f.x(1), f.y(r[1])]]));
    var none = mode.value() === "none";
    out.avg(none ? String(Math.round(mean(BASE))) : Math.round(mean(BASE)) + " → " + Math.round(mean(v)));
    out.gap(none ? String(Math.round(BASE[0] - BASE[4])) : Math.round(BASE[0] - BASE[4]) + " → " + Math.round(v[0] - v[4]));
    out.sii(none ? String(Math.round(sii0)) : Math.round(sii0) + " → " + Math.round(sii));
    var d = sii - sii0;
    out.verdict(none ? "–" : d > 0.5 ? "Wider" : d < -0.5 ? "Narrower" : "Same");
    vBox.classList.toggle("bad", d > 0.5); vBox.classList.toggle("good", d < -0.5);
  }
  draw();
});
