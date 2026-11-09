// Lecture 1.6 — One person's YLL, YLD, DALYs and QALYs (illustrative numbers).
// Full health until onset, then health = 1 − disability weight until death.
// YLL = remaining life expectancy at the age of death, read from a life table:
//   either a GBD-style reference table (e0 ≈ 88) or a national table with poorer survival (e0 ≈ 72).
// Both tables are made up (smooth Gompertz–Makeham schedules tuned to those e0 values).
Viz.register("daly-profile", function (root) {
  var V = Viz, el = V.el, MAXAGE = 110;

  // Remaining life expectancy e(x) for a schedule; B is tuned so that e0 hits the target.
  function lifeTable(u5, A, B) {
    var c = 0.1, l = [1, 1 - 0.7 * u5], r = Math.pow((1 - u5) / (1 - 0.7 * u5), 0.25), x;
    for (x = 2; x <= 5; x++) l.push(l[x - 1] * r);
    for (x = 5; x < MAXAGE; x++) l.push(l[x] * Math.exp(-(A + B * Math.exp(c * (x + 0.5)))));
    l[MAXAGE] = 0;
    var T = []; T[MAXAGE] = 0;
    for (x = MAXAGE - 1; x >= 0; x--) T[x] = T[x + 1] + (x === 0 ? l[1] + 0.1 * (l[0] - l[1]) : (l[x] + l[x + 1]) / 2);
    return function (a) { var i = Math.floor(a), f = a - i, ei = T[i] / l[i], ej = i + 1 < MAXAGE ? T[i + 1] / l[i + 1] : 0; return ei + f * (ej - ei); };
  }
  function tuned(target, u5, A) {
    var lo = 1e-7, hi = 1e-3;
    for (var k = 0; k < 60; k++) { var mid = Math.sqrt(lo * hi); if (lifeTable(u5, A, mid)(0) > target) lo = mid; else hi = mid; }
    return lifeTable(u5, A, Math.sqrt(lo * hi));
  }
  var tables = { ref: tuned(88, 0.003, 0.0002), nat: tuned(72, 0.03, 0.0008) };

  var ctr = V.controls(root);
  ctr.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
  var s = {
    onset: V.slider(ctr, { label: "Age when illness starts", min: 0, max: 100, step: 1, value: 55, onInput: draw }),
    death: V.slider(ctr, { label: "Age at death", min: 1, max: 100, step: 1, value: 70, onInput: draw }),
    dw: V.slider(ctr, { label: "Disability weight (0 to 1)", min: 0, max: 1, step: 0.01, value: 0.3, fmt: function (v) { return v.toFixed(2); }, onInput: draw }),
    ut: V.slider(ctr, { label: "Utility of that state (QALY view)", min: -0.2, max: 1, step: 0.01, value: 0.6, fmt: function (v) { return v.toFixed(2); }, onInput: draw })
  };
  var tog = el("div", { class: "widget-controls", style: "grid-template-columns:repeat(auto-fit,minmax(240px,max-content))" }, root);
  var view = V.toggle(tog, { options: [{ value: "daly", label: "DALYs: health lost" }, { value: "qaly", label: "QALYs: health lived" }], value: "daly", onChange: draw });
  var tab = V.toggle(tog, { options: [{ value: "ref", label: "Reference table (e₀ ≈ 88)" }, { value: "nat", label: "Poorer national table (e₀ ≈ 72)" }], value: "ref", onChange: draw });

  var leg = el("div", null, root);
  var c = V.svg(root, 640, 290);
  c.setAttribute("aria-label", "One person's health over their life, with the years lost to early death and to illness shaded");

  var out = V.readouts(root, [
    { key: "yll", label: "YLL: remaining life expectancy at the age of death" },
    { key: "yld", label: "YLD: years ill × disability weight" },
    { key: "daly", label: "DALYs = YLL + YLD", cls: "bad" },
    { key: "qaly", label: "QALYs lived: years × utility", cls: "good" }
  ]);
  el("p", { class: "widget-note", text: "Illustrative numbers. This follows one person. GBD itself adds up YLD from prevalence year by year (section 3). Disability weights and utilities come from different surveys, so a utility need not equal 1 minus the weight." }, root);

  function draw() {
    var death = s.death.value(), onset = Math.min(s.onset.value(), death), dw = s.dw.value(), ut = s.ut.value();
    var e = tables[tab.value()], yll = e(death), ill = death - onset, yld = ill * dw, qaly = onset + ill * ut;
    var isD = view.value() === "daly";

    while (c.firstChild) c.removeChild(c.firstChild);
    while (leg.firstChild) leg.removeChild(leg.firstChild);
    var ymin = isD ? 0 : Math.min(0, ut);
    var f = V.frame(c, { x: [0, 110], y: [ymin, 1], xTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], yTicks: ymin < 0 ? [-0.2, 0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1], fmtY: function (v) { return v.toFixed(v % 1 ? 2 : 0).replace(/^-/, "−"); }, xLabel: "Age", yLabel: isD ? "Health (1 = full)" : "Utility (1 = full)", margin: { top: 30 } });
    var X = f.x, Y = f.y, g = f.inner;
    function rect(x0, x1, y0, y1, cls) { if (x1 - x0 > 0 && Math.abs(Y(y0) - Y(y1)) > 0) el("rect", { x: X(x0), width: X(x1) - X(x0), y: Math.min(Y(y0), Y(y1)), height: Math.abs(Y(y0) - Y(y1)), class: cls }, g); }
    function label(x, y, t, cls) { el("text", { x: x, y: y, "text-anchor": "middle", class: cls || "viz-bold", text: t }, g); }

    if (isD) {
      V.legend(leg, [{ cls: "s1", label: "Health lived" }, { cls: "s2", label: "YLD (lost to illness)" }, { cls: "s3", label: "YLL (lost to early death)" }]);
      rect(0, onset, 0, 1, "fill-soft s1");
      rect(onset, death, 0, 1 - dw, "fill-soft s1");
      rect(onset, death, 1 - dw, 1, "fill s2");
      rect(death, death + yll, 0, 1, "fill s3");
      el("path", { d: V.line([[X(0), Y(1)], [X(onset), Y(1)], [X(onset), Y(1 - dw)], [X(death), Y(1 - dw)], [X(death), Y(0)]]), class: "stroke s1" }, g);
      if (X(death + yll) - X(death) > 34) label((X(death) + X(death + yll)) / 2, Y(0.5) + 5, "YLL");
      if (yld > 0 && X(death) - X(onset) > 34 && Y(1 - dw) - Y(1) > 22) label((X(onset) + X(death)) / 2, (Y(1) + Y(1 - dw)) / 2 + 5, "YLD");
    } else {
      var items = [{ cls: "s1", label: "QALYs lived (area)" }, { cls: "s2", label: "1 − disability weight, for comparison", dashed: true }, { cls: "s5", label: "Further years the life table expected" }];
      if (ut < 0) items.push({ cls: "s3", label: "Below 0: a state judged worse than death (subtracts QALYs)" });
      V.legend(leg, items);
      rect(0, onset, 0, 1, "fill s1");
      if (ut >= 0) rect(onset, death, 0, ut, "fill s1"); else rect(onset, death, ut, 0, "fill s3");
      rect(death, death + yll, 0, 1, "fill-soft s5");
      el("path", { d: V.line([[X(0), Y(1)], [X(onset), Y(1)], [X(onset), Y(ut)], [X(death), Y(ut)], [X(death), Y(0)]]), class: "stroke s1" }, g);
      if (ill > 0) el("path", { d: V.line([[X(onset), Y(1 - dw)], [X(death), Y(1 - dw)]]), class: "stroke dashed s2" }, g);
      if (X(onset) - X(0) > 120) label(X(onset / 2), Y(0.5) + 5, "QALYs lived");
    }
    // events on the time axis
    el("line", { x1: X(death), x2: X(death), y1: Y(1) - 6, y2: Y(ymin), class: "edge strong", "stroke-dasharray": "3 3" }, g);
    el("text", { x: X(death) + 4, y: Y(1) - 10, "text-anchor": "start", class: "viz-small viz-bold", text: "death at " + death }, g);
    if (ill > 0) el("text", { x: X(onset) - 4, y: Y(1) - 10, "text-anchor": "end", class: "viz-small", text: "illness from " + onset }, g);

    out.yll(V.fmt.num(yll, 1));
    out.yld(V.fmt.num(yld, 1));
    out.daly(V.fmt.num(yll + yld, 1));
    out.qaly(V.fmt.num(qaly, 1));
  }
  draw();
});
