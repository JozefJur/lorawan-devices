
var events = {
  0x0001: 'STATUS_FREE',
  0x0002: 'STATUS_OCCUPIED',
  0x0004: 'STATUS_CARD', /* iPermit card is detected */
  0x0008: 'STATUS_DETECTION', /* Set if sensor detected parking change */
  0x0010: 'STATUS_RESET', /* Device reset */
  0x0020: 'STATUS_MAG_ERROR', /* Magnetometer error - also indicator for mechanical damage */
  0x0040: 'STATUS_LOWBAT', /* Low battery voltage - appear if sensor has weak signal */
  0x0080: 'STATUS_TEMP_HIGH', /* High temperature  */
  0x0100: 'STATUS_NETWORK_ERR', /* No response from network */
  0x0200: 'STATUS_BLE_ERR', /* Bluetooth error */
  0x0400: 'STATUS_RADAR_ERR', /* Radar error */
  0x0800: 'STATUS_CMD_DONE', /* Command done */
  0x1000: 'STATUS_IDLE', /* Heartbeat message */
  0x2000: 'STATUS_MAGNET', /* If strong magnet is detected */
  0x4000: 'STATUS_CALIB_ERROR', /* Sensor not calibrated */
  0x8000: 'STATUS_MAG_DISTURB', /* Low radar reflection */
}

function decodeUplink(input) {
  return {
    // Decoded data
    data: {
      event: (input.bytes[0] << 8) | input.bytes[1],
      mag_total: input.bytes[2],
      derivation: input.bytes[3],
      temperature: input.bytes[4],
      voltage: input.bytes[5],
      extended_info: (input.bytes[6] << 8) | input.bytes[7],
      extended_info_2: (input.bytes[8] << 8) | input.bytes[9],
      p_time: (input.bytes[10] << 24 ) | (input.bytes[11] << 16 )| (input.bytes[12] << 8) | input.bytes[13] >>> 0,
      e_cnt: input.bytes[14]
      // RFU: input.bytes[15], //TBD
    },
  };
}

function normalizeUplink(input) {
    const base = {
    mag_total: input.data.mag_total,
    derivation: input.data.derivation,
    temperature: input.data.temperature, // °C
    voltage: input.data.voltage * 15, // to V
    extended_info_2: input.data.extended_info_2,
    p_time: input.data.p_time,
    e_cnt: input.data.e_cnt
  };
  const result = {
    data: {
      sensor: {
      event: eventMap[input.data.event] || "UNKNOWN_EVENT",
      ...base 
    } }
  };
  
  switch (input.data.event) {
    case 0x1000: { // STATUS_IDLE
      result.data.used_mAh = input.data.extended_info;
    }
    case 0x0008: { // STATUS_DETECTION
      result.data.sensor.radar_total = (input.data.extended_info >> 8) & 0xFF;
      result.data.sensor.radar_correlation = input.data.extended_info & 0xFF;
    }
  }
 return result;
}

function encodeDownlink(input) {
  switch (input.data.cmdID) {
    case 0x00: { // SetTime - Set unix timestamp 
      return {
        fPort: 1,//input.data.cmdID,
        bytes: [ (input.data.timestamp >> 24) & 0xFF, 
          (input.data.timestamp >> 16) & 0xFF, 
          (input.data.timestamp >> 8)  & 0xFF,
          input.data.timestamp & 0xFF ],
      };
    }
    case 0x01: { // SetCalibration - calibrate sensor manually
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.calibration],
      };
    }
    case 0x02: { // Reboot - Reboot device
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.reboot],
      };
    }
    case 0x03: { // SetTemp - High temperature threshold (0-85)
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.temperature],
      };
    }
    case 0x04: { // SetBat - Low battery threshold (2000-4000)
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.battery >> 8) & 0xFF, input.data.battery & 0xFF],
      };
    }
    case 0x05: { // SetIdle - step: 10 minutes (0-255)
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.idle],
      };
    }
    case 0x06: { // SetEvent - Number of consequent magnetometer measurements to evaluate status
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.event],
      };
    }
    case 0x07: { // SetLowMag - if mag_total < Low_mag then status = FREE
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.lowmag],
      };
    }
    case 0x08: { // SetHighMag - if mag_total > High_mag then status = BUSY
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.highmag],
      };
    }
    case 0x09: { // SetDerivation - Magnetometer change to start detection
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.derivation],
      };
    }
    case 0x0A: { // SetIP
      return {
        fPort: input.data.cmdID,
        bytes: [ (input.data.ip >> 24) & 0xFF, 
          (input.data.ip >> 16) & 0xFF, 
          (input.data.ip >> 8)  & 0xFF,
          input.data.ip & 0xFF ],
      };
    }
    case 0x0B: { // SetScan - BLE scan time
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.scan >> 8) & 0xFF, input.data.scan & 0xFF],
      };
    }
    case 0x0C: { // SetAdvertising - BLE advertising interval
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.advertising >> 8) & 0xFF, input.data.advertising & 0xFF],
      };
    }
    case 0x0D: { // SetRadarThr - Radar treshold to detect car
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.radarTreshold],
      };
    }
    case 0x0E: { // SetRadarCorr - Radar correlation factor to recognize fast parking
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.radarCorrelation],
      };
    }
    case 0x0F: { // SetParkId - iPermit card filter = Park ID
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.parkID >> 8) & 0xFF, input.data.parkID & 0xFF],
      };
    }
    case 0x10: { // IpPort - IP port for NBIOT
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.ipPort >> 8) & 0xFF, input.data.ipPort & 0xFF],
      };
    }
    case 0x11: { // SetIPCType - iPermit card operation mode settings
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.ipcType],
      };
    }
    case 0x12: { // EchoTc - Echo command
      return {
        fPort: input.data.cmdID,
        bytes: [(input.data.echo >> 8) & 0xFF, input.data.echo & 0xFF],
      };
    }
    case 0x13: { // LoRaRepetition - Number of LoRaWan repetition
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.loraRepetition],
      };
    }
    case 0x14: { // LoRaAdr
      return {
        fPort: input.data.cmdID,
        bytes: [input.data.loraAdr],
      };
    }
    default: {
      return {
        errors: ['invalid FPort'],
      };
    }
  }
}

