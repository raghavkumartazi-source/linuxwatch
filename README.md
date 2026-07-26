# 🐧 LinuxWatch — Standalone Linux Mint Surveillance & Control System

A 100% independent, full-stack monitoring and remote control system tailored specifically for **Linux Mint** and desktop Linux environments. Designed to operate separately from your Android tracking projects.

---

## 📁 Folder Structure (`/Users/universeboss/Desktop/LinuxWatch`)

```
LinuxWatch/
├── package.json          # Node.js server dependencies
├── server.js             # Standalone cloud backend & SQLite database (linuxwatch.db)
├── public/               # AMOLED Glassmorphism Web Dashboard
│   ├── index.html        # Desktop-oriented layout
│   ├── style.css         # Pitch-black AMOLED styling
│   └── app.js            # Client-side WebSocket & API logic
└── agent/                # Linux Mint Python 3 Daemon
    ├── agent.py          # Background surveillance daemon (psutil, websockets, mss)
    ├── requirements.txt  # Python dependencies
    └── install.sh        # 1-click systemd background installer
```

---

## 🚀 1. Running / Deploying the Server (`server.js`)

### Run Locally on your computer:
```bash
cd /Users/universeboss/Desktop/LinuxWatch
npm install
npm start
```
Your dashboard will be live at: **http://localhost:3005**
* **Security PIN**: `2026`
* **Agent Secret Key**: `linuxwatch_secret_key_2026`

### Deploy to Render (Cloud):
1. Create a new Web Service on Render pointing to your `LinuxWatch` repository folder.
2. Build Command: `npm install`
3. Start Command: `node server.js`
4. Set environment variables:
   * `LW_PIN` = `2026`
   * `AGENT_KEY` = `linuxwatch_secret_key_2026`

---

## 🐧 2. Installing the Agent on Linux Mint

Copy the `agent/` folder to the target Linux Mint computer, or run directly from terminal:

```bash
cd agent
./install.sh
```

### What `install.sh` Does:
1. Installs system requirements (`python3-pip`, `python3-psutil`, `xdotool`).
2. Copies `agent.py` to a hidden folder: `~/.local/share/.linuxwatch/agent.py`.
3. Creates and starts an auto-restarting background service (`systemd --user`): `~/.config/systemd/user/linuxwatch.service`.
4. The agent instantly connects over WebSocket (`/ws/agent`) and reports live system metrics every few seconds.

---

## ⭐ Key Desktop Features

* **Live CPU, RAM, & Disk Usage**: Real-time progress bars and percentage tracking.
* **Active Window & Process Inspection**: Shows the exact window title (`Mozilla Firefox - Wikipedia`) and process name (`cinnamon`) currently in focus.
* **Top Running Processes Table**: Lists memory usage (MB) and CPU (%) of desktop programs with a remote **✕ Kill Process** button!
* **Linux Browser History**: Automatically copies and reads visited URLs across Google Chrome, Chromium, Brave, and Firefox SQLite databases without locking them (`last_reported_urls`), complete with **⬇️ Export CSV**.
* **Stealth Desktop Screenshots**: Uses `mss` cross-platform screen capture to silently take multi-monitor desktop screenshots.
* **Persistent Screen Lock (`lock`)**: Executes `cinnamon-screensaver-command -l` / `loginctl lock-session` every second to prevent unauthorized desktop access until unlocked (`unlock`).
* **Send Desktop Alert Popup (`alert`)**: Triggers `notify-send -u critical` right on the Linux Mint screen.
# linuxwatch
