// Lecture 5.6 — (1) one patient's journey seen through different data sources;
// (2) a tiny OMOP CDM explorer: source codes → standard concepts, and how a cohort
// definition walks the tables. The patient is made up.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // 1. What does each data source see?
  // status: 2 = recorded in full, 1 = partly (e.g. code without values), 0 = not seen
  var EVENTS = [
    { when: "Jan", what: "GP visit, BP 162/95",
      s: { claims: [1, "diagnosis code, no BP value"], ehr: [2, "visit, BP reading, notes"], nordic: [0, "primary care not in patient register"], icu: [0, "outside the hospital"] } },
    { when: "Jan", what: "Amlodipine prescribed",
      s: { claims: [0, "only dispensings are billed"], ehr: [2, "order recorded"], nordic: [0, "prescriptions written are not kept"], icu: [0, "outside the hospital"] } },
    { when: "Jan", what: "Amlodipine dispensed",
      s: { claims: [2, "pharmacy claim, days’ supply"], ehr: [0, "pharmacy not linked"], nordic: [2, "prescription registry"], icu: [0, "outside the hospital"] } },
    { when: "Mar", what: "Buys aspirin over the counter",
      s: { claims: [0, "not reimbursed"], ehr: [1, "only if noted on med list"], nordic: [0, "OTC sales not linked to people"], icu: [1, "only if noted at admission"] } },
    { when: "Jun", what: "Changes job and insurer",
      s: { claims: [0, "disenrolled: observation ends"], ehr: [2, "no change"], nordic: [2, "no change"], icu: [2, "no change"] } },
    { when: "Aug", what: "ED visit: palpitations, ECG shows AF",
      s: { claims: [0, "now billed to another insurer"], ehr: [2, "triage, ECG, diagnosis"], nordic: [1, "ED diagnosis code"], icu: [2, "ED module, linked ECG"] } },
    { when: "Aug", what: "ICU: sepsis, new-onset AF",
      s: { claims: [0, "after disenrolment"], ehr: [2, "diagnoses, notes"], nordic: [1, "discharge diagnosis codes"], icu: [2, "charted rhythm; billing codes undated"] } },
    { when: "Aug", what: "Hourly vitals, lactate, SOFA inputs",
      s: { claims: [0, "never in claims"], ehr: [2, "flowsheets, labs"], nordic: [0, "no clinical values"], icu: [2, "minute-to-hourly detail"] } },
    { when: "Aug", what: "IV heparin infusion",
      s: { claims: [0, "after disenrolment"], ehr: [2, "administration record"], nordic: [0, "in-hospital drugs not in registry"], icu: [2, "dose, rate, times"] } },
    { when: "Sep", what: "Discharged on apixaban",
      s: { claims: [0, "after disenrolment"], ehr: [1, "discharge prescription only"], nordic: [2, "dispensing recorded"], icu: [0, "follow-up ends at discharge"] } },
    { when: "Nov", what: "Stroke, admitted elsewhere",
      s: { claims: [0, "after disenrolment"], ehr: [0, "other hospital system"], nordic: [2, "national patient register"], icu: [0, "other hospital"] } },
    { when: "Feb", what: "Dies at home",
      s: { claims: [0, "after disenrolment"], ehr: [0, "unless linked to death records"], nordic: [2, "cause of death register"], icu: [2, "state death record, ≤1 year"] } }
  ];

  V.register("source-journey", function (root) {
    var tg = V.toggle(root, { options: [
      { value: "claims", label: "US commercial claims" },
      { value: "ehr", label: "One hospital system’s EHR" },
      { value: "nordic", label: "Nordic registries" },
      { value: "icu", label: "ICU database (MIMIC-IV)" }
    ], value: "claims", onChange: draw });
    el("div", { style: "height:0.4rem" }, root);
    V.legend(root, [
      { cls: "s1", label: "Recorded" },
      { cls: "s2", label: "Partly recorded" },
      { cls: "s5", label: "Not seen" }
    ]);
    var H = 30 + EVENTS.length * 32;
    var c = V.svg(root, 640, H);
    c.setAttribute("aria-label", "A timeline of twelve events in one patient's year, each marked as recorded, partly recorded or not seen by the chosen data source, with the reason");
    var host = el("g", null, c);
    var out = V.readouts(root, [
      { key: "full", label: "Events recorded in full" },
      { key: "part", label: "Partly recorded" },
      { key: "miss", label: "Not seen" },
      { key: "blind", label: "Biggest blind spot" }
    ]);
    el("p", { class: "widget-note", text: "A made-up patient, simplified. Real sources vary: some claims databases link death records, some EHRs share records across hospitals, and Nordic registers differ by country. MIMIC-IV records out-of-hospital deaths from state records up to a year after the last discharge." }, root);

    var BLIND = {
      claims: "After disenrolment",
      ehr: "Other hospitals",
      nordic: "Clinical detail",
      icu: "Outside the stay"
    };

    function draw() {
      var src = tg.value();
      clear(host);
      var lineX = 70;
      el("line", { x1: lineX, x2: lineX, y1: 14, y2: H - 10, class: "edge" }, host);
      el("text", { x: 20, y: 12, class: "viz-small viz-muted", text: "Year 1 → Year 2" }, host);
      var n = [0, 0, 0];
      EVENTS.forEach(function (ev, i) {
        var y = 34 + i * 32, st = ev.s[src];
        n[st[0]]++;
        var cls = st[0] === 2 ? "s1" : st[0] === 1 ? "s2" : "s5";
        if (src === "claims" && i === 4) {
          el("line", { x1: 20, x2: 620, y1: y + 16, y2: y + 16, class: "stroke s3 dashed", style: "stroke-width:1.5" }, host);
        }
        el("text", { x: 20, y: y, "dominant-baseline": "middle", class: "viz-tick", text: ev.when }, host);
        el("circle", { cx: lineX, cy: y, r: 7, class: st[0] ? "dot " + cls : cls, style: st[0] ? "" : "fill:var(--surface);stroke:var(--sc);stroke-width:2" }, host);
        el("text", { x: 88, y: y, "dominant-baseline": "middle", class: st[0] ? "viz-bold" : "viz-muted", style: "font-size:12.5px", text: ev.what }, host);
        el("text", { x: 372, y: y, "dominant-baseline": "middle", class: "viz-small " + (st[0] ? "colour " + cls : "viz-muted"), text: (st[0] === 2 ? "✓ " : st[0] === 1 ? "◐ " : "✗ ") + st[1] }, host);
      });
      out.full(n[2] + " of " + EVENTS.length);
      out.part(String(n[1]));
      out.miss(String(n[0]));
      out.blind(BLIND[src]);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // 2. OMOP explorer
  // Concept IDs shown are the OMOP standard concept_ids where verified; drug concepts
  // are shown by RxNorm code (look up concept_ids in Athena).
  var TABLES = [
    { name: "person", cols: ["person_id", "gender_concept_id", "year_of_birth"],
      rows: [{ id: "p", v: ["1001", { c: "male" }, "2112"] }] },
    { name: "observation_period", cols: ["person_id", "observation_period_start_date", "observation_period_end_date"],
      rows: [{ id: "op", v: ["1001", "2180-08-14", "2180-10-02"] }] },
    { name: "visit_occurrence", cols: ["visit_occurrence_id", "visit_concept_id", "visit_start_date", "visit_end_date"],
      rows: [{ id: "v1", v: ["501", { c: "er" }, "2180-08-14", "2180-08-14"] },
             { id: "v2", v: ["502", { c: "ip" }, "2180-08-14", "2180-08-29"] }] },
    { name: "condition_occurrence", cols: ["condition_concept_id", "condition_start_date", "condition_source_value", "visit_occurrence_id"],
      rows: [{ id: "c1", v: [{ c: "af" }, "2180-08-14", "I4891", "502"] },
             { id: "c2", v: [{ c: "sepsis" }, "2180-08-14", "A419", "502"] }] },
    { name: "drug_exposure", cols: ["drug_concept_id", "drug_exposure_start_date", "drug_source_value", "visit_occurrence_id"],
      rows: [{ id: "d1", v: [{ c: "hep" }, "2180-08-15", "Heparin Sodium (infusion)", "502"] },
             { id: "d2", v: [{ c: "apix" }, "2180-08-28", "Apixaban 5 mg tab", "502"] }] },
    { name: "measurement", cols: ["measurement_concept_id", "measurement_date", "value_as_number", "measurement_source_value"],
      rows: [{ id: "m1", v: [{ c: "creat" }, "2180-08-14", "2.1", "50912"] },
             { id: "m2", v: [{ c: "ecg" }, "2180-08-14", "—", "AF (ECG machine statement)"] }] },
    { name: "death", cols: ["person_id", "death_date", "death_type_concept_id"],
      rows: [{ id: "dd", v: ["1001", "2180-10-02", "state death record"] }] }
  ];

  var CONCEPTS = {
    male: { label: "8507", src: "MIMIC-IV patients.gender = 'M'", srcVocab: "local value", std: "MALE", vocab: "Gender", id: "8507", domain: "Gender",
      use: "Demographic covariate. Values that cannot be mapped become concept_id 0, which a cohort query will silently ignore." },
    er: { label: "9203", src: "MIMIC-IV ED stay (edstays)", srcVocab: "local table", std: "Emergency Room Visit", vocab: "Visit", id: "9203", domain: "Visit",
      use: "Visit types let a cohort require, say, 'diagnosed during an inpatient stay'." },
    ip: { label: "9201", src: "MIMIC-IV admissions row", srcVocab: "local table", std: "Inpatient Visit", vocab: "Visit", id: "9201", domain: "Visit",
      use: "Inclusion rule in the example cohort: the AF diagnosis must sit in an inpatient visit." },
    af: { label: "313217", src: "I4891 Unspecified atrial fibrillation", srcVocab: "ICD-10-CM (non-standard)", std: "Atrial fibrillation", vocab: "SNOMED CT (SNOMED 49436004)", id: "313217", domain: "Condition",
      use: "Cohort entry event. The query asks for 313217 or any descendant in concept_ancestor, so codes for paroxysmal or persistent AF are caught too. Note the date: MIMIC billing diagnoses have no time, so the ETL uses the admission date. That is why Project 5A dates AF onset from the ECG instead." },
    sepsis: { label: "132797", src: "A419 Sepsis, unspecified organism", srcVocab: "ICD-10-CM (non-standard)", std: "Sepsis", vocab: "SNOMED CT", id: "132797", domain: "Condition",
      use: "A baseline covariate for the propensity score (Lecture 5.4); also dated to admission, so its timing relative to AF is unknown." },
    hep: { label: "heparin (RxNorm 5224)", src: "Heparin Sodium, from the medication administration record", srcVocab: "MIMIC-IV local drug name", std: "heparin (ingredient)", vocab: "RxNorm 5224; the clinical-drug concept rolls up to it", id: "see Athena", domain: "Drug",
      use: "Exposure: any drug_exposure whose concept descends from an anticoagulant ingredient within the window. Check the ETL: in the MIMIC-IV demo conversion (v0.9) ICU inputevents, where heparin infusions live, were not yet converted." },
    apix: { label: "apixaban (RxNorm 1364430)", src: "Apixaban 5 mg tablet order", srcVocab: "MIMIC-IV local drug name / NDC", std: "apixaban (ingredient)", vocab: "RxNorm 1364430; the clinical-drug concept rolls up to it", id: "see Athena", domain: "Drug",
      use: "A second anticoagulant in the same codeset. Starting on day 14 falls outside a 48-hour grace period, so it would not count as baseline treatment in Project 5A." },
    creat: { label: "3016723", src: "labevents itemid 50912 Creatinine", srcVocab: "MIMIC-IV local item", std: "Creatinine [Mass/volume] in Serum or Plasma", vocab: "LOINC 2160-0", id: "3016723", domain: "Measurement",
      use: "Baseline kidney function: a confounder (bleeding risk, drug choice). Units come through as a unit_concept_id; always check them before pooling sites." },
    ecg: { label: "0 (unmapped)", src: "MIMIC-IV-ECG machine statement 'Atrial fibrillation'", srcVocab: "not part of the standard ETL", std: "No matching concept (concept_id 0)", vocab: "—", id: "0", domain: "—",
      use: "Unmapped source data land as concept_id 0 and are invisible to standard cohort definitions. For Project 5A you would add ECG-defined AF onset yourself, with a timestamp, as a measurement or observation row." }
  };

  var STEPS = [
    { label: "1 · Entry event", rows: ["c1"], text: "Find condition_occurrence rows whose concept is 313217 (atrial fibrillation) or a descendant, via concept_ancestor. The first one per person is the index date." },
    { label: "2 · Observation", rows: ["op", "v2"], text: "Keep people whose observation_period covers the index date, and whose AF row sits in an inpatient visit_occurrence." },
    { label: "3 · Exposure", rows: ["d1", "d2"], text: "Look in drug_exposure for any concept that descends from an anticoagulant ingredient, starting within 2 days of the index date. Heparin on day 1 qualifies; apixaban on day 14 does not." },
    { label: "4 · Outcome", rows: ["dd"], text: "Death within 90 days: death_date is 49 days after the index date. Censoring uses observation_period_end_date." }
  ];

  V.register("omop-explorer", function (root) {
    var tg = V.toggle(root, { options: [{ value: "none", label: "Click concepts" }].concat(STEPS.map(function (s, i) { return { value: i, label: s.label }; })), value: "none", onChange: paint });
    var info = el("div", { class: "widget-readouts", style: "grid-template-columns:1fr" }, root);
    var box = el("div", { class: "widget-readout" }, info);
    var title = el("div", { class: "widget-readout-value", style: "font-size:1rem" }, box);
    var body = el("div", { class: "widget-readout-label", style: "font-size:0.85rem" }, box);
    var tablesHost = el("div", { style: "margin-top:0.8rem" }, root);
    el("p", { class: "widget-note", text: "A made-up patient in MIMIC-style shifted dates (MIMIC moves every date into the 22nd century). Concept IDs shown were checked for the standard concepts; for drugs the RxNorm code is shown. Always look concepts up in Athena before using them." }, root);

    var rowEls = {}, conceptEls = [];
    TABLES.forEach(function (t) {
      el("div", { class: "widget-readout-label", style: "font-family:var(--font-mono, monospace);font-size:0.82rem;margin:0.7rem 0 0.2rem;color:var(--accent)", text: t.name }, tablesHost);
      var wrap = el("div", { class: "table-wrap", style: "margin:0" }, tablesHost);
      var tb = el("table", { style: "font-size:0.8rem" }, wrap);
      var tr = el("tr", null, el("thead", null, tb));
      t.cols.forEach(function (cn) { el("th", { text: cn, style: "font-family:var(--font-mono, monospace);font-size:0.74rem" }, tr); });
      var body2 = el("tbody", null, tb);
      t.rows.forEach(function (r) {
        var row = el("tr", null, body2);
        rowEls[r.id] = row;
        r.v.forEach(function (val) {
          var td = el("td", null, row);
          if (val && val.c) {
            var a = el("a", { href: "#", text: CONCEPTS[val.c].label, style: "font-weight:700" }, td);
            a.addEventListener("click", function (e) { e.preventDefault(); showConcept(val.c); });
            conceptEls.push(a);
          } else td.textContent = val;
        });
      });
    });

    function showConcept(k) {
      var cpt = CONCEPTS[k];
      title.textContent = cpt.std + "  ·  concept_id " + cpt.id;
      body.innerHTML = "";
      el("div", { html: "<strong>Source:</strong> " + cpt.src + " <em>(" + cpt.srcVocab + ")</em>" }, body);
      el("div", { html: "<strong>Maps to →</strong> " + cpt.std + " · " + cpt.vocab + " · domain: " + cpt.domain }, body);
      el("div", { style: "margin-top:0.3rem", text: cpt.use }, body);
    }

    function paint() {
      var v = tg.value();
      Object.keys(rowEls).forEach(function (k) { rowEls[k].style.background = ""; rowEls[k].style.outline = ""; });
      if (v === "none") {
        title.textContent = "Click any bold concept in the tables";
        body.textContent = "Each shows the source code the hospital recorded and the standard concept it maps to. Or step through the cohort definition with the buttons above.";
        return;
      }
      var s = STEPS[v];
      s.rows.forEach(function (k) { rowEls[k].style.background = "var(--accent-soft)"; rowEls[k].style.outline = "2px solid var(--accent)"; });
      title.textContent = s.label;
      body.textContent = s.text;
    }
    paint();
  });
})();
