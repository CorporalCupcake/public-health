// Lecture 1.5 — An interactive period life table (illustrative numbers).
// 100,000 newborns meet a made-up schedule of death rates:
//   under 5: set directly as deaths per 1,000 births (70% in the first year);
//   5 and over: a Gompertz–Makeham hazard, A + B·e^(c·age), scaled separately for ages 5–59 and 60+.
// l_x = survivors at each age; e0 = area under l_x ÷ 100,000.
Viz.register("life-table", function (root) {
  var V = Viz, el = V.el, MAXAGE = 110, RADIX = 100000;
  var BASE = { u5: 20, mid: 1, old: 1 };

  function table(u5, mid, old) {
    var A = 0.0006, B = 0.000025, c = 0.1, u = u5 / 1000, l = [RADIX];
    l.push(RADIX * (1 - 0.7 * u));                                  // age 1
    var r = Math.pow((1 - u) / (1 - 0.7 * u), 0.25);
    for (var x = 2; x <= 5; x++) l.push(l[x - 1] * r);               // ages 2–5
    for (x = 5; x < MAXAGE; x++) {
      var mu = (A + B * Math.exp(c * (x + 0.5))) * (x < 60 ? mid : old);
      l.push(l[x] * Math.exp(-mu));
    }
    l[MAXAGE] = 0;
    var L = [], d = [];
    for (x = 0; x < MAXAGE; x++) {
      d.push(l[x] - l[x + 1]);
      L.push(x === 0 ? l[1] + 0.1 * d[0] : (l[x] + l[x + 1]) / 2);   // infant deaths come early in the year
    }
    var T = []; T[MAXAGE] = 0;
    for (x = MAXAGE - 1; x >= 0; x--) T[x] = T[x + 1] + L[x];
    function e(a) { return l[a] > 0 ? T[a] / l[a] : 0; }
    var mode = 10;
    for (x = 10; x < MAXAGE; x++) if (d[x] > d[mode]) mode = x;
    return { l: l, d: d, e: e, mode: mode };
  }

  var presets = el("div", { class: "widget-controls", style: "grid-template-columns:repeat(auto-fit,minmax(200px,max-content));margin-bottom:0.4rem" }, root);
  V.button(presets, "Low child mortality (today)", function () { load(20, 1, 1); });
  V.button(presets, "High child mortality (historic)", function () { load(300, 3, 1.3); });

  var ctr = V.controls(root);
  var s = {
    u5: V.slider(ctr, { label: "Under-5 deaths per 1,000 births", min: 2, max: 400, step: 1, value: BASE.u5, onInput: draw }),
    mid: V.slider(ctr, { label: "Death rates at ages 5–59", min: 0.5, max: 4, step: 0.1, value: BASE.mid, fmt: function (v) { return "× " + v.toFixed(1); }, onInput: draw }),
    old: V.slider(ctr, { label: "Death rates at ages 60+", min: 0.5, max: 2, step: 0.05, value: BASE.old, fmt: function (v) { return "× " + v.toFixed(2); }, onInput: draw })
  };
  function load(u5, mid, old) { s.u5.set(u5); s.mid.set(mid); s.old.set(old); draw(); }
  var view = V.toggle(root, { options: [{ value: "l", label: "Survivors (lₓ)" }, { value: "d", label: "Deaths at each age (dₓ)" }], value: "l", onChange: draw });

  var leg = el("div", null, root);
  var c = V.svg(root, 640, 300);
  c.setAttribute("aria-label", "Life table chart: survivors or deaths by age for 100,000 newborns");

  var out = V.readouts(root, [
    { key: "e0", label: "Life expectancy at birth, e₀ (years)", cls: "good" },
    { key: "e65", label: "Average age at death of those who reach 65 (65 + e₆₅)" },
    { key: "l70", label: "Newborns who reach 70" },
    { key: "mode", label: "Most common adult age at death" },
    { key: "infant", label: "Years gained by saving one baby (≈ e₁ + 1)" },
    { key: "old80", label: "Years gained by saving one 80-year-old (≈ e₈₀)" }
  ]);
  root.querySelector(".widget-readouts").style.gridTemplateColumns = "repeat(auto-fit, minmax(190px, 1fr))";
  el("p", { class: "widget-note", text: "Illustrative numbers. The death rates are a smooth made-up schedule, not any country’s table. The dashed curve is the starting schedule." }, root);

  var base = table(BASE.u5, BASE.mid, BASE.old);

  function draw() {
    var t = table(s.u5.value(), s.mid.value(), s.old.value()), e0 = t.e(0), isL = view.value() === "l";
    while (c.firstChild) c.removeChild(c.firstChild);
    while (leg.firstChild) leg.removeChild(leg.firstChild);

    if (isL) {
      V.legend(leg, [{ cls: "s1", label: "Survivors now" }, { cls: "s5", label: "Starting schedule", dashed: true }, { cls: "s1", label: "Shaded area = e₀ × 100,000 person-years" }]);
      var f = V.frame(c, { x: [0, 110], y: [0, RADIX], xTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], fmtY: function (v) { return V.fmt.int(v); }, xLabel: "Age", yLabel: "Still alive (of 100,000)", margin: { left: 66 } });
      var pts = t.l.map(function (v, x) { return [f.x(x), f.y(v)]; });
      var bot = t.l.map(function (v, x) { return [f.x(x), f.y(0)]; });
      el("path", { d: V.area(pts, bot), class: "fill-soft s1" }, f.inner);
      el("path", { d: V.line(base.l.map(function (v, x) { return [f.x(x), f.y(v)]; })), class: "stroke dashed s5" }, f.inner);
      el("path", { d: V.line(pts), class: "stroke s1" }, f.inner);
      // label inside the shaded area
      el("text", { x: f.x(30), y: f.y(RADIX * 0.42), "text-anchor": "middle", class: "viz-bold", text: "Area = e₀ = " + V.fmt.num(e0, 1) + " years" }, f.inner);
      el("text", { x: f.x(30), y: f.y(RADIX * 0.42) + 18, "text-anchor": "middle", class: "viz-small", text: "(person-years lived ÷ 100,000)" }, f.inner);
    } else {
      V.legend(leg, [{ cls: "s3", label: "Deaths at each age (of 100,000 born)" }, { cls: "s2", label: "e₀, the average age at death" }]);
      var dmax = Math.max.apply(null, t.d), ymax = dmax <= 5000 ? Math.ceil(dmax * 1.15 / 500) * 500 : Math.ceil(dmax * 1.15 / 5000) * 5000;
      var g = V.frame(c, { x: [0, 110], y: [0, ymax], xTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110], fmtY: function (v) { return V.fmt.int(v); }, xLabel: "Age at death", yLabel: "Deaths at this age", margin: { left: 66 } });
      var bw = g.x(1) - g.x(0);
      t.d.forEach(function (v, x) {
        var y = g.y(v);
        el("rect", { x: g.x(x) + 0.5, y: y, width: Math.max(bw - 1, 1), height: g.y(0) - y, class: "fill s3" }, g.inner);
      });
      el("line", { x1: g.x(e0), x2: g.x(e0), y1: g.y(0), y2: g.y(ymax), class: "stroke dashed s2" }, g.inner);
      el("text", { x: g.x(e0) - 8, y: g.y(ymax) + 16, "text-anchor": "end", class: "viz-small viz-bold colour s2", text: "e₀ = " + V.fmt.num(e0, 1) }, g.inner);
      el("text", { x: g.x(t.mode) + 8, y: g.y(t.d[t.mode]) + 4, "text-anchor": "start", class: "viz-small", text: "← adult peak: " + t.mode }, g.inner);
      if (t.d[0] > ymax * 0.15) el("text", { x: g.x(1) + 6, y: g.y(t.d[0]) + 12, "text-anchor": "start", class: "viz-small", text: "← deaths in the first year" }, g.inner);
    }

    out.e0(V.fmt.num(e0, 1) + " (" + V.fmt.signed(e0 - base.e(0), 1) + ")");
    out.e65(V.fmt.num(65 + t.e(65), 1));
    out.l70(V.fmt.pct(t.l[70] / RADIX));
    out.mode(String(t.mode));
    out.infant(V.fmt.num(t.e(1) + 1, 0));
    out.old80(V.fmt.num(t.e(80), 0));
  }
  draw();
});
