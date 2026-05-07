import type { RicartScenario  }  from '../../algorithms/ricartAgrawalaCinema'

const scenario: RicartScenario = {
  requester: 1,
  processes: [1, 2, 3, 4],
  alsoRequesting: [2, 3],  // P1, P2 et P3 demandent en même temps
}

export default scenario