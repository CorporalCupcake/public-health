// Lecture 4.10 — Mediation: true natural direct/indirect effects vs the "difference method" (c − c′).
// Linear structural model, exposure randomised (think of a salt feeding trial):
//   M (systolic BP above 120, mmHg) = 10 + α·A + 6κ·U + noise(SD 8)
//   Y (10-year CVD risk, %) = base + γ·A + β·M + δ·A·M + 2κ·U + noise
// U is an unmeasured mediator–outcome confounder. Population values computed exactly (no sampling noise).
// True NDE = γ + δ·10 (BP held at its no-extra-salt level); true NIE = (β + δ)·α.
// Illustrative numbers.
Viz.register("mediation-decomp", function (root) {
  var V = Viz, el = V.el, M0 = 10, SM = 8;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function compute(a, b, g, d, k) {
    var kM = 6 * k, kY = 2 * k;
    var VA = 0.25, CAM = 0.25 * a, VM = 0.25 * a * a + kM * kM + SM * SM;
    var CAAM = 0.25 * (M0 + a);
    var EAM2 = 0.5 * ((M0 + a) * (M0 + a) + kM * kM + SM * SM), EM = M0 + 0.5 * a, EAM = 0.5 * (M0 + a);
    var CMAM = EAM2 - EM * EAM;
    var CAY = g * VA + b * CAM + d * CAAM, CMY = g * CAM + b * VM + d * CMAM + kY * kM;
    var det = VA * VM - CAM * CAM, cp = (VM * CAY - CAM * CMY) / det, c = CAY / VA;
    var nde = g + d * M0, nie = (b + d) * a;
    return { nde: nde, nie: nie, te: nde + nie, c: c, cp: cp, ind: c - cp };
  }

  var ctr = V.controls(root);
  var sA = V.slider(ctr, { label: "Salt → BP (α, mmHg)", min: 0, max: 10, step: 0.5, value: 5, fmt: function (v) { return "+" + v.toFixed(1); }, onInput: draw });
  var sB = V.slider(ctr, { label: "BP → CVD risk (β, points per mmHg)", min: 0, max: 0.4, step: 0.02, value: 0.2, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
  var sG = V.slider(ctr, { label: "Direct salt → CVD (γ, points)", min: -1, max: 3, step: 0.25, value: 1, fmt: function (v) { return V.fmt.signed(v, 2); }, onInput: draw });
  var sD = V.slider(ctr, { label: "Salt × BP interaction (δ, extra points per mmHg)", min: -0.1, max: 0.2, step: 0.02, value: 0, fmt: function (v) { return V.fmt.signed(v, 2); }, onInput: draw });
  var sK = V.slider(ctr, { label: "Hidden BP–CVD confounder (strength)", min: 0, max: 1, step: 0.1, value: 0, fmt: function (v) { return v === 0 ? "none" : v.toFixed(1); }, onInput: draw });

  var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
  el("span", { class: "widget-note", style: "margin:0", text: "Presets:" }, pre);
  [["Textbook case", 5, 0.2, 1, 0, 0], ["Interaction", 5, 0.2, 1, 0.12, 0], ["Hidden confounder", 5, 0.2, 1, 0, 0.8]].forEach(function (p) {
    V.button(pre, p[0], function () { sA.set(p[1]); sB.set(p[2]); sG.set(p[3]); sD.set(p[4]); sK.set(p[5]); draw(); });
  });

  V.legend(root, [{ cls: "s1", label: "True natural effect" }, { cls: "s3", label: "Difference method (c′ and c − c′)" }]);
  var c = V.svg(root, 640, 260);
  c.setAttribute("aria-label", "Bar chart comparing true natural direct, indirect and total effects with the difference-method estimates");

  var out = V.readouts(root, [
    { key: "nde", label: "True NDE (points)" },
    { key: "nie", label: "True NIE (points)" },
    { key: "cp", label: "Naive direct c′ (points)" },
    { key: "ind", label: "Naive indirect c − c′ (points)" },
    { key: "pm", label: "Proportion mediated: true vs naive" }
  ]);
  var boxes = root.querySelectorAll(".widget-readout");
  var msg = el("p", { class: "widget-note" }, root);
  el("p", { class: "widget-note", text: "Illustrative numbers. Salt is randomised, so the total effect is always estimated correctly. The difference method fits Y on salt (c), then Y on salt and BP without an interaction term (c′), and calls the drop the indirect effect. Exact population values, no sampling noise." }, root);

  function draw() {
    var r = compute(sA.value(), sB.value(), sG.value(), sD.value(), sK.value());
    var cats = [["Direct", r.nde, r.cp], ["Indirect (via BP)", r.nie, r.ind], ["Total", r.te, r.c]];
    clear(c);
    var vals = [0]; cats.forEach(function (q) { vals.push(q[1], q[2]); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    lo = Math.floor(Math.min(0, lo) - 0.25); hi = Math.ceil(hi + 0.4);
    var f = V.frame(c, { x: [0, 3], y: [lo, hi], xTicks: [], margin: { top: 16, bottom: 34, left: 56 }, yLabel: "Change in 10-year CVD risk (points)", fmtY: function (v) { return V.fmt.num(v, 0); } });
    var g = f.inner, y0 = f.y(0);
    el("line", { x1: f.x(0), x2: f.x(3), y1: y0, y2: y0, class: "viz-axis" }, g);
    cats.forEach(function (q, i) {
      var cx = f.x(i + 0.5), bw = 56;
      [[q[1], "s1", cx - bw - 4], [q[2], "s3", cx + 4]].forEach(function (b) {
        var yv = f.y(b[0]), top = Math.min(yv, y0), h = Math.max(1, Math.abs(y0 - yv));
        el("rect", { x: b[2], y: top, width: bw, height: h, class: "fill " + b[1] }, g);
        var above = b[0] >= 0;
        el("text", { x: b[2] + bw / 2, y: above ? top - 5 : top + h + 14, "text-anchor": "middle", class: "viz-small viz-bold", text: V.fmt.signed(b[0], 2) }, g);
      });
      el("text", { x: cx, y: f.y(lo) + 20, "text-anchor": "middle", class: "viz-small viz-bold", text: q[0] }, g);
    });

    out.nde(V.fmt.signed(r.nde, 2)); out.nie(V.fmt.signed(r.nie, 2));
    out.cp(V.fmt.signed(r.cp, 2)); out.ind(V.fmt.signed(r.ind, 2));
    var pmT = Math.abs(r.te) > 1e-9 ? r.nie / r.te : NaN, pmN = Math.abs(r.c) > 1e-9 ? r.ind / r.c : NaN;
    out.pm((isNaN(pmT) ? "–" : V.fmt.pct(pmT)) + " vs " + (isNaN(pmN) ? "–" : V.fmt.pct(pmN)));
    var off = Math.abs(r.cp - r.nde) > 0.05;
    [2, 3].forEach(function (i) { boxes[i].classList.toggle("bad", off); boxes[i].classList.toggle("good", !off); });

    var t;
    if (!off) t = "No interaction and no hidden confounder: c − c′ equals the true indirect effect. This is the only case where the difference method is safe.";
    else if (sK.value() > 0 && Math.abs(sD.value()) > 1e-9) t = "Both problems at once: the naive split is wrong for two separate reasons, and adding an interaction term would fix only one.";
    else if (sK.value() > 0) t = "Adjusting for BP opens salt → BP ← hidden factor → CVD (collider bias, Lecture 2.7). The direct effect is pushed down and the indirect effect inflated, even though salt was randomised.";
    else t = "With an interaction, the direct effect depends on the BP level at which you hold people. c′ averages over the wrong BP distribution; a model with a salt × BP term, used to compute NDE and NIE, gets it right.";
    msg.textContent = t;
  }
  draw();
});
