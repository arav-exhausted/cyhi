import os
import numpy as np
import onnxruntime as ort


MODEL_DIR = "model/model1/onnx"

text = "He is such a motherfucker and so toxic that we have to beat him."


for filename in sorted(os.listdir(MODEL_DIR)):

    if not filename.endswith(".onnx"):
        continue

    path = os.path.join(MODEL_DIR, filename)

    session = ort.InferenceSession(path)

    input_name = session.get_inputs()[0].name

    output = session.run(
        None,
        {
            input_name: np.array([[text]], dtype=object)
        }
    )

    print("\n==============================")
    print(filename)
    print("==============================")

    for i, value in enumerate(output):
        print(f"Output {i}:", value)