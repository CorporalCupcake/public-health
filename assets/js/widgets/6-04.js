// Lecture 6.4 — Outbreak investigation: an epidemic-curve builder (exposure pattern × incubation)
// and a food-specific attack-rate explorer using the real Oswego 1940 church-supper data.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }

  // Poisson draw (Knuth) for small means.
  function poisson(rand, mu) {
    var L = Math.exp(-mu), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  function lognormalDraw(rand, median, sdlog) { return median * Math.exp(sdlog * V.normal(rand)); }

  // ---------------------------------------------------------------------------
  // Epidemic-curve builder. Illustrative numbers.
  V.register("epi-curve", function (root) {
    var pattern = "point";
    var top = el("div", { style: "margin:0 0 0.6rem" }, root);
    V.toggle(top, {
      options: [{ value: "point", label: "Point source" }, { value: "cont", label: "Continuous source" }, { value: "prop", label: "Person to person" }],
      value: pattern, onChange: function (v) { pattern = v; draw(); }
    });
    var ctr = V.controls(root);
    var sMed = V.slider(ctr, { label: "Median incubation (days)", min: 1, max: 10, step: 0.5, value: 3, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sSd = V.slider(ctr, { label: "Incubation spread", min: 0.15, max: 0.7, step: 0.05, value: 0.3, fmt: function (v) { return v < 0.3 ? "narrow" : v < 0.5 ? "medium" : "wide"; }, onInput: draw });
    var sBin = V.slider(ctr, { label: "Bar width (days)", min: 0.5, max: 4, step: 0.5, value: 1, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sDur = V.slider(ctr, { label: "Source contaminated for (days)", min: 2, max: 20, step: 1, value: 8, fmt: function (v) { return String(v); }, onInput: draw });
    var sR = V.slider(ctr, { label: "Secondary cases per case (R)", min: 0.6, max: 3, step: 0.1, value: 1.8, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    function dim(sl, on) { sl.input.parentNode.style.opacity = on ? 1 : 0.4; }

    V.legend(root, [{ cls: "s1", label: "Cases by day of symptom onset" }, { cls: "s2", label: "When exposure actually happened" }]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Epidemic curve: histogram of cases by onset day, with the true exposure period shaded");
    var out = V.readouts(root, [
      { key: "n", label: "Cases" },
      { key: "span", label: "First to last onset (days)" },
      { key: "est", label: "Exposure estimated as peak − median incubation", cls: "good" },
      { key: "truth", label: "True exposure" }
    ]);
    var note = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers, simulated with a fixed seed. Person-to-person spread uses a closed group of 300 people, so it burns out; the serial interval equals the incubation period plus up to a day." }, root);

    function simulate() {
      var r = V.rng(640417); for (var i = 0; i < 300; i++) r();
      var med = sMed.value(), sd = sSd.value(), onsets = [], expo = [];
      if (pattern === "point") {
        for (i = 0; i < 80; i++) onsets.push(lognormalDraw(r, med, sd));
        expo = [0, 0];
      } else if (pattern === "cont") {
        var D = sDur.value();
        for (i = 0; i < 120; i++) onsets.push(r() * D + lognormalDraw(r, med, sd));
        expo = [0, D];
      } else {
        var R = sR.value(), N = 300, infected = 3, queue = [];
        for (i = 0; i < 3; i++) { var o = lognormalDraw(r, med, sd); queue.push(o); onsets.push(o); }
        while (queue.length && onsets.length < N) {
          queue.sort(function (a, b) { return a - b; });
          var src = queue.shift(), k = poisson(r, R * (N - infected) / N);
          for (var j = 0; j < k && infected < N; j++) {
            var t = src + r() + lognormalDraw(r, med, sd);
            infected++; onsets.push(t); queue.push(t);
          }
        }
        expo = [0, 0];
      }
      return { onsets: onsets, expo: expo };
    }

    function draw() {
      dim(sDur, pattern === "cont"); dim(sR, pattern === "prop");
      var sim = simulate(), on = sim.onsets, bw = sBin.value(), med = sMed.value();
      var maxT = Math.max.apply(null, on), minT = Math.min.apply(null, on);
      var xmax = Math.max(20, Math.ceil((maxT + 1) / 5) * 5);
      var nb = Math.ceil(xmax / bw), bins = [];
      for (var b = 0; b < nb; b++) bins.push(0);
      on.forEach(function (t) { var k = Math.floor(Math.max(0, t) / bw); if (k < nb) bins[k]++; });
      var ymax = Math.max(4, Math.max.apply(null, bins));
      var yTop = Math.ceil(ymax * 1.15 / 5) * 5;

      clear(c);
      var f = V.frame(c, { x: [0, xmax], y: [0, yTop], xLabel: "Days since first exposure", yLabel: "Cases per bar" });
      var G = f.inner;
      var e0 = sim.expo[0], e1 = sim.expo[1];
      if (e1 > e0) el("rect", { x: f.x(e0), y: f.y(yTop), width: f.x(e1) - f.x(e0), height: f.y(0) - f.y(yTop), class: "fill-soft s2" }, G);
      else el("line", { x1: f.x(0) + 1.5, x2: f.x(0) + 1.5, y1: f.y(0), y2: f.y(yTop), class: "stroke s2", "stroke-width": 3 }, G);
      bins.forEach(function (n, k) {
        if (!n) return;
        el("rect", { x: f.x(k * bw) + 0.5, y: f.y(n), width: Math.max(1, f.x(bw) - f.x(0) - 1), height: f.y(0) - f.y(n), class: "fill s1" }, G);
      });
      // peak bin and estimate
      var pk = 0; bins.forEach(function (n, k) { if (n > bins[pk]) pk = k; });
      var peakT = (pk + 0.5) * bw, est = peakT - med;
      if (pattern !== "prop") {
        el("line", { x1: f.x(Math.max(0, est)), x2: f.x(Math.max(0, est)), y1: f.y(0), y2: f.y(yTop), class: "stroke dashed s3", "stroke-width": 1.8 }, G);
        var lx = f.x(Math.max(0, est)) + 6, anchor = "start";
        if (lx > 520) { lx -= 12; anchor = "end"; }
        el("text", { x: lx, y: f.y(yTop) + 14, class: "viz-small colour s3", "text-anchor": anchor, style: halo(), text: "estimated exposure" }, G);
      }

      out.n(String(on.length));
      out.span((maxT - minT).toFixed(1));
      if (pattern === "prop") {
        out.est("not meaningful");
        out.truth("chains of cases");
      } else {
        out.est("day " + est.toFixed(1));
        out.truth(e1 > e0 ? "days 0–" + e1 : "day 0");
      }
      if (pattern === "point") note.textContent = "One exposure: a single peak whose width is set by the incubation spread alone. All cases fall within roughly one incubation range. A bar width near a quarter to a third of the median incubation gives the clearest shape; very wide bars hide it, very narrow bars make noise.";
      else if (pattern === "cont") note.textContent = "A source that stays contaminated: a plateau rather than a peak, lasting about as long as the exposure plus one incubation range. The curve falls about one incubation period after the source is removed, which is how you check that control worked. Peak − median incubation is misleading here.";
      else note.textContent = "Person-to-person spread: successive, overlapping waves about one serial interval apart, growing while R is above 1 and fading as susceptibles run out. Set R below 1: the first waves happen and then die out. There is no single exposure time to back-calculate.";
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Attack-rate explorer: Oswego, New York, 1940 (CDC EIS case study; epitools::oswego).
  // [food, ill & ate, total ate, ill & did not eat, total did not eat]
  var OSW = [
    ["Baked ham", 29, 46, 17, 29], ["Spinach", 26, 43, 20, 32], ["Mashed potato", 23, 37, 23, 37],
    ["Cabbage salad", 18, 28, 28, 47], ["Jello", 16, 23, 30, 52], ["Rolls", 21, 37, 25, 38],
    ["Brown bread", 18, 27, 28, 48], ["Milk", 2, 4, 44, 71], ["Coffee", 19, 31, 27, 44],
    ["Water", 13, 24, 33, 51], ["Cakes", 27, 40, 19, 35], ["Vanilla ice cream", 43, 54, 3, 21],
    ["Chocolate ice cream", 25, 47, 20, 27], ["Fruit salad", 4, 6, 42, 69]
  ];
  var TOTAL_ILL = 46;
  function calc(row) {
    var a = row[1], n1 = row[2], cc = row[3], n0 = row[4];
    var ar1 = a / n1, ar0 = cc / n0, rr = ar1 / ar0;
    var se = Math.sqrt(1 / a - 1 / n1 + 1 / cc - 1 / n0);
    return { name: row[0], a: a, n1: n1, c: cc, n0: n0, ar1: ar1, ar0: ar0, rr: rr, lo: Math.exp(Math.log(rr) - 1.96 * se), hi: Math.exp(Math.log(rr) + 1.96 * se), expl: a / TOTAL_ILL };
  }

  V.register("attack-rates", function (root) {
    var sortBy = "ar1", sel = "Vanilla ice cream";
    var ctr = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem;font-family:var(--font-ui);font-size:0.85rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Sort by:" }, ctr);
    V.toggle(ctr, {
      options: [{ value: "ar1", label: "Attack rate if eaten" }, { value: "rr", label: "Risk ratio" }, { value: "expl", label: "% of cases who ate it" }],
      value: sortBy, onChange: function (v) { sortBy = v; draw(); }
    });
    var wrap = el("div", { class: "table-wrap" }, root);
    var c = V.svg(root, 640, 150);
    c.setAttribute("aria-label", "Attack rate among those who ate and did not eat the selected food");
    var out = V.readouts(root, [
      { key: "rr", label: "Risk ratio (ate vs did not eat)", cls: "good" },
      { key: "ci", label: "95% confidence interval" },
      { key: "expl", label: "Share of the 46 cases who ate it" }
    ]);
    el("p", { class: "widget-note", text: "Real data: 75 of the 80 people at the supper were interviewed; 46 fell ill (CDC EIS case study; epitools::oswego). Tap a row to select a food. One person has no chocolate ice cream record." }, root);

    function draw() {
      var rows = OSW.map(calc).sort(function (a, b) { return b[sortBy] - a[sortBy]; });
      clear(wrap);
      var t = el("table", null, wrap);
      var th = el("tr", null, el("thead", null, t));
      ["Food", "Ill / ate", "AR ate", "Ill / did not eat", "AR not", "RR"].forEach(function (h) { el("th", { text: h }, th); });
      var tb = el("tbody", null, t);
      rows.forEach(function (rw) {
        var tr = el("tr", { style: "cursor:pointer" + (rw.name === sel ? ";background:var(--accent-soft);font-weight:700" : ""), tabindex: "0" }, tb);
        [rw.name, rw.a + " / " + rw.n1, V.fmt.pct(rw.ar1), rw.c + " / " + rw.n0, V.fmt.pct(rw.ar0), rw.rr.toFixed(2)].forEach(function (v) { el("td", { text: v }, tr); });
        function pick() { sel = rw.name; draw(); }
        tr.addEventListener("click", pick);
        tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      });

      var s = rows.filter(function (rw) { return rw.name === sel; })[0];
      clear(c);
      var x0 = 170, x1 = 590, sx = V.scale(0, 1, x0, x1);
      el("text", { x: 10, y: 18, class: "viz-bold", text: s.name }, c);
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
        el("line", { x1: sx(v), x2: sx(v), y1: 28, y2: 112, class: "viz-grid" }, c);
        el("text", { x: sx(v), y: 128, "text-anchor": "middle", class: "viz-tick", text: V.fmt.pct(v) }, c);
      });
      [[s.ar1, "Ate it (" + s.a + "/" + s.n1 + ")", "fill s1"], [s.ar0, "Did not (" + s.c + "/" + s.n0 + ")", "fill s5"]].forEach(function (b, i) {
        var y = 34 + i * 40;
        el("text", { x: x0 - 8, y: y + 17, "text-anchor": "end", class: "viz-small", text: b[1] }, c);
        el("rect", { x: x0, y: y, width: Math.max(1, sx(b[0]) - x0), height: 26, class: b[2] }, c);
        el("text", { x: sx(b[0]) + 6, y: y + 17, class: "viz-small viz-bold", text: V.fmt.pct(b[0]) }, c);
      });
      el("text", { x: (x0 + x1) / 2, y: 146, "text-anchor": "middle", class: "viz-label", text: "Attack rate (share who fell ill)" }, c);

      out.rr(s.rr.toFixed(2));
      out.ci(s.lo.toFixed(2) + " to " + s.hi.toFixed(2));
      out.expl(s.a + " of 46 (" + V.fmt.pct(s.expl) + ")");
    }
    draw();
  });
})();
