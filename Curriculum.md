# Public Health and Epidemiology Curriculum

Nov 1, 2026 · @Ameen

## How the curriculum works

This covers the whole of public health and epidemiology: the core of a UK-style MPH (health protection, health improvement, health services and policy) plus the methods depth of an MSc in Epidemiology and the applied core of an MS in Biostatistics, plus specialist training in pharmacoepidemiology, real-world evidence, regulatory science and the causal evaluation of AI. Total: about 119 weeks (about two and a quarter years) at 8–10 hours a week.

> **Revised 1 November 2026:** every project now runs on public data, causal inference and real-world evidence start 9 weeks earlier, and the biostatistics theory is a one-week diagnostic instead of 12 weeks of lectures.

**Structure:** 9 blocks of 10–20 weeks. Each block has 9–20 lectures and ends in a research project meant for publication.

**Weekly rhythm:** about 4 hours on lectures (roughly one lecture a week) and 4–6 hours on the current project. A block's project starts halfway through its lectures, as soon as you have the methods it needs, and usually keeps running into the next block.

**Lecture notes:** I write each block's notes just before you start that block, not all upfront, so they can take account of what the earlier projects taught you. Each note has:

- the core ideas, explained for someone with your stats and ML background
- worked examples, using Saudi or GCC data where possible
- 3–5 exercises with answers
- the textbook chapter it draws on, so you can check anything that matters

**Depth tiers** (as in the earlier plan):

- **Recognise:** know what it is and when it applies
- **Use:** apply it with a reference open
- **Master:** do it unaided and defend it to a reviewer

**Done when:** a block is finished when its lecture exercises are done and its project is submitted, or at least has a complete draft.

## Blocks at a glance

| Block | Weeks | Area | Project | Public data | Gap status |
|---|---|---|---|---|---|
| 1 | 1–12 | Foundations, burden of disease, health economics | 1: Health and economic impact of Saudi salt policies | Published studies, GBD, UN population data, WHO-CHOICE costs | Verified (Oct 2026) |
| 2 | 13–32 | Epidemiology (MSc depth) | 2: Systematic review of measured salt intake in the GCC | Published literature | Not yet checked |
| 3 | 33–45 | Biostatistics core (diagnostic, then applied) | 3: Urinary sodium-to-potassium ratio and cardiovascular mortality | NHANES with linked mortality files | Not yet checked |
| 4 | 46–57 | Causal inference and policy evaluation | 4: Did GCC sugary-drink taxes cut consumption? | FAOSTAT, UN Comtrade, World Bank | Not yet checked |
| 5 | 58–74 | Pharmacoepidemiology, real-world evidence, regulatory science, AI evaluation | 5A: Anticoagulation for new-onset AF (target trial emulation); 5B: How FDA-cleared cardiovascular AI was evaluated | MIMIC-IV, MIMIC-IV-ECG; FDA AI-enabled device list | Not yet checked |
| 6 | 75–85 | Health protection | 6: Heat stress exposure of outdoor workers in the GCC | ERA5 climate reanalysis | Not yet checked |
| 7 | 86–95 | Health improvement and digital health | 7: AI chatbot health answers in Gulf Arabic | MAQA patient questions | Partly verified |
| 8 | 96–107 | Health systems, policy, global health, equity | 8: Who benefits from Saudi salt policy | Saudi census, Project 1 inputs | Follows from Project 1 |
| 9 | 108–119 | Research practice, qualitative and mixed methods | 9: Salt policy implementation (documentary analysis), plus a PhD proposal | Public policy documents | Not yet checked |

Two research threads run through the curriculum, so your PhD application tells a coherent story rather than listing scattered papers:

- **Gulf food policy** (Projects 1, 2, 4, 8, 9): predicted salt-policy impact, measured salt intake, measured impact of sugary-drink taxes, who benefits, and why compliance falls short.
- **Causal evaluation of drugs and AI with real-world data** (Projects 5A, 5B, 7): treatment effects from EHR data, how regulated AI is evaluated, and how consumer AI performs.

---

## Block 1 — Foundations, burden of disease and health economics (weeks 1–12)

