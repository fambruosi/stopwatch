# OSC Stopwatch Display

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A5%2018-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-000000.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-1AAB8B.svg)](#contributing)
[![Status](https://img.shields.io/badge/status-in%20use-4C9AFF.svg)](#roadmap)

A minimal **Node.js + TypeScript** service that turns any device on your LAN into a **stopwatch display** driven via **OSC**.  
It stays **exactly in sync** with **REAPER** transport and accepts the **same message set** from **Max** or any other **OSC Tools**.

> The display is **passive**: it shows the time **you send** over OSC (no local ticking), ensuring 1:1 synchronization with your source.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [OSC Message Spec](#osc-message-spec)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)
- [Author](#author)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Features

- **OSC → Web bridge** — Receives OSC (UDP) and broadcasts to connected browsers via WebSocket.
- **Transport aware** — Reacts to `/play`, `/pause`, `/stop` (+ optional `/reset`), mirroring REAPER semantics.
- **Flexible time inputs** — Accepts `/time` as seconds (float) and `/time/str` as `hh:mm:ss`; also listens to `/transport/time`, `/stopwatch/time`, `/bigclock`.
- **Clean display** — Full-screen black page, white monospace digits, **A+/A–** to scale font (persisted).
- **Name gate** — On first load, the user inputs a free-form name (e.g., “Giulia — Soprano Sax”). The server logs:  
  `"{name (IP)} connected."`
- **Config via `.env`** — Ports, reset policy on stop, and proxy trust are environment-driven.

---

## Requirements

- Node.js ≥ 18
- TypeScript ≥ 5.x

---

## Quick Start

1. **Install dependencies**  
   ```bash
   npm install
   ```

2. **Configure environment**  
   Create a `.env` file in the project root (optional, defaults provided):
   ```
   HTTP_PORT=3000
   OSC_PORT=9000
   OSC_HOST=0.0.0.0
   RESET_ON_STOP=false
   TRUST_PROXY=false
   ```

3. **Run the server**  
   ```bash
   npm run start
   ```
   The web interface will be available at `http://<server-IP>:<HTTP_PORT>`.

## Usage

- **Web Page**: Open the URL on any device in your LAN. Enter your name to connect.
- **OSC Control**: Send OSC messages to the configured UDP port. Supported addresses:
  - `/time`, `/time/str`, `/transport/time`, `/stopwatch/time`, `/bigclock` — set display time
  - `/play`, `/pause`, `/stop`, `/reset`, `/rewind` — control transport state

## OSC Message Spec

| Address           | Arguments           | Description                  |
|-------------------|--------------------|------------------------------|
| `/time`           | float seconds      | Set time (e.g., 123.45)      |
| `/time/str`       | string hh:mm:ss    | Set time (e.g., "01:23:45")  |
| `/play`           | number/bool/string | Set state to play            |
| `/pause`          | number/bool/string | Set state to pause           |
| `/stop`           | number/bool/string | Set state to stop            |
| `/reset`, `/rewind` | (any)            | Reset time to 00:00:00       |

## Troubleshooting

- Make sure your OSC source is sending to the correct UDP port and IP.
- Check firewall settings if clients cannot connect.
- Use the server logs to verify connections and OSC messages.

## Development Workflow

- Edit TypeScript source in `server.ts`.
- Static files are served from the `public` directory.
- Use `npm run dev` for hot-reload (if configured).

## Author

- Federico Ambruosi
- federicoambruosi@gmail.com

## Acknowledgements

- Inspired by REAPER, Max/MSP, and open-source OSC tools.

## License

GNU General Public License v3.0