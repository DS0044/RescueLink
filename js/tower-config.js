/**
 * RESCUE LINK - Nearest Radio Tower Simulation Configuration
 * Purely visual simulation configuration for victim emergency terminal.
 */

window.TOWER_CONFIG = {
  // Configurable simulated towers relative to victim position
  // Offsets in degrees allow realistic relative placement anywhere on Earth
  towers: [
    {
      id: 'tower-a',
      name: 'Tower A - Ridge Station',
      latOffset: 0.0095,
      lngOffset: 0.0080,
      range_km: 4.0,
      status: 'out_of_service', // Explicitly out of service (skipped in selection)
      channel: 'LoRa CH1 (868.1 MHz)',
      description: 'Mountain ridge relay (Power failure / Inactive)'
    },
    {
      id: 'tower-b',
      name: 'Tower B - Hill Relay',
      latOffset: -0.0145,
      lngOffset: 0.0160,
      range_km: 6.5,
      status: 'active', // Nearest active tower (~2.4 km)
      channel: 'LoRa CH2 (868.3 MHz)',
      description: 'Primary disaster response relay station'
    },
    {
      id: 'tower-c',
      name: 'Tower C - River Post',
      latOffset: 0.0260,
      lngOffset: -0.0210,
      range_km: 7.0,
      status: 'active', // In range (~3.7 km)
      channel: 'LoRa CH3 (868.5 MHz)',
      description: 'Flood basin monitoring tower'
    },
    {
      id: 'tower-d',
      name: 'Tower D - Coast Watch',
      latOffset: -0.0520,
      lngOffset: -0.0450,
      range_km: 5.0,
      status: 'active', // Active but out of range (~7.6 km > 5.0 km range)
      channel: 'LoRa CH4 (867.9 MHz)',
      description: 'Coastal perimeter post (Out of radio range)'
    },
    {
      id: 'tower-e',
      name: 'Tower E - Valley Base',
      latOffset: 0.0380,
      lngOffset: 0.0320,
      range_km: 10.0,
      status: 'active', // In range but further away (~5.5 km)
      channel: 'LoRa CH5 (868.7 MHz)',
      description: 'Civil defense repeater station'
    }
  ],

  // Gateway station position on canvas (normalized coordinates 0..1)
  gateway: {
    name: 'Rescue Command Gateway',
    xRatio: 0.88,
    yRatio: 0.15
  },

  // Test toggle: Set to true to demonstrate edge case when no tower is reachable
  SIM_FORCE_NO_TOWER: false,

  // Physical LoRa RF parameters
  rf: {
    spreadingFactor: 10,
    bandwidthKHz: 125,
    codingRate: '4/5',
    preambleSymbols: 8,
    txPowerDbm: 14,
    pathLossExponent: 2.7, // Urban/semi-rural path loss exponent n
    packetBytes: 21,
    explicitHeader: true,
    crc: true
  }
};
