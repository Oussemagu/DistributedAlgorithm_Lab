import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import type { AlgorithmCinemaPayload, AlgorithmStep, NodeId, CinemaNodeState } from '../model/algorithmCinema'

type SimState = {
  processes: CinemaNodeState[]
  steps: AlgorithmStep[]
  index: number // current playback index (0..steps.length)
  playing: boolean
  speed: number // ms per step when playing
  algorithm?: string
}

const initialState: SimState = {
  processes: [],
  steps: [],
  index: 0,
  playing: false,
  speed: 300,
}

type Action =
  | { type: 'INIT_PROCESSES'; processes: CinemaNodeState[] }
  | { type: 'LOAD_CINEMA'; payload: AlgorithmCinemaPayload }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACK' }
  | { type: 'SET_INDEX'; index: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'SET_ALGORITHM'; algorithm: string }
  | { type: 'RESET' }
  | { type: 'RESET_STATE' }

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'INIT_PROCESSES':
      return {
    ...state,
    processes: action.processes.map((p) => ({ ...p, clock: 0 }))
  }
    case 'LOAD_CINEMA':
      return { ...state, steps: action.payload.steps || [], index: 0, playing: false }
    case 'PLAY':
      return { ...state, playing: true }
    case 'PAUSE':
      return { ...state, playing: false }
    case 'STEP_FORWARD':
      return { ...state, index: Math.min(state.index + 1, state.steps.length) }
    case 'STEP_BACK':
      return { ...state, index: Math.max(0, state.index - 1) }
    case 'SET_INDEX':
      return { ...state, index: Math.max(0, Math.min(action.index, state.steps.length)) }
    case 'SET_SPEED':
      return { ...state, speed: action.speed }
    case 'SET_ALGORITHM':
      return { ...state, algorithm: action.algorithm }
    case 'RESET':
      return { ...initialState, speed: state.speed, algorithm: state.algorithm }
    case 'RESET_STATE':
      return { ...initialState, algorithm: state.algorithm }
    default:
      return state
  }
}

type SimContextValue = {
  state: SimState
  dispatch: React.Dispatch<Action>
}

const SimContext = createContext<SimContextValue | undefined>(undefined)

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  useEffect(() => {
    function handler(e: any) {
      const processes = e?.detail
      if (Array.isArray(processes)) dispatch({ type: 'INIT_PROCESSES', processes })
    }
    window.addEventListener('sim:init_processes', handler)
    function handlerLoad(e: any) {
      const payload = e?.detail
      if (payload) dispatch({ type: 'LOAD_CINEMA', payload })
    }
    window.addEventListener('sim:load_cinema', handlerLoad)
    function handlerSetAlgo(e: any) {
      const algo = e?.detail
      if (typeof algo === 'string') dispatch({ type: 'SET_ALGORITHM', algorithm: algo })
    }
    window.addEventListener('sim:set_algorithm', handlerSetAlgo)
    function handlerReset() {
      dispatch({ type: 'RESET' })
    }
    window.addEventListener('sim:reset', handlerReset)
    return () => {
      window.removeEventListener('sim:init_processes', handler)
      window.removeEventListener('sim:load_cinema', handlerLoad)
      window.removeEventListener('sim:set_algorithm', handlerSetAlgo)
      window.removeEventListener('sim:reset', handlerReset)
    }
  }, [])
  
  return <SimContext.Provider value={{ state, dispatch }}>{children}</SimContext.Provider>
}

export function useSim() {
  const ctx = useContext(SimContext)
  if (!ctx) throw new Error('useSim must be used within SimProvider')
  return ctx
}
