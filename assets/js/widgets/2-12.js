// Lecture 2.12 — Forest plot (fixed vs random effects, I², τ, prediction interval) and funnel plot.
// Illustrative numbers: the studies are invented, not real GCC surveys.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  // t(0.975) quantiles for df = 1..30 (beyond 30, ~1.96–2.04)
  var T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  function tq(df) { return df < 1 ? NaN : df <= 30 ? T975[df - 1] : 1.96 + 2.4 / df; }

  // Inverse-variance meta-analysis with DerSimonian–Laird τ²
  function meta(y, v) {
    var k = y.length, w = v.map(function (x) { return 1 / x; });
    var sw = w.reduce(function (a, b) { return a + b; }, 0);
    var fe = y.reduce(function (a, yi, i) { return a + w[i] * yi; }, 0) / sw;
    var Q = y.reduce(function (a, yi, i) { return a + w[i] * (yi - fe) * (yi - fe); }, 0);
    var sw2 = w.reduce(function (a, b) { return a + b * b; }, 0);
    var C = sw - sw2 / sw, df = k - 1;
    var tau2 = k > 1 ? Math.max(0, (Q - df) / C) : 0;
    var I2 = Q > df && Q > 0 ? (Q - df) / Q : 0;
    var wr = v.map(function (x) { return 1 / (x + tau2); });
    var swr = wr.reduce(function (a, b) { return a + b; }, 0);
    var re = y.reduce(function (a, yi, i) { return a + wr[i] * yi; }, 0) / swr;
    var seRe = Math.sqrt(1 / swr), seFe = Math.sqrt(1 / sw);
    var pi = k >= 3 ? tq(k - 2) * Math.sqrt(tau2 + seRe * seRe) : NaN;
    return { fe: fe, seFe: seFe, re: re, seRe: seRe, tau2: tau2, I2: I2, Q: Q, w: w, wr: wr, sw: sw, swr: swr, pi: pi };
  }

  // ---------------------------------------------------------------------------
  V.register("forest-re", function (root) {
    var S = [
      { id: "A", n: 150, m: 9.2, sd: 3.8 }, { id: "B", n: 420, m: 10.5, sd: 4.2 },
      { id: "C", n: 90, m: 8.1, sd: 3.5 }, { id: "D", n: 600, m: 11.8, sd: 4.5 },
      { id: "E", n: 60, m: 9.9, sd: 3.9 }, { id: "F", n: 250, m: 12.6, sd: 4.8 },
      { id: "G", n: 1100, m: 10.1, sd: 4.4 }, { id: "H", n: 200, m: 8.8, sd: 3.6 }
    ];
    var CENTRE = 10.2, on = S.map(function () { return true; });

    var ctr = V.controls(root);
    var sk = V.slider(ctr, { label: "True spread between studies (× the example)", min: 0, max: 1.5, step: 0.05, value: 1, fmt: function (v) { return "× " + v.toFixed(2); }, onInput: draw });
    var tg = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
    el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Box sizes and weights" }, tg);
    var model = V.toggle(tg, { options: [{ value: "fe", label: "Fixed effect" }, { value: "re", label: "Random effects" }], value: "re", onChange: draw });

    var bar = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin:0 0 0.6rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Include study:" }, bar);
    var chips = S.map(function (s, i) {
      return V.button(bar, s.id, function () {
        if (on[i] && on.filter(Boolean).length <= 2) return;   // keep at least two studies
        on[i] = !on[i]; draw();
      });
    });

    V.legend(root, [
      { cls: "s5", label: "Fixed-effect mean" },
      { cls: "s1", label: "Random-effects mean" },
      { cls: "s1", label: "Prediction interval", dashed: true },
      { cls: "s2", label: "WHO: under 5 g/day", dashed: true }
    ]);
    var c = V.svg(root, 640, 400);
    c.setAttribute("aria-label", "Forest plot of eight illustrative studies of mean salt intake with fixed-effect and random-effects pooled estimates and a prediction interval");

    var out = V.readouts(root, [
      { key: "fe", label: "Fixed-effect mean (95% CI), g/day" },
      { key: "re", label: "Random-effects mean (95% CI), g/day", cls: "good" },
      { key: "i2", label: "I²: share of spread that is real" },
      { key: "tau", label: "τ: SD of true means, g/day" },
      { key: "pi", label: "95% prediction interval, g/day", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: invented studies, not real GCC data. Uses the simple DerSimonian–Laird τ² and a normal-based CI for the mean; the prediction interval uses a t distribution with k − 2 degrees of freedom." }, root);

    var X0 = 150, X1 = 440, DOM = [4, 16];
    var xs = V.scale(DOM[0], DOM[1], X0, X1);
    function f1(x) { return V.fmt.num(x, 1); }
    function clampX(x) { return Math.max(X0, Math.min(X1, xs(x))); }

    function draw() {
      var k = sk.value(), useRe = model.value() === "re";
      chips.forEach(function (b, i) {
        b.textContent = (on[i] ? "✓ " : "") + S[i].id;
        b.setAttribute("aria-pressed", on[i]);
        b.style.background = on[i] ? "var(--accent)" : "";
        b.style.color = on[i] ? "var(--bg)" : "";
      });
      var rows = S.map(function (s) {
        var y = CENTRE + k * (s.m - CENTRE), se = s.sd / Math.sqrt(s.n);
        return { s: s, y: y, se: se, v: se * se };
      });
      var inc = rows.filter(function (r, i) { return on[i]; });
      var M = meta(inc.map(function (r) { return r.y; }), inc.map(function (r) { return r.v; }));

      clear(c);
      var top = 44, rh = 27;
      // header
      el("text", { x: 8, y: 20, class: "viz-bold", text: "Study" }, c);
      el("text", { x: 120, y: 20, "text-anchor": "end", class: "viz-bold", text: "n" }, c);
      el("text", { x: 452, y: 20, class: "viz-bold", text: "Mean (95% CI)" }, c);
      el("text", { x: 632, y: 20, "text-anchor": "end", class: "viz-bold", text: "Weight" }, c);
      var yEnd = top + S.length * rh + 3 * rh;
      // WHO line and gridlines
      [6, 8, 10, 12, 14].forEach(function (t) { el("line", { x1: xs(t), x2: xs(t), y1: top - 10, y2: yEnd, class: "viz-grid" }, c); });
      el("line", { x1: xs(5), x2: xs(5), y1: top - 14, y2: yEnd, class: "stroke dashed s2" }, c);
      el("text", { x: xs(5) - 4, y: top - 18, "text-anchor": "middle", class: "viz-small colour s2", text: "WHO 5 g" }, c);

      var wsum = useRe ? M.swr : M.sw, j = 0;
      rows.forEach(function (r, i) {
        var yc = top + i * rh + rh / 2, isOn = on[i];
        var cls = isOn ? "viz-small" : "viz-small viz-muted";
        el("text", { x: 8, y: yc + 4, class: cls, text: "Study " + r.s.id }, c);
        el("text", { x: 120, y: yc + 4, "text-anchor": "end", class: cls, text: V.fmt.int(r.s.n) }, c);
        var lo = r.y - 1.96 * r.se, hi = r.y + 1.96 * r.se;
        el("text", { x: 452, y: yc + 4, class: cls, text: f1(r.y) + " (" + f1(lo) + "–" + f1(hi) + ")" }, c);
        if (!isOn) {
          el("line", { x1: clampX(lo), x2: clampX(hi), y1: yc, y2: yc, class: "edge", style: "opacity:0.35" }, c);
          el("text", { x: 632, y: yc + 4, "text-anchor": "end", class: "viz-small viz-muted", text: "excluded" }, c);
          return;
        }
        var w = (useRe ? M.wr[j] : M.w[j]) / wsum; j++;
        el("line", { x1: clampX(lo), x2: clampX(hi), y1: yc, y2: yc, class: "edge strong" }, c);
        var side = 4 + Math.sqrt(w) * 30;
        var g = el("g", { class: useRe ? "s1" : "s5" }, c);
        el("rect", { x: xs(r.y) - side / 2, y: yc - side / 2, width: side, height: side, class: "fill" }, g);
        el("text", { x: 632, y: yc + 4, "text-anchor": "end", class: "viz-small", text: V.fmt.num(w * 100, 1) + "%" }, c);
      });

      function diamond(yc, est, se, cls, label, bold) {
        var lo = est - 1.96 * se, hi = est + 1.96 * se, h = 8;
        var g = el("g", { class: cls }, c);
        el("path", { d: "M" + clampX(lo) + "," + yc + "L" + xs(est) + "," + (yc - h) + "L" + clampX(hi) + "," + yc + "L" + xs(est) + "," + (yc + h) + "Z", class: "fill" }, g);
        el("text", { x: 8, y: yc + 4, class: "viz-small" + (bold ? " viz-bold" : ""), text: label }, c);
        el("text", { x: 452, y: yc + 4, class: "viz-small" + (bold ? " viz-bold" : ""), text: f1(est) + " (" + f1(lo) + "–" + f1(hi) + ")" }, c);
      }
      var yb = top + S.length * rh;
      el("line", { x1: 8, x2: 632, y1: yb, y2: yb, class: "viz-grid" }, c);
      diamond(yb + rh / 2 + 2, M.fe, M.seFe, "s5", "Fixed effect", !useRe);
      diamond(yb + rh * 1.5 + 2, M.re, M.seRe, "s1", "Random effects", useRe);
      var ypi = yb + rh * 2.5 + 2;
      el("text", { x: 8, y: ypi + 4, class: "viz-small", text: "Prediction interval" }, c);
      if (isFinite(M.pi)) {
        var plo = M.re - M.pi, phi = M.re + M.pi;
        el("line", { x1: clampX(plo), x2: clampX(phi), y1: ypi, y2: ypi, class: "stroke dashed s1" }, c);
        [plo, phi].forEach(function (p) { if (xs(p) >= X0 && xs(p) <= X1) el("line", { x1: xs(p), x2: xs(p), y1: ypi - 5, y2: ypi + 5, class: "stroke s1" }, c); });
        el("text", { x: 452, y: ypi + 4, class: "viz-small", text: f1(plo) + " to " + f1(phi) }, c);
      } else {
        el("text", { x: 452, y: ypi + 4, class: "viz-small viz-muted", text: "needs 3+ studies" }, c);
      }
      // axis
      var ya = yEnd + 6;
      el("line", { x1: X0, x2: X1, y1: ya, y2: ya, class: "viz-axis" }, c);
      [4, 6, 8, 10, 12, 14, 16].forEach(function (t) { el("text", { x: xs(t), y: ya + 16, "text-anchor": "middle", class: "viz-tick", text: t }, c); });
      el("text", { x: (X0 + X1) / 2, y: ya + 34, "text-anchor": "middle", class: "viz-label", text: "Mean salt intake from 24-hour urine (g/day)" }, c);

      out.fe(f1(M.fe) + " (" + f1(M.fe - 1.96 * M.seFe) + "–" + f1(M.fe + 1.96 * M.seFe) + ")");
      out.re(f1(M.re) + " (" + f1(M.re - 1.96 * M.seRe) + "–" + f1(M.re + 1.96 * M.seRe) + ")");
      out.i2(Math.round(M.I2 * 100) + "%");
      out.tau(V.fmt.num(Math.sqrt(M.tau2), 2));
      out.pi(isFinite(M.pi) ? f1(M.re - M.pi) + " to " + f1(M.re + M.pi) : "–");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Funnel plot: simulated trials of one true effect; small null trials can go missing.
  V.register("funnel", function (root) {
    var TRUE = -1, NSTUDY = 70, r = V.rng(21);
    var trials = [];
    for (var i = 0; i < NSTUDY; i++) {
      var perArm = Math.round(Math.exp(Math.log(10) + r() * (Math.log(300) - Math.log(10))));
      var se = 12 * Math.sqrt(2 / perArm);
      var est = TRUE + se * V.normal(r);
      var z = est / se, sig = z < -1.96;
      // file drawer: trials without a significant benefit are published only 20% of the time
      var pub = sig || se <= 0.9 || r() < 0.2;
      trials.push({ se: se, est: est, pub: pub });
    }

    var ctr = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem 1.2rem;align-items:center;margin:0.2rem 0 0.8rem" }, root);
    var mode = V.toggle(ctr, { options: [{ value: "all", label: "Every trial published" }, { value: "drawer", label: "Most null trials stay in the drawer" }], value: "all", onChange: draw });

    V.legend(root, [
      { cls: "s1", label: "Published trial" },
      { cls: "s5", label: "Unpublished trial (hidden from the reviewer)" },
      { cls: "s3", label: "Pooled estimate from published trials" },
      { cls: "s2", label: "True effect", dashed: true }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Funnel plot of trial estimates against standard error");
    var out = V.readouts(root, [
      { key: "k", label: "Trials the reviewer can see" },
      { key: "pooled", label: "Pooled effect from visible trials (mmHg)", cls: "bad" },
      { key: "truth", label: "True effect (mmHg)", cls: "good" },
      { key: "egger", label: "Egger intercept (0 = symmetric)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative simulation: 70 trials, true effect −1 mmHg, fixed seed. In the drawer version, trials without a significant benefit are published only 1 time in 5. Negative values mean lower blood pressure (benefit). The funnel lines are ±1.96 SE around the visible pooled estimate." }, root);

    function draw() {
      var drawer = mode.value() === "drawer";
      var vis = trials.filter(function (t) { return !drawer || t.pub; });
      var sw = 0, swy = 0;
      vis.forEach(function (t) { var w = 1 / (t.se * t.se); sw += w; swy += w * t.est; });
      var pooled = swy / sw;
      // Egger: regress est/se on 1/se; intercept
      var n = vis.length, mx = 0, my = 0;
      vis.forEach(function (t) { mx += 1 / t.se; my += t.est / t.se; }); mx /= n; my /= n;
      var sxx = 0, sxy = 0;
      vis.forEach(function (t) { var dx = 1 / t.se - mx; sxx += dx * dx; sxy += dx * (t.est / t.se - my); });
      var intercept = my - (sxy / sxx) * mx;

      clear(c);
      var f = V.frame(c, { x: [-16, 10], y: [5.6, 0], xLabel: "Effect on systolic BP (mmHg)", yLabel: "Standard error (bigger trials at top)", yTicks: [0, 1, 2, 3, 4, 5], margin: { left: 56 } });
      var g = f.inner;
      // funnel
      el("path", { d: V.line([[f.x(pooled - 1.96 * 5.6), f.y(5.6)], [f.x(pooled), f.y(0)], [f.x(pooled + 1.96 * 5.6), f.y(5.6)]]), class: "edge" }, g);
      el("line", { x1: f.x(TRUE), x2: f.x(TRUE), y1: f.y(0), y2: f.y(5.6), class: "stroke dashed s2" }, g);
      el("line", { x1: f.x(pooled), x2: f.x(pooled), y1: f.y(0), y2: f.y(5.6), class: "stroke s3" }, g);
      el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(0), y2: f.y(5.6), class: "viz-grid" }, g);
      el("text", { x: f.x(0) + 4, y: f.y(5.4), class: "viz-small viz-muted", text: "no effect" }, g);
      trials.forEach(function (t) {
        var hidden = drawer && !t.pub;
        var x = Math.max(-16, Math.min(10, t.est));
        el("circle", { cx: f.x(x), cy: f.y(t.se), r: 4.5, class: hidden ? "s5" : "dot s1", style: hidden ? "fill:none;stroke:var(--sc);stroke-width:1.5;stroke-dasharray:2 2" : null }, g);
      });

      out.k(vis.length + " of " + trials.length);
      out.pooled(V.fmt.signed(pooled, 2));
      out.truth(V.fmt.signed(TRUE, 1));
      out.egger(V.fmt.signed(intercept, 2));
    }
    draw();
  });
})();
