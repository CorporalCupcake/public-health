// Lecture 1.7 — PAF (Levin's formula) and PIF (shifting an intake distribution). Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // PAF: prevalence and RR → share of cases attributable to the exposure.
  // Area chart: width = share of population, height = risk (unexposed = 1),
  // so each block's area is its number of cases.
  V.register("paf-levin", function (root) {
    var ctr = V.controls(root);
    var sp = V.slider(ctr, { label: "Share of people exposed (prevalence)", min: 1, max: 80, step: 1, value: 30, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sr = V.slider(ctr, { label: "Relative risk in the exposed (RR)", min: 1, max: 10, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Load a row of the table:" }, pre);
    [[30, 1.2], [30, 2], [3, 5]].forEach(function (r) {
      V.button(pre, r[0] + "%, RR " + r[1].toFixed(1), function () { sp.set(r[0]); sr.set(r[1]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "Cases that would happen anyway" },
      { cls: "s3", label: "Extra cases caused by the exposure (attributable)" }
    ]);
    var c = V.svg(root, 640, 270);
    c.setAttribute("aria-label", "Area chart: unexposed and exposed groups, with the extra cases in the exposed group highlighted");
    var b = V.svg(root, 640, 60);
    b.setAttribute("aria-label", "Bar showing all cases split into attributable and other");

    var out = V.readouts(root, [
      { key: "paf", label: "PAF, Levin: p(RR−1) ÷ (1 + p(RR−1))", cls: "bad" },
      { key: "pc", label: "Share of cases who are exposed (pc)" },
      { key: "cb", label: "Case-based: pc × (RR−1) ÷ RR (same answer)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. The case-based check matches only because this RR is unconfounded; with confounding, Levin’s formula and an adjusted RR disagree (see the trap below)." }, root);

    function draw() {
      var p = sp.value() / 100, rr = sr.value();
      var ex = p * (rr - 1), paf = ex / (1 + ex), pc = p * rr / (1 + ex);

      clear(c);
      var ymax = Math.max(2, Math.ceil(rr * 1.25));
      var f = V.frame(c, { x: [0, 1], y: [0, ymax], fmtX: V.fmt.pct, xLabel: "Share of the population", yLabel: "Risk (unexposed = 1)" });
      var g = f.inner, x0 = f.x(0), xs = f.x(1 - p), x1 = f.x(1), y0 = f.y(0), y1 = f.y(1), yr = f.y(rr);
      el("rect", { x: x0, y: y1, width: xs - x0, height: y0 - y1, class: "fill-soft s5" }, g);
      el("rect", { x: xs, y: y1, width: x1 - xs, height: y0 - y1, class: "fill-soft s5" }, g);
      if (rr > 1) el("rect", { x: xs, y: yr, width: x1 - xs, height: y1 - yr, class: "fill s3" }, g);
      el("line", { x1: xs, x2: xs, y1: y0, y2: Math.min(y1, yr), class: "edge" }, g);

      el("text", { x: (x0 + xs) / 2, y: (y0 + y1) / 2 + 4, "text-anchor": "middle", class: "viz-small", text: "Unexposed · " + V.fmt.pct(1 - p) }, g);
      var wide = x1 - xs > 110;
      el("text", wide
        ? { x: (xs + x1) / 2, y: (y0 + y1) / 2 + 4, "text-anchor": "middle", class: "viz-small", text: "Exposed · " + V.fmt.pct(p) }
        : { x: xs - 6, y: Math.min(yr, y1) + 14, "text-anchor": "end", class: "viz-small", text: "Exposed · " + V.fmt.pct(p) + " →" }, g);
      if (rr > 1) el("text", { x: wide ? (xs + x1) / 2 : xs - 6, y: wide ? yr - 8 : Math.min(yr, y1) - 6, "text-anchor": wide ? "middle" : "end", class: "viz-small colour s3", text: "risk × " + rr.toFixed(1) }, g);

      // Stacked bar of all cases
      clear(b);
      var L = 52, R = 624, split = L + (R - L) * (1 - paf);
      el("text", { x: L, y: 14, class: "viz-small viz-muted", text: "All cases (100%)" }, b);
      el("rect", { x: L, y: 22, width: split - L, height: 26, class: "fill-soft s5" }, b);
      if (paf > 0) el("rect", { x: split, y: 22, width: R - split, height: 26, class: "fill s3" }, b);
      el("text", { x: R, y: 14, "text-anchor": "end", class: "viz-small viz-bold colour s3", text: "attributable: " + V.fmt.pct1(paf) }, b);

      out.paf(V.fmt.pct1(paf));
      out.pc(V.fmt.pct1(pc));
      out.cb(V.fmt.pct1(pc * (rr - 1) / rr));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // PIF: a salt policy shifts the usual-intake distribution down.
  // Risk is log-linear above the TMREL: about 2% per gram, i.e. Lecture 1.9's
  // chain (1 g ≈ 1 mmHg; 5 mmHg ≈ 10% fewer events).
  V.register("pif-shift", function (root) {
    var MEAN = 10, SD = 3.5, B = Math.log(1 / 0.9) / 5;
    var s2 = Math.log(1 + SD * SD / (MEAN * MEAN)), sig = Math.sqrt(s2), mu = Math.log(MEAN) - s2 / 2;
    function dens(x) { if (x <= 0) return 0; var z = (Math.log(x) - mu) / sig; return Math.exp(-0.5 * z * z) / (x * sig * Math.sqrt(2 * Math.PI)); }
    var DX = 0.05, XS = [];
    for (var x = DX / 2; x < 40; x += DX) XS.push(x);

    var ctr = V.controls(root);
    var sc = V.slider(ctr, { label: "Policy cut, if fully met", min: 0, max: 3, step: 0.5, value: 2, fmt: function (v) { return v.toFixed(1) + " g/day"; }, onInput: draw });
    var sm = V.slider(ctr, { label: "Compliance", min: 0, max: 100, step: 5, value: 60, fmt: function (v) { return v + "%"; }, onInput: draw });
    var st = V.slider(ctr, { label: "TMREL (illustrative)", min: 1, max: 8, step: 0.5, value: 3, fmt: function (v) { return v.toFixed(1) + " g/day"; }, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "Usual salt intake now" },
      { cls: "s1", label: "After the policy (PIF world)" },
      { cls: "s2", label: "TMREL (PAF world: everyone here)", dashed: true }
    ]);
    var c = V.svg(root, 640, 280);
    c.setAttribute("aria-label", "Salt intake distribution now and after the policy, with the TMREL marked");
    var defs = el("defs", null, c);
    var mk = el("marker", { id: "l17-pif-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
    el("path", { d: "M0,0L10,5L0,10Z", class: "arrowhead accent" }, mk);
    var f = V.frame(c, { x: [0, 22], y: [0, 0.18], yTicks: [], xLabel: "Usual salt intake (g/day)", yLabel: "Share of people" });
    var aCur = el("path", { class: "fill-soft s5" }, f.inner);
    var lCur = el("path", { class: "stroke s5" }, f.inner);
    var lPost = el("path", { class: "stroke s1" }, f.inner);
    var tm = el("line", { y1: f.y(0), y2: f.y(0.165), class: "stroke s2 dashed" }, f.inner);
    var tmT = el("text", { y: f.y(0.172), class: "viz-small colour s2", text: "TMREL" }, f.inner);
    var arrow = el("path", { class: "edge accent", "marker-end": "url(#l17-pif-arrow)" }, f.inner);
    var arrowT = el("text", { "text-anchor": "start", class: "viz-small colour s1" }, f.inner);

    var out = V.readouts(root, [
      { key: "m0", label: "Mean intake now" },
      { key: "m1", label: "Mean intake after the policy" },
      { key: "pif", label: "PIF: share of cases the policy avoids", cls: "good" },
      { key: "paf", label: "PAF: share avoided if everyone were at the TMREL" },
      { key: "ratio", label: "PIF as a share of the PAF" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Intake averages 10 g/day. Risk rises about 2% per gram above the TMREL, roughly the chain in Lecture 1.9 (1 g ≈ 1 mmHg; 5 mmHg ≈ 10% fewer events). Both fractions are steady-state effects." }, root);

    function rr(x, T) { return Math.exp(B * Math.max(0, x - T)); }

    function draw() {
      var d = sc.value() * sm.value() / 100, T = st.value();
      var tot = 0, e0 = 0, e1 = 0, mean = 0, cur = [], post = [], base = [];
      XS.forEach(function (x) {
        var w = dens(x) * DX;
        tot += w; mean += w * x;
        e0 += w * rr(x, T);
        e1 += w * rr(Math.max(0, x - d), T);
        if (x <= 22) { cur.push([f.x(x), f.y(dens(x))]); base.push([f.x(x), f.y(0)]); }
        if (x - d >= 0 && x - d <= 22) post.push([f.x(x - d), f.y(dens(x))]);
      });
      e0 /= tot; e1 /= tot; mean /= tot;
      var paf = 1 - 1 / e0, pif = 1 - e1 / e0;

      aCur.setAttribute("d", V.area(cur, base));
      lCur.setAttribute("d", V.line(cur));
      lPost.setAttribute("d", V.line(post));
      tm.setAttribute("x1", f.x(T)); tm.setAttribute("x2", f.x(T));
      tmT.setAttribute("x", f.x(T) + 6);
      tmT.textContent = "TMREL " + T.toFixed(1) + " g · the PAF world puts everyone here";

      if (d > 0.05) {
        var ya = f.y(0.142);
        arrow.setAttribute("d", "M" + f.x(mean) + "," + ya + "L" + f.x(mean - d) + "," + ya);
        arrowT.setAttribute("x", f.x(mean) + 8); arrowT.setAttribute("y", ya + 4);
        arrowT.textContent = "policy shift −" + d.toFixed(1) + " g";
        arrow.style.display = arrowT.style.display = "";
      } else {
        arrow.style.display = arrowT.style.display = "none";
      }

      out.m0(V.fmt.num(mean, 1) + " g");
      out.m1(V.fmt.num(mean - d, 1) + " g");
      out.pif(V.fmt.pct1(pif));
      out.paf(V.fmt.pct1(paf));
      out.ratio(paf > 0 ? V.fmt.pct(pif / paf) : "–");
    }
    draw();
  });
})();
