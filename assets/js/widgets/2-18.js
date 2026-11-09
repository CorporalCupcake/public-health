// Lecture 2.18 — life-course models explorer, and the slope index of inequality. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Segmented toggle with a label and a set() method (Viz.toggle has no setter).
  function tog(parent, label, options, value, onChange) {
    var wrap = el("div", { class: "widget-slider" }, parent);
    el("span", { class: "widget-slider-label", text: label }, wrap);
    var box = el("div", { class: "widget-toggle", role: "group" }, wrap);
    var cur = value, btns = [];
    options.forEach(function (opt) {
      var b = el("button", { type: "button", text: opt.label }, box);
      b.addEventListener("click", function () { cur = opt.value; paint(); if (onChange) onChange(cur); });
      btns.push([b, opt.value]);
    });
    function paint() { btns.forEach(function (p) { p[0].classList.toggle("on", p[1] === cur); p[0].setAttribute("aria-pressed", p[1] === cur); }); }
    paint();
    return { value: function () { return cur; }, set: function (v) { cur = v; paint(); } };
  }

  // ---------------------------------------------------------------------------
  // Life-course models: the same exposure history, weighted differently by each model.
  V.register("life-course", function (root) {
    var STAGES = ["Before birth", "Childhood", "Adolescence", "Early adult", "Mid-life"];
    var W = {
      critical: [1, 0, 0, 0, 0],
      sensitive: [0.4, 0.25, 0.15, 0.12, 0.08],
      accumulation: [0.2, 0.2, 0.2, 0.2, 0.2]
    };
    var NAMES = { critical: "Critical period", sensitive: "Sensitive period", accumulation: "Accumulation" };
    var MAXRR = 2; // lifelong exposure doubles adult risk under every model

    var top = V.controls(root);
    var model = tog(top, "Life-course model", [
      { value: "critical", label: "Critical" }, { value: "sensitive", label: "Sensitive" }, { value: "accumulation", label: "Accumulation" }
    ], "sensitive", draw);

    var ctr = V.controls(root);
    var ex = STAGES.map(function (s, i) {
      return tog(ctr, "Exposed: " + s.toLowerCase(), [{ value: 0, label: "No" }, { value: 1, label: "Yes" }], i < 2 ? 1 : 0, draw);
    });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Load a history:" }, pre);
    [["Poor start, then better", [1, 1, 0, 0, 0]], ["Late exposure only", [0, 0, 0, 1, 1]], ["Lifelong", [1, 1, 1, 1, 1]]].forEach(function (h) {
      V.button(pre, h[0], function () { h[1].forEach(function (v, i) { ex[i].set(v); }); draw(); });
    });

    var c = V.svg(root, 640, 226);
    c.setAttribute("aria-label", "Bars show how much each life stage counts toward adult risk under the chosen model; exposed stages are filled");
    V.legend(root, [
      { cls: "s3", label: "Exposed: this stage's weight adds to adult risk" },
      { cls: "s5", label: "Not exposed" }
    ]);
    var out = V.readouts(root, [
      { key: "rr", label: "Adult risk relative to never exposed", cls: "bad" },
      { key: "share", label: "Share of the maximum (lifelong) excess risk" },
      { key: "n", label: "Stages exposed" }
    ]);

    // Comparison table: three histories under three models
    var tw = el("div", { class: "table-wrap", style: "margin-top:0.9rem" }, root);
    var table = el("table", null, tw);
    var thead = el("thead", null, table), hr = el("tr", null, thead);
    ["History", "Critical", "Sensitive", "Accumulation"].forEach(function (h) { el("th", { text: h }, hr); });
    var tbody = el("tbody", null, table);
    var HIST = [["Early only (before birth, childhood)", [1, 1, 0, 0, 0]], ["Late only (early adult, mid-life)", [0, 0, 0, 1, 1]], ["Lifelong", [1, 1, 1, 1, 1]]];
    function rrOf(m, e) { var s = 0; for (var i = 0; i < 5; i++) s += W[m][i] * e[i]; return 1 + (MAXRR - 1) * s; }
    HIST.forEach(function (h) {
      var tr = el("tr", null, tbody);
      el("td", { text: h[0] }, tr);
      ["critical", "sensitive", "accumulation"].forEach(function (m) { el("td", { text: "RR " + rrOf(m, h[1]).toFixed(2) }, tr); });
    });
    el("p", { class: "widget-note", text: "Illustrative numbers. The table is how a study tells the models apart: compare people whose exposure came at different ages. Only the timing pattern differs; lifelong exposure gives RR 2 in every model." }, root);

    function draw() {
      var m = model.value(), e = ex.map(function (t) { return t.value(); });
      clear(c);
      el("text", { x: 20, y: 18, class: "viz-small viz-muted", text: NAMES[m] + ": how much each life stage counts toward adult risk" }, c);
      var base = 172, H = 124;
      el("line", { x1: 40, x2: 620, y1: base, y2: base, class: "viz-axis" }, c);
      STAGES.forEach(function (s, i) {
        var cx = 96 + i * 112, w = W[m][i], h = w * H;
        if (h > 0) el("rect", { x: cx - 36, y: base - h, width: 72, height: h, class: (e[i] ? "fill s3" : "fill-soft s5") }, c);
        el("text", { x: cx, y: base - h - 8, "text-anchor": "middle", class: "viz-small", text: "weight " + w.toFixed(2) }, c);
        el("text", { x: cx, y: base + 18, "text-anchor": "middle", class: "viz-small viz-bold", text: s }, c);
        el("text", { x: cx, y: base + 36, "text-anchor": "middle", class: "viz-small " + (e[i] ? "colour s3" : "viz-muted"), text: e[i] ? "exposed" : "not exposed" }, c);
      });
      var rr = rrOf(m, e);
      out.rr("RR " + rr.toFixed(2));
      out.share(V.fmt.pct((rr - 1) / (MAXRR - 1)));
      out.n(e.reduce(function (a, b) { return a + b; }, 0) + " of 5");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Slope index of inequality: the same underlying gradient, different group sizes.
  V.register("sii-gradient", function (root) {
    var GROUPS = ["Tertiary", "Secondary", "Intermediate", "Primary or less"]; // most → least advantaged
    var S0 = [0.10, 0.20, 0.30, 0.40], S1 = [0.40, 0.35, 0.20, 0.05];
    var TOP = 5; // deaths per 1,000 per year at the very top of the ladder

    var ctr = V.controls(root);
    var sk = V.slider(ctr, { label: "Steepness: rate at the very bottom ÷ very top", min: 1, max: 4, step: 0.1, value: 2.5, fmt: function (v) { return v.toFixed(1) + "×"; }, onInput: draw });
    var st = V.slider(ctr, { label: "Education expansion (group sizes shift up)", min: 0, max: 100, step: 5, value: 0, fmt: function (v) { return v + "%"; }, onInput: draw });

    V.legend(root, [
      { cls: "s1", label: "Death rate in each education group (bar width = share of population)" },
      { cls: "s3", label: "Fitted line across the whole ladder (gives SII and RII)" }
    ]);
    var c = V.svg(root, 640, 290);
    c.setAttribute("aria-label", "Bars for four education groups, ordered from most to least advantaged, with widths equal to population share and heights equal to death rate, and a fitted regression line");
    var out = V.readouts(root, [
      { key: "rr", label: "Rate ratio: lowest vs highest group" },
      { key: "rd", label: "Rate difference: lowest vs highest group (per 1,000)" },
      { key: "sii", label: "SII: fitted gap, bottom vs top of ladder (per 1,000)", cls: "bad" },
      { key: "rii", label: "RII: fitted bottom ÷ top", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each person’s risk depends only on their rank on the ladder, so the true inequality never changes as education expands. Watch which measures move anyway. RII here is bottom ÷ top of the fitted line; some papers use SII ÷ mean." }, root);

    function draw() {
      var k = sk.value(), t = st.value() / 100;
      var sh = S0.map(function (a, i) { return a + (S1[i] - a) * t; });
      function rate(r) { return TOP * (1 + (k - 1) * r); } // r: 0 = top of ladder, 1 = bottom
      var cum = 0, groups = sh.map(function (s, i) { var g = { name: GROUPS[i], lo: cum, hi: cum + s, w: s }; g.mid = cum + s / 2; g.rate = rate(g.mid); cum += s; return g; });

      // Weighted least squares of group rate on mid-rank
      var sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      groups.forEach(function (g) { sw += g.w; sx += g.w * g.mid; sy += g.w * g.rate; sxx += g.w * g.mid * g.mid; sxy += g.w * g.mid * g.rate; });
      var slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx), icpt = (sy - slope * sx) / sw;
      var fitTop = icpt, fitBot = icpt + slope;

      clear(c);
      var ymax = 22;
      var f = V.frame(c, { x: [0, 1], y: [0, ymax], fmtX: V.fmt.pct, xLabel: "Cumulative share of population, most advantaged (left) to least (right)", yLabel: "Deaths per 1,000 per year" });
      groups.forEach(function (g) {
        var x0 = f.x(g.lo), x1 = f.x(g.hi);
        el("rect", { x: x0 + 1, y: f.y(g.rate), width: Math.max(0, x1 - x0 - 2), height: f.y(0) - f.y(g.rate), class: "fill-soft s1" }, f.inner);
        el("line", { x1: x0 + 1, x2: x1 - 1, y1: f.y(g.rate), y2: f.y(g.rate), class: "stroke s1" }, f.inner);
        if (x1 - x0 > 76) {
          el("text", { x: (x0 + x1) / 2, y: f.y(0) - 24, "text-anchor": "middle", class: "viz-small", text: g.name }, f.inner);
          el("text", { x: (x0 + x1) / 2, y: f.y(0) - 9, "text-anchor": "middle", class: "viz-small viz-muted", text: V.fmt.pct(g.w) + " of people" }, f.inner);
        }
      });
      el("path", { d: V.line([[f.x(0), f.y(fitTop)], [f.x(1), f.y(fitBot)]]), class: "stroke s3" }, f.inner);
      el("circle", { cx: f.x(0), cy: f.y(fitTop), r: 5, class: "dot s3" }, f.inner);
      el("circle", { cx: f.x(1), cy: f.y(fitBot), r: 5, class: "dot s3" }, f.inner);
      el("text", { x: f.x(0) + 8, y: f.m.top + 14, class: "viz-small viz-bold colour s3", text: "Fitted line: top of ladder " + V.fmt.num(fitTop, 1) + ", bottom " + V.fmt.num(fitBot, 1) + " per 1,000" }, f.inner);

      var lo = groups[groups.length - 1], hi = groups[0];
      out.rr(V.fmt.num(lo.rate / hi.rate, 2) + "×");
      out.rd(V.fmt.num(lo.rate - hi.rate, 1));
      out.sii(V.fmt.num(fitBot - fitTop, 1));
      out.rii(V.fmt.num(fitBot / fitTop, 2) + "×");
    }
    draw();
  });
})();
