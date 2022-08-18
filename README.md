# dfair
## Intro
A simple communication solution over lan for a Danfoss Air ventilation system written in node.js

NOTE: This is an early beta - and I just do it to solve some home automation issues, so if you need something special / done rapidly / whatever - then the only way to ensure my dedicated attention is 100€/hour payments :-)

## Files
The dfair_io.js is the most important file...
Besides this then the demoapp_knownipnumber.js is the best / most important app - this is the one I use when I mess around.

## Usage
If you use Node-RED to do your home automation then look at @Laro88/node-red-contrib-dfair - I have made a Node that takes the ip of the unit and delivers objects

Use the dfair_io.js module as demonstrated in hte demoapp_knownipnumber.js if you know the ip of the Danfoss Air unit - what as you see fit.

## Troubleshooting

## Todo
1. At some point in time I will look a the discovery process for the Danfoss Air unit (what is the Danfoss Air service application doing to find the unit on the lan)
2. I will do some work on setting the Boost (important) and Bypass (not so important) and the Manual level (important)
3. Recovery from lan crashes / router reboots / power cycles etc. Still messing around...


## Testing
Tested with my home unit / if you use the application then send me a json object snapshot and your name (Voluntary) then I will list yours as well if it works:


