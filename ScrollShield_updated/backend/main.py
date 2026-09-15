from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
from preprocess import clean_comment


# ============================================================
# LOAD NEW MODEL
# ============================================================

MODEL_PATH = "scrollshield_toxicity_model.joblib"

bundle = joblib.load(MODEL_PATH)

vectorizer = bundle["vectorizer"]
models = bundle["models"]
target_cols = bundle["target_cols"]
MODEL_THRESHOLD = bundle["threshold"]


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="ScrollShield ML API",
    description="Toxicity detection API for ScrollShield",
    version="2.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST FORMAT
# ============================================================

class TextInput(BaseModel):
    text: str


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "ScrollShield ML API is running",
        "model": "New combined toxicity model"
    }


# ============================================================
# PREDICT
# ============================================================

@app.post("/predict")
def predict(data: TextInput):

    # --------------------------------------------------------
    # 1. CLEAN TEXT
    # --------------------------------------------------------

    cleaned_text = clean_comment(data.text)


    # --------------------------------------------------------
    # 2. VECTORIZE
    # --------------------------------------------------------

    X = vectorizer.transform([cleaned_text])


    # --------------------------------------------------------
    # 3. GET ALL 6 MODEL SCORES
    # --------------------------------------------------------

    scores = {}

    for label in target_cols:

        model = models[label]

        probability = model.predict_proba(X)[0][1]

        scores[label.replace("_label", "")] = round(
            float(probability),
            4
        )


    # --------------------------------------------------------
    # 4. SCROLLSHIELD CATEGORIES
    # --------------------------------------------------------

    harmful = max(
        scores["severe_toxic"],
        scores["threat"],
        scores["identity_hate"]
    )


    personal_attack = max(
        scores["toxic"],
        scores["insult"]
    )


    negative = max(
        scores["toxic"],
        scores["obscene"]
    )


    # --------------------------------------------------------
    # 5. CATEGORY
    # --------------------------------------------------------

    if harmful >= MODEL_THRESHOLD:

        category = "harmful"
        confidence = harmful

    elif personal_attack >= MODEL_THRESHOLD:

        category = "personal_attack"
        confidence = personal_attack

    elif negative >= MODEL_THRESHOLD:

        category = "negative"
        confidence = negative

    else:

        category = "neutral"
        confidence = 0.0


    # --------------------------------------------------------
    # 6. RETURN
    # --------------------------------------------------------

    return {
        "text": data.text,

        "cleaned_text": cleaned_text,

        "category": category,

        "confidence": round(
            float(confidence),
            4
        ),

        "scores": scores,

        "threshold": MODEL_THRESHOLD
    }