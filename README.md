# 🏟️ Code Coliseum

### Make your AI earn the merge.

Code Coliseum turns AI coding into a competition.

Instead of asking one AI agent to implement a feature and trusting the result,
Code Coliseum sends the same feature request to **three isolated IBM Bob agents**
with different engineering strategies:

- 💎 **Minimalist** — smallest correct diff
- 🔶 **Sprinter** — optimized for runtime performance
- 🟣 **Architect** — maintainability and clean structure

Each contender works independently in its own Git worktree.

Their implementations are then tested through a deterministic **Gauntlet**.
Only implementations that pass every mandatory check survive.

The developer can inspect the actual Git diff, compare evidence, choose a
candidate, and apply that exact implementation to the main working tree.

> AI proposes. Evidence proves. The developer decides what earns the merge.

---

## Why Code Coliseum?

AI coding agents are increasingly capable of producing working code.

But a major problem remains:

**How do you know which implementation to trust?**

A single agent can produce code that looks correct while introducing:

- build failures
- dependency changes
- type errors
- unnecessary complexity
- larger-than-needed diffs
- incorrect runtime behavior

Code Coliseum changes the workflow from:

```text
Prompt → AI → Accept

into:

Feature Request
      ↓
3 Competing IBM Bob Agents
      ↓
Isolated Git Worktrees
      ↓
Deterministic Gauntlet
      ↓
Evidence + Real Git Diffs
      ↓
Developer Chooses
      ↓
Apply Candidate

The Contenders
💎 Minimalist
Goal:
Produce the smallest correct implementation.

Optimizes for:
- minimal files changed
- minimal lines changed
- low implementation surface area
🔶 Sprinter
Goal:
Produce an implementation focused on runtime performance.

Optimizes for:
- direct execution paths
- reduced unnecessary runtime work
- implementation efficiency
🟣 Architect
Goal:
Produce a maintainable and well-structured implementation.

Optimizes for:
- readability
- separation of concerns
- maintainability
- clear implementation structure
The Gauntlet
After IBM Bob finishes implementing the feature, every contender must survive
the same deterministic validation pipeline.
Current mandatory checks:
Check	Description
Dependency Integrity	Ensures the agent did not unexpectedly modify project dependencies
Type Safety	Runs Next.js type generation and TypeScript validation
Production Build	Requires a successful production build
Acceptance Test	Runs the built application and verifies expected runtime behavior


A contender that fails any mandatory check is ELIMINATED.
A contender that passes every check SURVIVES.
Metrics such as changed files and changed lines are treated as evidence, not as
automatic elimination rules.
Real Git Isolation
Every battle starts from the same Git commit.
Code Coliseum creates three isolated Git worktrees:

main repository
      │
      ├── Minimalist worktree
      ├── Sprinter worktree
      └── Architect worktree

Each IBM Bob agent works only inside its own workspace.
This prevents contenders from seeing or modifying each other's implementation.
Parallel IBM Bob Execution
Once the isolated workspaces are prepared, all surviving contenders are
launched concurrently.

             ┌─ Minimalist ─┐
Feature ─────┼─ Sprinter ───┼──→ Gauntlet
Request      └─ Architect ──┘

Code Coliseum uses IBM Bob Shell as the real coding agent runtime.
The feature request is passed to Bob through stdin rather than interpolated into
a shell command.
Inspect the Actual Code
Metrics alone are not enough.
For every surviving contender, the developer can click:
Inspect Diff
Code Coliseum reads the actual Git changes from that contender's isolated
worktree, including:
- tracked modifications
- deleted files
- newly created untracked files
The real unified Git patch is displayed directly in the Arena.
This allows the developer to compare implementation approaches before making a
decision.
Developer-Controlled Selection
Code Coliseum never automatically declares a winner.
After reviewing the evidence and source code, the developer explicitly chooses
one surviving contender.

Minimalist
[ Inspect Diff ] [ ✓ Selected ]

Sprinter
[ Inspect Diff ] [ Choose Candidate ]

Architect
[ Inspect Diff ] [ Choose Candidate ]

Only one contender can be selected at a time.
The developer can change the selection before applying it.
Apply Candidate
After selection, Code Coliseum can apply the chosen contender's exact
implementation to the main working tree.
Before applying, it verifies:
- the main working tree is clean
- the main HEAD is still the same commit the battle started from
- the selected contender survived the Gauntlet
Code Coliseum then transfers the selected implementation to the main working
tree.
It does not automatically:
- stage files
- create a commit
- push code
The final Git commit remains developer-controlled.
Example Battle
Feature request:

Add a GET /api/health endpoint that returns JSON with status set to ok.
Do not add dependencies.

Example result:

              Minimalist    Sprinter    Architect

Gauntlet       SURVIVED      SURVIVED    SURVIVED
Files Changed  1             1           1
Lines Changed  6             7           6

All three implementations are valid.
Code Coliseum then lets the developer inspect the actual code and choose which
implementation should be applied.
Architecture

                         CODE COLISEUM

Feature Request
      │
      ▼
┌─────────────────────┐
│ Battle Orchestrator │
└──────────┬──────────┘
           │
           ▼
     Git Worktrees
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
 Minimal  Sprint  Architect
    │      │      │
    └──────┼──────┘
           │
      IBM Bob Shell
           │
           ▼
      ┌──────────┐
      │ Gauntlet │
      └────┬─────┘
           │
           ▼
   Evidence + Metrics
           │
           ▼
      Inspect Diff
           │
           ▼
    Choose Candidate
           │
           ▼
     Apply Candidate
           │
           ▼
  Developer Working Tree

  Tech Stack
- IBM Bob
- Next.js 16
- React
- TypeScript
- Git worktrees
- Node.js
- PowerShell / Windows
- Native Node child-process, filesystem, HTTP, and Git tooling
No database is required for the current MVP.
Battle state is stored in memory.
Running Locally
Requirements
- Node.js
- npm
- Git
- IBM Bob Shell
- valid BOB_API_KEY
Install dependencies:
npm install
Set the Bob API key in your environment.
On PowerShell:
$env:BOB_API_KEY = "YOUR_API_KEY"
Start Code Coliseum:
npm run dev -- --port 3000
Open:
http://localhost:3000
Validation
The project currently passes:
npx tsc --noEmit
npm run lint
npm run build
Current Status
Code Coliseum MVP currently supports:
- isolated contender worktrees
- three IBM Bob coding agents
- parallel agent execution
- deterministic Gauntlet validation
- real Git metrics
- real unified diff inspection
- developer candidate selection
- safe application of the selected implementation
- protection against dirty or stale main branches
Built for IBM Bob Hackathon 2.0
Code Coliseum explores a different way to work with coding agents:
not by asking AI for one answer,
but by letting multiple AI implementations compete under the same constraints
and requiring evidence before code reaches the developer's working tree.
Three agents enter.
Evidence decides what survives.
The developer decides what earns the merge.
