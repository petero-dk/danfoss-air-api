const { time } = require("console");
var net = require("net");
const { runInThisContext } = require("vm");
const { threadId } = require("worker_threads");

//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, DelaySeconds, Debug, CallbackFunction) {
    this.ip = ip;
    this.delaySeconds = DelaySeconds;
    this.debug = Debug;
    this.callbackFunction = CallbackFunction;
    this.dataParams = this.initDataParams(); //everything goes in here (bloody mess)
    this.outParams = this.initOutParams(); 
    

    this.timeout = null;

    this.s = new net.Socket();

    var self = this;

    this.s.connect({ host: ip, port: 30046 }); //create a client socket to this device

    this.s.on("data", (payload) => {
      if(this.debug){
        console.log("Data received:" + payload + " size:" + payload.length);
      }
      
      this.processIncomingData(payload); //.activePromiseResolve();
    });

    this.s.on("connect", () => {
      console.log("Connected");
      this.sanityCheck();
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
    //TODO consider checking that we have a sensible Danfoss Air controller in the other end

    //finally start the cyclic data refresh
    console.log("Sanity passed");
    this.timeout = setTimeout(() => {
      this.refreshData();
    }, this.delaySeconds * 1000);
  }

  cleanup() {
    //process all the data parameters
    clearTimeout(timeout);
  }

  buildParam(name, unit, endpoint, address, datatype, scale, precision) {
    let p = {};
    p.name = name;
    p.unit = unit;
    p.endpoint = endpoint;
    p.address = address;
    p.datatype = datatype;
    p.scale = scale;
    p.precision = precision;
    p.value = -1111;
    p.valuetimestamp = 0; //UTC timestamp in milliseconds

    return p;
  }

  initDataParams() {
    //ParameterList.cs - where to find the parameters - note to future self.
    let params = [];
    params.push(
      this.buildParam(
        "relative humidity measured",
        "%",
        4,
        5232,
        "byte",
        100 / 255,
        1
      )
    ); //byte value * 100 / 255 - basically a scaling operation
    params.push(
      this.buildParam("Actual Supply Fan Speed", "rpm", 4, 5200, "ushort", 1, "") //word
    );
    params.push(
      this.buildParam("Actual Extract Fan Speed", "rpm", 4, 5201, "ushort", 1, "")
    );
    params.push(
      this.buildParam("Total running minutes", "min", 0, 992, "uint", 1, "")
    );
    params.push(
      this.buildParam("Battery Indication Percent", "%", 0, 783, "byte", 100/255, 1)
    );
    params.push(
      this.buildParam("Filter Fouling", "%", 0, 5226, "byte", 100/255, 1) //percent
    )
    params.push(
      this.buildParam("Outdoor Temperature", "c", 0, 830, "uint", 1, 1) //TEMPERATURE
    );

    params.push(
      this.buildParam("Boost", "", 0, 5424, "bool", 1) //writeable
    );
    params.push(
      this.buildParam("Defrost status", "", 0, 5617, "bool", 1)
    );

    params.push(
      this.buildParam("Temperature 1", "c", 4, 5234, "ushort", 0.01, "")
    );
    params.push(
      this.buildParam("Temperature 3", "c", 4, 5235, "ushort", 0.01, "")
    );
    params.push(
      this.buildParam("Temperature 3", "c", 4, 5236, "ushort", 0.01, "")
    );
    params.push(
      this.buildParam("Temperature 4", "c", 4, 5237, "ushort", 0.01, "")
    );
    
    //  params.push(
    //    this.buildParam("HRV Unit ID", "", 0, 5605, "string", 1) 
    //  );
    
    params.push(
      this.buildParam("Unit Hardware Revision", "", 4, 34, "ushort", 1, "") 
    );
    params.push(
      this.buildParam("Unit Hardware Revision", "", 4, 35, "ushort", 1, "") 
    );
    params.push(
      this.buildParam("Unit SerialNumber High Word", "", 4, 36, "ushort", 1, "") 
    );
    params.push(
      this.buildParam("Unit SerialNumber Low Word", "", 4, 37, "ushort", 1, "") 
    );

    return params;
  }

  //this function does a nice printout of the data refreshed
  debugDumpData() { 
    console.log("--------------------------------");
    for (let param of this.dataParams) {
      console.log(param.name + " " + param.value);
    }
  }

  refreshData() {
    this.ArefreshData().then(() => {
      setTimeout(() => {
        this.refreshData();
        if (this.debug) {
          this.debugDumpData();
        }

        //create a clean set of outputs
        let data = [];
        for (const param of this.dataParams) {
          data.push({"name": param.name, "unit": param.unit, "value": param.value})
        }

        this.callbackFunction(data);
      }, this.delaySeconds * 1000);
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
      if (this.debug) {
        console.log("Start read of param:" + param.name);
      }
      await this.operationReadValue(param);
      await this.sleep(100);
      if (this.debug) {
        console.log("processed parameter:" + param.name);
      }
    }

    let millis = Date.now() - timestampBegin;
    if (this.debug) {
      console.log("Refresh took:" + millis + " milliseconds");
    }
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  activeOperationTimeout() {
    console.log("activeOperationTimeout");
    this.activePromiseReject();
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

    buffer[0] = param.endpoint; //TODO need to find out what is going on with the endpoints (design mess from old days?)
    buffer[1] = 4; //read
    buffer.writeUint16BE(param.address, 2);

    this.s.write(new Uint8Array(buffer));

    this.activeTimeout = setTimeout(this.activeOperationTimeout, 3000); //1 second to perform the network operation - should be sufficient
    return this.activePromise;
  }

  operationWriteValue(param, value) {
    //TODO - where did the ol' write operations code go?
  }

  processIncomingData(payload) {
    //determine if the data is for the current packet
    if (this.activeParam.datatype === "byte") {
      this.activeParam.value = payload[0];
    }else if (this.activeParam.datatype === "bool") {
      this.activeParam.value = payload[0] == 1;
    } else if (this.activeParam.datatype === "ushort") {
      this.activeParam.value = payload.readUInt16BE();
    } else if (this.activeParam.datatype === "uint") {
      this.activeParam.value = payload.readUInt32BE();
    } else if (this.activeParam.datatype === "string") {
      throw "string datatype not handled properly TODO";
      //this.activeParam.value = payload.buffer();
    } else {
      throw "unhandled datatype:" + this.activeParam.datatype;
    }

    this.activeParam.value *= this.activeParam.scale;
    
    if(this.activeParam.precision != ""){
      this.activeParam.value = round(this.activeParam.value, this.activeParam.precision);  
    }

    //clear timeout
    clearTimeout(this.activeTimeout);
    this.activeTimeout = null;
    this.activePromiseResolve();
  }
}

function init(ip,  DelaySeconds, Debug, CallbackFunction) {
  if(DelaySeconds < 3){
    console.log("Consider - why do you need such fast readings? Every 30 seconds should be just fine for a ventilation system");
  }

  return new dfair_io(ip, DelaySeconds, Debug, CallbackFunction);
}

function round(value, precision) {
  var multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

exports.init = init;
