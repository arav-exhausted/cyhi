import joblib

# Load vectorizer
vectorizer = joblib.load("model/model1/tfidf_vectorizer.joblib")

# Load models
models = {
    "toxic": joblib.load("model/model1/toxic.pkl"),
    "severe_toxicity": joblib.load("model/model1/severe_toxic.pkl"),
    "obscene": joblib.load("model/model1/obscene.pkl"),
    "threat": joblib.load("model/model1/threat.pkl"),
    "insult": joblib.load("model/model1/insult.pkl"),
    "identity_hate": joblib.load("model/model1/identity_hate.pkl")
}


def predict_model1(text):

    # SAME preprocessing used during training
    processed_text = text  # replace with your actual preprocessing

    # Transform, DON'T fit
    X = vectorizer.transform([processed_text])

    results = {}

    for label, model in models.items():
        probability = model.predict_proba(X)[0][1]
        results[label] = probability

    return results



print(predict_model1("He is such a motherfucker and so toxic that we have to beat him."))