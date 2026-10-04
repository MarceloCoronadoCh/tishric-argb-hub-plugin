// TISHRIC ARGB Hub (USB HID controller) - v5: vendor-protocol per-port static colors
// VID 0x1A86 / PID 0xFE05  -  "USBFAN" (WCH CH552, ~10-channel ARGB hub)
//
// PROTOCOL (decoded from vendor Python code + USBPcap captures of the official app):
//   Wire frame = [RID=0x00, 'R'(0x52), 'B'(0x42), LEN, 0x00, CMD, params..., CHK]
//     * LEN counts ALL wire bytes INCLUDING the RID and the CHK byte.
//     * CHK = sum(every byte before CHK) & 0xFF.
//   The old "0x3C" header was actually LEN (60); the CMD lives at wire[5].
//
//   Commands (from vendor agreement.py + live captures):
//     0x00  Get_Fan_Config / heartbeat        [52 42 06 00 00 9A]
//     0x01  argb_fan_read_config  (x10 detect)[52 42 07 00 01 FF]
//     0x03  ARGB_ten_effect (lighting)
//     0x05  set port mode / value             [52 42 08 00 05 <port> <value>]
//     0x08  fan switch / ownership
//     0xFD  lighting ownership (1=external, 0=release)
//
//   Lighting, uniform animate (all channels same):
//     [52 42 3C 00 03 FF FF + 52B payload]
//     payload = [00, 03, 01, brightness, 16 RGB triplets]
//
//   Lighting, per-port STATIC (the feature the official app uses for independent
//   sections; verified with a live identify test: each group lit on its own port):
//     1) cmd 0x05: [52 42 08 00 05 <port> 01 <ck>]  = set port mode 1 (static)
//     2) cmd 0x03: [52 42 3C 00 03 FD <port> + 52B payload]
//        payload = [0x04, 01,01,01,01,01, 00,03,03,03, 01,01,01,
//                   B,B,B (brightness x3), palette: 12 RGB triplets]
//        palette[0] = the static color for that port.
//
// Plugin behaviour:
//   * 10 channels (SignalRGB sub-devices): Port 1..Port 10.
//   * Per-port static color: only writes a port when its color CHANGES
//     (the firmware retains colors; no USB spam needed).
//   * Uniform animate fallback: if selected, streams the uniform direct-color
//     frame every render (smooth animation for all channels together).
//   * Channel pulse from SignalRGB is mirrored to the port live.
//   * Ownership FD=1 at init, released (FD=0) on Shutdown only.
//
// v1 history: worked as broadcast-only (single LED, uniform color).
// v2-v4 (local experiments): slot-triplet routing disproved; per-port mode
// command discovered via captures of the official app.

export function Name() { return "TISHRIC ARGB Hub"; }
export function VendorId() { return 0x1A86; }
export function ProductId() { return [0xFE05]; }
export function Publisher() { return "TISHRIC"; }
export function Type() { return "Hid"; }
export function DeviceType() { return "lightingcontroller"; }
export function Size() { return [1, 1]; }
export function DefaultScale() { return 8.0; }
export function SubdeviceController() { return true; }
export function DefaultComponentBrand() { return "Tishric"; }
export function Validate(endpoint) { return endpoint.interface === 0; }
export function ImageUrl() {
	return "https://assets.signalrgb.com/devices/default/misc/usb-drive-render.png";
}

/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
portTest:readonly
controlMode:readonly
hwBrightness:readonly
colorOrder:readonly
debugLog:readonly
*/

