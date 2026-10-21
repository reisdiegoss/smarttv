package com.smarttv.launcher.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import com.smarttv.launcher.R
import com.smarttv.launcher.SmartTVApp
import com.smarttv.launcher.data.api.TVApiService
import com.smarttv.launcher.data.model.PingRequest
import com.smarttv.launcher.data.model.ShortcutItem
import com.smarttv.launcher.data.model.TVConfigResponse
import com.smarttv.launcher.manager.AppLauncherManager
import com.smarttv.launcher.manager.HdmiInputManager
import com.smarttv.launcher.player.VideoCacheManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

@UnstableApi
class MainActivity : AppCompatActivity() {

    private lateinit var playerView: PlayerView
    private var exoPlayer: ExoPlayer? = null

    // UI elements
    private lateinit var tvTitle: TextView
    private lateinit var tvSubtitle: TextView
    private lateinit var tvTime: TextView
    private lateinit var tvWifiSsid: TextView
    private lateinit var tvWifiPass: TextView
    private lateinit var layoutDock: View
    private lateinit var containerShortcuts: LinearLayout

    private val handler = Handler(Looper.getMainLooper())
    private var currentConfig: TVConfigResponse? = null
    private var autoHideRunnable: Runnable? = null
    private var isDockVisible = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.playerView)
        tvTitle = findViewById(R.id.tvTitle)
        tvSubtitle = findViewById(R.id.tvSubtitle)
        tvTime = findViewById(R.id.tvTime)
        tvWifiSsid = findViewById(R.id.tvWifiSsid)
        tvWifiPass = findViewById(R.id.tvWifiPass)
        layoutDock = findViewById(R.id.layoutDock)
        containerShortcuts = findViewById(R.id.containerShortcuts)

        initExoPlayer()
        startClock()
        loadConfigAndSetup()
        startHeartbeatLoop()
    }

    private fun initExoPlayer() {
        try {
            val cacheDataSourceFactory = VideoCacheManager.buildCacheDataSourceFactory(this)
            val mediaSourceFactory = DefaultMediaSourceFactory(cacheDataSourceFactory)

            exoPlayer = ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .build()
                .apply {
                    repeatMode = Player.REPEAT_MODE_ALL
                    playWhenReady = true
                }
        } catch (e: Exception) {
            exoPlayer = ExoPlayer.Builder(this)
                .build()
                .apply {
                    repeatMode = Player.REPEAT_MODE_ALL
                    playWhenReady = true
                }
        }

        playerView.player = exoPlayer
        playerView.useController = false
    }

    private fun loadConfigAndSetup() {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val config = api.getTVConfig(deviceId)
                withContext(Dispatchers.Main) {
                    if (!config.isPaired) {
                        // Se ainda não foi pareada no painel, abre a tela com o código PIN
                        startActivity(Intent(this@MainActivity, PairingActivity::class.java))
                        finish()
                        return@withContext
                    }
                    applyConfig(config)
                }
            } catch (e: Exception) {
                // Em caso de erro de rede, tenta novamente em 10 segundos
                handler.postDelayed({ loadConfigAndSetup() }, 10000)
            }
        }
    }

    private fun applyConfig(config: TVConfigResponse) {
        this.currentConfig = config

        // Atualiza textos personalizados
        val custom = config.customSettings ?: emptyMap()
        tvTitle.text = (custom["welcome_title"] as? String) ?: "Bem-vindo ao ${config.name}"
        tvSubtitle.text = (custom["welcome_subtitle"] as? String) ?: "Aproveite a sua estadia."
        tvWifiSsid.text = (custom["wifi_ssid"] as? String) ?: "Wi-Fi Hotel"
        tvWifiPass.text = "Senha: " + ((custom["wifi_password"] as? String) ?: "12345678")

        // Configura Playlist de Vídeos no ExoPlayer
        setupPlaylist(config)

        // Renderiza Botões de Atalhos e HDMI da Sky
        setupShortcuts(config)

        // Agenda auto-hide da dock
        resetAutoHideTimer()
    }

    private fun setupPlaylist(config: TVConfigResponse) {
        val playlist = config.playlist ?: return
        if (playlist.items.isEmpty()) return

        exoPlayer?.clearMediaItems()
        val serverUrl = SmartTVApp.instance.getServerUrl().removeSuffix("/")

        for (item in playlist.items) {
            val fullUrl = if (item.streamUrl.startsWith("http")) item.streamUrl else "$serverUrl${item.streamUrl}"
            val mediaItem = MediaItem.fromUri(fullUrl)
            exoPlayer?.addMediaItem(mediaItem)
        }
        exoPlayer?.prepare()
        exoPlayer?.play()
    }

    private fun setupShortcuts(config: TVConfigResponse) {
        containerShortcuts.removeAllViews()

        // Botão HDMI SKY
        val btnSky = layoutInflater.inflate(R.layout.item_shortcut_button, containerShortcuts, false)
        val textSky = btnSky.findViewById<TextView>(R.id.tvShortcutName)
        val iconSky = btnSky.findViewById<ImageView>(R.id.ivShortcutIcon)

        textSky.text = config.hdmi.label
        iconSky.setImageResource(R.drawable.ic_hdmi_tv)
        btnSky.setBackgroundResource(R.drawable.bg_shortcut_sky)

        btnSky.setOnClickListener {
            HdmiInputManager.switchToHdmiInput(this, config.hdmi.inputId)
        }
        btnSky.isFocusable = true
        containerShortcuts.addView(btnSky)

        // Demais aplicativos configurados para esta TV (puxa ícones nativos instalados na TV)
        for (sc in config.shortcuts) {
            if (sc.isHdmi) continue

            val btnApp = layoutInflater.inflate(R.layout.item_shortcut_button, containerShortcuts, false)
            val textApp = btnApp.findViewById<TextView>(R.id.tvShortcutName)
            val iconApp = btnApp.findViewById<ImageView>(R.id.ivShortcutIcon)

            textApp.text = sc.name
            btnApp.setBackgroundResource(R.drawable.bg_shortcut_item)

            // Puxa o Banner ou Ícone oficial já instalado no sistema Android da TV!
            try {
                val banner = packageManager.getApplicationBanner(sc.packageName)
                val icon = packageManager.getApplicationIcon(sc.packageName)
                if (banner != null) {
                    iconApp.setImageDrawable(banner)
                } else if (icon != null) {
                    iconApp.setImageDrawable(icon)
                } else {
                    iconApp.setImageResource(R.drawable.ic_hdmi_tv)
                }
            } catch (e: Exception) {
                // Se o pacote ainda não estiver instalado no momento, usa fallback
                iconApp.setImageResource(R.drawable.ic_hdmi_tv)
            }

            btnApp.setOnClickListener {
                AppLauncherManager.launchApp(this, sc.packageName)
            }
            btnApp.isFocusable = true
            containerShortcuts.addView(btnApp)
        }

        // Foca automaticamente no primeiro botão (Sky HDMI)
        btnSky.requestFocus()
    }

    private fun resetAutoHideTimer() {
        if (!isDockVisible) {
            layoutDock.visibility = View.VISIBLE
            isDockVisible = true
        }
        autoHideRunnable?.let { handler.removeCallbacks(it) }
        autoHideRunnable = Runnable {
            layoutDock.visibility = View.INVISIBLE
            isDockVisible = false
        }
        handler.postDelayed(autoHideRunnable!!, 15000) // 15 segundos sem tocar no controle
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        resetAutoHideTimer()
        return super.dispatchKeyEvent(event)
    }

    private fun startClock() {
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        handler.post(object : Runnable {
            override fun run() {
                tvTime.text = timeFormat.format(Date())
                handler.postDelayed(this, 1000)
            }
        })
    }

    private fun startHeartbeatLoop() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                val deviceId = SmartTVApp.instance.getTvDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        api.ping(PingRequest(deviceId = deviceId, ipAddress = null))
                    } catch (_: Exception) {}
                }
                handler.postDelayed(this, 30000) // Ping a cada 30 segundos
            }
        }, 30000)
    }

    override fun onResume() {
        super.onResume()
        exoPlayer?.play()
        resetAutoHideTimer()
    }

    override fun onPause() {
        super.onPause()
        exoPlayer?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        exoPlayer?.release()
        exoPlayer = null
        autoHideRunnable?.let { handler.removeCallbacks(it) }
    }
}
