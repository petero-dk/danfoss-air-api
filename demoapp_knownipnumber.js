var init_dfair = require('./dfair_io.js');

console.log("demoapp_knownipnumberDFAir started");

let dfair1 = init_dfair.init("10.10.10.102", dfair_callback);


function dfair_callback()
{
    console.log("dfair_callback invoked");

}