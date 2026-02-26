package com.samir.hydragate

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log

class HydraVpnService : VpnService() {
    private val TAG = "HydraGateVpn"
    private var vpnInterface: ParcelFileDescriptor? = null

    companion object {
        var isRunning = false
        init {
            System.loadLibrary("hydragate_lib")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == "START_VPN") {
            startVpn()
        } else if (action == "STOP_VPN") {
            stopVpn()
        }
        return START_NOT_STICKY
    }

    private fun startVpn() {
        if (vpnInterface != null) return

        try {
            val builder = Builder()
            // Configure the proxy TUN interface properties
            builder.addAddress("10.0.0.2", 32)
            builder.addRoute("0.0.0.0", 0) // Route all IPv4
            builder.addDnsServer("1.1.1.1")
            builder.addDnsServer("8.8.8.8")
            
            // Bypass the proxy app itself so it can connect to the internet
            builder.addDisallowedApplication(applicationContext.packageName)
            
            vpnInterface = builder
                .setSession("HydraGate")
                .setBlocking(true)
                .establish()

            val fd = vpnInterface?.fd
            if (fd != null) {
                isRunning = true
                Log.d(TAG, "VPN established. FD: $fd")
                passFdToRust(fd)
            } else {
                Log.e(TAG, "Failed to establish VPN: FD is null")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting VPN: \${e.message}")
        }
    }

    private fun stopVpn() {
        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing VPN interface", e)
        }
        isRunning = false
        vpnInterface = null
        stopSelf()
    }

    external fun passFdToRust(fd: Int)

    override fun onDestroy() {
        super.onDestroy()
        stopVpn()
    }
}
