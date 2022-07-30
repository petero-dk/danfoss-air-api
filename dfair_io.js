const { time } = require("console");
var net = require("net");
const { runInThisContext } = require("vm");
const { threadId } = require("worker_threads");

//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, callbackData) {
    this.ip = ip;
    this.callbackData = callbackData;
    this.dataParams = this.initDataParams();

    this.timeout = null;

    this.s = new net.Socket();

    var self = this;

    this.s.connect({ host: ip, port: 30046 }); //create a client socket to this device

    this.s.on("data", (payload) => {
      console.log("Data received:" + payload + " size:" + payload.length);
      this.processIncomingData(payload); //.activePromiseResolve();
    });

    // s.on("connect", function (x, self) {
    //   console.log("Connect:" + x);
    //   self.sanityCheck(); //TODO: how to get the scope to work
    // });

    this.s.on("connect", () => {
      console.log("Connected");
      this.sanityCheck(); //TODO: how to get the scope to work
    });

    this.s.on("end", function (e) {
      console.log("end:" + e);
    });

    this.s.on("error", function (err) {
      console.log("Error:" + err);
      this.cleanup();
    });

    console.log("initialized dfair_io using ip:" + ip);
  }

  sanityCheck() {
    //Check that we have a sensible Danfoss Air controller in the other end

    //finally start the cyclic data refresh
    console.log("Sanity passed");
    this.timeout = setTimeout(() => {
      this.refreshData();
    }, 1000);
  }

  cleanup() {
    //process all the data parameters
    clearTimeout(timeout);
  }

  buildParam(name, unit, endpoint, address, datatype, scale) {
    let p = {};
    p.name = name;
    p.unit = unit;
    p.endpoint = endpoint;
    p.address = address;
    p.datatype = datatype;
    p.scale = scale;
    p.value = -1111;
    p.valuetimestamp = 0; //UTC timestamp in milliseconds

    return p;
  }

  initDataParams() {
    //ParameterList.cs
    let params = [];
    params.push(
      this.buildParam(
        "relative humidity measured",
        "%",
        4,
        5232,
        "byte",
        100 / 255
      )
    ); //byte value * 100 / 255 - basically a scaling operation
    params.push(
      this.buildParam("Actual Supply Fan Speed", "rpm", 4, 5200, "ushort", 1)
    ); //line 258 AddParameter<ushort>("Actual Supply Fan Speed", 4, 5200, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    params.push(
      this.buildParam("Actual Extract Fan Speed", "rpm", 4, 5201, "ushort", 1)
    ); //line 259 AddParameter<ushort>("Actual Extract Fan Speed", 4, 5201, ParameterType.WORD, ParameterFlags.ReadOnly, 1);

    params.push(
      this.buildParam("Total running minutes", "min", 0, 992, "uint", 1)
    ); //line 259 AddParameter<ushort>("Actual Extract Fan Speed", 4, 5201, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    return params;
  }

  debugDumpData() {
    console.log("--------------------------------");
    for (let param of this.dataParams) {
      console.log(param.name + " " + param.value);
    }
  }

  refreshData() {
    //this.ArefreshData();

    this.ArefreshData().then(() => {
      setTimeout(() => {
        this.refreshData();
        this.debugDumpData();
      }, 2000);
    });
  }
  //refreshes all the data in the dataParams
  //should be executed periodically
  async ArefreshData() {
    //await this.operationReadValue(2);
    console.log("ArefreshData");

    console.log("Refreshing data");
    //refresh all data parameters
    let timestampBegin = Date.now();

    for (const param of this.dataParams) {
      console.log("Start read of param:" + param.name);
      await this.operationReadValue(param);
      await this.sleep(100);
      console.log("processed parameter:" + param.name);
    }

    let millis = Date.now() - timestampBegin;
    console.log("Refresh took:" + millis + " milliseconds");
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  activeOperationTimeout() {
    console.log("activeOperationTimeout");
    this.activePromiseReject(); //.reject();
  }

  //Read operation takes place here
  async operationReadValue(param) {
    this.activeParam = param;

    this.activePromise = new Promise((resolve, reject) => {
      this.activePromiseResolve = resolve;
      this.activePromiseReject = reject;
    });
    //build and read frame

    const buffer = Buffer.alloc(63, 0);

    buffer[0] = param.endpoint; //endpoint
    buffer[1] = 4; //read
    //buffer[2] = (param.address >> 8);
    //buffer[3] = (param.address && 0x00F);
    buffer.writeUint16BE(param.address, 2);

    this.s.write(new Uint8Array(buffer));

    this.activeTimeout = setTimeout(this.activeOperationTimeout, 3000); //1 second to perform the network operation - should be sufficient
    return this.activePromise;
  }

  operationWriteValue(param, value) {}

  processIncomingData(payload) {
    //determine if the data is for the current packet
    if (this.activeParam.datatype === "byte") {
      this.activeParam.value = payload[0];
    } else if (this.activeParam.datatype === "ushort") {
      this.activeParam.value = payload.readUInt16BE();
    } else if (this.activeParam.datatype === "uint") {
      this.activeParam.value = payload.readUInt32BE();
    } else {
      throw "unhandled datatype:" + this.activeParam.datatype;
    }

    this.activeParam.value *= this.activeParam.scale;

    //clear timeout
    clearTimeout(this.activeTimeout);
    this.activeTimeout = null;
    this.activePromiseResolve();
  }
}

function init(ip, callbackData) {
  return new dfair_io(ip, callbackData);
}

exports.init = init;
