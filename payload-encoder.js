/**
 * Payload Encoder for Magali Miranda
 *
 * @product WS558
 * @params
 *     - fPort: 85
 *     - obj: {"key": "value"}
 */
function Encode(fPort, obj) {
  // Canal 8
  var channel = 0x08;

  // Byte 1: Control flags (permite controlar los switches indicados en el objeto)
  // Byte 2: Switch flags  (permite establecer el estado que tomarán los switches)
  var controlFlags = 0x00; // Inicializamos con 0
  var switchFlags = 0x00; // Inicializamos co

  // Mapeamos los valores de control y estado de los switches
  for (var i = 0; i < 8; i++) {
    var switchTag = "switch_" + (i + 1);

    if (obj.hasOwnProperty(switchTag)) {
      // Permitir control para este switch
      controlFlags |= 1 << i;

      // Establecer el estado del switch (1 = abierto, 0 = cerrado)
      if (obj[switchTag] === 1) {
        switchFlags |= 1 << i;
      }
    }
  }

  // Devolvemos los valores en un array de bytes
  return [channel, controlFlags, switchFlags];
}
