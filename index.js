const commands = require('./app/commandEnums');
var Service, Characteristic;
var mqtt = require('mqtt');


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-gree-ac', 'GreeAC', GreeAC);
}

function GreeAC(log, config) {

    this.log = log;
    this.name = config.name;
    this.host = config.host;
    this.debug = ((config.debug || "false") === "true");
    this.updateInterval = config.updateInterval || 10000;
    this.currentTempTopic = config['currentTempTopic'] || "hvac/temperature";
    this.mqttUrl = config['mqttUrl'];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.model = config.acModel || "Gree AC";

    this.mqttOptions = {
        keepalive: 10,
        clientId: this.client_Id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        serialnumber: config["serial"] || this.client_Id,
        max_temperature: config["maxTemperature"] || 100,
        min_temperature: config["minTemperature"] || -50,
        username: config["username"],
        password: config["password"],
        will: {
            topic: 'WillMsg',
            payload: 'Connection Closed abnormally..!',
            qos: 0,
            retain: false
        },
        rejectUnauthorized: false
    };

    if (this.mqttUrl) {
        this.client = mqtt.connect(this.mqttUrl, this.mqttOptions);
    }

    this.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
    this.TargetTemperature = 22;
    this.CurrentTemperature = 0;
    this.services = [];

    this.GreeACService = new Service.Thermostat(this.name);
    this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

    this.GreeACService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this))
        .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.GreeACService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('set', this.setTargetHeatingCoolingState.bind(this))
        .on('get', this.getTargetHeatingCoolingState.bind(this));

    this.GreeACService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getTargetHeatingCoolingState.bind(this));

    this.GreeACService
        .getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
            maxValue: 30,
            minValue: 16,
            minStep: 1
        })
        .on('set', this.setTargetTemperature.bind(this))
        .on('get', this.getTargetTemperature.bind(this));

    this.GreeACService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
            maxValue: 30,
            minValue: 16,
            minStep: 1
        })
        .on('get', this.getCurrentTemperature.bind(this));

    this.services.push(this.GreeACService);

    this.serviceInfo = new Service.AccessoryInformation();

    this.serviceInfo
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Gree')
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, this.host.replace(/./g, ""));

    this.services.push(this.serviceInfo);

    this.discover();
}

