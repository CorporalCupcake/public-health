// Lecture 6.9 — Lag–response with harvesting and cumulative effects; J-curve to attributable deaths. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function stream(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }

  // ---------------------------------------------------------------------------
  // Lag–response after a single hot or cold day. Effects on the log scale, shown as % change in deaths.
  var LMAX = 21;
  var PRESETS = {
    heat: { a: 12, p: 0, tau: 1, h: 40 },
    cold: { a: 2.5, p: 2, tau: 8, h: 0 }
  };

  function lagCurve(a, p, tau, h) {
    var gross = [], w = [], net = [], l, sumG = 0, sumW = 0;
    for (l = 0; l <= LMAX; l++) {
      var b = l <= p ? a * (l + 1) / (p + 1) : a * Math.exp(-(l - p) / tau);
      gross.push(b); sumG += b;
      var u = l - p - 1, ww = u > 0 ? u * Math.exp(-u / 3) : 0;
      w.push(ww); sumW += ww;
    }
    for (l = 0; l <= LMAX; l++) net.push(gross[l] - (sumW > 0 ? h / 100 * sumG * w[l] / sumW : 0));
    return { gross: gross, net: net };
  }
  function cum(arr, L) { var s = 0; for (var l = 0; l <= L; l++) s += arr[l]; return (Math.exp(s / 100) - 1) * 100; }

  V.register("lag-explorer", function (root) {
    var ctr = V.controls(root), sliders = {};
    V.toggle(ctr, { options: [{ value: "heat", label: "Hot day" }, { value: "cold", label: "Cold day" }], value: "heat", onChange: function (v) {
      var p = PRESETS[v]; sliders.a.set(p.a); sliders.p.set(p.p); sliders.tau.set(p.tau); sliders.h.set(p.h); draw();
    } });
    sliders.L = V.slider(ctr, { label: "Maximum lag in the model (days)", min: 0, max: 21, step: 1, value: 21, fmt: function (v) { return v.toFixed(0); }, onInput: draw });
    sliders.a = V.slider(ctr, { label: "Peak extra risk (% more deaths that day)", min: 0, max: 20, step: 0.5, value: 12, fmt: function (v) { return v.toFixed(1) + "%"; }, onInput: draw });
    sliders.p = V.slider(ctr, { label: "Lag of the peak (days)", min: 0, max: 7, step: 1, value: 0, fmt: function (v) { return v.toFixed(0); }, onInput: draw });
    sliders.tau = V.slider(ctr, { label: "How slowly the effect fades (days)", min: 0.5, max: 10, step: 0.5, value: 1, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    sliders.h = V.slider(ctr, { label: "Harvesting: share of early excess later displaced", min: 0, max: 100, step: 5, value: 40, fmt: function (v) { return v.toFixed(0) + "%"; }, onInput: draw });

    V.legend(root, [{ cls: "s3", label: "Extra deaths at that lag" }, { cls: "s1", label: "Deficit (harvesting)" }, { cls: "s5", label: "Lags outside the model (shaded)" }]);
    var c = V.svg(root, 640, 230);
    c.setAttribute("aria-label", "Bar chart of the percent change in deaths at each lag from 0 to 21 days after one hot or cold day");
    var c2 = V.svg(root, 640, 200);
    c2.setAttribute("aria-label", "Cumulative percent change in deaths when the model includes lags 0 up to each maximum lag");
    var out = V.readouts(root, [
      { key: "l01", label: "Effect over lags 0–1" },
      { key: "cumL", label: "Cumulative effect, lags 0 to your maximum", cls: "good" },
      { key: "full", label: "True cumulative effect, lags 0–21" },
      { key: "miss", label: "Missed or overstated by your lag choice", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Each bar is the percent change in deaths on that day caused by one hot (or cold) day at lag 0, against a day at the minimum-mortality temperature. The cumulative effect adds the lags on the log scale; it is the number a DLNM's overall curve reports." }, root);

    function draw() {
      var L = sliders.L.value(), d = lagCurve(sliders.a.value(), sliders.p.value(), sliders.tau.value(), sliders.h.value()), l;
      var lo = Math.min(-4, Math.floor(Math.min.apply(null, d.net) - 0.5)), hi = Math.max(4, Math.ceil(Math.max.apply(null, d.gross) + 0.5));
      clear(c);
      var f = V.frame(c, { x: [-0.6, LMAX + 0.6], y: [lo, hi], xTicks: [0, 3, 7, 10, 14, 21], fmtX: function (v) { return v.toFixed(0); }, fmtY: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "%"; }, xLabel: "Lag (days after the hot or cold day)", yLabel: "Change in deaths" });
      if (L < LMAX) el("rect", { x: f.x(L + 0.5), y: f.y(hi), width: f.x(LMAX + 0.6) - f.x(L + 0.5), height: f.y(lo) - f.y(hi), class: "fill-soft s5" }, f.inner);
      el("line", { x1: f.x(-0.6), x2: f.x(LMAX + 0.6), y1: f.y(0), y2: f.y(0), class: "viz-axis" }, f.inner);
      var bw = (f.x(1) - f.x(0)) * 0.7;
      for (l = 0; l <= LMAX; l++) {
        var v = d.net[l], y0 = f.y(0), y1 = f.y(v);
        el("rect", { x: f.x(l) - bw / 2, y: Math.min(y0, y1), width: bw, height: Math.max(0.5, Math.abs(y1 - y0)), class: "fill " + (v >= 0 ? "s3" : "s1"), opacity: l > L ? 0.35 : 1 }, f.inner);
      }

      clear(c2);
      var cs = [], mn = 0, mx = 0;
      for (l = 0; l <= LMAX; l++) { var cv = cum(d.net, l); cs.push(cv); mn = Math.min(mn, cv); mx = Math.max(mx, cv); }
      var ylo = Math.floor(mn / 5) * 5, yhi = Math.max(5, Math.ceil(mx / 5) * 5);
      var g = V.frame(c2, { x: [0, LMAX], y: [ylo, yhi], xTicks: [0, 3, 7, 10, 14, 21], fmtX: function (v) { return v.toFixed(0); }, fmtY: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "%"; }, xLabel: "Maximum lag included in the model", yLabel: "Cumulative change" });
      el("line", { x1: g.x(0), x2: g.x(LMAX), y1: g.y(0), y2: g.y(0), class: "viz-axis" }, g.inner);
      el("path", { d: V.line(cs.map(function (v, i) { return [g.x(i), g.y(v)]; })), class: "stroke s4" }, g.inner);
      el("line", { x1: g.x(L), x2: g.x(L), y1: g.y(yhi), y2: g.y(ylo), class: "stroke s5 dashed", "stroke-width": 1.5 }, g.inner);
      el("circle", { cx: g.x(L), cy: g.y(cs[L]), r: 5, class: "dot s4" }, g.inner);
      var right = L > 14;
      el("text", { x: g.x(L) + (right ? -8 : 8), y: g.y(yhi) + 14, "text-anchor": right ? "end" : "start", class: "viz-small viz-muted", text: "your model: lags 0–" + L }, g.inner);

      var full = cs[LMAX];
      out.l01(V.fmt.signed(cs[Math.min(1, LMAX)], 1) + "%");
      out.cumL(V.fmt.signed(cs[L], 1) + "%");
      out.full(V.fmt.signed(full, 1) + "%");
      out.miss(V.fmt.signed(cs[L] - full, 1) + " points");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // J-curve to attributable deaths in an illustrative hot-climate city.
  var YEARS = 10, BASE = 20;
  var TEMPS = (function () {
    var r = stream(690001), t = [], e = 0;
    for (var d = 0; d < 365 * YEARS; d++) {
      e = 0.7 * e + 1.1 * V.normal(r);
      t.push(27 + 10.5 * Math.sin(2 * Math.PI * ((d % 365) - 110) / 365) + e);
    }
    return t;
  })();
  var SORTED = TEMPS.slice().sort(function (a, b) { return a - b; });
  function pct(p) { return SORTED[Math.min(SORTED.length - 1, Math.floor(p / 100 * SORTED.length))]; }

  V.register("attrib-curve", function (root) {
    var ctr = V.controls(root);
    var sM = V.slider(ctr, { label: "MMT as a percentile of local temperature", min: 50, max: 95, step: 1, value: 80, fmt: function (v) { return v.toFixed(0) + "th"; }, onInput: draw });
    var sH = V.slider(ctr, { label: "Heat: RR at 5 °C above the MMT", min: 1, max: 1.5, step: 0.01, value: 1.15, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sC = V.slider(ctr, { label: "Cold: RR at 10 °C below the MMT", min: 1, max: 1.5, step: 0.01, value: 1.08, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    V.legend(root, [{ cls: "s3", label: "Heat side (above MMT)" }, { cls: "s1", label: "Cold side (below MMT)" }, { cls: "s5", label: "MMT", dashed: true }]);
    var c = V.svg(root, 640, 220);
    c.setAttribute("aria-label", "Cumulative relative risk of death against daily mean temperature, lowest at the MMT");
    var c2 = V.svg(root, 640, 210);
    c2.setAttribute("aria-label", "Attributable deaths per year in each 1 degree temperature band");
    var out = V.readouts(root, [
      { key: "mmt", label: "MMT (°C)" },
      { key: "heat", label: "Heat-attributable deaths per year", cls: "bad" },
      { key: "cold", label: "Cold-attributable deaths per year" },
      { key: "af", label: "Attributable fraction, all non-optimal temperature" },
      { key: "ext", label: "Share from extreme days (below 2.5th or above 97.5th pct)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Ten years of simulated daily mean temperatures for a Gulf-like city (roughly 12–41 °C) and 20 deaths a day at the MMT. The curve shapes are assumed, not estimated. Attributable deaths on each day = deaths × (1 − 1/RR)." }, root);

    var T0 = 12, T1 = 42;
    function draw() {
      var mmt = pct(sM.value()), lh = Math.log(sH.value()), lc = Math.log(sC.value());
      function rr(t) { return t >= mmt ? Math.exp(lh * Math.pow((t - mmt) / 5, 2)) : Math.exp(lc * Math.pow((mmt - t) / 10, 1.5)); }
      var p025 = pct(2.5), p975 = pct(97.5), bins = {}, heat = 0, cold = 0, ext = 0, tot = 0, i;
      for (i = 0; i < TEMPS.length; i++) {
        var t = TEMPS[i], R = rr(t), deaths = BASE * R, an = deaths * (1 - 1 / R), b = Math.floor(t);
        tot += deaths;
        if (t >= mmt) heat += an; else cold += an;
        if (t < p025 || t > p975) ext += an;
        if (!bins[b]) bins[b] = { an: 0, days: 0, hot: (b + 0.5) >= mmt };
        bins[b].an += an / YEARS; bins[b].days++;
      }

      clear(c);
      var ymax = Math.max(1.6, Math.ceil(rr(T1) * 10) / 10);
      ymax = Math.min(ymax, 3);
      var f = V.frame(c, { x: [T0, T1], y: [0.9, ymax], xTicks: [15, 20, 25, 30, 35, 40], fmtX: function (v) { return v + ""; }, fmtY: function (v) { return v.toFixed(1); }, xLabel: "Daily mean temperature (°C)", yLabel: "Relative risk" });
      var cold_pts = [], hot_pts = [];
      for (var x = T0; x <= T1 + 1e-9; x += 0.1) {
        var y = Math.min(ymax, rr(x));
        (x < mmt ? cold_pts : hot_pts).push([f.x(x), f.y(y)]);
      }
      el("line", { x1: f.x(T0), x2: f.x(T1), y1: f.y(1), y2: f.y(1), class: "viz-grid" }, f.inner);
      el("path", { d: V.line(cold_pts), class: "stroke s1" }, f.inner);
      el("path", { d: V.line(hot_pts), class: "stroke s3" }, f.inner);
      el("line", { x1: f.x(mmt), x2: f.x(mmt), y1: f.y(ymax), y2: f.y(0.9), class: "stroke s5 dashed", "stroke-width": 1.5 }, f.inner);
      var lft = mmt > 36;
      el("text", { x: f.x(mmt) + (lft ? -6 : 6), y: f.y(0.9) - 8, "text-anchor": lft ? "end" : "start", class: "viz-small viz-muted", text: "MMT " + mmt.toFixed(1) + " °C" }, f.inner);

      clear(c2);
      var keys = Object.keys(bins).map(Number).sort(function (a, b) { return a - b; }), amax = 0;
      keys.forEach(function (k) { amax = Math.max(amax, bins[k].an); });
      amax = Math.max(5, Math.ceil(amax / 5) * 5);
      var g = V.frame(c2, { x: [T0, T1], y: [0, amax], xTicks: [15, 20, 25, 30, 35, 40], fmtX: function (v) { return v + ""; }, fmtY: function (v) { return v.toFixed(0); }, xLabel: "Daily mean temperature (°C), 1 °C bands", yLabel: "Deaths per year" });
      keys.forEach(function (k) {
        var b = bins[k], x0 = g.x(k) + 1, w = g.x(k + 1) - g.x(k) - 2;
        el("rect", { x: x0, y: g.y(b.an), width: w, height: g.y(0) - g.y(b.an), class: "fill " + (b.hot ? "s3" : "s1") }, g.inner);
      });
      el("line", { x1: g.x(mmt), x2: g.x(mmt), y1: g.y(amax), y2: g.y(0), class: "stroke s5 dashed", "stroke-width": 1.5 }, g.inner);

      out.mmt(mmt.toFixed(1));
      out.heat(V.fmt.int(heat / YEARS));
      out.cold(V.fmt.int(cold / YEARS));
      out.af(V.fmt.pct1((heat + cold) / tot));
      out.ext(V.fmt.pct((ext) / Math.max(1e-9, heat + cold)));
    }
    draw();
  });
})();
