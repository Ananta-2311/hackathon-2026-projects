import json
import os
from datetime import date
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

FHIR_PATH = "data/fhir"

def calculate_age(birth_date):
    if not birth_date:
        return 60
    try:
        year = int(birth_date.split("-")[0])
        return date.today().year - year
    except Exception:
        return 60

def extract_features(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    age = 60
    gender = 0
    conditions_count = 0
    medications_count = 0
    encounters_count = 0

    for entry in data.get("entry", []):
        resource = entry.get("resource", {})
        resource_type = resource.get("resourceType")

        if resource_type == "Patient":
            age = calculate_age(resource.get("birthDate"))
            gender = 1 if resource.get("gender") == "female" else 0

        elif resource_type == "Condition":
            conditions_count += 1

        elif resource_type == "MedicationRequest":
            medications_count += 1

        elif resource_type == "Encounter":
            encounters_count += 1

    prior_admissions = max(0, encounters_count - 1)

    # Hackathon label: high complexity patients are treated as readmission risk
    readmitted_30_days = 1 if (
        prior_admissions >= 3 or medications_count >= 7 or conditions_count >= 5 or age >= 70
    ) else 0

    return {
        "age": age,
        "gender": gender,
        "conditions_count": conditions_count,
        "medications_count": medications_count,
        "encounters_count": encounters_count,
        "prior_admissions": prior_admissions,
        "readmitted_30_days": readmitted_30_days,
    }

rows = []

for filename in os.listdir(FHIR_PATH):
    if filename.endswith(".json") and not filename.startswith(("hospitalInformation", "practitionerInformation")):
        rows.append(extract_features(os.path.join(FHIR_PATH, filename)))

df = pd.DataFrame(rows)

print("Loaded patients:", len(df))
print(df.head())

if len(df) < 2:
    raise ValueError("Need at least 2 patient JSON files to train the model.")

X = df.drop("readmitted_30_days", axis=1)
y = df["readmitted_30_days"]

model = RandomForestClassifier(n_estimators=100, random_state=42)

if len(set(y)) < 2:
    print("Warning: only one class found. Adding a small demo row so model can train.")
    demo_row = {
        "age": 30,
        "gender": 0,
        "conditions_count": 1,
        "medications_count": 1,
        "encounters_count": 1,
        "prior_admissions": 0,
        "readmitted_30_days": 0 if y.iloc[0] == 1 else 1,
    }
    df = pd.concat([df, pd.DataFrame([demo_row])], ignore_index=True)
    X = df.drop("readmitted_30_days", axis=1)
    y = df["readmitted_30_days"]

if len(df) >= 5:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    print("Accuracy:", accuracy_score(y_test, predictions))
else:
    model.fit(X, y)
    print("Small dataset, trained on all available rows.")

joblib.dump(model, "model.pkl")
print("Model saved as model.pkl")
