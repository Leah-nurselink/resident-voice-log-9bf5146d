package com.carecore.blediscovery;

import android.bluetooth.le.ScanRecord;
import android.os.ParcelUuid;

public class BeaconParser {

    private static final int APPLE_COMPANY_ID = 0x004C;
    private static final ParcelUuid EDDYSTONE_UUID =
            ParcelUuid.fromString("0000FEAA-0000-1000-8000-00805F9B34FB");

    public static BeaconInfo parse(ScanRecord record) {
        if (record == null) return null;
        BeaconInfo ibeacon = parseIBeacon(record);
        if (ibeacon != null) return ibeacon;
        BeaconInfo eddystone = parseEddystone(record);
        if (eddystone != null) return eddystone;
        return null;
    }

    private static BeaconInfo parseIBeacon(ScanRecord record) {
        byte[] data = record.getManufacturerSpecificData(APPLE_COMPANY_ID);
        if (data == null || data.length < 23) return null;
        if ((data[0] & 0xFF) != 0x02) return null;
        if ((data[1] & 0xFF) != 0x15) return null;

        StringBuilder uuidBuilder = new StringBuilder();
        for (int i = 2; i <= 17; i++) {
            uuidBuilder.append(String.format("%02x", data[i] & 0xFF));
            if (i == 5 || i == 7 || i == 9 || i == 11) uuidBuilder.append('-');
        }
        int major = ((data[18] & 0xFF) << 8) | (data[19] & 0xFF);
        int minor = ((data[20] & 0xFF) << 8) | (data[21] & 0xFF);
        int tx = data[22];

        return new BeaconInfo("iBeacon", uuidBuilder.toString(), major, minor, tx, null, null, null);
    }

    private static BeaconInfo parseEddystone(ScanRecord record) {
        byte[] data = record.getServiceData(EDDYSTONE_UUID);
        if (data == null || data.length == 0) return null;
        int frameType = data[0] & 0xFF;
        switch (frameType) {
            case 0x00: {
                if (data.length < 18) return null;
                int txPower = data[1];
                String namespace = hex(data, 2, 10);
                String instance = hex(data, 12, 6);
                return new BeaconInfo("Eddystone-UID", null, null, null, txPower, namespace, instance, null);
            }
            case 0x10: {
                int txPower = data[1];
                String url = decodeEddystoneUrl(data);
                return new BeaconInfo("Eddystone-URL", null, null, null, txPower, null, null, url);
            }
            case 0x20:
                return BeaconInfo.simple("Eddystone-TLM");
            default:
                return BeaconInfo.simple("Eddystone");
        }
    }

    private static String decodeEddystoneUrl(byte[] data) {
        if (data.length < 3) return "";
        String[] schemes = { "http://www.", "https://www.", "http://", "https://" };
        StringBuilder sb = new StringBuilder();
        int scheme = data[2] & 0xFF;
        if (scheme < schemes.length) sb.append(schemes[scheme]);
        for (int i = 3; i < data.length; i++) {
            int b = data[i] & 0xFF;
            if (b >= 0x20 && b <= 0x7E) sb.append((char) b);
        }
        return sb.toString();
    }

    private static String hex(byte[] data, int start, int len) {
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < start + len; i++) sb.append(String.format("%02x", data[i] & 0xFF));
        return sb.toString();
    }
}
