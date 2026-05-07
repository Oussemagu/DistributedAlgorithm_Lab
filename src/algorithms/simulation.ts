import { Message, Process } from '../types'

export type SimulatorOptions = {
  processes: Process[]
  onLog?: (s: string) => void
  delay?: number
  onMessage?: (m: Message) => void
}

export class Simulator {
  processes: Process[]
  onLog?: (s: string) => void
  delay: number
  messageQueue: Message[] = []
  timer: any = null
  handlers: Map<number, (msg: Message) => void> = new Map()

  constructor(opts: SimulatorOptions) {
    this.processes = opts.processes
    this.onLog = opts.onLog
    this.delay = opts.delay ?? 500
    if (opts.onMessage) this.onMessage = opts.onMessage
  }

  log(s: string) {
    this.onLog?.(s)
  }
  // In the send() method, ensure the clock field is preserved:
  send(msg: Message) {
  // clock is already set by the sender; just route it
  this.onMessage?.(msg)
  const handler = this.handlers.get(msg.to)
  if (handler) handler(msg)
}

  onMessage?: (m: Message) => void

  registerHandler(pid: number, handler: (msg: Message) => void) {
    this.handlers.set(pid, handler)
  }

  deliver() {
    if (this.messageQueue.length === 0) return
    const msg = this.messageQueue.shift()!
    this.log(`DELIVER ${msg.type} to ${msg.to} from ${msg.from}`)
    const h = this.handlers.get(msg.to)
    if (h) {
      try {
        h(msg)
      } catch (e) {
        this.log(`Handler error for ${msg.to}: ${String(e)}`)
      }
    }
    // notify UI about the delivered message for visualization
    this.onMessage?.(msg)
    return msg
  }

  setTick(tick: number) {
    this.delay = tick
    if (this.timer) {
      this.stop()
      this.start(this.delay)
    }
  }

  start(tick = 200) {
    if (this.timer) return
    this.timer = setInterval(() => this.step(), tick)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  step() {
    // simple delivery per step
    this.deliver()
  }
}
