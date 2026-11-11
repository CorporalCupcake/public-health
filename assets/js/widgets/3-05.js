// Lecture 3.5 — Missing data: (1) mechanisms, complete cases vs imputation; (2) Rubin's rules.
// Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function seeded(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  // OLS of y on columns of X (with intercept); returns coefficients and residual SD.
  function ols(cols, y) {
    var p = cols.length + 1, n = y.length, A = [], b = [], i, j, k;
    for (i = 0; i < p; i++) { A.push(new Array(p).fill(0)); b.push(0); }
    for (k = 0; k < n; k++) {
      var row = [1]; for (j = 0; j < cols.length; j++) row.push(cols[j][k]);
      for (i = 0; i < p; i++) { b[i] += row[i] * y[k]; for (j = 0; j < p; j++) A[i][j] += row[i] * row[j]; }
    }
    for (i = 0; i < p; i++) {               // Gauss–Jordan
      var piv = A[i][i];
      for (j = 0; j < p; j++) A[i][j] /= piv; b[i] /= piv;
      for (k = 0; k < p; k++) if (k !== i) { var f = A[k][i]; for (j = 0; j < p; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; }
    }
    var ss = 0;
    for (k = 0; k < n; k++) { var fit = b[0]; for (j = 0; j < cols.length; j++) fit += b[j + 1] * cols[j][k]; ss += (y[k] - fit) * (y[k] - fit); }
    return { b: b, sd: Math.sqrt(ss / Math.max(1, n - p)) };
  }

  // ---------------------------------------------------------------------------
  V.register("missing-mechanisms", function (root) {
    var N = 300, M = 5, REPS = 100, TARGET = 0.4, seed = 35001, sets;
    var MSG = {
      mcar: "MCAR: the complete cases are a random subset. Both estimates are unbiased on average; you only lose precision.",
      x: "MAR on X: the complete-case mean is biased, but the slope is not, because missingness depends only on a covariate in the model.",
      z: "MAR on the auxiliary Z: Z is not in the analysis model, so complete cases bias both the mean and the slope. Imputing with Z included repairs both.",
      y: "MNAR: high BP values hide themselves. Complete cases are biased, and imputation under MAR only partly helps (Z carries some of the missing information)."
    };

    function make(sd) {
      var r = seeded(sd), d = { x: [], z: [], y: [], u: [] }, i, k;
      for (i = 0; i < N; i++) {
        var x = V.normal(r), u = V.normal(r), e = V.normal(r), w = V.normal(r);
        d.x.push(x); d.y.push(120 + 6 * x + 9 * u + 5 * e); d.z.push(0.7 * u + 0.5 * x + 0.5 * w); d.u.push(r());
      }
      d.noise = [];
      for (k = 0; k < M; k++) { var row = []; for (i = 0; i < N; i++) row.push(V.normal(r)); d.noise.push(row); }
      // Standardise Z and BP with their known population values so every sample shares one rule.
      d.zs = d.z.map(function (v) { return v / Math.sqrt(0.99); });
      d.ys = d.y.map(function (v) { return (v - 120) / Math.sqrt(142); });
      d.fullMean = mean(d.y); d.fullSlope = ols([d.x], d.y).b[1];
      return d;
    }
    function build() { sets = []; for (var j = 0; j < REPS; j++) sets.push(make(seed + 101 * j)); }

    function driver(d, m) { return m === "mcar" ? null : m === "x" ? d.x : m === "z" ? d.zs : d.ys; }
    function analyse(d, a, s, m, keep) {
      var drv = driver(d, m), miss = [], ox = [], oz = [], oy = [], i, k;
      for (i = 0; i < N; i++) {
        var p = 1 / (1 + Math.exp(-(a + (drv ? s * drv[i] : 0))));
        miss.push(d.u[i] < p);
        if (!miss[i]) { ox.push(d.x[i]); oz.push(d.z[i]); oy.push(d.y[i]); }
      }
      var cc = ols([ox], oy), im = ols([ox, oz], oy), miMean = 0, miSlope = 0, first = null;
      for (k = 0; k < M; k++) {
        var yy = d.y.map(function (v, j) { return miss[j] ? im.b[0] + im.b[1] * d.x[j] + im.b[2] * d.z[j] + im.sd * d.noise[k][j] : v; });
        if (k === 0 && keep) first = yy;
        miMean += mean(yy) / M; miSlope += ols([d.x], yy).b[1] / M;
      }
      return { miss: miss, cc: cc, ccMean: mean(oy), miMean: miMean, miSlope: miSlope, miInt: miMean - miSlope * mean(d.x), first: first };
    }

    var ctr0 = V.controls(root);
    var mech = V.toggle(ctr0, { options: [{ value: "mcar", label: "MCAR" }, { value: "x", label: "MAR: X" }, { value: "z", label: "MAR: Z" }, { value: "y", label: "MNAR: BP" }], value: "x", onChange: draw });
    var ctr = V.controls(root);
    var sS = V.slider(ctr, { label: "Strength of the mechanism (log-odds per SD)", min: 0, max: 3, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var showImp = V.toggle(ctr, { options: [{ value: 0, label: "Hide imputed" }, { value: 1, label: "Show imputed" }], value: 0, onChange: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "New samples", function () { seed += 7919; build(); draw(); });

    V.legend(root, [{ cls: "s1", label: "Observed" }, { cls: "s5", label: "Missing (true value)" }, { cls: "s2", label: "Imputed (one draw)" }, { cls: "s5", label: "True line", dashed: true }, { cls: "s3", label: "Complete-case line" }]);
    var c = V.svg(root, 640, 320);
    c.setAttribute("aria-label", "Scatter plot of systolic blood pressure against X for one simulated sample, showing observed, missing and imputed values with true, complete-case and imputed regression lines");
    var msg = el("p", { class: "widget-note", style: "margin:0.6rem 0" }, root);
    var out = V.readouts(root, [
      { key: "pm", label: "Share of BP values missing" },
      { key: "ccm", label: "Bias in mean BP, complete cases (mmHg)", cls: "bad" },
      { key: "mim", label: "Bias in mean BP, imputed (mmHg)", cls: "good" },
      { key: "ccs", label: "Bias in slope (true slope 6), complete cases", cls: "bad" },
      { key: "mis", label: "Bias in slope (true slope 6), imputed", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: BP = 120 + 6·X + noise, with Z an auxiliary related to both X and the noise. The plot shows one sample of 300. Each bias compares an estimate with the same sample’s full data before values were removed, averaged over 100 simulated samples so chance wobble cancels. “Imputed” is a simplified MI: 5 stochastic regression imputations of BP from X and Z, estimates averaged." }, root);

    function draw() {
      var s = sS.value(), m = mech.value(), d0 = sets[0], drv = driver(d0, m), k, i;
      function pm(a) { var t = 0; for (var j = 0; j < N; j++) t += 1 / (1 + Math.exp(-(a + (drv ? s * drv[j] : 0)))); return t / N; }
      var lo = -12, hi = 12;
      for (k = 0; k < 50; k++) { var mid = (lo + hi) / 2; if (pm(mid) < TARGET) lo = mid; else hi = mid; }
      var a = (lo + hi) / 2, bias = { ccm: 0, mim: 0, ccs: 0, mis: 0 }, nm = 0, one;
      for (k = 0; k < REPS; k++) {
        var r = analyse(sets[k], a, s, m, k === 0);
        if (k === 0) one = r;
        var dk = sets[k];
        bias.ccm += (r.ccMean - dk.fullMean) / REPS; bias.mim += (r.miMean - dk.fullMean) / REPS;
        bias.ccs += (r.cc.b[1] - dk.fullSlope) / REPS; bias.mis += (r.miSlope - dk.fullSlope) / REPS;
        nm += r.miss.filter(Boolean).length / (REPS * N);
      }

      clear(c);
      var f = V.frame(c, { x: [-3, 3], y: [80, 160], xTicks: [-3, -2, -1, 0, 1, 2, 3], yTicks: [80, 100, 120, 140, 160], margin: { left: 58 }, xLabel: "Covariate X (standardised)", yLabel: "Systolic BP (mmHg)" });
      function cl(v, l, h) { return Math.max(l, Math.min(h, v)); }
      for (i = 0; i < N; i++) {
        var px = f.x(cl(d0.x[i], -3, 3)), py = f.y(cl(d0.y[i], 80, 160));
        if (one.miss[i]) {
          el("circle", { cx: px, cy: py, r: 3, class: "stroke s5", fill: "none", "stroke-width": 1, "stroke-opacity": 0.8 }, f.inner);
          if (showImp.value()) el("circle", { cx: px, cy: f.y(cl(one.first[i], 80, 160)), r: 2.8, class: "dot s2", "fill-opacity": 0.85 }, f.inner);
        } else el("circle", { cx: px, cy: py, r: 2.8, class: "dot s1", "fill-opacity": 0.75 }, f.inner);
      }
      function ln(b0, b1, cls, dash) {
        var o = { x1: f.x(-3), x2: f.x(3), y1: f.y(cl(b0 - 3 * b1, 80, 160)), y2: f.y(cl(b0 + 3 * b1, 80, 160)), class: cls, "stroke-width": 2.5 };
        if (dash) o["stroke-dasharray"] = dash;
        el("line", o, f.inner);
      }
      ln(120, 6, "stroke s5", "7 5");
      ln(one.cc.b[0], one.cc.b[1], "stroke s3");
      if (showImp.value()) ln(one.miInt, one.miSlope, "stroke s2");

      msg.textContent = m === "mcar" || s === 0 ? MSG.mcar : MSG[m];
      out.pm(V.fmt.pct(nm));
      out.ccm(V.fmt.signed(bias.ccm, 1));
      out.mim(V.fmt.signed(bias.mim, 1));
      out.ccs(V.fmt.signed(bias.ccs, 2));
      out.mis(V.fmt.signed(bias.mis, 2));
    }
    build();
    draw();
  });

  // ---------------------------------------------------------------------------
  // Student t quantile (two-sided 95%) for non-integer df: bisection on a Simpson-integrated CDF.
  function lgamma(x) {
    var g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    var s = 1.000000000190015; for (var j = 0; j < 6; j++) s += g[j] / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function tq975(nu) {
    if (!isFinite(nu) || nu > 1e5) return 1.959964;
    var c = Math.exp(lgamma((nu + 1) / 2) - lgamma(nu / 2)) / Math.sqrt(nu * Math.PI);
    function dens(x) { return c * Math.pow(1 + x * x / nu, -(nu + 1) / 2); }
    function half(t) { var n = 400, h = t / n, s = dens(0) + dens(t); for (var i = 1; i < n; i++) s += dens(i * h) * (i % 2 ? 4 : 2); return s * h / 3; }
    var lo = 1.9, hi = 80;
    for (var k = 0; k < 40; k++) { var mid = (lo + hi) / 2; if (half(mid) < 0.475) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  V.register("rubin-rules", function (root) {
    var MAXM = 60, THETA = Math.log(1.3), SE = 0.08, seed = 35101, draws;
    function make() {
      var r = seeded(seed); draws = [];
      for (var i = 0; i < MAXM; i++) draws.push({ z: V.normal(r), w: 1 + 0.06 * V.normal(r) });
    }

    var ctr = V.controls(root);
    var sM = V.slider(ctr, { label: "Number of imputations (m)", min: 2, max: 60, step: 1, value: 10, onInput: draw });
    var sB = V.slider(ctr, { label: "Between-imputation spread, B ÷ W (more missing information →)", min: 0, max: 2, step: 0.05, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(pre, "Redraw imputations", function () { seed += 7919; make(); draw(); });

    V.legend(root, [{ cls: "s5", label: "One imputed dataset" }, { cls: "s1", label: "Pooled (Rubin’s rules)" }, { cls: "s3", label: "Single imputation, analysed as complete" }]);
    var c = V.svg(root, 640, 360);
    c.setAttribute("aria-label", "Hazard ratio estimates and confidence intervals from each imputed dataset, the pooled interval, the single-imputation interval, and a bar splitting total variance into within, between and finite-m parts");
    var out = V.readouts(root, [
      { key: "hr", label: "Pooled hazard ratio (95% CI)", cls: "good" },
      { key: "se", label: "Standard error of log HR: pooled vs single imputation" },
      { key: "lam", label: "Share of variance due to missing data, (1 + 1/m)B ÷ T" },
      { key: "df", label: "Rubin degrees of freedom" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: a Na/K hazard ratio near 1.3 with standard error 0.08 on the log scale in each completed dataset. Up to 20 imputed datasets are drawn; all m are pooled. In the variance bar, the indigo slice is the extra B/m charged for using a finite number of imputations." }, root);

    function draw() {
      var m = sM.value(), ratio = sB.value(), W = SE * SE, sdB = Math.sqrt(ratio * W);
      var est = [], ws = [], i;
      for (i = 0; i < m; i++) { est.push(THETA + sdB * draws[i].z); ws.push(W * draws[i].w * draws[i].w); }
      var qbar = mean(est), wbar = mean(ws), B = 0;
      for (i = 0; i < m; i++) B += (est[i] - qbar) * (est[i] - qbar);
      B = B / (m - 1);
      var T = wbar + (1 + 1 / m) * B, lam = (1 + 1 / m) * B / T;
      var nu = B > 1e-12 ? (m - 1) * Math.pow(1 + wbar / ((1 + 1 / m) * B), 2) : Infinity;
      var tq = tq975(nu), seP = Math.sqrt(T), seS = Math.sqrt(ws[0]);

      clear(c);
      var L = 160, R = 624, lo = Math.log(0.7), hi = Math.log(2.4), xs = V.scale(lo, hi, L, R);
      function X(v) { return xs(Math.max(lo, Math.min(hi, v))); }
      var shown = Math.min(m, 20), gap = Math.min(18, 180 / shown), top = 14 + (180 - gap * shown) / 2;
      [0.8, 1, 1.25, 1.5, 2].forEach(function (h) {
        el("line", { x1: xs(Math.log(h)), x2: xs(Math.log(h)), y1: 10, y2: 256, class: "viz-grid" }, c);
        el("text", { x: xs(Math.log(h)), y: 272, "text-anchor": "middle", class: "viz-tick", text: String(h) }, c);
      });
      el("line", { x1: xs(0), x2: xs(0), y1: 10, y2: 256, class: "stroke s5 dashed", "stroke-width": 1.2 }, c);
      el("text", { x: (L + R) / 2, y: 290, "text-anchor": "middle", class: "viz-label", text: "Hazard ratio (log scale)" }, c);
      el("text", { x: L - 12, y: top + gap * shown / 2, "text-anchor": "end", class: "viz-small", text: "Imputed datasets" }, c);
      el("text", { x: L - 12, y: top + gap * shown / 2 + 15, "text-anchor": "end", class: "viz-small viz-muted", text: m > 20 ? "20 of " + m + " shown" : m + " shown" }, c);
      for (i = 0; i < shown; i++) {
        var y = top + gap * (i + 0.5), h1 = 1.96 * Math.sqrt(ws[i]);
        el("line", { x1: X(est[i] - h1), x2: X(est[i] + h1), y1: y, y2: y, class: "stroke s5", "stroke-width": 1.5, "stroke-opacity": 0.8 }, c);
        el("circle", { cx: X(est[i]), cy: y, r: 2.5, class: "dot s5" }, c);
      }
      [[222, "Pooled", qbar, tq * seP, "s1"], [246, "Single imputation", est[0], 1.96 * seS, "s3"]].forEach(function (r) {
        el("text", { x: L - 12, y: r[0] + 4, "text-anchor": "end", class: "viz-small viz-bold", text: r[1] }, c);
        el("line", { x1: X(r[2] - r[3]), x2: X(r[2] + r[3]), y1: r[0], y2: r[0], class: "stroke " + r[4], "stroke-width": 4, "stroke-linecap": "round" }, c);
        el("circle", { cx: X(r[2]), cy: r[0], r: 5.5, class: "dot " + r[4] }, c);
      });

      // Variance bar
      var by = 312, bw = R - L, parts = [[wbar, "s1", "within"], [B, "s2", "between"], [B / m, "s4", "B/m"]], x0 = L;
      el("text", { x: L - 12, y: by + 13, "text-anchor": "end", class: "viz-small viz-bold", text: "Total variance T" }, c);
      parts.forEach(function (p) {
        var w = bw * p[0] / T;
        if (w <= 0) return;
        el("rect", { x: x0, y: by, width: w, height: 20, class: "fill " + p[1] }, c);
        if (w > 64) el("text", { x: x0 + w / 2, y: by + 38, "text-anchor": "middle", class: "viz-small colour " + p[1], text: p[2] + " " + Math.round(100 * p[0] / T) + "%" }, c);
        x0 += w;
      });

      out.hr(Math.exp(qbar).toFixed(2) + " (" + Math.exp(qbar - tq * seP).toFixed(2) + " to " + Math.exp(qbar + tq * seP).toFixed(2) + ")");
      out.se(seP.toFixed(3) + " vs " + seS.toFixed(3));
      out.lam(V.fmt.pct(lam));
      out.df(isFinite(nu) ? (nu > 9999 ? "> 9,999" : V.fmt.int(nu)) : "∞ (no spread)");
    }
    make();
    draw();
  });
})();
