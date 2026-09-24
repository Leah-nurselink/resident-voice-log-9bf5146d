package com.carecore.blediscovery;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Map;

@CapacitorPlugin(
    name = "CareCoreBle",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
            alias = "location"
        ),
        @Permission(
            strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT },
            alias = "bluetooth"
        )
    }
)
public class CareCoreBlePlugin extends Plugin {

    private BleScanner scanner;

    @PluginMethod
    public void initialize(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", ensureScanner().isBluetoothEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestEnable(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the Bluetooth enable prompt", e);
        }
    }

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        boolean enabled = lm != null
                && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                    || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        JSObject ret = new JSObject();
        ret.put("value", enabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void requestLEScan(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED
                || getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAliases(new String[] { "bluetooth", "location" }, call, "scanPermsCallback");
            return;
        }
        startScanning(call);
    }

    @PermissionCallback
    private void scanPermsCallback(PluginCall call) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED
                && getPermissionState("location") == PermissionState.GRANTED) {
            startScanning(call);
        } else {
            call.reject("Bluetooth/location permission was not granted.");
        }
    }

    @PluginMethod
    public void stopLEScan(PluginCall call) {
        if (scanner != null) scanner.stop();
        call.resolve();
    }

    private void startScanning(PluginCall call) {
        BleScanner s = ensureScanner();
        s.onUpdate = devices -> {
            for (DiscoveredDevice device : devices) emitScanResult(device);
        };
        s.onError = message -> {
            JSObject err = new JSObject();
            err.put("message", message);
            notifyListeners("onScanError", err);
        };
        s.start();
        call.resolve();
    }

    private BleScanner ensureScanner() {
        if (scanner == null) scanner = new BleScanner(getContext());
        return scanner;
    }

    private void emitScanResult(DiscoveredDevice dev) {
        JSObject ret = new JSObject();
        ret.put("rssi", dev.rssi);
        if (dev.txPower != null) ret.put("txPower", dev.txPower);
        ret.put("localName", dev.name != null ? dev.name : JSObject.NULL);

        JSObject deviceObj = new JSObject();
        deviceObj.put("deviceId", dev.address);
        if (dev.name != null) deviceObj.put("name", dev.name);
        ret.put("device", deviceObj);

        JSObject mfr = new JSObject();
        for (Map.Entry<Integer, String> entry : dev.manufacturerData.entrySet()) {
            mfr.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        ret.put("manufacturerData", mfr);

        JSObject svc = new JSObject();
        for (Map.Entry<String, String> entry : dev.serviceData.entrySet()) {
            svc.put(entry.getKey(), entry.getValue());
        }
        ret.put("serviceData", svc);

        if (dev.rawBytes != null) ret.put("rawAdvertisement", dev.rawBytes);

        notifyListeners("onScanResult", ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (scanner != null) scanner.stop();
        super.handleOnDestroy();
    }
}
