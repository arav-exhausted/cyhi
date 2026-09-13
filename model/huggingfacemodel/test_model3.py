import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "../model3"

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

print("Loading model...")
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()

print("Model 3 loaded successfully!")


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


texts = [
    "I really enjoyed this video.",
    "You are an idiot.",
    "Thank you for your help.",
    "I hate you.",
    "I completely disagree with your opinion.",
    "I fucking love you.",
    "fuck you"
]

for text in texts:
    print("\n", predict_toxicity(text))