# OptimGame

A web-based optimisation game where players compete to find the global minimum of the Griewank function using sliders — then watch an AI solver do it in seconds.

Built as a teaching tool for Honours students, demonstrating both optimisation concepts and modern AI-assisted development workflows with Amazon Kiro.

## Game Modes

- **Explore** — Free play. Unlimited evaluations. Build intuition for the landscape.
- **Challenge** — Limited evaluation budget. Compete on the live leaderboard.
- **You vs. AI** — Race against a ghost overlay of a CMA-ES solver. Humbling.

## Quick Start

### Prerequisites

- Python 3.11+
- pip (or uv)
- A modern browser (Chrome, Firefox, Safari)
- Git

### Clone and Setup

```bash
git clone https://github.com/smldr/Amazon-Kiro-Project-Demo.git
cd Amazon-Kiro-Project-Demo

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# ML notebook (optional, only needed if regenerating ghost data)
cd ../notebooks
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Run Locally

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000` in your browser. The FastAPI server serves both the API and the frontend static files.

### Available Pages

| URL | Purpose |
|-----|---------|
| `http://localhost:8000` | Landing page — enter nickname, choose mode |
| `http://localhost:8000/game.html` | Game screen (navigated to from landing) |
| `http://localhost:8000/leaderboard.html` | Projector leaderboard view (open on your big screen) |
| `http://localhost:8000/qr.html` | QR code page — print or show on slides |
| `http://localhost:8000/docs` | FastAPI Swagger UI — interactive API testing |
| `http://localhost:8000/api/health` | Health check endpoint |

### Run Tests

```bash
cd backend
source venv/bin/activate
pytest
```

## Project Structure

```
/
├── frontend/                   # Static web app (HTML/CSS/JS, no build step)
│   ├── index.html              # Landing page — nickname + mode select
│   ├── game.html               # Game screen — sliders + visualisation
│   ├── leaderboard.html        # Projector view — live leaderboard
│   ├── qr.html                 # QR code page for slides
│   ├── css/
│   │   └── style.css           # Catppuccin Mocha theme + responsive layout
│   ├── js/
│   │   ├── griewank.js         # Griewank function (N-dimensional)
│   │   ├── game.js             # Game state, levels, budget, modes
│   │   ├── sliders.js          # Slider creation + event handling
│   │   ├── visualisation.js    # Canvas plots (1D line, 2D contour)
│   │   ├── ghost.js            # Ghost replay overlay
│   │   ├── api.js              # REST + WebSocket client
│   │   ├── qr.js              # QR code generation
│   │   └── connection-status.js # Offline detection + reconnection
│   └── assets/
│       └── favicon.svg
├── backend/                    # Python FastAPI server
│   ├── main.py                 # App entry point, CORS, static serving
│   ├── routers/
│   │   ├── scores.py           # Score submission + retrieval
│   │   ├── rounds.py           # Presenter round control
│   │   ├── ghosts.py           # Ghost data endpoint
│   │   └── websocket.py        # Real-time leaderboard broadcast
│   ├── models.py               # Pydantic request/response schemas
│   ├── database.py             # SQLite setup + queries
│   ├── griewank.py             # Python Griewank (cross-validation with JS)
│   ├── ghosts/                 # Pre-computed AI solver paths (JSON)
│   │   ├── level1.json         # 1D solution
│   │   ├── level2.json         # 2D solution
│   │   ├── level3.json         # 5D solution
│   │   └── level4.json         # 10D solution
│   ├── requirements.txt        # Pinned Python dependencies
│   └── tests/                  # pytest test suite
│       ├── test_scores.py
│       ├── test_rounds.py
│       ├── test_ghosts.py
│       └── test_griewank.py
├── notebooks/                  # Jupyter notebook — optimiser demo
│   ├── solve_griewank.ipynb    # Solvers: random, GD, CMA-ES, diff. evolution
│   ├── export_ghost.py         # Convert solver traces → ghost JSON
│   └── requirements.txt        # ML dependencies (numpy, scipy, matplotlib)
├── docs/                       # Project documentation
│   ├── scope.md                # What we're building + boundaries
│   ├── design.md               # Visual design — palette, components, screens
│   ├── architecture.md         # Tech architecture — APIs, data, system diagram
│   ├── tasks.md                # Phased build plan with tools + acceptance criteria
│   └── kiro-workflow.md        # Kiro features reference guide for students
├── .kiro/
│   ├── specs/optimgame/        # Kiro Spec session (requirements, design, tasks)
│   ├── steering/               # Kiro project conventions
│   └── hooks/                  # Kiro automation hooks
├── .gitignore
└── README.md                   # (this file)
```

## Documentation

| Document | Purpose |
|----------|---------|
| [Scope](docs/scope.md) | Project boundaries, goals, non-goals, constraints |
| [Design](docs/design.md) | Visual specs — palette, typography, component details, screen layouts |
| [Architecture](docs/architecture.md) | System diagram, tech stack, API specs, data models |
| [Tasks](docs/tasks.md) | Build phases, Kiro features used, acceptance criteria |
| [Kiro Workflow](docs/kiro-workflow.md) | How Kiro's Spec sessions, steering, and hooks were used |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES2020+), Canvas API, noUiSlider, CSS custom properties |
| Backend | Python 3.11+, FastAPI, Uvicorn, SQLite, Pydantic |
| ML | Jupyter, NumPy, SciPy, Matplotlib |
| Tooling | Amazon Kiro, Git, pytest, Postman |

## Deployment

Deployment is handled in a separate session. The app is designed to run as a single process:

```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

One URL serves everything — API, WebSocket, and static frontend. Deploy anywhere that runs Python (Railway, Render, EC2, Docker, etc.).

### Presenter Controls

The leaderboard page (`/leaderboard.html`) has presenter controls at the bottom (PIN-protected). Default PIN is `1234` — change it before the lecture.

## For Lecturers

This repo uses git branches to checkpoint each build phase. To demo a specific phase:

```bash
git checkout step-1-game-core   # Show explore mode
git checkout step-3-backend     # Show leaderboard integration
git checkout main               # Show finished product
```

Make live edits during the lecture to demo Kiro, then reset:

```bash
git checkout .                  # Discard all changes, branch stays clean
```

## Branches

| Branch | What's there |
|--------|-------------|
| `step-0-init` | Scaffold + docs |
| `step-1-game-core` | Explore mode playable |
| `step-2-challenge` | Budget + scoring |
| `step-3-backend` | API + live leaderboard |
| `step-4-ml-notebook` | Solver notebook + ghost data |
| `step-5-ghost-mode` | You vs. AI overlay |
| `step-6-polish` | Mobile UX + deployment prep |
| `main` | Finished product |

## License

Internal teaching tool. Not currently licensed for redistribution.
