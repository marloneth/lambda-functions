import mqtt from "mqtt";
import AWS from "aws-sdk";
import moment from "moment";

const ON = "on";
const OFF = "off";
const ON_COMMANDS = {
  1: "CAEB", //080101: 00001000 00000001 00000001
  2: "CAIC", //080202: 00001000 00000010 00000010
  3: "CAQE", //080404: 00001000 00000100 00000100
  4: "CAgI", //080808: 00001000 00001000 00001000
  5: "CBAQ", //081010: 00001000 00010000 00010000
  6: "CCAg", //082020: 00001000 00100000 00100000
  7: "CEBA", //084040: 00001000 01000000 01000000
  8: "CICA", //088080: 00001000 10000000 10000000
  all: "CP//", //08ffff: 00001000 11111111 11111111
};

const OFF_COMMANDS = {
  1: "CAEA", //080100: 00001000 00000001 00000000
  2: "CAIA", //080200: 00001000 00000010 00000000
  3: "CAQA", //080400: 00001000 00000100 00000000
  4: "CAgA", //080800: 00001000 00001000 00000000
  5: "CBAA", //081000: 00001000 00010000 00000000
  6: "CCAA", //082000: 00001000 00100000 00000000
  7: "CEAA", //084000: 00001000 01000000 00000000
  8: "CIAA", //088000: 00001000 10000000 00000000
  all: "CP8A", //08ff00: 00001000 11111111 00000000
};

const devicesLight = {
  "24e124756d182982": {}, //Luminaria - Mountage
  "24e124756d182464": {
    switch_1: {
      onTime: "18:15",
      offTime: "06:30",
    },
    switch_8: {
      onTime: "13:00",
      offTime: "11:00",
    },
  }, //Luminaria - Santa Maria
  "24e124756d182052": {}, //Luminaria - Cielo Nuevo
  "24e124756d183539": {}, //Luminaria - Carcamo 5
  "24e124756d182493": {}, //Luminaria - Estacionamiento colaboradores
  "24e124756d182184": {}, //Luminaria - PTAR
  "24e124756d183140": {
    switch_5: {
      onTime: "13:00",
      offTime: "11:00",
    },
    switch_6: {
      onTime: "18:30",
      offTime: "22:30",
    },
  }, //Luminaria - Sector 18
  "24e124756d182503": {}, //Luminaria - Patio norte mantenimiento golf
  "24e124756d182358": {}, //Luminaria - Escaleras RH
  "24e124756d182872": {
    switch_1: {
      onTime: "18:15",
      offTime: "06:30",
    },
    switch_8: {
      onTime: "13:00",
      offTime: "11:00",
    },
  }, //Luminaria - Desaladora
  "24e124756c468514": {
    switch_1: {
      onTime: "18:15",
      offTime: "06:30",
    },
    switch_5: {
      onTime: "13:00",
      offTime: "11:00",
    },
  }, //Luminaria - Caseta de Retorno
  "24e124756c468320": {}, //Luminaria - TD Casita
  "24e124756d182319": {
    switch_1: {
      onTime: "13:00",
      offTime: "11:00",
    },
    switch_5: {
      onTime: "18:15",
      offTime: "00:00",
    },
  }, //Luminaria - Patio de Colaboradores
  "24e124756d182024": {}, //Luminaria - Caseta Olas
  "24e124756d181875": {}, //Luminaria - Carcamo 1
  "24e124756d182943": {}, //Luminaria - Carcamo 2
  "24e124756d182278": {}, //Luminaria - Brisas
  "24e124756d182031": {}, //Luminaria - Letrero San Lucas
  "24e124756d182421": {
    switch_1: {
      onTime: "18:15",
      offTime: "06:30",
    },
    switch_8: {
      onTime: "13:00",
      offTime: "11:00",
    },
  }, //Luminaria - Redor 12
};

const iotData = new AWS.IotData({
  endpoint: process.env.ENDPOINT,
});

export const handler = async (event) => {
  const promises = [];
  const { deveui, data, time } = event;

  if (!Object.keys(devicesLight).includes(deveui)) {
    console.log("El dispositivo actual no esta en la lista");
    return;
  }

  const lightsSchedule = Object.entries(devicesLight[deveui]);
  if (!Object.keys(lightsSchedule).length) {
    console.log("El dispositivo actual no tiene horarios programados");
    return;
  }

  for (const [switchName, { onTime, offTime }] of lightsSchedule) {
    let params = {
      topic: `/TD/downlink/${deveui}`,
      qos: 0,
    };

    const now = moment(time).utc();
    const currentSwitchStatus = data[switchName];
    const [_, switchNumber] = switchName.split("_");
    const nowDate = now.format("YYYY-MM-DD");
    const startLightOn = moment(
      `${nowDate} ${onTime}`,
      "YYYY-MM-DD HH:mm"
    ).utc();

    const endLightOn = moment(
      `${nowDate} ${offTime}`,
      "YYYY-MM-DD HH:mm"
    ).utc();

    // Si la hora de apagado esta antes de la hora de encendido, se considera hora del siguiente dia
    if (endLightOn.isBefore(startLightOn)) endLightOn.add(1, "day");

    // Si la hora actual esta antes de la hora de encendido, se considera hora del siguiente dia
    if (now.isBefore(startLightOn)) now.add(1, "day");

    const shouldBeOn = now.isBetween(startLightOn, endLightOn, undefined, "[)");

    if (currentSwitchStatus === ON && !shouldBeOn) {
      // APAGAR
      console.log("Luminaria encendida, deberia estar apagada. APAGANDO");
      params.payload = JSON.stringify({ data: OFF_COMMANDS[switchNumber] });
    }

    if (currentSwitchStatus === OFF && shouldBeOn) {
      // ENCENDER
      console.log("Luminaria apagada, deberia estar encendida. ENCENDIENDO");
      params.payload = JSON.stringify({ data: ON_COMMANDS[switchNumber] });
    }

    if (params.payload) promises.push(iotData.publish(params).promise());
  }

  try {
    await Promise.all(promises);
    console.log("Todas las peticiones completadas.");
    return { status: 200 };
  } catch (error) {
    console.error("Error al procesar las peticiones:", error.message);
    return { status: 500, error: error.message };
  }
};

handler(event);
