import os
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
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


def _load_dotenv_file() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        # Must never fail app startup due to env parsing.
        return


_load_dotenv_file()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or os.getenv("SUPABASE_KEY")


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
    language: str = "English"


class SendDischargeNoteRequest(BaseModel):
    patient_id: str
    original_note: str
    simplified_note: str
    language: str = "English"


class PrescriptionExtractRequest(BaseModel):
    patient_id: str
    prescriptionText: str


class UpdatePrescriptionRequest(BaseModel):
    patient_id: str
    prescription: str


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
    maria = {
        "id": MARIA_PATIENT_ID,
        "name": "Maria Gomez",
        "age": 74,
        "gender": "Female",
        "diagnosis": "Heart Failure",
        "risk_level": None,
        "prediction_percentage": None,
        "readmission_probability": None,
        "conditions_count": 6,
        "medications_count": 9,
        "encounters_count": 12,
        "prior_admissions": 4,
        "prescription": "",
        "patient_report": "",
        "medical_history": "",
        "doctor": "Dr. Smith",
        "created_at": _now_iso(),
    }
    return [_refresh_patient_prediction(maria)]


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
    if not SUPABASE_URL or not SUPABASE_KEY or create_client is None:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        return None


def _is_forbidden_error(error: Exception) -> bool:
    text = str(error).lower()
    return "403" in text or "forbidden" in text


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
        "fainting": ["fainting", "fainted", "passed out"],
        "confusion": ["confusion", "confused", "disoriented"],
        "bleeding": ["bleeding", "blood loss", "bleed"],
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


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def _predict_from_patient_record(patient: dict[str, Any]) -> tuple[float, str, list[str]]:
    existing_probability = patient.get("prediction_percentage") or patient.get("readmission_probability")
    existing_risk_level = patient.get("risk_level")
    fallback_probability = float(existing_probability) if existing_probability is not None else None
    fallback_risk_level = str(existing_risk_level) if existing_risk_level else None

    features = {
        "age": _safe_int(patient.get("age"), 0),
        "gender": 1 if str(patient.get("gender") or "").strip().lower() in {"female", "f", "1"} else 0,
        "conditions_count": _safe_int(patient.get("conditions_count"), 0),
        "medications_count": _safe_int(patient.get("medications_count"), 0),
        "encounters_count": _safe_int(patient.get("encounters_count"), 0),
        "prior_admissions": _safe_int(patient.get("prior_admissions"), 0),
    }

    try:
        predict_fn = _get_predict_function()
        if predict_fn is None:
            raise RuntimeError("ML predict import unavailable")
        result = predict_fn(features)
        probability = float(result["readmission_probability"])
        risk_level = str(result["risk_level"])
        reasons = result.get("reasons", [])
        return probability, risk_level, reasons
    except Exception:
        if fallback_probability is None or fallback_risk_level is None:
            raise
        return fallback_probability, fallback_risk_level, ["Model unavailable, using stored prediction"]


def _risk_reasons_for_patient(patient: dict[str, Any]) -> list[str]:
    reasons = [
        f"Age: {_safe_int(patient.get('age'), 0)}",
        f"Conditions: {_safe_int(patient.get('conditions_count'), 0)}",
        f"Medications: {_safe_int(patient.get('medications_count'), 0)}",
        f"Prior admissions: {_safe_int(patient.get('prior_admissions'), 0)}",
    ]
    return reasons


def _recommended_action_for_risk(risk_level: str | None) -> str:
    risk = str(risk_level or "").strip().lower()
    if risk == "high":
        return "Schedule 48-hour follow-up, review symptoms, verify caregiver support, and monitor closely."
    if risk == "medium":
        return "Schedule 7-day follow-up and confirm medication understanding."
    return "Standard discharge follow-up in 14 days."


