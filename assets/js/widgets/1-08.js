// Lecture 1.8 — single-day vs usual intake, and regression dilution. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;
  var MEAN = 10, SB = 2.5;   // usual salt intake: mean and between-person SD (g/day)

  function npdf(x, m, s) { var z = (x - m) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); }
  function ncdf(x, m, s) {
    // Abramowitz–Stegun 7.1.26 approximation of erf
    var z = (x - m) / (s * Math.SQRT2), t = 1 / (1 + 0.3275911 * Math.abs(z));
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return 0.5 * (1 + (z >= 0 ? y : -y));
  }
  function days(v) { return v + (v === 1 ? " day" : " days"); }

  // ---------------------------------------------------------------------------
  // Usual intake vs what a survey with k days per person shows.
  V.register("usual-vs-measured", function (root) {
    var ctr = V.controls(root);
    var sk = V.slider(ctr, { label: "Days measured per person", min: 1, max: 10, step: 1, value: 1, fmt: days, onInput: draw });
    var sw = V.slider(ctr, { label: "Day-to-day swing within a person (SD)", min: 0, max: 6, step: 0.5, value: 4, fmt: function (v) { return v.toFixed(1) + " g"; }, onInput: draw });

    V.legend(root, [
      { cls: "s1", label: "Usual intake (the truth)" },
      { cls: "s2", label: "What the survey shows (average of the days measured)" }
    ]);
    var c = V.svg(root, 640, 260);
    c.setAttribute("aria-label", "Usual intake distribution and the wider distribution seen with few measured days");
    var f = V.frame(c, { x: [0, 22], y: [0, 0.18], yTicks: [], xLabel: "Salt intake (g/day)", yLabel: "Share of people" });
    var lo = el("path", { class: "fill-soft s2" }, f.inner), hi = el("path", { class: "fill-soft s2" }, f.inner);
    var aU = el("path", { class: "fill-soft s1" }, f.inner);
    var lU = el("path", { class: "stroke s1" }, f.inner);
    var lM = el("path", { class: "stroke s2" }, f.inner);
    [5, 15].forEach(function (v) {
      el("line", { x1: f.x(v), x2: f.x(v), y1: f.y(0), y2: f.y(0.17), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);
      el("text", { x: f.x(v) + (v === 5 ? -6 : 6), y: f.y(0.17) + 4, "text-anchor": v === 5 ? "end" : "start", class: "viz-small viz-muted", text: v === 5 ? "under 5 g" : "over 15 g" }, f.inner);
    });

    var out = V.readouts(root, [
      { key: "u5", label: "Truly under 5 g", cls: "good" },
      { key: "m5", label: "Appear to be under 5 g", cls: "bad" },
      { key: "u15", label: "Truly over 15 g", cls: "good" },
      { key: "m15", label: "Appear to be over 15 g", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Usual intake averages 10 g/day with a between-person SD of 2.5 g. The mean is 10 g in both curves: only the spread changes." }, root);

    function curve(s) {
      var pts = [];
      for (var x = 0; x <= 22.001; x += 0.1) pts.push([f.x(x), f.y(npdf(x, MEAN, s))]);
      return pts;
    }
    function tail(s, a, b) {
      var top = [], bot = [];
      for (var x = a; x <= b + 1e-9; x += 0.1) { top.push([f.x(x), f.y(npdf(x, MEAN, s))]); bot.push([f.x(x), f.y(0)]); }
      return V.area(top, bot);
    }

    function draw() {
      var k = sk.value(), w = sw.value(), sm = Math.sqrt(SB * SB + w * w / k);
      var u = curve(SB), m = curve(sm), base = u.map(function (p) { return [p[0], f.y(0)]; });
      aU.setAttribute("d", V.area(u, base));
      lU.setAttribute("d", V.line(u));
      lM.setAttribute("d", V.line(m));
      lo.setAttribute("d", tail(sm, 0, 5));
      hi.setAttribute("d", tail(sm, 15, 22));
      out.u5(V.fmt.pct1(ncdf(5, MEAN, SB)));
      out.m5(V.fmt.pct1(ncdf(5, MEAN, sm)));
      out.u15(V.fmt.pct1(1 - ncdf(15, MEAN, SB)));
      out.m15(V.fmt.pct1(1 - ncdf(15, MEAN, sm)));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Regression dilution: noise in measured intake flattens the fitted slope.
  V.register("reg-dilution", function (root) {
    var N = 160, KMAX = 10, SLOPE = 1, rand = V.rng(20240817), people = [];
    for (var i = 0; i < N; i++) {
      var x = MEAN + SB * V.normal(rand), e = [];
      for (var j = 0; j < KMAX; j++) e.push(V.normal(rand));
      people.push({ x: x, y: 50 + SLOPE * (x - MEAN) + 1.8 * V.normal(rand), e: e });
    }

    var ctr = V.controls(root);
    var sk = V.slider(ctr, { label: "24-hour urines per person", min: 1, max: KMAX, step: 1, value: 1, fmt: function (v) { return String(v); }, onInput: draw });
    var sw = V.slider(ctr, { label: "Day-to-day swing within a person (SD)", min: 0, max: 6, step: 0.5, value: 2.5, fmt: function (v) { return v.toFixed(1) + " g"; }, onInput: draw });
    var view = V.toggle(root, { options: [{ value: "m", label: "Plot measured intake" }, { value: "u", label: "Plot usual intake" }], value: "m", onChange: draw });

    V.legend(root, [
      { cls: "s1", label: "People" },
      { cls: "s2", label: "True slope (usual intake)", dashed: true },
      { cls: "s3", label: "Fitted slope (measured intake)" }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Scatter of outcome against salt intake with the true and the fitted slopes");
    var f = V.frame(c, { x: [0, 20], y: [38, 62], xLabel: "Salt intake (g/day)", yLabel: "Outcome (illustrative units)" });
    var dots = el("g", null, f.inner);
    var lT = el("path", { class: "stroke s2 dashed" }, f.inner);
    var lO = el("path", { class: "stroke s3" }, f.inner);

    var out = V.readouts(root, [
      { key: "t", label: "True slope (per g/day)", cls: "good" },
      { key: "o", label: "Fitted slope on measured intake", cls: "bad" },
      { key: "r", label: "Fitted ÷ true" },
      { key: "l", label: "Predicted: between-person variance ÷ total variance" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Real differences between people have an SD of 2.5 g/day. When the day-to-day swing equals that and each person gives one urine, the fitted slope is roughly halved." }, root);

    function fit(xs, ys) {
      var n = xs.length, mx = 0, my = 0, sxy = 0, sxx = 0;
      for (var i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
      mx /= n; my /= n;
      for (i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); }
      var b = sxy / sxx;
      return { b: b, a: my - b * mx };
    }
    function seg(l) {
      // Line across the plot, clipped to the y range.
      var x0 = 0, x1 = 20, y = function (x) { return l.a + l.b * x; };
      if (l.b > 0) { x0 = Math.max(x0, (38 - l.a) / l.b); x1 = Math.min(x1, (62 - l.a) / l.b); }
      return V.line([[f.x(x0), f.y(y(x0))], [f.x(x1), f.y(y(x1))]]);
    }

    function draw() {
      var k = sk.value(), w = sw.value(), xs = [], us = [], ys = [];
      people.forEach(function (p) {
        var m = 0;
        for (var j = 0; j < k; j++) m += p.e[j];
        xs.push(p.x + w * m / k); us.push(p.x); ys.push(p.y);
      });
      var tl = fit(us, ys), ol = fit(xs, ys), lam = SB * SB / (SB * SB + w * w / k);
      var shown = view.value() === "u" ? us : xs;

      while (dots.firstChild) dots.removeChild(dots.firstChild);
      shown.forEach(function (x, i) {
        if (x < 0 || x > 20 || ys[i] < 38 || ys[i] > 62) return;
        el("circle", { cx: f.x(x), cy: f.y(ys[i]), r: 3.2, class: "dot s1", "fill-opacity": 0.6 }, dots);
      });
      lT.setAttribute("d", seg(tl));
      lO.setAttribute("d", seg(ol));

      out.t(V.fmt.num(tl.b, 2));
      out.o(V.fmt.num(ol.b, 2));
      out.r(V.fmt.pct(ol.b / tl.b));
      out.l(V.fmt.pct(lam));
    }
    draw();
  });
})();
