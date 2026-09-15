import joblib
import torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL1_PATH = BASE_DIR / "model1"
MODEL3_PATH = BASE_DIR / "model3"


# =========================================================
# MODEL 1
# =========================================================

vectorizer = joblib.load(
    MODEL1_PATH / "tfidf_vectorizer.joblib"
)

models = {
    "toxic": joblib.load(MODEL1_PATH / "toxic.pkl"),
    "severe_toxicity": joblib.load(MODEL1_PATH / "severe_toxic.pkl"),
    "obscene": joblib.load(MODEL1_PATH / "obscene.pkl"),
    "threat": joblib.load(MODEL1_PATH / "threat.pkl"),
    "insult": joblib.load(MODEL1_PATH / "insult.pkl"),
    "identity_hate": joblib.load(MODEL1_PATH / "identity_hate.pkl"),
}


def predict_model1(text):

    X = vectorizer.transform([text])

    result = {}

    for label, model in models.items():
        result[label] = float(
            model.predict_proba(X)[0][1]
        )

    return result


# =========================================================
# MODEL 3
# =========================================================

tokenizer = AutoTokenizer.from_pretrained(
    MODEL3_PATH
)

model3 = AutoModelForSequenceClassification.from_pretrained(
    MODEL3_PATH
)

model3.eval()


def predict_model3(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True
    )

    with torch.no_grad():
        outputs = model3(**inputs)

    probabilities = torch.softmax(
        outputs.logits,
        dim=-1
    )[0]

    result = {}

    for i, prob in enumerate(probabilities):
        label = model3.config.id2label[i]
        result[label] = float(prob)

    return result


# =========================================================
# FINAL PROBABILITY
# =========================================================

def predict(text):

    # Model 1
    model1_result = predict_model1(text)

    model1_score = (
        sum(model1_result.values())
        / len(model1_result)
    )

    # Model 3
    model3_result = predict_model3(text)

    model3_score = model3_result["toxic"]

    # Combine both models
    final_probability = (
        model1_score + model3_score
    ) / 2

    return final_probability


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    text = "You are very Fuck good person."

    probability = predict(text)

    print("\nFINAL TOXICITY PROBABILITY:")
    print(probability)