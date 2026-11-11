// Lecture 3.1 — "What needs rerunning?": a targets-style pipeline DAG for Project 3.
// Click an input or target to mark it changed; everything downstream goes stale (like tar_outdated()).
// Run times are illustrative numbers.
Viz.register("pipeline-stale", function (root) {
  var V = Viz, el = V.el;
  var W = 118, H = 36;
  var Y = [20, 92, 164, 236, 308, 380, 452]; // layer tops

  // kind: "input" (files, code, seed) or "target" (built by the pipeline). min = illustrative run time.
  var N = {
    demo:     { x: 70,  l: 0, kind: "input",  label: "DEMO files", tname: "demo_file" },
    urine:    { x: 200, l: 0, kind: "input",  label: "Urine Na, K file", tname: "urine_file" },
    mort:     { x: 330, l: 0, kind: "input",  label: "Mortality file", tname: "mort_file" },
    cleanR:   { x: 460, l: 0, kind: "input",  label: "R/clean.R" },
    clean:    { x: 265, l: 1, kind: "target", label: "clean", min: 2 },
    analysis: { x: 265, l: 2, kind: "target", label: "analysis_data", min: 1 },
    seed:     { x: 460, l: 2, kind: "input",  label: "mice seed" },
    table1:   { x: 70,  l: 3, kind: "target", label: "table_1", min: 1 },
    imputed:  { x: 265, l: 3, kind: "target", label: "imputed (m = 20)", min: 40 },
    modelsR:  { x: 540, l: 3, kind: "input",  label: "R/models.R" },
    cox:      { x: 265, l: 4, kind: "target", label: "fit_cox", min: 6 },
    fg:       { x: 460, l: 4, kind: "target", label: "fit_finegray", min: 15 },
    tablehr:  { x: 265, l: 5, kind: "target", label: "table_hr", min: 1 },
    cif:      { x: 460, l: 5, kind: "target", label: "fig_cif", min: 1 },
    ms:       { x: 265, l: 6, kind: "target", label: "manuscript", min: 1 }
  };
  var E = [
    ["demo", "clean"], ["urine", "clean"], ["mort", "clean"], ["cleanR", "clean"],
    ["clean", "analysis"], ["analysis", "table1"], ["analysis", "imputed"], ["seed", "imputed"],
    ["imputed", "cox"], ["imputed", "fg"], ["modelsR", "cox"], ["modelsR", "fg"],
    ["cox", "tablehr"], ["fg", "tablehr"], ["fg", "cif"],
    ["tablehr", "ms"], ["cif", "ms"], ["table1", "ms"]
  ];
  var order = Object.keys(N);
  var targets = order.filter(function (k) { return N[k].kind === "target"; });
  var totalMin = targets.reduce(function (s, k) { return s + N[k].min; }, 0);
  var changed = {};

  var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
  el("span", { class: "widget-note", style: "margin:0", text: "Change:" }, pre);
  [
    ["New NHANES data release", ["demo", "urine", "mort"]],
    ["Fix a recode in clean.R", ["cleanR"]],
    ["New mice seed", ["seed"]],
    ["Add a covariate to the models", ["modelsR"]],
    ["Reword the discussion", ["ms"]]
  ].forEach(function (p) {
    V.button(pre, p[0], function () { changed = {}; p[1].forEach(function (k) { changed[k] = true; }); draw(); });
  });
  var runBtn = V.button(pre, "Run tar_make()", function () { changed = {}; draw(); });
  runBtn.style.fontFamily = "var(--font-mono)";

  V.legend(root, [
    { cls: "s4", label: "Input: file, code or seed" },
    { cls: "s1", label: "Target, up to date" },
    { cls: "s2", label: "You changed it" },
    { cls: "s3", label: "Stale: will rerun" }
  ]);

  var c = V.svg(root, 640, 500);
  c.setAttribute("aria-label", "Pipeline graph for Project 3. Inputs at the top feed clean data, the analysis dataset, imputation, Cox and Fine-Gray models, tables, a figure and the manuscript.");
  var defs = el("defs", null, c);
  [["l31w-a", "arrowhead"], ["l31w-s", "dot s3"]].forEach(function (m) {
    var mk = el("marker", { id: m[0], viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, defs);
    el("path", { d: "M0,0L10,5L0,10Z", class: m[1] }, mk);
  });
  var gE = el("g", null, c), gN = el("g", null, c);

  function cx(k) { return N[k].x; }
  function top(k) { return Y[N[k].l]; }

  // Edge geometry: bottom-centre of source to top of target, spreading arrival points a little.
  var edgeEls = E.map(function (e) {
    var a = e[0], b = e[1], d;
    if (a === "table1" && b === "ms") {
      d = "M" + cx(a) + "," + (top(a) + H) + " L" + cx(a) + "," + (top(b) + H / 2) + " L" + (cx(b) - W / 2 - 3) + "," + (top(b) + H / 2);
    } else {
      var off = Math.max(-36, Math.min(36, (cx(a) - cx(b)) * 0.22));
      d = "M" + cx(a) + "," + (top(a) + H) + " L" + (cx(b) + off) + "," + (top(b) - 3);
    }
    return el("path", { d: d }, gE);
  });

  var nodeEls = {};
  order.forEach(function (k) {
    var n = N[k];
    var g = el("g", { tabindex: 0, role: "button", style: "cursor:pointer" }, gN);
    var rect = el("rect", { x: n.x - W / 2, y: top(k), width: W, height: H, rx: 8 }, g);
    if (n.kind === "input") rect.setAttribute("stroke-dasharray", "5 4");
    var t = el("text", { x: n.x, y: top(k) + (n.kind === "target" ? 15 : 22), "text-anchor": "middle", class: "viz-small viz-bold", text: n.label }, g);
    var sub = n.kind === "target" ? el("text", { x: n.x, y: top(k) + 29, "text-anchor": "middle", class: "viz-small viz-muted", text: n.min + " min" }, g) : null;
    function toggle() { changed[k] = !changed[k]; if (!changed[k]) delete changed[k]; draw(); }
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
    el("title", { text: n.label + (n.kind === "input" ? " (input)" : " (target)") }, g);
    nodeEls[k] = { g: g, rect: rect, t: t, sub: sub };
  });

  var out = V.readouts(root, [
    { key: "n", label: "Targets that will rerun", cls: "bad" },
    { key: "min", label: "Rebuild time (illustrative)" },
    { key: "saved", label: "Saved vs rerunning everything", cls: "good" }
  ]);
  var cons = el("pre", { style: "margin:0.9rem 0 0;white-space:pre-wrap" }, root);
  var code = el("code", null, cons);
  el("p", { class: "widget-note", text: "Illustrative run times. Not shown: a package update, which targets ignores unless the package is listed in tar_option_set(imports = …); renv records the versions." }, root);

  function draw() {
    // Stale = changed nodes plus everything reachable downstream of them.
    var stale = {};
    var queue = Object.keys(changed);
    queue.forEach(function (k) { stale[k] = true; });
    while (queue.length) {
      var k = queue.shift();
      E.forEach(function (e) { if (e[0] === k && !stale[e[1]]) { stale[e[1]] = true; queue.push(e[1]); } });
    }
    order.forEach(function (k) {
      var n = N[k], ne = nodeEls[k];
      var cls = changed[k] ? "s2" : stale[k] ? "s3" : n.kind === "input" ? "s4" : "s1";
      ne.g.setAttribute("class", cls);
      ne.rect.setAttribute("class", (changed[k] || stale[k] || n.kind === "target") ? "node-fill" : "node");
      ne.g.setAttribute("aria-pressed", changed[k] ? "true" : "false");
    });
    E.forEach(function (e, i) {
      var hot = stale[e[0]];
      edgeEls[i].setAttribute("class", hot ? "stroke s3" : "edge");
      edgeEls[i].setAttribute("marker-end", hot ? "url(#l31w-s)" : "url(#l31w-a)");
      if (hot) edgeEls[i].setAttribute("style", "stroke-width:2.2"); else edgeEls[i].removeAttribute("style");
    });
    var rerun = targets.filter(function (k) { return stale[k]; });
    var mins = rerun.reduce(function (s, k) { return s + N[k].min; }, 0);
    out.n(rerun.length + " of " + targets.length);
    out.min(mins + " min");
    out.saved((totalMin - mins) + " min");
    // File inputs are targets too (format = "file"), so a changed file is itself listed.
    var listed = order.filter(function (k) { return stale[k] && (N[k].tname || N[k].kind === "target"); });
    code.textContent = "> tar_outdated()\n" + (listed.length
      ? "[1] " + listed.map(function (k) { return '"' + (N[k].tname || N[k].label.replace(/ \(.*\)/, "")) + '"'; }).join(" ")
      : "character(0)    # everything is up to date");
  }
  draw();
});
