# RouteForge

A minimal web tool for runners, cyclists, and run clubs to generate beautiful, print-ready route posters from any start and end address.

## Local Development

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Vanilla HTML/CSS/JS)
```bash
cd frontend
python -m http.server 3000
```
Open `http://localhost:3000` in your browser.
