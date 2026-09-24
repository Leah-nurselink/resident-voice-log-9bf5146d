package com.carecore.blediscovery;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class DiscoveredDevice {
    public final String address;
    public final String name;
    public final int rssi;
    public final AdvertisementType type;
    public final List<String> serviceUuids;
    public final Map<Integer, String> manufacturerData;
    public final Map<String, String> serviceData;
    public final Integer txPower;
    public final String rawBytes;
    public final BeaconInfo beacon;
    public final long firstSeen;
    public final long lastSeen;

    public DiscoveredDevice(String address, String name, int rssi, AdvertisementType type,
                             List<String> serviceUuids, Map<Integer, String> manufacturerData,
                             Map<String, String> serviceData, Integer txPower, String rawBytes,
                             BeaconInfo beacon, long firstSeen, long lastSeen) {
        this.address = address;
        this.name = name;
        this.rssi = rssi;
        this.type = type;
        this.serviceUuids = serviceUuids == null ? Collections.emptyList() : serviceUuids;
        this.manufacturerData = manufacturerData;
        this.serviceData = serviceData;
        this.txPower = txPower;
        this.rawBytes = rawBytes;
        this.beacon = beacon;
        this.firstSeen = firstSeen;
        this.lastSeen = lastSeen;
    }
}
