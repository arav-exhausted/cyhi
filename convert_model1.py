import os
import joblib

from sklearn.pipeline import Pipeline
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType


# ============================================================
# PATHS
# ============================================================

MODEL_PATH = "model/model1/scrollshield_toxicity_model.joblib"
OUTPUT_DIR = "model/model1/onnx"


# ============================================================
# LOAD COMPLETE MODEL
# ============================================================

print("Loading Model 1...")

obj = joblib.load(MODEL_PATH)

vectorizer = obj["vectorizer"]
models = obj["models"]
target_cols = obj["target_cols"]

print("Targets:", target_cols)
print("Threshold:", obj["threshold"])


# ============================================================
# CREATE OUTPUT DIRECTORY
# ============================================================

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================
# CONVERT ALL 6 MODELS
# ============================================================

for label in target_cols:

    print("\n========================================")
    print(f"Converting: {label}")
    print("========================================")

    classifier = models[label]

    # Exact Python pipeline:
    #
    # text
    #   ↓
    # FeatureUnion
    #   ├── word TF-IDF
    #   └── char TF-IDF
    #   ↓
    # Logistic Regression
    #
    pipeline = Pipeline([
        ("tfidf", vectorizer),
        ("classifier", classifier)
    ])

    initial_type = [
        ("text", StringTensorType([None, 1]))
    ]

    try:

        onnx_model = convert_sklearn(
            pipeline,
            initial_types=initial_type,
            target_opset=15
        )

        output_path = os.path.join(
            OUTPUT_DIR,
            f"{label}.onnx"
        )

        with open(output_path, "wb") as f:
            f.write(onnx_model.SerializeToString())

        print(f"SUCCESS: {output_path}")

    except Exception as e:

        print(f"FAILED: {label}")
        print(type(e).__name__)
        print(e)


# ============================================================
# DONE
# ============================================================

print("\n========================================")
print("MODEL 1 CONVERSION COMPLETE")
print("========================================")

print("\nGenerated files:")

if os.path.exists(OUTPUT_DIR):
    for file in os.listdir(OUTPUT_DIR):
        print(" -", file)