import os
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency
    OpenAI = None

try:
    from supabase import Client, create_client
except Exception:  # pragma: no cover - optional dependency
    Client = Any  # type: ignore[misc,assignment]
    create_client = None

predict = None


app = FastAPI(title="DischargeIQ Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRiskRequest(BaseModel):
    patient_id: str | None = None
    name: str
    age: int
    gender: int | str
    conditions_count: int
    medications_count: int
    encounters_count: int
    prior_admissions: int


class SimplifyDischargeRequest(BaseModel):
    patient_id: str | None = None
    note: str


class ChatRequest(BaseModel):
    patient_id: str
    message: str


MARIA_PATIENT_ID = "60a0567c-d7b8-4139-accc-d103ca919017"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_predict_function() -> Any | None:
    global predict
    if callable(predict):
        return predict

    ml_predict_path = Path(__file__).resolve().parents[1] / "ML" / "predict.py"
    if not ml_predict_path.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location("ml_predict_module", ml_predict_path)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        candidate = getattr(module, "predict", None)
        if callable(candidate):
            predict = candidate
            return predict
    except Exception:
        return None
    return None


def _fallback_patients() -> list[dict[str, Any]]:
    return [
        {
            "id": "demo-1",
            "name": "John Demo",
            "age": 67,
            "risk_level": "medium",
            "created_at": _now_iso(),
        },
        {
            "id": "demo-2",
            "name": "Asha Demo",
            "age": 52,
            "risk_level": "low",
            "created_at": _now_iso(),
        },
    ]


def _fallback_alerts() -> list[dict[str, Any]]:
    return [
        {
            "id": f"alert-{uuid4()}",
            "patient_id": "demo-1",
            "message": "No active alerts from Supabase. Showing fallback.",
            "severity": "info",
            "created_at": _now_iso(),
        }
    ]


def _get_supabase() -> Client | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key or create_client is None:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None


def _safe_supabase_insert(table: str, payload: dict[str, Any]) -> None:
    sb = _get_supabase()
    if not sb:
        return
    try:
        sb.table(table).insert(payload).execute()
    except Exception:
        # Must never crash if insert fails.
        return


def _safe_supabase_upsert_patient(patient_id: str | None, payload: dict[str, Any]) -> str:
    sb = _get_supabase()
    if patient_id:
        payload["id"] = patient_id
    if not sb:
        return str(payload.get("id") or patient_id or uuid4())
    try:
        if payload.get("id"):
            sb.table("patients").upsert(payload).execute()
            return str(payload["id"])
        created = sb.table("patients").insert(payload).execute()
        if created.data and created.data[0].get("id"):
            return str(created.data[0]["id"])
    except Exception:
        pass
    return str(payload.get("id") or patient_id or uuid4())


def _safe_select(
    table: str,
    *,
    order_field: str | None = None,
    desc: bool = False,
    eq_filters: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    sb = _get_supabase()
    if not sb:
        return []
    try:
        query = sb.table(table).select("*")
        if eq_filters:
            for key, value in eq_filters.items():
                query = query.eq(key, value)
        if order_field:
            query = query.order(order_field, desc=desc)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def _simplify_note_rule_based(note: str) -> str:
    replacements = {
        "hypertension": "high blood pressure",
        "myocardial infarction": "heart attack",
        "dyspnea": "trouble breathing",
        "analgesic": "pain medicine",
        "administer": "give",
        "discontinue": "stop",
        "PRN": "as needed",
    }
    simplified = note
    for medical, plain in replacements.items():
        simplified = simplified.replace(medical, plain).replace(medical.upper(), plain)
    if len(simplified) > 600:
        simplified = simplified[:600].rsplit(" ", 1)[0] + "..."
    return simplified.strip()


def _openai_client() -> Any | None:
    if OpenAI is None:
        return None
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        return OpenAI(api_key=api_key)
    except Exception:
        return None


def _symptom_alerts(message: str) -> list[str]:
    text = message.lower()
    mapping = {
        "chest pain": ["chest pain", "tight chest", "chest pressure"],
        "breathing trouble": ["trouble breathing", "shortness of breath", "can't breathe"],
        "diarrhea": ["diarrhea", "loose stool"],
        "vomiting": ["vomit", "vomiting", "throwing up"],
        "fever": ["fever", "high temperature", "chills"],
        "severe pain": ["severe pain", "extreme pain", "unbearable pain"],
    }
    detected = []
    for symptom, keywords in mapping.items():
        if any(keyword in text for keyword in keywords):
            detected.append(symptom)
    return detected


def _normalize_gender(value: int | str | None) -> int:
    if isinstance(value, int):
        return value
    text = str(value or "").strip().lower()
    if text in {"female", "f", "1"}:
        return 1
    if text in {"male", "m", "0"}:
        return 0
    return 1


def _map_patient_to_dashboard(patient: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": patient.get("id"),
        "name": patient.get("name") or "Maria",
        "age": patient.get("age") or 74,
        "gender": patient.get("gender") or "Female",
        "email": patient.get("email") or "",
        "phone": patient.get("phone") or "",
        "address": patient.get("address") or "",
        "diagnosis": patient.get("diagnosis") or "Heart Failure",
        "doctor": patient.get("doctor") or "Dr. Smith",
        "dischargeDate": patient.get("discharge_date") or patient.get("created_at"),
        "medicalHistory": patient.get("medical_history") or "",
        "prescription": patient.get("prescription") or "",
        "patientReport": patient.get("patient_report") or "",
        "predictionPercentage": patient.get("prediction_percentage") or patient.get("readmission_probability") or 50,
        "riskLevel": patient.get("risk_level") or "High",
        "conditionsCount": patient.get("conditions_count") or 6,
        "medicationsCount": patient.get("medications_count") or 9,
        "encountersCount": patient.get("encounters_count") or 12,
        "priorAdmissions": patient.get("prior_admissions") or 4,
        "currentAppointment": patient.get("current_appointment") or "",
        "nextAppointmentDate": patient.get("next_appointment_date"),
    }


def _maria_dashboard_fallback() -> dict[str, Any]:
    return {
        "patient": {
            "id": MARIA_PATIENT_ID,
            "name": "Maria",
            "age": 74,
            "gender": "Female",
            "email": "patient@dischargeiq.com",
            "phone": "",
            "address": "",
            "diagnosis": "Heart Failure",
            "doctor": "Dr. Smith",
            "dischargeDate": _now_iso(),
            "medicalHistory": "",
            "prescription": "",
            "patientReport": "",
            "predictionPercentage": 50,
            "riskLevel": "Medium",
            "conditionsCount": 6,
            "medicationsCount": 9,
            "encountersCount": 12,
            "priorAdmissions": 4,
            "currentAppointment": "",
            "nextAppointmentDate": None,
        },
        "dischargeNotes": {
            "originalNote": (
                "Administer prescribed cardiac medication twice daily with food and monitor for dyspnea, "
                "chest discomfort, edema, or dizziness."
            ),
            "simplifiedNote": (
                "Take your heart medicine two times a day with food. Call your doctor if you have chest pain, "
                "trouble breathing, swelling, or dizziness."
            ),
        },
        "chatMessages": [],
        "alerts": [],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/patients")
def get_patients() -> dict[str, Any]:
    patients = _safe_select("patients", order_field="created_at", desc=True)
    if not patients:
        patients = _fallback_patients()
    return {"patients": patients}


@app.get("/alerts")
def get_alerts() -> dict[str, Any]:
    alerts = _safe_select("alerts", order_field="created_at", desc=True)
    if not alerts:
        alerts = _fallback_alerts()
    return {"alerts": alerts}


@app.post("/predict-risk")
def predict_risk(payload: PredictRiskRequest) -> dict[str, Any]:
    features = {
        "age": payload.age,
        "gender": _normalize_gender(payload.gender),
        "conditions_count": payload.conditions_count,
        "medications_count": payload.medications_count,
        "encounters_count": payload.encounters_count,
        "prior_admissions": payload.prior_admissions,
    }

    try:
        predict_fn = _get_predict_function()
        if predict_fn is None:
            raise RuntimeError("ML predict import unavailable")
        result = predict_fn(features)
        risk_level = str(result["risk_level"])
        probability = float(result["readmission_probability"])
        reasons = result.get("reasons", [])
    except Exception:
        risk_level = "Medium"
        probability = 50.0
        reasons = ["Model unavailable, using fallback demo risk"]

    patient_id = _safe_supabase_upsert_patient(
        payload.patient_id,
        {
            "name": payload.name,
            "age": payload.age,
            "gender": payload.gender,
            "conditions_count": payload.conditions_count,
            "medications_count": payload.medications_count,
            "encounters_count": payload.encounters_count,
            "prior_admissions": payload.prior_admissions,
            "risk_level": risk_level,
            "readmission_probability": probability,
            "prediction_percentage": probability,
            "updated_at": _now_iso(),
        },
    )

    return {
        "patient_id": patient_id,
        "readmission_probability": probability,
        "prediction_percentage": probability,
        "risk_level": risk_level,
        "reasons": reasons,
    }


@app.post("/simplify-discharge")
def simplify_discharge(payload: SimplifyDischargeRequest) -> dict[str, Any]:
    openai_client = _openai_client()
    simplified = None
    method = "rule_based"

    if openai_client:
        try:
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Rewrite discharge instructions in plain language for patients. "
                            "Keep it concise, clear, and actionable."
                        ),
                    },
                    {"role": "user", "content": payload.note},
                ],
                temperature=0.2,
            )
            simplified = completion.choices[0].message.content.strip()
            method = "openai"
        except Exception:
            simplified = None

    if not simplified:
        simplified = _simplify_note_rule_based(payload.note)

    record = {
        "id": str(uuid4()),
        "patient_id": payload.patient_id,
        "original_note": payload.note,
        "simplified_note": simplified,
        "created_at": _now_iso(),
    }
    _safe_supabase_insert("discharge_notes", record)
    return {"simplified_note": simplified, "method": method}


