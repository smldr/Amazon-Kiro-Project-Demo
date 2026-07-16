# Design Document — OptimGame

## Design Philosophy

Clean, dark, minimal. The interface should feel like a well-made tool — not a toy. The Catppuccin Mocha palette provides warmth without distraction. Every element serves a purpose. Mobile-first, thumb-friendly, zero learning curve.

## Colour Palette — Catppuccin Mocha

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Background | Base | `#1e1e2e` | Page background, card backgrounds |
| Surface | Surface 0 | `#313244` | Input fields, slider tracks, secondary containers |
| Surface raised | Surface 1 | `#45475a` | Hover states, elevated cards |
| Surface highlight | Surface 2 | `#585b70` | Active states, selected items |
| Primary text | Text | `#cdd6f4` | Body text, labels |
| Secondary text | Subtext 1 | `#bac2de` | Descriptions, hints |
| Muted text | Overlay 0 | `#6c7086` | Placeholders, disabled states |
| Primary accent | Teal | `#94e2d5` | Primary buttons, active sliders, current value display |
| Secondary accent | Mauve | `#cba6f7` | Leaderboard highlights, links |
| Success | Green | `#a6e3a1` | Win condition met, good scores |
| Warning | Peach | `#fab387` | Budget running low, near-miss |
| Danger | Red | `#f38ba8` | Budget exhausted, far from target |
| AI/Ghost | Lavender | `#b4befe` | Ghost overlay path, AI-related elements |
| Player | Yellow | `#f9e2af` | Player position marker, your score |
| Info | Sky | `#89dceb` | Tooltips, function info |

## Typography

| Element | Font | Size (mobile) | Size (desktop) | Weight |
|---------|------|---------------|----------------|--------|
| Page title | System sans-serif | 1.5rem | 2rem | 700 |
| Section heading | System sans-serif | 1.1rem | 1.25rem | 600 |
| Body text | System sans-serif | 0.9rem | 1rem | 400 |
| Slider labels | System monospace | 0.8rem | 0.875rem | 400 |
| Function value | System monospace | 1.8rem | 2.5rem | 700 |
| Leaderboard entries | System monospace | 0.85rem | 1rem | 400 |

System fonts for instant load — no web font requests on lecture WiFi.

## Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| < 480px | Phone portrait | Single column, stacked sliders |
| 480–768px | Phone landscape / small tablet | Single column with wider sliders |
| 768–1200px | Tablet / laptop | Two-column: sliders left, visualisation right |
| > 1200px | Projector/desktop (leaderboard view) | Full dashboard layout |

Mobile is the primary target. The projector view is a separate page optimised for large screens.

## Screens

### 1. Landing / Join (`index.html`)

```
┌─────────────────────────────┐
│                             │
│       OptimGame             │
│   Find the minimum.        │
│                             │
│   ┌─────────────────────┐   │
│   │  Enter Username...  │   │
│   └─────────────────────┘   │
│                             │
│   [ Explore ]  [ Challenge ]│
│                             │
│   ─── or ───                │
│   [ You vs. AI ]            │
│   (unlocked after challenge)│
│                             │
└─────────────────────────────┘
```

- Username input: Surface 0 background, Text colour, Teal border on focus
- Mode buttons: Surface 1 background, Teal text for Explore, Mauve text for Challenge
- You vs. AI button: locked/greyed until challenge round is complete (controlled by lecturer)
- No login, no password — just a Username and go

### 2. Game Screen (`game.html`)

```
┌─────────────────────────────┐
│ Level 2/4        Budget: 23 │
│─────────────────────────────│
│                             │
│     f(x) = 0.4721          │
│     ████████░░ (target: 0)  │
│                             │
│─────────────────────────────│
│ x₁  ──────●────────── 1.34 │
│ x₂  ────────●──────── 2.01 │
│                             │
│─────────────────────────────│
│  [Visualisation area]       │
│  (1D: line plot)            │
│  (2D: contour heatmap)      │
│  (3D+: hidden, sliders only)│
│                             │
│─────────────────────────────│
│ [ Submit Score ]            │
│ (appears when budget = 0    │
│  or player is satisfied)    │
└─────────────────────────────┘
```

**Function value display:**
- Large monospace number, colour-coded:
  - Green when < 0.01 (excellent)
  - Teal when < 0.1 (good)
  - Peach when < 1.0 (getting there)
  - Red when > 1.0 (far)
- A thin progress bar beneath showing proximity to 0

