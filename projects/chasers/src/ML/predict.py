import joblib
import pandas as pd
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"
model = joblib.load(MODEL_PATH)

def predict(patient):
    patient_df = pd.DataFrame([patient])

    probability = model.predict_proba(patient_df)[0][1]

    if probability >= 0.7:
        risk_level = "High"
    elif probability >= 0.4:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    reasons = []

    if patient["prior_admissions"] >= 3:
        reasons.append("Multiple prior hospital visits")

    if patient["medications_count"] >= 7:
        reasons.append("High medication complexity")

    if patient["conditions_count"] >= 5:
        reasons.append("Multiple medical conditions")

    if patient["age"] >= 65:
        reasons.append("Older age increases readmission risk")

    if not reasons:
        reasons.append("No major risk factors detected")

    return {
        "readmission_probability": float(round(probability * 100, 2)),
        "risk_level": risk_level,
        "reasons": reasons,
    }

if __name__ == "__main__":
    sample_patient = {
        "age": 74,
        "gender": 1,
        "conditions_count": 6,
        "medications_count": 9,
        "encounters_count": 12,
        "prior_admissions": 4,
    }

    print(predict(sample_patient))
