// TISHRIC ARGB Hub (USB HID controller)
// VID 0x1A86 / PID 0xFE05  -  "USBFAN" (10 channel ARGB fan hub)
//
// Detected as a SINGLE RGB device (one controllable LED). The single color
// is broadcast to all hub channels so every fan lights uniformly.
//
// Protocol (reverse-engineered from USB captures):
//   64-byte HID reports, magic "RB" (0x52 0x42).
//   byte 2  = command type:
//       0x06 = heartbeat (checksum @ byte 5)
//       0x07 = fan command (checksum @ byte 6)
//       0x3C = lighting command (checksum @ byte 59)
//       0x39 = response listing channels (from hub)
//   Checksum = sum of bytes [0 .. checksum_offset-1] & 0xFF
//   Lighting (0x3C) direct color layout:
//       byte 7  = 0x00 (direct mode)
//       byte 10 = brightness (0x99)
//       byte 11,12,13 = R,G,B

export function Name() { return "TISHRIC ARGB Hub"; }
export function VendorId() { return 0x1A86; }
export function ProductId() { return [0xFE05]; }
export function Publisher() { return "TISHRIC"; }
export function Type() { return "Hid"; }
export function DeviceType() { return "lightingcontroller"; }
export function Size() { return [1, 1]; }
export function DefaultScale() { return 8.0; }

export function Validate(endpoint) {
	return endpoint.interface === 0;
}

export function ImageUrl() {
	return "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png";
}

/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
*/

export function ControllableParameters() {
	return [
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", min: "0", max: "360", type: "color", default: "#000000" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", min: "0", max: "360", type: "color", default: "#009bde" },
	];
}

// ---- protocol helpers ----

function buildPacket(cmd, fields, checksumOffset) {
	const buf = new Array(64).fill(0);
	buf[0] = 0x52;
	buf[1] = 0x42;
	buf[2] = cmd;
	for (const off in fields) {
		if (off < checksumOffset) {
			buf[off] = fields[off] & 0xFF;
		}
	}
	buf[checksumOffset] = buf.slice(0, checksumOffset).reduce((a, b) => a + b, 0) & 0xFF;
	return buf;
}

function heartbeatPacket() {
	return buildPacket(0x06, {}, 5);
}

function fanPacket(b3, b4, b5) {
	return buildPacket(0x07, { 3: b3, 4: b4, 5: b5 }, 6);
}

function fanInitDetect() { return fanPacket(0x00, 0x01, 0xFF); }
function fanInitConfirm() { return fanPacket(0x00, 0xFD, 0x01); }
function fanInitApply() { return fanPacket(0x00, 0x08, 0x00); }

const FanCount = 8;

function buildLightingPacket(r, g, b) {
	const fields = {
		3: 0x00,
		4: 0x03,
		5: 0xFF,
		6: 0xFF,
		7: 0x00,          // mode 0 = direct color
		8: 0x03,
		9: 0x01,
		10: 0x99,         // brightness
	};
	// Broadcast the same color to all 8 channels (bytes 11+ in triplets).
	let idx = 11;
	for (let i = 0; i < FanCount; i++) {
		if (idx + 2 > 58) break;
		fields[idx] = r;
		fields[idx + 1] = g;
		fields[idx + 2] = b;
		idx += 3;
	}
	return buildPacket(0x3C, fields, 59);
}

function hexToRgb(hex) {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!m) return [0, 0, 0];
	return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// ---- lifecycle ----

const vLedNames = ["LED 1"];
const vLedPositions = [[0, 0]];

let lastHeartbeat = 0;

function sendHeartbeatIfNeeded() {
	const now = Date.now();
	if (now - lastHeartbeat >= 1000) {
		lastHeartbeat = now;
		device.write([0x00].concat(heartbeatPacket()), 65);
	}
}

export function Initialize() {
	device.setName("TISHRIC ARGB Hub");
	device.setSize([1, 1]);
	device.setControllableLeds(vLedNames, vLedPositions);

	// handshake
	device.write([0x00].concat(heartbeatPacket()), 65);
	device.write([0x00].concat(fanInitDetect()), 65);
	device.write([0x00].concat(fanInitConfirm()), 65);
	device.write([0x00].concat(fanInitApply()), 65);
}

function getColor(overrideColor) {
	if (overrideColor) {
		return hexToRgb(overrideColor);
	}
	if (LightingMode === "Forced") {
		return hexToRgb(forcedColor);
	}
	return device.color(0, 0);
}

export function Render() {
	sendHeartbeatIfNeeded();
	const c = getColor(null);
	device.write([0x00].concat(buildLightingPacket(c[0], c[1], c[2])), 65);
}

export function Shutdown(SystemSuspending) {
	const color = SystemSuspending ? "#000000" : shutdownColor;
	const c = getColor(color);
	device.write([0x00].concat(buildLightingPacket(c[0], c[1], c[2])), 65);
}
