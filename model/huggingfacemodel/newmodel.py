import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification


MODEL_NAME = "s-nlp/roberta_toxicity_classifier"


print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

print("Loading model...")
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)

model.eval()

print("Model loaded successfully!")


def predict_toxicity(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=1)

    neutral_probability = probabilities[0][0].item()
    toxic_probability = probabilities[0][1].item()

    return {
        "text": text,
        "neutral_probability": neutral_probability,
        "toxic_probability": toxic_probability,
        "is_toxic": toxic_probability >= 0.5
    }


if __name__ == "__main__":

    text = "You are a wonderful person."

    result = predict_toxicity(text)

    print(result)