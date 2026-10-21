package com.smarttv.launcher

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import java.util.UUID

class SmartTVApp : Application() {

    companion object {
        lateinit var instance: SmartTVApp
            private set
        private const val TAG = "SmartTVApp"
    }

    private lateinit var prefs: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        instance = this

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e(TAG, "FATAL CRASH on thread ${thread.name}: ${throwable.message}", throwable)
        }

        prefs = getSharedPreferences("smarttv_prefs", Context.MODE_PRIVATE)

        // Gera ou recupera um Device ID único persistente para esta TV
        if (getTvDeviceId().isEmpty()) {
            val generatedId = "TV-" + UUID.randomUUID().toString().substring(0, 8).uppercase()
            prefs.edit().putString("device_id", generatedId).apply()
        }
    }

    fun getTvDeviceId(): String {
        return prefs.getString("device_id", "") ?: ""
    }

    fun getServerUrl(): String {
        return prefs.getString("server_url", "http://192.168.168.27/") ?: "http://192.168.168.27/"
    }

    fun setServerUrl(url: String) {
        prefs.edit().putString("server_url", url).apply()
    }
}
