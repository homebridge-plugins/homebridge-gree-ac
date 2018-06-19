# Control Gree Air Conditioning with homekit

This plugins is based on Gree HVAC MQTT bridge (https://github.com/arthurkrupa/gree-hvac-mqtt-bridge).

## Requirements 
- NodeJS (>=8.9.3) with NPM
- An MQTT broker and Gree smart HVAC device on the same network

You nedd a mqtt server to read the ambient temperature. You can use an ESP8266 with DHTXX sensor and post temperature value to a topic in an mqtt server. Tah temperature should be the temperature on the room where the AC is installed.

For each AC device you need to add an accesory and specify the IP address of the device (and mqtt topic to read the ambient temperature).

## Usage Example:
```
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
            "name": "Office AC",
            "updateInterval": 10000,
            "mqttUrl": "mqtt://127.0.0.1",
            "currentTempTopic": "home/office/temperature"
        },
        {
            "accessory": "GreeAC",
            "host": "192.168.1.Y",
            "name": "Bedroom AC",
            "updateInterval": 10000,
            "mqttUrl": "mqtt://127.0.0.1",
            "currentTempTopic": "home/bedroom/temperature"
        }
    ]
}
```

