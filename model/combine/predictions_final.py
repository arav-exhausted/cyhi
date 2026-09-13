import joblib
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# =========================================================
# MODEL 1
# =========================================================

MODEL1_PATH = "model/model1"

vectorizer = joblib.load(
    f"{MODEL1_PATH}/tfidf_vectorizer.joblib"
)

models = {
    "toxic": joblib.load(f"{MODEL1_PATH}/toxic.pkl"),
    "severe_toxicity": joblib.load(f"{MODEL1_PATH}/severe_toxic.pkl"),
    "obscene": joblib.load(f"{MODEL1_PATH}/obscene.pkl"),
    "threat": joblib.load(f"{MODEL1_PATH}/threat.pkl"),
    "insult": joblib.load(f"{MODEL1_PATH}/insult.pkl"),
    "identity_hate": joblib.load(f"{MODEL1_PATH}/identity_hate.pkl"),
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

MODEL3_PATH = "model/model3"

tokenizer = AutoTokenizer.from_pretrained(MODEL3_PATH)

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
# FINAL PREDICTION
# =========================================================

def predict(text):

    model1_result = predict_model1(text)
    model3_result = predict_model3(text)

    model1_score = sum(model1_result.values()) / len(model1_result)

    model3_score = model3_result["toxic"]

    # Temporary combination
    final_score = (model1_score + model3_score) / 2

    return {
        "final_toxicity": final_score,
        "is_toxic": final_score >= 0.5,

        # "model1": model1_result,

        # "model3": model3_result
    }


# =========================================================
# TEST
# =========================================================

if __name__ == "__main__":

    text = "He is such a motherfucker and so toxic that we have to beat him."

    result = predict(text)

    print("\nFINAL RESULT:")
    print(result)