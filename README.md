Control Gree Air Conditioning from Homebridge.

Autodiscover of the GREE AC wifi module is done automatically but you need to configure the broadcast ip address of your home network.
Needs mqtt server to get the ambient themperature. You can use an ESP8266 with DHTXX sensor and post temperature value to a topic in an mqtt server.

Usage Example:

    "bridge": {
        "name": "Homebridge",
        "username": "AA:15:5D:B3:AE:32",
        "port": 51826,
        "pin": "234-25-123"
    },
    "description": "My Home bridge",
    "accessories": [
        {
            "accessory": "GreeAC",
            "host": "192.168.1.255",
            "name": "Bedroom AC",
            "debug": "false",
            "updateInterval": 10000,
            "mqttUrl": "mqtt://127.0.0.1",
            "currentTempTopic": "home/bedroom/temperature"
        }
     ]

