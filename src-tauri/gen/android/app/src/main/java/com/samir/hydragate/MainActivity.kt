package com.samir.hydragate

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

import android.content.Intent
import android.net.VpnService

class MainActivity : TauriActivity() {
    companion object {
        var instance: MainActivity? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun startVpnService() {
        val intent = VpnService.prepare(this)
        if (intent != null) {
            startActivityForResult(intent, 0)
        } else {
            val serviceIntent = Intent(this, HydraVpnService::class.java)
            serviceIntent.action = "START_VPN"
            startService(serviceIntent)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 0 && resultCode == RESULT_OK) {
            val serviceIntent = Intent(this, HydraVpnService::class.java)
            serviceIntent.action = "START_VPN"
            startService(serviceIntent)
        }
    }

    fun stopVpnService() {
        val serviceIntent = Intent(this, HydraVpnService::class.java)
        serviceIntent.action = "STOP_VPN"
        startService(serviceIntent)
    }

    fun isVpnServiceRunning(): Boolean {
        return HydraVpnService.isRunning
    }
}
