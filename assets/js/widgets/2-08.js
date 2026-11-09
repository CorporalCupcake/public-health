// Lecture 2.8 — Exposure misclassification in a case-control 2×2 table.
// Sensitivity and specificity of the exposure measurement, in cases and in controls.
// Expected counts (no random error). Illustrative numbers.
Viz.register("misclass-2x2", function (root) {
  var V = Viz, el = V.el;
  var NC = 500, NK = 500, PC = 0.40, PK = 0.20; // cases, controls, true exposure prevalence in each

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var mode = V.toggle(root, { options: [{ value: "nd", label: "Non-differential (same in cases and controls)" }, { value: "d", label: "Differential (set separately)" }], value: "nd", onChange: function () { sync(); draw(); } });
  var ctr = V.controls(root);
  function pct(v) { return v + "%"; }
  var s = {
    seC: V.slider(ctr, { label: "Sensitivity in cases", min: 50, max: 100, step: 1, value: 80, fmt: pct, onInput: function () { sync(); draw(); } }),
    spC: V.slider(ctr, { label: "Specificity in cases", min: 50, max: 100, step: 1, value: 90, fmt: pct, onInput: function () { sync(); draw(); } }),
    seK: V.slider(ctr, { label: "Sensitivity in controls", min: 50, max: 100, step: 1, value: 80, fmt: pct, onInput: draw }),
    spK: V.slider(ctr, { label: "Specificity in controls", min: 50, max: 100, step: 1, value: 90, fmt: pct, onInput: draw })
  };
  var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
  el("span", { class: "widget-note", style: "margin:0", text: "Presets:" }, pre);
  var presets = [
    ["Perfect measurement", "nd", 100, 100, 100, 100],
    ["Recall bias (cases remember more)", "d", 95, 95, 70, 95],
    ["Cases over-report", "d", 90, 75, 90, 95],
    ["Controls over-report", "d", 80, 95, 80, 75]
  ];
  var modeBtns = root.querySelectorAll(".widget-toggle button");
  presets.forEach(function (p) {
    V.button(pre, p[0], function () {
      if (mode.value() !== p[1]) modeBtns[p[1] === "nd" ? 0 : 1].click();
      s.seC.set(p[2]); s.spC.set(p[3]); s.seK.set(p[4]); s.spK.set(p[5]); sync(); draw();
    });
  });

  var tabs = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.8rem 1.2rem;margin:0.4rem 0 0.6rem" }, root);
  var c = V.svg(root, 640, 120);
  c.setAttribute("aria-label", "Odds ratio scale showing the true odds ratio and the observed odds ratio after misclassification");
  var out = V.readouts(root, [
    { key: "t", label: "True odds ratio" },
    { key: "o", label: "Observed odds ratio", cls: "bad" },
    { key: "d", label: "Direction of the bias" }
  ]);
  el("p", { class: "widget-note", text: "Illustrative numbers. 500 cases (40% truly exposed) and 500 controls (20% truly exposed). Expected counts, so there is no random error: every change is bias." }, root);

  function sync() {
    var nd = mode.value() === "nd";
    s.seK.input.disabled = nd; s.spK.input.disabled = nd;
    if (nd) { s.seK.set(s.seC.value()); s.spK.set(s.spC.value()); }
  }

  function table(parent, title, a, b, c2, d) {
    var w = el("div", { style: "flex:1 1 15rem;min-width:13rem" }, parent);
    el("div", { class: "widget-note", style: "margin:0 0 0.3rem;font-weight:700", text: title }, w);
    var tw = el("div", { class: "table-wrap", style: "margin:0" }, w);
    var t = el("table", { style: "margin:0" }, tw);
    var h = el("tr", null, el("thead", null, t));
    ["", "Exposed", "Unexposed"].forEach(function (x) { el("th", { text: x }, h); });
    var tb = el("tbody", null, t);
    [["Cases", a, b], ["Controls", c2, d]].forEach(function (r) {
      var tr = el("tr", null, tb);
      el("td", { text: r[0] }, tr); el("td", { text: V.fmt.int(r[1]) }, tr); el("td", { text: V.fmt.int(r[2]) }, tr);
    });
  }

  var LO = Math.log(0.25), HI = Math.log(8);
  function draw() {
    var seC = s.seC.value() / 100, spC = s.spC.value() / 100, seK = s.seK.value() / 100, spK = s.spK.value() / 100;
    var a = NC * PC, b = NC - a, cc = NK * PK, d = NK - cc;
    var a2 = seC * a + (1 - spC) * b, b2 = NC - a2, c2 = seK * cc + (1 - spK) * d, d2 = NK - c2;
    var orT = (a * d) / (b * cc), orO = (a2 * d2) / (b2 * c2);

    clear(tabs);
    table(tabs, "True exposure", a, b, cc, d);
    table(tabs, "Recorded exposure", a2, b2, c2, d2);

    clear(c);
    var x = V.scale(LO, HI, 30, 610), y0 = 70;
    el("line", { x1: 30, x2: 610, y1: y0, y2: y0, class: "viz-axis" }, c);
    [0.25, 0.5, 1, 2, 4, 8].forEach(function (t) {
      el("line", { x1: x(Math.log(t)), x2: x(Math.log(t)), y1: y0 - 4, y2: y0 + 4, class: "viz-axis" }, c);
      el("text", { x: x(Math.log(t)), y: y0 + 20, "text-anchor": "middle", class: "viz-tick", text: String(t) }, c);
    });
    el("text", { x: 320, y: y0 + 42, "text-anchor": "middle", class: "viz-label", text: "Odds ratio (log scale); 1 = no association" }, c);
    el("line", { x1: x(0), x2: x(0), y1: 14, y2: y0, class: "edge", "stroke-dasharray": "4 4" }, c);
    function cl(v) { return Math.max(LO, Math.min(HI, Math.log(v))); }
    var xt = x(cl(orT)), xo = x(cl(orO));
    el("line", { x1: xt, x2: xo, y1: y0 - 22, y2: y0 - 22, class: "stroke s3", "stroke-width": 1.5 }, c);
    el("circle", { cx: xt, cy: y0 - 22, r: 7, class: "dot s1" }, c);
    el("circle", { cx: xo, cy: y0 - 22, r: 7, class: "dot s3" }, c);
    var close = Math.abs(xt - xo) < 70, right = xo > xt;
    el("text", { x: xt, y: y0 - 36, "text-anchor": close ? (right ? "end" : "start") : "middle", class: "viz-small colour s1", text: "true " + orT.toFixed(2) }, c);
    el("text", { x: xo, y: close ? y0 - 50 : y0 - 36, "text-anchor": close ? (right ? "start" : "end") : "middle", class: "viz-small viz-bold colour s3", text: "observed " + orO.toFixed(2) }, c);

    out.t(orT.toFixed(2));
    out.o(orO.toFixed(2));
    var lt = Math.log(orT), lo = Math.log(orO), msg;
    if (Math.abs(lo - lt) < 0.005) msg = "none";
    else if (lo < 0) msg = "reversed: now looks protective";
    else if (lo < lt) msg = "toward the null (×" + (orO / orT).toFixed(2) + ")";
    else msg = "away from the null (×" + (orO / orT).toFixed(2) + ")";
    out.d(msg);
  }
  sync();
  draw();
});
