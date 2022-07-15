const { time } = require("console");
var net = require("net");

//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, callbackData) {
    this.ip = ip;
    this.callbackData = callbackData;
    this.dataParams = this.initDataParams();

    this.timeout = null;

    var s = new net.Socket();

    var self = this;

    s.connect({ host: ip, port: 30046 }); //create a client socket to this device

    s.on("data", (payload) => {
      console.log("Data received:" + payload);
    });

    // s.on("connect", function (x, self) {
    //   console.log("Connect:" + x);
    //   self.sanityCheck(); //TODO: how to get the scope to work
    // });

    s.on("connect", () => {
      console.log("Connected");
      this.sanityCheck(); //TODO: how to get the scope to work
    });

    s.on("end", function (e) {
      console.log("end:" + e);
    });

    s.on("error", function (err) {
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

  buildParam(name, unit, address, datatype) {
    let p = {};
    p.name = name;
    p.unit = unit;
    p.address = address;
    p.datatype = datatype;
    p.value = -1111;
    p.valuetimestamp = 0; //UTC timestamp in milliseconds
    return p;
  }

  initDataParams() {
    //ParameterList.cs
    let params = [];
    params.push(this.buildParam("relative humidity", "%", 5232, "byte"));
    params.push(
      this.buildParam("Actual Supply Fan Speed", "rpm", 5200, "ushort")
    ); //line 258 AddParameter<ushort>("Actual Supply Fan Speed", 4, 5200, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    params.push(
      this.buildParam("Actual Extract Fan Speed", "rpm", 5201, "ushort")
    ); //line 259 AddParameter<ushort>("Actual Extract Fan Speed", 4, 5201, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    return params;
  }

  refreshData() {
    //this.ArefreshData();

    this.ArefreshData().then(() => {
      setTimeout(() => {
        this.refreshData();
      }, 2000);
    });
  }
  //refreshes all the data in the dataParams
  //should be executed periodically
  async ArefreshData() {
    console.log("ArefreshData");
    return new Promise((resolve, reject) => {
      console.log("Refreshing data");
      //refresh all data parameters
      let timestampBegin = Date.now();
      this.dataParams.forEach((param) => {
        //await this.operationReadValue(param);
        //await this.sleep(100);
      });
      let millis = Date.now() - timestampBegin;
      console.log("Refresh took:" + millis + " milliseconds");
      resolve(true);
    });
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  activeOperationTimeout() {
    console.log("activeOperationTimeout");
    this.activePromise.reject();
  }

  async operationReadValue(param) {
    this.activeOperation = param;

    this.activePromise = new Promise((resolve, reject) => {});
    //build and read frame

    this.activeTimeout = setTimeout(this.activeOperationTimeout, 1000); //1 second to perform the network operation - should be sufficient
    return this.activePromise;
  }

  operationWriteValue(param, value) {}

  processIncomingData(payload) {
    //determine if the data is for the current packet

    //clear timeout
    this.activeTimeout = null;
    this.activePromise.resolve();
  }
}

function init(ip, callbackData) {
  return new dfair_io(ip, callbackData);
}

exports.init = init;
