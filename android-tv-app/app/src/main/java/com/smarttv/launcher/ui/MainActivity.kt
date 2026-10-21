package com.smarttv.launcher.ui

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
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
import com.smarttv.launcher.data.model.*
import com.smarttv.launcher.manager.AppLauncherManager
import com.smarttv.launcher.manager.HdmiInputManager
import com.smarttv.launcher.player.VideoCacheManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.text.SimpleDateFormat
import java.util.*

@UnstableApi
class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    private lateinit var playerView: PlayerView
    private var exoPlayer: ExoPlayer? = null

    // Launcher UI elements
    private lateinit var layoutHeader: View
    private lateinit var tvTitle: TextView
    private lateinit var tvSubtitle: TextView
    private lateinit var tvTime: TextView
    private lateinit var tvWifiSsid: TextView
    private lateinit var tvWifiPass: TextView
    private lateinit var layoutDock: View
    private lateinit var containerShortcuts: LinearLayout

    // Overlay Container & Header
    private lateinit var layoutPairing: View
    private lateinit var tvOverlayTitle: TextView
    private lateinit var tvServerStatus: TextView

    // Mode 1: Initial Pairing (Unpaired)
    private lateinit var panelPairingUnpaired: View
    private lateinit var tvPairingCode: TextView
    private lateinit var tvPairingStatus: TextView
    private lateinit var tvDeviceIdInfo: TextView
    private lateinit var containerAvailableTvs: LinearLayout

    // Mode 2: In-App TV Settings (Paired - accessible via MENU key)
    private lateinit var panelPairingSettings: View
    private lateinit var tvCurrentHdmiState: TextView
    private lateinit var btnHdmi1: Button
    private lateinit var btnHdmi2: Button
    private lateinit var btnHdmi3: Button
    private lateinit var btnHdmiNone: Button
    private lateinit var btnSettingsSwitchRoom: Button
    private lateinit var containerSettingsApps: LinearLayout
    private lateinit var btnSettingsDone: Button

    private val handler = Handler(Looper.getMainLooper())
    private var currentConfig: TVConfigResponse? = null
    private var allSystemApps: List<ShortcutItem> = emptyList()
    private var selectedAppIds: MutableSet<Int> = mutableSetOf()
    private var currentHdmiPort: String = "HDMI 1"
    private var lastConfigUpdatedAt: String? = null
    private var autoHideRunnable: Runnable? = null
    private var isDockVisible = true
    private var isPollingPairStatus = false
    private var pairPollRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Elementos da tela de exibição (Launcher)
        playerView = findViewById(R.id.playerView)
        layoutHeader = findViewById(R.id.layoutHeader)
        tvTitle = findViewById(R.id.tvTitle)
        tvSubtitle = findViewById(R.id.tvSubtitle)
        tvTime = findViewById(R.id.tvTime)
        tvWifiSsid = findViewById(R.id.tvWifiSsid)
        tvWifiPass = findViewById(R.id.tvWifiPass)
        layoutDock = findViewById(R.id.layoutDock)
        containerShortcuts = findViewById(R.id.containerShortcuts)

        // Overlay Container & Header
        layoutPairing = findViewById(R.id.layoutPairing)
        tvOverlayTitle = findViewById(R.id.tvOverlayTitle)
        tvServerStatus = findViewById(R.id.tvServerStatus)

        // Mode 1: Inicial (Não pareado)
        panelPairingUnpaired = findViewById(R.id.panelPairingUnpaired)
        tvPairingCode = findViewById(R.id.tvPairingCode)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)
        tvDeviceIdInfo = findViewById(R.id.tvDeviceIdInfo)
        containerAvailableTvs = findViewById(R.id.containerAvailableTvs)

        // Mode 2: Ajustes da TV (Pareado)
        panelPairingSettings = findViewById(R.id.panelPairingSettings)
        tvCurrentHdmiState = findViewById(R.id.tvCurrentHdmiState)
        btnHdmi1 = findViewById(R.id.btnHdmi1)
        btnHdmi2 = findViewById(R.id.btnHdmi2)
        btnHdmi3 = findViewById(R.id.btnHdmi3)
        btnHdmiNone = findViewById(R.id.btnHdmiNone)
        btnSettingsSwitchRoom = findViewById(R.id.btnSettingsSwitchRoom)
        containerSettingsApps = findViewById(R.id.containerSettingsApps)
        btnSettingsDone = findViewById(R.id.btnSettingsDone)

        tvDeviceIdInfo.text = "ID deste Dispositivo: ${SmartTVApp.instance.getTvDeviceId()}"

        setupSettingsListeners()
        initExoPlayer()
        startClock()

        if (!SmartTVApp.instance.isPaired()) {
            showPairingScreen()
        } else {
            showLauncherScreen()
            loadConfigAndSetup()
        }

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
            Log.e(TAG, "Fallback simples para ExoPlayer sem cache", e)
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

    /**
     * Exibe a tela de Pareamento e Configuração (PIN ou Ajustes Locais)
     */
    private fun showPairingScreen() {
        layoutPairing.visibility = View.VISIBLE
        layoutDock.visibility = View.GONE
        layoutHeader.visibility = View.GONE
        exoPlayer?.pause()

        if (!SmartTVApp.instance.isPaired()) {
            // Modo 1: Novo pareamento
            panelPairingUnpaired.visibility = View.VISIBLE
            panelPairingSettings.visibility = View.GONE
            tvOverlayTitle.text = "SMART TV MANAGER"
            requestPairingCodeAndRooms()
            startPairPolling()
        } else {
            // Modo 2: Ajustes da TV via controle remoto
            panelPairingUnpaired.visibility = View.GONE
            panelPairingSettings.visibility = View.VISIBLE
            tvOverlayTitle.text = "AJUSTES — ${currentConfig?.name ?: "ESTA TV"}"
            renderSettingsPanel()
        }
    }

    /**
     * Exibe o Launcher Normal (Vídeo em Tela Cheia + Dock + Header)
     */
    private fun showLauncherScreen() {
        stopPairPolling()
        layoutPairing.visibility = View.GONE
        layoutDock.visibility = View.VISIBLE
        layoutHeader.visibility = View.VISIBLE
        exoPlayer?.play()
        resetAutoHideTimer()
    }

    private fun togglePairingOverlay() {
        if (layoutPairing.visibility == View.VISIBLE) {
            if (SmartTVApp.instance.isPaired()) {
                showLauncherScreen()
            }
        } else {
            showPairingScreen()
        }
    }

    /**
     * Configura ouvintes dos botões de ajustes rápidos na tela da TV
     */
    private fun setupSettingsListeners() {
        btnHdmi1.setOnClickListener { selectHdmiPortOnTv("HDMI 1") }
        btnHdmi2.setOnClickListener { selectHdmiPortOnTv("HDMI 2") }
        btnHdmi3.setOnClickListener { selectHdmiPortOnTv("HDMI 3") }
        btnHdmiNone.setOnClickListener { selectHdmiPortOnTv("NONE") }

        btnSettingsDone.setOnClickListener {
            showLauncherScreen()
        }

        btnSettingsSwitchRoom.setOnClickListener {
            SmartTVApp.instance.setPaired(false)
            currentConfig = null
            showPairingScreen()
        }
    }

    /**
     * Renderiza o painel de ajustes locais (HDMI e Apps) na TV
     */
    private fun renderSettingsPanel() {
        val config = currentConfig ?: return

        // 1. Porta HDMI Atual
        currentHdmiPort = if (config.hdmi.enabled) config.hdmi.inputId else "NONE"
        updateHdmiChipsHighlight()

        // 2. Apps Ativos
        selectedAppIds.clear()
        for (sc in config.shortcuts) {
            if (!sc.isHdmi) {
                selectedAppIds.add(sc.id)
            }
        }

        populateSettingsAppsList(config.shortcuts)
        btnSettingsDone.requestFocus()
    }

    private fun updateHdmiChipsHighlight() {
        tvCurrentHdmiState.text = when (currentHdmiPort) {
            "NONE" -> "Porta Atual: Desabilitada (Botão oculto)"
            else -> "Porta Atual: $currentHdmiPort"
        }

        btnHdmi1.isSelected = (currentHdmiPort == "HDMI 1")
        btnHdmi2.isSelected = (currentHdmiPort == "HDMI 2")
        btnHdmi3.isSelected = (currentHdmiPort == "HDMI 3")
        btnHdmiNone.isSelected = (currentHdmiPort == "NONE")
    }

    private fun selectHdmiPortOnTv(port: String) {
        currentHdmiPort = port
        updateHdmiChipsHighlight()

        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                api.quickUpdate(
                    QuickUpdateRequest(
                        deviceId = deviceId,
                        hdmiInputId = currentHdmiPort
                    )
                )
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Entrada alterada para $port", Toast.LENGTH_SHORT).show()
                    loadConfigAndSetup()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao salvar porta HDMI", e)
            }
        }
    }

    /**
     * Preenche a lista vertical de aplicativos para ligar/desligar com o controle remoto
     */
    private fun populateSettingsAppsList(shortcuts: List<ShortcutItem>) {
        containerSettingsApps.removeAllViews()

        for (sc in shortcuts) {
            if (sc.isHdmi) continue

            val row = layoutInflater.inflate(R.layout.item_tv_app_toggle, containerSettingsApps, false)
            val iconCheck = row.findViewById<TextView>(R.id.tvAppCheckIcon)
            val nameText = row.findViewById<TextView>(R.id.tvAppName)
            val statusText = row.findViewById<TextView>(R.id.tvAppStatus)

            nameText.text = sc.name
            val isChecked = selectedAppIds.contains(sc.id)
            updateAppToggleVisual(iconCheck, statusText, isChecked)

            row.isFocusable = true
            row.isClickable = true

            row.setOnClickListener {
                if (selectedAppIds.contains(sc.id)) {
                    selectedAppIds.remove(sc.id)
                    updateAppToggleVisual(iconCheck, statusText, false)
                } else {
                    selectedAppIds.add(sc.id)
                    updateAppToggleVisual(iconCheck, statusText, true)
                }
                saveAppShortcutsToServer()
            }

            containerSettingsApps.addView(row)
        }
    }

    private fun updateAppToggleVisual(iconCheck: TextView, statusText: TextView, isChecked: Boolean) {
        if (isChecked) {
            iconCheck.text = "✓"
            iconCheck.setTextColor(Color.parseColor("#34D399"))
            statusText.text = "Ativo na barra inferior (Pressione OK para desativar)"
            statusText.setTextColor(Color.parseColor("#34D399"))
        } else {
            iconCheck.text = "✕"
            iconCheck.setTextColor(Color.parseColor("#EF4444"))
            statusText.text = "Oculto nesta TV (Pressione OK para ativar)"
            statusText.setTextColor(Color.parseColor("#94A3B8"))
        }
    }

    private fun saveAppShortcutsToServer() {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                api.quickUpdate(
                    QuickUpdateRequest(
                        deviceId = deviceId,
                        selectedShortcuts = selectedAppIds.toList()
                    )
                )
                withContext(Dispatchers.Main) {
                    loadConfigAndSetup()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao salvar atalhos na TV", e)
            }
        }
    }

    /**
     * Solicita o código PIN ao servidor e puxa a lista de TVs/Quartos cadastrados
     */
    private fun requestPairingCodeAndRooms() {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        tvServerStatus.text = "● Conectando ao Servidor..."
        tvServerStatus.setTextColor(Color.parseColor("#60A5FA"))

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val pairResp = api.requestPairing(
                    PairRequest(
                        deviceId = deviceId,
                        pairingCode = "",
                        ipAddress = null,
                        appVersion = "1.0.1"
                    )
                )

                val tvList = api.listTVs()

                withContext(Dispatchers.Main) {
                    tvServerStatus.text = "● Conectado ao Servidor (192.168.168.27)"
                    tvServerStatus.setTextColor(Color.parseColor("#34D399"))

                    tvPairingCode.text = pairResp.pairingCode
                    tvPairingStatus.text = "Aguardando aprovação no painel ou seleção ao lado..."

                    if (pairResp.isPaired) {
                        SmartTVApp.instance.setPaired(true)
                        showLauncherScreen()
                        loadConfigAndSetup()
                        return@withContext
                    }

                    populateRoomsList(tvList)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao conectar ao servidor", e)
                withContext(Dispatchers.Main) {
                    tvServerStatus.text = "● Falha ao conectar ao servidor (192.168.168.27)"
                    tvServerStatus.setTextColor(Color.parseColor("#EF4444"))
                    tvPairingStatus.text = "Verifique a rede/Wi-Fi. Tentando novamente..."
                    handler.postDelayed({ requestPairingCodeAndRooms() }, 5000)
                }
            }
        }
    }

    /**
     * Preenche a lista da direita com os botões selecionáveis via controle remoto
     */
    private fun populateRoomsList(tvList: List<TVListItem>) {
        containerAvailableTvs.removeAllViews()

        if (tvList.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "Nenhum quarto cadastrado ainda.\nCadastre no Painel: http://192.168.168.27/"
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 14f
                setPadding(0, 20, 0, 0)
            }
            containerAvailableTvs.addView(emptyTv)
            return
        }

        var firstButton: View? = null

        for (tv in tvList) {
            val btn = layoutInflater.inflate(R.layout.item_tv_room_button, containerAvailableTvs, false)
            val nameView = btn.findViewById<TextView>(R.id.tvRoomName)
            val detailsView = btn.findViewById<TextView>(R.id.tvRoomDetails)

            nameView.text = tv.name
            val statusText = if (tv.isPaired == true) "Perfil Configurado" else "Novo Quarto"
            detailsView.text = "${tv.roomGroup ?: "Geral"} • $statusText • Pressione OK para vincular"

            btn.isFocusable = true
            btn.isClickable = true

            btn.setOnClickListener {
                bindThisTvToRoom(tv)
            }

            containerAvailableTvs.addView(btn)

            if (firstButton == null) {
                firstButton = btn
            }
        }

        firstButton?.requestFocus()
    }

    private fun bindThisTvToRoom(tv: TVListItem) {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        tvPairingStatus.text = "Vinculando a '${tv.name}'..."

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                api.bindDevice(
                    BindDeviceRequest(
                        tvId = tv.id,
                        deviceId = deviceId,
                        ipAddress = null,
                        appVersion = "1.0.1"
                    )
                )

                withContext(Dispatchers.Main) {
                    SmartTVApp.instance.setPaired(true)
                    Toast.makeText(this@MainActivity, "TV vinculada a ${tv.name} com sucesso!", Toast.LENGTH_LONG).show()
                    showLauncherScreen()
                    loadConfigAndSetup()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao vincular TV", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Erro ao vincular: ${e.message}", Toast.LENGTH_LONG).show()
                    tvPairingStatus.text = "Falha ao vincular. Tente novamente."
                }
            }
        }
    }

    private fun startPairPolling() {
        if (isPollingPairStatus) return
        isPollingPairStatus = true

        pairPollRunnable = object : Runnable {
            override fun run() {
                val deviceId = SmartTVApp.instance.getTvDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val config = api.getTVConfig(deviceId)
                        if (config.isPaired) {
                            withContext(Dispatchers.Main) {
                                SmartTVApp.instance.setPaired(true)
                                showLauncherScreen()
                                applyConfig(config)
                            }
                            return@launch
                        }
                    } catch (_: Exception) {}

                    if (isPollingPairStatus) {
                        pairPollRunnable?.let { handler.postDelayed(it, 3000) }
                    }
                }
            }
        }
        pairPollRunnable?.let { handler.postDelayed(it, 3000) }
    }

    private fun stopPairPolling() {
        isPollingPairStatus = false
        pairPollRunnable?.let { handler.removeCallbacks(it) }
    }

    /**
     * Carrega as configurações completas desta TV (Vídeos, Atalhos, Wi-Fi, SKY HDMI)
     */
    private fun loadConfigAndSetup() {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val config = api.getTVConfig(deviceId)
                withContext(Dispatchers.Main) {
                    if (!config.isPaired) {
                        SmartTVApp.instance.setPaired(false)
                        showPairingScreen()
                        return@withContext
                    }
                    applyConfig(config)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao carregar config da TV", e)
                if (e is HttpException && e.code() == 404) {
                    withContext(Dispatchers.Main) {
                        SmartTVApp.instance.setPaired(false)
                        showPairingScreen()
                    }
                    return@launch
                }
                handler.postDelayed({ loadConfigAndSetup() }, 10000)
            }
        }
    }

    private fun applyConfig(config: TVConfigResponse) {
        this.currentConfig = config

        // Atualiza textos personalizados
        val custom = config.customSettings ?: emptyMap()
        tvTitle.text = (custom["welcome_title"] as? String) ?: "Bem-vindo ao ${config.name}"
        tvSubtitle.text = (custom["welcome_subtitle"] as? String) ?: "Aproveite a sua estadia com conforto e entretenimento."
        tvWifiSsid.text = (custom["wifi_ssid"] as? String) ?: "Wi-Fi Hotel"
        tvWifiPass.text = "Senha: " + ((custom["wifi_password"] as? String) ?: "12345678")

        // Configura Playlist de Vídeos no ExoPlayer
        setupPlaylist(config)

        // Renderiza Botões de Atalhos e HDMI da Sky de acordo com a seleção
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

        // 1. Botão HDMI SKY (Apenas se estiver habilitado e com porta válida para esta TV)
        if (config.hdmi.enabled && config.hdmi.inputId != "NONE" && config.hdmi.inputId.isNotBlank()) {
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
        }

        // 2. Aplicativos configurados individualmente para esta TV
        for (sc in config.shortcuts) {
            if (sc.isHdmi) continue

            val btnApp = layoutInflater.inflate(R.layout.item_shortcut_button, containerShortcuts, false)
            val textApp = btnApp.findViewById<TextView>(R.id.tvShortcutName)
            val iconApp = btnApp.findViewById<ImageView>(R.id.ivShortcutIcon)

            textApp.text = sc.name
            btnApp.setBackgroundResource(R.drawable.bg_shortcut_item)

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
                iconApp.setImageResource(R.drawable.ic_hdmi_tv)
            }

            btnApp.setOnClickListener {
                AppLauncherManager.launchApp(this, sc.packageName)
            }
            btnApp.isFocusable = true
            containerShortcuts.addView(btnApp)
        }

        if (containerShortcuts.childCount > 0) {
            containerShortcuts.getChildAt(0).requestFocus()
        }
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
        handler.postDelayed(autoHideRunnable!!, 15000)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        resetAutoHideTimer()
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Tecla MENU ou SETTINGS no controle abre/fecha o painel de ajustes
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_SETTINGS) {
            togglePairingOverlay()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun startClock() {
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        handler.post(object : Runnable {
            override fun run() {
                tvTime.text = timeFormat.format(Date())
                handler.postDelayed(this, 30000)
            }
        })
    }

    /**
     * Heartbeat contínuo:
     * 1. Atualiza status Online no painel
     * 2. Se a TV for alterada no painel web (mudou HDMI, apps, vídeos), atualiza a tela na hora em tempo real!
     */
    private fun startHeartbeatLoop() {
        handler.post(object : Runnable {
            override fun run() {
                val deviceId = SmartTVApp.instance.getTvDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val response = api.ping(
                            PingRequest(
                                deviceId = deviceId,
                                ipAddress = null,
                                appVersion = "1.0.1"
                            )
                        )
                        val isServerPaired = (response["is_paired"] as? Boolean) ?: false
                        val serverUpdatedAt = response["updated_at"] as? String

                        if (SmartTVApp.instance.isPaired() != isServerPaired) {
                            withContext(Dispatchers.Main) {
                                SmartTVApp.instance.setPaired(isServerPaired)
                                if (isServerPaired) {
                                    showLauncherScreen()
                                    loadConfigAndSetup()
                                } else {
                                    showPairingScreen()
                                }
                            }
                        } else if (isServerPaired && serverUpdatedAt != null && serverUpdatedAt != lastConfigUpdatedAt) {
                            // Nova configuração aplicada no painel web!
                            Log.d(TAG, "Configuração atualizada no servidor ($serverUpdatedAt). Recarregando TV...")
                            lastConfigUpdatedAt = serverUpdatedAt
                            withContext(Dispatchers.Main) {
                                loadConfigAndSetup()
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Heartbeat ping falhou: ${e.message}")
                    }
                }

                handler.postDelayed(this, 15000) // Verifica a cada 15 segundos
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        stopPairPolling()
        exoPlayer?.release()
        exoPlayer = null
    }
}
