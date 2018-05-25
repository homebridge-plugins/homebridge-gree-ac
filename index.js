'use strict';
const commands = require('./app/commandEnums');
var Accessory, Service, Characteristic;
var mqtt = require('mqtt');

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-gree-ac', 'GreeAC', GreeAC);
}

function GreeAC(log, config) {
    this.log = log;
    this.name = config.name || 'Gree AC';
    this.host = config.host || '192.168.1.255';
    this.debug = ((config.debug || "false" ) === "true");
    this.updateInterval = config.updateInterval || 10000;
    this.currentTempTopic = config['currentTempTopic'] || "hvac/temperature";
    this.mqttUrl = config['mqttUrl'] || "mqtt://127.0.0.1";
    this.client_Id      = 'mqttjs_' + Math.random().toString(16).substr(2, 8);

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

    this.client  = mqtt.connect(this.mqttUrl, this.mqttOptions);

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
                minValue: 17,
                minStep: 1
            })
            .on('set', this.setTargetTemperature.bind(this))
            .on('get', this.getTargetTemperature.bind(this));

    this.GreeACService
        .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                maxValue: 30,
                minValue: 17,
                minStep: 1
            })
            .on('get', this.getCurrentTemperature.bind(this));

    // this.GreeACService
    //     .getCharacteristic(Characteristic.SwingMode)
    //         .setProps({
    //                     minValue: 0,
    //                     maxValue: 11,
    //                     minStep: 1
    //                 })
    //         .on('get', this.getSwing.bind(this))
    //         .on('set', this.setSwing.bind(this));

    // this.GreeACService
    //     .getCharacteristic(Characteristic.RotationSpeed)
    //             .setProps({
    //                 minValue: 0,
    //                 maxValue: 5,
    //                 minStep: 1
    //             })
    //             .on('get', this.getRotationSpeed.bind(this))
    //             .on('set', this.setRotationSpeed.bind(this));

    this.services.push(this.GreeACService);

    this.serviceInfo = new Service.AccessoryInformation();

    this.serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'Gree')
        .setCharacteristic(Characteristic.Model, 'Bora A5')
        .setCharacteristic(Characteristic.SerialNumber, 'GREEBORAA5');

    this.services.push(this.serviceInfo);

    this.discover();
}