**Sliders:**
- Full-width horizontal sliders
- Track: Surface 0
- Fill (left of thumb): Teal
- Thumb: circular, Yellow, 20px diameter on mobile (easy thumb target)
- Value label: monospace, right-aligned, Subtext 1
- Slider label (x₁, x₂, ...): monospace, left-aligned, Text

**Budget display (Challenge mode only):**
- Top-right corner
- Peach when < 10 remaining, Red when < 5
- Each slider move (release) decrements by 1
- In Explore mode: hidden entirely

**Visualisation area:**
- Level 1 (1D): Line plot of Griewank(x) with a Yellow dot showing current position
- Level 2 (2D): Contour/heatmap with a Yellow dot at (x₁, x₂)
- Level 3+ (5D, 10D): No visualisation — just sliders and the function value. This IS the point: you can't see the landscape anymore, you need strategy.

**Ghost overlay (You vs. AI mode):**
- Same game screen but with an additional Lavender dot/path showing the AI's moves
- A small timer showing the AI's progress: "AI: eval 4/30 → f(x) = 0.003"
- The ghost moves on a timer (e.g., one eval per second) so students can watch it converge

### 3. Leaderboard — Projector View (`leaderboard.html`)

```
┌───────────────────────────────────────────┐
│          OptimGame — Leaderboard          │
│───────────────────────────────────────────│
│ #  │ Player     │ Level │ Score  │ Evals │
│────│────────────│───────│────────│───────│
│ 1  │ alice_42   │  3    │ 0.0021 │ 28    │
│ 2  │ bob_dev    │  3    │ 0.0089 │ 30    │
│ 3  │ charlie    │  2    │ 0.0134 │ 25    │
│ ...│            │       │        │       │
│───────────────────────────────────────────│
│ Players connected: 34    Round: 2/4       │
│ [ Start Next Round ]  [ Reset ]           │
└───────────────────────────────────────────┘
```

- Full-screen optimised for 1080p projector
- Auto-scrolling if more than ~15 entries
- New entries animate in (slide down from top)
- Top 3 get colour highlights: Gold (Yellow), Silver (Lavender), Bronze (Peach)
- Presenter controls at the bottom (only visible on presenter's screen, behind a simple pin)
- Live player count, current round indicator

### 4. Leaderboard — Mobile View

Compact version of the same data, accessible from the game screen via a tab or button:
- Your rank highlighted
- Top 10 shown
- Tap to expand full list

## Component Specifications

### Slider Component

```
Width:         100% of container (minus label space)
Height:        40px touch target (visible track: 6px)
Track:         Surface 0, 6px tall, rounded-full
Fill:          Teal, 6px tall, rounded-full
Thumb:         Yellow, 20px circle, 2px Surface 2 border
Thumb (active): Yellow, 24px circle (scale up on touch)
Label left:    Monospace, 0.8rem, Text colour
Value right:   Monospace, 0.8rem, Subtext 1
Snap:          None (continuous float values)
Range:         -5.0 to 5.0 (adjustable per level)
Step:          0.01
```

### Button Component

```
Padding:       12px 24px
Border-radius: 8px
Background:    Surface 1
Text:          Teal (primary) or Mauve (secondary)
Font:          System sans-serif, 0.9rem, 600 weight
Hover:         Surface 2 background
Active:        Scale 0.97
Disabled:      Overlay 0 text, Surface 0 background
```

### Card Component (leaderboard entries, info panels)

```
Background:    Surface 0
Border:        1px Surface 1
Border-radius: 12px
Padding:       16px
Shadow:        None (flat design, dark theme doesn't need shadows)
```

## Animation & Transitions

- Slider value changes: function value updates instantly (no debounce — responsiveness matters)
- Leaderboard updates: new entries slide in over 300ms, ease-out
- Ghost path: Lavender dot moves every 1 second, leaves a fading trail (opacity 0.3 → 0 over 3s)
- Mode transitions: simple fade, 200ms
- Budget decrement: number briefly scales up + colour flash on each eval spent

## Accessibility

- All interactive elements have minimum 44x44px touch targets
- Colour is never the sole indicator — function value shows numeric + bar + colour
- Slider values are programmatically associated with labels (aria-label)
- Leaderboard is a semantic `<table>` with proper headers
- Focus states visible (Teal outline, 2px offset)
- Respects `prefers-reduced-motion` — disables ghost trail animation, transitions go to instant

## Assets

Minimal — no images except:
- Favicon: simple geometric icon (can be an SVG, a stylised "G" for Griewank or a target/crosshair)
- QR code: generated dynamically or as a static PNG for the slides
- No hero images, no illustrations — the visualisation IS the visual interest
