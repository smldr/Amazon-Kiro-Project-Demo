# Implementation Plan: OptimGame

## Overview

Build a web-based optimization game with 3 modes (Explore, Challenge, AI Ghost), a FastAPI backend with real-time leaderboard, and an ML notebook that generates ghost data. The frontend uses vanilla JS with Catppuccin Mocha theming. No build tools, no framework.

## Tasks

- [x] 1. Project scaffold and core game (Explore mode)
  - [x] 1.1 Create frontend folder structure and Catppuccin CSS theme
    - Create `frontend/css/style.css` with full Catppuccin Mocha palette as CSS custom properties
    - Define semantic tokens, component styles (buttons, inputs, cards, sliders), responsive breakpoints
    - Create `frontend/assets/favicon.svg`
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 10.7_

  - [x] 1.2 Implement Griewank function (frontend/js/griewank.js)
    - Export `griewank(x[])` for N-dimensional evaluation
    - Export `griewank1D(x)` and `griewank2D(x1, x2)` convenience wrappers
    - Export `linspace(start, end, steps)` utility for plot axes
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Implement slider manager (frontend/js/sliders.js)
    - Export `createSliders(container, levelConfig, onChange)` returning controller
    - Dynamic creation of N sliders with subscript labels
    - Random non-zero starting positions
    - Real-time onChange callback with current values array
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.4 Implement visualisation (frontend/js/visualisation.js)
    - Export `createVisualisation(canvas)` returning renderer
    - `draw1D(x, range)`: line plot with player dot
    - `draw2D(x1, x2, range)`: contour heatmap with player crosshair
    - DPR-aware canvas, cached heatmap
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 1.5 Implement game state machine (frontend/js/game.js)
    - Level configuration (4 levels: 1D, 2D, 5D, 10D)
    - Mode management (explore/challenge/ai from URL params)
    - Function value colour coding (green/teal/peach/red)
    - Level selector buttons
    - Hide visualisation for 3D+ levels
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.6 Create landing page (frontend/index.html)
    - Nickname input, mode buttons, navigation to game.html
    - Challenge disabled without nickname, AI mode locked
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 1.7 Create game page (frontend/game.html)
    - Wire together sliders, visualisation, game state
    - Header with level label and budget display
    - Footer with back button and mode/nickname label
    - _Requirements: 2.4, 3.4, 4.4_

- [x] 2. Challenge mode (evaluation budget + scoring)
  - [x] 2.1 Add evaluation budget tracking to game.js
    - Decrement budget on slider `change` event (release, not drag)
    - Display remaining budget with colour coding
    - Hide budget display in Explore mode
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 2.2 Add score submission UI
    - "Submit Score" button appears when budget exhausted or player chooses
    - Record player path as array of position snapshots
    - Store score locally (localStorage) as backup
    - _Requirements: 5.4, 5.5, 5.7_

  - [x] 2.3 Add level progression logic
    - Complete a level (submit score) to unlock the next
    - Track unlocked levels in localStorage
    - _Requirements: 5.1_

- [x] 3. Backend API + leaderboard
  - [x] 3.1 Create FastAPI app scaffold
    - main.py with CORS, static file serving from frontend/
    - database.py with SQLite setup and connection
    - models.py with Pydantic schemas
    - _Requirements: 7.1, 11.4_

  - [x] 3.2 Implement score endpoints
    - POST /api/scores — validate, store, return rank
    - GET /api/scores — sorted leaderboard with pagination
    - _Requirements: 7.1, 7.2_

  - [x] 3.3 Implement round management endpoints
    - GET /api/rounds — current round state
    - POST /api/rounds — create/advance (PIN-protected)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.4 Implement WebSocket leaderboard
    - /ws/leaderboard — broadcast score updates to connected clients
    - Fallback: frontend polls GET /api/scores every 3s if WS fails
    - _Requirements: 7.4, 7.5, 7.7, 11.5_

  - [x] 3.5 Create projector leaderboard page (frontend/leaderboard.html)
    - Full-screen table with rank, nickname, level, score, evals
    - Real-time updates via WebSocket
    - Top 3 highlighted, new entries animate in
    - _Requirements: 7.3, 7.5, 7.6, 7.7_

  - [x] 3.6 Connect frontend api.js to backend
    - submitScore(), getScores(), getRound() implementations
    - WebSocket connection with auto-reconnect
    - _Requirements: 7.4, 11.4, 11.5_

  - [x] 3.7 Write backend tests
    - test_scores.py: POST/GET score validation and ranking
    - test_rounds.py: round creation, PIN enforcement
    - test_griewank.py: cross-validate JS and Python implementations
    - _Requirements: 1.5_

- [x] 4. ML notebook + ghost data
  - [x] 4.1 Create solve_griewank.ipynb
    - Implement Griewank function in Python (matching JS exactly)
    - Run optimizers: random search, gradient descent, CMA-ES, differential evolution
    - Visualise solver paths on the Griewank landscape
    - Compare solver performance across dimensions
    - _Requirements: 1.5_

  - [x] 4.2 Create export_ghost.py
    - Convert optimizer traces to ghost JSON format per architecture spec
    - Generate level1.json through level4.json
    - _Requirements: 6.1_

  - [x] 4.3 Implement ghost API endpoint
    - GET /api/ghosts/:level — serve ghost JSON files
    - _Requirements: 6.1_

- [x] 5. You vs. AI (ghost mode)
  - [x] 5.1 Implement ghost replay engine (frontend/js/ghost.js)
    - Load ghost JSON, replay positions on timer
    - Render lavender dot on visualisation (1D/2D)
    - Show ghost eval count and function value
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Add comparison summary
    - End-of-round display comparing player vs. ghost
    - "You: X in N evals. CMA-ES: Y in M evals."
    - _Requirements: 6.5_

  - [x] 5.3 Wire AI mode unlock to round state
    - AI mode button unlocked when presenter activates via round controls
    - _Requirements: 6.6, 9.5_

- [ ] 6. Polish + deployment prep
  - [~] 6.1 Mobile responsiveness pass
    - Test on real devices (iOS Safari, Android Chrome)
    - Verify touch targets, slider usability
    - _Requirements: 10.2, 10.3_

  - [~] 6.2 Add QR code and presenter dashboard
    - QR code page for slides
    - Presenter controls on leaderboard page (start round, unlock AI, reset)
    - _Requirements: 8.1, 8.4_

  - [~] 6.3 Add loading states and error handling
    - Offline detection, reconnection indicators
    - Score submission retry logic
    - _Requirements: 11.5_

  - [~] 6.4 Final testing and Lighthouse audit
    - Lighthouse mobile score > 90
    - All backend tests pass
    - Cross-browser verification
    - _Requirements: 11.1, 11.2, 11.3_

## Notes

- Task group 1 is complete (step-1-game-core branch)
- Each task group maps to a git branch (step-2 through step-6)
- Requirements traceability via `_Requirements: X.Y_` annotations
- Frontend uses ES modules with `type="module"` — no build step needed
- All colours come from CSS custom properties — no hardcoded values in JS

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["3.5", "3.6", "3.7"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] }
  ]
}
```
