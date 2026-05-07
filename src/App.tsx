import React, { useState, useRef, useEffect } from 'react'
import { Container, Card, Title } from '@mantine/core'
import ControlPanel from './components/ControlPanel'
import GraphCanvas from './features/sim/components/GraphCanvas'
import RingSnapshotCanvas from './features/sim/components/RingSnapshotCanvas'
import LogView from './components/LogView'
import { SimProvider } from './features/sim/state/SimProvider'
import TimelineControls from './features/sim/components/TimelineControls'
import { Simulator } from './algorithms/simulation'
import { createRicartAgrawala } from './algorithms/ricartAgrawala'
import { createTokenRing } from './algorithms/tokenRing'
import { createBully } from './algorithms/bully'
import { Process } from './types'
import type { Message } from './types'
import type { RingVariant } from './features/sim/algorithms/ringElectionCinema'

export default function App() {
  const initialProcesses: Process[] = [1, 2, 3, 4, 5].map((id) => ({ id, state: 'idle', log: [] }))
  const [processes, setProcesses] = useState<Process[]>(initialProcesses)
  const [numberOfProcesses, setNumberOfProcesses] = useState<number>(initialProcesses.length)
  const [tokenHolder, setTokenHolder] = useState<number>(1)
  const [logs, setLogs] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const simRef = useRef<Simulator | null>(null)
  const raInstances = useRef<any>(null)
  const bullyInstances = useRef<any>(null)
  const tokenInstances = useRef<any>(null)
  const [selectedProcess, setSelectedProcess] = useState<number>(1)
  const [autoRun, setAutoRun] = useState<boolean>(true)
  const [speed, setSpeed] = useState<number>(300)
  const [algorithm, setAlgorithm] = useState<string>('ricart')
  const [scenarioId, setScenarioId] = useState<string>('scenario1')

  function appendLog(s: string) {
    setLogs((l) => [...l, new Date().toLocaleTimeString() + ' ' + s].slice(-500))
  }

  // ── Crée un simulateur propre pour l'algo demandé ──────────────────────────
  function initSim(algo: string): Simulator {
    // Arrêter et détruire l'ancien sim
    simRef.current?.stop()
    raInstances.current    = null
    bullyInstances.current = null
    tokenInstances.current = null

    const sim = new Simulator({
      processes,
      onLog: appendLog,
      onMessage: (m) => setMessages((s) => [...s, m].slice(-200)),
    })
    simRef.current = sim
    const peers = processes.map((p) => p.id)

    if (algo === 'ricart') {
      const ras: Record<number, any> = {}
      processes.forEach((p) => {
        const ra = createRicartAgrawala(p.id)
        ras[p.id] = ra
        sim.registerHandler(p.id, (msg) => ra.handle(msg, (m: Message) => sim.send(m)))
      })
      raInstances.current = ras

    } else if (algo === 'bully') {
      const bullies: Record<number, any> = {}
      processes.forEach((p) => {
        const bully = createBully(p.id)
        bullies[p.id] = bully
        sim.registerHandler(p.id, (msg) => bully.handle(msg, (m: Message) => sim.send(m), peers))
      })
      bullyInstances.current = bullies

    } else if (algo === 'token') {
      const tokens: Record<number, any> = {}
      processes.forEach((p) => {
        const token = createTokenRing(p.id)
        tokens[p.id] = token
        sim.registerHandler(p.id, (msg) => token.handle(msg))
      })
      tokenInstances.current = tokens
    }
    // suzuki : pas de sim en temps réel, uniquement cinema

    // initialize SimProvider processes
    try {
      // dynamic import to avoid circular during boot
      const payload = processes.map((p) => ({ id: p.id, label: `P${p.id}`, color: 'skyblue' }))
      window.dispatchEvent(new CustomEvent('sim:init_processes', { detail: payload }))
    } catch (e) {
      // ignore
    }

    if (algorithm === 'vector') {
      loadVectorClockScenario()
    } else if (algorithm === 'matrix') {
      loadMatrixClockScenario()
    }

    if (autoRun) sim.start(speed)

    // Notifier le provider
    const payload = processes.map((p) => ({ id: p.id, label: `P${p.id}`, color: 'skyblue' }))
    window.dispatchEvent(new CustomEvent('sim:init_processes', { detail: payload }))

    return sim
  }

  React.useEffect(() => {
    const newProcs: Process[] = Array.from({ length: numberOfProcesses }).map((_, i) => ({
      id: i + 1, state: 'idle', log: [],
    }))
    setProcesses(newProcs)
    try {
      const payload = newProcs.map((p) => ({ id: p.id, label: `P${p.id}`, color: 'skyblue' }))
      window.dispatchEvent(new CustomEvent('sim:init_processes', { detail: payload }))
    } catch (e) {}
    setSelectedProcess((cur) => Math.max(1, Math.min(cur, numberOfProcesses)))
    setTokenHolder((cur) => Math.max(1, Math.min(cur, numberOfProcesses)))
  }, [numberOfProcesses])

  function stop() {
    simRef.current?.stop()
    appendLog('Simulation stopped')
  }

  // ── Ricart–Agrawala ────────────────────────────────────────────────────────
  async function requestCS() {
  appendLog('Requesting CS (Ricart–Agrawala)')
  const sim = simRef.current
  if (!sim) return appendLog('Start simulation first')
  const requester = selectedProcess
  const peers = processes.map((p) => p.id).filter((id) => id !== requester)
  const ra = raInstances.current?.[requester]
  if (!ra) return appendLog('RA instance missing')

  // ✅ Générer le cinema EN PREMIER, avant tout envoi
 try {
    console.log('🔵 step 1: importing cinema...')
    const { generateRicartAgrawalaCinema } = await import('./features/sim/algorithms/ricartAgrawalaCinema')
    const scenarioMap: Record<string, string> = {
      scenario1: './features/sim/scenarios/Ricart_agrawala/ricartAgrawala_scenario1',
      scenario2: './features/sim/scenarios/Ricart_agrawala/ricartAgrawala_scenario2',
      scenario3: './features/sim/scenarios/Ricart_agrawala/ricartAgrawala_scenario3',
    }
    console.log('🔵 step 2: importing scenario...', scenarioId)
    const { default: scenario } = await import(/* @vite-ignore */ scenarioMap[scenarioId])
    console.log('🔵 step 3: scenario loaded:', scenario)
    const payload = generateRicartAgrawalaCinema({
      requester,
      processes: processes.map((p) => p.id),
      alsoRequesting: scenario.alsoRequesting,
    })
    console.log('🔵 step 4: payload steps count:', payload.steps.length)
    window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
    window.dispatchEvent(new CustomEvent('sim:init_processes', { 
      detail: processes.map((p) => ({ id: p.id, label: `P${p.id}`, color: 'skyblue' })) 
    }))
    console.log('🔵 step 5: events dispatched ✅')
    appendLog('Loaded cinema payload for playback')}
   catch (e) {
      console.error('❌ FAILED AT:', e)

    appendLog('Failed to load cinema payload: ' + String(e))
  }

  // ✅ Ensuite seulement, lancer la simulation temps-réel
  setProcesses((ps) => ps.map((pp) => (pp.id === requester ? { ...pp, state: 'requesting' } : pp)))
  ra.requestCS((m: Message) => sim.send(m), peers)
  appendLog(`Process ${requester} sent RA_REQUEST to peers`)

  const checkInterval = setInterval(() => {
    try {
      if (ra.gotAll(peers)) {
        clearInterval(checkInterval)
        appendLog(`Process ${requester} received all RA_REPLY — entering CS`)
        setProcesses((ps) => ps.map((pp) => (pp.id === requester ? { ...pp, state: 'in_cs' } : pp)))
        setTimeout(() => {
          appendLog(`Process ${requester} leaving CS — releasing replies`)
          ra.release((m: Message) => sim.send(m))
          setProcesses((ps) => ps.map((pp) => (pp.id === requester ? { ...pp, state: 'idle' } : pp)))
        }, 2000)
      }
    } catch (e) {
      clearInterval(checkInterval)
    }
  }, 150)
}

  function step() {
    const sim = simRef.current
    if (!sim) return appendLog('Start simulation first')
    sim.step()
  }

  // ── Bully ──────────────────────────────────────────────────────────────────
  async function startBullyElection() {
    const sim = initSim('bully')            // ← repart propre
    appendLog('Simulation Bully démarrée')

    const bullies = bullyInstances.current
    if (!bullies) return appendLog('Bully algorithm not initialized')

    const peers = processes.map((p) => p.id)
    const initiator = selectedProcess
    appendLog(`Process ${initiator} initiates bully election`)
    bullies[initiator].startElection(peers, (m: Message) => sim.send(m))

    try {
      const { generateBullyCinema } = await import('./features/sim/algorithms/bullyCinema')
      const payload = generateBullyCinema(initiator, peers)
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
      appendLog('Loaded cinema payload for Bully playback')
    } catch (e) {
      appendLog('Failed to load cinema payload: ' + String(e))
    }
  }

  // ── Token Ring ─────────────────────────────────────────────────────────────
  async function passToken() {
    const sim = initSim('token')            // ← repart propre
    appendLog('Simulation Token Ring démarrée')

    const tokens = tokenInstances.current
    if (!tokens) return appendLog('Token Ring algorithm not initialized')

    const sortedPeers = processes.map((p) => p.id).sort((a, b) => a - b)
    const initiator = selectedProcess
    const currentIndex = sortedPeers.indexOf(initiator)
    const nextPeer = sortedPeers[(currentIndex + 1) % sortedPeers.length]

    tokens[initiator].state.hasToken = true
    tokens[initiator].passToken(nextPeer, (m: Message) => sim.send(m))
    appendLog(`Process ${initiator} passed token to ${nextPeer}`)

    try {
      const { generateTokenRingCinema } = await import('./features/sim/algorithms/tokenRingCinema')
      const payload = generateTokenRingCinema(initiator, sortedPeers)
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
      appendLog('Loaded cinema payload for Token Ring playback')
    } catch (e) {
      appendLog('Failed to load cinema payload: ' + String(e))
    }
  }

  // ── Suzuki-Kasami ──────────────────────────────────────────────────────────
  async function requestSuzuki() {
    // Suzuki n'a pas de sim temps-réel : juste reset + cinema
    simRef.current?.stop()
    simRef.current = null
    raInstances.current    = null
    bullyInstances.current = null
    tokenInstances.current = null

    const payload = processes.map((p) => ({ id: p.id, label: `P${p.id}`, color: 'skyblue' }))
    window.dispatchEvent(new CustomEvent('sim:init_processes', { detail: payload }))

    appendLog(`Process ${selectedProcess} requests CS (Suzuki-Kasami)`)
    try {
      const { generateSuzukiKasamiCinema } = await import('./features/sim/algorithms/suzukiKasamiCinema')
      const cinPayload = generateSuzukiKasamiCinema(
        selectedProcess,
        processes.map((p) => p.id),
        tokenHolder
      )
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: cinPayload }))
      appendLog('Loaded cinema payload for Suzuki-Kasami playback')
    } catch (e) {
      appendLog('Failed to load Suzuki-Kasami cinema: ' + String(e))
    }
  }

  function handleSetAutoRun(v: boolean) {
    setAutoRun(v)
    const sim = simRef.current
    if (!sim) return
    if (v) sim.start(speed)
    else sim.stop()
  }

  function handleSetSpeed(v: number) {
    setSpeed(v)
    simRef.current?.setTick(v)
  }

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('sim:set_algorithm', { detail: algorithm }))
      // Réinitialiser l'état quand on change d'algorithme
      window.dispatchEvent(new CustomEvent('sim:reset'))
    } catch (e) {
      // ignore
    }
  }, [algorithm])
  
  async function runRingElection(variant: RingVariant, initiators: number[], customIds: number[]) {
    appendLog(`Lancement Ring Election — Variante: ${variant === 'leLann' ? 'Le Lann' : 'Chang-Roberts'}`)
    appendLog(`Initiateurs: ${initiators.map(i => `P${i}`).join(', ')}`)
    
    try {
      const { generateRingElectionCinema } = await import('./features/sim/algorithms/ringElectionCinema')
      
      const ring = processes.map((p, i) => ({
        id: p.id,
        processId: customIds[i] || (i + 1)
      }))
      
      appendLog(`Anneau: ${ring.map(r => `P${r.id}(id=${r.processId})`).join(' → ')}`)
      
      const cinemaProcesses = ring.map(r => ({
        id: r.id,
        label: `P${r.id}`,
        color: 'white',
        processId: r.processId
      }))
      
      window.dispatchEvent(new CustomEvent('sim:init_processes', { detail: cinemaProcesses }))
      
      const payload = generateRingElectionCinema(variant, ring, initiators)
      
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
      window.dispatchEvent(new CustomEvent('sim:set_algorithm', { detail: 'ring' }))
      
      appendLog('✓ Scénario chargé')
      
      // Écouter les changements d'index pour afficher les narrations
      window.dispatchEvent(new CustomEvent('sim:enable_narration_logs', { detail: true }))
    } catch (e) {
      appendLog('❌ Erreur: ' + String(e))
      console.error(e)
    }
  }
  
  // Écouter les narrations de la simulation
  useEffect(() => {
    function handleNarration(e: any) {
      const text = e?.detail
      if (typeof text === 'string') {
        appendLog(text)
      }
    }
    window.addEventListener('sim:narration', handleNarration)
    return () => {
      window.removeEventListener('sim:narration', handleNarration)
    }
  }, [])
  async function loadVectorClockScenario() {
    try {
      const { generateVectorClockCinema } = await import('./features/sim/algorithms/vectorClockCinema')
      const payload = generateVectorClockCinema(processes.map((p) => p.id))
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
      appendLog('Loaded random Vector Clock (Mattern) scenario')
    } catch (e) {
      appendLog('Failed to load vector clock scenario: ' + String(e))
    }
  }

  async function loadMatrixClockScenario() {
    try {
      const { generateMatrixClockCinema } = await import('./features/sim/algorithms/matrixClockCinema')
      const payload = generateMatrixClockCinema(processes.map((p) => p.id))
      window.dispatchEvent(new CustomEvent('sim:load_cinema', { detail: payload }))
      appendLog('Loaded Matrix Clock causal-delivery scenario')
    } catch (e) {
      appendLog('Failed to load matrix clock scenario: ' + String(e))
    }
  }

  useEffect(() => {
    if (algorithm !== 'vector') return
    loadVectorClockScenario()
  }, [algorithm, processes])

  useEffect(() => {
    if (algorithm !== 'matrix') return
    loadMatrixClockScenario()
  }, [algorithm, processes])

  return (
    <SimProvider>
      <div className="app">
        <Container fluid>
          <Title order={2}>Distributed Algorithms Simulator — TP</Title>
          <div className="content">
            <div className="left">
              <Card shadow="sm">
                <ControlPanel
                  /*onStart={stop} */         // bouton Stop uniquement
                  onStart={() => {
                  initSim(algorithm)
                  appendLog('Simulation started')
                }}
                  onStop={stop}
                  onRequestCS={requestCS}
                  onPassToken={passToken}
                  onStep={step}
                  onRunRingElection={runRingElection}
                  onBullyElection={startBullyElection}
                  onSuzukiRequest={requestSuzuki}
                  onVectorScenario={loadVectorClockScenario}
                  onMatrixScenario={loadMatrixClockScenario}
                  processes={processes.map((p) => p.id)}
                  selectedProcess={selectedProcess}
                  setSelectedProcess={setSelectedProcess}
                  autoRun={autoRun}
                  setAutoRun={handleSetAutoRun}
                  speed={speed}
                  setSpeed={handleSetSpeed}
                  algorithm={algorithm}
                  setAlgorithm={setAlgorithm}
                  numberOfProcesses={numberOfProcesses}
                  setNumberOfProcesses={setNumberOfProcesses}
                  tokenHolder={tokenHolder}
                  setTokenHolder={setTokenHolder}
                    scenarioId={scenarioId}
  setScenarioId={setScenarioId}
                />
              </Card>
              <Card shadow="sm" style={{ marginTop: 12 }}>
                <LogView logs={logs} />
              </Card>
            </div>
            <div className="right">
              <Card shadow="sm">
                <div style={{ marginBottom: 8 }}>
                  <React.Suspense fallback={null}>
                    <TimelineControls />
                  </React.Suspense>
                </div>
                {/* Afficher RingSnapshotCanvas uniquement pour Ring Election */}
                {algorithm === 'ring' ? (
                  <RingSnapshotCanvas />
                ) : (
                  <GraphCanvas />
                )}
              </Card>
            </div>
          </div>
        </Container>
      </div>
    </SimProvider>
  )
}