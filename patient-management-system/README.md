# CareBoard — Patient Management System

A responsive frontend for the uploaded FastAPI patient-management project. It uses your JSON file as the demo data store and calls the FastAPI API for reading and changing records.

## Features

- Responsive dashboard for desktop, tablet, and mobile
- Summary cards for total patients and BMI groups
- Search by patient name, ID, or city
- Filter by BMI status and sort the visible records
- View patient details
- Create, edit, and delete patient records
- Form validation, loading states, connection status, and success/error messages
- BMI and BMI verdict are calculated by the backend

## Project structure

```text
patient-management-system/
├── backend/
│   ├── main.py
│   ├── patient.json
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## 1. Start the FastAPI backend

Open a terminal in the `backend` folder.

**Windows PowerShell:**

```powershell
cd path\to\patient-management-system\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

If you already have a virtual environment and FastAPI installed, activate that environment and run only:

```powershell
uvicorn main:app --reload
```

The API should now be running at `http://127.0.0.1:8000`. Open `http://127.0.0.1:8000/docs` to see and test the API endpoints.

Keep `main.py` and `patient.json` together in the `backend` folder. The backend writes create, edit, and delete changes back to this JSON file. Keep a backup if you need to preserve the original data.

## 2. Start the frontend

**Recommended: use VS Code Live Server.**

1. Open the `patient-management-system` folder in VS Code.
2. Install the **Live Server** extension if you do not have it.
3. Right-click `frontend/index.html` and choose **Open with Live Server**.
4. Keep the backend terminal running.

Live Server commonly opens the page at `http://127.0.0.1:5500/frontend/` or `http://localhost:5500/frontend/`. Both origins are allowed by the included development CORS configuration.

**Alternative: serve the frontend with Python.** From the project root, run:

```powershell
python -m http.server 5500
```

Then open `http://127.0.0.1:5500/frontend/` in your browser. This origin is also allowed by the included CORS configuration.

Avoid double-clicking the HTML file when possible; serving it over HTTP makes browser behaviour and CORS easier to debug.

## 3. How the frontend connects to FastAPI

The backend is configured in `frontend/app.js` near the top:

```javascript
const API_BASE_URL = "http://127.0.0.1:8000";
```

The JavaScript uses `fetch()` to send HTTP requests to FastAPI. The included CORS middleware in `backend/main.py` permits the common local frontend origins listed above. If you use a different port or hostname, add that exact origin to `allow_origins` in `main.py`, then restart Uvicorn.

| Frontend action | HTTP request | Purpose |
|---|---|---|
| Load dashboard | `GET /view` | Read all patient records |
| Open a patient | `GET /patient/{patient_id}` is available to call directly | Read one record |
| Add patient | `POST /create` | Send patient details as JSON |
| Save edits | `PUT /edit/{patient_id}` | Send changed patient details as JSON |
| Delete patient | `DELETE /delete/{patient_id}` | Remove a record |
| Sort API data | `GET /sort?sort_by=bmi&order=asc` | Backend sorting endpoint; the current UI sorts loaded records locally |

FastAPI validates incoming JSON using Pydantic, calculates BMI and the status, and saves changes in `backend/patient.json`.

## 4. Troubleshooting

- **“API disconnected” in the page:** confirm Uvicorn is running and that `http://127.0.0.1:8000/docs` opens.
- **CORS error:** add the exact frontend origin (including port) to the `allow_origins` list in `backend/main.py`, then restart Uvicorn.
- **Module not found:** activate the same Python environment used to install the requirements.
- **Changes are not appearing:** click **Refresh** and confirm the backend's `patient.json` is the file being edited.
- **Port 8000 is already in use:** run Uvicorn on another port, for example `uvicorn main:app --reload --port 8001`, then change `API_BASE_URL` in `frontend/app.js` to `http://127.0.0.1:8001`.

## Notes

- This is an educational/demo project. Do not use real patient health data without appropriate access controls, authentication, audit logging, secure hosting, and privacy protections.
- BMI categories are informational and are not a diagnosis.
- This version corrects the backend's overweight verdict, keeps the JSON file path anchored beside `main.py`, enables local CORS, allows `others` during updates, and includes IDs in the sorted response.
