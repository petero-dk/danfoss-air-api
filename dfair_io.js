//handles the direct io with a physical Danfoss Air device
class dfair_io {
  constructor(ip, callback) {
    this.ip = ip;
    this.callback = callback;

    console.log("initialized dfair_io using ip:" + ip);
  }
}

function init(ip, callback) {
  return new dfair_io(ip, callback);
}

exports.init = init;
