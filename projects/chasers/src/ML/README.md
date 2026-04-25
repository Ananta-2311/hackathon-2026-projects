# ML Risk Prediction Engine

This module uses FHIR-style synthetic patient data generated from Synthea to train a readmission risk model.

The model extracts patient features such as age, gender, number of conditions, medications, encounters, and prior admissions.

It outputs a 30-day readmission probability, a risk level, and explanation reasons for the doctor dashboard.

This is a hackathon prototype. In real hospital deployment, the model would be trained and validated on hospital historical data with fairness and performance checks.