// Lecture 6.6 — Antimicrobial resistance: a two-strain selection model. The resistant share rises
// when antibiotic use outweighs the fitness cost of resistance, and falls only slowly after use is cut.
// Illustrative model and numbers.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function halo() { return "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round"; }
  function logit(p) { return Math.log(p / (1 - p)); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }

  var K = 0.8;       // yearly selection advantage of resistance at 100% use (log-odds)
  var YEARS = 40, P0 = 0.01, FLOOR = 0.002;

  V.register("resistance-selection", function (root) {
    var extra = "none";
    var ctr = V.controls(root);
    var sUse = V.slider(ctr, { label: "Antibiotic use", min: 0, max: 100, step: 5, value: 50, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sCost = V.slider(ctr, { label: "Fitness cost (per year)", min: 0, max: 0.3, step: 0.01, value: 0.1, fmt: function (v) { return Math.round(v * 100) + "%"; }, onInput: draw });
    var sYear = V.slider(ctr, { label: "Stewardship starts (year)", min: 5, max: 35, step: 1, value: 15, fmt: String, onInput: draw });
    var sAfter = V.slider(ctr, { label: "Use after stewardship", min: 0, max: 100, step: 5, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw });
    var row = el("div", { style: "margin:0 0 0.6rem" }, root);
    V.toggle(row, {
      options: [{ value: "none", label: "Simple model" }, { value: "comp", label: "+ compensatory evolution" }, { value: "co", label: "+ co-selection by another drug" }],
      value: extra, onChange: function (v) { extra = v; draw(); }
    });

    V.legend(root, [
      { cls: "s3", label: "Resistant share of infections" },
      { cls: "s5", label: "Antibiotic use", dashed: true },
      { cls: "s2", label: "Use level at which resistance stops spreading", dashed: true }
    ]);
    var c = V.svg(root, 640, 320);
    c.setAttribute("aria-label", "Resistant share of infections and antibiotic use over 40 years, with stewardship cutting use partway through");
    var out = V.readouts(root, [
      { key: "atcut", label: "Resistant share when stewardship starts" },
      { key: "end", label: "Resistant share in year 40", cls: "bad" },
      { key: "half", label: "Years after the cut for resistance to halve", cls: "good" }
    ]);
    var note = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers. Use is a percentage of the maximum possible. Each year the log-odds of resistance changes by (selection from use) − (fitness cost). Compensatory evolution shrinks the cost to a fifth over about 10 years once resistance is common. Co-selection adds a constant pressure from a second drug whose resistance genes travel with this one. A small inflow (0.2%) from elsewhere means resistance never vanishes." }, root);

    function simulate() {
      var use = sUse.value() / 100, after = sAfter.value() / 100, cut = sYear.value(), c0 = sCost.value();
      var p = P0, ps = [p], us = [], cs = [], commonSince = null;
      for (var t = 0; t < YEARS; t++) {
        var u = t < cut ? use : after;
        var cost = c0;
        if (extra === "comp") {
          if (commonSince === null && p > 0.2) commonSince = t;
          if (commonSince !== null) cost = c0 * (0.2 + 0.8 * Math.exp(-(t - commonSince) / 5));
        }
        var s = K * u - cost + (extra === "co" ? 0.12 : 0);
        us.push(u); cs.push(cost);
        p = Math.max(FLOOR, Math.min(0.999, expit(logit(p) + s)));
        ps.push(p);
      }
      us.push(us[us.length - 1]); cs.push(cs[cs.length - 1]);
      return { ps: ps, us: us, cs: cs, cut: cut };
    }

    function draw() {
      var sim = simulate(), cut = sim.cut;
      clear(c);
      var f = V.frame(c, { x: [0, YEARS], y: [0, 1], fmtY: V.fmt.pct, yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "Year", yLabel: "Share (%)", margin: { right: 20 } });
      var G = f.inner;
      el("rect", { x: f.x(cut), y: f.y(1), width: f.x(YEARS) - f.x(cut), height: f.y(0) - f.y(1), class: "fill-soft s1", opacity: 0.4 }, G);
      el("text", { x: f.x(cut) + 6, y: f.y(1) + 14, class: "viz-small viz-muted", style: halo(), text: "stewardship" }, G);
      // threshold use = (cost − co-selection) / K, drawn as a step line over time
      var thr = sim.cs.map(function (cst, t) { return [f.x(t), f.y(Math.max(0, Math.min(1, (cst - (extra === "co" ? 0.12 : 0)) / K)))]; });
      el("path", { d: V.line(thr), class: "stroke dashed s2", "stroke-width": 1.8 }, G);
      var usePts = []; sim.us.forEach(function (u, t) { if (t > 0) usePts.push([f.x(t), f.y(sim.us[t - 1])]); usePts.push([f.x(t), f.y(u)]); });
      el("path", { d: V.line(usePts), class: "stroke dashed s5", "stroke-width": 2 }, G);
      el("path", { d: V.line(sim.ps.map(function (p, t) { return [f.x(t), f.y(p)]; })), class: "stroke s3", "stroke-width": 3 }, G);

      var atCut = sim.ps[cut], end = sim.ps[YEARS], half = null;
      for (var t = cut; t <= YEARS; t++) if (sim.ps[t] <= atCut / 2) { half = t - cut; break; }
      out.atcut(V.fmt.pct(atCut));
      out.end(V.fmt.pct(end));
      out.half(half === null ? "not by year 40" : half + " years");

      var thrNow = (sim.cs[cut] - (extra === "co" ? 0.12 : 0)) / K;
      if (sim.us[cut] > thrNow + 1e-9) note.textContent = "After the cut, use is still above the line where resistance stops spreading, so resistance keeps rising, only more slowly. Cutting use is not enough unless it goes below that line.";
      else if (half === null) note.textContent = "Use is now below the line, so resistance falls, but slowly: the only force pulling it down is the fitness cost, which is usually small. Resistance built in " + cut + " years does not unwind in the same time.";
      else note.textContent = "Use is well below the line and the cost is large enough for resistance to fall noticeably. Real fitness costs are often small or are compensated, so declines like this are the exception.";
    }
    draw();
  });
})();
