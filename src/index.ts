import * as net from 'net';

/**
 * Data types supported by Danfoss Air parameters
 */
export type DataType = 'byte' | 'bool' | 'ushort' | 'uint' | 'string';

/**
 * Interface for a Danfoss Air data parameter
 */
export interface DanfossParam {
  id: string;
  name: string;
  unit: string;
  endpoint: number;
  address: number;
  datatype: DataType;
  scale: number;
  precision: number | string;
  value: number | boolean;
  valuetimestamp: number;
  interval: number | undefined;
}

/**
 * Simplified parameter data for callback functions
 */
export interface ParamData {
  id: string;
  name: string;
  unit: string;
  value: number | boolean;
}

/**
 * Callback function type for receiving data updates
 */
export type CallbackFunction = (data: ParamData[]) => void;

export type SingleCallbackFunction = (data: ParamData) => void;

/**
 * Callback function type for handling write operation errors
 */
export type WriteErrorCallbackFunction = (error: Error) => void;

/**
 * Options for initializing the Danfoss Air connection
 */
export interface DanfossAirOptions {
  ip: string;
  delaySeconds: number;
  debug?: boolean;
  callbackFunction?: CallbackFunction;
  singleCallbackFunction?: SingleCallbackFunction;
  writeErrorCallback?: WriteErrorCallbackFunction;
}

/**
 * Main class for handling communication with a Danfoss Air device
 */
export class DanfossAir {
  private ip: string;
  private delaySeconds: number;
  private debug: boolean;
  private callbackFunction?: CallbackFunction;
  private singleCallbackFunction?: SingleCallbackFunction;
  private writeErrorCallback?: WriteErrorCallbackFunction;
  private dataParams: DanfossParam[];
  private timeout: NodeJS.Timeout | null = null;
  private socket: net.Socket | null = null;
  private activeParam?: DanfossParam;
  private activePromise?: Promise<void>;
  private activePromiseResolve?: () => void;
  private activePromiseReject?: () => void;
  private activeTimeout?: NodeJS.Timeout;

  private cycle: number;
  private step: number;
  private writeBuffer: Buffer[] = [];

  constructor(options: DanfossAirOptions) {
    this.ip = options.ip;
    this.debug = options.debug || false;
    this.callbackFunction = options.callbackFunction;
    this.singleCallbackFunction = options.singleCallbackFunction;
    this.writeErrorCallback = options.writeErrorCallback;
    this.dataParams = this.initDataParams();

    // Find common cycle for all intervals
    const intervals = this.dataParams.filter(param => (param.interval || options.delaySeconds) > 0).map(param => param.interval || options.delaySeconds as number);
    this.cycle = intervals.reduce((acc, val) => this.lcm(acc, val), intervals.length > 0 ? intervals[0] : options.delaySeconds);
    this.step = intervals.reduce((acc, val) => this.gcd(acc, val), intervals.length > 0 ? intervals[0] : options.delaySeconds);

    this.delaySeconds = Math.max(options.delaySeconds, this.step);
    this.log(`initialized dfair_io using ip: ${this.ip}`);
    this.log(`calculated cycle: ${this.cycle} seconds, step: ${this.step} seconds, using delay: ${this.delaySeconds} seconds`);
  }

  private gcd(a: number, b: number): number {
    this.log(`gcd ${a} ${b}`);
    if (isNaN(a)) {
      throw new Error(`Invalid number: ${a}`);
    }
    const mod = a % b;
    if (b === mod) {
      return 1;
    }

    return b === 0 ? a : this.gcd(b, mod);
  }
  private lcm(a: number, b: number): number {
    return (a * b) / this.gcd(a, b);
  }

  private setupSocket(): void {
    this.socket = new net.Socket();
    this.socket.connect({ host: this.ip, port: 30046 });

    this.socket.on('data', (payload: Buffer) => {
      this.log(`Data received: ${payload} size: ${payload.length}`);
      this.processIncomingData(payload);
    });

    this.socket.on('connect', () => {
      this.log('Connected');
      this.sanityCheck();
    });

    this.socket.on('end', (e: any) => {
      this.log(`end: ${e}`);
    });

    this.socket.on('error', (err: Error) => {
      this.log(`Error: ${err}`);
      this.cleanup();
    });
  }

