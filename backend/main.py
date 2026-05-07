from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import geocode, route, templates, reverse_geocode
import os

app = FastAPI(title="RouteForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(geocode.router)
app.include_router(route.router)
app.include_router(templates.router)
app.include_router(reverse_geocode.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
