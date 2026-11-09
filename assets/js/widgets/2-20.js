// Lecture 2.20 — appraisal walkthrough on a fictional abstract.
// The learner names the main threat behind each highlighted detail and gets feedback. Fictional study, illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Abstract as segments; a number marks the sentence that question n is about.
  var ABSTRACT = [
    ["Arabic coffee (qahwa) and cardiovascular events in working adults: the Al-Nakheel Workplace Cohort. ", "title"],
    ["Methods. ", "head"],
    ["We invited all 9,600 employees aged 30–60 at three Riyadh companies to a voluntary health check in 2015–16; 4,200 (44%) took part. ", 5],
    ["Qahwa intake was self-reported once, at baseline, in cups per day. ", 2],
    ["Heart attacks, strokes and cardiovascular deaths were identified from employer insurance claims to 2021; ", null],
    ["the 18% who left their company were censored when they left. ", 3],
    ["We examined 12 dietary exposures. Hazard ratios were adjusted for age and sex. ", 4],
    ["Results. ", "head"],
    ["There were 112 events. Compared with non-drinkers, drinking 3 or more cups a day was associated with lower risk (HR 0.62, 95% CI 0.41–0.94; p = 0.03). ", 4],
    ["Heavy drinkers were more physically active and less likely to smoke. ", 0],
    ["Non-drinkers included more people who had stopped drinking on medical advice. ", 1],
    ["Conclusion. ", "head"],
    ["Qahwa protects the heart. National campaigns should encourage three or more cups a day.", 6]
  ];

  // grade: 2 = the main threat, 1 = defensible but not the main one, 0 = no
  var QS = [
    {
      detail: "Heavy drinkers were more active and less likely to smoke; only age and sex were adjusted for.",
      ask: "What is the main threat this creates?",
      opts: [
        ["Confounding", 2, "Yes. Activity and smoking affect heart disease and travel with coffee drinking, so they can manufacture a protective association. Ask what HR remains after adjusting for them, and whether unmeasured lifestyle factors could explain the rest (Lectures 2.6 and 2.13)."],
        ["Information bias", 0, "Measurement error is a separate issue. Here the problem is that drinkers differ from non-drinkers in other causes of heart disease, which is confounding."],
        ["Chance", 0, "Chance is about random error. A systematic difference in smoking and activity does not shrink with a bigger sample; it is confounding."],
        ["Effect modification", 0, "Effect modification means the effect differs across groups. Here the groups differ in their baseline risk, which mixes other effects into the comparison: confounding."]
      ],
      tag: "Confounding by lifestyle (2.6)"
    },
    {
      detail: "Non-drinkers included more people who had stopped drinking on medical advice.",
      ask: "What does this suggest?",
      opts: [
        ["Reverse causation: early illness changed the exposure", 2, "Yes. People who are already unwell are told to stop, so the non-drinker group is loaded with high-risk people. This is the sick-quitter problem from the alcohol literature. A check is to exclude former drinkers, or the first years of follow-up, and see if the HR moves toward 1."],
        ["Confounding by prior health", 1, "Defensible: prior illness causes both quitting and later events, so it acts as a confounder. The sharper name is reverse causation, because the outcome process changed the exposure. Either way, the fix is to separate former drinkers from never drinkers."],
        ["Recall bias", 0, "Exposure was recorded before any event, so the outcome cannot have coloured how people reported it. Recall bias is mainly a case-control problem (Lecture 2.8)."],
        ["Loss to follow-up", 0, "This detail is about who was in the comparison group at baseline, not who left later."]
      ],
      tag: "Reverse causation / sick quitters (2.10)"
    },
    {
      detail: "Qahwa intake was self-reported once, at baseline, in cups per day.",
      ask: "What is the main concern, and which way would it push the result?",
      opts: [
        ["Non-differential misclassification, which usually pulls toward the null", 2, "Yes. Exposure was measured before the outcome, so errors should not depend on who later had an event. With a binary exposure this usually weakens the association, so it cannot by itself create a protective effect. With several categories, or errors that track other variables, toward the null is not guaranteed (Lecture 2.8). Habits also change over six years."],
        ["Differential recall bias, as in a case-control study", 0, "Recall bias needs the outcome to affect reporting. Here intake was recorded before any events happened."],
        ["Misclassification always exaggerates effects", 0, "The usual direction for non-differential error in a binary exposure is toward the null, not away from it (Lecture 2.8)."],
        ["Intake changes over six years of follow-up", 1, "True and worth raising: one baseline measure misses change. It is a form of exposure misclassification, so it also tends to blur the contrast rather than create one."]
      ],
      tag: "Non-differential exposure error (2.8)"
    },
    {
      detail: "The 18% who left their company were censored when they left.",
      ask: "Why might this matter?",
      opts: [
        ["Selection bias from informative censoring", 2, "Yes. People often leave work because they become ill, so those who leave may be the ones about to have events. If leaving is linked to both drinking and risk, the people who remain are a biased subset: the healthy worker survivor effect (Lecture 2.7). Ask for a comparison of leavers and stayers, and a sensitivity analysis."],
        ["Events after leaving are missed", 1, "Partly. Censoring is meant to handle that, but only if leavers have the same risk as stayers with the same exposure. The real issue is that this assumption is unlikely, which is selection bias."],
        ["Chance", 0, "Losing 18% reduces precision a little, but the main worry is systematic: who leaves, and why."],
        ["No problem: censoring is standard in survival analysis", 0, "Censoring is standard, but it assumes leaving is unrelated to risk. Illness-driven job exit breaks that assumption."]
      ],
      tag: "Informative censoring (2.7)"
    },
    {
      detail: "12 dietary exposures, 112 events, HR 0.62 (95% CI 0.41–0.94), p = 0.03.",
      ask: "How much weight does this single result deserve?",
      opts: [
        ["Little on its own: one of 12 tests, few events, wide interval", 2, "Yes. If the 12 tests were independent and nothing were real, the chance of at least one p < 0.05 would be about 46%. With only 112 events, the interval runs from a large benefit to a trivial one, and the first published estimate of a lucky finding tends to be too big (Lecture 2.5)."],
        ["The study is too small: 4,200 people is not enough", 1, "The instinct is right but the measure is wrong. Precision in a cohort depends mostly on the number of events (112), not the number of people."],
        ["A lot: p = 0.03 means a 97% chance the effect is real", 0, "A p-value is not the probability that the effect is real. It is the probability of data this extreme if there were no effect (Lecture 2.5)."],
        ["None: the interval is too wide to say anything", 0, "Too strong. The interval is informative about the range of plausible effects; the issue is that bias and multiplicity may matter more than its width."]
      ],
      tag: "Chance and multiplicity (2.5)"
    },
    {
      detail: "44% of invited employees took part; all were working adults aged 30–60 in Riyadh.",
      ask: "What is the main consequence?",
      opts: [
        ["Limited applicability: healthier, employed volunteers, so absolute risks and perhaps effects may not transfer", 2, "Yes. Volunteers and workers are healthier than the general population, so event rates will be low, and the result may not apply to older people, those not working, or groups not well represented. Low participation alone does not bias the internal comparison unless taking part depends on both coffee and heart risk (Lecture 2.7, section 1)."],
        ["Selection bias: the hazard ratio must be wrong", 1, "Only if participation depends on both qahwa and heart risk. Unrepresentative is not the same as biased; the stronger point is about who the result applies to."],
        ["Confounding", 0, "Confounding is about differences between drinkers and non-drinkers inside the study, not about who the study sampled."],
        ["Chance", 0, "Participation rate does not change random error much; 4,200 people took part."]
      ],
      tag: "Applicability (healthy volunteers)"
    },
    {
      detail: "Conclusion: qahwa protects the heart; campaigns should encourage three or more cups a day.",
      ask: "What is the best response for a policy audience?",
      opts: [
        ["Over-reach: causal language and a policy call from one confounded cohort", 2, "Yes. The design cannot rule out confounding or reverse causation, and the result could be one of 12 tests. Before policy you would want triangulation (other cohorts, Mendelian randomisation, negative controls), absolute risk differences, and the possible harms of a campaign, such as sugar and dates served with qahwa (Lectures 2.10 and 2.19)."],
        ["Accept: the confidence interval excludes 1", 0, "An interval that excludes 1 deals only with chance. It says nothing about bias, which is the main threat here."],
        ["Reject it: observational studies cannot inform policy", 0, "Too strong. Much of public health policy rests on observational evidence. The question is whether this evidence is strong enough for this claim."],
        ["Accept nothing until there is a trial", 1, "Partly. A long-term diet trial is rarely feasible; the realistic route is triangulation across designs with different biases. Calling for a trial alone can stall decisions indefinitely."]
      ],
      tag: "Causal over-reach in the conclusion"
    }
  ];

  V.register("appraisal-walkthrough", function (root) {
    var picks = QS.map(function () { return null; });
    var cur = 0;

    el("p", { class: "widget-note", style: "margin:0 0 0.4rem;font-weight:700", text: "Fictional abstract, illustrative numbers" }, root);
    var abs = el("div", { style: "background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.8rem 1rem;margin:0 0 0.9rem;font-size:0.95rem;line-height:1.55" }, root);
    var spans = [];
    ABSTRACT.forEach(function (s) {
      var sp = el("span", { text: s[0] }, abs);
      if (s[1] === "title" || s[1] === "head") sp.style.fontWeight = "700";
      spans.push([sp, s[1]]);
    });

    var nav = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(nav, "← Previous", function () { if (cur > 0) { cur--; draw(); } });
    V.button(nav, "Next →", function () { if (cur < QS.length - 1) { cur++; draw(); } });
    var step = el("span", { class: "widget-note", style: "margin:0" }, nav);
    V.button(nav, "Start again", function () { picks = QS.map(function () { return null; }); cur = 0; draw(); });

    var panel = el("div", null, root);
    var out = V.readouts(root, [
      { key: "done", label: "Questions answered" },
      { key: "best", label: "Main threat named", cls: "good" },
      { key: "part", label: "Defensible but not the main one" }
    ]);

    var tw = el("div", { class: "table-wrap", style: "margin-top:0.9rem" }, root);
    var table = el("table", null, tw);
    var hr = el("tr", null, el("thead", null, table));
    ["#", "Detail in the abstract", "Your call", "Suggested main threat"].forEach(function (h) { el("th", { text: h }, hr); });
    var tbody = el("tbody", null, table);
    el("p", { class: "widget-note", text: "The table is your one-page appraisal in miniature. Suggested answers appear once you have made a call. Several threats can apply to one detail; the exercise is to name the one that most changes how far you trust the result." }, root);

    function optStyle(state) {
      var base = "display:block;width:100%;text-align:left;border-radius:8px;margin:0 0 0.45rem;padding:0.55rem 0.8rem;line-height:1.4;font-weight:600;";
      if (state === "best") return base + "border-color:var(--accent);background:var(--accent-soft);color:var(--text)";
      if (state === "part") return base + "border-color:var(--example);background:var(--example-bg);color:var(--text)";
      if (state === "wrong") return base + "border-color:var(--pitfall);background:var(--pitfall-bg);color:var(--text)";
      return base + "border-color:var(--border);color:var(--text)";
    }

    function draw() {
      var q = QS[cur], pk = picks[cur];
      spans.forEach(function (s) {
        var on = s[1] === cur;
        s[0].style.background = on ? "var(--accent-soft)" : "";
        s[0].style.outline = on ? "1.5px solid var(--accent)" : "";
        s[0].style.borderRadius = on ? "3px" : "";
      });
      step.textContent = "Question " + (cur + 1) + " of " + QS.length;

      clear(panel);
      el("p", { style: "margin:0 0 0.3rem", html: "<strong>Highlighted detail:</strong> " + q.detail }, panel);
      el("p", { style: "margin:0 0 0.6rem;font-weight:700", text: q.ask }, panel);
      q.opts.forEach(function (o, i) {
        var state = pk === null ? null : (i === pk ? ["wrong", "part", "best"][o[1]] : (o[1] === 2 ? "best" : null));
        var b = el("button", { type: "button", class: "widget-button", style: optStyle(state), text: o[0] }, panel);
        b.addEventListener("click", function () { picks[cur] = i; draw(); });
      });
      if (pk !== null) {
        var g = q.opts[pk][1];
        var box = el("div", { class: "callout " + ["trap", "example", "key"][g], style: "margin:0.6rem 0 0" }, panel);
        el("div", { class: "callout-title", text: ["Not the main threat", "Defensible, but not the main one", "Good call"][g] }, box);
        el("p", { text: q.opts[pk][2] }, box);
        if (g < 2) {
          var best = q.opts.filter(function (o) { return o[1] === 2; })[0];
          el("p", { html: "<strong>Suggested:</strong> " + best[0] + ". " + best[2].replace(/^Yes\. /, "") }, box);
        }
      }

      var done = 0, nb = 0, np = 0;
      clear(tbody);
      QS.forEach(function (qq, k) {
        var p = picks[k], tr = el("tr", null, tbody);
        el("td", { text: String(k + 1) }, tr);
        el("td", { text: qq.detail }, tr);
        if (p === null) {
          el("td", { text: "–" }, tr); el("td", { text: "–" }, tr);
        } else {
          done++; if (qq.opts[p][1] === 2) nb++; if (qq.opts[p][1] === 1) np++;
          el("td", { text: qq.opts[p][0] + ["", " (partly)", " ✓"][qq.opts[p][1]] }, tr);
          el("td", { text: qq.tag }, tr);
        }
      });
      out.done(done + " of " + QS.length);
      out.best(String(nb));
      out.part(String(np));
    }
    draw();
  });
})();
