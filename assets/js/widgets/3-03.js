// Lecture 3.3 — GLMs for rates: (1) why rates need a person-time offset; (2) Poisson vs negative binomial
// under overdispersion (interval width and coverage). Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function seeded(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }

  // Gamma(shape k, scale 1): Marsaglia–Tsang, with the k < 1 boost.
  function rgamma(rand, k) {
    if (k < 1) return rgamma(rand, k + 1) * Math.pow(rand() || 1e-12, 1 / k);
    var d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x = V.normal(rand), v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      var u = rand();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function rpois(rand, mu) {
    if (mu <= 0) return 0;
    if (mu > 60) return Math.max(0, Math.round(mu + Math.sqrt(mu) * V.normal(rand)));
    var L = Math.exp(-mu), k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  // Negative binomial as a gamma–Poisson mixture: variance = mu + k mu^2.
  function rnb(rand, mu, k) {
    if (k <= 0) return rpois(rand, mu);
    return rpois(rand, mu * rgamma(rand, 1 / k) * k);
  }
  function poisPmf(y, mu) { var lp = -mu + y * Math.log(mu); for (var i = 2; i <= y; i++) lp -= Math.log(i); return Math.exp(lp); }

  // ---------------------------------------------------------------------------
  // Offset demo: expected counts, no noise.
  V.register("offset-demo", function (root) {
    var popLow = [400, 250, 150]; // thousands of person-years, low-salt regions
    var shape = [1.4, 1.0, 0.6];   // relative sizes within the high-salt group
    var BASE = 200;                // deaths per 100,000 person-years, low-salt regions

    var ctr = V.controls(root);
    var sPop = V.slider(ctr, { label: "Population of high-salt regions (× low-salt)", min: -1.6, max: 1.6, step: 0.05, value: Math.log(0.3),
      fmt: function (v) { var x = Math.exp(v); return "× " + (x < 1 ? x.toFixed(2) : x.toFixed(1)); }, onInput: draw });
    var sRR = V.slider(ctr, { label: "True rate ratio (high- vs low-salt)", min: 0.6, max: 2.5, step: 0.05, value: 1.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    V.legend(root, [{ cls: "s3", label: "High-salt regions" }, { cls: "s5", label: "Low-salt regions" }]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Two bar charts for six regions: death counts on the left, deaths per 100,000 person-years on the right");
    var out = V.readouts(root, [
      { key: "naive", label: "“Rate ratio” from a model without offset (counts)", cls: "bad" },
      { key: "off", label: "Rate ratio with log(person-years) offset", cls: "good" },
      { key: "true", label: "True rate ratio" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Low-salt regions: 400, 250 and 150 thousand person-years at 200 deaths per 100,000. Expected counts, no random error, so every gap between the two models comes from ignoring person-time." }, root);

    function panel(x0, w, title, vals, cls, fmtV) {
      var top = 44, bot = 250, max = Math.max.apply(null, vals) * 1.18;
      el("text", { x: x0 + w / 2, y: 18, "text-anchor": "middle", class: "viz-bold", text: title }, c);
      el("line", { x1: x0, x2: x0 + w, y1: bot, y2: bot, class: "viz-axis" }, c);
      var bw = w / 6 - 10;
      vals.forEach(function (v, i) {
        var x = x0 + i * (w / 6) + 5 + (i >= 3 ? 0 : 0), h = (bot - top) * v / max;
        el("rect", { x: x, y: bot - h, width: bw, height: h, class: (i < 3 ? "fill s3" : "fill-soft s5") }, c);
        if (i >= 3) el("rect", { x: x, y: bot - h, width: bw, height: h, fill: "none", class: "stroke s5", "stroke-width": 1.5 }, c);
        el("text", { x: x + bw / 2, y: bot - h - 6, "text-anchor": "middle", class: "viz-small", text: fmtV(v) }, c);
        el("text", { x: x + bw / 2, y: bot + 16, "text-anchor": "middle", class: "viz-small viz-muted", text: (i < 3 ? "H" : "L") + ((i % 3) + 1) }, c);
      });
    }

    function draw() {
      var ratio = Math.exp(sPop.value()), rr = sRR.value();
      var popHigh = shape.map(function (s) { return 267 * s * ratio; });
      var pops = popHigh.concat(popLow);
      var rates = [0, 1, 2].map(function () { return BASE * rr; }).concat([BASE, BASE, BASE]);
      var deaths = pops.map(function (p, i) { return p * 1000 * rates[i] / 1e5; });
      clear(c);
      panel(20, 290, "Deaths (counts)", deaths, null, function (v) { return V.fmt.int(v); });
      panel(340, 290, "Deaths per 100,000 person-years", rates, null, function (v) { return V.fmt.int(v); });
      el("text", { x: 165, y: 290, "text-anchor": "middle", class: "viz-small viz-muted", text: "H = high-salt region, L = low-salt region" }, c);
      el("text", { x: 485, y: 290, "text-anchor": "middle", class: "viz-small viz-muted", text: "what the offset model compares" }, c);
      var dH = deaths[0] + deaths[1] + deaths[2], dL = deaths[3] + deaths[4] + deaths[5];
      var pH = pops[0] + pops[1] + pops[2], pL = pops[3] + pops[4] + pops[5];
      out.naive((dH / dL).toFixed(2));
      out.off(((dH / pH) / (dL / pL)).toFixed(2));
      out["true"](rr.toFixed(2));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Overdispersion: 30 + 30 clinics, one year each, true RR 1.5.
  V.register("overdispersion", function (root) {
    var G = 30, RR = 1.5, NSIM = 500, SHOW = 25, seed = 33001;

    var ctr = V.controls(root);
    var sK = V.slider(ctr, { label: "Extra-Poisson variation (1/θ)", min: 0, max: 1.5, step: 0.05, value: 0.4, fmt: function (v) { return v === 0 ? "0 (pure Poisson)" : v.toFixed(2); }, onInput: draw });
    var sMu = V.slider(ctr, { label: "Mean deaths per low-salt clinic", min: 3, max: 30, step: 1, value: 10, onInput: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New simulated data", function () { seed += 7919; draw(); });

    var c1 = V.svg(root, 640, 220);
    c1.setAttribute("aria-label", "Histogram of counts in one simulated dataset, with the counts a Poisson model would expect");
    V.legend(root, [
      { cls: "s1", label: "Interval covers the true rate ratio" },
      { cls: "s3", label: "Interval misses it" },
      { cls: "s5", label: "True rate ratio 1.5", dashed: true }
    ]);
    var c2 = V.svg(root, 640, 300);
    c2.setAttribute("aria-label", "Twenty-five simulated 95% confidence intervals from Poisson and from negative binomial models");
    var out = V.readouts(root, [
      { key: "disp", label: "Dispersion statistic, this dataset (Pearson χ²/df)" },
      { key: "covP", label: "Poisson: coverage of 95% CIs", cls: "bad" },
      { key: "covQ", label: "Quasi-Poisson: coverage" },
      { key: "covN", label: "Negative binomial: coverage", cls: "good" },
      { key: "w", label: "Poisson CI width ÷ NB CI width" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers; 500 simulated studies per setting. Counts are gamma–Poisson (negative binomial). The NB model here estimates θ by the method of moments, a simplification of the usual maximum likelihood fit." }, root);

    function analyse(y0, y1) {
      var s0 = 0, s1 = 0;
      y0.forEach(function (v) { s0 += v; }); y1.forEach(function (v) { s1 += v; });
      var m0 = s0 / G, m1 = s1 / G;
      if (s0 === 0 || s1 === 0) return null;
      var est = Math.log(m1 / m0);
      var seP = Math.sqrt(1 / s0 + 1 / s1);
      var chi = 0, v0 = 0, v1 = 0;
      y0.forEach(function (v) { chi += (v - m0) * (v - m0) / m0; v0 += (v - m0) * (v - m0); });
      y1.forEach(function (v) { chi += (v - m1) * (v - m1) / m1; v1 += (v - m1) * (v - m1); });
      var phi = chi / (2 * G - 2);
      v0 /= (G - 1); v1 /= (G - 1);
      var k = Math.max(0, ((v0 - m0) + (v1 - m1)) / (m0 * m0 + m1 * m1));
      var seN = Math.sqrt((1 / m0 + k) / G + (1 / m1 + k) / G);
      return { est: est, seP: seP, seQ: seP * Math.sqrt(phi), seN: seN, phi: phi };
    }

    function draw() {
      var k = sK.value(), mu0 = sMu.value(), mu1 = mu0 * RR;
      var rand = seeded(seed + Math.round(k * 100) * 31 + mu0 * 1009);
      var sims = [], first = null;
      for (var s = 0; s < NSIM; s++) {
        var y0 = [], y1 = [];
        for (var i = 0; i < G; i++) { y0.push(rnb(rand, mu0, k)); y1.push(rnb(rand, mu1, k)); }
        var a = analyse(y0, y1);
        if (!a) continue;
        if (!first) first = { y: y0.concat(y1), a: a };
        sims.push(a);
      }
      var lt = Math.log(RR), cov = { P: 0, Q: 0, N: 0 }, wP = 0, wN = 0;
      sims.forEach(function (a) {
        if (Math.abs(a.est - lt) <= 1.96 * a.seP) cov.P++;
        if (Math.abs(a.est - lt) <= 1.96 * a.seQ) cov.Q++;
        if (Math.abs(a.est - lt) <= 1.96 * a.seN) cov.N++;
        wP += a.seP; wN += a.seN;
      });

      // Histogram of one dataset vs Poisson expectation (mixture of the two group means)
      clear(c1);
      var ys = first.y, ymax = Math.max.apply(null, ys);
      var hiX = Math.max(Math.ceil(mu1 * 2.2), Math.min(ymax, Math.ceil(mu1 * 4))) + 1;
      var counts = new Array(hiX + 1).fill(0), over = 0;
      ys.forEach(function (v) { if (v > hiX) over++; else counts[v]++; });
      var expd = [];
      for (var x = 0; x <= hiX; x++) expd.push(G * (poisPmf(x, mu0) + poisPmf(x, mu1)));
      var top = Math.max(Math.max.apply(null, counts), Math.max.apply(null, expd)) * 1.15;
      var f = V.frame(c1, { x: [-0.5, hiX + 0.5], y: [0, top], margin: { top: 26, bottom: 40, left: 46 }, xLabel: "Deaths per clinic per year (one simulated dataset of 60 clinics)", yLabel: "Clinics" });
      var bw = (f.x(1) - f.x(0)) * 0.8;
      counts.forEach(function (n, x) {
        if (!n) return;
        el("rect", { x: f.x(x) - bw / 2, y: f.y(n), width: bw, height: f.y(0) - f.y(n), class: "fill-soft s4" }, f.inner);
        el("rect", { x: f.x(x) - bw / 2, y: f.y(n), width: bw, height: f.y(0) - f.y(n), fill: "none", class: "stroke s4", "stroke-width": 1.2 }, f.inner);
      });
      el("path", { d: V.line(expd.map(function (e, x) { return [f.x(x), f.y(e)]; })), class: "stroke s2" }, f.inner);
      var lg = el("text", { x: f.x(hiX + 0.5), y: 14, "text-anchor": "end", class: "viz-small" }, f.inner);
      el("tspan", { class: "colour s4", text: "■ observed" }, lg);
      el("tspan", { class: "colour s2", dx: 14, text: "— what Poisson expects" }, lg);
      if (over) el("tspan", { class: "viz-muted", dx: 14, text: "(" + over + " clinic" + (over > 1 ? "s" : "") + " beyond axis)" }, lg);

      // Interval plot: two panels
      clear(c2);
      var lo = 0.6, hi = 3.2, L = Math.log(lo), H = Math.log(hi);
      [[70, 330, "Poisson", "seP"], [390, 630, "Negative binomial", "seN"]].forEach(function (p) {
        var xs = V.scale(L, H, p[0], p[1]);
        el("text", { x: (p[0] + p[1]) / 2, y: 16, "text-anchor": "middle", class: "viz-bold", text: p[2] }, c2);
        [0.75, 1, 1.5, 2, 3].forEach(function (t) {
          el("line", { x1: xs(Math.log(t)), x2: xs(Math.log(t)), y1: 28, y2: 262, class: "viz-grid" }, c2);
          el("text", { x: xs(Math.log(t)), y: 278, "text-anchor": "middle", class: "viz-tick", text: String(t) }, c2);
        });
        el("line", { x1: xs(lt), x2: xs(lt), y1: 26, y2: 264, class: "stroke s5 dashed", "stroke-width": 1.5 }, c2);
        for (var j = 0; j < SHOW && j < sims.length; j++) {
          var a = sims[j], se = a[p[3]], yy = 36 + j * 9;
          var l = Math.max(L, a.est - 1.96 * se), r = Math.min(H, a.est + 1.96 * se);
          var hit = Math.abs(a.est - lt) <= 1.96 * se;
          el("line", { x1: xs(l), x2: xs(r), y1: yy, y2: yy, class: "stroke " + (hit ? "s1" : "s3"), "stroke-width": 2 }, c2);
          el("circle", { cx: xs(Math.max(L, Math.min(H, a.est))), cy: yy, r: 2.6, class: "dot " + (hit ? "s1" : "s3") }, c2);
        }
      });
      el("text", { x: 350, y: 296, "text-anchor": "middle", class: "viz-label", text: "Rate ratio, high- vs low-salt (log scale): first 25 simulated studies" }, c2);

      var n = sims.length;
      out.disp(first.a.phi.toFixed(2));
      out.covP(V.fmt.pct(cov.P / n));
      out.covQ(V.fmt.pct(cov.Q / n));
      out.covN(V.fmt.pct(cov.N / n));
      out.w("× " + (wP / wN).toFixed(2));
    }
    draw();
  });
})();
