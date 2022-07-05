var init_dfair = require('./dfair_io.js');

console.log("DFAir started");

let dfair1 = init_dfair.init("10.10.10.102", dfair_callback);
//var dfair_mqtt = require('./dfair_mqtt.js');

//dfair_mqtt()

function dfair_callback()
{
    console.log("dfair_callback invoked");

}