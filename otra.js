//TD_Light_ON
//Triggers: EventBridge (CloudWatch Events):
//18_00 cron(00 01 * * ? *)
//20_00 cron(00 03 * * ? *)
//17_45 cron(45 00 * * ? *)
//Environment variables: ENDPOINT a22mojyqfxw6ju-ats.iot.us-west-1.amazonaws.com
import mqtt from "mqtt";
import AWS from "aws-sdk";
const iotData = new AWS.IotData({
  endpoint: process.env.ENDPOINT,
});

const getMinutesOfDay = (hours, minutes) => {
  return hours * 60 + minutes;
};

// Lista de dispositivos
const deviceConfig = [
  {
    deveui: "24e124756d182982",
    switches: [{ switch: "all", onTime: "18:00", offTime: "06:00" }],
  },
  {
    deveui: "24e124756d182464",
    switches: [{ switch: "all", onTime: "20:00", offTime: "06:00" }],
  },
  {
    deveui: "24e124756d181942",
    switches: [{ switch: "all", onTime: "20:00", offTime: "24:00" }],
  },
  {
    deveui: "24e124756d183539",
    switches: [{ switch: "all", onTime: "18:00", offTime: "24:00" }],
  },
  {
    deveui: "24e124756d468320",
    switches: [{ switch: "all", onTime: "18:00", offTime: "22:30" }],
  },
  {
    deveui: "24e124756d182503",
    switches: [{ switch: "all", onTime: "17:45", offTime: "05:45" }],
  },
  {
    deveui: "24e124756d182358",
    switches: [
      { switch: 1, onTime: "17:45", offTime: "05:45" },
      { switch: 5, onTime: "18:00", offTime: "06:00" },
    ],
  },
  {
    deveui: "24e124756d182184",
    switches: [{ switch: "all", onTime: "18:00", offTime: "23:00" }],
  },
  {
    deveui: "24e124756d182872",
    switches: [{ switch: "all", onTime: "18:00", offTime: "06:00" }],
  },
];
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
export const handler = async (event) => {
  const isWithin = (targetTime, currentTime) => {
    const [targetHour, targetMinute] = targetTime.split(":").map(Number);
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);

    return (
      (targetHour === currentHour && targetMinute === currentMinute) || // Coincide exactamente
      (targetHour === currentHour && targetMinute + 1 === currentMinute) // Es un minuto después
    );
  };

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "America/Mazatlan",
    hour: "2-digit",
    minute: "2-digit",
  });
  //const currentTime = "18:00";
  console.log("Hora actual", currentTime);
  const matchingSwitches = deviceConfig.flatMap((device) =>
    device.switches
      //.filter((sw) => sw.onTime === currentTime)
      .filter((sw) => isWithin(sw.onTime, currentTime))
      .map((sw) => ({
        deveui: device.deveui,
        command: ON_COMMANDS[sw.switch],
      }))
  );
  if (matchingSwitches.length === 0) {
    console.log("No coincidencias de dispositivos para este horario");
    return {
      status: 200,
      message: "No dispositivos para procesar en este horario",
    };
  }
  // Crear una lista de promesas de publicación
  const publishPromises = matchingSwitches.map(async ({ deveui, command }) => {
    const topic = `/TD/downlink/${deveui}`; // Define el topic con el deveui
    const params = {
      topic: topic,
      qos: 0,
      payload: JSON.stringify({ data: command }),
    };
    try {
      // Publica el mensaje a IoT Core
      //await iotData.publish(params).promise();
      console.log(`Sent command ${command} to ${topic}`);
    } catch (error) {
      console.error(`Error sending command ${command} to ${topic}:`, error);
    }
  });
  try {
    await Promise.all(publishPromises);
    console.log("Todas las peticiones completadas.");
    return { status: 200 };
  } catch (error) {
    console.error("Error al procesar las peticiones:", error.message);
    return { status: 500, error: error.message };
  }
};
