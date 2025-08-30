# Danfoss Air API

A TypeScript/Node.js library for communicating with Danfoss Air ventilation systems over LAN.

## Features

- **TypeScript Support**: Full TypeScript definitions and type safety
- **Easy Integration**: Simple callback-based API for real-time data
- **Comprehensive Data**: Access to fan speeds, temperatures, humidity, battery status and more
- **MQTT Ready**: Built-in support for MQTT integration
- **Well Documented**: Complete API documentation and examples

## Installation

```bash
npm install danfoss-air-api
```

## Quick Start

### JavaScript

```javascript
const { init } = require('danfoss-air-api');

// Replace with your Danfoss Air unit's IP address
const danfossAir = init("192.168.1.100", 30, false, (data) => {
    console.log("Received data:", data);
    
    // Extract specific values
    const humidity = data.find(param => param.name === "relative humidity measured");
    const supplyFan = data.find(param => param.name === "Actual Supply Fan Speed");
    
    if (humidity && supplyFan) {
        console.log(`Humidity: ${humidity.value}%, Supply Fan: ${supplyFan.value}rpm`);
    }
});
```

### TypeScript

```typescript
import { init, ParamData } from 'danfoss-air-api';

const danfossAir = init("192.168.1.100", 30, false, (data: ParamData[]) => {
    console.log("Received data:", data);
    
    // Type-safe data access
    data.forEach(param => {
        console.log(`${param.name}: ${param.value}${param.unit}`);
    });
});
```

## API Reference

### `init(ip, delaySeconds, debug, callbackFunction)`

Initialize a connection to your Danfoss Air unit.

- **ip**: `string` - IP address of your Danfoss Air unit
- **delaySeconds**: `number` - Delay between data updates (minimum 3 seconds recommended)
- **debug**: `boolean` - Enable debug logging
- **callbackFunction**: `(data: ParamData[]) => void` - Function called with updated data

Returns a `DanfossAir` instance.

### Data Parameters

The library provides access to the following parameters:

- **relative humidity measured** (%)
- **Actual Supply Fan Speed** (rpm)
- **Actual Extract Fan Speed** (rpm)
- **Total running minutes** (min)
- **Battery Indication Percent** (%)
- **Filter Fouling** (%)
- **Outdoor Temperature** (°C)
- **Boost** (boolean)
- **Defrost status** (boolean)
- **Temperature 1-4** (°C)
- **Unit Hardware Revision**
- **Unit SerialNumber** (High/Low Word)

## Finding Your Danfoss Air Unit

### Using Wireshark

Filter network traffic with: `eth.addr contains 00:07:68`

### Using Danfoss Air PC Tool

Download from: [Danfoss Air PC Tool](https://www.danfoss.com/da-dk/service-and-support/downloads/dhs/danfoss-air-pc-tool-end-user/)

## Examples

See the [samples/](./samples/) directory for complete examples:

- **Basic Usage**: `samples/demoapp_knownipnumber.js`
- **MQTT Integration**: `samples/demoapp_mqtt.js`
- **TypeScript Example**: `samples/demoapp_typescript.ts`

## MQTT Integration

```javascript
const mqtt = require("mqtt");
const { init } = require('danfoss-air-api');

const client = mqtt.connect("mqtt://your-broker-url");
const danfossAir = init("192.168.1.100", 30, false, (data) => {
    data.forEach(param => {
        const topic = `danfoss/air/${param.name.replace(/\s+/g, '_').toLowerCase()}`;
        const payload = JSON.stringify({
            value: param.value,
            unit: param.unit,
            timestamp: new Date().toISOString()
        });
        client.publish(topic, payload);
    });
});
```

## Node-RED Integration

For Node-RED users, check out [@Laro88/node-red-contrib-dfair](https://www.npmjs.com/package/node-red-contrib-dfair) which provides a ready-to-use Node-RED node based on this library.

## Development

### Building from Source

```bash
git clone https://github.com/petero-dk/danfoss-air-api.git
cd danfoss-air-api
npm install
npm run build
```

### Project Structure

```
├── src/           # TypeScript source code
├── dist/          # Compiled JavaScript (generated)
├── samples/       # Example applications
├── .github/       # GitHub Actions workflows
└── README.md
```

## Compatibility

- **Node.js**: >= 14.0.0
- **Danfoss Air Units**: Tested with units having MAC addresses in range `00:07:68:*`

## Testing

Tested with:
- Node.js LTS version v22.12.0
- Danfoss Air unit MAC address `00:07:68:...` (Danfoss A/S MAC range)

## Contributing

Keep pull requests small, simple and easy to test. This library aims to be minimal and focused.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Troubleshooting

### Connection Issues

1. Ensure your Danfoss Air unit is connected to the same network
2. Verify the IP address using network scanning tools
3. Check that port 30046 is accessible
4. Try the Danfoss Air PC Tool to confirm connectivity

### Performance

- **Recommended polling interval**: 30 seconds or more
- **Minimum polling interval**: 3 seconds (the library will warn about faster intervals)
- **Network timeout**: 3 seconds per parameter read

## Changelog

### v1.0.0
- Complete TypeScript rewrite
- Modern npm package structure
- Improved type safety and documentation
- Moved examples to samples/ directory
- Added GitHub Actions for CI/CD

### v0.0.6 (Legacy)
- Original JavaScript implementation

