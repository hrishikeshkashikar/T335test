import { ServoProtocol } from './ServoProtocol';

export class WebSocketService {
  constructor() {
    this.socket = null;
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onFeedback: null,
      onError: null
    };
  }

  connect(ipAddress, port) {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`ws://${ipAddress}:${port}`);
        
        this.socket.onopen = () => {
          if (this.callbacks.onConnect) this.callbacks.onConnect();
          resolve();
        };

        this.socket.onclose = () => {
          if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
        };

        this.socket.onerror = (error) => {
          if (this.callbacks.onError) this.callbacks.onError(error);
          reject(error);
        };

        this.socket.onmessage = (event) => {
          if (this.callbacks.onFeedback) {
            try {
              const data = new Uint8Array(event.data);
              const feedback = ServoProtocol.parseFeedback(data);
              this.callbacks.onFeedback(feedback);
            } catch (error) {
              console.error('Error parsing feedback:', error);
            }
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendCommand(command) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not connected');
    }
    this.socket.send(command);
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}