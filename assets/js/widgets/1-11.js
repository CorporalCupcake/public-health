// Lecture 1.11 — Markov cohort simulator (illustrative numbers).
// Three states: Well → Post-stroke → Dead, constant annual probabilities, 40 yearly cycles.
Viz.register("markov-cohort", function (root) {
  var V = Viz, el = V.el, CYCLES = 40;

  var ctr = V.controls(root);
  var s = {
    ps: V.slider(ctr, { label: "Stroke risk per year (well → post-stroke)", min: 0.5, max: 10, step: 0.5, value: 3, fmt: function (v) { return v + "%"; }, onInput: draw }),
    pdw: V.slider(ctr, { label: "Death risk per year while well", min: 0.5, max: 10, step: 0.5, value: 2, fmt: function (v) { return v + "%"; }, onInput: draw }),
    pds: V.slider(ctr, { label: "Death risk per year after a stroke", min: 2, max: 30, step: 1, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw }),
    cut: V.slider(ctr, { label: "Policy cuts stroke risk by", min: 0, max: 50, step: 5, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw }),
    t: V.slider(ctr, { label: "Look at year", min: 0, max: CYCLES, step: 1, value: 10, fmt: function (v) { return "year " + v; }, onInput: draw })
  };
  var view = V.toggle(root, { options: [{ value: "base", label: "No policy" }, { value: "policy", label: "With policy" }], value: "base", onChange: draw });

  // --- State diagram (shows the cohort share in each state at the chosen year)
  var d = V.svg(root, 640, 250);
  var defs = el("defs", null, d);
  var mk = el("marker", { id: "mc-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead" }, mk);
  var N = { W: [130, 110], S: [510, 110], D: [320, 210] };
  function edge(a, b, bend) {
    var x1 = N[a][0], y1 = N[a][1], x2 = N[b][0], y2 = N[b][1];
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    var sx = x1 + ux * 62, sy = y1 + uy * 30, ex = x2 - ux * 62, ey = y2 - uy * 28;
    if (b === "D") { ex = x2 - ux * 58; ey = y2 - uy * 22; }
    el("path", { d: "M" + sx + "," + sy + "L" + ex + "," + ey, class: "edge", "marker-end": "url(#mc-arrow)" }, d);
    return [(sx + ex) / 2, (sy + ey) / 2];
  }
  function loop(n) {
    var x = N[n][0], y = N[n][1] - 30;
    el("path", { d: "M" + (x - 22) + "," + y + " C" + (x - 40) + "," + (y - 52) + " " + (x + 40) + "," + (y - 52) + " " + (x + 22) + "," + y, class: "edge", "marker-end": "url(#mc-arrow)" }, d);
    return el("text", { x: x, y: y - 46, "text-anchor": "middle", class: "viz-tick" }, d);
  }
  var lw = loop("W"), ls = loop("S");
  var mWS = edge("W", "S"), mWD = edge("W", "D"), mSD = edge("S", "D");
  var tWS = el("text", { x: mWS[0], y: mWS[1] - 9, "text-anchor": "middle", class: "viz-small colour s2" }, d);
  var tWD = el("text", { x: mWD[0] - 14, y: mWD[1] + 4, "text-anchor": "end", class: "viz-small viz-muted" }, d);
  var tSD = el("text", { x: mSD[0] + 14, y: mSD[1] + 4, "text-anchor": "start", class: "viz-small viz-muted" }, d);
  function node(key, label, cls) {
    var g = el("g", { class: cls }, d);
    el("rect", { x: N[key][0] - 62, y: N[key][1] - 28, width: 124, height: 56, rx: 12, class: "node-fill" }, g);
    el("text", { x: N[key][0], y: N[key][1] - 6, "text-anchor": "middle", class: "viz-bold", text: label }, g);
    return el("text", { x: N[key][0], y: N[key][1] + 15, "text-anchor": "middle", class: "viz-small" }, g);
  }
  var nW = node("W", "Well", "s1"), nS = node("S", "Post-stroke", "s2"), nD = node("D", "Dead", "s5");

  // --- Stacked area chart of the cohort over time
  V.legend(root, [{ cls: "s1", label: "Well" }, { cls: "s2", label: "Post-stroke" }, { cls: "s5", label: "Dead" }]);
  var c = V.svg(root, 640, 280);
  var f = V.frame(c, { x: [0, CYCLES], y: [0, 1], fmtY: V.fmt.pct, xLabel: "Years since start (cycles)", yLabel: "Share of cohort" });
  var aW = el("path", { class: "fill s1" }, f.inner), aS = el("path", { class: "fill s2" }, f.inner), aD = el("path", { class: "fill-soft s5" }, f.inner);
  var marker = el("line", { y1: f.y(0), y2: f.y(1), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);

  var out = V.readouts(root, [
    { key: "ly", label: "Life-years per person, no policy (40-year horizon)" },
    { key: "strokes", label: "Strokes averted per 1,000 people", cls: "good" },
    { key: "gain", label: "Life-years gained per 1,000 people", cls: "good" },
    { key: "post", label: "Years lived after stroke per 1,000, no policy" }
  ]);
  V.el("p", { class: "widget-note", text: "Illustrative numbers. Probabilities are held constant for simplicity; real models make them depend on age." }, root);

  function run(ps, pdw, pds) {
    var W = 1, S = 0, D = 0, rows = [[W, S, D]], strokes = 0, ly = 0, post = 0;
    for (var t = 0; t < CYCLES; t++) {
      var toS = W * ps, toDw = W * pdw, toDs = S * pds;
      var W2 = W - toS - toDw, S2 = S + toS - toDs, D2 = D + toDw + toDs;
      strokes += toS;
      ly += ((W + S) + (W2 + S2)) / 2;          // half-cycle correction
      post += (S + S2) / 2;
      W = W2; S = S2; D = D2; rows.push([W, S, D]);
    }
    return { rows: rows, strokes: strokes, ly: ly, post: post };
  }

  function draw() {
    var ps = s.ps.value() / 100, pdw = s.pdw.value() / 100, pds = s.pds.value() / 100, cut = s.cut.value() / 100, t = s.t.value();
    var base = run(ps, pdw, pds), pol = run(ps * (1 - cut), pdw, pds);
    var shown = view.value() === "policy" ? pol : base, psShown = view.value() === "policy" ? ps * (1 - cut) : ps;

    var top = [], mid = [], bot = [], one = [];
    shown.rows.forEach(function (r, i) {
      var x = f.x(i);
      bot.push([x, f.y(0)]); top.push([x, f.y(r[0])]); mid.push([x, f.y(r[0] + r[1])]); one.push([x, f.y(1)]);
    });
    aW.setAttribute("d", V.area(top, bot));
    aS.setAttribute("d", V.area(mid, top));
    aD.setAttribute("d", V.area(one, mid));
    marker.setAttribute("x1", f.x(t)); marker.setAttribute("x2", f.x(t));

    var r = shown.rows[t];
    nW.textContent = V.fmt.pct1(r[0]); nS.textContent = V.fmt.pct1(r[1]); nD.textContent = V.fmt.pct1(r[2]);
    tWS.textContent = "stroke " + V.fmt.pct1(psShown);
    tWD.textContent = "die " + V.fmt.pct1(pdw);
    tSD.textContent = "die " + V.fmt.pct1(pds);
    lw.textContent = "stay " + V.fmt.pct1(1 - psShown - pdw);
    ls.textContent = "stay " + V.fmt.pct1(1 - pds);

    out.ly(V.fmt.num(base.ly, 1));
    out.strokes(V.fmt.int((base.strokes - pol.strokes) * 1000));
    out.gain(V.fmt.int((pol.ly - base.ly) * 1000));
    out.post(V.fmt.int(base.post * 1000));
  }
  draw();
});
