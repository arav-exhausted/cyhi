from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

MODEL_PATH = "model/model3/"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)

model.eval()


def predict_model3(text):

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probabilities = torch.softmax(outputs.logits, dim=-1)[0]

    result = {}

    for i, prob in enumerate(probabilities):
        label = model.config.id2label[i]
        result[label] = float(prob)

    return result


text = "He is such a motherfucker and so toxic that we have to beat him."

print(predict_model3(text))