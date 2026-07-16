# Kiro Workflow Guide

This document explains the Amazon Kiro features used to build OptimGame and how you can apply them to your own projects.

## What is Kiro?

Kiro is an AI-powered IDE built on VS Code. Unlike basic code completion tools, Kiro provides structured project management features — specs, steering, hooks, and multiple interaction modes. Think of it as a development partner that understands your project's conventions and can execute multi-step plans, not just autocomplete the next line.

## Session Types

Kiro has two session types for different kinds of work:

### Vibe Sessions

Conversational, exploratory. Use these when you're:
- Asking questions ("How should I structure this WebSocket connection?")
- Brainstorming approaches
- Debugging an issue interactively
- Writing one-off scripts or quick fixes

Think of it as chatting with a knowledgeable colleague.

### Spec Sessions

Structured, plan-driven. Use these when you're:
- Building a feature from scratch
- Implementing something with clear requirements
- Working through a multi-step task

A Spec session follows a pipeline:

```
Requirements → Design → Tasks → Execution
```

1. **Requirements** — You describe what you want. Kiro formalises it into structured requirements.
2. **Design** — Kiro proposes a technical approach based on the requirements.
3. **Tasks** — The design breaks down into executable tasks.
4. **Execution** — Each task has:
   - **"Run Task"** button → Kiro writes the code
   - **"Review Changes"** button → you see the diff, accept/reject individual hunks

This is the structured alternative to freeform coding. The plan stays documented, the agent stays aligned, and you maintain control at every step.

**In this project:** Each build phase (see `tasks.md`) was executed as a Spec session. The executable specs live at `.kiro/specs/` in the workspace.

## Autonomy Modes

### Autopilot

Kiro works autonomously to complete tasks end-to-end. You can view all changes, revert, or interrupt at any time. Best for:
- Boilerplate generation (folder structures, config files)
- Repetitive patterns (CRUD routes, test scaffolding)
- Tasks where you trust the output and want speed

### Supervised

Kiro yields after each turn that involves file edits. Changes are presented as individual hunks for fine-grained accept/reject. Best for:
- Core logic (game mechanics, algorithms)
- Security-sensitive code (auth, data handling)
- Anything you want to understand line-by-line

**In this project:** Autopilot for Phase 0 (scaffold), Supervised for Phase 1 (game logic) and Phase 5 (ghost overlay).

## Steering Files

Steering files live at `.kiro/steering/*.md` and provide persistent instructions that apply across all sessions. They encode your project's conventions so the agent follows them without being reminded every time.

### Types

| Type | Behaviour |
|------|-----------|
| **Always included** (default) | Loaded into every session automatically |
| **File-match** (`inclusion: fileMatch`) | Loaded when a matching file is read into context |
| **Manual** (`inclusion: manual`) | Loaded only when you explicitly reference it with `#` in chat |

### Examples from this project

**`.kiro/steering/coding-standards.md`** (always included):
```markdown
- Use vanilla JavaScript (ES2020+). No frameworks, no build tools.
- Use CSS custom properties for theming. All colours from Catppuccin Mocha.
- Backend: Python 3.11+, FastAPI, Pydantic v2 for validation.
- Prefer explicit over clever. Students will read this code.
```

**`.kiro/steering/api-conventions.md`** (always included):
```markdown
- All API responses use JSON.
- Success responses include the resource directly.
- Error responses: {"detail": "human-readable message"}
- Use Pydantic models for all request/response schemas.
- PIN-protected endpoints check X-Presenter-Pin header.
```

### File references in steering

Steering files can reference other project files to pull in context:

```markdown
Follow the visual design specified in #[[file:docs/design.md]]
Follow the API schemas specified in #[[file:docs/architecture.md]]
```

This means your design doc and architecture doc directly influence code generation without copy-pasting their content into prompts.

## Agent Hooks