| # | Lecture | Tier |
|---|---|---|
| 1.1 | What public health is: core functions, levels of prevention, the three domains | Use |
| 1.2 | Rose's prevention paradox: population vs high-risk strategies | Master |
| 1.3 | Determinants of health: social, commercial, environmental | Use |
| 1.4 | Measuring population health: counts, rates, age standardisation | Master |
| 1.5 | Life tables and life expectancy | Master |
| 1.6 | Summary measures: YLL, YLD, DALYs, QALYs | Master |
| 1.7 | Comparative risk assessment: PAF, PIF, TMREL, and how GBD works | Master |
| 1.8 | Nutrition epidemiology: dietary assessment and measurement error | Use |
| 1.9 | The salt evidence: salt → blood pressure → cardiovascular disease | Master |
| 1.10 | Economic evaluation: costs, perspectives, discounting, ICERs, thresholds | Master |
| 1.11 | Decision models: Markov and multistate life tables | Master |
| 1.12 | Uncertainty: probabilistic sensitivity analysis and value of information | Master |

**Project 1: health and economic impact of Saudi salt policies.** Model cardiovascular deaths, DALYs and costs averted under the 2019 bread limit and the 2025 voluntary limits (at measured and at full compliance), against WHO benchmarks. Multistate life table model with probabilistic sensitivity analysis and an ML metamodel for value of information.

