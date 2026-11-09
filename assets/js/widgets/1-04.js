// Lecture 1.4 — Crude versus age-standardised rates (illustrative numbers).
// Two towns, two age bands (under 50, 50 and over), as in the lecture's table.
// Crude rate = age-specific rates weighted by the town's own age structure.
// Age-standardised rate = the same rates weighted by one shared standard population.
Viz.register("age-standardisation", function (root) {
  var V = Viz, el = V.el;

  var presets = el("div", { class: "widget-controls", style: "grid-template-columns:repeat(auto-fit,minmax(200px,max-content));margin-bottom:0.4rem" }, root);
  V.button(presets, "Same risk, different ages", function () { load([10, 1, 20, 40, 1, 20, 25]); });
  V.button(presets, "Young town with higher risk", function () { load([5, 1.5, 30, 35, 1, 20, 25]); });

  var per1000 = function (v) { return V.fmt.num(v, 1) + " per 1,000"; };
  var pct = function (v) { return v + "%"; };
  // Two columns of sliders, one per town (stacks to one column on phones).
  var ctr = V.controls(root);
  ctr.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
  var colStyle = "display:flex;flex-direction:column;gap:0.6rem";
  var colA = el("div", { style: colStyle }, ctr), colB = el("div", { style: colStyle }, ctr);
  var ctrS = V.controls(root);
  ctrS.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
  var s = {
    aOld: V.slider(colA, { label: "Town A: share aged 50+", min: 0, max: 60, step: 1, value: 10, fmt: pct, onInput: draw }),
    aYoungR: V.slider(colA, { label: "Town A: death rate under 50", min: 0.5, max: 5, step: 0.5, value: 1, fmt: per1000, onInput: draw }),
    aOldR: V.slider(colA, { label: "Town A: death rate 50+", min: 5, max: 50, step: 1, value: 20, fmt: per1000, onInput: draw }),
    bOld: V.slider(colB, { label: "Town B: share aged 50+", min: 0, max: 60, step: 1, value: 40, fmt: pct, onInput: draw }),
    bYoungR: V.slider(colB, { label: "Town B: death rate under 50", min: 0.5, max: 5, step: 0.5, value: 1, fmt: per1000, onInput: draw }),
    bOldR: V.slider(colB, { label: "Town B: death rate 50+", min: 5, max: 50, step: 1, value: 20, fmt: per1000, onInput: draw }),
    std: V.slider(ctrS, { label: "Standard population: share aged 50+", min: 5, max: 60, step: 1, value: 25, fmt: pct, onInput: draw })
  };
  var order = ["aOld", "aYoungR", "aOldR", "bOld", "bYoungR", "bOldR", "std"];
  function load(v) { order.forEach(function (k, i) { s[k].set(v[i]); }); draw(); }

  // --- Age structure: three 100% bars
  V.legend(root, [{ cls: "s5", label: "Under 50" }, { cls: "s2", label: "50 and over" }]);
  var ag = V.svg(root, 640, 150);
  ag.setAttribute("aria-label", "Age structure of Town A, Town B and the standard population");
  var X0 = 150, X1 = 620, bx = V.scale(0, 1, X0, X1);
  var rows = [["Town A", 18], ["Town B", 62], ["Standard", 106]];
  var bars = rows.map(function (r) {
    el("text", { x: X0 - 12, y: r[1] + 16, "text-anchor": "end", class: "viz-bold", text: r[0] }, ag);
    var young = el("rect", { x: X0, y: r[1], height: 32, class: "fill-soft s5" }, ag);
    var old = el("rect", { y: r[1], height: 32, class: "fill s2" }, ag);
    var tY = el("text", { y: r[1] + 21, "text-anchor": "middle", class: "viz-small" }, ag);
    var tO = el("text", { y: r[1] + 21, "text-anchor": "middle", class: "viz-small viz-bold" }, ag);
    return { young: young, old: old, tY: tY, tO: tO };
  });
  el("line", { x1: X0, x2: X0, y1: 10, y2: 144, class: "viz-axis" }, ag);

  // --- Rates chart (redrawn on each change so the y axis fits)
  V.legend(root, [{ cls: "s1", label: "Town A" }, { cls: "s4", label: "Town B" }]);
  var rc = V.svg(root, 640, 260);
  rc.setAttribute("aria-label", "Bar chart of crude and age-standardised death rates in Town A and Town B");

  var out = V.readouts(root, [
    { key: "crude", label: "Crude rate: Town B ÷ Town A" },
    { key: "std", label: "Age-standardised rate: Town B ÷ Town A", cls: "good" }
  ]);
  var verdict = el("p", { class: "widget-note" }, root);
  el("p", { class: "widget-note", text: "Illustrative numbers. Real standardisation uses many age bands (often 5-year bands) and a published standard such as the WHO World Standard." }, root);

  function rate(share, rY, rO) { return (1 - share) * rY + share * rO; }

  function draw() {
    var a = s.aOld.value() / 100, b = s.bOld.value() / 100, w = s.std.value() / 100;
    var aY = s.aYoungR.value(), aO = s.aOldR.value(), bY = s.bYoungR.value(), bO = s.bOldR.value();

    [a, b, w].forEach(function (sh, i) {
      var r = bars[i], split = bx(1 - sh);
      r.young.setAttribute("width", split - X0);
      r.old.setAttribute("x", split); r.old.setAttribute("width", X1 - split);
      r.tY.setAttribute("x", (X0 + split) / 2); r.tY.textContent = (1 - sh) > 0.08 ? Math.round((1 - sh) * 100) + "%" : "";
      r.tO.setAttribute("x", (split + X1) / 2); r.tO.textContent = sh > 0.08 ? Math.round(sh * 100) + "%" : "";
    });

    var cA = rate(a, aY, aO), cB = rate(b, bY, bO), sA = rate(w, aY, aO), sB = rate(w, bY, bO);
    var ymax = Math.max(cA, cB, sA, sB) * 1.18;
    ymax = ymax <= 10 ? Math.ceil(ymax) : Math.ceil(ymax / 5) * 5;

    while (rc.firstChild) rc.removeChild(rc.firstChild);
    var f = V.frame(rc, { x: [0, 2], y: [0, ymax], xTicks: [], yLabel: "Deaths per 1,000 per year", margin: { left: 60 } });
    var groups = [["Crude rate", "each town’s own ages", cA, cB], ["Age-standardised rate", "both on the standard’s ages", sA, sB]];
    var bw = 64;
    groups.forEach(function (g, i) {
      var cx = f.x(i + 0.5);
      [[g[2], "s1", -1], [g[3], "s4", 1]].forEach(function (b) {
        var x = cx + (b[2] < 0 ? -bw - 6 : 6), y = f.y(b[0]);
        el("rect", { x: x, y: y, width: bw, height: f.y(0) - y, class: "fill " + b[1] }, f.inner);
        el("text", { x: x + bw / 2, y: y - 6, "text-anchor": "middle", class: "viz-bold", text: V.fmt.num(b[0], 1) }, f.inner);
      });
      el("text", { x: cx, y: rc.H - 26, "text-anchor": "middle", class: "viz-bold", text: g[0] }, f.inner);
      el("text", { x: cx, y: rc.H - 10, "text-anchor": "middle", class: "viz-small viz-muted", text: g[1] }, f.inner);
    });

    var rCrude = cB / cA, rStd = sB / sA;
    out.crude(V.fmt.num(rCrude, 2) + "×");
    out.std(V.fmt.num(rStd, 2) + "×");
    function say(r) { return Math.abs(r - 1) < 0.005 ? "the same as Town A’s" : V.fmt.num(r, 2) + " times Town A’s"; }
    verdict.textContent = "Crude rates say Town B’s death rate is " + say(rCrude) + ". With the same ages, it is " + say(rStd) + ".";
  }
  draw();
});
