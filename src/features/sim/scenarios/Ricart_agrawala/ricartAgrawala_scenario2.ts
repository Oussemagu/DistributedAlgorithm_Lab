import type { RicartScenario  }  from '../../algorithms/ricartAgrawalaCinema'
const scenario: RicartScenario = {
  requester: 1,
  processes: [1, 2, 3],
  alsoRequesting: [2],  // P1 et P2 demandent en même temps
}

export default scenario