@app.post("/chat")
def chat(payload: ChatRequest) -> dict[str, Any]:
    patient_message_record = {
        "id": str(uuid4()),
        "patient_id": payload.patient_id,
        "role": "user",
        "message": payload.message,
        "created_at": _now_iso(),
    }
    _safe_supabase_insert("chat_messages", patient_message_record)

    detected = _symptom_alerts(payload.message)
    for symptom in detected:
        _safe_supabase_insert(
            "alerts",
            {
                "id": str(uuid4()),
                "patient_id": payload.patient_id,
                "message": f"Potential {symptom} detected from patient chat.",
                "severity": "high" if symptom in {"chest pain", "breathing trouble"} else "medium",
                "created_at": _now_iso(),
            },
        )

    if detected:
        assistant_reply = (
            "Thanks for sharing. I flagged these symptoms for care-team review: "
            + ", ".join(detected)
            + ". If symptoms get worse, seek urgent care."
        )
    else:
        assistant_reply = (
            "Thanks for the update. I have recorded your message and shared it with the care team."
        )

    _safe_supabase_insert(
        "chat_messages",
        {
            "id": str(uuid4()),
            "patient_id": payload.patient_id,
            "role": "assistant",
            "message": assistant_reply,
            "created_at": _now_iso(),
        },
    )

    return {
        "reply": assistant_reply,
        "detected_symptoms": detected,
        "alerts_created": len(detected),
    }