export function ControllableParameters() {
	return [
		{ property: "shutdownColor", group: "lighting", label: "Shutdown Color", description: "This color is applied to the device when the System, or SignalRGB is shutting down", min: "0", max: "360", type: "color", default: "#000000" },
		{ property: "LightingMode", group: "lighting", label: "Lighting Mode", description: "Determines where the device's RGB comes from. Canvas will pull from the active Effect, while Forced will override it to a specific color", type: "combobox", values: ["Canvas", "Forced"], default: "Canvas" },
		{ property: "forcedColor", group: "lighting", label: "Forced Color", description: "The color used when 'Forced' Lighting Mode is enabled", min: "0", max: "360", type: "color", default: "#009bde" },
		{ property: "controlMode", group: "lighting", label: "Control Mode", description: "Ports: each channel = one hub port with its own static color (live-cached). Uniform: all channels share one animated color", type: "combobox", values: ["Ports (static per section)", "Uniform (animated broadcast)"], default: "Ports (static per section)" },
		{ property: "hwBrightness", group: "lighting", label: "Hub Brightness", description: "Brightness applied to port payloads (0-255, vendor default 0x99 = 153)", type: "number", min: "0", max: "255", default: "153" },
		{ property: "portTest", group: "porttest", label: "Port Test Mode", description: "Diagnostic: identify physical hub ports. Effects are NOT rendered while active. Set back to Off when done.", type: "combobox", values: ["Off", "One port at a time", "All white", "Rainbow by port"], default: "Off" },
		{ property: "colorOrder", group: "lighting", label: "Color Order", description: "Change only if colors look wrong (red/blue swapped)", type: "combobox", values: ["RGB", "RBG", "GRB", "BGR"], default: "RGB" },
		{ property: "debugLog", group: "", label: "Log hub responses", description: "Reads and logs hub responses every 3 seconds (for debugging)", type: "boolean", default: "false" },
	];
}

export function DeviceMessages() {
	return [
		{ property: "portTest", message: "Port Test Mode", tooltip: "While active, cycles ports in white (2s each) so you can map ports to physical groups. Set back to Off after." },
	];
}

// ---- channels/ports ----

const PortCount = 10;
const TripletCount = 16;
const MaxChannelLeds = 96;

const ChannelArray = [
	["Port 1", MaxChannelLeds],
	["Port 2", MaxChannelLeds],
	["Port 3", MaxChannelLeds],
	["Port 4", MaxChannelLeds],
	["Port 5", MaxChannelLeds],
	["Port 6", MaxChannelLeds],
	["Port 7", MaxChannelLeds],
	["Port 8", MaxChannelLeds],
	["Port 9", MaxChannelLeds],
	["Port 10", MaxChannelLeds],
];

const DeviceMaxLedLimit = PortCount * MaxChannelLeds;

function SetupChannels() {
	device.SetLedLimit(DeviceMaxLedLimit);
	for (let i = 0; i < PortCount; i++) {
		device.addChannel(ChannelArray[i][0], ChannelArray[i][1]);
	}
}

const vLedNames = [];
const vLedPositions = [];
export function LedNames() { return vLedNames; }
export function LedPositions() { return vLedPositions; }

// ---- protocol frames ----

// Frame: [RID=0, 'R', 'B', LEN, 0, CMD, params..., CHK]
// LEN counts bytes AFTER the report id (i.e. from 'R' to CHK inclusive).
function buildFrame(cmd, params) {
	// body (without RID): [52,42,LEN,0,CMD,params...,CK]
	const body = [0x52, 0x42, 0x00, 0x00, cmd].concat(params);
	body[2] = body.length + 1; // +CK (LEN excludes the RID)
	body.push(sumChecksum(body)); // CK
	return [0x00].concat(body);   // RID prefix for the HID write
}

function sumChecksum(bytes) {
	let s = 0;
	for (let i = 0; i < bytes.length; i++) s += bytes[i];
	return s & 0xFF;
}

function heartbeat() { return buildFrame(0x00, []); }          // vendor: 52 42 06 00 00 9A
function detectOnce() { return buildFrame(0x01, [0xFF]); }     // vendor detect (sent x10)
function takeOwnership() { return buildFrame(0xFD, [1]); }
function releaseOwnership() { return buildFrame(0xFD, [0]); }  // ONLY on Shutdown
function fanSwitchTake() { return buildFrame(0x08, [1]); }

function writeFrame(frame) {
	device.write(frame, 65);
}

// Uniform animated direct frame (all channels same color):
//   52 42 3C 00 03 FF FF + [00,03,01,B, 16 triplets]
function uniformFrame(rgb, brightness) {
	const data = [0x00, 0x03, 0x01, brightness & 0xFF];
	for (let i = 0; i < TripletCount; i++) {
		data.push(rgb[0] & 0xFF, rgb[1] & 0xFF, rgb[2] & 0xFF);
	}
	return buildFrame(0x03, [0xFF, 0xFF].concat(data.slice(0, 52)));
}