GreeAC.prototype = {

    discover: function(){
        var accessory = this;
        var log = this.log;
        var host = this.host;
        var debug = this.debug;

        const deviceOptions = {
          host: host,
          updateInterval: this.updateInterval,
          onStatus: (deviceModel) => {
            var device_power_status = deviceModel.props[commands.power.code];
            var device_mode_status = deviceModel.props[commands.mode.code];
            var device_temperature = deviceModel.props[commands.temperature.code];
            var device_swingvert = deviceModel.props[commands.swingVert.code] === 0 ? 0:1;
            accessory.TargetTemperature = parseFloat(device_temperature);

            if (device_power_status === commands.power.value.off) {
                  accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;
            } else if (device_mode_status === commands.mode.value.auto) {
                  accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
            } else if  (device_mode_status === commands.mode.value.cool) {
                  accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.COOL;
            } else if  (device_mode_status === commands.mode.value.heat) {
                  accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.HEAT;
            } else {
                  accessory.TargetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;
            }

            this.GreeACService
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .updateValue(accessory.TargetHeatingCoolingState);

            this.GreeACService
                .getCharacteristic(Characteristic.TargetTemperature)
                .updateValue(accessory.TargetTemperature);

            if (accessory.debug === true) {
                this.log.info('Get mode: %s', device_mode_status.toString());
                this.log.info('Get temperature %s', device_temperature.toString());
                this.log.info('Get fanspeed %s', deviceModel.props[commands.fanSpeed.code].toString());
                this.log.info('Get swingvert %s', device_swingvert.toString());
                this.log.info('Get powerstatus %s', device_power_status.toString());
            }
          },
          onUpdate: (deviceModel) => {
            this.log.info('Status updated on %s', deviceModel.name)
          },
          onConnected: (deviceModel) => {
            var accesorry = this;
            accesorry.log.info('Connecting on %s with ip address %s[%d] debug=%s: %s', deviceModel.name, deviceModel.address, deviceModel.port, accesorry.debug, deviceModel.bound ? "SUCCESS": "FAIL");
            accesorry.client.subscribe(this.currentTempTopic);
            accesorry.client.on('message', function (topic, message) {
                try {
                  data = JSON.parse(message);
                } catch (e) {
                  return null;
                }

                if (data === null) {return null}
                var that = this;
                that.temperature = parseFloat(data);
                if (!isNaN(that.temperature)) {
                    if (accesorry.debug === true) {
                        accesorry.log.info('Current temperature is ' + that.temperature);
                    }
                    accesorry.CurrentTemperature = parseFloat(that.temperature);
                    accesorry.GreeACService
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .updateValue(accesorry.CurrentTemperature);
                }
            });
          },
          onError: (deviceModel) => {
            if (this.debug === true) {
                this.log.info('Connecting on %s with ip address %s[%d]: %s', deviceModel.name, deviceModel.address, deviceModel.port, deviceModel.bound ? "SUCCESS": "FAIL");
            }
          },
          onDisconnected: (deviceModel) => {
            if (this.debug === true ) {
                this.log.info('Connecting on %s with ip address %s[%d]: %s', deviceModel.name, deviceModel.address, deviceModel.port, deviceModel.bound ? "SUCCESS": "FAIL");
            }
          }
        };
        accessory.hvac = require('./app/deviceFactory').connect(deviceOptions);
    },

    setTemperatureDisplayUnits: function(value, callback) {
        if (this.debug === true) {
            this.log.info("setTemperatureDisplayUnits from %s to %s", this.temperatureDisplayUnits, value);
        }
        this.temperatureDisplayUnits = value;
        callback(null);
    },
    
    getTemperatureDisplayUnits: function(callback) {
        this.temperatureDisplayUnits = this.hvac.device.props[commands.temperatureUnit.code];
        if (this.debug === true) {
            this.log.info("getTemperatureDisplayUnits: ", this.temperatureDisplayUnits);
        }
        callback(null, this.temperatureDisplayUnits);
    },

    getTargetHeatingCoolingState: function(callback) {
        var state = Characteristic.TargetHeatingCoolingState.AUTO;
        var accessory = this;
        if (this.hvac.device.props[commands.power.code] === commands.power.value.off) {
                  state = Characteristic.TargetHeatingCoolingState.OFF;
        } else if (this.hvac.device.props[commands.mode.code] === commands.mode.value.auto) {
                  state = Characteristic.TargetHeatingCoolingState.AUTO;
        } else if  (this.hvac.device.props[commands.mode.code] === commands.mode.value.cool) {
                  state = Characteristic.TargetHeatingCoolingState.COOL;
        } else if  (this.hvac.device.props[commands.mode.code] === commands.mode.value.heat) {
                  state = Characteristic.TargetHeatingCoolingState.HEAT;
        }

        accessory.TargetHeatingCoolingState = state;
        callback(null, this.TargetHeatingCoolingState);
    },

    setTargetHeatingCoolingState: function(TargetHeatingCoolingState, callback, context) {
        if(context !== 'fromSetValue') {
            this.TargetHeatingCoolingState = TargetHeatingCoolingState;
            if (this.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.OFF) {
                this.hvac.setPower(commands.power.value.off);
                if (this.debug === true){
                    this.log.info('setTargetHeatingCoolingState: Set mode power off');
                }
            } else {
                if (this.hvac.device.props[commands.power.code] === commands.power.value.off) {
                  this.hvac.setPower(commands.power.value.on);
                  if (this.debug === true){
                        this.log.info('setTargetHeatingCoolingState: Set mode power on');
                    }
                }

                if (this.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.HEAT) {
                    this.hvac.setMode(commands.mode.value['heat']);
                    if (this.debug === true) {
                        this.log.info('setTargetHeatingCoolingState: Set mode to HEAT');
                    }
                }

                if (this.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.COOL) {
                    this.hvac.setMode(commands.mode.value['cool']);
                    if (this.debug === true) {
                        this.log.info('setTargetHeatingCoolingState: Set mode to COOL');
                    }
                }

                if (this.TargetHeatingCoolingState === Characteristic.TargetHeatingCoolingState.AUTO) {
                    this.hvac.setMode(commands.mode.value['auto']);
                    if (this.debug === true) {
                        this.log.info('setTargetHeatingCoolingState: Set mode to AUTO');
                    }
                }
            }
        }
        callback();
    },

    getTargetTemperature: function(callback) {
        this.TargetTemperature = parseInt(this.hvac.device.props[commands.temperature.code]);
        callback(null, this.TargetTemperature);
    },

    setTargetTemperature: function(TargetTemperature, callback, context) {
        if(context !== 'fromSetValue') {
            this.TargetTemperature = TargetTemperature;
            // if ac is off, then turn it on by setting to auto mode 
            if (this.TargetHeatingCoolingState == Characteristic.TargetHeatingCoolingState.OFF) {
                this.hvac.setPower(commands.power.value.on);
            }

            // Update current temperature
            // this.GreeACService
            //     .getCharacteristic(Characteristic.CurrentTemperature)
            //     .updateValue(parseFloat(TargetTemperature));
            this.hvac.setTemp(parseInt(TargetTemperature));
            if (this.debug === true) {
                this.log.info('setTargetTemperature: Set temperature: ' + TargetTemperature);
            }
        }
        callback();
    },

    getCurrentTemperature: function(callback) {
        if (this.debug === true) {
            this.log.info("getCurrentTemperature: current temperature is %s", this.CurrentTemperature);
        }
        callback(null, parseFloat(this.CurrentTemperature));
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        return this.services;
    }
};

