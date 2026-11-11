// Lecture 3.2 — Factor and contrast explorer: one factor (smoking status), four codings.
// The model sbp ~ smoke has one parameter per group, so its coefficients are exact functions of
// the group means; no simulation needed. Illustrative numbers.
Viz.register("contrast-explorer", function (root) {
  var V = Viz, el = V.el;
  var ALPHA = ["Current", "Former", "Never"];
  var MEAN = { Current: 124.0, Former: 128.5, Never: 121.0 };
  var N = { Current: 180, Former: 270, Never: 550 };
  var NTOT = 1000;
  var WMEAN = ALPHA.reduce(function (s, l) { return s + N[l] * MEAN[l]; }, 0) / NTOT;

  var HALO = "paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round";
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace("-", "−"); }
  function sg(x) { var r = Math.round(x * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(1); }

  var ref = "Current", coding = "treatment";

  var ctr = el("div", { class: "widget-controls", style: "grid-template-columns:1fr" }, root);
  var c1 = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
  el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Reference level (first level)" }, c1);
  V.toggle(c1, { options: ALPHA.map(function (l) { return { value: l, label: l }; }), value: ref, onChange: function (v) { ref = v; draw(); } });
  var c2 = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, ctr);
  el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Coding" }, c2);
  V.toggle(c2, {
    options: [{ value: "treatment", label: "Treatment" }, { value: "sum", label: "Sum" }, { value: "none", label: "No intercept" }, { value: "numeric", label: "Numeric codes" }],
    value: coding, onChange: function (v) { coding = v; draw(); }
  });

  var pre = el("pre", { style: "margin:0 0 0.8rem;white-space:pre-wrap" }, root);
  var code = el("code", null, pre);

  var c = V.svg(root, 640, 290);
  c.setAttribute("aria-label", "Mean systolic blood pressure in each smoking group, with arrows showing what each model coefficient measures under the chosen coding");
  var defs = el("defs", null, c);
  var mk = el("marker", { id: "l32w-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
  el("path", { d: "M0,0L10,5L0,10Z", class: "dot s3" }, mk);
  var plot = el("g", null, c);

  var tblWrap = el("div", { class: "table-wrap", style: "margin:0.6rem 0" }, root);
  var coefWrap = el("div", { class: "table-wrap", style: "margin:0.6rem 0" }, root);
  var out = V.readouts(root, ALPHA.map(function (l) { return { key: l, label: "Fitted mean, " + l + " (observed " + f1(MEAN[l]) + ")" }; })
    .concat([{ key: "gap", label: "Largest gap, fitted vs observed" }]));
  var outBoxes = root.querySelectorAll(".widget-readout");
  el("p", { class: "widget-note", text: "Illustrative numbers: 1,000 adults; means and group sizes are made up. Former smokers have the highest mean here because they tend to be older; that is confounding, not coding. Sum coding drops the last level in level order." }, root);

  function table(parent, head, rows) {
    clear(parent);
    var t = el("table", null, parent);
    var tr = el("tr", null, el("thead", null, t));
    head.forEach(function (h) { el("th", { html: h }, tr); });
    var tb = el("tbody", null, t);
    rows.forEach(function (r) {
      var row = el("tr", null, tb);
      r.forEach(function (cell, i) { el("td", { html: cell, class: (i > 0 && /^[−+0-9.\s-]+$/.test(String(cell).replace(/<[^>]+>/g, ""))) ? "num" : null }, row); });
    });
  }
  function codeTag(s) { return "<code>" + s + "</code>"; }

  function draw() {
    var L = [ref].concat(ALPHA.filter(function (l) { return l !== ref; }));
    var m = L.map(function (l) { return MEAN[l]; }), n = L.map(function (l) { return N[l]; });
    var k = L.length, terms = [], design = [], fitted = [], codeText;

    if (coding === "treatment") {
      var b0 = m[0];
      terms.push(["(Intercept)", b0, "Mean in " + L[0] + ", the reference group"]);
      for (var j = 1; j < k; j++) terms.push(["smoke" + L[j], m[j] - b0, L[j] + " minus " + L[0]]);
      design = L.map(function (_, i) { return [1].concat(L.slice(1).map(function (_, j) { return i === j + 1 ? 1 : 0; })); });
      fitted = m.slice();
      codeText = (ref === "Current" ? "# default: levels sort alphabetically, so \"Current\" is the reference\n" : "d$smoke <- relevel(d$smoke, ref = \"" + ref + "\")\n") + "lm(sbp ~ smoke, data = d)";
    } else if (coding === "sum") {
      var g = (m[0] + m[1] + m[2]) / 3;
      terms.push(["(Intercept)", g, "Average of the three group means. Not the mean of all 1,000 adults (" + f1(WMEAN) + "), because groups differ in size"]);
      for (var s = 0; s < k - 1; s++) terms.push(["smoke" + (s + 1), m[s] - g, L[s] + " minus that average"]);
      terms.push(["<em>(not shown)</em>", m[k - 1] - g, L[k - 1] + " minus the average = −(smoke1 + smoke2). R does not print it"]);
      design = L.map(function (_, i) { return [1].concat([0, 1].map(function (j) { return i === k - 1 ? -1 : (i === j ? 1 : 0); })); });
      fitted = m.slice();
      codeText = (ref === "Current" ? "" : "d$smoke <- relevel(d$smoke, ref = \"" + ref + "\")\n") + "lm(sbp ~ smoke, data = d, contrasts = list(smoke = \"contr.sum\"))";
    } else if (coding === "none") {
      L.forEach(function (l, i) { terms.push(["smoke" + l, m[i], "Mean in " + l + ". Its p-value tests whether mean SBP is 0: useless"]); });
      design = L.map(function (_, i) { return L.map(function (_, j) { return i === j ? 1 : 0; }); });
      fitted = m.slice();
      codeText = "lm(sbp ~ 0 + smoke, data = d)   # one coefficient per group, no reference";
    } else {
      var cs = [1, 2, 3], sn = 0, sc = 0, sm = 0;
      for (var i = 0; i < k; i++) { sn += n[i]; sc += n[i] * cs[i]; sm += n[i] * m[i]; }
      var cb = sc / sn, mb = sm / sn, num = 0, den = 0;
      for (i = 0; i < k; i++) { num += n[i] * (cs[i] - cb) * (m[i] - mb); den += n[i] * (cs[i] - cb) * (cs[i] - cb); }
      var slope = num / den, a = mb - slope * cb;
      terms.push(["(Intercept)", a, "Predicted SBP at code 0, a group that does not exist"]);
      terms.push(["as.numeric(smoke)", slope, "Change per step along " + L.join(" → ") + ". That order is arbitrary: change the reference and the slope changes"]);
      design = L.map(function (_, i) { return [1, cs[i]]; });
      fitted = cs.map(function (cc) { return a + slope * cc; });
      codeText = "lm(sbp ~ as.numeric(smoke), data = d)   # the trap: level codes treated as a measurement";
    }

    code.textContent = codeText;

    // Design matrix
    var cols = coding === "treatment" ? ["(Intercept)"].concat(L.slice(1).map(function (l) { return "smoke" + l; }))
      : coding === "sum" ? ["(Intercept)", "smoke1", "smoke2"]
      : coding === "none" ? L.map(function (l) { return "smoke" + l; })
      : ["(Intercept)", "as.numeric(smoke)"];
    table(tblWrap, ["Design matrix: a row for someone who is…", "n"].concat(cols.map(codeTag)),
      L.map(function (l, i) { return [l + (i === 0 && coding !== "none" && coding !== "numeric" ? " <span class=\"widget-note\">(first level)</span>" : ""), V.fmt.int(n[i])].concat(design[i].map(function (v) { return String(v).replace("-", "−"); })); }));

    table(coefWrap, ["Coefficient", "Estimate", "What it means"],
      terms.map(function (t) { return [t[0].charAt(0) === "<" ? t[0] : codeTag(t[0]), (t[0] === "(Intercept)" || coding === "none") ? f1(t[1]) : sg(t[1]), t[2]]; }));

    // Readouts: fitted vs observed
    var gap = 0;
    L.forEach(function (l, i) {
      var d = Math.abs(fitted[i] - m[i]); gap = Math.max(gap, d);
      out[l](f1(fitted[i]));
      var idx = ALPHA.indexOf(l);
      outBoxes[idx].classList.toggle("good", d < 0.05);
      outBoxes[idx].classList.toggle("bad", d >= 0.05);
    });
    out.gap(f1(gap) + " mmHg");
    outBoxes[3].classList.toggle("bad", gap >= 0.05);
    outBoxes[3].classList.toggle("good", gap < 0.05);

    // Chart
    clear(plot);
    var f = V.frame(c, { x: [0.5, 3.9], y: [114, 132], xTicks: [], yTicks: [115, 120, 125, 130], margin: { top: 30, bottom: 50, left: 52, right: 8 }, yLabel: "Mean SBP (mmHg)" });
    plot.appendChild(f.g); plot.appendChild(f.inner);
    var X = function (i) { return f.x(i + 1); }, g2 = f.inner;
    L.forEach(function (l, i) {
      el("text", { x: X(i), y: f.y(114) + 18, "text-anchor": "middle", class: "viz-small viz-bold", text: l }, g2);
      el("text", { x: X(i), y: f.y(114) + 34, "text-anchor": "middle", class: "viz-small viz-muted", text: coding === "numeric" ? "code " + (i + 1) + " · n " + V.fmt.int(n[i]) : "n " + V.fmt.int(n[i]) }, g2);
    });

    function hline(yv, tag) {
      el("line", { x1: f.x(0.5), x2: f.x(3.9), y1: f.y(yv), y2: f.y(yv), class: "stroke s2 dashed", "stroke-width": 2 }, g2);
      el("text", { x: f.x(3.9) - 2, y: f.y(yv) - 6, "text-anchor": "end", class: "viz-small colour s2 viz-bold", style: HALO, text: tag }, g2);
    }
    function arrow(i, y0, y1, label, ghost) {
      if (Math.abs(f.y(y1) - f.y(y0)) > 10) {
        el("line", { x1: X(i), x2: X(i), y1: f.y(y0), y2: f.y(y1) + (y1 > y0 ? 7 : -7), class: ghost ? "stroke s5 dashed" : "stroke s3", "stroke-width": 2, "marker-end": ghost ? null : "url(#l32w-arrow)" }, g2);
      }
      el("text", { x: X(i) + 12, y: (f.y(y0) + f.y(y1)) / 2 + 4, class: "viz-small viz-bold" + (ghost ? " viz-muted" : " colour s3"), style: HALO, text: label }, g2);
    }

    if (coding === "treatment") {
      hline(m[0], "(Intercept)");
      for (var j2 = 1; j2 < k; j2++) arrow(j2, m[0], m[j2], "smoke" + L[j2] + " " + sg(m[j2] - m[0]));
    } else if (coding === "sum") {
      var gg = (m[0] + m[1] + m[2]) / 3;
      hline(gg, "(Intercept)");
      for (var s2 = 0; s2 < k - 1; s2++) arrow(s2, gg, m[s2], "smoke" + (s2 + 1) + " " + sg(m[s2] - gg));
      arrow(k - 1, gg, m[k - 1], "not printed " + sg(m[k - 1] - gg), true);
    } else if (coding === "none") {
      L.forEach(function (l, i) { el("text", { x: X(i) + 12, y: f.y(m[i]) + 4, class: "viz-small viz-bold colour s3", text: "smoke" + l + " = " + f1(m[i]) }, g2); });
    } else {
      el("line", { x1: X(0) - 30, x2: X(2) + 30, y1: f.y(fitted[0] - (fitted[1] - fitted[0]) * 30 / (X(1) - X(0))), y2: f.y(fitted[2] + (fitted[2] - fitted[1]) * 30 / (X(2) - X(1))), class: "stroke s4" }, g2);
      fitted.forEach(function (fv, i) {
        el("circle", { cx: X(i), cy: f.y(fv), r: 6, class: "stroke s4", "stroke-width": 2 }, g2);
      });
      el("text", { x: f.x(0.5) + 6, y: 16, class: "viz-small colour s4 viz-bold", text: "Straight line through arbitrary codes: slope " + sg(terms[1][1]) + " per “step”; hollow circles are its fitted means" }, g2);
    }
    L.forEach(function (l, i) {
      el("circle", { cx: X(i), cy: f.y(m[i]), r: 6, class: "dot s1" }, g2);
      el("text", { x: X(i) - 12, y: f.y(m[i]) + 4, "text-anchor": "end", class: "viz-small", style: HALO, text: f1(m[i]) }, g2);
    });
  }

  draw();
});
