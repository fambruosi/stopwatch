//==========================================================
//                          INITS
//==========================================================
// Import required modules
import path from "node:path";
import http from "node:http";
import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import osc, { UDPPort } from "osc";
import dotenv from "dotenv";
import os from "node:os";
dotenv.config();

/* ==== Config from .env (with sensible defaults) ===================== */
// Load configuration from environment variables, with defaults
const HTTP_PORT = Number(process.env.HTTP_PORT || 3000);
const OSC_HOST  = process.env.OSC_HOST || "0.0.0.0";
const OSC_PORT  = Number(process.env.OSC_PORT || 9000);
const RESET_ON_STOP = String(process.env.RESET_ON_STOP || "false").toLowerCase() === "true";
const TRUST_PROXY   = String(process.env.TRUST_PROXY   || "false").toLowerCase() === "true";

/* ==== HTTP static + WebSocket ====================================== */
// Set up Express app and HTTP server
const app = express();
if (TRUST_PROXY) app.set("trust proxy", true);
app.use(express.static(path.join(process.cwd(), "public")));
const server = http.createServer(app);

// Type definitions for transport state and outgoing messages
type TransportState = "stop" | "play" | "pause";
type Outgoing =
  | { type: "time"; value: string }
  | { type: "state"; value: TransportState };

type NamedWS = WebSocket & { name?: string };

// Create WebSocket server
const wss = new WebSocketServer({ server });

let lastHHMMSS = "00:00:00";
let transport: TransportState = "stop";

// Broadcast a message to all connected WebSocket clients
function broadcast(msg: Outgoing) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

// Extract user IP address, handling proxy headers if needed
function clientIp(req: http.IncomingMessage): string {
  let ip = TRUST_PROXY ? (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() : "";
  if (!ip && req.socket) ip = req.socket.remoteAddress || "";
  return ip.replace(/^::ffff:/, ""); // normalize IPv6-mapped IPv4
}

// Handle new WebSocket connections
// wss.on("connection", (wsRaw, req) => {
//   const ws = wsRaw as NamedWS;
//   const ip = clientIp(req);

//   ws.on("message", (buf) => {
//     try {
//       const msg = JSON.parse(buf.toString());
//       // Wait for "hello" message with client name before logging
//       if (msg?.type === "hello" && typeof msg?.name === "string" && msg.name.trim()) {
//         ws.name = msg.name.trim();
//         console.log(`${ws.name} (${ip}) connected.`);
//         // Send initial state and time to the new client
//         ws.send(JSON.stringify({ type: "state", value: transport } satisfies Outgoing));
//         ws.send(JSON.stringify({ type: "time",  value: lastHHMMSS } satisfies Outgoing));
//       }
//     } catch {
//       /* ignore malformed messages */
//     }
//   });
// });

wss.on("connection", (wsRaw, req) => {
  const ws = wsRaw as WebSocket;
  const ip = clientIp(req);
  console.log(`${ip} connected.`);

  // send current state/time immediately
  ws.send(JSON.stringify({ type: "state", value: transport }));
  ws.send(JSON.stringify({ type: "time",  value: lastHHMMSS }));

  // (facoltativo) puoi comunque ascoltare messaggi in futuro
  ws.on("message", () => { /* not used now */ });
});

/* ==== Helpers ======================================================= */
// Regular expression for matching HH:MM:SS format
const HHMMSS_RE = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.:]\d+)?$/;

// Pad a number to two digits
const pad2 = (n: number) => String(n).padStart(2, "0");

// Convert seconds to HH:MM:SS string
function secondsToHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

// Normalize various input formats to HH:MM:SS string
function normalizeToHHMMSS(args: unknown[]): string | null {
  if (!args?.length) return null;
  const a0 = args[0];

  // Handle string "hh:mm:ss(.ff)" or numeric string
  if (typeof a0 === "string") {
    const m = a0.trim().match(HHMMSS_RE);
    if (m) return `${pad2(Number(m[1]))}:${pad2(Number(m[2]))}:${pad2(Number(m[3]))}`;
    const n = Number(a0);
    if (!Number.isNaN(n)) return secondsToHHMMSS(n);
    return null;
  }
  // Handle float seconds
  if (typeof a0 === "number" && args.length === 1) return secondsToHHMMSS(a0);
  // Handle numeric triplet h,m,s
  if (args.length >= 3 && typeof args[0] === "number" && typeof args[1] === "number" && typeof args[2] === "number") {
    const [h,m,s] = args as number[];
    return secondsToHHMMSS(h*3600 + m*60 + s);
  }
  return null;
}

// Determine if a value should be treated as "on"
function isOn(v: unknown): boolean {
  if (typeof v === "number") return v !== 0;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim() !== "" && v.trim() !== "0";
  return true; // no argument => treat as ON
}

//find local IPv4 addresses
function localIPv4List(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const isV4 = (net as any).family === "IPv4" || (net as any).family === 4;
      if (isV4 && !net.internal) out.push(net.address);
    }
  }
  return out.length ? out : ["127.0.0.1"];
}

/* ==== OSC (UDP) ===================================================== */
// Set up OSC UDP port for receiving messages
const udpPort = new UDPPort({
  localAddress: OSC_HOST,
  localPort: OSC_PORT,
  metadata: true
});

// Accepted OSC addresses (for REAPER and Max aliases)
const ADDR_TIME = new Set<string>([
  "/time", "/time/str", "/transport/time", "/stopwatch/time", "/bigclock"
]);
const ADDR_PLAY  = "/play";
const ADDR_STOP  = "/stop";
const ADDR_PAUSE = "/pause";
const ADDR_RESET = "/reset";
const ADDR_REW   = "/rewind";

// Log when OSC port is ready
udpPort.on("ready", () => {
  console.log(`OSC listening on ${OSC_HOST}:${OSC_PORT}`);
});

// Handle incoming OSC messages
udpPort.on("message", (oscMsg: any) => {
  const addr = String(oscMsg.address || "").toLowerCase();
  const args = (oscMsg.args || []).map((a: any) => a?.value);

  // Handle time messages
  if (ADDR_TIME.has(addr)) {
    const hhmmss = normalizeToHHMMSS(args);
    if (hhmmss) {
      lastHHMMSS = hhmmss;
      broadcast({ type: "time", value: lastHHMMSS });
    }
    return;
  }

  // Handle play command
  if (addr === ADDR_PLAY && isOn(args[0])) {
    transport = "play";
    broadcast({ type: "state", value: transport });
    return;
  }

  // Handle stop command
  if (addr === ADDR_STOP && isOn(args[0])) {
    transport = "stop";
    if (RESET_ON_STOP) {
      lastHHMMSS = "00:00:00";
      broadcast({ type: "time", value: lastHHMMSS });
    }
    broadcast({ type: "state", value: transport });
    return;
  }

  // Handle pause command
  if (addr === ADDR_PAUSE && isOn(args[0])) {
    transport = "pause";
    broadcast({ type: "state", value: transport });
    return;
  }

  // Handle reset and rewind commands
  if (addr === ADDR_RESET || addr === ADDR_REW) {
    lastHHMMSS = "00:00:00";
    broadcast({ type: "time", value: lastHHMMSS });
  }
});

// Log OSC errors
udpPort.on("error", (err: any) => console.error("OSC error:", err?.message || err));
udpPort.open();

/* ==== Start HTTP: print "listening on port: X" ====================== */
// Start HTTP server and log port
server.listen(HTTP_PORT, () => {
  const ips = localIPv4List();
  for (const ip of ips) {
    console.log(`connect to: http://${ip}:${HTTP_PORT}`);
  }
});