  public start(): void {
    this.setupSocket();

    if (this.socket) {
      this.socket.destroy();
      this.timeout = setTimeout(() => {
        this.refreshData();
      }, 500);
    }
  }

  private sanityCheck(): void {
    // TODO consider checking that we have a sensible Danfoss Air controller in the other end
    this.log('Sanity passed');

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
    id: string,
    name: string,
    unit: string,
    endpoint: number,
    address: number,
    datatype: DataType,
    scale: number,
    precision: number | string,
    interval?: number
  ): DanfossParam {
    return {
      id,
      name,
      unit,
      endpoint,
      address,
      datatype,
      scale,
      precision,
      value: -1111,
      valuetimestamp: 0,
      interval: interval
    };
  }

  private initDataParams(): DanfossParam[] {
    const params: DanfossParam[] = [];

    params.push(
      this.buildParam(
        'humidity_measured_relative',
        'relative humidity measured',
        '%',
        4,
        5232,
        'byte',
        100 / 255,
        1,
        60
      )
    );

    params.push(
      this.buildParam('fanspeed_supply_actual', 'Actual Supply Fan Speed', 'rpm', 4, 5200, 'ushort', 1, '')
    );

    params.push(
      this.buildParam('fanspeed_extract_actual', 'Actual Extract Fan Speed', 'rpm', 4, 5201, 'ushort', 1, '')
    );

    params.push(
      this.buildParam('total_running_minutes', 'Total running minutes', 'min', 4, 992, 'uint', 1, '', 60)
    );

    params.push(
      this.buildParam('battery_indication_percent', 'Battery Indication Percent', '%', 4, 783, 'byte', 100 / 255, 1, 120)
    );

    params.push(
      this.buildParam('filter_remaining', 'Filter Remaining', '%', 1, 0x146a, 'byte', 100 / 255, 1, 60)
    );

    params.push(
      this.buildParam('temperature_room', 'Room Temperature', 'c', 1, 0x0300, 'ushort', 0.01, 1, 120)
    );

    params.push(
      this.buildParam('temperature_room_calc', 'Calculated Room Temperature', 'c', 0, 0x1496, 'ushort', 0.01, 1, 120)
    );

    params.push(
      this.buildParam('boost', 'Boost', '', 1, 5424, 'bool', 1, '')
    );

    // Add more writable parameters based on Python implementation
    params.push(
      this.buildParam('bypass', 'Bypass', '', 1, 0x1460, 'bool', 1, '', 60)
    );

    params.push(
      this.buildParam('automatic_bypass', 'Automatic Bypass', '', 1, 0x1706, 'bool', 1, '', 60)
    );

    params.push(
      this.buildParam('operation_mode', 'Operation Mode', '', 1, 0x1412, 'byte', 1, '')
    );

    params.push(
      this.buildParam('fan_step', 'Fan Step', '', 1, 0x1561, 'byte', 1, '')
    );

    params.push(
      this.buildParam('defrost_status', 'Defrost status', '', 4, 5617, 'bool', 1, '', 60)
    );

    params.push(
      this.buildParam('temperature_outdoor', 'Temperature 1', 'c', 4, 0x1472, 'ushort', 0.01, '', 60)
    );

    params.push(
      this.buildParam('temperature_supply', 'Temperature 2', 'c', 4, 0x1473, 'ushort', 0.01, '', 60)
    );

    params.push(
      this.buildParam('temperature_extract', 'Temperature 3', 'c', 4, 0x1474, 'ushort', 0.01, '', 60)
    );

    params.push(
      this.buildParam('temperature_exhaust', 'Temperature 4', 'c', 4, 0x1475, 'ushort', 0.01, '', 60)
    );

    params.push(
      this.buildParam('unit_hardware_revision', 'Unit Hardware Revision', '', 4, 34, 'ushort', 1, '', 0)
    );

    params.push(
      this.buildParam('unit_software_revision', 'Unit Software Revision', '', 4, 35, 'ushort', 1, '', 0)
    );

    params.push(
      this.buildParam('unit_serialnumber_high_word', 'Unit SerialNumber High Word', '', 4, 36, 'ushort', 1, '', 0)
    );

    params.push(
      this.buildParam('unit_serialnumber_low_word', 'Unit SerialNumber Low Word', '', 4, 37, 'ushort', 1, '', 0)
    );

    return params;
  }

