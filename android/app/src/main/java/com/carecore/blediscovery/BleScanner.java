package com.carecore.blediscovery;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.SparseArray;

import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class BleScanner {

    public interface OnUpdateListener {
        void onUpdate(List<DiscoveredDevice> devices);
    }

    public interface OnErrorListener {
        void onError(String message);
    }

    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final LinkedHashMap<String, DiscoveredDevice> devices = new LinkedHashMap<>();

    public OnUpdateListener onUpdate;
    public OnErrorListener onError;

    private boolean isScanning = false;

    public BleScanner(Context context) {
        this.context = context;
    }

    public boolean isScanning() {
        return isScanning;
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    public boolean isBluetoothSupported() {
        BluetoothAdapter adapter = getAdapter();
        return adapter != null && context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
    }

    public boolean isBluetoothEnabled() {
        BluetoothAdapter adapter = getAdapter();
        return adapter != null && adapter.isEnabled();
    }

    public boolean hasScanPermission() {
        List<String> needed = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            needed.add(Manifest.permission.BLUETOOTH_SCAN);
            needed.add(Manifest.permission.BLUETOOTH_CONNECT);
        }
        needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
        for (String permission : needed) {
            if (ContextCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }
        return true;
    }

    public void start() {
        if (isScanning) return;
        if (!isBluetoothSupported()) { fail("This device has no Bluetooth LE support."); return; }
        if (!isBluetoothEnabled()) { fail("Bluetooth is off. Turn it on and try again."); return; }
        if (!hasScanPermission()) { fail("Bluetooth scan permission not granted."); return; }

        BluetoothAdapter adapter = getAdapter();
        BluetoothLeScanner scanner = adapter == null ? null : adapter.getBluetoothLeScanner();
        if (scanner == null) { fail("Bluetooth LE scanner unavailable."); return; }

        devices.clear();
        emit();

        ScanSettings.Builder settingsBuilder = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0L);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settingsBuilder
                    .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                    .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                    .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT);
        }
        ScanSettings settings = settingsBuilder.build();

        List<ScanFilter> filters = Collections.singletonList(new ScanFilter.Builder().build());

        try {
            scanner.startScan(filters, settings, callback);
            isScanning = true;
        } catch (SecurityException e) {
            fail("Scan blocked by permissions: " + e.getMessage());
        }
    }

    public void stop() {
        if (!isScanning) return;
        try {
            BluetoothAdapter adapter = getAdapter();
            BluetoothLeScanner scanner = adapter == null ? null : adapter.getBluetoothLeScanner();
            if (scanner != null) scanner.stopScan(callback);
        } catch (SecurityException ignored) {
        }
        isScanning = false;
    }

    private final ScanCallback callback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            handle(result);
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
            for (ScanResult result : results) handle(result);
        }

        @Override
        public void onScanFailed(int errorCode) {
            isScanning = false;
            final String message = "Scan failed (code " + errorCode + ").";
            main.post(() -> { if (onError != null) onError.onError(message); });
        }
    };

    private void handle(ScanResult result) {
        ScanRecord record = result.getScanRecord();
        long now = System.currentTimeMillis();
        String address = result.getDevice().getAddress();

        String name = null;
        try {
            name = record != null ? record.getDeviceName() : result.getDevice().getName();
        } catch (SecurityException e) {
            name = record != null ? record.getDeviceName() : null;
        }

        List<String> serviceUuids = new ArrayList<>();
        if (record != null && record.getServiceUuids() != null) {
            for (ParcelUuid uuid : record.getServiceUuids()) {
                serviceUuids.add(uuid.getUuid().toString());
            }
        }

        Map<Integer, String> manufacturerData = new HashMap<>();
        if (record != null && record.getManufacturerSpecificData() != null) {
            SparseArray<byte[]> msd = record.getManufacturerSpecificData();
            for (int i = 0; i < msd.size(); i++) {
                manufacturerData.put(msd.keyAt(i), toHex(msd.valueAt(i)));
            }
        }

        Map<String, String> serviceData = new HashMap<>();
        if (record != null && record.getServiceData() != null) {
            for (Map.Entry<ParcelUuid, byte[]> entry : record.getServiceData().entrySet()) {
                serviceData.put(entry.getKey().getUuid().toString(), toHex(entry.getValue()));
            }
        }

        Integer tx = null;
        if (record != null) {
            int txLevel = record.getTxPowerLevel();
            if (txLevel != Integer.MIN_VALUE) tx = txLevel;
        }
        String raw = (record != null && record.getBytes() != null) ? toHex(record.getBytes()) : null;
        BeaconInfo beacon = BeaconParser.parse(record);

        AdvertisementType type;
        if (beacon != null && "iBeacon".equals(beacon.format)) {
            type = AdvertisementType.IBEACON;
        } else if (beacon != null && beacon.format != null && beacon.format.startsWith("Eddystone")) {
            type = AdvertisementType.EDDYSTONE;
        } else if (!manufacturerData.isEmpty() || !serviceData.isEmpty() || !serviceUuids.isEmpty()) {
            type = AdvertisementType.OTHER;
        } else {
            type = AdvertisementType.RAW_BLE;
        }

        DiscoveredDevice existing = devices.get(address);
        long firstSeen = existing != null ? existing.firstSeen : now;

        devices.put(address, new DiscoveredDevice(
                address, name, result.getRssi(), type, serviceUuids,
                manufacturerData, serviceData, tx, raw, beacon, firstSeen, now
        ));
        emit();
    }

    private void emit() {
        List<DiscoveredDevice> snapshot = new ArrayList<>(devices.values());
        Collections.sort(snapshot, (a, b) -> Integer.compare(b.rssi, a.rssi));
        main.post(() -> { if (onUpdate != null) onUpdate.onUpdate(snapshot); });
    }

    private void fail(String message) {
        main.post(() -> { if (onError != null) onError.onError(message); });
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b & 0xFF));
        return sb.toString();
    }
}
