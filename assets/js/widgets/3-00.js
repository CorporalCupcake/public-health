// Week 33 diagnostic — per-topic self-rating (Solid / Shaky / Gap) and a live gap-fill plan.
// Rating controls are injected into every [data-topic] box on the page; the summary lives in
// the data-widget="diagnostic-tracker" root. Ratings persist in localStorage ("ph-b3-diagnostic").
Viz.register("diagnostic-tracker", function (root) {
  var V = Viz, el = V.el, KEY = "ph-b3-diagnostic";
  var LABEL = { solid: "Solid", shaky: "Shaky", gap: "Gap" };

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(r) {
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {}
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var ratings = load();
  var topics = [];
  var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-topic]"));

  function buildRater(box) {
    var key = box.getAttribute("data-topic");
    var t = {
      key: key,
      label: box.getAttribute("data-label") || key,
      source: box.getAttribute("data-source") || "",
      feeds: box.getAttribute("data-feeds") || "",
      section: box.closest("section") ? box.closest("section").id : ""
    };
    topics.push(t);
    // Rebuild cleanly (keeps the title, drops anything a previous run added)
    Array.prototype.slice.call(box.querySelectorAll(".diag-rate-ui")).forEach(function (n) { n.remove(); });
    var ui = el("div", { class: "diag-rate-ui", style: "display:flex;flex-wrap:wrap;gap:0.6rem 1rem;align-items:center" }, box);
    V.toggle(ui, {
      options: [{ value: "solid", label: "Solid" }, { value: "shaky", label: "Shaky" }, { value: "gap", label: "Gap" }],
      value: ratings[key] || null,
      onChange: function (v) { ratings[key] = v; save(ratings); status(); render(); }
    });
    var st = el("span", { class: "widget-note", style: "margin:0" }, ui);
    function status() {
      var v = ratings[key];
      st.textContent = !v ? "Not rated yet. Mark the topic first, then choose."
        : v === "solid" ? "Skip this topic in weeks 34–36."
        : v === "shaky" ? "A short refresher note in weeks 34–36."
        : "A full gap-fill note, scheduled first.";
    }
    status();
  }
  boxes.forEach(buildRater);

  // Summary ---------------------------------------------------------------------
  var out = V.readouts(root, [
    { key: "solid", label: "Solid: skip", cls: "good" },
    { key: "shaky", label: "Shaky: short refresher" },
    { key: "gap", label: "Gap: full note", cls: "bad" },
    { key: "none", label: "Not yet rated" }
  ]);
  var plan = el("div", { style: "margin-top:1rem" }, root);
  var foot = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;margin-top:0.9rem" }, root);
  V.button(foot, "Clear all ratings", function () {
    if (!window.confirm("Clear all nine ratings?")) return;
    ratings = {}; save(ratings);
    topics = [];
    boxes.forEach(function (b) { buildRater(b); });
    render();
  });
  el("span", { class: "widget-note", style: "margin:0", text: "Stored in this browser only (localStorage)." }, foot);

  function link(parent, t) {
    var a = el("a", { href: "#" + t.section, text: t.label }, parent);
    return a;
  }

  function render() {
    var n = { solid: 0, shaky: 0, gap: 0, none: 0 };
    var gaps = [], shaky = [];
    topics.forEach(function (t) {
      var v = ratings[t.key];
      if (!v) n.none++; else n[v]++;
      if (v === "gap") gaps.push(t);
      if (v === "shaky") shaky.push(t);
    });
    out.solid(String(n.solid)); out.shaky(String(n.shaky)); out.gap(String(n.gap)); out.none(String(n.none));

    clear(plan);
    var todo = gaps.concat(shaky);
    if (n.none === topics.length) {
      el("p", { style: "margin:0", text: "No topics rated yet. Work through a topic closed book, mark it against the model answers, then rate it. The plan appears here." }, plan);
      return;
    }
    if (todo.length === 0 && n.none === 0) {
      el("p", { style: "margin:0 0 0.4rem", html: "<strong>No gaps.</strong> Skip weeks 34–36: start Lecture 3.1 in week 34, and every later block moves up three weeks." }, plan);
      el("p", { class: "widget-note", style: "margin:0", text: "Worth a second look anyway: any topic where you hesitated even though the answer was right." }, plan);
      return;
    }
    if (todo.length === 0) {
      el("p", { style: "margin:0", text: "Everything rated so far is Solid. Rate the remaining " + n.none + " topic" + (n.none === 1 ? "" : "s") + " to confirm whether the lectures can start in week 34." }, plan);
      return;
    }

    el("p", { style: "margin:0 0 0.5rem", html: "<strong>Gap-fill in weeks 34–36</strong> (Gap topics first, then Shaky):" }, plan);
    var ol = el("ol", { style: "margin:0 0 0.8rem" }, plan);
    todo.forEach(function (t) {
      var li = el("li", null, ol);
      link(li, t);
      el("span", { text: " · " + LABEL[ratings[t.key]] + (ratings[t.key] === "gap" ? ", full note" : ", short refresher") + ". Read: " + t.source + ". Needed for " + t.feeds + "." }, li);
    });

    // Spread the notes evenly over the three weeks, in priority order.
    var weeks = [[], [], []];
    todo.forEach(function (t, i) { weeks[Math.floor(i * 3 / todo.length)].push(t.label); });
    var tbl = el("div", { class: "table-wrap", style: "margin:0.4rem 0 0.6rem" }, plan);
    var table = el("table", null, tbl);
    var head = el("tr", null, el("thead", null, table));
    el("th", { text: "Week" }, head); el("th", { text: "Notes" }, head);
    var body = el("tbody", null, table);
    [34, 35, 36].forEach(function (w, i) {
      var tr = el("tr", null, body);
      el("td", { text: "Week " + w }, tr);
      el("td", { text: weeks[i].length ? weeks[i].join("; ") : "Spare: revisit anything still shaky, or start Lecture 3.1 early" }, tr);
    });
    if (n.none) el("p", { class: "widget-note", style: "margin:0", text: n.none + " topic" + (n.none === 1 ? " is" : "s are") + " not rated yet; the plan will change once " + (n.none === 1 ? "it is" : "they are") + "." }, plan);
  }
  render();
});
