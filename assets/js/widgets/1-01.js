// Lecture 1.1 — "Tag an intervention" quiz: core function, level of prevention, domain.
// Every example and answer comes from the lecture text. Some examples only ask the lenses the lecture answers.
Viz.register("classify-intervention", function (root) {
  var V = Viz, el = V.el;

  var LENSES = {
    fn: {
      q: "Core function: what job does it do?",
      options: [["assessment", "Assessment"], ["policy", "Policy development"], ["assurance", "Assurance"]]
    },
    lvl: {
      q: "Level of prevention: when does it act?",
      options: [["primordial", "Primordial"], ["primary", "Primary"], ["secondary", "Secondary"], ["tertiary", "Tertiary"], ["quaternary", "Quaternary"], ["none", "None"]]
    },
    dom: {
      q: "Domain: which area of practice?",
      options: [["protection", "Health protection"], ["improvement", "Health improvement"], ["hcph", "Healthcare public health"]]
    }
  };

  // ok: accepted answers; why: the explanation shown after any answer.
  var EXAMPLES = [
    { name: "A tax on sugary drinks",
      fn: { ok: ["policy"], why: "It is a rule set by government: policy development." },
      lvl: { ok: ["primordial", "primary"], why: "Both are accepted. It acts early, on everyone, before any disease. It reaches many people at low cost, but each gains little." },
      dom: { ok: ["improvement"], why: "It shapes how people live, here what they drink: health improvement." } },
    { name: "A statin for a 55-year-old with high cholesterol and no heart disease",
      lvl: { ok: ["primary"], why: "For heart attack and stroke, the risk factor is present but the disease isn’t: primary. If you name high cholesterol as the condition, the statin is treatment of an existing condition. Always say “prevention of what”." } },
    { name: "Inspecting bakeries and testing bread for salt",
      fn: { ok: ["assurance"], why: "It makes sure the salt rule is carried out. Enforcement means assurance. The test results also feed the next assessment, closing the loop." } },
    { name: "Heat rules for outdoor workers",
      dom: { ok: ["protection"], why: "Heat is something external acting on people. That is health protection." } },
    { name: "A legal limit on salt in bread",
      fn: { ok: ["policy"], why: "It sets a rule. A decision or rule means policy development. Inspecting bakeries to enforce it would be assurance." },
      lvl: { ok: ["primordial", "primary"], why: "Both are right; it depends on the disease you name. For high blood pressure it is primordial: fewer people develop it. For stroke it is primary: risk falls before any stroke happens." },
      dom: { ok: ["improvement"], why: "It changes what people eat to prevent chronic disease. That is health improvement." } },
    { name: "Cardiac rehabilitation after a heart attack",
      lvl: { ok: ["tertiary"], why: "The disease is established. Rehabilitation limits damage, disability and recurrence: tertiary." } },
    { name: "A survey measuring salt intake from 24-hour urine",
      fn: { ok: ["assessment"], why: "It produces data about the population’s health and what drives it. Data means assessment." },
      lvl: { ok: ["none"], why: "None. It measures; it doesn’t prevent anything by itself." },
      dom: { ok: ["improvement"], why: "What it measures, diet as a driver of chronic disease, belongs to health improvement." } },
    { name: "Deciding where cardiac services go",
      dom: { ok: ["hcph"], why: "It is about planning health services for the population: healthcare public health." } },
    { name: "Meningococcal vaccination required of Hajj pilgrims",
      fn: { ok: ["policy", "assurance"], why: "Both count. The requirement is a rule (policy development), and it is enforced through assurance." },
      lvl: { ok: ["primary"], why: "The pilgrim is healthy, and the vaccine stops the disease starting. That is primary prevention." },
      dom: { ok: ["protection"], why: "An infection spreading at a mass gathering is an external threat. Guarding against it is health protection." } },
    { name: "Not screening healthy people with tests that mostly find harmless abnormalities",
      lvl: { ok: ["quaternary"], why: "It protects people from too much medicine: quaternary." } },
    { name: "Promoting heat-safe behaviour among pilgrims",
      dom: { ok: ["improvement"], why: "It is about how people behave: health improvement. Hajj alone involves all three domains." } },
    { name: "Diabetes screening in primary care",
      fn: { ok: ["assurance"], why: "A service is delivered to people. Delivery means assurance." },
      lvl: { ok: ["secondary"], why: "The disease may already be present, with no symptoms yet. Screening catches it early: secondary." },
      dom: { ok: ["hcph"], why: "It is about how the health service serves the population: healthcare public health." } }
  ];

  // --- Layout
  var nav = el("div", { style: "display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;margin:0.2rem 0 0.8rem;font-family:var(--font-ui)" }, root);
  var prev = V.button(nav, "← Previous", function () { go(-1); });
  var counter = el("span", { style: "font-size:0.85rem;color:var(--muted);font-variant-numeric:tabular-nums" }, nav);
  var next = V.button(nav, "Next →", function () { go(1); });

  var card = el("div", { style: "background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.8rem 0.9rem;font-family:var(--font-ui)" }, root);
  var title = el("div", { style: "font-size:1.05rem;font-weight:700;margin-bottom:0.2rem;color:var(--text)" }, card);
  var body = el("div", null, card);

  var score = el("p", { class: "widget-note" }, root);

  // first-try results across the whole quiz: key "i:lens" → true/false
  var firstTry = {};
  var picked = {};   // key → chosen option value (so answers persist when you go back)
  var idx = 0;

  function styleBtn(b, state) {
    var base = "margin:0;padding:0.35rem 0.8rem;";
    if (state === "right") b.setAttribute("style", base + "background:var(--accent);color:var(--bg);border-color:var(--accent)");
    else if (state === "wrong") b.setAttribute("style", base + "border-color:var(--pitfall);color:var(--pitfall)");
    else if (state === "reveal") b.setAttribute("style", base + "border-color:var(--accent);color:var(--accent);border-style:dashed");
    else b.setAttribute("style", base + "border-color:var(--border);color:var(--text)");
  }

  function renderLens(ex, key) {
    var lens = LENSES[key], ans = ex[key], k = idx + ":" + key;
    var block = el("div", { style: "margin-top:0.85rem" }, body);
    el("div", { text: lens.q, style: "font-size:0.85rem;color:var(--muted);margin-bottom:0.35rem" }, block);
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.4rem" }, block);
    var fb = el("p", { style: "font-size:0.88rem;line-height:1.45;margin:0.45rem 0 0;color:var(--text)" }, block);
    var btns = lens.options.map(function (o) {
      var b = V.button(row, o[1], function () { choose(o[0]); });
      b.setAttribute("aria-pressed", "false");
      return [b, o[0]];
    });
    function paint() {
      var c = picked[k];
      btns.forEach(function (p) {
        var good = ans.ok.indexOf(p[1]) >= 0;
        if (c === undefined) styleBtn(p[0], "idle");
        else if (p[1] === c) styleBtn(p[0], good ? "right" : "wrong");
        else if (good && ans.ok.indexOf(c) < 0) styleBtn(p[0], "reveal");
        else styleBtn(p[0], "idle");
        p[0].setAttribute("aria-pressed", p[1] === c);
      });
      fb.textContent = "";
      if (c === undefined) return;
      var right = ans.ok.indexOf(c) >= 0;
      el("strong", { text: right ? "Right. " : "Not quite. ", style: "color:" + (right ? "var(--accent)" : "var(--pitfall)") }, fb);
      if (!right) {
        var names = ans.ok.map(function (v) { return lens.options.filter(function (o) { return o[0] === v; })[0][1]; });
        fb.appendChild(document.createTextNode("Answer: " + names.join(" or ") + ". "));
      }
      fb.appendChild(document.createTextNode(ans.why));
    }
    function choose(v) {
      if (!(k in firstTry)) firstTry[k] = ans.ok.indexOf(v) >= 0;
      picked[k] = v;
      paint(); updateScore();
    }
    paint();
  }

  function updateScore() {
    var keys = Object.keys(firstTry), right = keys.filter(function (k) { return firstTry[k]; }).length;
    var total = 0;
    EXAMPLES.forEach(function (ex) { ["fn", "lvl", "dom"].forEach(function (l) { if (ex[l]) total++; }); });
    score.textContent = keys.length
      ? "Right first time: " + right + " of " + keys.length + " answered (" + total + " questions in all)."
      : "Some examples only ask about one or two lenses: the ones the lecture gives an answer for.";
  }

  function render() {
    var ex = EXAMPLES[idx];
    counter.textContent = "Example " + (idx + 1) + " of " + EXAMPLES.length;
    prev.disabled = idx === 0; next.disabled = idx === EXAMPLES.length - 1;
    prev.style.opacity = prev.disabled ? 0.4 : 1; next.style.opacity = next.disabled ? 0.4 : 1;
    title.textContent = ex.name;
    body.textContent = "";
    ["fn", "lvl", "dom"].forEach(function (l) { if (ex[l]) renderLens(ex, l); });
  }

  function go(d) { idx = Math.max(0, Math.min(EXAMPLES.length - 1, idx + d)); render(); }

  render(); updateScore();
});
