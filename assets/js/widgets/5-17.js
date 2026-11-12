// Lecture 5.17 — a reporting-guideline chooser. Maps a study description to guideline(s) and design-stage items.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var TYPES = [
    { value: "predict", label: "Prediction model: develop or validate" },
    { value: "diag", label: "Diagnostic accuracy study" },
    { value: "early", label: "First live use with clinicians" },
    { value: "protocol", label: "Randomised trial: protocol" },
    { value: "report", label: "Randomised trial: report" },
    { value: "drug", label: "Drug study on routine data" },
    { value: "tte", label: "Target trial emulation" }
  ];

  // Items most worth settling before data collection, by study type.
  var BASE = {
    predict: ["Outcome definition and prediction horizon", "Sample size for development and validation", "Calibration as well as discrimination, with a validation strategy"],
    diag: ["Reference standard and the time between index test and reference", "Patient flow, including who was excluded and why", "Pre-specified threshold for a positive result"],
    early: ["Who the users are, how they were recruited and trained", "Safety: how errors and harms are captured during the study", "Learning curves and any changes to the tool mid-study"],
    protocol: ["Primary outcome and estimand", "Sample size, including clustering if randomising teams or sites", "Pre-specified analysis plan"],
    report: ["Participant flow diagram", "Primary outcome with effect size and confidence interval", "Harms, and deviations from the protocol"],
    drug: ["Drug exposure source: prescribed, dispensed or administered", "Design diagram: washout, lookback, time zero and follow-up", "Confounding by indication, healthy adherer and sick stopper"],
    tte: ["The target trial table: eligibility, strategies, assignment, time zero, follow-up, outcome, estimand", "How time zero aligns eligibility, assignment and start of follow-up", "How the emulation departs from the target trial"]
  };
  var AI = {
    predict: ["Model version, and code or tool availability", "Fairness: performance by subgroup", "Input data quality and how missing inputs are handled"],
    diag: ["Input data acquisition: devices, settings, quality checks", "Error analysis: how the model fails", "Model version and whether it was frozen"],
    early: ["Human–AI interaction: what users see and how it feeds decisions", "Modifications to the algorithm during the study", "Input data quality and missing inputs"],
    protocol: ["Intended use: problem, users, place in the pathway", "Plan for poor-quality or unavailable input data", "Human–AI interaction, and the frozen model version"],
    report: ["Intended use and the AI version used", "Handling of poor-quality or unavailable input data", "Error analysis, and access to code or the tool"],
    drug: ["Any ML step (phenotyping, propensity model): inputs, version, validation"],
    tte: ["Any ML step (phenotyping, propensity model): inputs, version, validation"]
  };

  Viz.register("guideline-chooser", function (root) {
    var ctr = V.controls(root);
    var row = el("label", { class: "widget-slider" }, ctr);
    el("span", { class: "widget-slider-label", text: "Study type" }, el("span", { class: "widget-slider-head" }, row));
    var sel = el("select", { "aria-label": "Study type", style: "font:inherit;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:inherit;max-width:100%" }, row);
    TYPES.forEach(function (t) { el("option", { value: t.value, text: t.label }, sel); });
    sel.value = "report";
    sel.addEventListener("change", draw);

    var aiWrap = el("div", { class: "widget-slider" }, ctr);
    el("span", { class: "widget-slider-label", text: "AI component" }, aiWrap);
    var ai = V.toggle(aiWrap, { options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], value: "yes", onChange: draw });

    var modWrap = el("div", { class: "widget-slider" }, ctr);
    el("span", { class: "widget-slider-label", text: "Data type" }, modWrap);
    var mod = V.toggle(modWrap, { options: [{ value: "tab", label: "Tabular or signal" }, { value: "img", label: "Imaging" }, { value: "llm", label: "Text (LLM)" }], value: "tab", onChange: draw });

    var out = el("div", { style: "margin-top:0.6rem" }, root);

    function choose(t, isAI, m) {
      var main = [], extra = [];
      if (t === "predict") {
        main.push("TRIPOD+AI (2024): covers regression and machine learning models alike");
        if (isAI && m === "llm") main.push("TRIPOD-LLM (2025) for the large language model");
        if (isAI && m === "img") extra.push("CLAIM 2024 update for the imaging pipeline");
        extra.push("PROBAST+AI to appraise risk of bias (appraisal, not reporting)");
      } else if (t === "diag") {
        main.push(isAI ? "STARD 2015 plus the STARD-AI items (2025)" : "STARD 2015");
        if (isAI && m === "img") extra.push("CLAIM 2024 update for the imaging pipeline");
        if (isAI && m === "llm") extra.push("TRIPOD-LLM (2025) for the large language model");
      } else if (t === "early") {
        if (isAI) main.push("DECIDE-AI (2022)");
        else main.push("No AI guideline applies: DECIDE-AI is AI-specific. Use the guideline that fits your design (for example STROBE)");
        if (isAI && m === "llm") extra.push("TRIPOD-LLM (2025) for the model itself");
      } else if (t === "protocol") {
        main.push(isAI ? "SPIRIT 2025 plus the SPIRIT-AI items (2020)" : "SPIRIT 2025");
        extra.push("If randomising teams or sites: the cluster or stepped-wedge items (Lecture 5.15)");
      } else if (t === "report") {
        main.push(isAI ? "CONSORT 2025 plus the CONSORT-AI items (2020)" : "CONSORT 2025");
        extra.push("If randomising teams or sites: the CONSORT cluster or stepped-wedge extension");
      } else if (t === "drug") {
        main.push("STROBE, RECORD and RECORD-PE (2018)");
        extra.push("TARGET (2025) as well, if the study emulates a target trial");
        if (isAI) extra.push("No AI-specific extension for observational studies: describe the ML step plainly");
      } else if (t === "tte") {
        main.push("TARGET (2025)");
        extra.push("RECORD-PE (2018) as well, if the exposure is a drug and the data are routine records");
        if (isAI) extra.push("No AI-specific extension for observational studies: describe the ML step plainly");
      }
      // Keep the list short: three base items, or two base items plus the AI items (at most five).
      var nBase = isAI ? 2 : 3;
      var items = BASE[t].slice(0, nBase);
      if (isAI) items = items.concat(AI[t]);
      return { main: main, extra: extra, items: items, nBase: nBase };
    }

    function draw() {
      var isAI = ai.value() === "yes";
      modWrap.style.opacity = isAI ? "1" : "0.45";
      var r = choose(sel.value, isAI, mod.value());
      clear(out);
      el("div", { class: "widget-slider-label", text: "Follow", style: "font-weight:600" }, out);
      var ul = el("ul", { style: "margin:0.2rem 0 0.6rem;padding-left:1.2rem" }, out);
      r.main.forEach(function (s) { el("li", { text: s }, ul); });
      if (r.extra.length) {
        el("div", { class: "widget-slider-label", text: "Also consider", style: "font-weight:600" }, out);
        ul = el("ul", { style: "margin:0.2rem 0 0.6rem;padding-left:1.2rem" }, out);
        r.extra.forEach(function (s) { el("li", { text: s }, ul); });
      }
      el("div", { class: "widget-slider-label", text: "Settle these at the design stage", style: "font-weight:600" }, out);
      var ol = el("ol", { style: "margin:0.2rem 0 0;padding-left:1.4rem" }, out);
      r.items.forEach(function (s, i) { el("li", { text: s + (isAI && i >= r.nBase ? " (AI item)" : "") }, ol); });
      el("p", { class: "widget-note", text: "A guide to the main options, not a complete list. Check the EQUATOR Network for the current version before submission." }, out);
    }
    draw();
  });
})();
