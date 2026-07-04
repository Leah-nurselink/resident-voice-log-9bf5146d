// Electron main process for the CareCore macOS shell.
//
// The BrowserWindow loads the published TanStack Start site directly.
// A separate preload script exposes a native BLE adapter on
// `window.__nativeBleAdapter`, powered by `@abandonware/noble` in this
// main process. The renderer's existing scanner code auto-detects and
// uses the adapter — no web changes needed.

const { app, BrowserWindow, ipcMain, systemPreferences } = require("electron");
const path = require("node:path");

const APP_URL = process.env.CARECORE_APP_URL || "https://resident-voice-log.lovable.app";

let noble = null;
function getNoble() {
  if (noble) return noble;
  try {
    // Lazy-load so `npm start` works even if noble isn't installed yet.
    noble = require("@abandonware/noble");
  } catch (err) {
    console.warn("[electron] @abandonware/noble unavailable:", err.message);
    noble = null;
  }
  return noble;
}

let mainWindow = null;
let scanning = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "CareCore",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  // macOS: request Bluetooth permission up front so noble can scan.
  if (process.platform === "darwin" && systemPreferences.askForMediaAccess) {
    try {
      await systemPreferences.askForMediaAccess("bluetooth");
    } catch {
      /* older Electron versions */
    }
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ---- IPC bridge ----

ipcMain.handle("ble:start", async () => {
  const n = getNoble();
  if (!n) throw new Error("noble not installed");
  if (scanning) return { ok: true };

  await new Promise((resolve) => {
    if (n.state === "poweredOn") return resolve();
    n.once("stateChange", (s) => {
      if (s === "poweredOn") resolve();
    });
  });

  n.on("discover", (peripheral) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const adv = peripheral.advertisement || {};
    // Convert Buffers to number[] so they cross the context bridge.
    const manufacturerData = adv.manufacturerData
      ? Array.from(adv.manufacturerData)
      : null;
    const serviceData = Array.isArray(adv.serviceData)
      ? adv.serviceData.map((sd) => ({
          uuid: sd.uuid,
          data: sd.data ? Array.from(sd.data) : [],
        }))
      : [];
    mainWindow.webContents.send("ble:advertisement", {
      id: peripheral.id,
      name: adv.localName || peripheral.address || null,
      rssi: peripheral.rssi,
      txPower: typeof adv.txPowerLevel === "number" ? adv.txPowerLevel : null,
      manufacturerData,
      serviceData,
    });
  });

  await n.startScanningAsync([], true);
  scanning = true;
  return { ok: true };
});

ipcMain.handle("ble:stop", async () => {
  const n = getNoble();
  if (!n || !scanning) return { ok: true };
  try {
    await n.stopScanningAsync();
  } catch {
    /* noop */
  }
  scanning = false;
  return { ok: true };
});
