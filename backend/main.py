from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/")

def start():
    print("Hello World!!")


@app.get("/predict")

def predict():
    pass