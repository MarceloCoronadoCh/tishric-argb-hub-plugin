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
| ARGB channels | 10 (up to 8 fans + pump/rear) |
| Transport | USB HID (64-byte reports) |

### Tested hardware

Tested with the **TISHRIC 1 to 10 5V 3-Pin ARGB Hub**, connected **only through
the USB 2.0 header** — the 3-pin ARGB connector is **not** used.

![TISHRIC hub connected via USB 2.0](img/hub-usb2.jpg)

### Features

- **10 channels** in SignalRGB (Port 1..10): drag components (fan rings, pump,
  strips) onto each port and set its LED count.
- **Per-port static color**: each port keeps its own independent color, matching
  what the official app can do — colors are only written when they change
  (the firmware retains them).
- **Uniform animated mode** (optional): streams one animated color for all
  channels at full frame rate.
- Port Test Mode (identify physical ports), channel Pulse mirroring, global
  brightness, color-order adjustment, configurable shutdown color.
- Keeps the vendor heartbeat so the hub doesn't freeze.

### Installation

1. Install [SignalRGB](https://signalrgb.com).
2. Copy the plugin folder to:

   ```
   %USERPROFILE%\Documents\WhirlwindFX\Plugins\Tishric\Tishric.js
   ```

3. Connect the TISHRIC hub to a USB port/header.
4. **Close the original software** (`HJ ARGB HUB` / `Sync_light.exe`) — it
   competes for the same device.
5. Open (or restart) SignalRGB, place **"TISHRIC ARGB Hub"** in the canvas,
   and assign components to each Port channel.

### Usage tips

- Assign a component to each port and set the LED count. Unassigned ports stay
  black (unless pulsing from the UI).
- Use **Port Test Mode → One port at a time** to map which physical group is
  each port (each lights white for 2s in sequence).
- If red/blue look swapped, change **Color Order**.

### Protocol (summary)

Frames are 64-byte HID reports written with a leading report-id `0x00`:

```
[0x00, 'R'(0x52), 'B'(0x42), LEN, 0x00, CMD, params..., CHK]
```

- `LEN` counts **all** bytes of the wire frame, including the report id and the
  checksum byte.
- `CHK` = sum of every byte before it `& 0xFF`.

| CMD | Meaning | Frame |
| --- | --- | --- |
| `0x00` | heartbeat / info | `52 42 06 00 00 9A` |
| `0x01` | channel detect (×10) | `52 42 07 00 01 FF` |
| `0x03` | lighting (uniform or per-port) | `52 42 3C 00 03 ...` |
| `0x05` | set port mode/value | `52 42 08 00 05 <port> <value>` |
| `0x08` | fan switch / speed ownership | `52 42 08 00 08 <flag>` |
| `0xFD` | lighting ownership (1 = external app, 0 = release) | `52 42 07 00 FD 01` |

Lighting — uniform animated (all channels same):

```
52 42 3C 00 03 FF FF | 00 03 01 <B> | 16 × (R,G,B)
```

Lighting — per-port static (independent sections):

```
52 42 08 00 05 <port> 01 <ck>          # set port mode = static
52 42 3C 00 03 FD <port> | 04 01×5 00 03 03 03 01×3 <B>×3 | palette: 12 × (R,G,B)
```

The palette's first triplet is the port's static color.

The protocol was reverse-engineered from USB captures (Wireshark + USBPcap)
and from the vendor's application bytecode (`agreement.py` / `port.py` inside
the official installer).

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
| Canales ARGB | 10 (hasta 8 fans + bomba/trasero) |
| Transporte | USB HID (reportes de 64 bytes) |

### Hardware probado

Probado con el **TISHRIC 1 a 10 ARGB Hub de 5V 3 pines**, conectado
**únicamente por el conector USB 2.0** — el conector ARGB de 3 pines **no** se usa.

![Hub TISHRIC conectado por USB 2.0](img/hub-usb2.jpg)

### Características

- **10 canales** en SignalRGB (Puerto 1..10): arrastrá componentes (rings de
  fans, bomba, tiras) a cada puerto y configurá la cantidad de LEDs.
- **Color estático por puerto**: cada puerto mantiene su color independiente,
  igual que la app oficial — los colores solo se escriben cuando cambian (el
  firmware los retiene).
- **Modo uniforme animado** (opcional): transmite un color animado para todos
  los canales a la velocidad completa de cuadros.
- Modo de prueba de puertos (identificar grupos físicos), reflejo del pulso de
  canales, brillo global, ajuste de orden de color, color de apagado.
- Mantiene el heartbeat del firmware para que el hub no se congele.

### Instalación

1. Instalar [SignalRGB](https://signalrgb.com).
2. Copiar la carpeta del plugin a:

   ```
   %USERPROFILE%\Documents\WhirlwindFX\Plugins\Tishric\Tishric.js
   ```

3. Conectar el hub TISHRIC a un puerto/header USB.
4. **Cerrar el software original** (`HJ ARGB HUB` / `Sync_light.exe`) — compite
   por el mismo dispositivo.
5. Abrir (o reiniciar) SignalRGB, ubicar **"TISHRIC ARGB Hub"** en el canvas y
   asignar componentes a cada canal de Puerto.

### Tips de uso

- Asigná un componente a cada puerto y configurá sus LEDs. Los puertos sin
  asignar quedan negros (salvo cuando pulsás desde la UI).
- Usá **Port Test Mode → One port at a time** para mapear qué grupo físico es
  cada puerto (se enciende blanco 2s cada uno en secuencia).
- Si rojo/azul se ven intercambiados, cambiá el **Color Order**.

### Protocolo (resumen)

Las tramas son reportes HID de 64 bytes con report-id `0x00` inicial:

```
[0x00, 'R'(0x52), 'B'(0x42), LEN, 0x00, CMD, params..., CHK]
```

- `LEN` cuenta **todos** los bytes del wire frame, incluidos el report-id y el
  checksum.
- `CHK` = suma de todos los bytes previos `& 0xFF`.

| CMD | Significado | Trama |
| --- | --- | --- |
| `0x00` | heartbeat / info | `52 42 06 00 00 9A` |
| `0x01` | detección de canales (×10) | `52 42 07 00 01 FF` |
| `0x03` | iluminación (uniforme o por puerto) | `52 42 3C 00 03 ...` |
| `0x05` | setear modo/valor de puerto | `52 42 08 00 05 <puerto> <valor>` |
| `0x08` | interruptor de fans / ownership de velocidad | `52 42 08 00 08 <flag>` |
| `0xFD` | ownership de iluminación (1 = app externa, 0 = liberar) | `52 42 07 00 FD 01` |

Iluminación — uniforme animada (todos los canales iguales):

```
52 42 3C 00 03 FF FF | 00 03 01 <B> | 16 × (R,G,B)
```

Iluminación — estática por puerto (secciones independientes):

```
52 42 08 00 05 <puerto> 01 <ck>          # setear modo estático del puerto
52 42 3C 00 03 FD <puerto> | 04 01×5 00 03 03 03 01×3 <B>×3 | paleta: 12 × (R,G,B)
```

El primer trío de la paleta es el color estático del puerto.

El protocolo se obtuvo por ingeniería inversa a partir de capturas USB
(Wireshark + USBPcap) y del bytecode de la aplicación oficial
(`agreement.py` / `port.py` dentro del instalador).

### Licencia

Ver [LICENSE](LICENSE).