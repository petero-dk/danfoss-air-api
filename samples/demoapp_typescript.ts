import { init, ParamData } from '../dist/index.js';

console.log("TypeScript demo app started");

// Replace with your Danfoss Air unit's IP address
const DANFOSS_AIR_IP = "10.10.10.167";

const dfair = init(DANFOSS_AIR_IP, 5, false, dfairCallback);

function dfairCallback(data: ParamData[]): void {
    console.log("Data received:", JSON.stringify(data, null, 2));
    
    // Example: Extract specific values
    const humidity = data.find(param => param.name === "relative humidity measured");
    const supplyFanSpeed = data.find(param => param.name === "Actual Supply Fan Speed");
    
    if (humidity && supplyFanSpeed) {
        console.log(`Humidity: ${humidity.value}${humidity.unit}, Supply Fan: ${supplyFanSpeed.value}${supplyFanSpeed.unit}`);
    }
}