// Per-port static payload (52 bytes) — byte-verified against the vendor app capture:
//   04 | 01 01 01 01 01 | 00 03 03 03 | 01 01 01 | B B B | palette: 12 RGB triplets
// palette[0] = the port's color; remaining slots black.
function staticPayload(rgb, brightness) {
	const b = brightness & 0xFF;
	const p = [
		0x04,
		0x01, 0x01, 0x01, 0x01, 0x01,
		0x00, 0x03, 0x03, 0x03,
		0x01, 0x01, 0x01,
		b, b, b,
	];
	p.push(rgb[0] & 0xFF, rgb[1] & 0xFF, rgb[2] & 0xFF);
	while (p.length < 52) p.push(0);
	return p.slice(0, 52);
}

function setPortMode(port, mode) {
	return buildFrame(0x05, [port & 0xFF, mode & 0xFF]);
}

function perPortColorFrame(port, rgb, brightness) {
	return buildFrame(0x03, [0xFD, port & 0xFF].concat(staticPayload(rgb, brightness)));
}

// ---- helpers ----

function hexToRgb(hex) {
	const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!m) return [0, 0, 0];
	return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function toRgb(c) {
	if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0];
	if (typeof c === "string") return hexToRgb(c);
	return [0, 0, 0];
}

function applyOrder(c) {
	switch (colorOrder) {
		case "RBG": return [c[0], c[2], c[1]];
		case "GRB": return [c[1], c[0], c[2]];
		case "BGR": return [c[2], c[1], c[0]];
		default: return c;
	}
}

function hsvToRgb(h, s, v) {
	const c = v * s;
	const hp = (h % 360) / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let r = 0, g = 0, b = 0;
	if (hp < 1) { r = c; g = x; }
	else if (hp < 2) { r = x; g = c; }
	else if (hp < 3) { g = c; b = x; }
	else if (hp < 4) { g = x; b = c; }
	else if (hp < 5) { r = x; b = c; }
	else { r = c; b = x; }
	const m = v - c;
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ---- port state ----
const lastSent = [];   // last color key per port (dedupe writes)

// ---- channel color resolution ----

function getLedCount(componentChannel) {
	try {
		if (typeof componentChannel.LedCount === "function") {
			return componentChannel.LedCount();
		}
	} catch (e) { /* fall through */ }
	try { return componentChannel.ledCount || 0; } catch (e) { return 0; }
}

function averageColor(data) {
	if (!data || data.length < 3) return [0, 0, 0];
	let r = 0, g = 0, b = 0;
	const n = Math.floor(data.length / 3);
	for (let i = 0; i + 2 < data.length; i += 3) {
		r += data[i]; g += data[i + 1]; b += data[i + 2];
	}
	return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function channelColor(idx) {
	if (LightingMode === "Forced") return hexToRgb(forcedColor);
	let cc = null;
	try { cc = device.channel(ChannelArray[idx][0]); } catch (e) { cc = null; }
	if (!cc) return [0, 0, 0];

	// Always touch the pulse API every frame so the UI pulse registers as
	// consumed (otherwise SignalRGB kills the pulse after ~4s).
	// The pulse color replaces this port's color while the pulse is active.
	let pulseColor = null;
	try { pulseColor = device.getChannelPulseColor(ChannelArray[idx][0]); } catch (e) { /* none */ }
	if (pulseColor) {
		return toRgb(pulseColor);
	}

	const lc = getLedCount(cc);
	if (!lc) return [0, 0, 0];
	try {
		return averageColor(cc.getColors("Inline"));
	} catch (e) {
		device.log(`Port ${idx + 1}: color error ${e}`);
		return [0, 0, 0];
	}
}

// ---- port test ----
const TestStepMs = 2000;

function sendTestFrame() {
	const b = hwBrightness & 0xFF;
	if (portTest === "All white") {
		writeFrame(uniformFrame([255, 255, 255], b));
		return;
	}
	if (portTest === "Rainbow by port") {
		const data = [0x00, 0x03, 0x01, b];
		for (let i = 0; i < TripletCount; i++) {
			const c = i < PortCount ? hsvToRgb((i * 360 / PortCount) % 360, 1, 1) : [0, 0, 0];
			data.push(c[0], c[1], c[2]);
		}
		writeFrame(buildFrame(0x03, [0xFF, 0xFF].concat(data)));
		return;
	}
	// "One port at a time": per-port static white for 2s each (uses the per-port path)
	const step = Math.floor(Date.now() / TestStepMs) % PortCount;
	for (let p = 0; p < PortCount; p++) {
		const col = p === step ? [255, 255, 255] : [0, 0, 0];
		writeFrame(setPortMode(p, 1));
		device.pause(1);
		writeFrame(perPortColorFrame(p, col, b));
		device.pause(1);
	}
}

// ---- lifecycle ----

let lastHeartbeat = 0;

export function Initialize() {
	try {
		device.setName("TISHRIC ARGB Hub");
		device.setSize([1, 1]);
		SetupChannels();

		writeFrame(heartbeat());
		for (let i = 0; i < PortCount; i++) {
			writeFrame(detectOnce());
			device.pause(1);
		}
		writeFrame(takeOwnership());
		writeFrame(fanSwitchTake());

		device.log("TISHRIC v5 initialized (vendor per-port protocol)");
	} catch (e) {
		device.log("Initialize error: " + e);
	}
}

let lastDebugPoll = 0;

function debugRead() {
	if (debugLog !== true) return;
	const now = Date.now();
	if (now - lastDebugPoll < 3000) return;
	lastDebugPoll = now;
	try {
		const p = device.read([0x00], 65, 10);
		if (p && p.length) {
			const hex = [];
			for (let i = 0; i < Math.min(20, p.length); i++) {
				hex.push(("0" + p[i].toString(16)).slice(-2));
			}
			device.log("HUB RX: " + hex.join(" "));
		}
	} catch (e) {
		device.log("HUB read error: " + e);
	}
}

export function Render() {
	try {
		renderFrame();
	} catch (e) {
		device.log("Render error: " + e);
	}
}

function renderFrame() {
	// heartbeat keepalive every 1s (vendor keeps ~3s; sooner is safer)
	const now = Date.now();
	if (now - lastHeartbeat >= 1000) {
		lastHeartbeat = now;
		writeFrame(heartbeat());
	}
	debugRead();

	if (portTest !== "Off") {
		sendTestFrame();
		return;
	}

	const b = hwBrightness & 0xFF;

	// per-port colors (pulse-aware)
	const colors = [];
	for (let p = 0; p < PortCount; p++) {
		colors.push(applyOrder(channelColor(p)));
	}

	if (controlMode === "Uniform (animated broadcast)") {
		// stream one color for all (live animation), every frame
		const mixed = LightingMode === "Forced" ? hexToRgb(forcedColor) : mixOf(colors);
		writeFrame(uniformFrame(mixed, b));
		lastSent.length = 0; // invalidate per-port cache
		return;
	}

	// Per-port static mode: send only changes (firmware retains colors)
	for (let p = 0; p < PortCount; p++) {
		const c = colors[p];
		const key = `${c[0]},${c[1]},${c[2]}`;
		if (lastSent[p] === key) continue;
		writeFrame(setPortMode(p, 1));
		device.pause(1);
		writeFrame(perPortColorFrame(p, c, b));
		device.pause(1);
		lastSent[p] = key;
	}
}

function mixOf(colors) {
	let r = 0, g = 0, bt = 0, n = 0;
	for (const c of colors) {
		if (c[0] || c[1] || c[2]) {
			r += c[0]; g += c[1]; bt += c[2]; n++;
		}
	}
	if (!n) return [0, 0, 0];
	return [Math.round(r / n), Math.round(g / n), Math.round(bt / n)];
}

export function Shutdown(SystemSuspending) {
	const color = SystemSuspending ? [0, 0, 0] : applyOrder(hexToRgb(shutdownColor));
	try {
		for (let p = 0; p < PortCount; p++) {
			writeFrame(perPortColorFrame(p, color, hwBrightness & 0xFF));
			device.pause(1);
		}
	} catch (e) { /* best effort on shutdown */ }
	try {
		writeFrame(releaseOwnership());
	} catch (e) { /* ignore */ }
}