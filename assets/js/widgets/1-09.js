// Lecture 1.9 — salt-reduction rule-of-thumb calculator and a salt/sodium unit converter.
(function () {
  var V = Viz, el = V.el;

  // ---------------------------------------------------------------------------
  // Grams of salt cut → mmHg → % fewer major cardiovascular events.
  // mmHg per g: average ≈ 1 (Cochrane dose-response); with hypertension 5 mmHg per 4.4 g;
  // without 2.4 mmHg per 4.4 g. Events: 10% fewer per 5 mmHg, log-linear (BPLTTC).
  V.register("salt-calculator", function (root) {
    var GROUPS = {
      avg: { k: 1, cls: "s1", label: "Average adult", rule: "≈1 mmHg per g" },
      htn: { k: 5 / 4.4, cls: "s3", label: "With hypertension", rule: "5 mmHg per 4.4 g" },
      nohtn: { k: 2.4 / 4.4, cls: "s4", label: "Without hypertension", rule: "2.4 mmHg per 4.4 g" }
    };
    function events(mmhg) { return 1 - Math.pow(0.9, mmhg / 5); }

    var ctr = V.controls(root);
    var sc = V.slider(ctr, { label: "Cut in salt intake", min: 0, max: 10, step: 0.5, value: 5, fmt: function (v) { return v.toFixed(1) + " g/day"; }, onInput: draw });
    var grp = V.toggle(ctr, { options: [{ value: "avg", label: "Average" }, { value: "htn", label: "Hypertension" }, { value: "nohtn", label: "No hypertension" }], value: "avg", onChange: draw });

    // The chain: three boxes with live values
    var d = V.svg(root, 640, 118);
    d.setAttribute("aria-label", "Chain from salt cut to blood pressure fall to fewer cardiovascular events");
    var defs = el("defs", null, d);
    var mk = el("marker", { id: "l19-calc-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
    el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead accent" }, mk);
    var boxes = [[10, "s2", "Salt cut"], [235, "s4", "Systolic BP"], [460, "s3", "Major CVD events"]].map(function (b) {
      var g = el("g", { class: b[1] }, d);
      el("rect", { x: b[0], y: 8, width: 170, height: 70, rx: 10, class: "node-fill" }, g);
      el("text", { x: b[0] + 85, y: 30, "text-anchor": "middle", class: "viz-small viz-muted", text: b[2] }, d);
      return el("text", { x: b[0] + 85, y: 62, "text-anchor": "middle", class: "viz-bold", style: "font-size:22px" }, d);
    });
    el("path", { d: "M180,43 L231,43", class: "edge accent", "marker-end": "url(#l19-calc-arrow)" }, d);
    el("path", { d: "M405,43 L456,43", class: "edge accent", "marker-end": "url(#l19-calc-arrow)" }, d);
    var r1 = el("text", { x: 207, y: 104, "text-anchor": "middle", class: "viz-small viz-muted" }, d);
    el("text", { x: 432, y: 104, "text-anchor": "middle", class: "viz-small viz-muted", text: "10% per 5 mmHg" }, d);

    // Curve: % fewer events against the salt cut, for each group
    V.legend(root, Object.keys(GROUPS).map(function (key) { return { cls: GROUPS[key].cls, label: GROUPS[key].label }; }));
    var c = V.svg(root, 640, 260);
    c.setAttribute("aria-label", "Percentage fewer major cardiovascular events against the salt cut, for three groups");
    var f = V.frame(c, { x: [0, 10], y: [0, 0.25], fmtY: V.fmt.pct, xLabel: "Cut in salt intake (g/day)", yLabel: "Fewer major CVD events" });
    var lines = {};
    Object.keys(GROUPS).forEach(function (key) {
      var pts = [];
      for (var x = 0; x <= 10.001; x += 0.25) pts.push([f.x(x), f.y(events(x * GROUPS[key].k))]);
      lines[key] = el("path", { d: V.line(pts), class: "stroke " + GROUPS[key].cls }, f.inner);
    });
    var guide = el("path", { class: "edge", "stroke-dasharray": "4 4" }, f.inner);
    var dot = el("circle", { r: 6 }, f.inner);

    el("p", { class: "widget-note", text: "Rough rules of thumb from this lecture, for intuition only. The fall in events is the steady state and builds over years. Project 1 does this properly by age, sex and disease." }, root);

    function draw() {
      var g = GROUPS[grp.value()], cut = sc.value(), mmhg = cut * g.k, ev = events(mmhg);
      boxes[0].textContent = "−" + V.fmt.num(cut, 1) + " g/day";
      boxes[1].textContent = "−" + V.fmt.num(mmhg, 1) + " mmHg";
      boxes[2].textContent = "−" + V.fmt.pct(ev);
      r1.textContent = g.rule;
      Object.keys(lines).forEach(function (key) {
        lines[key].setAttribute("class", "stroke " + GROUPS[key].cls + (key === grp.value() ? "" : " dashed"));
        lines[key].style.opacity = key === grp.value() ? 1 : 0.45;
      });
      var px = f.x(cut), py = f.y(ev);
      guide.setAttribute("d", "M" + px + "," + f.y(0) + "L" + px + "," + py + "L" + f.x(0) + "," + py);
      dot.setAttribute("cx", px); dot.setAttribute("cy", py);
      dot.setAttribute("class", "dot " + g.cls);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Salt ↔ sodium converter, against the WHO target.
  V.register("salt-units", function (root) {
    var NA = 22.99, NACL = 58.44, PER = NA / NACL;   // g sodium per g salt (≈0.39)
    var UNITS = {
      salt: { label: "g salt", min: 0, max: 20, step: 0.1, toSalt: function (v) { return v; }, from: function (s) { return s; }, fmt: function (v) { return V.fmt.num(v, 1) + " g salt"; } },
      mg: { label: "mg sodium", min: 0, max: 8000, step: 50, toSalt: function (v) { return v / 1000 / PER; }, from: function (s) { return s * PER * 1000; }, fmt: function (v) { return V.fmt.int(v) + " mg sodium"; } },
      mmol: { label: "mmol sodium", min: 0, max: 340, step: 1, toSalt: function (v) { return v * NA / 1000 / PER; }, from: function (s) { return s * PER * 1000 / NA; }, fmt: function (v) { return V.fmt.int(v) + " mmol sodium"; } }
    };
    var unit = "salt";

    var ctr = V.controls(root);
    var sv = V.slider(ctr, { label: "Daily intake", min: 0, max: 20, step: 0.1, value: 10, fmt: function (v) { return UNITS[unit].fmt(v); }, onInput: draw });
    V.toggle(ctr, {
      options: [{ value: "salt", label: "g salt" }, { value: "mg", label: "mg sodium" }, { value: "mmol", label: "mmol sodium" }],
      value: "salt",
      onChange: function (u) {
        var salt = UNITS[unit].toSalt(sv.value()), U = UNITS[u];
        unit = u;
        sv.input.min = U.min; sv.input.max = U.max; sv.input.step = U.step;
        sv.set(Math.round(U.from(salt) / U.step) * U.step);
        draw();
      }
    });

    // Dual scale: salt below, sodium above, WHO target shaded
    var d = V.svg(root, 640, 100);
    d.setAttribute("aria-label", "Scale of salt and sodium intake with the WHO target shaded");
    var L = 30, R = 610, Y = 50, x = V.scale(0, 20, L, R);
    el("rect", { x: x(0), y: Y - 7, width: x(5) - x(0), height: 14, class: "fill-soft s1" }, d);
    el("text", { x: L, y: 14, class: "viz-small colour s1 viz-bold", text: "WHO target: under 5 g salt (2 g sodium)" }, d);
    el("line", { x1: L, x2: R, y1: Y, y2: Y, class: "viz-axis" }, d);
    [0, 5, 10, 15, 20].forEach(function (t) {
      el("line", { x1: x(t), x2: x(t), y1: Y, y2: Y + 6, class: "viz-axis" }, d);
      el("text", { x: x(t), y: Y + 22, "text-anchor": "middle", class: "viz-tick", text: t }, d);
    });
    [0, 2, 4, 6].forEach(function (t) {
      var xs = x(t / PER);
      el("line", { x1: xs, x2: xs, y1: Y - 6, y2: Y, class: "viz-axis" }, d);
      el("text", { x: xs, y: Y - 12, "text-anchor": "middle", class: "viz-tick", text: t }, d);
    });
    el("text", { x: R, y: Y + 40, "text-anchor": "end", class: "viz-label", text: "g salt per day" }, d);
    el("text", { x: R, y: 14, "text-anchor": "end", class: "viz-label", text: "g sodium per day" }, d);
    var mk = el("g", { class: "s2" }, d);
    var ln = el("line", { y1: Y - 9, y2: Y + 9, class: "stroke" }, mk);
    var dot = el("circle", { cy: Y, r: 6, class: "dot" }, mk);

    var out = V.readouts(root, [
      { key: "salt", label: "Salt (g/day)" },
      { key: "mg", label: "Sodium (mg/day)" },
      { key: "mmol", label: "Sodium (mmol/day)" },
      { key: "who", label: "Against WHO’s <5 g salt" }
    ]);
    el("p", { class: "widget-note", text: "1 g sodium ≈ 2.5 g salt; 1 mmol sodium = 23 mg sodium." }, root);
    var whoBox = out.who;

    function draw() {
      var U = UNITS[unit], salt = U.toSalt(sv.value());
      var px = x(Math.min(20, salt));
      dot.setAttribute("cx", px);
      ln.setAttribute("x1", px); ln.setAttribute("x2", px);
      out.salt(V.fmt.num(salt, 1));
      out.mg(V.fmt.int(Math.round(salt * PER * 100) * 10));
      out.mmol(V.fmt.int(salt * PER * 1000 / NA));
      whoBox(salt < 5 ? "Meets it" : V.fmt.num(salt / 5, 1) + "× the target");
    }
    draw();
  });
})();
