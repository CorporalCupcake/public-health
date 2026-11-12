// Lecture 5.1 — building exposure episodes from dispensings: grace period, stockpiling, PDC vs MPR,
// and how one event is classified under different exposure definitions. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  V.register("exposure-episodes", function (root) {
    var OBS = 365;
    var PATIENTS = {
      A: [[0, 30], [25, 30], [50, 30], [100, 30], [135, 30], [200, 60], [262, 30], [330, 30]],
      B: [[0, 30], [20, 30], [40, 30], [60, 30], [80, 30], [100, 30], [120, 30], [140, 30], [160, 30], [180, 30]]
    };

    var ctr = V.controls(root);
    var sG = V.slider(ctr, { label: "Grace period (permissible gap)", min: 0, max: 60, step: 1, value: 14, fmt: function (v) { return v + " days"; }, onInput: draw });
    var sE = V.slider(ctr, { label: "Day of the outcome event", min: 0, max: 364, step: 1, value: 170, fmt: function (v) { return "day " + v; }, onInput: draw });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem 1rem;margin:0 0 0.6rem" }, root);
    var tP = V.toggle(row, { options: [{ value: "A", label: "Patient A: gaps" }, { value: "B", label: "Patient B: early refills, then stops" }], value: "A", onChange: draw });
    var tS = V.toggle(row, { options: [{ value: "off", label: "Stockpiling off" }, { value: "on", label: "Stockpiling on (carry-over)" }], value: "off", onChange: draw });

    V.legend(root, [
      { cls: "s5", label: "Fill as recorded (days’ supply)" },
      { cls: "s1", label: "Drug on hand" },
      { cls: "s2", label: "Grace period added" },
      { cls: "s3", label: "Gap beyond grace: episode ends" }
    ]);
    var rule = el("p", { class: "widget-note", style: "margin:0.2rem 0 0" }, root);
    var c = V.svg(root, 640, 282);
    c.setAttribute("aria-label", "Timeline of one patient's dispensings over 365 days, the resulting supply on hand, and the exposure episodes after applying the grace period, with the outcome event day marked");
    var host = el("g", null, c);

    var out = V.readouts(root, [
      { key: "ep", label: "Treatment episodes" },
      { key: "pdc", label: "PDC over 365 days" },
      { key: "mpr", label: "MPR (supply ÷ days from first to last fill)" },
      { key: "pers", label: "Persistence: days to first discontinuation" }
    ]);
    var out2 = V.readouts(root, [
      { key: "ever", label: "Event under “ever use”" },
      { key: "strict", label: "Event under “current = supply only”" },
      { key: "grace", label: "Event under “current = supply + grace”" },
      { key: "crp", label: "Event under current / recent (≤90 days) / past" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative records. MPR here is the classic refill-interval version (supply of all fills but the last, divided by days between first and last fill), so it can exceed 100%. PDC counts each day once and caps at 100%. Episodes end at the last day of supply plus the grace period." }, root);

    function supplyIntervals(fills, stock) {
      var iv = [], prevEnd = -Infinity;
      fills.forEach(function (f) {
        var s = stock ? Math.max(f[0], prevEnd) : f[0];
        var e = s + f[1];
        iv.push([s, e]);
        prevEnd = stock ? e : Math.max(prevEnd, e);
      });
      // merge overlaps (union)
      var u = [];
      iv.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (x) {
        if (u.length && x[0] <= u[u.length - 1][1]) u[u.length - 1][1] = Math.max(u[u.length - 1][1], x[1]);
        else u.push([x[0], x[1]]);
      });
      return u;
    }
    function episodes(cov, grace) {
      var ep = [];
      cov.forEach(function (x) {
        var last = ep[ep.length - 1];
        if (last && x[0] - last.supEnd <= grace) { last.supEnd = Math.max(last.supEnd, x[1]); }
        else ep.push({ start: x[0], supEnd: x[1] });
      });
      ep.forEach(function (e) { e.end = e.supEnd + grace; });
      return ep;
    }
    function inAny(list, d, endKey) {
      for (var i = 0; i < list.length; i++) {
        var s = list[i].start !== undefined ? list[i].start : list[i][0];
        var e = endKey ? list[i][endKey] : list[i][1];
        if (d >= s && d < e) return true;
      }
      return false;
    }

    function draw() {
      var fills = PATIENTS[tP.value()], stock = tS.value() === "on", grace = sG.value(), ev = sE.value();
      var cov = supplyIntervals(fills, stock), ep = episodes(cov, grace);

      clear(host);
      var x0 = 70, x1 = 625, x = V.scale(0, OBS, x0, x1);
      var yF = 30, yC = 128, yE = 185, yAx = 235;
      el("text", { x: 4, y: yF + 4, class: "viz-small viz-bold", text: "Fills" }, host);
      el("text", { x: 4, y: yC + 13, class: "viz-small viz-bold", text: "On hand" }, host);
      el("text", { x: 4, y: yE + 13, class: "viz-small viz-bold", text: "Episodes" }, host);

      // recorded fills, staggered on 3 lanes so overlaps show
      fills.forEach(function (f, i) {
        var lane = i % 3, y = yF + lane * 26;
        el("rect", { x: x(f[0]), y: y - 6, width: Math.max(1, x(Math.min(OBS, f[0] + f[1])) - x(f[0])), height: 12, rx: 3, class: "fill-soft s5" }, host);
        el("circle", { cx: x(f[0]), cy: y, r: 4.5, class: "dot s5" }, host);
      });
      rule.textContent = stock ? "Stockpiling on: leftover supply from an early refill is used after the current supply runs out." : "Stockpiling off: overlapping supply is wasted; each fill starts on its own date.";

      // coverage
      cov.forEach(function (iv) {
        var s = Math.min(iv[0], OBS), e = Math.min(iv[1], OBS);
        if (e > s) el("rect", { x: x(s), y: yC, width: x(e) - x(s), height: 18, class: "fill s1" }, host);
      });
      // episodes with grace tails and gap markers
      ep.forEach(function (e, i) {
        var s = Math.min(e.start, OBS), se = Math.min(e.supEnd, OBS), ee = Math.min(e.end, OBS);
        if (se > s) el("rect", { x: x(s), y: yE, width: x(se) - x(s), height: 18, class: "fill-soft s1", style: "fill-opacity:0.55" }, host);
        if (ee > se) el("rect", { x: x(se), y: yE, width: x(ee) - x(se), height: 18, class: "fill s2" }, host);
        el("text", { x: x(s) + 3, y: yE + 13, class: "viz-small viz-bold", text: String(i + 1) }, host);
        var next = ep[i + 1];
        if (next && e.end < OBS) {
          el("line", { x1: x(e.end), x2: x(Math.min(next.start, OBS)), y1: yE + 9, y2: yE + 9, class: "stroke s3" }, host);
        }
      });

      // event line
      el("line", { x1: x(ev), x2: x(ev), y1: yF - 16, y2: yAx, class: "stroke s3 dashed", style: "stroke-width:2" }, host);
      var anchor = ev > 300 ? "end" : "start";
      el("text", { x: x(ev) + (anchor === "end" ? -5 : 5), y: yF - 8, "text-anchor": anchor, class: "viz-small viz-bold colour s3", text: "event, day " + ev }, host);

      // axis
      el("line", { x1: x0, x2: x1, y1: yAx, y2: yAx, class: "viz-axis" }, host);
      [0, 60, 120, 180, 240, 300, 365].forEach(function (t) {
        el("text", { x: x(t), y: yAx + 16, "text-anchor": "middle", class: "viz-tick", text: t }, host);
      });
      el("text", { x: (x0 + x1) / 2, y: yAx + 38, "text-anchor": "middle", class: "viz-label", text: "Days since first dispensing" }, host);

      // readouts
      var covered = 0;
      cov.forEach(function (iv) { covered += Math.max(0, Math.min(iv[1], OBS) - Math.max(iv[0], 0)); });
      var supplyButLast = 0;
      for (var i = 0; i < fills.length - 1; i++) supplyButLast += fills[i][1];
      var mpr = supplyButLast / (fills[fills.length - 1][0] - fills[0][0]);
      out.ep(String(ep.length));
      out.pdc(V.fmt.pct(covered / OBS));
      out.mpr(V.fmt.pct(mpr));
      out.pers(ep.length > 1 || ep[0].end < OBS ? String(Math.round(Math.min(ep[0].end, OBS))) + " days" : "≥ 365 days");

      var strict = inAny(cov, ev), withGrace = inAny(ep, ev, "end");
      var recent = false;
      if (!withGrace) ep.forEach(function (e) { if (ev >= e.end && ev < e.end + 90) recent = true; });
      out2.ever("Exposed");
      out2.strict(strict ? "Exposed" : "Unexposed");
      out2.grace(withGrace ? "Exposed" : "Unexposed");
      out2.crp(withGrace ? "Current" : recent ? "Recent" : "Past");
    }
    draw();
  });
})();
