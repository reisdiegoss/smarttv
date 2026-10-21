package com.smarttv.launcher.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.smarttv.launcher.R
import com.smarttv.launcher.SmartTVApp
import com.smarttv.launcher.data.api.TVApiService
import com.smarttv.launcher.data.model.PairRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class PairingActivity : AppCompatActivity() {

    private lateinit var tvCode: TextView
    private lateinit var tvStatus: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var isChecking = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pairing)

        tvCode = findViewById(R.id.tvPairingCode)
        tvStatus = findViewById(R.id.tvPairingStatus)

        requestPairingCode()
    }

    private fun requestPairingCode() {
        val deviceId = SmartTVApp.instance.getDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = api.requestPairing(
                    PairRequest(
                        deviceId = deviceId,
                        pairingCode = "",
                        ipAddress = null
                    )
                )

                withContext(Dispatchers.Main) {
                    tvCode.text = response.pairingCode
                    if (response.isPaired) {
                        goToMain()
                    } else {
                        startCheckLoop()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    tvStatus.text = "Buscando conexão com o servidor 192.168.168.26..."
                    handler.postDelayed({ requestPairingCode() }, 5000)
                }
            }
        }
    }

    private fun startCheckLoop() {
        if (isChecking) return
        isChecking = true

        val checkRunnable = object : Runnable {
            override fun run() {
                val deviceId = SmartTVApp.instance.getDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val config = api.getTVConfig(deviceId)
                        if (config.isPaired) {
                            withContext(Dispatchers.Main) {
                                goToMain()
                            }
                            return@launch
                        }
                    } catch (_: Exception) {}

                    if (isChecking) {
                        handler.postDelayed(this@run, 3000)
                    }
                }
            }
        }
        handler.postDelayed(checkRunnable, 3000)
    }

    private fun goToMain() {
        isChecking = false
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(intent)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        isChecking = false
    }
}
