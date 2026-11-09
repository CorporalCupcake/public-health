// Viz: a tiny, dependency-free kit for lecture diagrams and interactive widgets.
// Works offline. Colours come from CSS variables, so everything follows dark/light mode.
//
// Usage in a lecture:
//   <div class="widget" data-widget="markov-cohort"></div>
//   <script defer src="../../assets/js/viz.js"></script>
//   <script defer src="../../assets/js/widgets/1-11.js"></script>
// and in the widget file:
//   Viz.register("markov-cohort", function (root) { ... });
//
// Series colours: CSS classes s1..s5 (accent, amber, red, indigo, grey).
(function () {
  var SVGNS = "http://www.w3.org/2000/svg";
  var registry = {};

  function el(tag, attrs, parent) {
    var isSvg = /^(svg|g|path|line|rect|circle|text|tspan|polyline|polygon|defs|marker|title|clipPath)$/.test(tag);
    var node = isSvg ? document.createElementNS(SVGNS, tag) : document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  // Responsive SVG with a fixed coordinate system (viewBox).
  function svg(parent, w, h, cls) {
    var s = el("svg", { viewBox: "0 0 " + w + " " + h, class: "viz-svg" + (cls ? " " + cls : ""), role: "img" }, parent);
    s.W = w; s.H = h;
    return s;
  }

  // Linear scale: f(x) maps domain → range; f.invert maps back.
  function scale(d0, d1, r0, r1) {
    var f = function (x) { return r0 + (x - d0) * (r1 - r0) / (d1 - d0); };
    f.invert = function (y) { return d0 + (y - r0) * (d1 - d0) / (r1 - r0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  }

  function ticks(d0, d1, n) {
    var span = d1 - d0, step = Math.pow(10, Math.floor(Math.log10(span / (n || 5))));
    var err = (n || 5) / (span / step);
    if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
    var out = [], start = Math.ceil(d0 / step) * step;
    for (var v = start; v <= d1 + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function line(points) {
    return points.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2); }).join("");
  }
  // Closed area between a top line and a bottom line (both left→right).
  function area(top, bottom) {
    return line(top) + bottom.slice().reverse().map(function (p) { return "L" + p[0].toFixed(2) + "," + p[1].toFixed(2); }).join("") + "Z";
  }

  // A plot frame: margins, scales, gridlines, axes, labels. Returns {g, x, y, inner}.
  function frame(s, o) {
    var m = Object.assign({ top: 14, right: 16, bottom: 42, left: 52 }, o.margin || {});
    var x = scale(o.x[0], o.x[1], m.left, s.W - m.right);
    var y = scale(o.y[0], o.y[1], s.H - m.bottom, m.top);
    var g = el("g", { class: "viz-frame" }, s);
    var fx = o.fmtX || String, fy = o.fmtY || String;
    (o.yTicks || ticks(o.y[0], o.y[1], 5)).forEach(function (t) {
      el("line", { x1: m.left, x2: s.W - m.right, y1: y(t), y2: y(t), class: "viz-grid" }, g);
      el("text", { x: m.left - 8, y: y(t), class: "viz-tick", "text-anchor": "end", "dominant-baseline": "middle", text: fy(t) }, g);
    });
    (o.xTicks || ticks(o.x[0], o.x[1], 6)).forEach(function (t) {
      el("text", { x: x(t), y: s.H - m.bottom + 16, class: "viz-tick", "text-anchor": "middle", text: fx(t) }, g);
    });
    el("line", { x1: m.left, x2: s.W - m.right, y1: y(o.y[0]), y2: y(o.y[0]), class: "viz-axis" }, g);
    el("line", { x1: m.left, x2: m.left, y1: y(o.y[0]), y2: m.top, class: "viz-axis" }, g);
    if (o.xLabel) el("text", { x: (m.left + s.W - m.right) / 2, y: s.H - 6, class: "viz-label", "text-anchor": "middle", text: o.xLabel }, g);
    if (o.yLabel) el("text", { x: 12, y: (m.top + s.H - m.bottom) / 2, class: "viz-label", "text-anchor": "middle", transform: "rotate(-90 12 " + (m.top + s.H - m.bottom) / 2 + ")", text: o.yLabel }, g);
    var inner = el("g", { class: "viz-inner" }, s);
    return { g: g, x: x, y: y, inner: inner, m: m };
  }

  // Controls -----------------------------------------------------------------
  function controls(parent) { return el("div", { class: "widget-controls" }, parent); }

  // slider(parent, {label, min, max, step, value, fmt, onInput}) → {value(), set(v)}
  function slider(parent, o) {
    var row = el("label", { class: "widget-slider" }, parent);
    var head = el("span", { class: "widget-slider-head" }, row);
    el("span", { class: "widget-slider-label", text: o.label }, head);
    var out = el("output", { class: "widget-slider-value" }, head);
    var input = el("input", { type: "range", min: o.min, max: o.max, step: o.step || 1, value: o.value }, row);
    var fmt = o.fmt || String;
    function show() { out.textContent = fmt(+input.value); }
    input.addEventListener("input", function () { show(); if (o.onInput) o.onInput(+input.value); });
    show();
    return { value: function () { return +input.value; }, set: function (v) { input.value = v; show(); }, input: input };
  }

  // toggle(parent, {options:[{value,label}], value, onChange}) → segmented buttons
  function toggle(parent, o) {
    var wrap = el("div", { class: "widget-toggle", role: "group" }, parent);
    var cur = o.value, btns = [];
    o.options.forEach(function (opt) {
      var b = el("button", { type: "button", text: opt.label }, wrap);
      b.addEventListener("click", function () { cur = opt.value; paint(); if (o.onChange) o.onChange(cur); });
      btns.push([b, opt.value]);
    });
    function paint() { btns.forEach(function (p) { p[0].classList.toggle("on", p[1] === cur); p[0].setAttribute("aria-pressed", p[1] === cur); }); }
    paint();
    return { value: function () { return cur; } };
  }

  function button(parent, label, onClick) {
    var b = el("button", { type: "button", class: "widget-button", text: label }, parent);
    b.addEventListener("click", onClick);
    return b;
  }

  // readouts(parent, [{key, label}]) → {key: setter(text)}
  function readouts(parent, items) {
    var wrap = el("div", { class: "widget-readouts" }, parent), set = {};
    items.forEach(function (it) {
      var box = el("div", { class: "widget-readout" + (it.cls ? " " + it.cls : "") }, wrap);
      var v = el("div", { class: "widget-readout-value", text: "–" }, box);
      el("div", { class: "widget-readout-label", text: it.label }, box);
      set[it.key] = function (t) { v.textContent = t; };
    });
    return set;
  }

  function legend(parent, items) {
    var wrap = el("div", { class: "widget-legend" }, parent);
    items.forEach(function (it) {
      var i = el("span", { class: "widget-legend-item" }, wrap);
      el("span", { class: "swatch " + it.cls + (it.dashed ? " dashed" : "") }, i);
      el("span", { text: it.label }, i);
    });
    return wrap;
  }

  // Seeded random numbers (so PSA-style widgets are reproducible) -----------------
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  function normal(rand) {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var fmt = {
    pct: function (x) { return Math.round(x * 100) + "%"; },
    pct1: function (x) { return (x * 100).toFixed(1) + "%"; },
    num: function (x, d) { return Number(x).toLocaleString("en-GB", { maximumFractionDigits: d === undefined ? 1 : d, minimumFractionDigits: d === undefined ? 0 : d }); },
    int: function (x) { return Math.round(x).toLocaleString("en-GB"); },
    signed: function (x, d) { var s = fmt.num(Math.abs(x), d); return (x > 0 ? "+" : x < 0 ? "−" : "") + s; }
  };

  function register(name, fn) { registry[name] = fn; }

  function init() {
    document.querySelectorAll("[data-widget]").forEach(function (root) {
      var fn = registry[root.getAttribute("data-widget")];
      if (!fn || root.dataset.ready) return;
      root.dataset.ready = "1";
      try { fn(root); } catch (e) { root.textContent = "This interactive failed to load."; console.error(e); }
    });
  }

  window.Viz = {
    el: el, svg: svg, scale: scale, ticks: ticks, line: line, area: area, frame: frame,
    controls: controls, slider: slider, toggle: toggle, button: button, readouts: readouts, legend: legend,
    rng: rng, normal: normal, fmt: fmt, register: register, init: init
  };
  // Widget files load after this one (defer keeps order), so init on DOMContentLoaded.
  document.addEventListener("DOMContentLoaded", init);
})();
