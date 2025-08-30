import * as net from 'net';

/**
 * Data types supported by Danfoss Air parameters
 */
export type DataType = 'byte' | 'bool' | 'ushort' | 'uint' | 'string';

/**
 * Interface for a Danfoss Air data parameter
 */
export interface DanfossParam {
  name: string;
  unit: string;
  endpoint: number;
  address: number;
  datatype: DataType;
  scale: number;
  precision: number | string;
  value: number | boolean;
  valuetimestamp: number;
}

/**
 * Simplified parameter data for callback functions
 */
export interface ParamData {
  name: string;
  unit: string;
  value: number | boolean;
}

/**
 * Callback function type for receiving data updates
 */
export type CallbackFunction = (data: ParamData[]) => void;

/**
 * Options for initializing the Danfoss Air connection
 */
export interface DanfossAirOptions {
  ip: string;
  delaySeconds: number;
  debug?: boolean;
  callbackFunction: CallbackFunction;
}

/**
 * Main class for handling communication with a Danfoss Air device
 */
export class DanfossAir {
  private ip: string;
  private delaySeconds: number;
  private debug: boolean;
  private callbackFunction: CallbackFunction;
  private dataParams: DanfossParam[];
  private timeout: NodeJS.Timeout | null = null;
  private socket: net.Socket;
  private activeParam?: DanfossParam;
  private activePromise?: Promise<void>;
  private activePromiseResolve?: () => void;
  private activePromiseReject?: () => void;
  private activeTimeout?: NodeJS.Timeout;

  constructor(options: DanfossAirOptions) {
    this.ip = options.ip;
    this.delaySeconds = options.delaySeconds;
    this.debug = options.debug || false;
    this.callbackFunction = options.callbackFunction;
    this.dataParams = this.initDataParams();

    this.socket = new net.Socket();
    this.setupSocket();

    console.log(`initialized dfair_io using ip: ${this.ip}`);
  }

  private setupSocket(): void {
    this.socket.connect({ host: this.ip, port: 30046 });

    this.socket.on('data', (payload: Buffer) => {
      if (this.debug) {
        console.log(`Data received: ${payload} size: ${payload.length}`);
      }
      this.processIncomingData(payload);
    });

    this.socket.on('connect', () => {
      console.log('Connected');
      this.sanityCheck();
    });

    this.socket.on('end', (e: any) => {
      console.log(`end: ${e}`);
    });

    this.socket.on('error', (err: Error) => {
      console.log(`Error: ${err}`);
      this.cleanup();
    });
  }

  private sanityCheck(): void {
    // TODO consider checking that we have a sensible Danfoss Air controller in the other end
    console.log('Sanity passed');
    this.timeout = setTimeout(() => {
      this.refreshData();
    }, this.delaySeconds * 1000);
  }

