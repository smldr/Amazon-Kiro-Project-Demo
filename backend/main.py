"""FastAPI application — serves both the API and static frontend files."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers.scores import router as scores_router
from routers.rounds import router as rounds_router
from routers.websocket import router as websocket_router
from routers.ghosts import router as ghosts_router

app = FastAPI(title="OptimGame API", version="0.1.0")

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Initialize the database on server start."""
    init_db()


# Health check
@app.get("/api/health")
def health():
    return {"status": "ok"}


# Register routers (before static files mount)
app.include_router(scores_router)
app.include_router(rounds_router)
app.include_router(websocket_router)
app.include_router(ghosts_router)


# Mount static files from the frontend directory (must be last)
frontend_path = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
