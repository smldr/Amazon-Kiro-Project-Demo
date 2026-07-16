# Project Scope — OptimGame

## Overview

OptimGame is a web-based interactive optimization game designed for use in an Honours-level lecture setting. Students access the game via a QR code on their phones, compete on a live leaderboard, and ultimately race against an AI solver trained during the same lecture session.

The project doubles as a demonstration of modern AI-assisted development workflows using Amazon Kiro.

## Target Users

- Honours students (final-year undergraduates entering research/industry)
- Mixed cohort: some building applications, some doing ML/research projects
- Accessed primarily on mobile phones during a live lecture
- Lecturer (presenter) uses a desktop/projector view for the leaderboard and demo

## Goals

1. Provide an engaging, interactive introduction to optimization concepts (search spaces, local vs. global minima, function evaluation budgets)
2. Demonstrate Amazon Kiro's full workflow (specs, steering, hooks, autopilot/supervised modes) by building the app live
3. Showcase both application-development and ML/research workflows within a single cohesive project
4. Produce a reusable teaching artifact that can be deployed each year with minimal effort

## Game Modes

| Mode | Purpose | Scoring |
|------|---------|---------|
| **Explore** | Free play, unlimited evaluations, build intuition for the Griewank landscape | None |
| **Challenge** | Limited evaluation budget, competitive play | Score = proximity to global minimum within budget. Submitted to leaderboard |
| **You vs. AI** | Replay the challenge with a ghost overlay showing an ML solver's path | Visual comparison only — humbling pedagogical moment |

## The Griewank Function

The objective function across all modes. It has:
- A global minimum of 0 at the origin
- Many local minima that trap naive strategies
- Tuneable dimensionality (1D → 2D → 5D → 10D) for progressive difficulty

## Non-Goals

- This is NOT a production-grade multiplayer game platform
- We are NOT building a native mobile app (the APK was the inspiration, the web is the medium)
- We are NOT implementing user authentication (nicknames only, no accounts)
- We are NOT optimizing for thousands of concurrent users (target: 20-60 students in a lecture hall)
- Infrastructure/deployment is deferred to a separate session — this project is built deployment-agnostic

## Constraints

- Must work on mobile browsers (iOS Safari, Android Chrome) without app installation
- Must be hostable on a single URL accessible over campus WiFi (no localhost/port forwarding)
- Frontend must be lightweight — fast load on potentially congested lecture-hall WiFi
- No heavy frameworks on the frontend — code should be readable by students inspecting the repo
- Backend must be simple enough to explain in a few minutes during the lecture
- The ML notebook must produce output (ghost data) that integrates cleanly with the game frontend

## Success Criteria

1. Students can scan a QR code and be playing within 10 seconds
2. Leaderboard updates are visible on the projector within 2 seconds of score submission
3. The ghost overlay clearly demonstrates the speed advantage of algorithmic optimization
4. The repository serves as a standalone reference for students learning Kiro workflows
5. The entire project can be "rebuilt" in a 2-hour lecture using branch checkpoints

## Timeline

- **Pre-lecture:** Full build completed, branches set up, hosting configured
- **Lecture 1:** App development demo + live game session
- **Lecture 2 (optional):** ML notebook demo + You vs. AI reveal + deployment session

## Dependencies

- A hosting solution accessible to students (to be determined in deployment session)
- Campus WiFi that allows WebSocket connections (fallback: HTTP polling)
- A projector/screen for the leaderboard view
- Students with smartphones and mobile browsers
