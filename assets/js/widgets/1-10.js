// Lecture 1.10 — Economic evaluation (illustrative numbers).
// 1) "ce-plane": one new option against its comparator on the cost-effectiveness plane,
//    with a threshold line, the cost-effective region, quadrant, ICER, NMB and a verdict.
// 2) "discounting": what future health gains are worth today at a chosen discount rate.

// Keep the part of a polygon where keep(p) >= 0 (one Sutherland–Hodgman pass).
function l110Clip(poly, keep) {
  var out = [];
  for (var i = 0; i < poly.length; i++) {
    var a = poly[i], b = poly[(i + 1) % poly.length], ka = keep(a), kb = keep(b);
    if (ka >= 0) out.push(a);
    if ((ka >= 0) !== (kb >= 0)) {
      var t = ka / (ka - kb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

Viz.register("ce-plane", function (root) {
  var V = Viz, el = V.el;
  var HMAX = 200, CMAX = 4; // DALYs averted, SAR million

  var sar = function (v) { return "SAR " + V.fmt.int(v); };
  var ctr = V.controls(root);
  var s = {
    h: V.slider(ctr, { label: "Extra health (DALYs averted)", min: -HMAX, max: HMAX, step: 10, value: 100, fmt: function (v) { return V.fmt.signed(v, 0); }, onInput: draw }),
    c: V.slider(ctr, { label: "Extra cost (SAR million)", min: -CMAX, max: CMAX, step: 0.1, value: 2, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw }),
    lam: V.slider(ctr, { label: "Threshold (SAR per DALY)", min: 1000, max: 60000, step: 1000, value: 30000, fmt: V.fmt.int, onInput: draw })
  };

  V.legend(root, [
    { cls: "s1", label: "Cost-effective region (NMB > 0)" },
    { cls: "s2", label: "Threshold line", dashed: true },
    { cls: "s4", label: "New option (line from origin: its ICER)" }
  ]);
  var p = V.svg(root, 640, 400);
  p.setAttribute("aria-label", "Cost-effectiveness plane with the new option, the threshold line and the cost-effective region");
  var f = V.frame(p, {
    x: [-HMAX, HMAX], y: [-CMAX, CMAX], xTicks: [-200, -100, 0, 100, 200], yTicks: [-4, -2, 0, 2, 4],
    fmtX: function (v) { return V.fmt.signed(v, 0); }, fmtY: function (v) { return V.fmt.signed(v, 0); },
    xLabel: "Extra health: DALYs averted vs comparator", yLabel: "Extra cost (SAR million)", margin: { left: 58 }
  });
  var g = f.inner;
  var region = el("path", { class: "fill-soft s1" }, g);
  el("line", { x1: f.x(-HMAX), x2: f.x(HMAX), y1: f.y(0), y2: f.y(0), class: "edge strong" }, g);
  el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(-CMAX), y2: f.y(CMAX), class: "edge strong" }, g);
  var thr = el("path", { class: "stroke dashed s2" }, g);
  var ray = el("path", { class: "stroke s4", "stroke-width": 1.6 }, g);
  var dot = el("circle", { r: 8, class: "dot s4" }, g);

  // Quadrant names. NW and SE corners never meet the threshold line; NE and SW labels move away from it.
  var L = f.x(-HMAX) + 8, R = f.x(HMAX) - 8, T = f.y(CMAX) + 18, B = f.y(-CMAX) - 10;
  function qlabel(x, y, anchor, a, b) {
    var t = el("text", { x: x, y: y, "text-anchor": anchor, class: "viz-small viz-muted" }, g);
    el("tspan", { x: x, class: "viz-bold", text: a }, t);
    el("tspan", { x: x, dy: 15, text: b }, t);
    return t;
  }
  qlabel(L, T, "start", "North-west", "dominated");
  qlabel(R, B - 15, "end", "South-east", "dominant");
  var qNE = qlabel(R, T, "end", "North-east", "trade-off");
  var qSW = qlabel(L, B - 15, "start", "South-west", "trade-off");

  var out = V.readouts(root, [
    { key: "quad", label: "Quadrant" },
    { key: "icer", label: "ICER (SAR per DALY averted)" },
    { key: "nmb", label: "Incremental net monetary benefit (SAR million)" }
  ]);
  var verdict = el("p", { class: "widget-note" }, root);
  el("p", { class: "widget-note", text: "Illustrative numbers. NMB = threshold × DALYs averted − extra cost." }, root);

  function draw() {
    var h = s.h.value(), c = s.c.value(), lam = s.lam.value(), k = lam / 1e6; // SAR million per DALY

    // Threshold line through the origin, clipped to the box.
    var xe = Math.min(HMAX, CMAX / k);
    thr.setAttribute("d", V.line([[f.x(-xe), f.y(-xe * k)], [f.x(xe), f.y(xe * k)]]));
    var box = [[-HMAX, -CMAX], [HMAX, -CMAX], [HMAX, CMAX], [-HMAX, CMAX]];
    var poly = l110Clip(box, function (q) { return k * q[0] - q[1]; });
    region.setAttribute("d", V.line(poly.map(function (q) { return [f.x(q[0]), f.y(q[1])]; })) + "Z");

    // Move the NE / SW labels to whichever end of the quadrant the line leaves free.
    var steep = lam > 12000;
    qNE.setAttribute("transform", steep ? "translate(0," + (f.y(0) - 26 - T) + ")" : "");
    qSW.setAttribute("transform", steep ? "translate(0," + (f.y(0) + 22 - (B - 15)) + ")" : "");

    dot.setAttribute("cx", f.x(h)); dot.setAttribute("cy", f.y(c));
    ray.setAttribute("d", V.line([[f.x(0), f.y(0)], [f.x(h), f.y(c)]]));

    var nmb = k * h - c, quad, text;
    if (h > 0 && c <= 0) {
      quad = "South-east";
      text = c < 0 ? "Dominant: more health for less money. Adopt it under any threshold." : "More health at no extra cost. Adopt it.";
    } else if (h < 0 && c >= 0) {
      quad = "North-west";
      text = c > 0 ? "Dominated: less health for more money. Reject it." : "Less health at no saving. Reject it.";
    } else if (h > 0 && c > 0) {
      quad = "North-east";
      text = nmb > 0 ? "Trade-off. Each DALY costs " + sar(c * 1e6 / h) + ", below the threshold: cost-effective."
        : nmb < 0 ? "Trade-off. Each DALY costs " + sar(c * 1e6 / h) + ", above the threshold: not cost-effective."
          : "Trade-off. The ICER equals the threshold: either choice is equally good.";
    } else if (h < 0 && c < 0) {
      quad = "South-west";
      text = nmb > 0 ? "Trade-off. It saves " + sar(c * 1e6 / h) + " per DALY lost, more than the threshold: the savings are worth it."
        : nmb < 0 ? "Trade-off. It saves only " + sar(c * 1e6 / h) + " per DALY lost, less than the threshold: not worth the health lost."
          : "Trade-off. The savings per DALY lost equal the threshold: either choice is equally good.";
    } else {
      quad = "On an axis";
      text = c < 0 ? "Same health for less money. Choose it (cost-minimisation)."
        : c > 0 ? "Same health for more money. Reject it." : "No difference in cost or health.";
    }
    out.quad(quad);
    out.icer(h === 0 ? "undefined" : V.fmt.signed(c * 1e6 / h, 0));
    out.nmb(V.fmt.signed(nmb, 2));
    verdict.innerHTML = "";
    el("strong", { text: "Verdict: " }, verdict);
    verdict.appendChild(document.createTextNode(text));
  }
  draw();
});

Viz.register("discounting", function (root) {
  var V = Viz, el = V.el, YEARS = 50;
  var TREAT = [0, 9], PREV = [30, 39]; // years in which 1 QALY a year is gained

  var ctr = V.controls(root);
  var rate = V.slider(ctr, { label: "Discount rate per year", min: 0, max: 6, step: 0.5, value: 3, fmt: function (v) { return v + "%"; }, onInput: draw });

  V.legend(root, [
    { cls: "s5", label: "Face value (1 QALY a year)" },
    { cls: "s4", label: "Treatment: gains in years 0–9" },
    { cls: "s1", label: "Prevention: gains in years 30–39" },
    { cls: "s2", label: "Value today of 1 QALY in that year", dashed: true }
  ]);
  var c = V.svg(root, 640, 280);
  c.setAttribute("aria-label", "Bar chart of yearly health gains at face value and after discounting, for a treatment and a prevention programme");
  var f = V.frame(c, { x: [-0.5, YEARS + 0.5], y: [0, 1], xTicks: [0, 10, 20, 30, 40, 50], fmtY: function (v) { return V.fmt.num(v, 2); }, yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "Years from now", yLabel: "Value today (QALYs)" });
  var bw = (f.x(1) - f.x(0)) * 0.72;
  var bars = [];
  for (var t = 0; t <= YEARS; t++) {
    var inT = t >= TREAT[0] && t <= TREAT[1], inP = t >= PREV[0] && t <= PREV[1];
    if (!inT && !inP) continue;
    el("rect", { x: f.x(t) - bw / 2, y: f.y(1), width: bw, height: f.y(0) - f.y(1), class: "fill-soft s5" }, f.inner);
    bars.push({ t: t, r: el("rect", { x: f.x(t) - bw / 2, width: bw, class: "fill " + (inT ? "s4" : "s1") }, f.inner) });
  }
  var curve = el("path", { class: "stroke dashed s2" }, f.inner);
  var m25 = el("circle", { r: 5, class: "dot s2" }, f.inner), m50 = el("circle", { r: 5, class: "dot s2" }, f.inner);
  var t25 = el("text", { "text-anchor": "middle", class: "viz-small colour s2" }, f.inner);
  var t50 = el("text", { "text-anchor": "end", class: "viz-small colour s2" }, f.inner);

  var out = V.readouts(root, [
    { key: "y25", label: "1 QALY in year 25 is worth today" },
    { key: "y50", label: "1 QALY in year 50 is worth today" },
    { key: "treat", label: "Treatment: 10 QALYs (years 0–9) are worth today" },
    { key: "prev", label: "Prevention: 10 QALYs (years 30–39) are worth today" }
  ]);
  el("p", { class: "widget-note", text: "Illustrative streams. Each year’s gain is divided by (1 + rate) raised to the number of years from now. Costs are discounted the same way." }, root);

  function draw() {
    var r = rate.value() / 100, df = function (t) { return Math.pow(1 + r, -t); };
    bars.forEach(function (b) { var v = df(b.t); b.r.setAttribute("y", f.y(v)); b.r.setAttribute("height", f.y(0) - f.y(v)); });
    var pts = [];
    for (var t = 0; t <= YEARS; t += 0.5) pts.push([f.x(t), f.y(df(t))]);
    curve.setAttribute("d", V.line(pts));
    m25.setAttribute("cx", f.x(25)); m25.setAttribute("cy", f.y(df(25)));
    m50.setAttribute("cx", f.x(50)); m50.setAttribute("cy", f.y(df(50)));
    t25.setAttribute("x", f.x(25)); t25.setAttribute("y", f.y(df(25)) - 12); t25.textContent = V.fmt.num(df(25), 2);
    t50.setAttribute("x", f.x(50) - 4); t50.setAttribute("y", f.y(df(50)) - 12); t50.textContent = V.fmt.num(df(50), 2);
    var sum = function (a) { var s = 0; for (var t = a[0]; t <= a[1]; t++) s += df(t); return s; };
    out.y25(V.fmt.num(df(25), 2) + " QALY");
    out.y50(V.fmt.num(df(50), 2) + " QALY");
    out.treat(V.fmt.num(sum(TREAT), 1) + " QALYs");
    out.prev(V.fmt.num(sum(PREV), 1) + " QALYs");
  }
  draw();
});