Hooks automate actions triggered by events in the IDE. They live at `.kiro/hooks/` as JSON files.

### How they work

```json
{
  "version": "v1",
  "hooks": [{
    "name": "Run Tests After Task",
    "trigger": "PostTaskExec",
    "action": { "type": "command", "command": "cd backend && pytest" }
  }]
}
```

### Available triggers

| Trigger | When it fires |
|---------|--------------|
| `SessionStart` | New Kiro session begins |
| `UserPromptSubmit` | You send a message |
| `PreToolUse` | Before the agent executes a tool (can block) |
| `PostToolUse` | After a tool executes |
| `PreTaskExec` | Before a spec task starts |
| `PostTaskExec` | After a spec task completes |
| `PostFileSave` | When you save a file |
| `PostFileCreate` | When a new file is created |
| `PostFileDelete` | When a file is deleted |
| `Stop` | Agent execution completes |

### Action types

- **`command`** — Runs a shell command. Receives session context on stdin. Exit code 0 = success, exit code 2 = block the action.
- **`agent`** — Injects a prompt into the model context (e.g., "always check for accessibility before writing HTML").

### Examples from this project

**Lint on save:**
```json
{
  "name": "Lint JS on Save",
  "trigger": "PostFileSave",
  "matcher": "\\.(js)$",
  "action": { "type": "command", "command": "npx eslint --fix ${file}" }
}
```

**Run tests after completing a task:**
```json
{
  "name": "Pytest After Task",
  "trigger": "PostTaskExec",
  "action": { "type": "command", "command": "cd backend && pytest -q" }
}
```

**Enforce coding standards on write:**
```json
{
  "name": "Check Standards",
  "trigger": "PreToolUse",
  "matcher": "fs_write|str_replace",
  "action": { "type": "agent", "prompt": "Verify this follows our coding-standards steering file. No frameworks, Catppuccin palette only." }
}
```

## MCP (Model Context Protocol)

MCP connects Kiro to external tools via standardised servers. Configuration lives at `.kiro/settings/mcp.json`.

### What it does

MCP servers give Kiro access to external services — API testing tools, databases, documentation sources, etc. — without leaving the IDE.

### Example: Postman integration

```json
{
  "mcpServers": {
    "postman": {
      "command": "uvx",
      "args": ["postman-mcp-server@latest"],
      "disabled": false
    }
  }
}
```

With this configured, Kiro can test API endpoints through Postman directly during development — creating collections, running requests, validating responses.

**In this project:** Used in Phase 3 to test the leaderboard API endpoints interactively.

## Multi-File Context

Kiro can read and reason across multiple files simultaneously. Use `#File` or `#Folder` in chat to pull specific files into context, or reference them in steering files with `#[[file:path]]`.

**In this project:** Phase 4 (ML notebook) uses this to ensure the Python Griewank implementation matches the JavaScript one — Kiro reads both files and generates consistent code.

## Practical Workflow Summary

For your Honours projects, here's a recommended flow:

```
1. Start with documentation (scope, design, architecture)
2. Set up steering files with your project conventions
3. Create hooks for automated quality checks
4. Use Spec sessions for major features (structured, trackable)
5. Use Vibe sessions for exploration and debugging
6. Use Supervised mode for critical logic, Autopilot for boilerplate
7. Commit after each completed spec task — clean git history
```

## Where things live

| What | Location | Purpose |
|------|----------|---------|
| Executable specs | `.kiro/specs/` | Tasks with "Run" and "Review" buttons |
| Steering files | `.kiro/steering/` | Persistent project conventions |
| Hooks | `.kiro/hooks/` | Automated event-driven actions |
| MCP config | `.kiro/settings/mcp.json` | External tool connections |

## Further Reading

- Kiro documentation (available in the IDE via Help menu)
- This project's `docs/tasks.md` for the phase-by-phase build plan
- This project's `.kiro/` directory for live examples of steering, hooks, and specs
