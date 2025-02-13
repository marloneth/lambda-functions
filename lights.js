import mqtt from "mqtt";
import AWS from "aws-sdk";
import moment from "moment";

const ON = "on";
const OFF = "off";

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

const generateCommand = (data) => {
  const channel = 0x08;
  let controlFlags = 0x00;
  let switchFlags = 0x00;
  let byteArray = null;

  for (let i = 0; i < 8; i++) {
    const switchTag = `switch_${i + 1}`;

    if (!data.hasOwnProperty(switchTag)) continue;
    // Permitir control para este switch
    controlFlags |= 1 << i;

    // Establecer el estado del switch (1 = abierto, 0 = cerrado)
    if (!data[switchTag]) continue;
    switchFlags |= 1 << i;
  }

  byteArray = new Uint8Array([channel, controlFlags, switchFlags]);
  return btoa(String.fromCharCode(...byteArray));
};

export const handler = async (event) => {
  const switchesData = {};
  const { deveui, data } = event;

  if (!Object.keys(devicesLight).includes(deveui)) {
    console.log(`El dispositivo ${deveui} no esta en la lista`);
    return;
  }

  const lightsSchedule = Object.entries(devicesLight[deveui]);
  if (!Object.keys(lightsSchedule).length) {
    console.log(`El dispositivo ${deveui} no tiene horarios programados`);
    return;
  }

  for (const [switchTag, { onTime, offTime }] of lightsSchedule) {
    const now = moment().subtract(7, "hours").utc();
    const currentSwitchStatus = data[switchTag];
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
      console.log(
        `Luminaria ${deveui} - ${switchTag} encendida, deberia estar apagada. APAGANDO`
      );
      switchesData[switchTag] = 1;
    }

    if (currentSwitchStatus === OFF && shouldBeOn) {
      // ENCENDER
      console.log(
        `Luminaria ${deveui} - ${switchTag} apagada, deberia estar encendida. ENCENDIENDO`
      );
      switchesData[switchTag] = 0;
    }
  }

  if (!Object.keys(switchesData).length) return;

  try {
    const params = {
      topic: `/TD/downlink/${deveui}`,
      qos: 0,
      payload: JSON.stringify({ data: generateCommand(switchesData) }),
    };

    await iotData.publish(params).promise();
    console.log("Peticion completada.");
    return { status: 200 };
  } catch (error) {
    console.error("Error al procesar la peticion:", error.message);
    return { status: 500, error: error.message };
  }
};

handler(event);
