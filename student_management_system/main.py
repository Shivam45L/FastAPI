from pathlib import Path
import json
from json import JSONDecodeError

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from schema import Student

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_FILE = BASE_DIR / "student_data.json"

app = FastAPI(title="Student Management System", version="1.0.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def read_database() -> dict:
    if not DATA_FILE.exists():
        return {}
    try:
        with DATA_FILE.open("r", encoding="utf-8-sig") as file:
            data = json.load(file)
    except JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="student_data.json contains invalid JSON.") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="student_data.json must contain a JSON object.")
    return data


def write_database(data: dict) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)


def student_record(student: Student) -> dict:
    return {
        "name": student.name,
        "marks": student.marks,
        "address": student.address,
        "placed": student.placed,
    }


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/get_student")
def get_all_students():
    return read_database()


@app.get("/get_student/{roll}")
def get_student_record(roll: int):
    db = read_database()
    key = str(roll)
    if key not in db:
        raise HTTPException(status_code=404, detail=f"No student found with roll number {roll}.")
    return db[key]


@app.post("/add_student", status_code=201)
def add_student(obj: Student):
    db = read_database()
    key = str(obj.roll)
    if key in db:
        raise HTTPException(status_code=409, detail=f"Roll number {obj.roll} already exists.")
    db[key] = student_record(obj)
    write_database(db)
    return {"message": "Student added successfully.", "student": {"roll": obj.roll, **db[key]}}


@app.delete("/delete_student/{roll}")
def delete_student(roll: int):
    db = read_database()
    key = str(roll)
    if key not in db:
        raise HTTPException(status_code=404, detail=f"No student found with roll number {roll}.")
    record = db.pop(key)
    write_database(db)
    return {"message": "Student deleted successfully.", "Deleted Record": {"roll": roll, **record}}


@app.post("/edit_student")
def edit_student(roll: int, obj: Student):
    db = read_database()
    key = str(roll)
    if key not in db:
        raise HTTPException(status_code=404, detail=f"No student found with roll number {roll}.")
    if obj.roll != roll:
        raise HTTPException(status_code=400, detail="The roll number cannot be changed while editing a student.")
    db[key] = student_record(obj)
    write_database(db)
    return {"message": "Student updated successfully.", "student": {"roll": roll, **db[key]}}
