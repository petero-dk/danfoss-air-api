var init_dfair = require('./dfair_io.js');

console.log("demoapp_knownipnumber started");

let dfair1 = init_dfair.init("10.10.10.167", 5, false, dfair_callback);

function dfair_callback(payloadObject)
{
    console.log("dfair_callback invoked: payoad:" + JSON.stringify(payloadObject));
}