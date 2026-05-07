export type ProcessState = 'idle' | 'requesting' | 'in_cs' | 'failed'

export type Message = {
  from: number
  to: number
  type: string
  payload?: any
  time?: number
  clock?: number   // ← Lamport timestamp


}

export type Process = {
  id: number
  state: ProcessState
  log: string[]
}
