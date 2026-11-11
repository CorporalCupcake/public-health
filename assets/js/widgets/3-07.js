// Lecture 3.7 — Competing risks: 1 − KM vs the Aalen–Johansen cumulative incidence (simulated cohort),
// and how a treatment that only prevents the competing event raises the cumulative incidence of the event of interest.
// Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }
  function pctAuto(p) { return p < 0.1 ? (p * 100).toFixed(1) + "%" : Math.round(p * 100) + "%"; }
  function niceMax(v) { var s = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1]; for (var i = 0; i < s.length; i++) if (v <= s[i]) return s[i]; return 1; }

  // ---------------------------------------------------------------------------
  V.register("cr-sim", function (root) {
    var N = 4000, TMAX = 20, T_READ = 15, seed = 370001, U = [];
    (function () { var r = stream(seed); for (var i = 0; i < N; i++) U.push([r(), r(), r()]); })();

    var ctr = V.controls(root);
    var s1 = V.slider(ctr, { label: "CVD death rate (per 1,000 person-years)", min: 1, max: 50, step: 1, value: 8, onInput: draw });
    var s2 = V.slider(ctr, { label: "Non-CVD death rate (the competing event)", min: 0, max: 100, step: 1, value: 20, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Younger cohort, few deaths", 3, 7], ["Older cohort, many deaths", 25, 45], ["Competing deaths dominate", 5, 60], ["No competing deaths", 8, 0]].forEach(function (p) {
      V.button(pre, p[0], function () { s1.set(p[1]); s2.set(p[2]); draw(); });
    });

    V.legend(root, [
      { cls: "s3", label: "1 − KM for CVD death (wrong)", dashed: true },
      { cls: "s3", label: "Cumulative incidence of CVD death (Aalen–Johansen)" },
      { cls: "s5", label: "Cumulative incidence of non-CVD death" },
      { cls: "s4", label: "Any death (sum of the two)" }
    ]);
    var c = V.svg(root, 640, 340);
    c.setAttribute("aria-label", "Cumulative probability of death over 20 years: the 1 minus Kaplan-Meier curve for cardiovascular death lies above the correct cumulative incidence curve, with the gap shaded");

    var out = V.readouts(root, [
      { key: "km", label: "1 − KM for CVD death at 15 years", cls: "bad" },
      { key: "cif", label: "Cumulative incidence of CVD death at 15 years", cls: "good" },
      { key: "gap", label: "How much 1 − KM overstates it" },
      { key: "sum", label: "The two 1 − KM curves added up vs actual risk of any death" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 4,000 simulated adults with constant cause-specific death rates. Follow-up ends between 5 and 20 years after the exam (as when NHANES cycles from different years are followed to the same end date), so there is also administrative censoring." }, root);

    function draw() {
      var l1 = s1.value() / 1000, l2 = s2.value() / 1000;
      var D = [];
      for (var i = 0; i < N; i++) {
        var u = U[i], T1 = -Math.log(u[0]) / l1, T2 = l2 > 0 ? -Math.log(u[1]) / l2 : Infinity, A = 5 + 15 * u[2];
        var t = Math.min(T1, T2, A);
        D.push({ t: t, s: t === A ? 0 : t === T1 ? 1 : 2 });
      }
      D.sort(function (a, b) { return a.t - b.t; });
      var S = 1, K1 = 1, K2 = 1, F1 = 0, F2 = 0, pts = [[0, 1, 1, 0, 0]];
      for (var j = 0; j < N; j++) {
        var n = N - j, r = D[j];
        if (r.s === 1) { F1 += S / n; K1 *= 1 - 1 / n; }
        if (r.s === 2) { F2 += S / n; K2 *= 1 - 1 / n; }
        if (r.s) { S *= 1 - 1 / n; pts.push([r.t, K1, K2, F1, F2]); }
      }
      function at(t) { var p = pts[0]; for (var k = 0; k < pts.length && pts[k][0] <= t; k++) p = pts[k]; return p; }

      var e = at(TMAX), ymax = niceMax(Math.max(1 - e[1], e[3] + e[4]) * 1.08);
      clear(c);
      var f = V.frame(c, { x: [0, TMAX], y: [0, ymax], fmtY: V.fmt.pct, xLabel: "Years since the exam", yLabel: "Cumulative probability" });
      // evaluate on a grid (step functions drawn as fine polylines)
      var G = [];
      for (var g = 0; g <= 400; g++) G.push(at(TMAX * g / 400).concat([TMAX * g / 400]));
      var kmLine = G.map(function (p) { return [f.x(p[5]), f.y(1 - p[1])]; });
      var cifLine = G.map(function (p) { return [f.x(p[5]), f.y(p[3])]; });
      el("path", { d: V.area(kmLine, cifLine), class: "fill-soft s3" }, f.inner);
      el("path", { d: V.line(G.map(function (p) { return [f.x(p[5]), f.y(p[3] + p[4])]; })), class: "stroke s4", "stroke-width": 1.8 }, f.inner);
      el("path", { d: V.line(G.map(function (p) { return [f.x(p[5]), f.y(p[4])]; })), class: "stroke s5" }, f.inner);
      el("path", { d: V.line(cifLine), class: "stroke s3" }, f.inner);
      el("path", { d: V.line(kmLine), class: "stroke dashed s3" }, f.inner);
      el("line", { x1: f.x(T_READ), x2: f.x(T_READ), y1: f.y(0), y2: f.y(ymax), class: "viz-grid", "stroke-dasharray": "4 4" }, f.inner);

      var r15 = at(T_READ), km1 = 1 - r15[1], cif1 = r15[3], km2 = 1 - r15[2], all = r15[3] + r15[4];
      out.km(pctAuto(km1));
      out.cif(pctAuto(cif1));
      out.gap(cif1 > 0 ? "+" + ((km1 - cif1) * 100).toFixed(1) + " points (" + Math.round((km1 / cif1 - 1) * 100) + "% too high)" : "–");
      out.sum(pctAuto(km1 + km2) + " vs " + pctAuto(all));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Constant cause-specific hazards, so everything is closed-form.
  V.register("cr-treat", function (root) {
    var TMAX = 20, T_READ = 15;
    var ctr = V.controls(root);
    var s1 = V.slider(ctr, { label: "CVD death rate, untreated (per 1,000 person-years)", min: 2, max: 40, step: 1, value: 10, onInput: draw });
    var s2 = V.slider(ctr, { label: "Non-CVD death rate, untreated (per 1,000 person-years)", min: 2, max: 80, step: 1, value: 40, onInput: draw });
    var h1 = V.slider(ctr, { label: "Treatment’s cause-specific HR for CVD death", min: 0.5, max: 1.2, step: 0.05, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var h2 = V.slider(ctr, { label: "Treatment’s cause-specific HR for non-CVD death", min: 0.3, max: 1.2, step: 0.05, value: 0.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Only prevents non-CVD deaths", 1, 0.5], ["Only prevents CVD deaths", 0.7, 1], ["Prevents both a little", 0.85, 0.85], ["No effect", 1, 1]].forEach(function (p) {
      V.button(pre, p[0], function () { h1.set(p[1]); h2.set(p[2]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Untreated: CVD death" }, { cls: "s1", label: "Treated: CVD death" },
      { cls: "s5", label: "Untreated: non-CVD death", dashed: true }, { cls: "s1", label: "Treated: non-CVD death", dashed: true }
    ]);
    var c = V.svg(root, 640, 320);
    c.setAttribute("aria-label", "Cumulative incidence of cardiovascular and non-cardiovascular death over 20 years, untreated against treated");

    var out = V.readouts(root, [
      { key: "csh", label: "Cause-specific HR for CVD death (aetiology)" },
      { key: "risk", label: "15-year CVD death risk: untreated vs treated" },
      { key: "diff", label: "Change in 15-year CVD death risk" },
      { key: "shr", label: "Subdistribution HR for CVD death (approx., from 15-year risks)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers, no sampling error. The subdistribution HR is not constant over time when cause-specific hazards are; the value shown is the ratio of cumulative subdistribution hazards at 15 years, roughly what a Fine–Gray model fitted to this follow-up would report." }, root);

    function cif(a, b, t) { var s = a + b; return s > 0 ? a / s * (1 - Math.exp(-s * t)) : 0; }

    function draw() {
      var a0 = s1.value() / 1000, b0 = s2.value() / 1000, a1 = a0 * h1.value(), b1 = b0 * h2.value();
      var ymax = niceMax(Math.max(cif(a0, b0, TMAX), cif(a1, b1, TMAX), cif(b0, a0, TMAX), cif(b1, a1, TMAX)) * 1.1);
      clear(c);
      var f = V.frame(c, { x: [0, TMAX], y: [0, ymax], fmtY: V.fmt.pct, xLabel: "Years", yLabel: "Cumulative incidence" });
      function curve(a, b) { var p = []; for (var k = 0; k <= 200; k++) { var t = TMAX * k / 200; p.push([f.x(t), f.y(cif(a, b, t))]); } return p; }
      el("path", { d: V.line(curve(b0, a0)), class: "stroke dashed s5", "stroke-width": 1.8 }, f.inner);
      el("path", { d: V.line(curve(b1, a1)), class: "stroke dashed s1", "stroke-width": 1.8 }, f.inner);
      el("path", { d: V.line(curve(a0, b0)), class: "stroke s5" }, f.inner);
      el("path", { d: V.line(curve(a1, b1)), class: "stroke s1" }, f.inner);
      el("line", { x1: f.x(T_READ), x2: f.x(T_READ), y1: f.y(0), y2: f.y(ymax), class: "viz-grid", "stroke-dasharray": "4 4" }, f.inner);

      var r0 = cif(a0, b0, T_READ), r1 = cif(a1, b1, T_READ);
      out.csh(h1.value().toFixed(2));
      out.risk(pctAuto(r0) + " vs " + pctAuto(r1));
      out.diff(V.fmt.signed((r1 - r0) * 100, 1) + " points");
      out.shr((Math.log(1 - r1) / Math.log(1 - r0)).toFixed(2));
    }
    draw();
  });
})();