def _refresh_patient_prediction(patient: dict[str, Any], sb: Client | None = None) -> dict[str, Any]:
    try:
        probability, risk_level, _reasons = _predict_from_patient_record(patient)
    except Exception:
        return patient
    patient["readmission_probability"] = probability
    patient["prediction_percentage"] = probability
    patient["risk_level"] = risk_level

    if sb and patient.get("id"):
        try:
            sb.table("patients").update(
                {
                    "readmission_probability": probability,
                    "prediction_percentage": probability,
                    "risk_level": risk_level,
                }
            ).eq("id", patient.get("id")).execute()
        except Exception:
            pass
    return patient


def _map_patient_to_dashboard(patient: dict[str, Any]) -> dict[str, Any]:
    prescription = patient.get("prescription") or ""
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
        "predictionPercentage": patient.get("prediction_percentage") or patient.get("readmission_probability"),
        "riskLevel": patient.get("risk_level") or "Medium",
        "conditionsCount": patient.get("conditions_count") or 0,
        "medicationsCount": patient.get("medications_count") or 0,
        "encountersCount": patient.get("encounters_count") or 0,
        "priorAdmissions": patient.get("prior_admissions") or 0,
        "currentAppointment": patient.get("current_appointment") or "",
        "nextAppointmentDate": patient.get("next_appointment_date"),
        "reminders": _extract_prescription_reminders(prescription),
        "riskReasons": _risk_reasons_for_patient(patient),
        "recommendedAction": _recommended_action_for_risk(patient.get("risk_level")),
    }


def _extract_prescription_reminders(prescription_text: str) -> list[dict[str, str]]:
    reminders: list[dict[str, str]] = []
    if not prescription_text.strip():
        return reminders

    for line in prescription_text.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        parts = [part.strip() for part in cleaned.split("|")]
        name = parts[0] if len(parts) >= 1 else ""
        dose = parts[1] if len(parts) >= 2 else ""
        schedule = parts[2] if len(parts) >= 3 else "As directed"
        schedule_lower = schedule.lower()
        due_time = "As directed"
        if "morning" in schedule_lower and "evening" in schedule_lower:
            due_time = "Morning & Evening"
        elif "morning" in schedule_lower:
            due_time = "Morning"
        elif "night" in schedule_lower or "evening" in schedule_lower:
            due_time = "Evening"
        elif "daily" in schedule_lower:
            due_time = "Daily"
        reminders.append(
            {
                "name": name or "Medication",
                "dose": dose or "",
                "schedule": schedule,
                "dueTime": due_time,
            }
        )
    return reminders


def _map_patient_for_list(patient: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": patient.get("id"),
        "name": patient.get("name"),
        "age": patient.get("age"),
        "gender": patient.get("gender"),
        "diagnosis": patient.get("diagnosis"),
        "riskLevel": patient.get("risk_level"),
        "predictionPercentage": patient.get("prediction_percentage") or patient.get("readmission_probability"),
        "readmissionProbability": patient.get("readmission_probability"),
        "conditionsCount": patient.get("conditions_count"),
        "medicationsCount": patient.get("medications_count"),
        "encountersCount": patient.get("encounters_count"),
        "priorAdmissions": patient.get("prior_admissions"),
        "prescription": patient.get("prescription"),
        "patientReport": patient.get("patient_report"),
        "medicalHistory": patient.get("medical_history"),
        "doctor": patient.get("doctor"),
        "riskReasons": _risk_reasons_for_patient(patient),
        "recommendedAction": _recommended_action_for_risk(patient.get("risk_level")),
    }


