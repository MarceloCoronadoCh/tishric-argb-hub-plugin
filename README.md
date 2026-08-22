# TISHRIC ARGB Hub — SignalRGB Plugin

[English](#english) · [Español](#español)

---

<a name="english"></a>
## English

A [SignalRGB](https://signalrgb.com) plugin to control the **TISHRIC** ARGB/PWM
hub (a rebrand of ROBOBLOQ) that connects through the motherboard's internal
USB 2.0 header.

### Supported hardware

| Field | Value |
| --- | --- |
| VID / PID | `1A86` / `FE05` |
| USB description | `USBFAN` |
| Chip manufacturer | WCH (CH552) |
| ARGB channels | 10 (controls up to 8 fans + pump/rear) |
| Transport | USB HID (64-byte reports, no Report ID) |

### Tested hardware

This plugin was tested with the **TISHRIC 1 to 10 5V 3-Pin ARGB Hub**, connected
**only through the USB 2.0 header** — the 3-pin ARGB connector is **not** used.

![TISHRIC hub connected via USB 2.0](img/hub-usb2.jpg)

### Features

- Detects the hub as a **single RGB device** in the SignalRGB canvas.
- The chosen color is broadcast uniformly to **all hub channels**.
- Configurable parameters: shutdown color, lighting mode (Canvas / Forced),
  and forced color.
- Keeps the *heartbeat* the hub's firmware requires to avoid freezing.

### Installation

1. Install [SignalRGB](https://signalrgb.com).
2. Copy the plugin folder to:

   ```
   %USERPROFILE%\Documents\WhirlwindFX\Plugins\Tishric\Tishric.js
   ```

   (the `WhirlwindFX` folder is created automatically when SignalRGB is
   installed; if `Plugins` does not exist, create it).

3. Connect the TISHRIC hub to a USB port/header.
4. **Close the original software** (`HJ ARGB HUB` / `Sync_light.exe`), since it
   competes for the same device.
5. Open (or restart) SignalRGB and place **"TISHRIC ARGB Hub"** in the canvas.

### Protocol (summary)

The hub uses 64-byte HID reports with magic `RB` (`0x52 0x42`):

| Byte | Field |
| --- | --- |
| 0–1 | magic `RB` |
| 2 | command type |
| ... | payload |
| variable | checksum = sum of previous bytes `& 0xFF` |

Command types and their checksum offset:

| Type | Command | Checksum at |
| --- | --- | --- |
| `0x06` | heartbeat | byte 5 |
| `0x07` | fan / PWM | byte 6 |
| `0x3C` | lighting (color) | byte 59 |
| `0x39` | hub response (channel list) | — |

Lighting command (`0x3C`), direct color mode:

- byte 7 = `0x00` (direct mode)
- byte 10 = brightness (`0x99`)
- bytes 11+ = RGB triplets (one per channel)

The protocol was reverse-engineered (USB captures with Wireshark + USBPcap).
It is a generic ARGB fan hub based on a WCH CH552 chip, common in Chinese
"1 to 10" fan hubs.

### License

See [LICENSE](LICENSE).

---

<a name="español"></a>
## Español

Un plugin de [SignalRGB](https://signalrgb.com) para controlar el hub ARGB/PWM
**TISHRIC** (rebranding de ROBOBLOQ) que se conecta por el header USB 2.0 de la
placa madre.

### Hardware soportado

| Dato | Valor |
| --- | --- |
| VID / PID | `1A86` / `FE05` |
| Descripción USB | `USBFAN` |
| Fabricante del chip | WCH (CH552) |
| Canales ARGB | 10 (controla hasta 8 fans + bomba/trasero) |
| Transporte | USB HID (reportes de 64 bytes, sin Report ID) |

### Hardware probado

Este plugin fue probado con el **TISHRIC 1 a 10 ARGB Hub de 5V 3 pines**,
conectado **únicamente por el conector USB 2.0** — el conector ARGB de 3 pines
**no** se utiliza.

![Hub TISHRIC conectado por USB 2.0](img/hub-usb2.jpg)

### Características

- Detecta el hub como **un solo dispositivo RGB** en el canvas de SignalRGB.
- El color elegido se transmite de forma uniforme a **todos los canales** del hub.
- Parámetros configurables: color de apagado, modo de iluminación
  (Canvas / Forced) y color forzado.
- Mantiene el *heartbeat* que el firmware del hub requiere para no colgarse.

### Instalación

1. Instalar [SignalRGB](https://signalrgb.com).
2. Copiar la carpeta del plugin a:

   ```
   %USERPROFILE%\Documents\WhirlwindFX\Plugins\Tishric\Tishric.js
   ```

   (la carpeta `WhirlwindFX` se crea automáticamente al instalar SignalRGB; si
   no existe `Plugins`, crearla).

3. Conectar el hub TISHRIC a un puerto/header USB.
4. **Cerrar el software original** (`HJ ARGB HUB` / `Sync_light.exe`), ya que
   compite por el mismo dispositivo.
5. Abrir (o reiniciar) SignalRGB y ubicar **"TISHRIC ARGB Hub"** en el canvas.

### Protocolo (resumen)

El hub usa reportes HID de 64 bytes con magic `RB` (`0x52 0x42`):

| Byte | Campo |
| --- | --- |
| 0–1 | magic `RB` |
| 2 | tipo de comando |
| ... | payload |
| variable | checksum = suma de los bytes previos `& 0xFF` |

Tipos de comando y su offset de checksum:

| Tipo | Comando | Checksum en |
| --- | --- | --- |
| `0x06` | heartbeat | byte 5 |
| `0x07` | fan / PWM | byte 6 |
| `0x3C` | iluminación (color) | byte 59 |
| `0x39` | respuesta del hub (lista de canales) | — |

Comando de iluminación (`0x3C`), modo color directo:

- byte 7 = `0x00` (modo directo)
- byte 10 = brillo (`0x99`)
- bytes 11+ = tripletas RGB (una por canal)

El protocolo fue extraído mediante ingeniería inversa (capturas USB con
Wireshark + USBPcap). Es un hub de ventiladores ARGB genérico con chip WCH
CH552, frecuente en hubs chinos "1 a 10".

### Licencia

Ver [LICENSE](LICENSE).
