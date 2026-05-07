import React from 'react'
import { Button, Stack, Title, Group, Select, Slider, Switch, NumberInput, Text } from '@mantine/core'

type Props = {
  onStart: () => void
  onStop: () => void
  onRequestCS: () => void
  onPassToken: () => void
  onStep: () => void
  processes: number[]
  selectedProcess: number
  setSelectedProcess: (id: number) => void
  autoRun: boolean
  setAutoRun: (v: boolean) => void
  speed: number
  setSpeed: (v: number) => void
  algorithm: string
  setAlgorithm: (a: string) => void
  numberOfProcesses: number
  setNumberOfProcesses: (n: number) => void
  scenarioId: string
  setScenarioId: (id: string) => void
}

const scenarios = [
  {
    id: 'scenario1',
    label: 'Scénario 1 — Seul demandeur',
    description: 'P1 demande seul la SC. Tous les peers répondent immédiatement.',
  },
  {
    id: 'scenario2',
    label: 'Scénario 2 — 2 demandeurs concurrents',
    description: 'P1 et P2 demandent en même temps. P1 a priorité (timestamp plus bas).',
  },
  {
    id: 'scenario3',
    label: 'Scénario 3 — 3 demandeurs concurrents',
    description: 'P1, P2 et P3 demandent en même temps. P1 entre en SC en premier.',
  },
]

export default function ControlPanel({
  onStart, onStop, onRequestCS, onPassToken, onStep, onBullyElection,
  processes, selectedProcess, setSelectedProcess,
  autoRun, setAutoRun,
  speed, setSpeed,
  algorithm, setAlgorithm,
  numberOfProcesses, setNumberOfProcesses,
  scenarioId, setScenarioId,
}: Props) {

  return (
    <Stack>
      <Title order={4}>Controls</Title>
      <Group>
        <Button color="green" onClick={onStart}>Start</Button>
        <Button color="red" onClick={onStop}>Stop</Button>
      </Group>
      <Select
        label="Algorithm"
        value={algorithm}
        onChange={(v) => setAlgorithm(String(v))}
        data={[
          { value: 'ricart', label: 'Ricart–Agrawala' },
          { value: 'token', label: 'Token Ring' },
          { value: 'bully', label: 'Bully Election' },
          { value: 'ring', label: 'Ring Election' },
        ]}
      />
      <NumberInput
        label="Processes"
        value={numberOfProcesses}
        min={1}
        max={50}
        onChange={(v) => setNumberOfProcesses(v || 1)}
      />
      <Select
        label="Requester"
        value={String(selectedProcess)}
        onChange={(v) => setSelectedProcess(Number(v))}
        data={processes.map((p) => ({ value: String(p), label: `Process ${p}` }))}
      />
      <Group spacing="xs" align="center">
        <Switch label="Auto Run" checked={autoRun} onChange={(e) => setAutoRun(e.currentTarget.checked)} />
      </Group>
      <Slider label={`Speed: ${speed} ms`} min={50} max={2000} step={50} value={speed} onChange={(v) => setSpeed(v)} />

      {/* Sélecteur de scénario — uniquement pour Ricart-Agrawala */}
      {algorithm === 'ricart' && (
        <Stack gap={6}>
          <Text size="sm" fw={500}>Scénario</Text>
          {scenarios.map((s) => (
            <div
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `2px solid ${scenarioId === s.id ? '#228be6' : '#dee2e6'}`,
                background: scenarioId === s.id ? '#e7f5ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              <Text size="sm" fw={600} c={scenarioId === s.id ? 'blue' : 'dark'}>
                {s.label}
              </Text>
              <Text size="xs" c="dimmed">{s.description}</Text>
            </div>
          ))}
        </Stack>
      )}

      {/* Boutons d'action selon l'algorithme */}
      {algorithm === 'ricart' && <Button onClick={onRequestCS}>Request CS (Ricart–Agrawala)</Button>}
      {algorithm === 'token' && <Button onClick={onPassToken}>Pass Token (Token Ring)</Button>}
      {(algorithm === 'bully' || algorithm === 'ring') && (
        <Button onClick={onStep}>Run {algorithm === 'bully' ? 'Bully' : 'Ring'} Election (step)</Button>
      )}

      <Group>
        <Button onClick={onStep}>Step</Button>
      </Group>
    </Stack>
  )
}
