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
- **Per-port animated lighting**: each port samples its canvas stream into a
  12-color palette and the firmware cycles/interpolates it on its own — smooth
  animation per section without heavy streaming (type 2). Fully static
  streams switch the port to a fixed-color mode (type 1) with zero ongoing
  traffic; degenerate (monochrome) palettes inside the palette-playback mode
  hold the last palette briefly instead of flipping modes (avoids the
  firmware's green glitch).
- **Hub Flow Speed** setting (0-6, vendor "liusu"): controls how fast the
  firmware cycles the palettes.
- **Uniform animated mode** (optional): streams one animated color for all
  channels at full frame rate.
- **Custom effects included** (`effects/`): "Neon Shift (Custom)" and its
  "NS Ultravioleta" preset — drop-in HTML effects for SignalRGB with your own
  selectable colors. Copy them to
  `%USERPROFILE%\Documents\WhirlwindFX\Effects\Custom\`.
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
| `0x01` | channel detect (×10) → `0x39` map | `52 42 07 00 01 FF` |
| `0x02` | set ONE port parameter | `52 42 0C 00 02 <port> <function> <param>` |
| `0x03` | effect config write (scope + 52B payload) | `52 42 40 00 03 <order> <port>` |
| `0x05` | set port type | `52 42 08 00 05 <port> <type>` |
| `0x06` | lights off | `52 42 06 00 06` |
| `0x07` | auto-detect LED counts | `52 42 06 00 07` |
| `0x08` | fan speed ownership (RPM control hand-off) | `52 42 07 00 08 <flag>` |
| `0x0B` | boot lighting (1 = fixed, 255 = memory) | `52 42 07 00 0B <v>` |
| `0x0C` | boot self-check on/off | `52 42 07 00 0C <v>` |
| `0x87` | global brightness | `52 42 07 00 87 <b>` |
| `0xF9` | save current effects to flash | `52 42 06 00 F9 21` |
| `0xFA` | reset the ARGB controller | `52 42 06 00 FA 42` |
| `0xFC` | save + reboot controller | `52 42 06 00 FC 44` |
| `0xFD` | lighting ownership (1 = external app, 0 = release) | `52 42 07 00 FD 01` |

Vendor names (from the decompiled `agreement.py`): `0x02` `ARGB_dan_config(id,
function, param)`; `0x03` `ARGB_ten_effect(order, num)`; `0x05`
`argb_fan_set(ser, id)`; `0x06` `argb_fan_light_off`; `0x07`
`argb_auto_rgb_num`; `0x08` `argb_cp_mcu_fan_speed` — the fan-RPM frames
(`0xFB`/`0x9D`) only work AFTER this ownership flag is taken; `0xFA`
`argb_fan_reset`; `0xFC` `argb_fan_save`.

`0x03` scope byte (`order`): `0xFD` = the single port passed as `num`;
`0xFE` = group-async; `0xFF` = sync-all.

Port types (`0x05`): `1` = static (single color), `2` = palette playback
(the firmware cycles/interpolates the 12 palette colors; a monochrome
palette glitches it — the plugin holds the previous palette instead).

The 52-byte payload of `0x03`:

```
[0]     effect id  (0..29 per the vendor docstring "dengxiao_id: 0-29")
[1]     flow speed (0..6 — the vendor's slider maps (60 - speed) / 10)
[2..15] effect parameters
[16..51] palette: 12 × (R,G,B)
```

The plugin uses effect id `4` (palette playback) for everything.

Streaming: the CH552 firmware processes only ~2 frames per ~30 ms window;
the plugin round-robins up to 2 ports per frame (~165 ms per port worst
case) with palette dedupe and periodic full re-sends as drop recovery.
Large payloads can also be split into multiple 64-byte writes (vendor's
`hid_write` does `[0x00] + chunk` × 64 bytes).

The protocol was reverse-engineered from USB captures (Wireshark + USBPcap)
and from the vendor's application bytecode (`agreement.py` / `port.py` /
`test.py` decompiled with decompyle3, plus a disassembly of `Sync_light.py`).

### Tools used

- **USB captures**: [USBPcap](https://desowin.org/usbpcap/) + Wireshark/tshark.
- **Python bytecode**: extracted from the installer with innoextract +
  pyinstxtractor, decompiled with **decompyle3** (`agreement.py`, `test.py`)
  and disassembled with **xdis/pydisasm** (`port.py`, `Sync_light.py`).
- **[REA](https://github.com/morluto/rea) (Reverse Engineer Anything)** was
  used via its MCP server for the managed (.NET) analysis of the vendor's
  `CpuServer.exe` (types, methods, string literals, the PawnIO self-repair
  commands and the localhost port) and for capture inspection.
- Vendor strings decoded from GBK constants with xdis.

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
- **Iluminación animada por puerto**: cada puerto muestrea su stream del
  canvas en una paleta de 12 colores y el firmware las cicla/interpola por
  sí mismo — animación suave por sección sin streaming pesado (tipo 2). Los
  streams totalmente estáticos pasan el puerto a modo color fijo (tipo 1)
  sin tráfico continuo; las paletas degeneradas (monocromas) dentro del modo
  paleta sostienen la paleta anterior en vez de cambiar de modo (evita el
  glitch verde del firmware).
- **Setting "Hub Flow Speed"** (0-6, "liusu" del vendor): la velocidad con
  que el firmware cicla las paletas.
- **Modo uniforme animado** (opcional): transmite un color animado para todos
  los canales a la velocidad completa de cuadros.
- **Efectos Custom incluidos** (`effects/`): "Neon Shift (Custom)" y su preset
  "NS Ultravioleta" — efectos HTML drop-in para SignalRGB con tus propios
  colores elegibles. Copialos a
  `%USERPROFILE%\Documents\WhirlwindFX\Effects\Custom\`.
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

### Herramientas usadas

- **Capturas USB**: [USBPcap](https://desowin.org/usbpcap/) + Wireshark/tshark.
- **Bytecode Python**: extraído del instalador con innoextract + pyinstxtractor,
  decompilado con **decompyle3** (`agreement.py`, `test.py`) y desensamblado
  con **xdis/pydisasm** (`port.py`, `Sync_light.py`).
- **[REA](https://github.com/morluto/rea) (Reverse Engineer Anything)** se usó
  vía su servidor MCP para el análisis managed (.NET) del `CpuServer.exe` del
  vendor (tipos, métodos, strings, los comandos de auto-reparación de PawnIO y
  el puerto localhost) y para la inspección de capturas.
- Los strings del vendor se decodificaron de constantes GBK con xdis.

### Licencia

Ver [LICENSE](LICENSE).