def _maria_dashboard_fallback() -> dict[str, Any]:
    return {
        "patient": {
            "id": MARIA_PATIENT_ID,
            "name": "",
            "age": None,
            "gender": "",
            "email": "",
            "phone": "",
            "address": "",
            "diagnosis": "",
            "doctor": "",
            "dischargeDate": _now_iso(),
            "medicalHistory": "",
            "prescription": "",
            "patientReport": "",
            "predictionPercentage": None,
            "riskLevel": "",
            "conditionsCount": 0,
            "medicationsCount": 0,
            "encountersCount": 0,
            "priorAdmissions": 0,
            "currentAppointment": "",
            "nextAppointmentDate": None,
        },
        "dischargeNotes": {"originalNote": "", "simplifiedNote": "", "createdAt": None, "language": "English"},
        "noteHistory": [],
        "chatMessages": [],
        "alerts": [],
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/debug/config")
def debug_config() -> dict[str, bool]:
    return {
        "supabaseUrlConfigured": bool(SUPABASE_URL),
        "serviceRoleConfigured": bool(SUPABASE_SERVICE_ROLE_KEY),
        "supabaseKeyConfigured": bool(SUPABASE_KEY),
    }


@app.get("/patients")
def get_patients() -> dict[str, Any]:
    sb = _get_supabase()
    if not sb:
        return {"patients": [_map_patient_for_list(patient) for patient in _fallback_patients()], "error": "Supabase client unavailable"}

    try:
        response = sb.table("patients").select("*").order("created_at", desc=True).execute()
        data = response.data or []
        refreshed = [_refresh_patient_prediction(dict(patient), sb) for patient in data]
        return {
            "patients": [_map_patient_for_list(patient) for patient in refreshed],
            "error": None,
        }
    except Exception as error:
        if _is_forbidden_error(error):
            fallback = _fallback_patients()
            return {
                "patients": [_map_patient_for_list(patient) for patient in fallback],
                "error": "Supabase 403 Forbidden - using fallback demo patients",
            }
        return {"patients": [], "error": str(error)}


@app.get("/alerts")
def get_alerts() -> dict[str, Any]:
    alerts = _safe_select("alerts", order_field="created_at", desc=True)
    if not alerts:
        alerts = _fallback_alerts()
    return {"alerts": alerts}


@app.get("/chat-history")
def get_chat_history(patient_id: str) -> dict[str, Any]:
    chats = _safe_select("chat_messages", eq_filters={"patient_id": patient_id}, order_field="created_at", desc=False)
    return {"chatMessages": chats}


@app.get("/discharge-notes")
def get_discharge_notes(patient_id: str) -> dict[str, Any]:
    notes = _safe_select("discharge_notes", eq_filters={"patient_id": patient_id}, order_field="created_at", desc=True)
    return {"notes": notes}


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
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI is not configured for simplification.")
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
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI simplification failed: {exc}") from exc

    return {
        "originalNote": payload.note,
        "simplifiedNote": simplified,
        "language": payload.language,
        "method": "openai",
    }


@app.post("/send-discharge-note")
def send_discharge_note(payload: SendDischargeNoteRequest) -> dict[str, Any]:
    record = {
        "id": str(uuid4()),
        "patient_id": payload.patient_id,
        "original_note": payload.original_note,
        "simplified_note": payload.simplified_note,
        "language": payload.language,
        "created_at": _now_iso(),
    }
    _safe_supabase_insert("discharge_notes", record)
    _safe_supabase_insert(
        "alerts",
        {
            "id": str(uuid4()),
            "patient_id": payload.patient_id,
            "message": "New discharge instructions were sent by your doctor.",
            "severity": "info",
            "status": "open",
            "created_at": _now_iso(),
        },
    )
    return {
        "success": True,
        "dischargeNote": {
            "originalNote": payload.original_note,
            "simplifiedNote": payload.simplified_note,
            "language": payload.language,
        },
    }


@app.post("/prescriptions/extract")
def extract_prescription(payload: PrescriptionExtractRequest) -> dict[str, Any]:
    reminders = _extract_prescription_reminders(payload.prescriptionText)
    sb = _get_supabase()
    if sb:
        try:
            sb.table("patients").update(
                {
                    "prescription": payload.prescriptionText,
                    "medications_count": len(reminders),
                }
            ).eq("id", payload.patient_id).execute()
        except Exception:
            pass
    return {
        "extracted": reminders,
        "confirmation": "Prescription saved and reminders created.",
    }


@app.post("/update-prescription")
def update_prescription(payload: UpdatePrescriptionRequest) -> dict[str, Any]:
    reminders = _extract_prescription_reminders(payload.prescription)
    sb = _get_supabase()
    if sb:
        try:
            sb.table("patients").update(
                {
                    "prescription": payload.prescription,
                    "medications_count": len(reminders),
                }
            ).eq("id", payload.patient_id).execute()
        except Exception:
            pass
    return {
        "success": True,
        "prescription": payload.prescription,
        "reminders": reminders,
    }


@app.post("/chat")
def chat(payload: ChatRequest) -> dict[str, Any]:
    patient_message_record = {
        "id": str(uuid4()),
        "patient_id": payload.patient_id,
        "sender": "user",
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

    recent_chats = _safe_select("chat_messages", eq_filters={"patient_id": payload.patient_id}, order_field="created_at", desc=True, limit=8)
    chat_context = list(reversed(recent_chats))
    openai_client = _openai_client()
    assistant_reply = ""
    used_openai = False

    if openai_client:
        try:
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are a compassionate post-discharge health assistant. "
                        "Keep responses brief, clear, and actionable in plain language. "
                        "If red-flag symptoms are present, clearly recommend urgent care/ER immediately."
                    ),
                }
            ]
            for item in chat_context:
                sender = str(item.get("sender") or "").lower()
                content = str(item.get("message") or "").strip()
                if not content:
                    continue
                messages.append(
                    {
                        "role": "assistant" if sender == "assistant" else "user",
                        "content": content,
                    }
                )
            completion = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3,
            )
            assistant_reply = completion.choices[0].message.content.strip()
            used_openai = True
        except Exception:
            assistant_reply = ""

    if not assistant_reply:
        if detected:
            assistant_reply = (
                "Your symptoms may be serious (" + ", ".join(detected) + "). "
                "Please call 911 or go to the nearest ER now. I have notified your care team."
            )
        else:
            assistant_reply = "Thanks for the update. Keep resting, stay hydrated, and contact your care team if symptoms worsen."

    _safe_supabase_insert(
        "chat_messages",
        {
            "id": str(uuid4()),
            "patient_id": payload.patient_id,
            "sender": "assistant",
            "message": assistant_reply,
            "created_at": _now_iso(),
        },
    )

    return {
        "reply": assistant_reply,
        "detected_symptoms": detected,
        "alerts_created": len(detected),
        "used_openai": used_openai,
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

    # 2) If no patient_id, resolve via logged-in auth user id -> profiles -> patients.profile_id.
    if not selected_patient and x_user_id:
        sb = _get_supabase()
        if sb:
            try:
                profile_resp = sb.table("profiles").select("id").eq("id", x_user_id).limit(1).execute()
                if profile_resp.data:
                    profile_id = profile_resp.data[0].get("id")
                    patient_rows = _safe_select("patients", eq_filters={"profile_id": profile_id}, limit=1)
                    if patient_rows:
                        selected_patient = patient_rows[0]
            except Exception:
                pass

    # 3) Fallback to Maria patient id.
    if not selected_patient:
        maria_rows = _safe_select("patients", eq_filters={"id": MARIA_PATIENT_ID}, limit=1)
        if maria_rows:
            selected_patient = maria_rows[0]
        else:
            raise HTTPException(status_code=404, detail="Patient not found.")

    sb = _get_supabase()
    selected_patient = _refresh_patient_prediction(selected_patient, sb)

    pid = str(selected_patient.get("id"))
    notes = _safe_select("discharge_notes", eq_filters={"patient_id": pid}, order_field="created_at", desc=True)
    chats = _safe_select("chat_messages", eq_filters={"patient_id": pid}, order_field="created_at", desc=False)
    alerts = _safe_select("alerts", eq_filters={"patient_id": pid}, order_field="created_at", desc=True)
    note = notes[0] if notes else {}

    return {
        "patient": _map_patient_to_dashboard(selected_patient),
        "dischargeNotes": {
            "originalNote": note.get("original_note") or "",
            "simplifiedNote": note.get("simplified_note") or "",
            "createdAt": note.get("created_at"),
            "language": note.get("language") or "English",
        },
        "noteHistory": [
            {
                "id": item.get("id"),
                "originalNote": item.get("original_note"),
                "simplifiedNote": item.get("simplified_note"),
                "language": item.get("language") or "English",
                "createdAt": item.get("created_at"),
            }
            for item in notes
        ],
        "chatMessages": chats,
        "alerts": alerts,
    }
