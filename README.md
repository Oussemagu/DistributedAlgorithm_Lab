# 🖧 Distributed Algorithms Simulator — TP Systèmes Distribués

An interactive, step-by-step visualizer for classic distributed systems algorithms — mutual exclusion, leader election, and logical clocks — built as part of a university practical assignment (*Travaux Pratiques*).

---

## 🌐 Live Demo

👉 **[Accéder à la démo en ligne](https://drive.google.com/file/d/1DvpcORnoLihb16mc9dqSGYUWHJgU5ebL/view?fbclid=IwY2xjawRsSOdleHRuA2FlbQIxMABicmlkETFkWURzbnJ0dmJIUUswMHhWc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHrWVP_4nbVJvC54PnkvuLWALPJZybFxbBsnEptKJAXVKTqvO9r1UMIaEPCbd_aem__JCLveLnnC1yWFXKB7_EqQ)**

> Aucune installation requise — fonctionne directement dans le navigateur.

## ✨ Features

- 🎬 **Cinema playback engine** — step forward/backward through any algorithm frame by frame
- 🔀 **Random scenario generation** — every run produces a unique, valid scenario
- 📊 **Dual visualization modes** — sequence diagram (timeline) and network graph
- 🧠 **8 algorithms** across three categories
- 📝 **Live log view** with timestamped events
- ⚡ **Configurable speed** and number of processes (up to 50)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Installation

```bash
git clone <repo-url>
cd <project-folder>
npm install
```

### Run in development

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

---

## 🧩 Algorithms

### 🔒 Exclusion Mutuelle

| Algorithm | Description |
|-----------|-------------|
| **Ricart–Agrawala** | Permission-based mutual exclusion. A process broadcasts a `REQUEST` with a Lamport timestamp; peers reply only if they are not competing or have a lower priority. |
| **Token Ring** | A single token circulates in a logical ring. Only the token holder may enter the critical section. |
| **Suzuki–Kasami** | Broadcast-based token algorithm. A process floods a `REQUEST`; the current token holder sends the token once it exits the CS. |

### 👑 Élection de Leader

| Algorithm | Description |
|-----------|-------------|
| **Bully Election** | A process starts an election by challenging all higher-ID peers. The highest available process wins and announces itself as coordinator. |
| **Ring Election** | Processes pass election messages around a logical ring; the message with the highest ID wins after a full round. |

### 🕐 Horloges Logiques

| Algorithm | Description |
|-----------|-------------|
| **Horloge de Lamport** | Each process holds an integer counter. Incremented on local events and sends; merged by `max + 1` on receive. Captures ordering, not causality. |
| **Horloge Vectorielle (Mattern)** | Each process holds a vector of size *n*. Captures exact causal precedence: `e → e' ⟺ V(e) < V(e')`. Concurrent events produce incomparable vectors. |
| **Horloge Matricielle** | Each process holds an *n × n* matrix. Encodes what each process *knows that others know*, enabling distributed garbage collection and global snapshots. |

---

## 🗂️ Project Structure

```
src/
├── algorithms/                  # Runtime algorithm logic (live simulation)
│   ├── bully.ts                 # Bully election handler
│   ├── ricartAgrawala.ts        # Ricart–Agrawala handler
│   ├── ringElection.ts          # Ring election handler
│   ├── simulation.ts            # Core simulator (message queue, tick loop)
│   ├── tokenRing.ts             # Token Ring handler
│   └── vectorClock.ts           # Vector clock runtime
│
├── components/                  # Shared UI components
│   ├── ControlPanel.tsx         # Algorithm selector, process count, speed slider
│   ├── LogView.tsx              # Timestamped event log
│   ├── RingElectionControls.tsx # Ring-specific controls
│   └── Visualizer.tsx           # Legacy visualizer wrapper
│
├── features/sim/
│   ├── algorithms/              # Cinema (scenario) generators — one per algorithm
│   │   ├── bullyCinema.ts
│   │   ├── lamportClockCinema.ts
│   │   ├── matrixClockCinema.ts
│   │   ├── ricartAgrawalaCinema.ts
│   │   ├── ringElectionCinema.ts
│   │   ├── suzukiKasamiCinema.ts
│   │   ├── tokenRingCinema.ts
│   │   └── vectorClockCinema.ts
│   │
│   ├── components/
│   │   ├── GraphCanvas.tsx      # Main SVG canvas (sequence + network views)
│   │   └── TimelineControls.tsx # Play / Pause / Step / Scrub controls
│   │
│   ├── model/
│   │   └── algorithmCinema.ts   # Step types: MessageStep, NodeStateStep, NarrationStep
│   │
│   ├── scenarios/               # Pre-built or saved scenario payloads
│   └── state/
│       └── SimProvider.tsx      # Global cinema state via React context + useReducer
│
├── App.tsx                      # Root component — wires everything together
├── index.css                    # Global styles
├── main.tsx                     # React entry point
└── types.ts                     # Shared types: Process, Message, ProcessState
```

---

## 🎮 How to Use

1. **Choose an algorithm** from the *Algorithm* dropdown.
2. **Set the number of processes** (default 3, max 50).
3. Click **Start** to initialize the simulator.
4. Click the **algorithm action button** that appears:
   - *Request CS* → Ricart–Agrawala
   - *Pass Token* → Token Ring / Suzuki–Kasami
   - *Start Election* → Bully / Ring
   - *Generate Scenario* → Lamport / Vector Clock / Matrix Clock
5. Use **Step**, **Play**, or the **timeline scrubber** to navigate the animation.
6. Check the **Log View** for a text trace of all events.
7. Click the action button again to generate a **new random scenario**.

---

## 🏗️ Architecture — Cinema Model

All algorithms are visualized through a unified *cinema* abstraction:

```
AlgorithmCinemaPayload
  └── steps: AlgorithmStep[]
        ├── MessageStep     — an arrow between two processes (send or deliver)
        ├── NodeStateStep   — updates a node's color, label, or badges (e.g. clock value)
        └── NarrationStep   — a text description of what is happening
```

Each cinema generator (`*Cinema.ts`) produces a deterministic or randomly-seeded `AlgorithmCinemaPayload`. The `SimProvider` stores this payload and exposes a playback index that `GraphCanvas` reads to render the correct frame.

This separation means **the visualization is completely decoupled from the algorithm logic** — you can add a new algorithm by writing only a new cinema generator.

---

## 🛠️ Tech Stack

| Tool | Role |
|------|------|
| [React 18](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite](https://vitejs.dev/) | Build tool & dev server |
| [Mantine UI](https://mantine.dev/) | Component library (buttons, sliders, selects) |
| [D3 / SVG](https://d3js.org/) | Graph canvas rendering |

---

## 📚 References

- Lamport, L. (1978). *Time, Clocks, and the Ordering of Events in a Distributed System*. CACM.
- Ricart, G. & Agrawala, A. (1981). *An Optimal Algorithm for Mutual Exclusion in Computer Networks*. CACM.
- Mattern, F. (1988). *Virtual Time and Global States of Distributed Systems*.
- Suzuki, I. & Kasami, T. (1985). *A Distributed Mutual Exclusion Algorithm*. ACM TOCS.
- Garcia-Molina, H. (1982). *Elections in a Distributed Computing System*. IEEE TC.

---

## 👨‍💻 Authors

> Projet réalisé dans le cadre du cours de **Systèmes Distribués** — TP noté.

---

## 📄 License

MIT
