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
 * Options for initializing the Danfoss Air connection
 */
export interface DanfossAirOptions {
  ip: string;
  delaySeconds: number;
  debug?: boolean;
  callbackFunction?: CallbackFunction;
  singleCallbackFunction?: SingleCallbackFunction;
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

  constructor(options: DanfossAirOptions) {
    this.ip = options.ip;
    this.debug = options.debug || false;
    this.callbackFunction = options.callbackFunction;
    this.singleCallbackFunction = options.singleCallbackFunction;
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