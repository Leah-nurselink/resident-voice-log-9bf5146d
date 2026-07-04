// Electron preload — installs `window.__nativeBleAdapter` so the web
// app's scanner uses real BLE on macOS via noble in the main process.

const { contextBridge, ipcRenderer } = require("electron");

let handler = null;
ipcRenderer.on("ble:advertisement", (_evt, raw) => {
  if (!handler) return;
  // Build Web-Bluetooth-shaped maps so the existing parsers work as-is.
  const manufacturerData = new Map();
  if (raw.manufacturerData && raw.manufacturerData.length >= 2) {
    const bytes = raw.manufacturerData;
    const companyId = bytes[0] | (bytes[1] << 8);
    const rest = Uint8Array.from(bytes.slice(2));
    manufacturerData.set(companyId, new DataView(rest.buffer));
  }
  const serviceData = new Map();
  for (const sd of raw.serviceData || []) {
    const bytes = Uint8Array.from(sd.data || []);
    serviceData.set(String(sd.uuid).toLowerCase(), new DataView(bytes.buffer));
  }
  handler({
    rssi: raw.rssi,
    txPower: raw.txPower,
    device: { id: raw.id, name: raw.name },
    manufacturerData,
    serviceData,
  });
});

contextBridge.exposeInMainWorld("__nativeBleAdapter", {
  runtime: process.platform === "darwin" ? "electron-mac" : "electron",
  async start(cb) {
    handler = cb;
    await ipcRenderer.invoke("ble:start");
  },
  async stop() {
    handler = null;
    await ipcRenderer.invoke("ble:stop");
  },
});