- **Gap:** verified in October 2026 across PubMed and about 15 web searches. No Saudi model exists.
- **Data (all public):** salt intake from published Saudi studies (replaced by Project 2's pooled estimate later); blood-pressure and disease effects from published meta-analyses; disease rates from the GBD Results Tool; population from UN World Population Prospects; unit costs from WHO-CHOICE and published Saudi cost studies.
- **Starts:** week 4, after lecture 1.7.
- **Optional contact:** email SFDA's nutrition team and the GSO 2612:2025 preprint authors once a prototype runs (around week 8), for compliance figures. The model runs on published figures without them.
- **Target journals:** BMJ Global Health, Nutrients, Value in Health Regional Issues.

**Primary textbooks:** Rose, *The Strategy of Preventive Medicine*; Briggs, Claxton & Sculpher, *Decision Modelling for Health Economic Evaluation*; the GBD 2021 risk factor methods appendix.

---

## Block 2 — Epidemiology (weeks 13–32)

| # | Lecture | Tier |
|---|---|---|
| 2.1 | Measures of frequency and association: risks, rates, odds, ratios, differences | Master |
| 2.2 | Cohort studies | Master |
| 2.3 | Case-control studies, including nested and case-cohort designs | Master |
| 2.4 | Cross-sectional, ecological and case-crossover designs | Master |
| 2.5 | Random error: precision, confidence intervals, p-values and their misuse | Master |
| 2.6 | Confounding | Master |
| 2.7 | Selection bias and collider bias | Master |
| 2.8 | Information bias and misclassification | Master |
| 2.9 | Effect modification and interaction | Master |
| 2.10 | Causation: Bradford Hill and modern causal thinking | Use |
| 2.11 | Screening and diagnostic test evaluation | Use |
| 2.12 | Systematic reviews and meta-analysis: PICO, search, screening, risk of bias, pooling, PRISMA | Master |
| 2.13 | Quantitative bias analysis: how much could bias have changed this result? | Master |
| 2.14 | Measurement: validity, reliability and agreement (kappa, ICC, Bland-Altman) | Use |
| 2.15 | Clinical epidemiology: diagnostic accuracy and prognosis research | Use |
| 2.16 | Pharmacoepidemiology: an introduction (taken to full depth in Block 5) | Use |
| 2.17 | Cardiovascular and chronic disease epidemiology: the great cohorts and risk scores | Use |
| 2.18 | Life-course and social epidemiology | Use |
| 2.19 | Genetic epidemiology and Mendelian randomisation | Recognise |
| 2.20 | Critical appraisal: running a journal club on any epidemiology paper | Master |

**Project 2: systematic review and meta-analysis of measured salt intake in the GCC.** Pool studies that measured salt intake by 24-hour urine in GCC adults, assess their risk of bias, and estimate pooled intake by country and sex.

- **Why this project:** it teaches the most transferable epidemiology skill (systematic reviews are how most people join research teams), it's a fast first-author paper, and its pooled estimate becomes a better input for Project 1.
- **Data:** published studies only.
- **Needs:** a second independent screener and data extractor. PRISMA and Cochrane expect dual screening, and reviewers check. Recruit one by week 13 and offer co-authorship.
- **Gap:** not yet checked. Broader Eastern Mediterranean salt reviews exist (2021), so the novelty must come from a GCC focus, 24-hour urine only, and newer studies such as the Kuwait 2026 national survey. Check in week 13 and register on PROSPERO if clear.
- **Starts:** week 18, after lecture 2.12 (so lecture 2.12 is taught early, in week 15). Block 2 now has 20 weeks for its 20 lectures.
- **Target journals:** Nutrients, Public Health Nutrition, Eastern Mediterranean Health Journal.

**Primary textbooks:** Rothman, Greenland & Lash, *Modern Epidemiology* (4th edition), selected chapters; *Cochrane Handbook* for lecture 2.12; Lash, Fox & Fink, *Applying Quantitative Bias Analysis to Epidemiologic Data* for lecture 2.13.

---

## Block 3 — Biostatistics core (weeks 33–45)

Block 3 starts with a diagnostic, not 12 weeks of theory. Your MSc and ML work already cover most of the theory in an MS in Biostatistics, so notes are written only for the topics you miss. Four applied lectures moved to the blocks where they are used: Bayesian hierarchical models to Block 8, prediction models and clinical trial statistics to Block 5, spatial epidemiology to Block 6.

- **Week 33 — diagnostic.** Two or three exercises each on probability distributions, likelihood and MLE, frequentist inference, power and sample size, Bayesian inference, linear model theory, GLM theory, resampling, and multiple testing.
- **Weeks 34–36 — gap-fill.** A short note for each topic you miss, at the tier it needs. If the diagnostic shows no gaps, the lectures start in week 34 and every later block moves up.

| # | Lecture | Tier |
|---|---|---|
| 3.1 | Reproducible analysis pipelines for health research | Use |
| 3.2 | Statistical computing in R for health data | Use |
| 3.3 | GLMs for health data; Poisson and negative binomial models for rates with offsets | Master |
| 3.4 | Complex survey design: weights, strata, clusters, design effects | Master |
| 3.5 | Missing data and multiple imputation | Master |
| 3.6 | Survival analysis: Kaplan-Meier, Cox models, checking proportional hazards | Master |
| 3.7 | Competing risks and multistate models | Use |
| 3.8 | Longitudinal and clustered data: mixed models vs GEE | Master |
| 3.9 | Time series for health data: seasonality, autocorrelation, ARIMA (needed for interrupted time series in Block 4) | Use |

**Project 3: urinary sodium-to-potassium ratio and cardiovascular mortality (NHANES).** A survey-weighted cohort analysis using measured urinary sodium and potassium in NHANES, linked to the public mortality files, with multiple imputation and competing-risks models.

- **Data:** public, available today, so access is certain.
- **Gap:** not yet checked, and the field is crowded. The novelty must come from the ratio rather than sodium alone, recent cycles, and competing-risks methods. Check in week 33.
- **Starts:** week 41, after lecture 3.5.
- **Fallback:** a pooled analysis of cardiometabolic risk factors across Gulf states using public-use WHO STEPS microdata (WHO NCD Microdata Repository). Kuwait's 2014 STEPS is confirmed as a public-use dataset; check which other GCC rounds are downloadable in week 33. WHO's terms ask you to share planned publications with WHO and offer the survey coordinator co-authorship. The Saudi World Health Survey 2019 is dropped: only tabulations are public, not microdata.
- **Target journals:** Journal of the American Heart Association first; Nutrients as backup.

**Primary textbooks:** Kirkwood & Sterne, *Essential Medical Statistics*; Lumley, *Complex Surveys: A Guide to Analysis Using R*; Wasserman, *All of Statistics* and Agresti, *Foundations of Linear and Generalized Linear Models*, for gap-fill notes only.

---

## Block 4 — Causal inference and policy evaluation (weeks 46–57)

| # | Lecture | Tier |
|---|---|---|
| 4.1 | Potential outcomes and identification: exchangeability, positivity, consistency | Master |
| 4.2 | DAGs and choosing adjustment sets | Master |
| 4.3 | Inverse probability weighting and the g-formula | Master |
| 4.4 | Doubly robust estimation, TMLE and machine learning for causal effects | Use |
| 4.5 | Target trial emulation | Use |
| 4.6 | Difference-in-differences, including staggered adoption and event studies | Master |
| 4.7 | Interrupted time series | Master |
| 4.8 | Synthetic control | Master |
| 4.9 | Regression discontinuity and instrumental variables | Use |
| 4.10 | Mediation analysis | Recognise |
| 4.11 | Natural experiments in public health policy | Use |

**Project 4: did GCC sugary-drink taxes cut consumption?** A staggered-adoption difference-in-differences and synthetic control analysis of the GCC excise taxes on sugary drinks. Saudi Arabia and the UAE taxed them in 2017, Bahrain late in 2017, Oman and Qatar in 2019, and Saudi Arabia and the UAE extended the tax to all sweetened drinks in December 2019. Kuwait is the never-taxed comparison; synthetic control adds non-GCC donor countries.

- **Data (all public):** FAOSTAT food balance sheets (sugar and sweetener supply per person, annual) as the primary outcome; UN Comtrade imports of sweetened drinks (HS 2202) as a secondary outcome; World Bank population and GDP as covariates.
- **Why it replaced the Saudi bread-salt evaluation:** no public outcome series exists for the bread salt limit or calorie labelling. Predicted salt-policy impact stays in Project 1.
- **Gap:** not yet checked. Earlier GCC evaluations compared year-on-year growth in proprietary industry sales data, with no counterfactual design. Check for newer work in week 46. Also confirm Kuwait's status: a 2020 paper expected a 2020 tax, but a 2025 report says Kuwait still has none.
- **Main weakness:** annual country-level data with few units, and supply is a proxy for consumption. Imports alone miss Saudi Arabia's large domestic bottling, which is why supply is the primary outcome. Use placebo and permutation tests for inference.
- **Starts:** week 51, after lecture 4.6. Data assembly can start in week 46.
- **Fallback as its own paper:** a methods-and-application paper on evaluating food taxes with public supply data when there are few countries.
- **Target journals:** BMJ Global Health first; Public Health Nutrition as backup.

**Primary textbooks:** Hernán & Robins, *Causal Inference: What If* (free); Cunningham, *Causal Inference: The Mixtape* (free).

---

## Block 5 — Pharmacoepidemiology, real-world evidence, regulatory science and AI evaluation (weeks 58–74)

**Why:** this is your specialisation block. It applies the causal inference from Block 4 to the questions regulators, industry and health systems pay for: do drugs work and harm in real-world use, can real-world data stand in for trials, and does a deployed AI tool actually improve outcomes, not just score well on a test set.

| # | Lecture | Tier |
|---|---|---|
| 5.1 | Pharmacoepidemiology foundations: drug utilisation, defining exposure from prescriptions and dispensing | Master |
| 5.2 | New-user and active-comparator designs | Master |
| 5.3 | Time-related biases: immortal time, time-window, protopathic bias, reverse causation | Master |
| 5.4 | Confounding by indication; propensity scores, including high-dimensional propensity scores | Master |
| 5.5 | Self-controlled designs: case-crossover, self-controlled case series | Use |
| 5.6 | Real-world data sources: EHRs, claims, registries, linked data; common data models (OMOP) | Master |
| 5.7 | Data quality and fitness for purpose; phenotyping and outcome validation | Master |
| 5.8 | Statistics of clinical trials: randomisation, intention-to-treat, interim analyses (moved from Block 3) | Use |
| 5.9 | Target trial emulation for regulatory decisions; benchmarking against trials | Master |
| 5.10 | External and synthetic control arms | Use |
| 5.11 | Regulatory science and HTA: how drugs and devices are approved (FDA, EMA, SFDA), how regulators use real-world evidence, and how HTA differs | Use |
| 5.12 | Pharmacovigilance: spontaneous reporting, disproportionality analysis, signal detection | Use |
| 5.13 | Prediction models in health: development, validation, calibration, TRIPOD+AI (moved from Block 3) | Master |
| 5.14 | AI as a medical device: FDA, EU and SFDA regulation; managing model updates | Use |
| 5.15 | Causal evaluation of deployed AI: accuracy vs impact; cluster and stepped-wedge trials; difference-in-differences on rollouts | Master |
| 5.16 | Post-deployment monitoring: drift, performance decay, feedback loops | Master |
| 5.17 | Reporting standards: CONSORT-AI, SPIRIT-AI, DECIDE-AI, RECORD-PE | Use |

**Project 5A: anticoagulation for new-onset atrial fibrillation in critically ill patients.** A target trial emulation in MIMIC-IV, with AF onset defined from the ECG itself (MIMIC-IV-ECG) rather than from diagnosis codes, plus a quantitative bias analysis.

- **Data:** MIMIC-IV is free but needs PhysioNet credentialing (an application plus the CITI human-subjects course); MIMIC-IV-ECG is open access. Start credentialing in Block 1, since approval can take weeks.
- **Gap:** not yet checked. Observational studies of this question exist, mostly from claims data, so the novelty has to come from the ECG-based onset definition and a modern target trial design. Check in week 58.
- **Starts:** week 61, after lecture 5.3. A feasibility count (eligible patients, treatment, events) is the go/no-go step.
- **Why it matters:** the strongest single paper for an epidemiology or real-world-evidence PhD, and it uses your cardiac and ECG background directly.
- **Target journals:** Pharmacoepidemiology and Drug Safety, Journal of Clinical Epidemiology, Critical Care Medicine.

**Project 5B: is health AI evaluated for impact, or only for accuracy?** A review of the evidence behind FDA-cleared cardiovascular AI devices, including ECG tools: what share were tested prospectively or on patient outcomes, versus retrospective accuracy only.

- **Data (all public):** the FDA AI-Enabled Medical Device List and the decision summaries linked from each entry. Add the SFDA register only if its entries can be searched publicly; check in week 65.
- **Gap:** not yet checked. Reviews of FDA-cleared AI evidence exist, so the angle must be narrower and newer: cardiovascular devices and recent clearances. Check in week 65.
- **Fallback:** if the cardiovascular angle is taken, narrow to ECG devices and compare evidence before and after FDA's 2021 AI/ML action plan.
- **Target journals:** npj Digital Medicine, The Lancet Digital Health, JAMA Network Open.

**Primary textbooks:** Strom, Kimmel & Hennessy, *Pharmacoepidemiology*; Hernán & Robins, *Causal Inference: What If* (target trial chapters); the FDA's real-world evidence framework and guidances; the FDA's AI-enabled device list as a working dataset.

---

## Block 6 — Health protection (weeks 75–85)

The domain your earlier plan skipped: protecting populations from infectious disease and environmental hazards.

| # | Lecture | Tier |
|---|---|---|
| 6.1 | Infectious disease epidemiology: transmission, R0, incubation, herd immunity | Use |
| 6.2 | Compartmental models: SIR, SEIR, and fitting them to data | Use |
| 6.3 | Surveillance systems: notifiable diseases, syndromic and wastewater surveillance | Use |
| 6.4 | Outbreak investigation, step by step | Use |
| 6.5 | Vaccination programmes: effectiveness, coverage, hesitancy | Use |
| 6.6 | Antimicrobial resistance as a public health problem | Recognise |
| 6.7 | Environmental epidemiology: air pollution, exposure assessment | Use |
| 6.8 | Spatial epidemiology and small-area estimation (moved from Block 3) | Use |
| 6.9 | Heat and health: time series designs and distributed lag non-linear models | Master |
| 6.10 | Mass gatherings: the Hajj as a public health case study | Use |
| 6.11 | Emergency preparedness and the International Health Regulations | Recognise |

**Project 6: heat stress exposure of outdoor workers in the GCC, 1980–2025.** Use public climate reanalysis data (ERA5) to compute wet-bulb globe temperature, a measure of heat stress, across GCC cities. Estimate the trend in hours above occupational safety thresholds, and compare it with the region's midday outdoor work bans.

- **Data:** ERA5 is public, so access is certain. No health records are needed.
- **Gap:** not yet checked. Global heat-stress studies exist, so the angle is GCC-specific: the fit between current work-ban hours and actual heat exposure. Check in week 75.
- **Optional extension:** apply published heat–health exposure–response estimates to the exposure series to estimate attributable risk. Inputs stay public.
- **Target journals:** Occupational and Environmental Medicine first; International Journal of Biometeorology as backup.

**Primary textbooks:** Vynnycky & White, *An Introduction to Infectious Disease Modelling*; Gasparrini's DLNM tutorials (free) for lecture 6.9.

---

## Block 7 — Health improvement and digital health (weeks 86–95)

| # | Lecture | Tier |
|---|---|---|
| 7.1 | Health promotion: the Ottawa Charter, settings approaches | Use |
| 7.2 | Behaviour change theory: COM-B, the Behaviour Change Wheel, Health Belief Model | Use |
| 7.3 | Designing interventions: intervention mapping, logic models | Use |
| 7.4 | Programme evaluation: process, outcome, realist evaluation | Master |
| 7.5 | Health literacy and health communication | Use |
| 7.6 | Infodemiology and health misinformation | Use |
| 7.7 | Digital health interventions: apps, wearables, chatbots, and their evidence | Use |
| 7.8 | Evaluating patient-facing AI: accuracy, safety, bias and readability (builds on Block 5's AI evaluation) | Master |
| 7.9 | Mental health in public health | Recognise |
| 7.10 | Tobacco, alcohol and physical activity as public health problems | Recognise |

**Project 7: AI chatbot health answers in Gulf Arabic.** Test how accurate and safe current AI chatbots are on chronic disease self-management questions (hypertension, diabetes) asked in Gulf dialect vs Modern Standard Arabic, rated by clinicians. Then validate whether an LLM can rate the answers as reliably as clinicians do.

- **Data (public):** real patient questions from MAQA, a set of over 430,000 Arabic patient questions answered by clinicians, on Harvard Dataverse. Filter to hypertension and diabetes; native speakers write the Gulf-dialect versions. Check MAQA's licence in week 86.
- **Gap:** partly verified in October 2026. General Arabic medical question studies exist, and one on cirrhosis compared Arabic with English, but dialect comparison, chronic-disease safety and validated LLM rating are open. This field moves fast, so re-check in week 86.
- **Why it fits you:** the most ML-heavy project in the curriculum, and it pairs with Project 5B: 5B asks how regulated AI is evaluated, this one evaluates unregulated consumer AI directly.
- **Needs:** two clinician raters, recruited early and offered co-authorship. These are collaborators, not data. With no patients and only public questions, ethics review is unlikely to be needed; confirm in week 86.

**Publishability bar:** chatbot accuracy studies are now a saturated genre, and editors reject "we asked a chatbot 50 questions" papers. This one clears the bar only with: questions taken from real patient queries, not invented; several current models with exact versions and dates; blinded clinician raters with reported agreement; harm classification, not just accuracy; and the CHART reporting guideline (2025), followed from the protocol stage.

**Target journals:** npj Digital Medicine first; BMJ Health & Care Informatics as backup.

**Primary textbooks:** Michie et al., *The Behaviour Change Wheel*; the WHO guidance on ethics and governance of AI for health.

---

## Block 8 — Health systems, policy, global health and equity (weeks 96–107)

| # | Lecture | Tier |
|---|---|---|
| 8.1 | Health systems: the WHO building blocks, Universal Health Coverage | Use |
| 8.2 | Health financing: who pays, how purchasing works | Use |
| 8.3 | The Saudi health system: Ministry of Health, SFDA, Saudi Health Council, Vision 2030 Health Sector Transformation | Use |
| 8.4 | How policy gets made: Kingdon's streams, evidence-to-policy, policy briefs | Use |
| 8.5 | Global health governance: WHO, the IHR, funders, the SDGs | Recognise |
| 8.6 | Social determinants and the Marmot framework | Use |
| 8.7 | Measuring health inequality: concentration index, slope and relative index of inequality | Master |
| 8.8 | Bayesian hierarchical models and evidence synthesis, for sparse subgroup inputs (moved from Block 3) | Use |
| 8.9 | Distributional and extended cost-effectiveness analysis | Master |
| 8.10 | Migrant and non-national health in the GCC | Use |
| 8.11 | Healthcare public health: service planning, quality, health needs assessment | Use |
| 8.12 | Leadership and management in public health organisations | Recognise |

**Project 8: who benefits from Saudi salt policy?** Extend the Project 1 model with a distributional cost-effectiveness analysis: health gains and costs by sex, region, income and nationality (Saudi nationals vs non-nationals, who differ sharply in age structure and diet).

- **Data (all public):** population by nationality, sex, age and region from the Saudi 2022 census (GASTAT); subgroup salt intake and blood pressure from published GCC studies and Project 2; disease rates from GBD. Income is included only if Project 2 finds income-stratified intake data; otherwise the analysis covers sex, nationality and region.
- **Gap:** follows from Project 1, so if Project 1 is new, this is too. Distributional analyses of salt policy exist elsewhere, notably South Africa, but not for the GCC.
- **Fast to do:** it reuses Project 1's model. The new work is the subgroup inputs and the methods from lectures 8.7–8.9.
- **Target journals:** Health Policy and Planning, International Journal for Equity in Health.

**Primary textbooks:** WHO, *Everybody's Business* (2007); Cookson, Griffin, Norheim & Culyer (eds), *Distributional Cost-Effectiveness Analysis* (Oxford, 2020); World Bank, *Analyzing Health Equity Using Household Survey Data* (free).

---

## Block 9 — Research practice, qualitative and mixed methods (weeks 108–119)

| # | Lecture | Tier |
|---|---|---|
| 9.1 | Writing a study protocol; pre-registration | Master |
| 9.2 | Research ethics: consent, secondary data, Saudi review boards (NCBE) | Use |
| 9.3 | Qualitative research: paradigms, sampling, rigour | Use |
| 9.4 | Document analysis: selecting, sampling and coding policy documents (interviews and focus groups covered briefly) | Use |
| 9.5 | Thematic and framework analysis | Master |
| 9.6 | Mixed methods designs | Use |
| 9.7 | Implementation science: why proven interventions fail in practice (CFIR, RE-AIM) | Use |
| 9.8 | Reporting guidelines: STROBE, RECORD, CHEERS, COREQ, PRISMA, TRIPOD+AI | Use |
| 9.9 | Peer review and responding to reviewers | Use |
| 9.10 | Grant writing and research funding | Use |
| 9.11 | Writing a PhD proposal | Master |

**Project 9: how is Saudi salt policy implemented?** A documentary policy analysis of public sources from 2016 to 2026: SFDA standards and technical regulations, the GSO 2612:2025 standard, SFDA reports and announcements, WHO EMRO country reports, industry statements and press coverage. Coded with the CFIR framework, it explains the compliance gap that Project 1 models.

- **Data:** public documents only. No participants, so no ethics approval is needed.
- **Gap:** not yet checked. Saudi salt research so far is surveys of knowledge and attitudes, not implementation, so this looks open, but check in week 108.
- **Needs:** ideally a co-author experienced in qualitative work.
- **Upgrade if time allows later:** an interview study with bakery managers, manufacturers and SFDA staff. That needs NCBE ethics approval and is outside this curriculum.
- **Second output:** your PhD proposal, built on either research thread (see the overview).
- **Target journals:** BMJ Open first; Public Health Nutrition or Health Policy and Planning as backup.

**Primary textbooks:** Green & Thorogood, *Qualitative Methods for Health Research*; Braun & Clarke, *Thematic Analysis: A Practical Guide*.

---

## Project rules

**Publication standard** — every project must meet all of these before it starts:

1. A verified gap, written up as one paragraph (the gap check below).
2. Public data only. Every dataset can be downloaded, or accessed free after registering (PhysioNet credentialing, WHO microdata terms). No project depends on an institution agreeing to share data.
3. Two named peer-reviewed target journals, a first choice and a backup, both indexed in PubMed or Scopus. Check every journal against DOAJ or Think.Check.Submit to rule out predatory publishers.
4. The matching reporting guideline (STROBE, PRISMA, CHEERS, TRIPOD+AI, COREQ and so on), followed from the protocol stage, not retrofitted.
5. A preprint on medRxiv at submission, so the work is citable while under review.

If a project can't meet all five, it gets replaced with its fallback, not started anyway.

**Gap check before every project** (about 2 days, in the block's first week):

1. Search PubMed with a structured query, plus Google Scholar and medRxiv/Research Square for preprints.
2. Check the last 12 months closely; that's where scoops come from.
3. Write one paragraph: what exists, what's missing, and why your study fills it. This paragraph becomes the paper's introduction.
4. If the gap is gone, switch to the next candidate rather than forcing it.

**Momentum rule:** if a project stalls for two sprints, cut its scope instead of re-planning. A smaller published paper beats a larger unfinished one.

**Data before design:** download the data and run a feasibility count before writing a protocol. Start PhysioNet credentialing in Block 1 so MIMIC-IV is ready for Project 5A.

**People, not data:** two projects still need collaborators. Project 2 needs a second screener (recruit by week 13) and Project 7 needs two clinician raters (recruit by week 80). Offer co-authorship.

**Realistic output:** 10 projects are planned, but at 4–6 project hours a week (about 480–710 hours in total) expect 3–5 submitted papers, not 10. Projects 1, 2, 5A and 8 are the core; treat the rest as optional and drop them first when time runs short. Peer review adds 3–6 months per paper. Projects 4, 6 and 9 carry the most risk.

**Next step:** Lecture 1.1 is written. Lecture 1.2 (Rose's prevention paradox) is next, and PhysioNet credentialing can start this week.
