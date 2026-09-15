import sys
from pathlib import Path

# Project root: cyhi/
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))


from fastapi import FastAPI
from pydantic import BaseModel

from model.model1.preprocess import clean_comment
from model.combine.predictions_final import predict



app = FastAPI()



class TextRequest(BaseModel):
    text:str

def preprocess(text:str):


    pass



@app.get("/")

def root():
    return {
        "status" : "Everything is working fine"
    }

@app.post("/predict")

def get_predict(request:TextRequest):
    text = request.text
    processed_text = clean_comment(text)
    probability = predict(processed_text)

    return{
        "probability" : probability
    }