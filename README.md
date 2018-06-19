##Control Gree Air Conditioning from Homebridge.

This plugins is based on Gree HVAC MQTT bridge (https://github.com/arthurkrupa/gree-hvac-mqtt-bridge).

## Requirements 
- NodeJS (>=8.9.3) with NPM
- An MQTT broker and Gree smart HVAC device on the same network

It needs mqtt server to get the ambient temperature. You can use an ESP8266 with DHTXX sensor and post temperature value to a topic in an mqtt server.
For each AC you need to specify the IP address.

## Usage Example:

{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:22:3D:E3:CE:30",
        "port": 51826,
        "pin": "123-45-568"
    },
    "accessories": [
        {
            "accessory": "GreeAC",
            "host": "192.168.1.X",
            "name": "Office AC"
        },
        {
            "accessory": "GreeAC",
            "host": "192.168.1.Y",
            "name": "Bedroom AC"
        }
    ]
}



