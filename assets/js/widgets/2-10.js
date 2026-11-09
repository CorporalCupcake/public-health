// Lecture 2.10 — Potential outcomes (exchangeability) and causal pies (sufficient-component causes).
// Illustrative numbers.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Potential outcomes: 16 patients, both outcomes known to "God", one seen by the study.
  // 1 = dies. Frail patients die more often, with or without treatment; treatment helps on average.
  V.register("potential-outcomes", function (root) {
    var P = [
      // [id, frail, Y(1), Y(0)]
      ["P1", 1, 1, 1], ["P2", 1, 1, 1], ["P3", 1, 1, 1], ["P4", 1, 0, 1],
      ["P5", 1, 0, 1], ["P6", 1, 0, 1], ["P7", 1, 1, 0], ["P8", 1, 0, 0],
      ["P9", 0, 0, 1], ["P10", 0, 0, 1], ["P11", 0, 1, 1], ["P12", 0, 0, 0],
      ["P13", 0, 0, 0], ["P14", 0, 0, 0], ["P15", 0, 0, 0], ["P16", 0, 0, 0]
    ];
    var N = P.length, seed = 7;
    // "Doctors treat the sickest": all frail but one, plus one robust patient.
    var CONF = [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0];

    var ctr = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem 1.2rem;align-items:center;margin:0.2rem 0 0.9rem" }, root);
    var view = V.toggle(ctr, { options: [{ value: "god", label: "God’s view" }, { value: "study", label: "What the study sees" }], value: "god", onChange: draw });
    var assign = V.toggle(ctr, { options: [{ value: "rand", label: "Coin flip decides" }, { value: "conf", label: "Doctors treat the sickest" }], value: "rand", onChange: draw });
    var reflip = V.button(ctr, "Flip the coins again", function () { seed += 1; draw(); });

    var c = V.svg(root, 640, 412);
    c.setAttribute("aria-label", "Table of 16 patients with frailty, potential outcomes if treated and untreated, individual effect, treatment received and observed outcome");

    var out = V.readouts(root, [
      { key: "ace", label: "True average causal effect: risk if all treated − risk if none", cls: "good" },
      { key: "obs", label: "Observed: risk in treated − risk in untreated" },
      { key: "bias", label: "Error (observed − true)", cls: "bad" },
      { key: "ind", label: "Individual effects: saved · harmed · unaffected" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Coin flips treat exactly 8 of the 16, chosen at random. With so few patients, chance alone moves the estimate; the confounded assignment is wrong in a consistent direction." }, root);

    function randomTreat() {
      var r = V.rng(seed * 2654435761), idx = P.map(function (_, i) { return i; });
      for (var i = N - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      var tr = P.map(function () { return 0; });
      idx.slice(0, 8).forEach(function (i) { tr[i] = 1; });
      return tr;
    }

    var COLS = [
      { x: 40, t: "Patient" }, { x: 112, t: "Frailty" }, { x: 202, t: "If treated" }, { x: 294, t: "If untreated" },
      { x: 386, t: "Effect" }, { x: 478, t: "Treated?" }, { x: 570, t: "Observed" }
    ];

    function draw() {
      var god = view.value() === "god", tr = assign.value() === "conf" ? CONF : randomTreat();
      reflip.disabled = assign.value() !== "rand";
      reflip.style.opacity = reflip.disabled ? 0.4 : 1;

      clear(c);
      var y0 = 46, rh = 22;
      COLS.forEach(function (col) { el("text", { x: col.x, y: 22, "text-anchor": "middle", class: "viz-bold", text: col.t }, c); });
      el("text", { x: 248, y: 38, "text-anchor": "middle", class: "viz-small viz-muted", text: "potential outcomes" }, c);
      el("line", { x1: 10, x2: 630, y1: y0 - 4, y2: y0 - 4, class: "viz-axis" }, c);

      var s1 = 0, s0 = 0, saved = 0, harmed = 0, nT = 0, dT = 0, nU = 0, dU = 0;
      P.forEach(function (p, i) {
        var y = y0 + i * rh, t = tr[i];
        if (t) el("rect", { x: 10, y: y, width: 620, height: rh, class: "fill-soft s1" }, c);
        var yt = y + 15;
        s1 += p[2]; s0 += p[3];
        if (p[2] < p[3]) saved++; else if (p[2] > p[3]) harmed++;
        if (t) { nT++; dT += p[2]; } else { nU++; dU += p[3]; }
        function word(v) { return v ? "dies" : "lives"; }
        var seen1 = god || t, seen0 = god || !t;
        el("text", { x: COLS[0].x, y: yt, "text-anchor": "middle", class: "viz-small", text: p[0] }, c);
        el("text", { x: COLS[1].x, y: yt, "text-anchor": "middle", class: "viz-small" + (p[1] ? " colour s2" : " viz-muted"), text: p[1] ? "frail" : "robust" }, c);
        el("text", { x: COLS[2].x, y: yt, "text-anchor": "middle", class: "viz-small" + (seen1 ? (p[2] ? " colour s3" : "") : " viz-muted"), text: seen1 ? word(p[2]) : "?" }, c);
        el("text", { x: COLS[3].x, y: yt, "text-anchor": "middle", class: "viz-small" + (seen0 ? (p[3] ? " colour s3" : "") : " viz-muted"), text: seen0 ? word(p[3]) : "?" }, c);
        var eff = p[2] < p[3] ? "saved" : p[2] > p[3] ? "harmed" : "none";
        el("text", { x: COLS[4].x, y: yt, "text-anchor": "middle", class: "viz-small" + (god ? (eff === "saved" ? " colour s1 viz-bold" : eff === "harmed" ? " colour s3 viz-bold" : " viz-muted") : " viz-muted"), text: god ? eff : "?" }, c);
        el("text", { x: COLS[5].x, y: yt, "text-anchor": "middle", class: "viz-small" + (t ? " viz-bold" : " viz-muted"), text: t ? "yes" : "no" }, c);
        var o = t ? p[2] : p[3];
        el("text", { x: COLS[6].x, y: yt, "text-anchor": "middle", class: "viz-small" + (o ? " colour s3" : ""), text: word(o) }, c);
      });
      var yb = y0 + N * rh + 4;
      el("line", { x1: 10, x2: 630, y1: yb, y2: yb, class: "viz-axis" }, c);
      var r1 = s1 / N, r0 = s0 / N, rT = nT ? dT / nT : 0, rU = nU ? dU / nU : 0;
      el("text", { x: COLS[2].x, y: yb + 18, "text-anchor": "middle", class: "viz-small viz-bold", text: god ? V.fmt.pct(r1) + " die" : "?" }, c);
      el("text", { x: COLS[3].x, y: yb + 18, "text-anchor": "middle", class: "viz-small viz-bold", text: god ? V.fmt.pct(r0) + " die" : "?" }, c);
      el("text", { x: 600, y: yb + 18, "text-anchor": "end", class: "viz-small", text: "treated: " + dT + "/" + nT + " die · untreated: " + dU + "/" + nU + " die" }, c);
      el("text", { x: 14, y: yb + 18, class: "viz-small viz-muted", text: "Whole group" }, c);

      out.ace(V.fmt.signed((r1 - r0) * 100, 1) + " pts");
      out.obs(V.fmt.signed((rT - rU) * 100, 1) + " pts");
      out.bias(V.fmt.signed((rT - rU - (r1 - r0)) * 100, 1) + " pts");
      out.ind(saved + " · " + harmed + " · " + (N - saved - harmed));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Causal pies: three sufficient causes; remove components and see which pies are blocked.
  V.register("causal-pies", function (root) {
    var PIES = [
      { name: "Sufficient cause I", cases: 50, parts: ["A", "B", "U₁"] },
      { name: "Sufficient cause II", cases: 30, parts: ["A", "C", "U₂"] },
      { name: "Sufficient cause III", cases: 20, parts: ["B", "E", "U₃"] }
    ];
    var CLS = { A: "s1", B: "s2", C: "s4", E: "s3" };
    var removable = ["A", "B", "C", "E"], removed = {};

    var bar = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Remove:" }, bar);
    var btns = {};
    removable.forEach(function (k) {
      btns[k] = V.button(bar, "Component " + k, function () { removed[k] = !removed[k]; draw(); });
    });
    V.button(bar, "Reset", function () { removed = {}; draw(); });

    var c = V.svg(root, 640, 262);
    c.setAttribute("aria-label", "Three pies, each a sufficient cause made of three components; removed components block their pies");
    var out = V.readouts(root, [
      { key: "prev", label: "Cases prevented by your removals (of 100)", cls: "good" },
      { key: "left", label: "Cases still occurring" },
      { key: "sum", label: "Sum of single-component preventable fractions (A + B + C + E)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. U₁–U₃ stand for unknown components we cannot remove. Each case arises from exactly one pie here; real cases can have several." }, root);

    function sector(cx, cy, r, a0, a1) {
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      return "M" + cx + "," + cy + "L" + x0.toFixed(2) + "," + y0.toFixed(2) + "A" + r + "," + r + " 0 0 1 " + x1.toFixed(2) + "," + y1.toFixed(2) + "Z";
    }
    function alone(k) { return PIES.reduce(function (s, p) { return s + (p.parts.indexOf(k) >= 0 ? p.cases : 0); }, 0); }

    function draw() {
      removable.forEach(function (k) {
        var on = !!removed[k];
        btns[k].setAttribute("aria-pressed", on);
        btns[k].textContent = (on ? "✕ " : "") + "Component " + k;
        btns[k].style.background = on ? "var(--accent)" : "";
        btns[k].style.color = on ? "var(--bg)" : "";
      });
      clear(c);
      var prevented = 0;
      PIES.forEach(function (p, i) {
        var cx = 110 + i * 210, cy = 104, R = 66;
        var blocked = p.parts.some(function (k) { return removed[k]; });
        if (blocked) prevented += p.cases;
        el("text", { x: cx, y: 18, "text-anchor": "middle", class: "viz-bold", text: p.name }, c);
        p.parts.forEach(function (k, j) {
          var a0 = -Math.PI / 2 + j * 2 * Math.PI / 3, a1 = a0 + 2 * Math.PI / 3, am = (a0 + a1) / 2;
          var cls = CLS[k] || "s5", gone = removed[k];
          var g = el("g", { class: cls }, c);
          el("path", { d: sector(cx, cy, R, a0, a1), class: (gone || blocked) ? "fill-soft" : "fill" }, g);
          el("path", { d: sector(cx, cy, R, a0, a1), class: "node", style: "fill:none" + (gone ? ";stroke-dasharray:5 4" : "") }, g);
          el("text", { x: cx + 0.55 * R * Math.cos(am), y: cy + 0.55 * R * Math.sin(am) + 5, "text-anchor": "middle", class: "viz-bold" + (gone ? " viz-muted" : ""), text: gone ? "✕" : k }, c);
        });
        el("text", { x: cx, y: cy + R + 24, "text-anchor": "middle", class: "viz-small" + (blocked ? " colour s3 viz-bold" : ""), text: blocked ? "blocked: " + p.cases + " cases prevented" : p.cases + " cases" }, c);
      });
      var parts = removable.map(function (k) { return k + " " + alone(k) + "%"; }).join(" · ");
      el("text", { x: 320, y: 244, "text-anchor": "middle", class: "viz-small viz-muted", text: "Preventable by removing each alone: " + parts }, c);

      out.prev(prevented + " (" + prevented + "%)");
      out.left(String(100 - prevented));
      out.sum(removable.reduce(function (s, k) { return s + alone(k); }, 0) + "%");
    }
    draw();
  });
})();
