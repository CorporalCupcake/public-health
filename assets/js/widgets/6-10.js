// Lecture 6.10 — Mass gatherings and the Hajj.
// (1) hajj-calendar: when the Day of Arafah falls in the Gregorian year, 1980–2060, against typical Makkah heat.
// (2) hajj-export: infections carried home by returning pilgrims; vaccines that block infection vs illness only.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }

  // ---- Arithmetic (tabular) Islamic calendar → Gregorian. Accurate to about ±1–2 days of the announced date.
  function islToJd(y, m, d) { return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439.5 - 1; }
  function jdToGreg(jd) {
    var z = Math.floor(jd + 0.5), al = Math.floor((z - 1867216.25) / 36524.25), a = z + 1 + al - Math.floor(al / 4);
    var b = a + 1524, c = Math.floor((b - 122.1) / 365.25), d = Math.floor(365.25 * c), e = Math.floor((b - d) / 30.6001);
    var day = b - d - Math.floor(30.6001 * e), mo = e < 14 ? e - 1 : e - 13, yr = mo > 2 ? c - 4716 : c - 4715;
    return [yr, mo, day];
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONFULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Mean daily maximum temperature in Makkah by month (°C), Jeddah Regional Climate Center long-term normals.
  var TMAX = [30.5, 31.7, 34.9, 38.7, 42.0, 43.8, 43.0, 42.8, 42.8, 40.1, 35.2, 32.0];
  function heatCls(t) { return t >= 42 ? "s3" : t >= 38 ? "s2" : "s1"; }

  var HAJJ = [];
  for (var h = 1400; h <= 1483; h++) {
    var g = jdToGreg(islToJd(h, 12, 9));
    if (g[0] >= 1980 && g[0] <= 2060) HAJJ.push({ ah: h, y: g[0], m: g[1], d: g[2], frac: g[0] + (g[1] - 1 + (g[2] - 1) / DIM[g[1] - 1]) / 12 });
  }

  V.register("hajj-calendar", function (root) {
    var ctr = V.controls(root);
    var sY = V.slider(ctr, { label: "Gregorian year", min: 1980, max: 2060, step: 1, value: 2024, fmt: String, onInput: draw });
    V.legend(root, [
      { cls: "s3", label: "Mean daily max ≥ 42 °C (May–Sep)" },
      { cls: "s2", label: "38–41 °C (Apr, Oct)" },
      { cls: "s1", label: "Below 38 °C (Nov–Mar)" }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Dots showing the calendar month of the Day of Arafah for each year from 1980 to 2060. The dots move steadily earlier through the year and wrap around about every 33 years, coloured by typical Makkah temperature in that month.");
    var out = V.readouts(root, [
      { key: "date", label: "Day of Arafah (9 Dhu al-Hijjah), approx." },
      { key: "t", label: "Typical daily maximum in that month (Makkah)" },
      { key: "next", label: "Next year the Hajj falls in May–September", cls: "bad" },
      { key: "out", label: "Next year it falls outside May–September", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Dates from the arithmetic Islamic calendar: the announced date, set by moon sighting, can differ by a day or two. Temperatures are long-term monthly means of daily maxima (Jeddah Regional Climate Center normals); a single day can be far hotter, as on 17 June 2024 (51.8 °C reported at the Grand Mosque). Two Hajj seasons fall in 2006 and in 2039." }, root);

    function draw() {
      var yr = sY.value();
      clear(c);
      var f = V.frame(c, {
        x: [1979, 2061], y: [12, 0],
        xTicks: [1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050, 2060],
        yTicks: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5],
        fmtY: function (v) { return MON[Math.floor(v)]; },
        xLabel: "Gregorian year", margin: { left: 44, right: 14, top: 10 }
      });
      var G = f.inner;
      // heat bands behind the dots
      TMAX.forEach(function (t, k) {
        el("rect", { x: f.x(1979), y: f.y(k), width: f.x(2061) - f.x(1979), height: f.y(k + 1) - f.y(k), class: "fill-soft " + heatCls(t), opacity: t >= 42 ? 0.55 : t >= 38 ? 0.4 : 0.25 }, G);
      });
      HAJJ.forEach(function (p) {
        var t = TMAX[p.m - 1], ym = p.m - 1 + (p.d - 0.5) / DIM[p.m - 1];
        el("circle", { cx: f.x(p.y + 0.5), cy: f.y(ym), r: 3.6, class: "dot " + heatCls(t) }, G);
      });
      var sel = HAJJ.filter(function (p) { return p.y === yr; });
      sel.forEach(function (p, i) {
        var ym = p.m - 1 + (p.d - 0.5) / DIM[p.m - 1], cx = f.x(p.y + 0.5), cy = f.y(ym);
        el("circle", { cx: cx, cy: cy, r: 8, class: "node s1", "stroke-width": 2.5 }, G);
        var right = cx < 470, lab = p.d + " " + MON[p.m - 1] + " " + p.y;
        el("text", { x: cx + (right ? 13 : -13), y: cy + 4 + (i ? 16 : 0), "text-anchor": right ? "start" : "end", class: "viz-small viz-bold", style: halo(), text: lab }, G);
      });
      el("line", { x1: f.x(yr + 0.5), x2: f.x(yr + 0.5), y1: f.y(0), y2: f.y(12), class: "viz-grid", "stroke-dasharray": "3 3" }, G);

      var p0 = sel[0];
      out.date(sel.map(function (p) { return p.d + " " + MONFULL[p.m - 1]; }).join(" and ") + " " + yr);
      out.t(sel.map(function (p) { return TMAX[p.m - 1].toFixed(1) + " °C"; }).join(" / "));
      function inSummer(p) { return p.m >= 5 && p.m <= 9; }
      var nxt = HAJJ.filter(function (p) { return p.y > yr && inSummer(p); })[0];
      var nout = HAJJ.filter(function (p) { return p.y > yr && !inSummer(p); })[0];
      out.next(inSummer(p0) ? "This year (" + MON[p0.m - 1] + ")" : (nxt ? String(nxt.y) : "after 2060"));
      out.out(!inSummer(p0) ? "This year (" + MON[p0.m - 1] + ")" : (nout ? String(nout.y) : "after 2060"));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Exported infections after the Hajj. Illustrative contingent sizes for eight home countries.
  var CONT = [["A", 220000], ["B", 150000], ["C", 80000], ["D", 30000], ["E", 12000], ["F", 4000], ["G", 1500], ["H", 400]];
  var VE = 0.85;

  V.register("hajj-export", function (root) {
    var mode = "block";
    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "Infection risk per pilgrim during the Hajj (per 100,000)", min: 1, max: 200, step: 1, value: 25, fmt: String, onInput: draw });
    var sC = V.slider(ctr, { label: "Pilgrims vaccinated", min: 0, max: 1, step: 0.05, value: 0, fmt: V.fmt.pct, onInput: draw });
    var sH = V.slider(ctr, { label: "Cases in home contacts per imported infection", min: 0, max: 1.5, step: 0.05, value: 0.3, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(row, { options: [{ value: "block", label: "Vaccine blocks infection" }, { value: "ill", label: "Vaccine prevents illness only" }], value: mode, onChange: function (v) { mode = v; draw(); } });

    V.legend(root, [{ cls: "s1", label: "Chance of at least one imported infection" }, { cls: "s3", label: "50% line" }]);
    var c = V.svg(root, 640, 296);
    c.setAttribute("aria-label", "Bar chart: for eight home countries with contingents from 220,000 to 400 pilgrims, the probability that at least one returning pilgrim brings the infection home");
    var out = V.readouts(root, [
      { key: "ill", label: "Pilgrims who fall ill (all eight contingents)" },
      { key: "exp", label: "Infections carried home", cls: "bad" },
      { key: "n50", label: "Countries with ≥ 50% chance of an import" },
      { key: "sec", label: "Expected cases among contacts at home", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 498,000 pilgrims in total; vaccine effectiveness fixed at 85%. Each contingent’s imports are Poisson, so P(at least one) = 1 − exp(−expected). “Illness only” mimics a vaccine that protects the vaccinee but not against carriage, as the old polysaccharide meningococcal vaccines did." }, root);

    function draw() {
      var r = sR.value() / 1e5, cov = sC.value(), sec = sH.value();
      var protect = 1 - cov * VE;
      var rExp = mode === "block" ? r * protect : r, rIll = r * protect;
      var ill = 0, exp = 0, n50 = 0, rows = [];
      CONT.forEach(function (k) {
        var e = k[1] * rExp, p = 1 - Math.exp(-e);
        ill += k[1] * rIll; exp += e; if (p >= 0.5) n50++;
        rows.push({ name: "Country " + k[0], n: k[1], e: e, p: p });
      });
      clear(c);
      var x0 = 196, x1 = 536, top = 10, bh = 22, gap = 8, sx = V.scale(0, 1, x0, x1);
      [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
        el("line", { x1: sx(t), x2: sx(t), y1: top - 4, y2: top + rows.length * (bh + gap) - gap + 4, class: "viz-grid" }, c);
        el("text", { x: sx(t), y: top + rows.length * (bh + gap) + 14, "text-anchor": "middle", class: "viz-tick", text: Math.round(t * 100) + "%" }, c);
      });
      rows.forEach(function (rw, i) {
        var yb = top + i * (bh + gap);
        el("text", { x: 8, y: yb + bh / 2 + 4, class: "viz-small", text: rw.name }, c);
        el("text", { x: x0 - 8, y: yb + bh / 2 + 4, "text-anchor": "end", class: "viz-small viz-muted", text: V.fmt.int(rw.n) + " pilgrims" }, c);
        el("rect", { x: x0, y: yb, width: Math.max(1, sx(rw.p) - x0), height: bh, class: "fill s1" }, c);
        el("text", { x: Math.min(sx(rw.p), x1) + 6, y: yb + bh / 2 + 4, class: "viz-small", text: (rw.p >= 0.995 ? ">99" : Math.round(rw.p * 100)) + "% · " + (rw.e < 0.1 ? rw.e.toFixed(2) : rw.e.toFixed(1)) }, c);
      });
      el("line", { x1: sx(0.5), x2: sx(0.5), y1: top - 4, y2: top + rows.length * (bh + gap) - gap + 4, class: "stroke s3 dashed", "stroke-width": 1.6 }, c);
      el("text", { x: (x0 + x1) / 2, y: 290, "text-anchor": "middle", class: "viz-label", text: "Chance of ≥ 1 imported infection · expected number after the label" }, c);

      out.ill(ill < 10 ? ill.toFixed(1) : V.fmt.int(ill));
      out.exp(exp < 10 ? exp.toFixed(1) : V.fmt.int(exp));
      out.n50(n50 + " of 8");
      var s = exp * sec;
      out.sec(s < 10 ? s.toFixed(1) : V.fmt.int(s));
    }
    draw();
  });
})();
