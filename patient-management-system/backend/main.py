from pathlib import Path
import json
from typing import Annotated, Literal, Optional

from fastapi import FastAPI, HTTPException, Path as FastAPIPath, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, computed_field

app = FastAPI(title="Patient Management System API", version="1.0.0")

# For local development. In production, limit this to your frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "null",  # allows opening index.html directly while testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).with_name("patient.json")


class Patient(BaseModel):
    id: Annotated[str, Field(..., min_length=1, description="Unique patient ID", examples=["P006"])]
    name: Annotated[str, Field(..., min_length=1, description="Patient name")]
    city: Annotated[str, Field(..., min_length=1, description="City where the patient lives")]
    age: Annotated[int, Field(..., gt=0, lt=120, description="Patient age")]
    gender: Annotated[Literal["male", "female", "others"], Field(..., description="Patient gender")]
    height: Annotated[float, Field(..., gt=0, description="Height in metres")]
    weight: Annotated[float, Field(..., gt=0, description="Weight in kilograms")]

    @computed_field
    @property
    def bmi(self) -> float:
        return round(self.weight / (self.height**2), 2)

    @computed_field
    @property
    def verdict(self) -> str:
        if self.bmi < 18.5:
            return "Underweight"
        if self.bmi < 25:
            return "Normal"
        if self.bmi < 30:
            return "Overweight"
        return "Obese"


class PatientUpdate(BaseModel):
    name: Annotated[Optional[str], Field(default=None, min_length=1)]
    city: Annotated[Optional[str], Field(default=None, min_length=1)]
    age: Annotated[Optional[int], Field(default=None, gt=0, lt=120)]
    gender: Annotated[Optional[Literal["male", "female", "others"]], Field(default=None)]
    height: Annotated[Optional[float], Field(default=None, gt=0)]
    weight: Annotated[Optional[float], Field(default=None, gt=0)]


def load_data() -> dict:
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="patient.json was not found beside main.py")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="patient.json contains invalid JSON")


def save_data(data: dict) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)


@app.get("/")
def hello():
    return {"message": "Patient Management System API is running"}


@app.get("/about")
def about():
    return {"message": "API to create, view, update, sort and delete patient records"}


@app.get("/view")
def view_patients():
    return load_data()


@app.get("/patient/{patient_id}")
def view_patient(
    patient_id: str = FastAPIPath(..., description="ID of the patient in the database", examples=["P001"])
):
    data = load_data()
    if patient_id in data:
        return {"id": patient_id, **data[patient_id]}
    raise HTTPException(status_code=404, detail="Patient not found")


@app.get("/sort")
def sort_patients(
    sort_by: str = Query(..., description="Sort by height, weight or bmi"),
    order: str = Query("asc", description="asc or desc"),
):
    valid_fields = ["height", "weight", "bmi"]
    if sort_by not in valid_fields:
        raise HTTPException(status_code=400, detail=f"Invalid field. Choose from {valid_fields}")
    if order not in ["asc", "desc"]:
        raise HTTPException(status_code=400, detail="Invalid order. Choose asc or desc")

    data = load_data()
    sorted_data = sorted(
        ({"id": patient_id, **patient} for patient_id, patient in data.items()),
        key=lambda patient: patient.get(sort_by, 0),
        reverse=(order == "desc"),
    )
    return sorted_data


@app.post("/create", status_code=201)
def create_patient(patient: Patient):
    data = load_data()
    if patient.id in data:
        raise HTTPException(status_code=400, detail="Patient already exists")

    data[patient.id] = patient.model_dump(exclude={"id"})
    save_data(data)
    return JSONResponse(status_code=201, content={"message": "Patient created successfully"})


@app.put("/edit/{patient_id}")
def update_patient(patient_id: str, patient_update: PatientUpdate):
    data = load_data()
    if patient_id not in data:
        raise HTTPException(status_code=404, detail="Patient not found")

    existing_info = data[patient_id]
    existing_info.update(patient_update.model_dump(exclude_unset=True, exclude_none=True))
    validated_patient = Patient(id=patient_id, **existing_info)
    data[patient_id] = validated_patient.model_dump(exclude={"id"})
    save_data(data)
    return {"message": "Patient updated successfully"}


@app.delete("/delete/{patient_id}")
def delete_patient(patient_id: str):
    data = load_data()
    if patient_id not in data:
        raise HTTPException(status_code=404, detail="Patient not found")

    del data[patient_id]
    save_data(data)
    return {"message": "Patient deleted successfully"}
