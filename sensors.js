import axios from "axios";
export const handler = async (event) => {
  const variablesData = event.state.reported;
  const timestamp = event.timestamp;
  const date = new Date(timestamp * 1000);
  const utcDateString = date.toISOString();

  const requests = []; // Almacenar todas las promesas de las peticiones

  const otherParams = {
    workstation_id: 0,
    event_time: utcDateString,
    data: {}, // Aquí almacenaremos las demás variables
  };

  let workstationId;
  const TOKEN = process.env.ACCESS_TOKEN;
  const HOST = process.env.HOST;
  const TOKEN_SENSORS = process.env.ACCESS_TOKEN_SENSORS;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${TOKEN}`,
  };

  const zSensors = {
    z1Real: "ECU1051_008",
    z2Real: "ECU1051_009",
    z3Real: "ECU1051_010",
    z4Real: "ECU1051_011",
    z5Real: "ECU1051_012",
    z6Real: "ECU1051_013",
  };

  let channelIndex = 1; // Contador para los canales

  // Extraer workstation_id y tipo de variable de las claves
  for (const key in variablesData) {
    if (key.startsWith("#SYS_UPTIME") || key.startsWith("#DEVICE_ERROR")) {
      continue; // Ignorar y saltar a la siguiente iteración
    }

    const [workstationPart, variable] = key.split(":");
    if (!workstationId) {
      workstationId = workstationPart.split("_")[0];
      //workstationId = key.split(":")[0];
    }
    //const variable = key.split(":")[1];
    //const [workstationId, variable] = key.split(":");
    const value = variablesData[key];

    let url;
    let params = {
      workstation_id: parseInt(workstationId),
      event_time: utcDateString,
    };

    // Enviar a la API correspondiente según la variable
    switch (variable) {
      case "count":
        url = "/api/save_parts_count";
        params.count = parseFloat(value); //parseFloat o parseInt
        otherParams.data[`channel_7`] = {
          type: "count",
          value: parseFloat(value),
        }; // Asignar a channel_6
        break;
      case "status":
        url = "/api/save_uptime";
        params.status = parseFloat(value);
        break;
      case "start":
        otherParams.data[`channel_10`] = {
          type: "start",
          value: parseFloat(value),
        }; // Asignar a channel_10
        break;
      case "stop":
        otherParams.data[`channel_9`] = {
          type: "stop",
          value: parseFloat(value),
        }; // Asignar a channel_9
        break;
      case "reset":
        otherParams.data[`channel_8`] = {
          type: "reset",
          value: parseFloat(value),
        }; // Asignar a channel_8
        break;
      default:
        //if (dynamicChannelIndex <= 7) {}
        otherParams.data[`channel_${channelIndex}`] = {
          type: variable,
          value: parseFloat(value),
        };
        channelIndex++;
        break; // No enviar la solicitud aquí, se enviará al final para otras variables
    }

    if (variable == "status" || variable == "count") {
      console.log(`Enviando a ${url} con parámetros:`, params); // Registra los parámetros enviados
      requests.push(
        axios
          .post(`${HOST}${url}`, params, { headers })
          .then((response) => {
            console.log(`Respuesta de ${url}:`, response.data);
          })
          .catch((error) => {
            console.log(`Error enviando a ${url}:`, error.message);
          })
      );
    }

    if (Object.keys(zSensors).includes(variable)) {
      const headersSensors = {
        "Content-Type": "application/json",
        Authorization: `Token ${TOKEN_SENSORS}`,
      };

      const paramsSensors = {
        sensorMessages: [
          {
            sensorID: zSensors[variable],
            applicationID: "2",
            messageDate: utcDateString,
            dataValue: parseFloat(value),
          },
        ],
        gatewayMessage: {
          date: utcDateString,
        },
      };

      console.log(
        `Enviando a ${HOST}/sensors/monit/uptimes con parámetros:`,
        paramsSensors
      );
      requests.push(
        axios
          .post(`${HOST}/sensors/monit/uptimes`, paramsSensors, {
            headers: headersSensors,
          })
          .then((respSensors) => {
            console.log(
              "Respuesta de /sensors/monit/uptimes:",
              respSensors.data
            );
          })
          .catch((error) => {
            console.error(
              "Error al enviar a /sensors/monit/uptimes:",
              error.response?.data || error.message
            );
          })
      );
    }
  }

  if (Object.keys(otherParams.data).length > 0) {
    otherParams.workstation_id = parseInt(workstationId);
    console.log(
      `Enviando a /api/save_data_channels con parámetros:`,
      otherParams
    ); // Registra el contenido de otherParams
    requests.push(
      axios
        .post(`${HOST}/api/save_data_channels`, otherParams, { headers })
        .then((response) => {
          console.log(`Respuesta de /api/save_data_channels:`, response.data);
        })
        .catch((error) => {
          console.log(
            `Error enviando a /api/save_data_channels:`,
            error.message
          );
        })
    );
  }

  try {
    await Promise.all(requests);
    console.log("Todas las peticiones completadas.");
    return { status: 200 };
  } catch (error) {
    console.error("Error al procesar las peticiones:", error.message);
    return { status: 500, error: error.message };
  }
};