function decodeDownlink(input) {
  switch (input.fPort) {
    case 0x00: { // SetTime - Set unix timestamp 
      return {
        data: {
        cmdID: input.fPort,
        timestamp: input.bytes
        }
      };
    }
    case 0x01: { // SetCalibration - calibrate sensor manually
      return {
        data: {
        cmdID: input.fPort,
        calibration: input.bytes[0]
        }
      };
    }
    case 0x02: { // Reboot - Reboot device
      return {
        data: {
        cmdID: input.fPort,
        reboot: input.bytes[0]
        }
      };
    }
    case 0x03: { // SetTemp - High temperature threshold (0-85)
      return {
        data: {
        cmdID: input.fPort,
        temperature: input.bytes[0]
        }
      };
    }
    case 0x04: { // SetBat - Low battery threshold (2000-4000)
      return {
        data: {
        cmdID: input.fPort,
        battery: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x05: { // SetIdle - step: 10 minutes (0-255)
      return {
        data: {
        cmdID: input.fPort,
        idle: input.bytes[0]
        }
      };
    }
    case 0x06: { // SetEvent - Number of consequent magnetometer measurements to evaluate status
      return {
        data: {
        cmdID: input.fPort,
        event: input.bytes[0]
        }
      };
    }
    case 0x07: { // SetLowMag - if mag_total < Low_mag then status = FREE
      return {
        data: {
        cmdID: input.fPort,
        lowmag: input.bytes[0]
        }
      };
    }
    case 0x08: { // SetHighMag - if mag_total > High_mag then status = BUSY
      return {
        data: {
        cmdID: input.fPort,
        highmag: input.bytes[0]
        }
      };
    }
    case 0x09: { // SetDerivation - Magnetometer change to start detection
      return {
        data: {
        cmdID: input.fPort,
        derivation: input.bytes[0]
        }
      };
    }
    case 0x0A: { // SetIP
      return {
        data: {
        cmdID: input.fPort,
        ip: input.bytes[0] << 24 | input.bytes[1] << 16 | input.bytes[2] << 8 | input.bytes[3]
        }
      };
    }
    case 0x0B: { // SetScan - BLE scan time
      return {
        data: {
        cmdID: input.fPort,
        scan: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x0C: { // SetAdvertising - BLE advertising interval
      return {
        data: {
        cmdID: input.fPort,
        advertising: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x0D: { // SetRadarThr - Radar treshold to detect car
      return {
        data: {
        cmdID: input.fPort,
        radarTreshold: input.bytes[0]
        }
      };
    }
    case 0x0E: { // SetRadarCorr - Radar correlation factor to recognize fast parking
      return {
        data: {
        cmdID: input.fPort,
        radarCorrelation: input.bytes[0]
        }
      };
    }
    case 0x0F: { // SetParkId - iPermit card filter = Park ID
      return {
        data: {
        cmdID: input.fPort,
        parkID: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x10: { // IpPort - IP port for NBIOT
      return {
        data: {
        cmdID: input.fPort,
        ipPort: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x11: { // SetIPCType - iPermit card operation mode settings
      return {
        data: {
        cmdID: input.fPort,
        ipcType: input.bytes[0]
        }
      };
    }
    case 0x12: { // EchoTc - Echo command
      return {
        data: {
        cmdID: input.fPort,
        echo: input.bytes[0] << 8 | input.bytes[1]
        }
      };
    }
    case 0x13: { // LoRaRepetition - Number of LoRaWan repetition
      return {
        data: {
        cmdID: input.fPort,
        loraRepetition: input.bytes[0],
        }
      };
    }
    case 0x14: { // LoRaAdr
      return {
        data: {
          cmdID: input.fPort,
          loraAdr: input.bytes[0],
        }
      };
    }
    default: {
      return {
        errors: ['invalid FPort'],
      };
    }
  }
}
