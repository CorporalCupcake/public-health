// Lecture 2.19 — Mendelian randomisation simulator: observational vs IVW, MR-Egger and weighted median.
// Simulated summary statistics for 20 SNPs; illustrative numbers. Fixed seed, so only the sliders change results.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

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

  V.register("mr-sim", function (root) {
    var J = 20, N = 50000, R = V.rng(2019);
    var q = [], vg = [], a = [], zX = [], zY = [], zP = [], uP = [], order = [];
    for (var j = 0; j < J; j++) {
      q.push(0.1 + 0.4 * R());
      vg.push(2 * q[j] * (1 - q[j]));
      a.push(0.08 + 0.22 * R());          // per-allele effect of the SNP on the exposure
      zX.push(V.normal(R)); zY.push(V.normal(R)); zP.push(V.normal(R)); uP.push(R());
      order.push(j);
    }
    for (var k = J - 1; k > 0; k--) { var m = Math.floor(R() * (k + 1)), t = order[k]; order[k] = order[m]; order[m] = t; }
    var rank = []; order.forEach(function (jj, i) { rank[jj] = i; });

    var ctr = V.controls(root);
    var sB = V.slider(ctr, { label: "True causal effect of X on Y", min: -0.2, max: 0.5, step: 0.05, value: 0.2, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sC = V.slider(ctr, { label: "Confounding strength (U → X and Y)", min: 0, max: 1, step: 0.1, value: 0.6, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sP = V.slider(ctr, { label: "Pleiotropy: direct SNP → Y effect size", min: 0, max: 0.08, step: 0.01, value: 0, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sS = V.slider(ctr, { label: "Share of SNPs that are pleiotropic", min: 0, max: 100, step: 10, value: 30, fmt: function (v) { return v + "%"; }, onInput: draw });
    var tD = tog(ctr, "Pleiotropy pattern", [{ value: "dir", label: "Directional" }, { value: "bal", label: "Balanced" }], "dir", draw);

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Scenarios:" }, pre);
    [
      ["HDL-like: confounded, no causal effect", [0, 0.8, 0, 30, "dir"]],
      ["30% of SNPs pleiotropic", [0.2, 0.6, 0.05, 30, "dir"]],
      ["70% of SNPs pleiotropic", [0.2, 0.6, 0.05, 70, "dir"]]
    ].forEach(function (p) {
      V.button(pre, p[0], function () { sB.set(p[1][0]); sC.set(p[1][1]); sP.set(p[1][2]); sS.set(p[1][3]); tD.set(p[1][4]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Valid SNP" }, { cls: "s3", label: "Pleiotropic SNP" },
      { cls: "s5", label: "True effect", dashed: true }, { cls: "s2", label: "Observational" },
      { cls: "s1", label: "IVW" }, { cls: "s4", label: "MR-Egger", dashed: true }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Scatter of SNP–exposure effects against SNP–outcome effects, with lines for the true effect, the observational estimate, IVW and MR-Egger");

    var out = V.readouts(root, [
      { key: "truth", label: "True causal effect" },
      { key: "obs", label: "Observational regression of Y on X", cls: "bad" },
      { key: "ivw", label: "IVW (all SNPs assumed valid)", cls: "good" },
      { key: "egger", label: "MR-Egger slope (± SE)" },
      { key: "int", label: "MR-Egger intercept (pleiotropy signal)" },
      { key: "wm", label: "Weighted median" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: simulated GWAS summary statistics for 20 independent SNPs in 50,000 people. Each dot is one SNP, with ±1.96 SE bars for its effect on Y. Ratio estimates are the slope of a line through the origin." }, root);

    function draw() {
      var beta = sB.value(), cc = sC.value(), pl = sP.value(), share = sS.value() / 100, dir = tD.value() === "dir";
      var nInv = Math.round(share * J);
      var p = [], inv = [];
      for (var j = 0; j < J; j++) {
        inv[j] = rank[j] < nInv && pl > 0;
        p[j] = inv[j] ? pl * (dir ? 0.4 + 0.6 * uP[j] : zP[j]) : 0;
      }
      var varX = 1 + cc * cc, covXP = 0;
      for (j = 0; j < J; j++) { varX += a[j] * a[j] * vg[j]; covXP += a[j] * p[j] * vg[j]; }
      var varY = beta * beta * varX + cc * cc + 1 + 2 * beta * cc * cc;
      var obs = beta + (cc * cc + covXP) / varX;

      var gx = [], gy = [], se = [];
      for (j = 0; j < J; j++) {
        var sx = Math.sqrt(varX / (N * vg[j])), sy = Math.sqrt(varY / (N * vg[j]));
        var x = a[j] + sx * zX[j], y = beta * a[j] + p[j] + sy * zY[j];
        if (x < 0) { x = -x; y = -y; }           // orient so each SNP raises the exposure
        gx.push(x); gy.push(y); se.push(sy);
      }
      // IVW (fixed effect, through the origin)
      var swxx = 0, swxy = 0, sw = 0, swx = 0, swy = 0;
      for (j = 0; j < J; j++) { var w = 1 / (se[j] * se[j]); swxx += w * gx[j] * gx[j]; swxy += w * gx[j] * gy[j]; sw += w; swx += w * gx[j]; swy += w * gy[j]; }
      var ivw = swxy / swxx;
      // MR-Egger: weighted regression with intercept
      var mx = swx / sw, my = swy / sw, sxx = 0, sxy = 0;
      for (j = 0; j < J; j++) { w = 1 / (se[j] * se[j]); sxx += w * (gx[j] - mx) * (gx[j] - mx); sxy += w * (gx[j] - mx) * (gy[j] - my); }
      var eg = sxy / sxx, ei = my - eg * mx, rss = 0;
      for (j = 0; j < J; j++) { w = 1 / (se[j] * se[j]); var r = gy[j] - ei - eg * gx[j]; rss += w * r * r; }
      var egSe = Math.sqrt(Math.max(1, rss / (J - 2)) / sxx);
      // Weighted median of ratio estimates (Bowden 2016)
      var rs = [];
      for (j = 0; j < J; j++) { var bj = gy[j] / gx[j], sj = se[j] / gx[j]; rs.push([bj, 1 / (sj * sj)]); }
      rs.sort(function (u, v) { return u[0] - v[0]; });
      var tot = rs.reduce(function (s, u) { return s + u[1]; }, 0), cum = 0, sc = [];
      rs.forEach(function (u) { cum += u[1]; sc.push((cum - u[1] / 2) / tot); });
      var wm = rs[0][0];
      for (j = 0; j < J - 1; j++) if (sc[j] < 0.5 && sc[j + 1] >= 0.5) { wm = rs[j][0] + (rs[j + 1][0] - rs[j][0]) * (0.5 - sc[j]) / (sc[j + 1] - sc[j]); break; }
      if (sc[0] >= 0.5) wm = rs[0][0];

      // --- plot
      clear(c);
      var xmax = Math.max.apply(null, gx) * 1.08;
      var ys = [0];
      for (j = 0; j < J; j++) { ys.push(gy[j] + 1.96 * se[j]); ys.push(gy[j] - 1.96 * se[j]); }
      [beta, obs, ivw].forEach(function (b) { ys.push(b * xmax); });
      ys.push(ei + eg * xmax); ys.push(ei);
      var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = (y1 - y0) * 0.06;
      var f = V.frame(c, { x: [0, xmax], y: [y0 - pad, y1 + pad], fmtX: function (v) { return V.fmt.num(v, 2); }, fmtY: function (v) { return V.fmt.num(v, 2); }, xLabel: "SNP effect on exposure X (γ)", yLabel: "SNP effect on outcome Y (Γ)", margin: { left: 60 } });
      el("line", { x1: f.x(0), x2: f.x(xmax), y1: f.y(0), y2: f.y(0), class: "viz-axis" }, f.inner);
      function ln(i0, b, cls) { el("path", { d: V.line([[f.x(0), f.y(i0)], [f.x(xmax), f.y(i0 + b * xmax)]]), class: cls }, f.inner); }
      ln(0, beta, "stroke dashed s5");
      ln(0, obs, "stroke s2");
      ln(0, ivw, "stroke s1");
      ln(ei, eg, "stroke dashed s4");
      for (j = 0; j < J; j++) {
        el("line", { x1: f.x(gx[j]), x2: f.x(gx[j]), y1: f.y(gy[j] - 1.96 * se[j]), y2: f.y(gy[j] + 1.96 * se[j]), class: "stroke " + (inv[j] ? "s3" : "s5"), style: "stroke-width:1.2;stroke-opacity:0.55" }, f.inner);
        el("circle", { cx: f.x(gx[j]), cy: f.y(gy[j]), r: 4.5, class: "dot " + (inv[j] ? "s3" : "s5") }, f.inner);
      }

      function f2(v) { return V.fmt.signed(v, 2); }
      out.truth(f2(beta));
      out.obs(f2(obs));
      out.ivw(f2(ivw));
      out.egger(f2(eg) + " ± " + V.fmt.num(egSe, 2));
      out.int(V.fmt.signed(ei, 3));
      out.wm(f2(wm));
    }
    draw();
  });
})();
