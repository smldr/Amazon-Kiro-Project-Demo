# Requirements Document

## Introduction

This document specifies the requirements for OptimGame — a web-based interactive optimization game where players use sliders to find the global minimum of the Griewank function. The game is designed for use in an Honours-level lecture, accessed via QR code on mobile phones, with a live competitive leaderboard and an AI ghost replay mode.

## Glossary

- **Griewank_Function**: The N-dimensional benchmark optimization function f(x) = 1 + (1/4000)·Σxᵢ² - Πcos(xᵢ/√i) with global minimum 0 at the origin
- **Explore_Mode**: Free play with unlimited evaluations and no scoring
- **Challenge_Mode**: Competitive mode with a limited evaluation budget and leaderboard submission
- **AI_Mode**: Ghost replay mode showing a pre-computed optimizer solution alongside the player
- **Evaluation_Budget**: The finite number of slider moves (releases) permitted in Challenge and AI modes
- **Ghost_Data**: Pre-computed JSON recording of an optimization algorithm's path to the minimum
- **Leaderboard**: A real-time ranked list of player scores for the current round
- **Round**: A lecturer-controlled session during which scores are collected
- **Level**: A difficulty tier defined by the number of dimensions (sliders)
- **Score**: The final Griewank function value at submission — lower is better

## Requirements

### Requirement 1: Griewank Function Evaluation

**User Story:** As a player, I want the game to compute the Griewank function in real time as I adjust sliders, so that I get immediate feedback on my position in the search space.

#### Acceptance Criteria

1. WHEN an array of N float values within [-5, 5] is provided, THE Griewank_Function SHALL return a single float value computed as f(x) = 1 + (1/4000)·Σᵢxᵢ² - Πᵢcos(xᵢ/√i)
2. WHEN all input values are 0, THE Griewank_Function SHALL return exactly 0 for any dimensionality N ≥ 1
3. THE Griewank_Function SHALL always return a value ≥ 0 for any input within [-5, 5]
4. THE Griewank_Function SHALL complete evaluation in under 1ms for up to 10 dimensions
5. THE Griewank_Function SHALL produce identical results in both the JavaScript frontend and the Python ML notebook

### Requirement 2: Slider Interface

**User Story:** As a player, I want responsive sliders that let me adjust each variable independently, so that I can explore the function landscape intuitively.

#### Acceptance Criteria

1. THE game SHALL create N sliders dynamically based on the current level's dimension count
2. EACH slider SHALL have a range of [-5, 5] with step size 0.01
3. EACH slider SHALL display a subscript label (x₁, x₂, ...) and its current numeric value
4. WHEN any slider is moved, THE displayed function value SHALL update within 16ms (one frame at 60fps)
5. EACH slider thumb SHALL have a minimum touch target of 44×44 pixels on mobile devices
6. SLIDERS SHALL start at random non-zero positions (avoiding the solution at origin)

### Requirement 3: Visualisation

**User Story:** As a player, I want to see a visual representation of the function landscape for low-dimensional levels, so that I can develop intuition for the search space.

#### Acceptance Criteria

1. WHEN playing Level 1 (1D), THE game SHALL display a line plot of the Griewank function with the player's current position shown as a coloured dot
2. WHEN playing Level 2 (2D), THE game SHALL display a contour heatmap of the Griewank function with the player's position shown as a coloured dot with crosshairs
3. WHEN playing Levels 3-4 (5D, 10D), THE game SHALL NOT display a visualisation (sliders and function value only)
4. THE visualisation SHALL update in real time as sliders are moved
5. THE visualisation SHALL use the Catppuccin Mocha colour palette (base→teal→peach→red gradient for the heatmap)
6. THE player's position marker SHALL be yellow (#f9e2af) and clearly distinguishable from the landscape

### Requirement 4: Explore Mode

**User Story:** As a player, I want a free-play mode with no restrictions, so that I can learn how the function behaves before competing.

#### Acceptance Criteria

1. IN Explore_Mode, THE game SHALL allow unlimited slider movements with no budget counter displayed
2. IN Explore_Mode, THE game SHALL NOT submit scores to the leaderboard
3. IN Explore_Mode, ALL levels SHALL be accessible via level selector buttons
4. IN Explore_Mode, THE function value display SHALL still colour-code proximity to 0 (green < 0.01, teal < 0.1, peach < 1.0, red ≥ 1.0)

### Requirement 5: Challenge Mode

**User Story:** As a player, I want a competitive mode with a limited number of moves, so that I have to be strategic about finding the minimum.

#### Acceptance Criteria

