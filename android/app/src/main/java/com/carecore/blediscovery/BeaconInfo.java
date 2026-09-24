package com.carecore.blediscovery;

/**
 * Framework-agnostic beacon info. No Android UI dependencies.
 */
public class BeaconInfo {
    public final String format;
    public final String uuid;      // iBeacon proximity UUID
    public final Integer major;    // iBeacon
    public final Integer minor;    // iBeacon
    public final Integer txPower;  // calibrated TX power carried in the beacon payload
    public final String namespace; // Eddystone-UID
    public final String instance;  // Eddystone-UID
    public final String url;       // Eddystone-URL

    public BeaconInfo(String format, String uuid, Integer major, Integer minor,
                       Integer txPower, String namespace, String instance, String url) {
        this.format = format;
        this.uuid = uuid;
        this.major = major;
        this.minor = minor;
        this.txPower = txPower;
        this.namespace = namespace;
        this.instance = instance;
        this.url = url;
    }

    public static BeaconInfo simple(String format) {
        return new BeaconInfo(format, null, null, null, null, null, null, null);
    }
}
