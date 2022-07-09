var net = require("net");

//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, callback) {
    this.ip = ip;
    this.callback = callback;

    this.timeout = null;

    var s = new net.Socket();

    s.connect({ host: ip, port: 30046 });

    s.on("data", function (payload) {
      console.log("Data received");
    });

    s.on("connect", function (x) {
      console.log("Connect:" + x);
      this.sanityCheck();
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

    timeout = setTimeout(refreshData, 2000);
  }

  cleanup(){
    clearTimeout(timeout);

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