GreeAC.prototype = {

    getServices: function() {

        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, 'Gree')
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.host.replace(/./g, ""));
        return [informationService, this.GreeACService];
    },

    discover: function () {

        var accessory = this;
        var log = this.log;
        var host = this.host;

        const deviceOptions = {
            host: host,
            updateInterval: accessory.updateInterval,
            onStatus: (deviceModel) => {
                var device_power_status = deviceModel.props[commands.power.code];
                var device_mode_status = deviceModel.props[commands.mode.code];
                var device_temperature = deviceModel.props[commands.temperature.code];
                var device_swingvert = deviceModel.props[commands.swingVert.code] === 0 ? 0 : 1;
                accessory.TargetTemperature = parseFloat(device_temperature);

                if (device_power_status === commands.power.value.off) {
                    accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
                } else if (device_mode_status === commands.mode.value.auto) {
                    accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
                } else if (device_mode_status === commands.mode.value.cool) {
                    accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
                } else if (device_mode_status === commands.mode.value.heat) {
                    accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
                } else {
                    accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
                }

                accessory.GreeACService
                    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                    .updateValue(accessory.TargetHeatingCoolingState);

                accessory.GreeACService
                    .getCharacteristic(Characteristic.TargetTemperature)
                    .updateValue(accessory.TargetTemperature);

                if (accessory.debug === true) {
                    log.info('Get mode: %s', device_mode_status.toString());
                    log.info('Get temperature %s', device_temperature.toString());
                    log.info('Get fanspeed %s', deviceModel.props[commands.fanSpeed.code].toString());
                    log.info('Get swingvert %s', device_swingvert.toString());
                    log.info('Get powerstatus %s', device_power_status.toString());
                }
            },
            onUpdate: (deviceModel) => {
                if (accessory.debug === true) {
                    log.info('Status updated on %s', deviceModel.name)
                }
            },
            onConnected: (deviceModel) => {
                // var accesorry = this;

                if (deviceModel.bound == true) {
                    log.info('Connected to %s with IP address %s', deviceModel.name, deviceModel.address);
                } else {
                    log.info('Error connecting to %s with IP address %s', deviceModel.name, deviceModel.address);
                }

                accessory.client.subscribe(this.currentTempTopic);
                accessory.client.on('message', function (topic, message) {
                    try {
                        var data = JSON.parse(message);
                    } catch (e) {
                        return null;
                    }

                    if (data === null) {
                        return null
                    }
                    // var that = this;
                    accessory.temperature = parseFloat(data);
                    if (!isNaN(accessory.temperature)) {
                        if (accessory.debug === true) {
                            accessory.log.info('Current room temperature is ' + accessory.temperature);
                        }
                        accessory.CurrentTemperature = parseFloat(accessory.temperature);
                        accessory.GreeACService
                            .getCharacteristic(Characteristic.CurrentTemperature)
                            .updateValue(accessory.CurrentTemperature);
                    }
                });
            },
            onError: (deviceModel) => {
                if (accessory.debug === true) {
                    log.info('Error communicating with device %s with IP address %s', deviceModel.name, deviceModel.address);
                }
            },
            onDisconnected: (deviceModel) => {
                if (accessory.debug === true) {
                    log.info('Disconnected from device %s with IP address %s', deviceModel.name, deviceModel.address);
                }
            }
        };
        log.info("Start discover device %s", deviceOptions.host);
        accessory.hvac = require('./app/deviceFactory').connect(deviceOptions);
    },

    setTemperatureDisplayUnits: function (value, callback) {
        var accessory = this;
        var log = this.log;

        if (accessory.debug === true) {
            log.info("setTemperatureDisplayUnits from %s to %s", accessory.temperatureDisplayUnits, value);
        }
        accessory.temperatureDisplayUnits = value;
        callback(null);
    },

    getTemperatureDisplayUnits: function (callback) {
        var accessory = this;
        var log = this.log;
        try {
            accessory.temperatureDisplayUnits = accessory.hvac.device.props[commands.temperatureUnit.code];
            if (accessory.debug === true) {
                log.info("getTemperatureDisplayUnits: ", accessory.temperatureDisplayUnits);
            }
            callback(null, accessory.temperatureDisplayUnits);
        } catch (err) {
            callback();
        }
    },

    getTargetHeatingCoolingState: function (callback) {
        var accessory = this;
        var log = this.log;
        var state = Characteristic.TargetHeatingCoolingState.AUTO;
        try {
            if (accessory.hvac.device.props[commands.power.code] === commands.power.value.off) {
                state = Characteristic.TargetHeatingCoolingState.OFF;
            } else if (accessory.hvac.device.props[commands.mode.code] === commands.mode.value.auto) {
                state = Characteristic.TargetHeatingCoolingState.AUTO;
            } else if (accessory.hvac.device.props[commands.mode.code] === commands.mode.value.cool) {
                state = Characteristic.TargetHeatingCoolingState.COOL;
            } else if (accessory.hvac.device.props[commands.mode.code] === commands.mode.value.heat) {
                state = Characteristic.TargetHeatingCoolingState.HEAT;
            }

            accessory.TargetHeatingCoolingState = state;
            callback(null, accessory.TargetHeatingCoolingState);
        } catch (err) {
            if (accessory.debug === true) {
                log.info("getTemperatureDisplayUnits: error communicating with device");
            }
            callback();
        }
    },

    setTargetHeatingCoolingState: function (TargetHeatingCoolingState, callback, context) {
        var accessory = this;
        var log = this.log;

        try {
            if (context !== 'fromSetValue') {
                this.TargetHeatingCoolingState = TargetHeatingCoolingState;
                if (accessory.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF) {
                    accessory.hvac.setPower(commands.power.value.off);
                    if (accessory.debug === true) {
                        log.info('setTargetHeatingCoolingState: Set mode power off');
                    }
                } else {
                    if (accessory.hvac.device.props[commands.power.code] === commands.power.value.off) {
                        accessory.hvac.setPower(commands.power.value.on);
                        if (accessory.debug === true) {
                            log.info('setTargetHeatingCoolingState: Set mode power on');
                        }
                    }

                    if (accessory.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.HEAT) {
                        accessory.hvac.setMode(commands.mode.value['heat']);
                        if (accessory.debug === true) {
                            log.info('setTargetHeatingCoolingState: Set mode to HEAT');
                        }
                    }

                    if (accessory.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.COOL) {
                        accessory.hvac.setMode(commands.mode.value['cool']);
                        if (accessory.debug === true) {
                            log.info('setTargetHeatingCoolingState: Set mode to COOL');
                        }
                    }

                    if (accessory.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
                        accessory.hvac.setMode(commands.mode.value['auto']);
                        if (accessory.debug === true) {
                            log.info('setTargetHeatingCoolingState: Set mode to AUTO');
                        }
                    }
                }
            }
            callback();
        } catch (err) {
            callback();
        }
    },

    getTargetTemperature: function (callback) {
        var accessory = this;
        var log = this.log;
        try {
            accessory.TargetTemperature = parseInt(accessory.hvac.device.props[commands.temperature.code]);
            callback(null, accessory.TargetTemperature);
        } catch (err) {
            callback();
        }
    },

    setTargetTemperature: function (TargetTemperature, callback, context) {
        var accessory = this;
        var log = this.log;
        if (context !== 'fromSetValue') {
            accessory.TargetTemperature = TargetTemperature;
            // if ac is off, then turn it on by setting to auto mode 
            if (accessory.TargetHeatingCoolingState == Characteristic.TargetHeatingCoolingState.OFF) {
                accessory.hvac.setPower(commands.power.value.on);
            }

            // Update current temperature
            // this.GreeACService
            //     .getCharacteristic(Characteristic.CurrentTemperature)
            //     .updateValue(parseFloat(TargetTemperature));
            accessory.hvac.setTemp(parseInt(TargetTemperature));
            if (accessory.debug === true) {
                log.info('setTargetTemperature: Set temperature: ' + TargetTemperature);
            }
        }
        callback();
    },

    getCurrentTemperature: function (callback) {
        var accessory = this;
        var log = this.log;
        if (accessory.debug === true) {
            log.info("getCurrentTemperature: current temperature is %s", accessory.CurrentTemperature);
        }
        callback(null, parseFloat(accessory.CurrentTemperature));
    },

    identify: function (callback) {
        var accessory = this;
        var log = this.log;
        accessory.hvac.setTemp(22);
        if (accessory.debug === true) {
            log.info("identify: set temperature to 22");
        }
        callback();
    },

    getServices: function () {
        return this.services;
    }

};


