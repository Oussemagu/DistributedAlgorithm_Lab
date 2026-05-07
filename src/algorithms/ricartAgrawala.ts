export function createRicartAgrawala(myId: number) {
  let clock = 0
  let requestClock = 0
  let deferred: any[] = []
  let repliesReceived = new Set<number>()
  let inCS = false

  // ✅ Règle ② : tick = événement local
  function tick() { clock += 1; return clock }
  // ✅ Règle ④ : réception
  function update(received: number) { clock = Math.max(clock, received) + 1; return clock }

  function requestCS(send: Function, peers: number[]) {
    repliesReceived.clear()
    // ✅ Règle ②③ : un tick PAR envoi
    peers.forEach((p) => {
      tick()
      requestClock = clock             // on retient le clock du DERNIER envoi
      send({ from: myId, to: p, type: 'RA_REQUEST', clock })
    })
  }

  function handle(msg: any, send: Function) {
    // ✅ Règle ④ appliquée à CHAQUE réception
    update(msg.clock ?? 0)

    if (msg.type === 'RA_REQUEST') {
      // ✅ Logique de priorité claire et séparée
      const notRequesting = requestClock === 0
      const hasHigherPriority =
        msg.clock < requestClock ||
        (msg.clock === requestClock && msg.from < myId)

      if (!inCS && (notRequesting || hasHigherPriority)) {
        tick()                         // ✅ événement local avant envoi
        send({ from: myId, to: msg.from, type: 'RA_REPLY', clock })
      } else {
        deferred.push(msg)
      }
    }

    if (msg.type === 'RA_REPLY') {
      repliesReceived.add(msg.from)
    }
  }

  function gotAll(peers: number[]) {
    return peers.every((p) => repliesReceived.has(p))
  }

  function enterCS() {
    inCS = true
  }

  function release(send: Function) {
    inCS = false
    requestClock = 0
    const pending = deferred
    deferred = []
    pending.forEach((msg) => {
      tick()                           // ✅ événement local avant chaque reply
      send({ from: myId, to: msg.from, type: 'RA_REPLY', clock })
    })
  }

  function getClock() { return clock }

  return { requestCS, handle, gotAll, enterCS, release, getClock }
}