@app.post("/patient-dashboard")
@app.get("/patient-dashboard")
def patient_dashboard(patient_id: str | None = None, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    selected_patient: dict[str, Any] | None = None

    # 1) Explicit patient_id query param.
    if patient_id:
        patient_rows = _safe_select("patients", eq_filters={"id": patient_id}, limit=1)
        if patient_rows:
            selected_patient = patient_rows[0]

    # 2) If no patient_id, resolve via logged-in user profile_id.
    if not selected_patient and x_user_id:
        patient_rows = _safe_select("patients", eq_filters={"profile_id": x_user_id}, limit=1)
        if patient_rows:
            selected_patient = patient_rows[0]

    # 3) Fallback to Maria patient id.
    if not selected_patient:
        maria_rows = _safe_select("patients", eq_filters={"id": MARIA_PATIENT_ID}, limit=1)
        if maria_rows:
            selected_patient = maria_rows[0]
        else:
            return _maria_dashboard_fallback()

    # For Maria demo, refresh prediction from ML on dashboard load.
    if str(selected_patient.get("id")) == MARIA_PATIENT_ID:
        maria_payload = PredictRiskRequest(
            patient_id=MARIA_PATIENT_ID,
            name=selected_patient.get("name") or "Maria Gomez",
            age=int(selected_patient.get("age") or 74),
            gender=_normalize_gender(selected_patient.get("gender")),
            conditions_count=int(selected_patient.get("conditions_count") or 6),
            medications_count=int(selected_patient.get("medications_count") or 9),
            encounters_count=int(selected_patient.get("encounters_count") or 12),
            prior_admissions=int(selected_patient.get("prior_admissions") or 4),
        )
        predict_risk(maria_payload)
        refreshed = _safe_select("patients", eq_filters={"id": MARIA_PATIENT_ID}, limit=1)
        if refreshed:
            selected_patient = refreshed[0]

    pid = str(selected_patient.get("id"))
    notes = _safe_select("discharge_notes", eq_filters={"patient_id": pid}, order_field="created_at", desc=True, limit=1)
    chats = _safe_select("chat_messages", eq_filters={"patient_id": pid}, order_field="created_at", desc=False)
    alerts = _safe_select("alerts", eq_filters={"patient_id": pid}, order_field="created_at", desc=True)
    note = notes[0] if notes else {}

    return {
        "patient": _map_patient_to_dashboard(selected_patient),
        "dischargeNotes": {
            "originalNote": note.get("original_note")
            or (
                "Administer prescribed cardiac medication twice daily with food and monitor for dyspnea, "
                "chest discomfort, edema, or dizziness."
            ),
            "simplifiedNote": note.get("simplified_note")
            or (
                "Take your heart medicine two times a day with food. Call your doctor if you have chest pain, "
                "trouble breathing, swelling, or dizziness."
            ),
        },
        "chatMessages": chats,
        "alerts": alerts,
    }
