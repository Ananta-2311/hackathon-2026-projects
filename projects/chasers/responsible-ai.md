# Responsible AI - DischargeIQ

## Data Sources

DischargeIQ uses healthcare and interaction data needed for post-discharge risk support:

- Structured clinical and demographic records used for readmission risk prediction
- Discharge instructions and follow-up planning information
- Patient-reported symptom and wellness inputs collected through the chatbot
- Publicly available synthetic-style healthcare records used for development and testing

Data minimization is applied so only fields required for risk scoring, explanation, and follow-up support are processed.

## Model Choices

DischargeIQ uses task-specific AI components rather than one model for all tasks:

- A supervised risk prediction model estimates probability of readmission
- Explainability methods are used to surface key factors contributing to risk scores for clinician review
- A language model component rewrites discharge instructions into patient-friendly language and supports multilingual communication
- A symptom-triage chatbot model classifies urgency and triggers care-team alerts for potentially concerning responses

These choices balance predictive performance, explainability for clinicians, and usability for patients.

## Bias Considerations

Bias risks are actively considered across data, modeling, and deployment:

- **Representation bias:** Clinical populations can be imbalanced by age, sex, ethnicity, language, or socioeconomic status. Performance should be monitored across subgroups.
- **Label bias:** Historical outcomes may reflect systemic care-access differences, not only patient risk.
- **Language bias:** Simplification and translation quality may vary across dialects and literacy levels.
- **Automation bias:** Clinicians may over-trust model scores if uncertainty and limitations are not clearly communicated.

Mitigations include subgroup evaluation, threshold reviews with clinical stakeholders, human-in-the-loop decision making, and periodic model revalidation.

## Failure Cases

Known or possible failure modes include:

- False negatives where high-risk patients are predicted as low risk
- False positives that may create unnecessary follow-up workload
- Missing, delayed, or low-quality input data reducing reliability
- Chatbot misunderstanding free-text symptoms, slang, or mixed-language messages
- Alert fatigue when too many low-value alerts are generated
- Domain shift when patient populations or care workflows differ from training conditions

To reduce impact, the system should use confidence-aware outputs, clear escalation rules, fallback to manual review, and continuous monitoring for drift and safety signals.
