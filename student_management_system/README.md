# Student Management System

A responsive HTML, CSS and JavaScript frontend connected to a FastAPI backend. Student records are stored in `student_data.json`.

## Features

- View all student records and summary statistics
- Add students with roll number, name, marks, address and placement status
- Search by roll number, name, marks or address
- Filter students by placement status
- Edit student details (roll number stays fixed while editing)
- Delete a student after confirmation
- Export the visible student list to CSV
- Responsive layout for desktop, tablet and mobile
- Clear API errors for duplicate or missing roll numbers

## Run on Windows / Anaconda Prompt

1. Open a terminal in this folder.
2. (Optional) Activate your existing environment, for example `conda activate myenv`.
3. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start FastAPI:

   ```bash
   python -m uvicorn main:app --reload
   ```

5. Open **http://127.0.0.1:8000/** in your browser.

The frontend is served by FastAPI, so the browser calls the backend on the same origin. You do not need to start a separate frontend server or configure CORS. API documentation is available at **http://127.0.0.1:8000/docs**.

## Project structure

```text
student_management_system/
├── main.py
├── schema.py
├── student_data.json
├── requirements.txt
├── README.md
└── static/
    ├── index.html
    ├── style.css
    └── script.js
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Serve the frontend |
| GET | `/get_student` | Get all student records |
| GET | `/get_student/{roll}` | Get one student record |
| POST | `/add_student` | Add a student |
| POST | `/edit_student?roll={roll}` | Update a student |
| DELETE | `/delete_student/{roll}` | Delete a student |

**Data note:** The included `student_data.json` starts with the student record from the supplied file. Changes made in the app are written to this local JSON file.
