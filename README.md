# dfair
## Intro
A simple communication solution over lan for a Danfoss Air ventilation system written in node.js

NOTE: This is an early beta - and I just do it to solve some home automation issues, so if you need something special / done rapidly / whatever - then the only way to ensure my dedicated attention is 100€/hour payments :-)
So - the cheapest is to send me a message and I might be able to do something about it, or at least tell you that I wont be fixing that anytime soon :-)

## Files
The dfair_io.js is the most important file...
Besides this then the demoapp_knownipnumber.js is the best / most important app - this is the one I use when I mess around in vscode.

## Usage
Use the dfair_io.js module as demonstrated in the demoapp_knownipnumber.js if you know the ip of the Danfoss Air unit - what as you see fit.

Use wireshark to grab all and you should have the ip by filtering for : <b>eth.addr contains 00:07:68</b>
Otherwise use the Danfoss Air service tool from ehre: https://www.danfoss.com/da-dk/service-and-support/downloads/dhs/danfoss-air-pc-tool-end-user/


If you use Node-RED to do your home automation then look at @Laro88/node-red-contrib-dfair - I have made a Node that takes the ip of the unit and delivers objects



## Troubleshooting

## Todo
1. At some point in time I will look a the discovery process for the Danfoss Air unit (what is the Danfoss Air service application doing to find the unit on the lan)
2. I will do some work on setting the Boost (important) and Bypass (not so important) and the Manual level (important)
3. Readout of temperatures and frost protection active 
3. Recovery from lan crashes / router reboots / power cycles etc. Still messing around...


## Contributing
As mentioned then I dont work much on it as my issues was resolved in a different manner, so keep any pull requests small, simple and easy to grasp and test.

## Testing
### 0.0.2
202412
Node LTS version v22.12.0 
Reads out fan speeds, uptime minutes, and relative humidity



Tested with my home unit / if you use the application then send me a json object snapshot and your name (Voluntary) then I will list yours as well if it works:

My Danfoss Air unit has a mac address 00:07:68:... which is in one of Danfoss A/S mac ranges (https://udger.com/resources/mac-address-vendor-detail?name=danfoss_a-s)