  /**
   * Get a parameter by its ID
   */
  public getParameter(id: string): DanfossParam | undefined {
    return this.dataParams.find(param => param.id === id);
  }

  /**
   * Check if a parameter supports write operations
   */
  public isWritableParameter(id: string): boolean {
    const writableParams = ['boost', 'bypass', 'automatic_bypass', 'operation_mode', 'fan_step'];
    return writableParams.includes(id);
  }

  /**
   * Write a value to a parameter by ID
   */
  public async writeParameterValue(id: string, value: number | boolean): Promise<void> {
    const param = this.getParameter(id);
    if (!param) {
      throw new Error(`Parameter '${id}' not found`);
    }
    
    if (!this.isWritableParameter(id)) {
      throw new Error(`Parameter '${id}' is not writable`);
    }

    return new Promise<void>((resolve, reject) => {
      try {
        this.queueWriteOperation(param, value);
        // Update local value immediately for optimistic updates
        param.value = value;
        param.valuetimestamp = Date.now();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }


  /**
   * Convenience method to set operation mode
   */
  public async setMode(mode: number): Promise<void> {
    if (mode < 0 || mode > 2) {
      throw new Error('Operation mode must be between 0 and 2');
    }
    await this.writeParameterValue('operation_mode', mode);
  }

  /**
   * Convenience method to activate boost mode
   */
  public async activateBoost(): Promise<void> {
    await this.writeParameterValue('boost', true);
  }

  /**
   * Convenience method to deactivate boost mode
   */
  public async deactivateBoost(): Promise<void> {
    await this.writeParameterValue('boost', false);
  }

  /**
   * Convenience method to set fan step (1-10)
   */
  public async setFanStep(step: number): Promise<void> {
    if (step < 1 || step > 10) {
      throw new Error('Fan step must be between 1 and 10');
    }
    await this.writeParameterValue('fan_step', step);
  }

  /**
   * Queue a write operation to be sent during the next refresh cycle
   */
  private queueWriteOperation(param: DanfossParam, value: number | boolean): void {
    // Build write frame
    const buffer = Buffer.alloc(63, 0);
    buffer[0] = param.endpoint;
    buffer[1] = 6; // write operation
    buffer.writeUint16BE(param.address, 2);

    // Encode value based on parameter datatype
    let writeValue = value;
    if (typeof value === 'number' && param.scale !== 1) {
      // Reverse the scaling for writing
      writeValue = Math.round(value / param.scale);
    }

    // Write the value according to datatype
    switch (param.datatype) {
      case 'bool':
        buffer[4] = typeof value === 'boolean' ? (value ? 1 : 0) : (value ? 1 : 0);
        break;
      case 'byte':
        if (typeof writeValue === 'number') {
          buffer[4] = writeValue & 0xFF;
        } else {
          throw new Error('Byte parameter requires numeric value');
        }
        break;
      case 'ushort':
        if (typeof writeValue === 'number') {
          buffer.writeUint16BE(writeValue & 0xFFFF, 4);
        } else {
          throw new Error('UShort parameter requires numeric value');
        }
        break;
      case 'uint':
        if (typeof writeValue === 'number') {
          buffer.writeUint32BE(writeValue >>> 0, 4);
        } else {
          throw new Error('UInt parameter requires numeric value');
        }
        break;
      default:
        throw new Error(`Write operation not supported for datatype: ${param.datatype}`);
    }

    this.writeBuffer.push(buffer);
    
    this.log(`Queued write operation for ${param.name} with value ${value}`);
  }

  /**
   * Flush all pending write operations to the socket
   */
  private async flushWriteBuffer(): Promise<void> {
    if (this.writeBuffer.length === 0) {
      return;
    }

    this.log(`Flushing ${this.writeBuffer.length} write operations`);
    
    try {
      for (const buffer of this.writeBuffer) {
        if (!this.socket) {
          throw new Error('Socket not initialized');
        }
        this.socket.write(new Uint8Array(buffer));
        await this.sleep(100); // Small delay between write operations
      }
      
      this.log('Write buffer flushed successfully');
    } catch (error) {
      // Use error callback to report write failures
      if (this.writeErrorCallback) {
        this.writeErrorCallback(error as Error);
      } else {
        this.log(`Write operation failed: ${error}`);
      }
    } finally {
      // Clear buffer
      this.writeBuffer = [];
    }
  }

  public debugDumpData(): void {
    this.log('--------------------------------');
    for (const param of this.dataParams) {
      this.log(`${param.name} ${param.value}`);
    }
  }

  private refreshData(): void {
    this.refreshDataAsync().then(() => {
      this.timeout = setTimeout(() => {
        this.refreshData();
        if (this.debug) {
          this.debugDumpData();
        }

        if (this.callbackFunction) {
          // Create a clean set of outputs
          const data: ParamData[] = [];
          for (const param of this.dataParams) {
            data.push({
              id: param.id,
              name: param.name,
              unit: param.unit,
              value: param.value
            });
          }

          this.callbackFunction(data);
        }
      }, this.delaySeconds * 1000);
    });
  }

  private currentStep: number = 0;
  private async refreshDataAsync(): Promise<void> {

    this.setupSocket();

    // Flush any pending write operations
    await this.flushWriteBuffer();

    this.log('ArefreshData');
    this.log('Refreshing data');
    if (this.currentStep >= this.cycle) {
      this.currentStep = 0;
    }

    const timestampBegin = Date.now();

    for (const param of this.dataParams) {
      this.log(`*** DEBUG: ${param.name} ${param.value} ${param.interval}`);
      if (param.value !== -1111 && param.interval === 0) {
        this.log(`Skipping because static: ${param.name}`);
        continue;
      }
      if (this.currentStep !== 0 && param.interval && this.currentStep % param.interval !== 0) {
        this.log(`Skipping param ${param.name} because of interval`);
        continue;
      }

      if (this.debug) {
        this.log(`Start read of param: ${param.name}`);
      }
      await this.operationReadValue(param);
      await this.sleep(100);
      this.log(`processed parameter: ${param.name}`);
      if (this.singleCallbackFunction) {
        this.singleCallbackFunction({
          id: param.id,
          name: param.name,
          unit: param.unit,
          value: param.value
        });
      }
    }

    if (this.socket) {
      this.socket.destroy();
    }
    const millis = Date.now() - timestampBegin;
    this.log(`Refresh took: ${millis} milliseconds`);
    this.currentStep += this.delaySeconds;
  }

  private log(message: string): void {
    if (this.debug) {
      console.log(message);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private activeOperationTimeout(): void {
    this.log('activeOperationTimeout');
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

    if (!this.socket) 
      throw new Error('Socket not initialized');
    
    this.socket.write(new Uint8Array(buffer));

    this.activeTimeout = setTimeout(() => {
      this.activeOperationTimeout();
    }, 3000);

    return this.activePromise;
  }

  private processIncomingData(payload: Buffer): void {
    if (!this.activeParam) {
      return;
    }

    let responseValue: number | boolean;

    // Determine if the data is for the current packet
    switch (this.activeParam.datatype) {
      case 'byte':
        responseValue = payload[0];
        break;
      case 'bool':
        responseValue = payload[0] === 1;
        break;
      case 'ushort':
        responseValue = payload.readUInt16BE();
        break;
      case 'uint':
        responseValue = payload.readUInt32BE();
        break;
      case 'string':
        throw new Error('string datatype not handled properly TODO');
      default:
        throw new Error(`unhandled datatype: ${this.activeParam.datatype}`);
    }

    // For read operations, update the parameter value with scaling and precision
    if (typeof responseValue === 'number') {
      responseValue *= this.activeParam.scale;

      if (this.activeParam.precision !== '') {
        responseValue = round(
          responseValue,
          Number(this.activeParam.precision)
        );
      }
    }

    // Update the parameter value and timestamp
    this.activeParam.value = responseValue;
    this.activeParam.valuetimestamp = Date.now();

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