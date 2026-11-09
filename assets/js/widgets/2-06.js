// Lecture 2.6 — Confounding: crude vs stratified risk ratios, with a binary confounder.
// Expected counts (no sampling noise), so only confounding moves the crude RR. Illustrative numbers.
Viz.register("confounding-strata", function (root) {
  var V = Viz, el = V.el, N = 5000, R0 = 0.04; // per exposure group; baseline risk (no exposure, no confounder)

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var ctr = V.controls(root);
  var sImb = V.slider(ctr, { label: "Carry confounder (exposed / unexposed)", min: 50, max: 95, step: 5, value: 80, fmt: function (v) { return v + "/" + (100 - v) + "%"; }, onInput: draw });
  var sC = V.slider(ctr, { label: "Confounder’s effect on outcome (RR)", min: 1, max: 8, step: 0.5, value: 4, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
  var sE = V.slider(ctr, { label: "True exposure effect (RR per stratum)", min: 0.5, max: 2, step: 0.05, value: 0.8, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

  var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
  el("span", { class: "widget-note", style: "margin:0", text: "Presets:" }, pre);
  [["No confounding", 50, 4, 0.8], ["Exaggerated harm", 75, 3, 1.5], ["Simpson’s paradox", 85, 6, 0.8]].forEach(function (p) {
    V.button(pre, p[0], function () { sImb.set(p[1]); sC.set(p[2]); sE.set(p[3]); draw(); });
  });

  V.legend(root, [{ cls: "s2", label: "Exposed" }, { cls: "s5", label: "Unexposed" }]);
  var c = V.svg(root, 640, 290);
  c.setAttribute("aria-label", "Bar chart of risk in exposed and unexposed people, within each confounder stratum and overall (crude)");
  var mix = V.svg(root, 640, 92);
  mix.setAttribute("aria-label", "Share of exposed and unexposed people who carry the confounder");

  var out = V.readouts(root, [
    { key: "crude", label: "Crude RR (everyone pooled)", cls: "bad" },
    { key: "mh", label: "Adjusted RR (Mantel–Haenszel, across strata)", cls: "good" },
    { key: "bias", label: "Crude ÷ adjusted: how much confounding" }
  ]);
  el("p", { class: "widget-note", text: "Illustrative numbers. 5,000 exposed and 5,000 unexposed people; risk 4% with neither factor, multiplied by each RR. Expected counts, so there is no random error: every gap between crude and adjusted is confounding." }, root);

  function draw() {
    var p1 = sImb.value() / 100, p0 = 1 - p1, rc = sC.value(), re = sE.value();
    // Strata: k = 0 (no confounder), 1 (confounder)
    var S = [0, 1].map(function (k) {
      var nE = N * (k ? p1 : 1 - p1), nU = N * (k ? p0 : 1 - p0);
      var rU = R0 * (k ? rc : 1), rE = rU * re;
      return { nE: nE, nU: nU, rE: rE, rU: rU, aE: nE * rE, aU: nU * rU };
    });
    var cE = (S[0].aE + S[1].aE) / N, cU = (S[0].aU + S[1].aU) / N;
    var num = 0, den = 0;
    S.forEach(function (s) { var T = s.nE + s.nU; num += s.aE * s.nU / T; den += s.aU * s.nE / T; });
    var mh = num / den, crude = cE / cU;

    clear(c);
    var ymax = Math.max(0.1, Math.ceil(Math.max(S[1].rE, S[1].rU, cE, cU) * 1.25 * 20) / 20);
    var f = V.frame(c, { x: [0, 3], y: [0, ymax], xTicks: [], fmtY: V.fmt.pct, margin: { top: 30, bottom: 52 }, yLabel: "Risk of the outcome" });
    var g = f.inner;
    var groups = [
      { name: "Without confounder", rE: S[0].rE, rU: S[0].rU, n: V.fmt.int(S[0].nE) + " exp. · " + V.fmt.int(S[0].nU) + " unexp." },
      { name: "With confounder", rE: S[1].rE, rU: S[1].rU, n: V.fmt.int(S[1].nE) + " exp. · " + V.fmt.int(S[1].nU) + " unexp." },
      { name: "Everyone (crude)", rE: cE, rU: cU, n: "strata pooled, ignoring the confounder" }
    ];
    groups.forEach(function (gr, i) {
      var cx = f.x(i + 0.5), bw = 50;
      if (i === 2) el("line", { x1: f.x(2), x2: f.x(2), y1: f.y(0), y2: f.y(ymax), class: "viz-grid", "stroke-dasharray": "4 4" }, g);
      el("rect", { x: cx - bw - 4, y: f.y(gr.rE), width: bw, height: f.y(0) - f.y(gr.rE), class: "fill s2" }, g);
      el("rect", { x: cx + 4, y: f.y(gr.rU), width: bw, height: f.y(0) - f.y(gr.rU), class: "fill-soft s5" }, g);
      el("rect", { x: cx + 4, y: f.y(gr.rU), width: bw, height: f.y(0) - f.y(gr.rU), fill: "none", class: "stroke s5", "stroke-width": 1.5 }, g);
      el("text", { x: cx - bw / 2 - 4, y: f.y(gr.rE) - 5, "text-anchor": "middle", class: "viz-small", text: V.fmt.pct1(gr.rE) }, g);
      el("text", { x: cx + bw / 2 + 4, y: f.y(gr.rU) - 5, "text-anchor": "middle", class: "viz-small", text: V.fmt.pct1(gr.rU) }, g);
      var rr = gr.rE / gr.rU;
      el("text", { x: cx, y: 16, "text-anchor": "middle", class: "viz-bold" + (i === 2 ? " colour s3" : ""), text: "RR " + rr.toFixed(2) }, g);
      el("text", { x: cx, y: f.y(0) + 17, "text-anchor": "middle", class: "viz-small viz-bold", text: gr.name }, g);
      el("text", { x: cx, y: f.y(0) + 33, "text-anchor": "middle", class: "viz-small viz-muted", text: gr.n }, g);
    });

    // Who carries the confounder
    clear(mix);
    var L = 150, R = 624;
    el("text", { x: L, y: 12, class: "viz-small viz-muted", text: "Share who carry the confounder" }, mix);
    [["Exposed", p1, 22], ["Unexposed", p0, 56]].forEach(function (r) {
      el("text", { x: L - 10, y: r[2] + 15, "text-anchor": "end", class: "viz-small", text: r[0] }, mix);
      el("rect", { x: L, y: r[2], width: R - L, height: 22, class: "fill-soft s5" }, mix);
      el("rect", { x: L, y: r[2], width: (R - L) * r[1], height: 22, class: "fill-soft s4" }, mix);
      el("rect", { x: L, y: r[2], width: (R - L) * r[1], height: 22, fill: "none", class: "stroke s4", "stroke-width": 1.5 }, mix);
      var wbar = (R - L) * r[1], inside = wbar > 60;
      el("text", { x: inside ? L + wbar - 6 : L + wbar + 6, y: r[2] + 15, "text-anchor": inside ? "end" : "start", class: "viz-small viz-bold", text: V.fmt.pct(r[1]) }, mix);
    });

    out.crude(crude.toFixed(2));
    out.mh(mh.toFixed(2));
    out.bias("× " + (crude / mh).toFixed(2));
  }
  draw();
});
