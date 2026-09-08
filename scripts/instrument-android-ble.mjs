import { readFile, writeFile } from "node:fs/promises";

const scannerPath =
  "node_modules/@capacitor-community/bluetooth-le/android/src/main/java/com/capacitorjs/community/plugins/bluetoothle/DeviceScanner.kt";
const pluginPath =
  "node_modules/@capacitor-community/bluetooth-le/android/src/main/java/com/capacitorjs/community/plugins/bluetoothle/BluetoothLe.kt";

async function insertOnce(path, marker, replacement) {
  const source = await readFile(path, "utf8");
  if (source.includes("CARECORE_BLE_TRACE")) return;
  if (!source.includes(marker)) throw new Error(`Instrumentation marker not found in ${path}`);
  await writeFile(path, source.replace(marker, replacement));
}

await insertOnce(
  scannerPath,
  "            super.onScanResult(callbackType, result)\n",
  "            super.onScanResult(callbackType, result)\n            Logger.debug(TAG, \"CARECORE_BLE_TRACE native advertisement address=${result.device.address} rssi=${result.rssi}\")\n",
);

await insertOnce(
  pluginPath,
  "                    val scanResult = getScanResult(result)\n",
  "                    val scanResult = getScanResult(result)\n                    Logger.debug(TAG, \"CARECORE_BLE_TRACE sending onScanResult to JavaScript address=${result.device.address} rssi=${result.rssi}\")\n",
);

console.log("CareCore Android BLE diagnostic instrumentation applied.");
