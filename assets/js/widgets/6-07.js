// Lecture 6.7 — Classical vs Berkson measurement error; WBGT over a summer day vs workload limits and GCC ban windows. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function stream(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  function ols(x, y) {
    var n = x.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    for (i = 0; i < n; i++) { sxx += (x[i] - mx) * (x[i] - mx); sxy += (x[i] - mx) * (y[i] - my); }
    var b = sxy / sxx, a = my - b * mx, rss = 0;
    for (i = 0; i < n; i++) { var r = y[i] - a - b * x[i]; rss += r * r; }
    return { a: a, b: b, se: Math.sqrt(rss / (n - 2) / sxx) };
  }

  // ---------------------------------------------------------------------------
  // Classical vs Berkson error. True model: outcome = 100 − 0.5 × true PM2.5 + N(0, 6²).
  V.register("me-error", function (root) {
    var N = 300, SIMS = 200, BETA = -0.5, mode = "classical", seed = 670001;
    var ctr = V.controls(root);
    V.toggle(ctr, { options: [{ value: "classical", label: "Classical: measured = true + noise" }, { value: "berkson", label: "Berkson: true = assigned + noise" }], value: mode, onChange: function (v) { mode = v; draw(); } });
    var sU = V.slider(ctr, { label: "Error SD (µg/m³); true exposure SD is 8", min: 0, max: 12, step: 0.5, value: 8, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(row, "New study sample", function () { seed += 2; draw(); });

    V.legend(root, [{ cls: "s5", label: "Participants (outcome vs measured or assigned exposure)" }, { cls: "s1", label: "Fitted slope" }, { cls: "s2", label: "True slope", dashed: true }]);
    var c = V.svg(root, 640, 290);
    c.setAttribute("aria-label", "Scatter of an outcome against the exposure value used in analysis, with the fitted and the true regression lines");
    var c2 = V.svg(root, 640, 110);
    c2.setAttribute("aria-label", "Estimated slopes from 200 repeated studies, with the true slope marked");
    var out = V.readouts(root, [
      { key: "b", label: "This study's slope (true −0.50)" },
      { key: "mean", label: "Average slope over 200 studies", cls: "good" },
      { key: "ratio", label: "Average ÷ true slope (1 = unbiased)" },
      { key: "sd", label: "Spread of slopes across studies (SD)", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 300 people per study; true PM2.5 has mean 40 and SD 8 µg/m³; the outcome is an arbitrary lung-function score that falls 0.5 per µg/m³. Each study is fitted by ordinary least squares on the exposure the analyst has." }, root);

    function sample(r, sdU) {
      var w = [], y = [];
      for (var i = 0; i < N; i++) {
        var a = 40 + 8 * V.normal(r), u = sdU * V.normal(r), x, m;
        if (mode === "classical") { x = a; m = a + u; } else { m = a; x = a + u; }
        w.push(m); y.push(100 + BETA * x + 6 * V.normal(r));
      }
      return { w: w, y: y };
    }

    function draw() {
      var sdU = sU.value(), d = sample(stream(seed), sdU), fit = ols(d.w, d.y);
      var bs = [], sum = 0, ss = 0, k;
      for (k = 0; k < SIMS; k++) { var dd = sample(stream(seed * 13 + 2 * k + 1), sdU); var b = ols(dd.w, dd.y).b; bs.push(b); sum += b; }
      var mean = sum / SIMS;
      bs.forEach(function (b) { ss += (b - mean) * (b - mean); });

      clear(c);
      var f = V.frame(c, { x: [0, 80], y: [45, 115], xLabel: "Exposure used in the analysis, PM2.5 (µg/m³)", yLabel: "Outcome score" });
      d.w.forEach(function (x, i) {
        if (x < 0 || x > 80 || d.y[i] < 45 || d.y[i] > 115) return;
        el("circle", { cx: f.x(x), cy: f.y(d.y[i]), r: 2.4, class: "dot s5", opacity: 0.55 }, f.inner);
      });
      el("line", { x1: f.x(0), x2: f.x(80), y1: f.y(100), y2: f.y(100 + BETA * 80), class: "stroke s2 dashed" }, f.inner);
      el("line", { x1: f.x(0), x2: f.x(80), y1: f.y(fit.a), y2: f.y(fit.a + fit.b * 80), class: "stroke s1", "stroke-width": 3 }, f.inner);

      clear(c2);
      var g = V.frame(c2, { x: [-0.8, 0], y: [0, 1], yTicks: [], xTicks: [-0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0], fmtX: function (v) { return v === 0 ? "0" : "−" + Math.abs(v).toFixed(1); }, xLabel: "Estimated slope in each of 200 repeated studies", margin: { left: 16, right: 16, top: 8, bottom: 40 } });
      var rj = stream(99991);
      bs.forEach(function (b) {
        var bb = Math.max(-0.8, Math.min(0, b));
        el("circle", { cx: g.x(bb), cy: g.y(0.2 + 0.6 * rj()), r: 2.6, class: "dot s1", opacity: 0.55 }, g.inner);
      });
      el("line", { x1: g.x(BETA), x2: g.x(BETA), y1: g.y(1), y2: g.y(0), class: "stroke s2 dashed" }, g.inner);

      out.b(V.fmt.signed(fit.b, 2));
      out.mean(V.fmt.signed(mean, 2));
      out.ratio((mean / BETA).toFixed(2));
      out.sd(Math.sqrt(ss / (SIMS - 1)).toFixed(3));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // WBGT over a summer day. Simplified, illustrative physics (not the Liljegren model):
  // psychrometric wet bulb from Stull (2011); natural wet bulb and globe raised by sun, lowered by wind.
  function satVap(t) { return 6.112 * Math.exp(17.62 * t / (243.12 + t)); }
  function stullWB(t, rh) {
    rh = Math.max(5, Math.min(99, rh));
    return t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(t + rh) - Math.atan(rh - 1.676331) +
      0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
  }
  function shape(h) { // 0 at 05:00, 1 at 15:00, easing after
    if (h <= 5) return 0;
    if (h <= 15) return 0.5 - 0.5 * Math.cos(Math.PI * (h - 5) / 10);
    return 0.5 + 0.5 * Math.cos(Math.PI * (h - 15) / 14);
  }
  var PROFILES = {
    inland: { tmin: 31, tmax: 45, td: function () { return 5; } },
    coastal: { tmin: 31, tmax: 41, td: function (h) { return h <= 15 ? 24 - 6 * (h - 5) / 10 : 18 + 0.6 * (h - 15); } }
  };
  var BANS = {
    none: null, ksa: [12, 15], uae: [12.5, 15], qat: [10, 15.5], kwt: [11, 16], omn: [12.5, 15.5]
  };
  var BAN_NAMES = { none: "No ban", ksa: "Saudi Arabia 12:00–15:00", uae: "UAE 12:30–15:00", qat: "Qatar 10:00–15:30", kwt: "Kuwait 11:00–16:00", omn: "Oman 12:30–15:30" };
  var LOADS = { light: 180, moderate: 300, heavy: 415, vheavy: 520 };

  function hourly(prof, sun, wind, h) {
    var p = PROFILES[prof], ta = p.tmin + (p.tmax - p.tmin) * shape(h), td = p.td(h);
    var rh = 100 * satVap(td) / satVap(ta), tw = stullWB(ta, rh);
    var s = Math.max(0, Math.sin(Math.PI * (h - 5.5) / 13)) * 1000;
    var sq = Math.sqrt(wind), tnwb, tg, wbgt;
    if (sun) { tnwb = tw + 1.5 * (s / 1000) / sq; tg = ta + 14 * (s / 1000) / sq; wbgt = 0.7 * tnwb + 0.2 * tg + 0.1 * ta; }
    else { tnwb = tw + 0.3; tg = ta + 1; wbgt = 0.7 * tnwb + 0.3 * tg; }
    return { ta: ta, tnwb: tnwb, tg: tg, wbgt: wbgt, rh: rh };
  }
  function hhmm(h) { var H = Math.floor(h), M = Math.round((h - H) * 60); return (H < 10 ? "0" : "") + H + ":" + (M < 10 ? "0" : "") + M; }

  V.register("wbgt-day", function (root) {
    var prof = "coastal", sun = true, load = "moderate", accl = true, ban = "ksa";
    var ctr = V.controls(root);
    V.toggle(ctr, { options: [{ value: "inland", label: "Inland city (dry)" }, { value: "coastal", label: "Coastal city (humid)" }], value: prof, onChange: function (v) { prof = v; draw(); } });
    V.toggle(ctr, { options: [{ value: true, label: "Full sun" }, { value: false, label: "Shade" }], value: sun, onChange: function (v) { sun = v; draw(); } });
    var sW = V.slider(ctr, { label: "Wind speed (m/s)", min: 0.5, max: 5, step: 0.5, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    V.toggle(ctr, { options: [{ value: true, label: "Acclimatised" }, { value: false, label: "Not acclimatised" }], value: accl, onChange: function (v) { accl = v; draw(); } });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;margin:0 0 0.6rem" }, root);
    V.toggle(row, { options: [{ value: "light", label: "Light" }, { value: "moderate", label: "Moderate" }, { value: "heavy", label: "Heavy" }, { value: "vheavy", label: "Very heavy" }], value: load, onChange: function (v) { load = v; draw(); } });
    var row2 = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.toggle(row2, { options: [{ value: "none", label: "No ban" }, { value: "ksa", label: "KSA" }, { value: "uae", label: "UAE" }, { value: "qat", label: "Qatar" }, { value: "kwt", label: "Kuwait" }, { value: "omn", label: "Oman" }], value: ban, onChange: function (v) { ban = v; draw(); } });

    V.legend(root, [{ cls: "s1", label: "WBGT" }, { cls: "s3", label: "Limit for this workload", dashed: true }, { cls: "s1", label: "Ban window (shaded)" }, { cls: "s3", label: "Above limit, not covered" }]);
    var c = V.svg(root, 640, 280);
    c.setAttribute("aria-label", "Half-hourly WBGT from 05:00 to 19:00 with the workload limit and the selected country's midday ban window");
    var c2 = V.svg(root, 640, 200);
    c2.setAttribute("aria-label", "The three component temperatures through the day: air, natural wet bulb and black globe");
    var out = V.readouts(root, [
      { key: "peak", label: "Peak WBGT (time)" },
      { key: "lim", label: "WBGT limit for this workload" },
      { key: "above", label: "Hours above the limit, 05:00–19:00" },
      { key: "cov", label: "of which inside the ban window", cls: "good" },
      { key: "unc", label: "of which outside the ban", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: invented but plausible summer days, not ERA5 data, and simplified physics (not the Liljegren model). Limits follow NIOSH's equations for continuous work: 56.7 − 11.5·log10(M) acclimatised and 59.9 − 14.1·log10(M) not, with metabolic rate M of 180, 300, 415 or 520 W; no clothing adjustment or rest breaks." }, root);

    function draw() {
      var wind = sW.value(), M = LOADS[load];
      var lim = accl ? 56.7 - 11.5 * Math.log10(M) : 59.9 - 14.1 * Math.log10(M);
      var bw = BANS[ban], pts = [], comp = [], above = 0, cov = 0, peak = { v: -1, h: 0 };
      for (var h = 5; h <= 19.001; h += 0.25) {
        var r = hourly(prof, sun, wind, h);
        pts.push([h, r.wbgt]); comp.push([h, r]);
        if (r.wbgt > peak.v) peak = { v: r.wbgt, h: h };
      }
      var slots = [];
      for (var s = 5.25; s < 19; s += 0.5) {
        var w = hourly(prof, sun, wind, s).wbgt, inBan = bw && s > bw[0] && s < bw[1];
        if (w > lim) { above += 0.5; if (inBan) cov += 0.5; }
        slots.push({ h: s, w: w, over: w > lim, inBan: inBan });
      }

      clear(c);
      var f = V.frame(c, { x: [5, 19], y: [18, 38], xTicks: [6, 8, 10, 12, 14, 16, 18], fmtX: function (v) { return v + ":00"; }, xLabel: "Time of day", yLabel: "WBGT (°C)" });
      if (bw) {
        el("rect", { x: f.x(bw[0]), y: f.y(38), width: f.x(bw[1]) - f.x(bw[0]), height: f.y(18) - f.y(38), class: "fill-soft s1" }, f.inner);
        el("text", { x: (f.x(bw[0]) + f.x(bw[1])) / 2, y: f.y(38) + 14, "text-anchor": "middle", class: "viz-small viz-bold colour s1", text: "ban" }, f.inner);
      }
      el("line", { x1: f.x(5), x2: f.x(19), y1: f.y(lim), y2: f.y(lim), class: "stroke s3 dashed", "stroke-width": 2 }, f.inner);
      el("text", { x: f.x(19) - 6, y: f.y(lim) + 16, "text-anchor": "end", class: "viz-small viz-bold colour s3", text: "limit " + lim.toFixed(1) + " °C" }, f.inner);
      el("path", { d: V.line(pts.map(function (p) { return [f.x(p[0]), f.y(p[1])]; })), class: "stroke s1", "stroke-width": 3 }, f.inner);
      slots.forEach(function (sl) {
        if (!sl.over) return;
        el("circle", { cx: f.x(sl.h), cy: f.y(sl.w), r: 4.2, class: "dot " + (sl.inBan ? "s1" : "s3") }, f.inner);
      });

      clear(c2);
      var g = V.frame(c2, { x: [5, 19], y: [0, 70], yTicks: [0, 20, 40, 60], xTicks: [6, 8, 10, 12, 14, 16, 18], fmtX: function (v) { return v + ":00"; }, xLabel: "Time of day", yLabel: "°C", margin: { right: 96 } });
      [["tg", "s2", "Globe Tg"], ["ta", "s5", "Air Ta"], ["tnwb", "s4", "Wet bulb Tnwb"]].forEach(function (k) {
        el("path", { d: V.line(comp.map(function (p) { return [g.x(p[0]), g.y(p[1][k[0]])]; })), class: "stroke " + k[1], "stroke-width": 2.2 }, g.inner);
      });
      var last = comp[comp.length - 1][1], labs = [[last.tg, "s2", "Globe Tg"], [last.ta, "s5", "Air Ta"], [last.tnwb, "s4", "Wet bulb Tnwb"]];
      labs.sort(function (a, b) { return b[0] - a[0]; });
      var yPrev = -1e9;
      labs.forEach(function (lb) {
        var yy = Math.max(g.y(lb[0]) + 4, yPrev + 14); yPrev = yy;
        el("text", { x: g.x(19) + 6, y: yy, class: "viz-small viz-bold colour " + lb[1], text: lb[2] }, g.inner);
      });

      out.peak(peak.v.toFixed(1) + " °C at " + hhmm(peak.h));
      out.lim(lim.toFixed(1) + " °C");
      out.above(V.fmt.num(above, 1) + " h");
      out.cov(V.fmt.num(cov, 1) + " h");
      out.unc(V.fmt.num(above - cov, 1) + " h");
    }
    draw();
  });
})();