1. IN Challenge_Mode, EACH level SHALL have a fixed evaluation budget (Level 1: 40, Level 2: 35, Level 3: 30, Level 4: 25)
2. THE budget SHALL decrement by 1 each time a slider is released (not during drag)
3. THE remaining budget SHALL be displayed and colour-coded (teal ≥ 10, peach < 10, red < 5)
4. WHEN the budget reaches 0 OR the player clicks "Submit Score", THE game SHALL record the current function value as the player's score
5. THE player's path (array of position snapshots at each evaluation) SHALL be recorded for potential ghost replay
6. THE score SHALL be submitted to the backend leaderboard with the player's nickname, level, score, evaluations used, and round ID
7. A player SHALL NOT be able to submit a score without a nickname

### Requirement 6: AI Ghost Mode (You vs. AI)

**User Story:** As a player, I want to race against a pre-computed AI solver, so that I can see how optimization algorithms outperform manual search.

#### Acceptance Criteria

1. IN AI_Mode, THE game SHALL load a ghost data JSON file for the current level
2. THE ghost SHALL replay its path at a rate of 1 evaluation per second (configurable)
3. THE ghost's position SHALL be displayed as a lavender (#b4befe) dot on the visualisation (Levels 1-2) or as a text display (Levels 3-4)
4. THE ghost's current function value and evaluation count SHALL be displayed alongside the player's
5. WHEN both the ghost and player have exhausted their budgets, THE game SHALL display a comparison summary ("You: X in N evals. CMA-ES: Y in M evals.")
6. AI_Mode SHALL only be accessible when the presenter unlocks it via round controls

### Requirement 7: Leaderboard

**User Story:** As a lecturer, I want a real-time leaderboard on the projector, so that students can see their ranking update live during the challenge round.

#### Acceptance Criteria

1. THE backend SHALL accept score submissions via POST /api/scores and return the player's rank
2. THE backend SHALL serve the current leaderboard via GET /api/scores sorted by score ascending (lower is better)
3. THE projector view (leaderboard.html) SHALL display scores in a full-screen table with rank, nickname, level, score, and evaluations used
4. THE projector view SHALL update in real time via WebSocket (or fallback to 3-second polling)
5. NEW entries SHALL animate into the leaderboard (slide-in effect)
6. THE top 3 entries SHALL be visually highlighted (gold, silver, bronze colours)
7. THE projector view SHALL show the total connected player count

### Requirement 8: Round Management

**User Story:** As a lecturer, I want to control when rounds start and end, so that I can coordinate the game with the lecture flow.

#### Acceptance Criteria

1. THE backend SHALL support creating and advancing rounds via POST /api/rounds (PIN-protected)
2. A round SHALL define which mode is active, which levels are open, and whether AI mode is unlocked
3. THE frontend SHALL check the current round state on load and respect mode/level restrictions
4. THE presenter SHALL be able to reset the leaderboard for a new round

### Requirement 9: Landing Page

**User Story:** As a student, I want a simple entry point where I enter my nickname and choose a game mode, so that I can start playing within seconds of scanning the QR code.

#### Acceptance Criteria

1. THE landing page SHALL load in under 2 seconds on a throttled mobile connection
2. THE landing page SHALL provide a nickname text input (max 20 characters)
3. THE landing page SHALL provide buttons for Explore, Challenge, and You vs. AI modes
4. THE Challenge button SHALL be disabled until a nickname is entered
5. THE AI mode button SHALL be disabled until the presenter unlocks it
6. CLICKING a mode button SHALL navigate to the game page with mode, level, and nickname as URL parameters

### Requirement 10: Theming and Accessibility

**User Story:** As a student, I want the app to look polished and work well on my phone, so that the experience is smooth during the lecture.

#### Acceptance Criteria

1. THE app SHALL use the Catppuccin Mocha colour palette exclusively (no hardcoded colours outside CSS variables)
2. THE app SHALL be fully functional on mobile browsers (iOS Safari 16+, Android Chrome 100+)
3. ALL interactive elements SHALL have a minimum touch target of 44×44px
4. COLOUR SHALL NOT be the sole indicator of information — numeric values and progress bars supplement colour coding
5. ALL sliders SHALL have accessible labels (aria-label)
6. THE app SHALL respect `prefers-reduced-motion` for animations
7. FOCUS states SHALL be visible (teal outline, 2px offset)

### Requirement 11: Performance

**User Story:** As a student on lecture-hall WiFi, I want the app to load fast and feel responsive, so that I don't lose interest waiting.

#### Acceptance Criteria

1. THE total JavaScript payload SHALL be under 50KB (no bundler, no framework)
2. THE page SHALL load in under 2 seconds on a 3G connection
3. SLIDER to function value update SHALL complete in under 16ms (no network call required)
4. SCORE submission to leaderboard visibility SHALL complete in under 2 seconds
5. THE WebSocket SHALL automatically reconnect within 5 seconds after disconnection
