import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ServoProtocol } from '../services/ServoProtocol';
import { WebSocketService } from '../services/WebSocketService';

const ServoController = () => {
  const [wsService] = useState(() => new WebSocketService());
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState('POSITION');
  const [azPosition, setAzPosition] = useState('');
  const [elPosition, setElPosition] = useState('');
  const [selectedAxis, setSelectedAxis] = useState('AZ');
  const [startPosition, setStartPosition] = useState('');
  const [endPosition, setEndPosition] = useState('');
  const [stepSize, setStepSize] = useState('');
  const [dwellTime, setDwellTime] = useState('');
  const [continuous, setContinuous] = useState(false);
  const [messageToDevice, setMessageToDevice] = useState('');
  const [messageFromDevice, setMessageFromDevice] = useState('');
  
  const handleInputChange = (setter) => (e) => {
    const value = e.target.value;
    
    // Allow empty string or values that match the pattern
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };
  
  const bufferToHexString = (buffer) => {
    return Array.from(buffer)
      .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  };

  const handleNumericInput = (value, setter) => {
    // Allow empty string, minus sign, decimal point, and numbers
    if (value === '' || value === '-' || value === '.' || /^-?\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };
  const [feedback, setFeedback] = useState({
    currentPosition: { az: 0, el: 0 },
    setVelocity: { az: 0, el: 0 },
    azZeroOffset: { az: 0, el: '-' }
  });
  
  const [status, setStatus] = useState({
    ready: false,
    checksum: false,
    commandValidity: false,
    emergencyStop: true,
    encoder: { az: false, el: false },
    amplifier: { az: false, el: false },
    posLimit: { az: false, el: false },
    negLimit: { az: false, el: false },
    stowLock: { az: false, el: false }
  });

  useEffect(() => {
    return () => {
      if (wsService) {
        wsService.disconnect();
      }
    };
  }, [wsService]);


  const handleConnect = async () => {
    try {
      await wsService.connect(ipAddress, port);
      setConnected(true);
      
      wsService.setCallbacks({
        onDisconnect: () => {
          setConnected(false);
          setMessageFromDevice('Disconnected from device');
        },
        onFeedback: (feedback) => {
          setFeedback({
            currentPosition: {
              az: feedback.azimuth.toFixed(2),
              el: feedback.elevation.toFixed(2)
            },
            setVelocity: { az: 0, el: 0 },
            azZeroOffset: { az: 0, el: '-' }
          });
          
          setStatus({
            ready: feedback.status.readyToOperate,
            checksum: feedback.status.commandChecksum,
            commandValidity: feedback.status.commandReceived,
            emergencyStop: feedback.status.mode === 0,
            encoder: {
              az: feedback.health.azEncoder,
              el: feedback.health.elEncoder
            },
            amplifier: {
              az: feedback.health.azAmplifier,
              el: feedback.health.elAmplifier
            },
            posLimit: {
              az: feedback.health.azPosLimit,
              el: feedback.health.elPosLimit
            },
            negLimit: {
              az: feedback.health.azNegLimit,
              el: feedback.health.elNegLimit
            },
            stowLock: {
              az: feedback.status.azStowLock,
              el: feedback.status.elStowLock
            }
          });
          
          setMessageFromDevice(`Received feedback - AZ: ${feedback.azimuth.toFixed(2)}°, EL: ${feedback.elevation.toFixed(2)}°`);
        },
        onError: (error) => {
          console.error('WebSocket error:', error);
          setMessageFromDevice('Error: ' + error.message);
        }
      });
      
      setMessageFromDevice('Connected to device');
    } catch (error) {
      console.error('Connection failed:', error);
      setMessageFromDevice('Connection failed: ' + error.message);
    }
  };

  const clearInputs = () => {
    setAzPosition('');
    setElPosition('');
    setStartPosition('');
    setEndPosition('');
    setStepSize('');
    setDwellTime('');
    setContinuous(false);
  };

  const handleSend = () => {
    try {
      let command;
      let messageDescription = '';
      
      switch (selectedCommand) {
        case 'POSITION':
          command = ServoProtocol.createPositionCommand(
            parseFloat(azPosition),
            parseFloat(elPosition)
          );
          messageDescription = `Position command - AZ: ${azPosition}°, EL: ${elPosition}°`;
          break;
        
        case 'INCH':
          command = ServoProtocol.createInchCommand(
            selectedAxis,
            parseFloat(startPosition),
            parseFloat(endPosition),
            parseFloat(stepSize),
            continuous
          );
          messageDescription = `Inch command - ${selectedAxis} from ${startPosition}° to ${endPosition}°, step: ${stepSize}°${continuous ? ' (continuous)' : ''}`;
          break;
        
        case 'STANDBY':
          command = ServoProtocol.createSimpleCommand(ServoProtocol.COMMANDS.STANDBY);
          messageDescription = 'Standby command';
          break;
        
        case 'BITE':
          command = ServoProtocol.createSimpleCommand(ServoProtocol.COMMANDS.BIT);
          messageDescription = 'BITE command';
          break;

        case 'STOP':
          command = ServoProtocol.createSimpleCommand(ServoProtocol.COMMANDS.STOP);
          messageDescription = 'Stop command';
          break;
      }

      const hexString = bufferToHexString(command);
      
      if (!connected) {
        setMessageToDevice(`Socket not connected. Command hex: ${hexString}`);
        return;
      }

      wsService.sendCommand(command);
      setMessageToDevice(`${messageDescription} | Hex: ${hexString}`);
    } catch (error) {
      console.error('Error sending command:', error);
      setMessageToDevice('Error: ' + error.message);
    }
  };

  const handleStopButton = () => {
    try {
      const command = ServoProtocol.createSimpleCommand(ServoProtocol.COMMANDS.STOP);
      const hexString = bufferToHexString(command);
      
      if (!connected) {
        setMessageToDevice(`Socket not connected. Stop command hex: ${hexString}`);
        return;
      }

      wsService.sendCommand(command);
      setMessageToDevice(`Stop command | Hex: ${hexString}`);
    } catch (error) {
      console.error('Error sending stop command:', error);
      setMessageToDevice('Error: ' + error.message);
    }
  };

  // Component for Position/Inch command input
  const PositionInput = () => (
    <div className="space-y-4 w-full flex flex-col items-center">
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="w-12 text-base font-medium">AZ:</div>
        <input
          type="text"
          value={azPosition}
          onChange={(e) => setAzPosition(e.target.value.replace(/[^\d.-]/g, ''))}
          className="border p-2 rounded-md flex-grow text-base"
        />
        <div className="w-12 text-sm text-gray-600 text-center">DEG</div>
      </div>
      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="w-12 text-base font-medium">EL:</div>
        <input
          type="text"
          value={elPosition}
          onChange={(e) => setElPosition(e.target.value.replace(/[^\d.-]/g, ''))}
          className="border p-2 rounded-md flex-grow text-base"
        />
        <div className="w-12 text-sm text-gray-600 text-center">DEG</div>
      </div>
    </div>
  );

  // Inch Input component with improved handling
  const InchInput = () => (
    <div className="space-y-4 w-full flex flex-col items-center">
      <div className="flex justify-center w-full">
        <div className="flex gap-16">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={selectedAxis === 'AZ'}
              onChange={() => setSelectedAxis('AZ')}
              className="w-4 h-4"
            />
            <span className="text-base font-medium">AZ</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={selectedAxis === 'EL'}
              onChange={() => setSelectedAxis('EL')}
              className="w-4 h-4"
            />
            <span className="text-base font-medium">EL</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full max-w-lg">
        <div className="flex items-center gap-2">
          <div className="w-24 text-sm font-medium">START POSITION</div>
          <input
            type="text"
            value={startPosition}
            onChange={(e) => setStartPosition(e.target.value.replace(/[^\d.-]/g, ''))}
            className="border p-1.5 rounded-md w-24 text-sm"
          />
          <div className="w-8 text-xs text-gray-600">DEG</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 text-sm font-medium">END POSITION</div>
          <input
            type="text"
            value={endPosition}
            onChange={(e) => setEndPosition(e.target.value.replace(/[^\d.-]/g, ''))}
            className="border p-1.5 rounded-md w-24 text-sm"
          />
          <div className="w-8 text-xs text-gray-600">DEG</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 text-sm font-medium">STEP SIZE</div>
          <input
            type="text"
            value={stepSize}
            onChange={(e) => setStepSize(e.target.value.replace(/[^\d.-]/g, ''))}
            className="border p-1.5 rounded-md w-24 text-sm"
          />
          <div className="w-8 text-xs text-gray-600">DEG</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 text-sm font-medium">DWELL TIME</div>
          <input
            type="text"
            value={dwellTime}
            onChange={(e) => setDwellTime(e.target.value.replace(/[^\d.-]/g, ''))}
            className="border p-1.5 rounded-md w-24 text-sm"
          />
          <div className="w-8 text-xs text-gray-600">SEC</div>
        </div>
      </div>

      <div className="flex items-center justify-center mt-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={continuous}
            onChange={(e) => setContinuous(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">CONTINUOUS</span>
        </label>
      </div>
    </div>
  );


  const ActionButtons = () => (
    <div className="flex gap-4">
      <button 
        onClick={handleSend} 
        className="bg-green-500 hover:bg-green-600 text-white px-8 py-2 rounded-md text-base"
      >
        Send
      </button>
      <button 
        onClick={clearInputs}
        className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-2 rounded-md text-base"
      >
        Cancel
      </button>
    </div>
  );

  return (
    <div className="bg-gray-400 h-screen flex justify-center items-top">
      <div className="max-w-full mx-auto space-y-4 px-4 pt-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold">Two Axis (150kg)</h1>
          <button className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-base">2 Axis</button>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* First Row */}
          <div className="col-span-8 grid grid-cols-8 gap-4">
            {/* Connection Card */}
            <Card className="col-span-3 bg-white shadow-lg">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="text-base font-bold mb-3">CONNECTION</div>
                  <input
                    type="text"
                    placeholder="IP*"
                    className="border p-2 rounded-md w-full text-base mb-2"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="PORT*"
                    className="border p-2 rounded-md w-full text-base mb-2"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                  <button
                    onClick={handleConnect}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md w-full text-base"
                  >
                    Connect
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Card */}
            <Card className="col-span-5 bg-white shadow-md">
              <CardContent className="p-3">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-base font-bold">FEEDBACK</div>
                    <div className="flex gap-2">
                      <button className="bg-gray-200 hover:bg-gray-300 px-3 py-0.5 rounded-md text-sm">ACK</button>
                      <button className="bg-gray-200 hover:bg-gray-300 px-3 py-0.5 rounded-md text-sm">NACK</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                    <div></div>
                    <div className="text-center font-medium">AZ</div>
                    <div className="text-center font-medium">EL</div>
                    <div className="text-center font-medium">UNIT</div>
                    
                    <div>CURRENT POSITION</div>
                    <div className="text-center">{feedback.currentPosition.az}</div>
                    <div className="text-center">{feedback.currentPosition.el}</div>
                    <div className="text-center text-gray-600">DEG</div>
                    
                    <div>SET VELOCITY</div>
                    <div className="text-center">{feedback.setVelocity.az}</div>
                    <div className="text-center">{feedback.setVelocity.el}</div>
                    <div className="text-center text-gray-600">DEG/SEC</div>
                    
                    <div>AZ ZERO OFFSET</div>
                    <div className="text-center">{feedback.azZeroOffset.az}</div>
                    <div className="text-center">{feedback.azZeroOffset.el}</div>
                    <div className="text-center text-gray-600">DEG</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Card - Full Height */}
          <Card className="col-span-4 bg-white shadow-md row-span-2">
            <CardContent className="p-4">
              <div className="h-full flex flex-col">
                <div className="text-base font-bold mb-4">STATUS</div>
                <div className="space-y-3 mb-6">
                  {[
                    ['READY TO OPERATE', status.ready],
                    ['CHECKSUM', status.checksum],
                    ['COMMAND VALIDITY', status.commandValidity],
                    ['EMERGENCY STOP', status.emergencyStop]
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center bg-gray-50 p-2 rounded-md text-sm">
                      <span>{label}</span>
                      <span className={`h-3 w-3 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div></div>
                  <div className="text-center text-base">AZ</div>
                  <div className="text-center text-base">EL</div>
                  
                  {[
                    ['ENCODER', status.encoder],
                    ['AMPLIFIER', status.amplifier],
                    ['POS LIMIT', status.posLimit],
                    ['NEG LIMIT', status.negLimit],
                    ['STOW LOCK', status.stowLock]
                  ].map(([label, values]) => (
                    <React.Fragment key={label}>
                      <div className="text-base">{label}</div>
                      <div className="text-center">
                        <span className={`inline-block h-3 w-3 rounded-full ${values.az ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      </div>
                      <div className="text-center">
                        <span className={`inline-block h-3 w-3 rounded-full ${values.el ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Second Row - Commands */}
          <div className="col-span-8 grid grid-cols-8 gap-4">
            {/* Commands Card */}
            <Card className="col-span-3 bg-white shadow-lg">
    <CardContent className="p-4">
      <div>
        <div className="text-base font-bold mb-3">COMMAND</div>
        <div className="space-y-2">
          {['POSITION', 'STANDBY', 'BITE', 'INCH'].map((command) => (
            <label 
              key={command} 
              className={`flex items-center p-2 rounded-md cursor-pointer text-base bg-gray-50 shadow-sm
                ${selectedCommand === command ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
            >
              <input
                type="radio"
                checked={selectedCommand === command}
                onChange={() => setSelectedCommand(command)}
                className="mr-2"
              />
              <span>{command}</span>
            </label>
          ))}
        </div>
        <button 
          onClick={handleStopButton}
          className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded-md text-base mt-4"
        >
          Stop
        </button>
      </div>
    </CardContent>
  </Card>

            {/* Command Input Card */}
            <Card className="col-span-5 bg-white shadow-md">
  <CardContent className="p-4 h-full">
    <div className="text-base font-bold mb-4">{selectedCommand}</div>
    <div className="flex flex-col h-[calc(100%-2rem)]">
      {selectedCommand === 'POSITION' && (
        <div className="flex-grow flex flex-col justify-center items-center space-y-6">
          <PositionInput />
          <ActionButtons />
        </div>
      )}
      {selectedCommand === 'INCH' && (
        <div className="flex-grow flex flex-col justify-center items-center space-y-6">
          <InchInput />
          <ActionButtons />
        </div>
      )}
      {(selectedCommand === 'STANDBY' || selectedCommand === 'BITE') && (
        <div className="flex-grow flex items-center justify-center">
          <ActionButtons />
        </div>
      )}
    </div>
  </CardContent>
</Card>
          </div>
        </div>

        {/* Message Log */}
        <Card className="bg-white shadow-md">
    <CardContent className="p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-base font-medium mb-2">MESSAGE FROM DEVICE:</div>
          <div className="h-8 bg-gray-50 rounded-md p-2 text-sm overflow-x-auto whitespace-nowrap">
            {messageFromDevice}
          </div>
        </div>
        <div>
          <div className="text-base font-medium mb-2">MESSAGE TO DEVICE:</div>
          <div className="h-8 bg-gray-50 rounded-md p-2 text-sm overflow-x-auto whitespace-nowrap">
            {messageToDevice}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
      </div>
    </div>
  );
};

export default ServoController;