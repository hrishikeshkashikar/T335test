export const calculateChecksum = (data) => {
    return data.reduce((acc, byte) => acc ^ byte, 0);
  };
  
  export const convertAngleToBytes = (angle, isElevation = false) => {
    if (isElevation) {
      // For elevation (-90 to +90 degrees)
      const maxAngle = 90.0;
      const isNegative = angle < 0;
      const absoluteAngle = Math.abs(angle);
      let count = Math.round((absoluteAngle / maxAngle) * 0x7FFF);
      
      if (isNegative) {
        // Take 2's complement for negative angles
        count = (~count + 1) & 0xFFFF;
      }
      return [(count >> 8) & 0xFF, count & 0xFF];
    } else {
      // For azimuth (0 to 359.99 degrees)
      const count = Math.round((angle / 359.99) * 0xFFFF);
      return [(count >> 8) & 0xFF, count & 0xFF];
    }
  };
  
  export const convertBytesToAngle = (highByte, lowByte, isElevation = false) => {
    if (isElevation) {
      let value = (highByte << 8) | lowByte;
      const isNegative = (value & 0x8000) !== 0;
      
      if (isNegative) {
        value = -(((~value + 1) & 0xFFFF) & 0x7FFF);
      } else {
        value = value & 0x7FFF;
      }
      
      return (value * 90.0) / 0x7FFF;
    } else {
      const value = (highByte << 8) | lowByte;
      return (value * 359.99) / 0xFFFF;
    }
  };