  public cleanup(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
    }
    if (this.socket) {
      this.socket.destroy();
    }
  }

  private buildParam(
    name: string,
    unit: string,
    endpoint: number,
    address: number,
    datatype: DataType,
    scale: number,
    precision: number | string
  ): DanfossParam {
    return {
      name,
      unit,
      endpoint,
      address,
      datatype,
      scale,
      precision,
      value: -1111,
      valuetimestamp: 0
    };
  }

  private initDataParams(): DanfossParam[] {
    const params: DanfossParam[] = [];
    
    params.push(
      this.buildParam(
        'relative humidity measured',
        '%',
        4,
        5232,
        'byte',
        100 / 255,
        1
      )
    );
    
    params.push(
      this.buildParam('Actual Supply Fan Speed', 'rpm', 4, 5200, 'ushort', 1, '')
    );
    
    params.push(
      this.buildParam('Actual Extract Fan Speed', 'rpm', 4, 5201, 'ushort', 1, '')
    );
    
    params.push(
      this.buildParam('Total running minutes', 'min', 4, 992, 'uint', 1, '')
    );
    
    params.push(
      this.buildParam('Battery Indication Percent', '%', 4, 783, 'byte', 100/255, 1)
    );
    
    params.push(
      this.buildParam('Filter Fouling', '%', 4, 5226, 'byte', 100/255, 1)
    );
    
    params.push(
      this.buildParam('Outdoor Temperature', 'c', 4, 830, 'uint', 1, 1)
    );

    params.push(
      this.buildParam('Boost', '', 4, 5424, 'bool', 1, '')
    );
    
    params.push(
      this.buildParam('Defrost status', '', 4, 5617, 'bool', 1, '')
    );

    params.push(
      this.buildParam('Temperature 1', 'c', 4, 5234, 'ushort', 0.01, '')
    );
    
    params.push(
      this.buildParam('Temperature 3', 'c', 4, 5235, 'ushort', 0.01, '')
    );
    
    params.push(
      this.buildParam('Temperature 3', 'c', 4, 5236, 'ushort', 0.01, '')
    );
    
    params.push(
      this.buildParam('Temperature 4', 'c', 4, 5237, 'ushort', 0.01, '')
    );

    params.push(
      this.buildParam('Unit Hardware Revision', '', 4, 34, 'ushort', 1, '')
    );
    
    params.push(
      this.buildParam('Unit Hardware Revision', '', 4, 35, 'ushort', 1, '')
    );
    
    params.push(
      this.buildParam('Unit SerialNumber High Word', '', 4, 36, 'ushort', 1, '')
    );
    
    params.push(
      this.buildParam('Unit SerialNumber Low Word', '', 4, 37, 'ushort', 1, '')
    );

    return params;
  }

  public debugDumpData(): void {
    console.log('--------------------------------');
    for (const param of this.dataParams) {
      console.log(`${param.name} ${param.value}`);
    }
  }

  private refreshData(): void {
    this.refreshDataAsync().then(() => {
      this.timeout = setTimeout(() => {
        this.refreshData();
        if (this.debug) {
          this.debugDumpData();
        }

        // Create a clean set of outputs
        const data: ParamData[] = [];
        for (const param of this.dataParams) {
          data.push({
            name: param.name,
            unit: param.unit,
            value: param.value
          });
        }

        this.callbackFunction(data);
      }, this.delaySeconds * 1000);
    });
  }

  private async refreshDataAsync(): Promise<void> {
    console.log('ArefreshData');
    console.log('Refreshing data');
    
    const timestampBegin = Date.now();

    for (const param of this.dataParams) {
      if (this.debug) {
        console.log(`Start read of param: ${param.name}`);
      }
      await this.operationReadValue(param);
      await this.sleep(100);
      if (this.debug) {
        console.log(`processed parameter: ${param.name}`);
      }
    }

    const millis = Date.now() - timestampBegin;
    if (this.debug) {
      console.log(`Refresh took: ${millis} milliseconds`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private activeOperationTimeout(): void {
    console.log('activeOperationTimeout');
    if (this.activePromiseReject) {
      this.activePromiseReject();
    }
  }

  private async operationReadValue(param: DanfossParam): Promise<void> {
    this.activeParam = param;

    this.activePromise = new Promise<void>((resolve, reject) => {
      this.activePromiseResolve = resolve;
      this.activePromiseReject = reject;
    });

    // Build and read frame
    const buffer = Buffer.alloc(63, 0);
    buffer[0] = param.endpoint;
    buffer[1] = 4; // read
    buffer.writeUint16BE(param.address, 2);

    this.socket.write(new Uint8Array(buffer));

    this.activeTimeout = setTimeout(() => {
      this.activeOperationTimeout();
    }, 3000);
    
    return this.activePromise;
  }

  public operationWriteValue(param: DanfossParam, value: number | boolean): void {
    // TODO - where did the ol' write operations code go?
    throw new Error('Write operations not yet implemented');
  }

  private processIncomingData(payload: Buffer): void {
    if (!this.activeParam) {
      return;
    }

    // Determine if the data is for the current packet
    switch (this.activeParam.datatype) {
      case 'byte':
        this.activeParam.value = payload[0];
        break;
      case 'bool':
        this.activeParam.value = payload[0] === 1;
        break;
      case 'ushort':
        this.activeParam.value = payload.readUInt16BE();
        break;
      case 'uint':
        this.activeParam.value = payload.readUInt32BE();
        break;
      case 'string':
        throw new Error('string datatype not handled properly TODO');
      default:
        throw new Error(`unhandled datatype: ${this.activeParam.datatype}`);
    }

    if (typeof this.activeParam.value === 'number') {
      this.activeParam.value *= this.activeParam.scale;
      
      if (this.activeParam.precision !== '') {
        this.activeParam.value = round(
          this.activeParam.value,
          Number(this.activeParam.precision)
        );
      }
    }

    // Clear timeout
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = undefined;
    }
    
    if (this.activePromiseResolve) {
      this.activePromiseResolve();
    }
  }
}

/**
 * Initialize a new Danfoss Air connection
 * @param ip IP address of the Danfoss Air unit
 * @param delaySeconds Delay between data refreshes in seconds
 * @param debug Enable debug logging
 * @param callbackFunction Function to call with updated data
 * @returns DanfossAir instance
 */
export function init(
  ip: string,
  delaySeconds: number,
  debug: boolean,
  callbackFunction: CallbackFunction
): DanfossAir {
  if (delaySeconds < 3) {
    console.log(
      'Consider - why do you need such fast readings? Every 30 seconds should be just fine for a ventilation system'
    );
  }

  return new DanfossAir({
    ip,
    delaySeconds,
    debug,
    callbackFunction
  });
}

/**
 * Round a number to specified precision
 * @param value Number to round
 * @param precision Number of decimal places
 * @returns Rounded number
 */
function round(value: number, precision: number): number {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

// Default export for CommonJS compatibility
export default { init, DanfossAir };