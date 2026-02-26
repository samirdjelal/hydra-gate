package com.samir.hydragate

import android.os.Bundle
import androidx.activity.enableEdgeToEdge


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

}
