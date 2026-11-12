// Lecture 6.11 — Emergency preparedness and the IHR.
// (1) ihr-annex2: walk through the IHR Annex 2 decision instrument with example events.
// (2) prep-scatter: preparedness score vs COVID-type death rate in illustrative countries; confounding by age.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }

  // A segmented control whose value can also be set from code (presets).
  function seg(parent, options, value, onChange) {
    var wrap = el("div", { class: "widget-toggle", role: "group" }, parent), cur = value, btns = [];
    options.forEach(function (o) {
      var b = el("button", { type: "button", text: o.label }, wrap);
      b.addEventListener("click", function () { cur = o.value; paint(); onChange(cur); });
      btns.push([b, o.value]);
    });
    function paint() { btns.forEach(function (p) { p[0].classList.toggle("on", p[1] === cur); p[0].setAttribute("aria-pressed", p[1] === cur); }); }
    paint();
    return { value: function () { return cur; }, set: function (v) { cur = v; paint(); } };
  }
  function row(parent) { return el("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem 0.8rem;align-items:center;margin:0 0 0.55rem;font-family:var(--font-ui);font-size:0.88rem" }, parent); }

  // ---------------------------------------------------------------------------
  var QS = [
    ["serious", "1. Is the public health impact serious?"],
    ["unusual", "2. Is the event unusual or unexpected?"],
    ["spread", "3. Significant risk of international spread?"],
    ["trade", "4. Significant risk of travel or trade restrictions?"]
  ];
  var PRESETS = [
    { label: "H5N1 in a farm worker", g: "always", q: [true, true, false, false],
      text: "One confirmed human case of avian influenza A(H5N1) in a farm worker. Human influenza caused by a new subtype is on the always-notifiable list, so the answers to the four questions do not matter." },
    { label: "Cholera in a port city", g: "assess", q: [true, true, true, false],
      text: "A cholera cluster in a port city with daily sailings abroad. Cholera is on the always-assess list. Serious (deaths among the first cases), unusual for this city, and ships give a real route abroad: three yes." },
    { label: "Seasonal flu peak", g: "other", q: [false, false, false, false],
      text: "The usual winter influenza peak, arriving on time with typical severity. Expected, already circulating everywhere, no new risk to trade: no question is a yes." },
    { label: "MERS hospital cluster", g: "other", q: [true, true, true, false],
      text: "Six linked MERS cases among patients and staff in one hospital. MERS is not named in Annex 2, so the four questions decide. A healthcare cluster is serious and unusual, and a hospital with international patients and staff gives a route abroad." },
    { label: "Meningitis in returning pilgrims", g: "assess", q: [true, true, true, false],
      text: "Meningococcal W disease in pilgrims returning to three countries. Meningococcal disease is one of the examples of special regional concern in the always-assess box. Serious, an unusual serogroup, and already crossing borders." },
    { label: "Chemical spill in a shared river", g: "other", q: [true, true, true, true],
      text: "An industrial chemical contaminates a river that supplies towns across a border. The IHR cover all hazards, not only infections: the same four questions apply." }
  ];

  V.register("ihr-annex2", function (root) {
    var st = { g: "other", q: [false, false, false, false] }, presetText = null;
    var r0 = row(root);
    el("span", { class: "widget-slider-label", text: "Disease or event:" }, r0);
    var gSeg = seg(r0, [{ value: "always", label: "Always notifiable" }, { value: "assess", label: "Always assess" }, { value: "other", label: "Any other event" }], st.g, function (v) { st.g = v; presetText = null; draw(); });
    var qSeg = QS.map(function (q, i) {
      var r = row(root);
      var s = seg(r, [{ value: true, label: "Yes" }, { value: false, label: "No" }], false, function (v) { st.q[i] = v; presetText = null; draw(); });
      el("span", { class: "widget-slider-label", text: q[1] }, r);
      return s;
    });
    var pr = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;margin:0.6rem 0 0.8rem" }, root);
    el("span", { class: "widget-slider-label", style: "font-family:var(--font-ui);font-size:0.88rem", text: "Examples:" }, pr);
    PRESETS.forEach(function (p) {
      V.button(pr, p.label, function () {
        st.g = p.g; st.q = p.q.slice(); presetText = p.text;
        gSeg.set(p.g); qSeg.forEach(function (s, i) { s.set(p.q[i]); });
        draw();
      });
    });
    var desc = el("p", { class: "widget-note", style: "margin:0 0 0.6rem" }, root);
    var c = V.svg(root, 640, 262);
    c.setAttribute("aria-label", "Flowchart of the Annex 2 decision instrument: event assessed, then a check for the four always-notifiable diseases, then the four questions; two or more yes answers lead to notification of WHO within 24 hours of assessment.");
    var out = V.readouts(root, [
      { key: "n", label: "Questions answered yes" },
      { key: "d", label: "Decision under Annex 2" },
      { key: "t", label: "Deadline" }
    ]);
    el("p", { class: "widget-note", text: "Always notifiable: smallpox, poliomyelitis due to wild-type poliovirus, human influenza caused by a new subtype, SARS. Always assess with the four questions: cholera, pneumonic plague, yellow fever, viral haemorrhagic fevers (Ebola, Lassa, Marburg), West Nile fever, and diseases of special national or regional concern (e.g. dengue, Rift Valley fever, meningococcal disease). The example answers are judgement calls for teaching, not WHO rulings." }, root);

    function box(x, y, w, h, lines, on, cls) {
      el("rect", { x: x, y: y, width: w, height: h, rx: 8, class: on ? "node-fill " + (cls || "s1") : "node s5" }, c);
      lines.forEach(function (t, i) {
        el("text", { x: x + w / 2, y: y + h / 2 + (i - (lines.length - 1) / 2) * 16 + 4, "text-anchor": "middle", class: "viz-small" + (on ? " viz-bold" : " viz-muted"), text: t }, c);
      });
    }
    function edge(d, on, lab, lx, ly) {
      el("path", { d: d, class: on ? "edge accent" : "edge", "marker-end": on ? "url(#l611-w-a)" : "url(#l611-w)", opacity: on ? 1 : 0.55 }, c);
      if (lab) el("text", { x: lx, y: ly, "text-anchor": "middle", class: "viz-small" + (on ? " colour s1 viz-bold" : " viz-muted"), style: halo(), text: lab }, c);
    }

    function draw() {
      var n = st.q.filter(Boolean).length;
      var always = st.g === "always", notify = always || n >= 2;
      clear(c);
      var defs = el("defs", null, c);
      var m1 = el("marker", { id: "l611-w", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
      el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead" }, m1);
      var m2 = el("marker", { id: "l611-w-a", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
      el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead accent" }, m2);

      box(10, 20, 190, 56, ["Event detected,", "assessed within 48 h"], true);
      box(225, 20, 190, 56, ["Smallpox, wild polio, new", "flu subtype or SARS?"], true);
      box(440, 20, 190, 56, ["Notify WHO within 24 h", "of assessment"], notify, "s1");
      box(225, 122, 190, 56, ["The four questions:", "how many yes?"], !always);
      box(440, 196, 190, 56, ["Not notifiable now: monitor,", "reassess; may consult WHO"], !notify, "s2");

      edge("M200,48 L222,48", true);
      edge("M415,48 L437,48", always, "yes", 426, 40);
      edge("M320,76 L320,119", !always, "no", 334, 102);
      edge("M415,140 L520,79", !always && n >= 2, "2+ yes", 488, 118);
      edge("M320,178 L320,224 L437,224", !always && n < 2, "0–1 yes", 372, 216);

      el("text", { x: 14, y: 116, class: "viz-small viz-bold", text: "The four questions" }, c);
      var short = ["Serious impact", "Unusual or unexpected", "International spread", "Travel or trade limits"];
      short.forEach(function (t, i) {
        var yes = st.q[i];
        el("text", { x: 14, y: 140 + i * 22, class: "viz-small" + (always ? " viz-muted" : yes ? " colour s1 viz-bold" : " viz-muted"), text: (yes ? "✓ " : "✗ ") + t }, c);
      });
      if (always) el("text", { x: 14, y: 240, class: "viz-small viz-muted", text: "(skipped: always notifiable)" }, c);

      desc.textContent = presetText || (st.g === "assess" ? "Always-assess list: the four questions must be applied; notification is not automatic." : st.g === "always" ? "Always-notifiable list: a single case is enough." : "Any other event, infectious or not: the four questions decide.");
      out.n(always ? "not needed" : n + " of 4");
      out.d(notify ? "Notify WHO" : "Not yet notifiable");
      out.t(notify ? "24 h after assessment" : "Keep monitoring");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Illustrative countries: preparedness score, median age (older countries score higher), trust, death rate.
  var N = 48, R = V.rng(611000017);
  for (var k = 0; k < 300; k++) R();
  var C = [];
  for (var i = 0; i < N; i++) {
    var S = 25 + 60 * R();
    var A = Math.max(16, Math.min(48, 18 + 0.38 * (S - 25) + 4 * V.normal(R)));
    var T = V.normal(R), E = 0.35 * V.normal(R);
    C.push({ S: S, A: A, T: T, E: E });
  }
  function fitLine(xs, ys) {
    var n = xs.length, mx = 0, my = 0, sxx = 0, sxy = 0, syy = 0, j;
    for (j = 0; j < n; j++) { mx += xs[j]; my += ys[j]; }
    mx /= n; my /= n;
    for (j = 0; j < n; j++) { sxx += (xs[j] - mx) * (xs[j] - mx); sxy += (xs[j] - mx) * (ys[j] - my); syy += (ys[j] - my) * (ys[j] - my); }
    var b = sxy / sxx;
    return { b: b, a: my - b * mx, r: sxy / Math.sqrt(sxx * syy) };
  }

  V.register("prep-scatter", function (root) {
    var outcome = "crude";
    var ctr = V.controls(root);
    var sB = V.slider(ctr, { label: "True effect of 10 more preparedness points on deaths", min: -0.3, max: 0.1, step: 0.05, value: -0.15, fmt: function (v) { return V.fmt.signed(Math.round(v * 100), 0) + "%"; }, onInput: draw });
    var sAge = V.slider(ctr, { label: "Extra deaths per year of median age", min: 0, max: 0.1, step: 0.01, value: 0.07, fmt: function (v) { return "+" + Math.round(v * 100) + "%"; }, onInput: draw });
    var r1 = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(r1, { options: [{ value: "crude", label: "Crude death rate" }, { value: "std", label: "Age-standardised death rate" }], value: outcome, onChange: function (v) { outcome = v; draw(); } });

    V.legend(root, [{ cls: "s1", label: "High-trust country" }, { cls: "s2", label: "Low-trust country" }, { cls: "s3", label: "Fitted line" }]);
    var c = V.svg(root, 640, 320);
    c.setAttribute("aria-label", "Scatter of 48 illustrative countries: preparedness index score on the x axis, deaths per 100,000 on a log scale on the y axis, coloured by trust, with a fitted regression line");
    var out = V.readouts(root, [
      { key: "r", label: "Correlation, score vs log death rate" },
      { key: "fit", label: "Fitted change per 10 points", cls: "bad" },
      { key: "true", label: "True effect per 10 points", cls: "good" },
      { key: "r2", label: "Share of variation explained by score (R²)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers, not real countries. Higher-scoring countries are richer and older; older populations die more from the same infection. Trust lowers deaths in every country but is unrelated to the score. Age-standardising removes the age term, as comparing at a common age structure would." }, root);

    function draw() {
      var beta = Math.log(1 + sB.value()), ga = sAge.value();
      var xs = [], ys = [], pts = [];
      C.forEach(function (p) {
        var ly = Math.log(150) + beta * (p.S - 55) / 10 - 0.35 * p.T + p.E + (outcome === "crude" ? ga * (p.A - 30) : 0);
        xs.push(p.S); ys.push(ly); pts.push([p.S, Math.exp(ly), p.T]);
      });
      var f0 = fitLine(xs, ys);
      clear(c);
      var L = function (v) { return Math.log10(v); };
      var f = V.frame(c, {
        x: [20, 90], y: [L(10), L(3000)],
        yTicks: [L(10), L(30), L(100), L(300), L(1000), L(3000)],
        fmtY: function (v) { return V.fmt.int(Math.pow(10, v)); },
        xTicks: [20, 30, 40, 50, 60, 70, 80, 90],
        xLabel: "Preparedness index score (0–100)", yLabel: "Deaths per 100,000 (log scale)", margin: { left: 60 }
      });
      pts.forEach(function (p) {
        var yv = Math.max(10.5, Math.min(2900, p[1]));
        el("circle", { cx: f.x(p[0]), cy: f.y(L(yv)), r: 5, class: "dot " + (p[2] > 0 ? "s1" : "s2"), opacity: 0.85 }, f.inner);
      });
      var yA = Math.exp(f0.a + f0.b * 22), yB = Math.exp(f0.a + f0.b * 88);
      el("path", { d: V.line([[f.x(22), f.y(L(yA))], [f.x(88), f.y(L(yB))]]), class: "stroke s3", "stroke-width": 2.5 }, f.inner);

      out.r(f0.r.toFixed(2));
      out.fit(V.fmt.signed(Math.round((Math.exp(10 * f0.b) - 1) * 100), 0) + "%");
      out.true(V.fmt.signed(Math.round(sB.value() * 100), 0) + "%");
      out.r2(Math.round(f0.r * f0.r * 100) + "%");
    }
    draw();
  });
})();
