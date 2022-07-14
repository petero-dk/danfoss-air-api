var net = require("net");

//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, callback) {
    this.ip = ip;
    this.callback = callback;
    this.params = this.initDataParams();

    this.timeout = null;

    var s = new net.Socket();

    var self = this;

    s.connect({ host: ip, port: 30046 });

    s.on("data", function (payload) {
      console.log("Data received");
    });

    s.on("connect", function (x, self) {
      console.log("Connect:" + x);
      self.sanityCheck(); //TODO: how to get the scope to work
    });

    s.on("end", function (e) {
      console.log("end:" + e);
    });

    s.on("error", function (err) {
      console.log("Error:" + err);
    });

    console.log("initialized dfair_io using ip:" + ip);
  }

  sanityCheck() {
    //Check that we have a sensible Danfoss Air controller in the other end

    timeout = setTimeout(refreshData, 5000);
  }

  cleanup(){
    //process all the data parameters
    clearTimeout(timeout);
  }

  buildParam(name, unit, address, datatype)
  {
    let p = {};
    p.name = name;
    p.unit = unit;
    p.address = address;
    p.datatype = datatype;
    p.value=-1111;
    return p;
  }

  initDataParams()
  {
    //ParameterList.cs
    let params = [];
    params.push(this.buildParam("relative humidity","%", 5232, "byte"));
    params.push(this.buildParam("Actual Supply Fan Speed","rpm", 5200, "ushort"));//line 258 AddParameter<ushort>("Actual Supply Fan Speed", 4, 5200, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    params.push(this.buildParam("Actual Extract Fan Speed","rpm", 5201, "ushort")); //line 259 AddParameter<ushort>("Actual Extract Fan Speed", 4, 5201, ParameterType.WORD, ParameterFlags.ReadOnly, 1);
    return params;
  }

  refreshData() {
    console.log("Refreshing data");
    setTimeout(refreshData, 2000);
  }
}

function init(ip, callback) {
  return new dfair_io(ip, callback);
}

exports.init = init;
