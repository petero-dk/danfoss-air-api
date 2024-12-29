const mqtt = require("mqtt");
var dfair_io;

async function init(mqttserverurl) {
  try {
    
    var client = mqtt.connect(mqttserverurl);

    client.on("connect", function () {
      client.subscribe("presence", function (err) {
        if (!err) {
          client.publish("presence", "Hello mqtt");
        }
      });
    });

    client.on("message", function (topic, message) {
      // message is Buffer
      console.log(message.toString());
      client.end();
    });
  } catch (err) {
    console.log("Exception: " + err);
  }
}

export {init}