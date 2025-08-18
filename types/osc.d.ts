// types/osc.d.ts
declare module "osc" {
  // Options for the UDPPort constructor
  interface UDPPortOptions {
    localAddress?: string;
    localPort?: number;
    remoteAddress?: string;
    remotePort?: number;
    metadata?: boolean;
    broadcast?: boolean;
  }

  // OSC argument (when metadata:true, osc sends typed args)
  interface OSCArgument {
    type?: "i" | "f" | "s" | "b" | string;
    value: any;
  }

  // OSC message shape
  interface OSCMessage {
    address: string;
    args?: OSCArgument[] | any[];
  }

  type MessageHandler = (oscMsg: OSCMessage, timeTag?: any, info?: any) => void;

  class UDPPort {
    constructor(options: UDPPortOptions);
    open(): void;
    close(): void;
    send?(message: OSCMessage, address?: string, port?: number): void;

    on(event: "ready", listener: () => void): this;
    on(event: "message", listener: MessageHandler): this;
    on(event: "error", listener: (error: any) => void): this;
  }

  // CommonJS default export with properties (matches osc package shape)
  const _default: { UDPPort: typeof UDPPort };
  export default _default;

  // Also re-export named class for convenience
  export { UDPPort, UDPPortOptions, OSCMessage, OSCArgument };
}