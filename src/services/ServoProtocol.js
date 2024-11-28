export class ServoProtocol {
  static SOF = 0x24;  // Start of Frame
  static EOF = 0x0D;  // End of Frame

  // Command codes
  static COMMANDS = {
    POSITION: 0x01,
    INCH_AZ: 0x02,
    INCH_EL: 0x20,
    SECTOR_SCAN: 0x03,
    STANDBY: 0x05,
    BIT: 0x06,
    STOP: 0x07
  };

  // Convert angle to counts based on protocol specifications
  static angleToAzimuthCounts(angle) {
    // (0 to 0xFFFF) = 0 to 359.999
    return Math.round((angle / 359.99) * 0xFFFF);
  }

  static angleToElevationCounts(angle) {
    // Convert angle to counts with sign bit
    const absCount = Math.round((Math.abs(angle) / 90.0) * 0x7FFF);
    return angle >= 0 ? absCount : (0xFFFF - absCount + 1); // 2's complement for negative
  }

  // Calculate checksum (XOR of all bytes from length to before checksum)
  static calculateChecksum(bytes) {
    return bytes.reduce((a, b) => a ^ b, 0);
  }

  // Create position command buffer
  static createPositionCommand(azimuth, elevation) {
    const azCounts = this.angleToAzimuthCounts(azimuth);
    const elCounts = this.angleToElevationCounts(elevation);
    
    const data = [
      this.SOF,
      5,  // Data length (CC + AZ(2) + EL(2))
      this.COMMANDS.POSITION,
      (azCounts >> 8) & 0xFF,  // AZ high byte
      azCounts & 0xFF,         // AZ low byte
      (elCounts >> 8) & 0xFF,  // EL high byte
      elCounts & 0xFF          // EL low byte
    ];
    
    const checksum = this.calculateChecksum(data.slice(1));
    return new Uint8Array([...data, checksum, this.EOF]);
  }

  // Create inch command buffer
  static createInchCommand(axis, startAngle, endAngle, stepSize, continuous = false) {
    const commandCode = axis === 'AZ' ? this.COMMANDS.INCH_AZ : this.COMMANDS.INCH_EL;
    const startCounts = axis === 'AZ' ? 
      this.angleToAzimuthCounts(startAngle) : 
      this.angleToElevationCounts(startAngle);
    const endCounts = axis === 'AZ' ? 
      this.angleToAzimuthCounts(endAngle) : 
      this.angleToElevationCounts(endAngle);
    const stepCounts = this.angleToElevationCounts(stepSize);
    
    const data = [
      this.SOF,
      7,  // Data length
      commandCode,
      (startCounts >> 8) & 0xFF,
      startCounts & 0xFF,
      (endCounts >> 8) & 0xFF,
      endCounts & 0xFF,
      (stepCounts >> 8) & 0xFF,
      stepCounts & 0xFF,
      continuous ? 0xAA : 0x55  // Continuous or one-time
    ];
    
    const checksum = this.calculateChecksum(data.slice(1));
    return new Uint8Array([...data, checksum, this.EOF]);
  }

  // Create simple command buffer (STANDBY, BIT, STOP)
  static createSimpleCommand(command) {
    const data = [
      this.SOF,
      1,  // Data length
      command
    ];
    
    const checksum = this.calculateChecksum(data.slice(1));
    return new Uint8Array([...data, checksum, this.EOF]);
  }

  // Parse feedback from SCU
  static parseFeedback(data) {
    if (data[0] !== this.SOF || data[data.length - 1] !== this.EOF) {
      throw new Error('Invalid frame');
    }

    const azCounts = (data[4] << 8) | data[5];
    const elCounts = (data[6] << 8) | data[7];
    
    return {
      azimuth: (azCounts / 0xFFFF) * 359.99,
      elevation: ((elCounts & 0x7FFF) / 0x7FFF) * 90 * (elCounts & 0x8000 ? -1 : 1),
      status: {
        commandChecksum: !!(data[3] & 0x01),
        commandReceived: !!(data[3] & 0x02),
        readyToOperate: !!(data[3] & 0x04),
        azStowLock: !!(data[3] & 0x08),
        elStowLock: !!(data[3] & 0x10),
        mode: (data[3] >> 6) & 0x03
      },
      health: {
        azEncoder: !!(data[8] & 0x01),
        elEncoder: !!(data[8] & 0x02),
        azAmplifier: !!(data[8] & 0x04),
        elAmplifier: !!(data[8] & 0x08),
        azPosLimit: !!(data[8] & 0x10),
        azNegLimit: !!(data[8] & 0x20),
        elPosLimit: !!(data[8] & 0x40),
        elNegLimit: !!(data[8] & 0x80)
      }
    };
  }
}