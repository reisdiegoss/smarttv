package com.smarttv.launcher.ui

import android.app.AlertDialog
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import coil.load
import com.smarttv.launcher.BuildConfig
import com.smarttv.launcher.R
import com.smarttv.launcher.SmartTVApp
import com.smarttv.launcher.data.api.TVApiService
import com.smarttv.launcher.data.model.*
import com.smarttv.launcher.manager.AppCleanupManager
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

    // Launcher UI elements (Header & Dock)
    private lateinit var layoutHeader: View
    private lateinit var containerWelcome: View
    private lateinit var containerHeaderWidgets: View
    private lateinit var tvTitle: TextView
    private lateinit var tvSubtitle: TextView
    private lateinit var cardClock: View
    private lateinit var ivClockIcon: ImageView
    private lateinit var tvTime: TextView
    private lateinit var tvDate: TextView
    private lateinit var cardWeather: View
    private lateinit var ivWeatherIcon: ImageView
    private lateinit var tvWeatherTemp: TextView
    private lateinit var tvWeatherCity: TextView
    private lateinit var cardWifi: View
    private lateinit var ivWifiQrCode: ImageView
    private lateinit var tvWifiSsid: TextView
    private lateinit var tvWifiPass: TextView
    private lateinit var containerWifiText: View
    private lateinit var layoutDock: View
    private lateinit var containerShortcuts: LinearLayout

    // Layout Split Sidebar elements (30% right panel)
    private lateinit var layoutSidebar: View
    private lateinit var tvSidebarTime: TextView
    private lateinit var tvSidebarTitle: TextView
    private lateinit var tvSidebarSubtitle: TextView
    private lateinit var sidebarCardWifi: View
    private lateinit var ivSidebarQrCode: ImageView
    private lateinit var tvSidebarWifiSsid: TextView
    private lateinit var tvSidebarWifiPass: TextView
    private lateinit var containerSidebarWifiText: View
    private lateinit var containerSidebarShortcuts: LinearLayout

    // Layout Ticker Marquee (Digital Mural)
    private lateinit var layoutTicker: View
    private lateinit var tvTickerText: TextView

    // Overlay Container & Header
    private lateinit var layoutPairing: View
    private lateinit var tvOverlayTitle: TextView
    private lateinit var tvServerStatus: TextView
    private lateinit var btnSetDefaultLauncherTop: Button
    private lateinit var btnSetDefaultLauncherBottom: Button

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
    private lateinit var btnSetDefaultLauncher: Button
    private lateinit var btnSettingsExitApp: Button
    private lateinit var containerSettingsApps: LinearLayout
    private lateinit var btnSettingsDone: Button

    private val handler = Handler(Looper.getMainLooper())
    private var currentConfig: TVConfigResponse? = null
    private var selectedAppIds: MutableSet<Int> = mutableSetOf()
    private var currentHdmiPort: String = "HDMI 1"
    private var lastConfigUpdatedAt: String? = null
    private var autoHideRunnable: Runnable? = null
    private var isDockVisible = true
    private var isPollingPairStatus = false
    private var pairPollRunnable: Runnable? = null
    private var currentLoadedMediaUrls: List<String> = emptyList()
    private var pendingCleanupReport = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Mantém a tela da TV sempre ligada no Launcher
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        // Elementos da tela de exibição (Launcher)
        playerView = findViewById(R.id.playerView)
        layoutHeader = findViewById(R.id.layoutHeader)
        containerWelcome = findViewById(R.id.containerWelcome)
        containerHeaderWidgets = findViewById(R.id.containerHeaderWidgets)
        tvTitle = findViewById(R.id.tvTitle)
        tvSubtitle = findViewById(R.id.tvSubtitle)
        cardClock = findViewById(R.id.cardClock)
        ivClockIcon = findViewById(R.id.ivClockIcon)
        tvTime = findViewById(R.id.tvTime)
        tvDate = findViewById(R.id.tvDate)
        cardWeather = findViewById(R.id.cardWeather)
        ivWeatherIcon = findViewById(R.id.ivWeatherIcon)
        tvWeatherTemp = findViewById(R.id.tvWeatherTemp)
        tvWeatherCity = findViewById(R.id.tvWeatherCity)
        cardWifi = findViewById(R.id.cardWifi)
        ivWifiQrCode = findViewById(R.id.ivWifiQrCode)
        tvWifiSsid = findViewById(R.id.tvWifiSsid)
        tvWifiPass = findViewById(R.id.tvWifiPass)
        containerWifiText = findViewById(R.id.containerWifiText)
        layoutDock = findViewById(R.id.layoutDock)
        containerShortcuts = findViewById(R.id.containerShortcuts)

        // Elementos da Barra Lateral (Split Sidebar)
        layoutSidebar = findViewById(R.id.layoutSidebar)
        tvSidebarTime = findViewById(R.id.tvSidebarTime)
        tvSidebarTitle = findViewById(R.id.tvSidebarTitle)
        tvSidebarSubtitle = findViewById(R.id.tvSidebarSubtitle)
        sidebarCardWifi = findViewById(R.id.sidebarCardWifi)
        ivSidebarQrCode = findViewById(R.id.ivSidebarQrCode)
        tvSidebarWifiSsid = findViewById(R.id.tvSidebarWifiSsid)
        tvSidebarWifiPass = findViewById(R.id.tvSidebarWifiPass)
        containerSidebarWifiText = findViewById(R.id.containerSidebarWifiText)
        containerSidebarShortcuts = findViewById(R.id.containerSidebarShortcuts)

        // Elementos do Mural Ticker
        layoutTicker = findViewById(R.id.layoutTicker)
        tvTickerText = findViewById(R.id.tvTickerText)

        // Overlay Container & Header
        layoutPairing = findViewById(R.id.layoutPairing)
        tvOverlayTitle = findViewById(R.id.tvOverlayTitle)
        tvServerStatus = findViewById(R.id.tvServerStatus)
        btnSetDefaultLauncherTop = findViewById(R.id.btnSetDefaultLauncherTop)
        btnSetDefaultLauncherBottom = findViewById(R.id.btnSetDefaultLauncherBottom)

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
        btnSetDefaultLauncher = findViewById(R.id.btnSetDefaultLauncher)
        btnSettingsExitApp = findViewById(R.id.btnSettingsExitApp)
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
        layoutSidebar.visibility = View.GONE
        layoutTicker.visibility = View.GONE
        exoPlayer?.pause()

        if (!SmartTVApp.instance.isPaired()) {
            // Modo 1: Novo pareamento
            panelPairingUnpaired.visibility = View.VISIBLE
            panelPairingSettings.visibility = View.GONE
            tvOverlayTitle.text = "SMART TV LAUNCHER • PAREAMENTO"
            requestPairingCodeAndRooms()
            startPairStatusPolling()
        } else {
            // Modo 2: TV já pareada - Menu rápido de HDMI e Apps
            panelPairingUnpaired.visibility = View.GONE
            panelPairingSettings.visibility = View.VISIBLE
            val tvName = currentConfig?.name ?: "Esta Smart TV"
            tvOverlayTitle.text = "AJUSTES: $tvName"
            renderSettingsPanel()
        }
    }

    /**
     * Retorna à exibição normal da tela inicial da TV
     */
    private fun showLauncherScreen() {
        stopPairPolling()
        layoutPairing.visibility = View.GONE
        exoPlayer?.play()

        currentConfig?.let {
            applyLayout(it)
        } ?: run {
            layoutDock.visibility = View.VISIBLE
            layoutHeader.visibility = View.VISIBLE
        }

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
     * Define este APK como o Launcher (Home) padrão do sistema Android TV
     * Utiliza o componente FakeHomeActivity para invalidar o cache de Home do sistema e forçar
     * o diálogo nativo do Android TV ("Usar Fasano SMARTTV como tela inicial: [Desta vez] [Sempre]").
     */
    private fun requestSetDefaultLauncher() {
        try {
            val pm = packageManager
            val fakeComponent = ComponentName(this, FakeHomeActivity::class.java)

            // 1. Habilita temporariamente a FakeHomeActivity
            pm.setComponentEnabledSetting(
                fakeComponent,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            // 2. Dispara o Intent de HOME para forçar a exibição do seletor
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(Intent.createChooser(homeIntent, "Selecione 'Fasano SMARTTV' e toque em 'Sempre'"))

            // 3. Desabilita a FakeHomeActivity após 2.5 segundos
            handler.postDelayed({
                try {
                    pm.setComponentEnabledSetting(
                        fakeComponent,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    )
                } catch (ignored: Exception) {}
            }, 2500)
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao acionar seletor de launcher padrão", e)
            openAndroidSystemSettings()
        }
    }

    /**
     * Abre as configurações nativas do Android TV
     */
    private fun openAndroidSystemSettings() {
        exoPlayer?.pause()
        try {
            val intent = Intent(Settings.ACTION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao abrir configurações da TV", e)
            Toast.makeText(this, "Não foi possível abrir as configurações da TV", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Retorna à tela inicial / Launcher original da TV (modo saída segura de kiosk)
     */
    private fun exitToStockLauncher() {
        exoPlayer?.pause()
        try {
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
            }
            val resolveInfos = packageManager.queryIntentActivities(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
            var launchedStock = false
            for (info in resolveInfos) {
                val pkg = info.activityInfo.packageName
                if (pkg != packageName && pkg != "com.smarttv.launcher") {
                    val launchIntent = packageManager.getLaunchIntentForPackage(pkg)
                        ?: Intent(Intent.ACTION_MAIN).apply {
                            setClassName(pkg, info.activityInfo.name)
                            addCategory(Intent.CATEGORY_HOME)
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                    startActivity(launchIntent)
                    launchedStock = true
                    break
                }
            }
            if (!launchedStock) {
                finishAffinity()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao retornar ao launcher original", e)
            finishAffinity()
        }
    }

    /**
     * Diálogo de Autenticação com Senha / PIN para Administrador e Saída
     */
    private fun promptAdminPinDialog(onSuccessAction: (() -> Unit)? = null) {
        exoPlayer?.pause()
        val custom = currentConfig?.customSettings ?: emptyMap()
        val expectedPin = ((custom["pin_code"] as? String) ?: (custom["admin_exit_pin"] as? String))
            ?.trim()?.takeIf { it.isNotBlank() } ?: "0000"

        val dialogView = layoutInflater.inflate(R.layout.dialog_admin_pin, null)
        val tvPinDisplay = dialogView.findViewById<TextView>(R.id.tvPinDisplay)
        val tvPinError = dialogView.findViewById<TextView>(R.id.tvPinError)
        val btnPinCancel = dialogView.findViewById<Button>(R.id.btnPinCancel)

        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(true)
            .create()

        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        var enteredPin = ""

        fun updatePinDisplay() {
            tvPinError.visibility = View.GONE
            if (enteredPin.isEmpty()) {
                tvPinDisplay.text = "— — — —"
            } else {
                tvPinDisplay.text = "• ".repeat(enteredPin.length).trim()
            }
        }

        fun checkPin() {
            if (enteredPin == expectedPin) {
                dialog.dismiss()
                if (onSuccessAction != null) {
                    onSuccessAction.invoke()
                } else {
                    showAdminActionsDialog()
                }
            } else {
                tvPinError.visibility = View.VISIBLE
                tvPinError.text = "PIN incorreto! Verifique a senha no painel."
                enteredPin = ""
                tvPinDisplay.text = "— — — —"
            }
        }

        fun appendDigit(digit: String) {
            if (enteredPin.length < 6) {
                enteredPin += digit
                updatePinDisplay()
                if (enteredPin.length >= expectedPin.length) {
                    checkPin()
                }
            }
        }

        // Teclado virtual navegável pelo D-Pad do controle da TV
        dialogView.findViewById<Button>(R.id.btnKey0).setOnClickListener { appendDigit("0") }
        dialogView.findViewById<Button>(R.id.btnKey1).setOnClickListener { appendDigit("1") }
        dialogView.findViewById<Button>(R.id.btnKey2).setOnClickListener { appendDigit("2") }
        dialogView.findViewById<Button>(R.id.btnKey3).setOnClickListener { appendDigit("3") }
        dialogView.findViewById<Button>(R.id.btnKey4).setOnClickListener { appendDigit("4") }
        dialogView.findViewById<Button>(R.id.btnKey5).setOnClickListener { appendDigit("5") }
        dialogView.findViewById<Button>(R.id.btnKey6).setOnClickListener { appendDigit("6") }
        dialogView.findViewById<Button>(R.id.btnKey7).setOnClickListener { appendDigit("7") }
        dialogView.findViewById<Button>(R.id.btnKey8).setOnClickListener { appendDigit("8") }
        dialogView.findViewById<Button>(R.id.btnKey9).setOnClickListener { appendDigit("9") }

        dialogView.findViewById<Button>(R.id.btnKeyClear).setOnClickListener {
            enteredPin = ""
            updatePinDisplay()
        }

        dialogView.findViewById<Button>(R.id.btnKeyConfirm).setOnClickListener {
            checkPin()
        }

        btnPinCancel.setOnClickListener {
            dialog.dismiss()
            if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
                exoPlayer?.play()
            }
        }

        dialog.setOnDismissListener {
            if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
                exoPlayer?.play()
            }
        }

        // Intercepta teclas numéricas do controle físico
        dialog.setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN) {
                when (keyCode) {
                    KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0 -> { appendDigit("0"); true }
                    KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1 -> { appendDigit("1"); true }
                    KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2 -> { appendDigit("2"); true }
                    KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3 -> { appendDigit("3"); true }
                    KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4 -> { appendDigit("4"); true }
                    KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5 -> { appendDigit("5"); true }
                    KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6 -> { appendDigit("6"); true }
                    KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7 -> { appendDigit("7"); true }
                    KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8 -> { appendDigit("8"); true }
                    KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> { appendDigit("9"); true }
                    KeyEvent.KEYCODE_DEL -> {
                        if (enteredPin.isNotEmpty()) {
                            enteredPin = enteredPin.dropLast(1)
                            updatePinDisplay()
                        }
                        true
                    }
                    else -> false
                }
            } else {
                false
            }
        }

        dialog.show()
    }

    /**
     * Menu de Ações de Administrador (Sair, Launcher Padrão, Ajustes)
     */
    private fun showAdminActionsDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_admin_actions, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(true)
            .create()

        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        dialogView.findViewById<Button>(R.id.btnActionExitLauncher).setOnClickListener {
            dialog.dismiss()
            exitToStockLauncher()
        }

        dialogView.findViewById<Button>(R.id.btnActionSetDefault).setOnClickListener {
            dialog.dismiss()
            requestSetDefaultLauncher()
        }

        dialogView.findViewById<Button>(R.id.btnActionSystemSettings).setOnClickListener {
            dialog.dismiss()
            openAndroidSystemSettings()
        }

        dialogView.findViewById<Button>(R.id.btnActionUpdateApp).setOnClickListener {
            dialog.dismiss()
            downloadAndInstallApkUpdate()
        }

        dialogView.findViewById<Button>(R.id.btnActionOpenSettings).setOnClickListener {
            dialog.dismiss()
            showPairingScreen()
        }

        dialogView.findViewById<Button>(R.id.btnActionCleanApps)?.setOnClickListener {
            dialog.dismiss()
            Toast.makeText(this, "Iniciando limpeza de cache e dados dos apps...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch(Dispatchers.IO) {
                val appPackages = currentConfig?.shortcuts?.map { it.packageName } ?: emptyList()
                AppCleanupManager.clearGuestAppData(this@MainActivity, appPackages)
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "🧹 Dados e cache de apps limpos com sucesso!", Toast.LENGTH_LONG).show()
                    if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
                        exoPlayer?.play()
                    }
                }
            }
        }

        dialogView.findViewById<Button>(R.id.btnActionDismiss).setOnClickListener {
            dialog.dismiss()
            if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
                exoPlayer?.play()
            }
        }

        dialog.setOnDismissListener {
            if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
                exoPlayer?.play()
            }
        }

        dialog.show()
    }

    /**
     * Baixa a última versão do APK diretamente do servidor HTTP e inicia o instalador do Android TV
     */
    private fun downloadAndInstallApkUpdate() {
        exoPlayer?.pause()
        val serverUrl = SmartTVApp.instance.getServerUrl().removeSuffix("/")
        val downloadUrl = "$serverUrl/smarttv-launcher.apk"

        val progressDialog = android.app.ProgressDialog(this).apply {
            setTitle("📥 Atualização Fasano SMARTTV")
            setMessage("Conectando ao servidor...")
            setProgressStyle(android.app.ProgressDialog.STYLE_HORIZONTAL)
            isIndeterminate = false
            max = 100
            progress = 0
            setCancelable(false)
            show()
        }

        lifecycleScope.launch(Dispatchers.IO) {
            var connection: java.net.HttpURLConnection? = null
            try {
                var targetUrl = java.net.URL(downloadUrl)
                connection = (targetUrl.openConnection() as java.net.HttpURLConnection).apply {
                    connectTimeout = 10000
                    readTimeout = 30000
                    requestMethod = "GET"
                    connect()
                }

                if (connection.responseCode != java.net.HttpURLConnection.HTTP_OK) {
                    connection.disconnect()
                    targetUrl = java.net.URL("$serverUrl/fasano-smarttv-latest.apk")
                    connection = (targetUrl.openConnection() as java.net.HttpURLConnection).apply {
                        connectTimeout = 10000
                        readTimeout = 30000
                        requestMethod = "GET"
                        connect()
                    }
                }

                val fileLength = connection.contentLength
                val outputFile = java.io.File(externalCacheDir ?: cacheDir, "smarttv-launcher.apk")
                if (outputFile.exists()) outputFile.delete()

                val input = java.io.BufferedInputStream(connection.inputStream)
                val output = java.io.FileOutputStream(outputFile)

                val data = ByteArray(8192)
                var total: Long = 0
                var count: Int

                withContext(Dispatchers.Main) {
                    progressDialog.setMessage("Baixando atualização da Launcher (v${BuildConfig.VERSION_NAME})...")
                }

                while (input.read(data).also { count = it } != -1) {
                    total += count
                    output.write(data, 0, count)
                    if (fileLength > 0) {
                        val progressPct = ((total * 100) / fileLength).toInt()
                        withContext(Dispatchers.Main) {
                            progressDialog.progress = progressPct
                        }
                    }
                }

                output.flush()
                output.close()
                input.close()

                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    installApk(outputFile)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao baixar atualização OTA", e)
                withContext(Dispatchers.Main) {
                    progressDialog.dismiss()
                    Toast.makeText(this@MainActivity, "Falha no download: ${e.message}", Toast.LENGTH_LONG).show()
                    if (currentConfig?.playlist?.items?.isNotEmpty() == true) {
                        exoPlayer?.play()
                    }
                }
            } finally {
                connection?.disconnect()
            }
        }
    }

    private fun installApk(file: java.io.File) {
        try {
            val contentUri = androidx.core.content.FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                file
            )
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao iniciar instalação do APK", e)
            Toast.makeText(this, "Erro ao abrir instalador: ${e.message}", Toast.LENGTH_LONG).show()
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

        btnSetDefaultLauncher.setOnClickListener { requestSetDefaultLauncher() }
        btnSetDefaultLauncherTop.setOnClickListener { requestSetDefaultLauncher() }
        btnSetDefaultLauncherBottom.setOnClickListener { requestSetDefaultLauncher() }
        btnSettingsExitApp.setOnClickListener { exitToStockLauncher() }

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
            statusText.text = "Ativo na barra (Pressione OK para desativar)"
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
                        appVersion = BuildConfig.VERSION_NAME
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
     * Preenche a lista da direita com os perfis de TV selecionáveis via controle remoto
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
        }
    }

    /**
     * Vincula este dispositivo físico diretamente ao quarto selecionado pelo controle remoto
     */
    private fun bindThisTvToRoom(tv: TVListItem) {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        tvPairingStatus.text = "Vinculando a ${tv.name}..."

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                api.bindDevice(
                    BindDeviceRequest(
                        tvId = tv.id,
                        deviceId = deviceId,
                        ipAddress = null,
                        appVersion = BuildConfig.VERSION_NAME
                    )
                )

                withContext(Dispatchers.Main) {
                    SmartTVApp.instance.setPaired(true)
                    Toast.makeText(this@MainActivity, "TV Vinculada com sucesso a ${tv.name}!", Toast.LENGTH_SHORT).show()
                    showLauncherScreen()
                    loadConfigAndSetup()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao vincular TV ao quarto", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Erro ao vincular: ${e.message}", Toast.LENGTH_SHORT).show()
                    tvPairingStatus.text = "Falha ao vincular. Tente novamente."
                }
            }
        }
    }

    private fun startPairStatusPolling() {
        if (isPollingPairStatus) return
        isPollingPairStatus = true

        pairPollRunnable = object : Runnable {
            override fun run() {
                if (!isPollingPairStatus) return

                val deviceId = SmartTVApp.instance.getTvDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val response = api.ping(
                            PingRequest(
                                deviceId = deviceId,
                                ipAddress = null,
                                appVersion = BuildConfig.VERSION_NAME
                            )
                        )
                        val isPaired = (response["is_paired"] as? Boolean) ?: false
                        if (isPaired) {
                            withContext(Dispatchers.Main) {
                                stopPairPolling()
                                SmartTVApp.instance.setPaired(true)
                                showLauncherScreen()
                                loadConfigAndSetup()
                            }
                            return@launch
                        }
                    } catch (ignored: Exception) {}

                    withContext(Dispatchers.Main) {
                        if (isPollingPairStatus) {
                            pairPollRunnable?.let { handler.postDelayed(it, 3000) }
                        }
                    }
                }
            }
        }
        handler.postDelayed(pairPollRunnable!!, 3000)
    }

    private fun stopPairPolling() {
        isPollingPairStatus = false
        pairPollRunnable?.let { handler.removeCallbacks(it) }
        pairPollRunnable = null
    }

    /**
     * Carrega a configuração completa desta TV do servidor
     */
    private fun loadConfigAndSetup() {
        val deviceId = SmartTVApp.instance.getTvDeviceId()
        val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val config = api.getTVConfig(deviceId)
                withContext(Dispatchers.Main) {
                    applyConfig(config)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao carregar configuração da TV", e)
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

        // 1. Atualiza textos e Wi-Fi
        val custom = config.customSettings ?: emptyMap()
        val guestName = (custom["guest_name"] as? String)?.trim() ?: ""
        val uhNumber = (custom["uh_number"] as? String)?.trim() ?: ""

        val defaultWelcome = when {
            guestName.isNotEmpty() -> "Sr(a). $guestName, Bem-vindo(a) ao Fasano"
            uhNumber.isNotEmpty() -> "Bem-vindo(a) à UH $uhNumber • Fasano"
            else -> "Bem-vindo ao ${config.name}"
        }

        tvTitle.text = (custom["welcome_title"] as? String)?.takeIf { it.isNotBlank() } ?: defaultWelcome
        tvSubtitle.text = (custom["welcome_subtitle"] as? String)?.takeIf { it.isNotBlank() } ?: "Aproveite a sua estadia com conforto e entretenimento."

        // Tamanho Dinâmico da Mensagem na Tela
        val titleFontSize = when (val s = custom["title_font_size"]) {
            is Number -> s.toInt().coerceIn(16, 56)
            is String -> (s.toIntOrNull() ?: 32).coerceIn(16, 56)
            else -> 32
        }
        tvTitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, titleFontSize.toFloat())
        val subtitleFontSize = (titleFontSize * 0.54f).coerceAtLeast(12f)
        tvSubtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, subtitleFontSize)

        // Relógio Digital no Topo com Tamanho Dinâmico e Modelo (Apenas Horário vs Horário com Data)
        val showClock = (custom["show_clock"] as? Boolean) != false
        cardClock.visibility = if (showClock) View.VISIBLE else View.GONE

        val clockFormat = (custom["clock_format"] as? String)?.trim() ?: "time_only"
        tvDate.visibility = if (showClock && clockFormat == "time_and_date") View.VISIBLE else View.GONE

        val clockFontSize = when (val s = custom["clock_font_size"]) {
            is Number -> s.toInt().coerceIn(14, 48)
            is String -> (s.toIntOrNull() ?: 22).coerceIn(14, 48)
            else -> 22
        }
        tvTime.setTextSize(TypedValue.COMPLEX_UNIT_SP, clockFontSize.toFloat())
        tvDate.setTextSize(TypedValue.COMPLEX_UNIT_SP, (clockFontSize * 0.55f).coerceAtLeast(11f))
        
        try {
            val clockIconSizePx = dpToPx((clockFontSize * 0.75f).toInt().coerceAtLeast(14))
            val clockLp = ivClockIcon.layoutParams
            clockLp.width = clockIconSizePx
            clockLp.height = clockIconSizePx
            ivClockIcon.layoutParams = clockLp
        } catch (e: Exception) {
            // Layout params fallback
        }

        // Widget de Previsão do Tempo
        val showWeather = (custom["show_weather"] as? Boolean) ?: true
        if (showWeather) {
            val weatherCity = (custom["weather_city"] as? String)?.trim() ?: "Salvador"
            val weatherTemp = (custom["weather_temp"] as? String)?.trim() ?: "28°C"
            val weatherCond = (custom["weather_condition"] as? String)?.trim()?.lowercase() ?: "sunny"

            // Tamanho Dinâmico da Previsão do Tempo
            val weatherFontSize = when (val s = custom["weather_font_size"]) {
                is Number -> s.toInt().coerceIn(14, 42)
                is String -> (s.toIntOrNull() ?: 20).coerceIn(14, 42)
                else -> 20
            }
            tvWeatherTemp.setTextSize(TypedValue.COMPLEX_UNIT_SP, (weatherFontSize * 0.82f).coerceAtLeast(14f))
            tvWeatherCity.setTextSize(TypedValue.COMPLEX_UNIT_SP, (weatherFontSize * 0.55f).coerceAtLeast(10f))

            tvWeatherTemp.text = weatherTemp
            tvWeatherCity.text = weatherCity

            val weatherRes = when (weatherCond) {
                "sunny" -> R.drawable.ic_weather_sunny
                "partly_cloudy" -> R.drawable.ic_weather_partly_cloudy
                "cloudy" -> R.drawable.ic_weather_cloudy
                "rain" -> R.drawable.ic_weather_rain
                "clear_night" -> R.drawable.ic_weather_night
                else -> R.drawable.ic_weather_sunny
            }
            ivWeatherIcon.setImageResource(weatherRes)
            cardWeather.visibility = View.VISIBLE
        } else {
            cardWeather.visibility = View.GONE
        }

        // Layout de Cabeçalho (Posições / Alinhamento)
        val headerLayout = (custom["header_layout"] as? String)?.trim() ?: "welcome_left_widgets_right"
        if (layoutHeader is LinearLayout) {
            val headerLinear = layoutHeader as LinearLayout
            headerLinear.removeAllViews()
            if (headerLayout == "widgets_left_welcome_right") {
                headerLinear.addView(containerHeaderWidgets)
                headerLinear.addView(containerWelcome)
                (containerWelcome as? LinearLayout)?.gravity = Gravity.END
                tvTitle.gravity = Gravity.END
                tvSubtitle.gravity = Gravity.END
            } else {
                headerLinear.addView(containerWelcome)
                headerLinear.addView(containerHeaderWidgets)
                (containerWelcome as? LinearLayout)?.gravity = Gravity.START
                tvTitle.gravity = Gravity.START
                tvSubtitle.gravity = Gravity.START
            }
        }

        val wifiSsid = (custom["wifi_ssid"] as? String)?.trim() ?: ""
        val wifiPass = (custom["wifi_password"] as? String)?.trim() ?: ""

        if (wifiSsid.isNotEmpty()) {
            tvWifiSsid.text = wifiSsid
            tvWifiSsid.visibility = View.VISIBLE
        } else {
            tvWifiSsid.visibility = View.GONE
        }

        if (wifiPass.isNotEmpty()) {
            tvWifiPass.text = "Senha: $wifiPass"
            tvWifiPass.visibility = View.VISIBLE
        } else {
            tvWifiPass.visibility = View.GONE
        }

        val hasQr = !((custom["wifi_qrcode_url"] as? String)?.trim().isNullOrEmpty())
        if (wifiSsid.isEmpty() && wifiPass.isEmpty()) {
            containerWifiText.visibility = View.GONE
            (ivWifiQrCode.layoutParams as? ViewGroup.MarginLayoutParams)?.let {
                it.marginEnd = 0
                ivWifiQrCode.layoutParams = it
            }
        } else {
            containerWifiText.visibility = View.VISIBLE
            (ivWifiQrCode.layoutParams as? ViewGroup.MarginLayoutParams)?.let {
                it.marginEnd = dpToPx(10)
                ivWifiQrCode.layoutParams = it
            }
        }

        // 2. Carrega imagem do QR Code do Wi-Fi com tamanho dinâmico
        loadWifiQrCode(custom)

        val showWifi = (custom["show_wifi"] as? Boolean) ?: true
        if (!showWifi || (wifiSsid.isEmpty() && wifiPass.isEmpty() && !hasQr)) {
            cardWifi.visibility = View.GONE
        } else {
            cardWifi.visibility = View.VISIBLE
        }

        // 3. Aplica o Modelo de Layout Dinâmico
        applyLayout(config)

        // 4. Configura Playlist de Vídeos no ExoPlayer
        setupPlaylist(config)

        // 5. Renderiza Botões de Atalhos na Dock e Sidebar
        setupShortcuts(config)

        // 6. Agenda auto-hide da dock
        resetAutoHideTimer()

        // 7. Limpeza Segura de Dados e Cache de Apps Pós-Checkout
        val isCheckoutCleanupPending = custom["checkout_cleanup_pending"] as? Boolean ?: false
        if (isCheckoutCleanupPending) {
            Log.i(TAG, "Gatilho de Checkout detectado! Iniciando limpeza de dados e cache de apps...")
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val appPackages = config.shortcuts.map { it.packageName }
                    AppCleanupManager.clearGuestAppData(this@MainActivity, appPackages)
                    pendingCleanupReport = true
                    Log.i(TAG, "Limpeza de dados pós-checkout finalizada com sucesso.")
                } catch (e: Exception) {
                    Log.e(TAG, "Erro durante limpeza de dados pós-checkout", e)
                }
            }
        }
    }

    /**
     * Motor de Layout Dinâmico: Alterna entre os modelos visuais da tela
     */
    private fun applyLayout(config: TVConfigResponse) {
        val layoutCode = config.layout?.code ?: "hotel_dock"
        val layoutConfig = config.layout?.config ?: emptyMap()
        val custom = config.customSettings ?: emptyMap()
        val wifiSsid = (custom["wifi_ssid"] as? String)?.trim() ?: ""
        val wifiPass = (custom["wifi_password"] as? String)?.trim() ?: ""
        val hasQr = !((custom["wifi_qrcode_url"] as? String)?.trim().isNullOrEmpty())
        val showWifi = (custom["show_wifi"] as? Boolean) ?: true

        // Reseta visibilidade dos componentes
        layoutSidebar.visibility = View.GONE
        layoutTicker.visibility = View.GONE
        layoutHeader.visibility = View.VISIBLE
        layoutDock.visibility = View.VISIBLE

        val playerParams = playerView.layoutParams as FrameLayout.LayoutParams
        playerParams.width = FrameLayout.LayoutParams.MATCH_PARENT
        playerParams.marginEnd = 0
        playerView.layoutParams = playerParams

        when (layoutCode) {
            "split_sidebar" -> {
                // Layout 70% Vídeo / 30% Barra Lateral
                layoutDock.visibility = View.GONE
                layoutHeader.visibility = View.GONE
                layoutSidebar.visibility = View.VISIBLE

                playerParams.marginEnd = dpToPx(380)
                playerView.layoutParams = playerParams

                tvSidebarTitle.text = tvTitle.text
                tvSidebarSubtitle.text = tvSubtitle.text
                tvSidebarTime.text = tvTime.text

                if (wifiSsid.isNotEmpty()) {
                    tvSidebarWifiSsid.text = wifiSsid
                    tvSidebarWifiSsid.visibility = View.VISIBLE
                } else {
                    tvSidebarWifiSsid.visibility = View.GONE
                }

                if (wifiPass.isNotEmpty()) {
                    tvSidebarWifiPass.text = "Senha: $wifiPass"
                    tvSidebarWifiPass.visibility = View.VISIBLE
                } else {
                    tvSidebarWifiPass.visibility = View.GONE
                }

                if (wifiSsid.isEmpty() && wifiPass.isEmpty()) {
                    containerSidebarWifiText.visibility = View.GONE
                    (ivSidebarQrCode.layoutParams as? ViewGroup.MarginLayoutParams)?.let {
                        it.marginEnd = 0
                        ivSidebarQrCode.layoutParams = it
                    }
                } else {
                    containerSidebarWifiText.visibility = View.VISIBLE
                    (ivSidebarQrCode.layoutParams as? ViewGroup.MarginLayoutParams)?.let {
                        it.marginEnd = dpToPx(12)
                        ivSidebarQrCode.layoutParams = it
                    }
                }

                if (!showWifi || (wifiSsid.isEmpty() && wifiPass.isEmpty() && !hasQr)) {
                    sidebarCardWifi.visibility = View.GONE
                } else {
                    sidebarCardWifi.visibility = View.VISIBLE
                }

                populateSidebarShortcuts(config)
            }
            "clean_minimal" -> {
                // Vitrine 100% Tela Cheia sem distrações
                layoutHeader.visibility = View.GONE
                layoutSidebar.visibility = View.GONE
                layoutTicker.visibility = View.GONE
                layoutDock.visibility = View.VISIBLE
            }
            "digital_mural" -> {
                // Faixa de avisos ticker no rodapé
                layoutTicker.visibility = View.VISIBLE
                val tickerMsg = (layoutConfig["ticker_text"] as? String)
                    ?: "Bem-vindo! Conecte-se ao Wi-Fi para navegar em alta velocidade. Café da manhã das 06:00 às 10:00."
                tvTickerText.text = tickerMsg
                tvTickerText.isSelected = true

                val dockParams = layoutDock.layoutParams as FrameLayout.LayoutParams
                dockParams.bottomMargin = dpToPx(46)
                layoutDock.layoutParams = dockParams
            }
            else -> {
                // hotel_dock (Padrão)
                val dockParams = layoutDock.layoutParams as FrameLayout.LayoutParams
                dockParams.bottomMargin = 0
                layoutDock.layoutParams = dockParams
            }
        }
    }

    /**
     * Carrega imagem do QR Code de Wi-Fi se configurada no painel com tamanho ajustável
     */
    private fun loadWifiQrCode(custom: Map<String, Any>) {
        val qrUrl = custom["wifi_qrcode_url"] as? String
        if (!qrUrl.isNullOrBlank()) {
            val serverUrl = SmartTVApp.instance.getServerUrl().removeSuffix("/")
            val fullUrl = if (qrUrl.startsWith("http")) qrUrl else "$serverUrl$qrUrl"

            // Tamanho customizado do QR Code (default 120dp, min 48dp, max 260dp)
            val qrSizeDp = when (val s = custom["wifi_qr_size"]) {
                is Number -> s.toInt().coerceIn(48, 260)
                is String -> (s.toIntOrNull() ?: 120).coerceIn(48, 260)
                else -> 120
            }
            val qrSizePx = dpToPx(qrSizeDp)

            ivWifiQrCode.visibility = View.VISIBLE
            val lp = ivWifiQrCode.layoutParams
            lp.width = qrSizePx
            lp.height = qrSizePx
            ivWifiQrCode.layoutParams = lp
            ivWifiQrCode.load(fullUrl)

            ivSidebarQrCode.visibility = View.VISIBLE
            val sideLp = ivSidebarQrCode.layoutParams
            sideLp.width = qrSizePx
            sideLp.height = qrSizePx
            ivSidebarQrCode.layoutParams = sideLp
            ivSidebarQrCode.load(fullUrl)
        } else {
            ivWifiQrCode.visibility = View.GONE
            ivSidebarQrCode.visibility = View.GONE
        }
    }

    private fun setupPlaylist(config: TVConfigResponse) {
        val playlist = config.playlist
        if (playlist == null || playlist.items.isEmpty()) {
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
            currentLoadedMediaUrls = emptyList()
            playerView.visibility = View.GONE
            return
        }

        playerView.visibility = View.VISIBLE
        val serverUrl = SmartTVApp.instance.getServerUrl().removeSuffix("/")
        val newUrls = playlist.items.map { item ->
            if (item.streamUrl.startsWith("http")) item.streamUrl else "$serverUrl${item.streamUrl}"
        }

        // PREVENÇÃO DO LOOP DE 3 SEGUNDOS:
        // Se a lista de vídeos for a mesma que já está em reprodução, NÃO limpa nem reseta o player!
        if (newUrls == currentLoadedMediaUrls && exoPlayer?.playbackState != Player.STATE_IDLE) {
            exoPlayer?.repeatMode = if (playlist.loopPlayback) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
            return
        }

        currentLoadedMediaUrls = newUrls
        exoPlayer?.clearMediaItems()
        for (fullUrl in newUrls) {
            val mediaItem = MediaItem.fromUri(fullUrl)
            exoPlayer?.addMediaItem(mediaItem)
        }
        exoPlayer?.repeatMode = if (playlist.loopPlayback) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
        exoPlayer?.prepare()
        exoPlayer?.play()
    }

    private fun setupShortcuts(config: TVConfigResponse) {
        // Preserva o índice do botão atualmente focado para não resetar o foco para o primeiro botão!
        var previousFocusedIndex = -1
        for (i in 0 until containerShortcuts.childCount) {
            if (containerShortcuts.getChildAt(i).isFocused) {
                previousFocusedIndex = i
                break
            }
        }

        containerShortcuts.removeAllViews()

        // Tamanho Dinâmico dos Ícones e Botões da Dock
        val customMap = config.customSettings ?: emptyMap()
        val dockIconSize = when (val s = customMap["dock_icon_size"]) {
            is Number -> s.toInt().coerceIn(44, 115)
            is String -> (s.toIntOrNull() ?: 72).coerceIn(44, 115)
            else -> 72
        }
        val btnWidthPx = dpToPx((dockIconSize * 1.65).toInt())
        val btnHeightPx = dpToPx((dockIconSize * 1.15).toInt())
        
        // Tamanho interno customizado da imagem / ícone
        val dockInnerSize = when (val s = customMap["dock_inner_icon_size"]) {
            is Number -> s.toInt().coerceIn(20, 80)
            is String -> (s.toIntOrNull() ?: 36).coerceIn(20, 80)
            else -> (dockIconSize * 0.44).toInt().coerceIn(20, 80)
        }
        val iconSizePx = dpToPx(dockInnerSize)

        // Tamanho do texto customizado ou proporcional
        val dockTextSize = when (val s = customMap["dock_text_size"]) {
            is Number -> s.toInt().coerceIn(10, 22).toFloat()
            is String -> (s.toIntOrNull()?.toFloat() ?: (dockIconSize * 0.175f)).coerceIn(10f, 22f)
            else -> (dockIconSize * 0.175f).coerceIn(10f, 20f)
        }

        // 1. Botão HDMI SKY
        if (config.hdmi.enabled && config.hdmi.inputId != "NONE" && config.hdmi.inputId.isNotBlank()) {
            val btnSky = layoutInflater.inflate(R.layout.item_shortcut_button, containerShortcuts, false)
            val textSky = btnSky.findViewById<TextView>(R.id.tvShortcutName)
            val iconSky = btnSky.findViewById<ImageView>(R.id.ivShortcutIcon)

            val lp = LinearLayout.LayoutParams(btnWidthPx, btnHeightPx)
            lp.marginEnd = dpToPx(14)
            btnSky.layoutParams = lp

            val iconLp = iconSky.layoutParams
            iconLp.width = iconSizePx
            iconLp.height = iconSizePx
            iconSky.layoutParams = iconLp

            textSky.setTextSize(TypedValue.COMPLEX_UNIT_SP, dockTextSize)
            textSky.text = config.hdmi.label

            val hdmiShortcut = config.shortcuts.firstOrNull { it.isHdmi }
            val hdmiBgColor = hdmiShortcut?.backgroundColor ?: config.hdmi.backgroundColor
            val hdmiIconUrl = hdmiShortcut?.iconUrl ?: config.hdmi.iconUrl

            if (!hdmiBgColor.isNullOrBlank()) {
                applyShortcutBackground(btnSky, hdmiBgColor)
            } else {
                btnSky.setBackgroundResource(R.drawable.bg_shortcut_sky)
            }

            if (!hdmiIconUrl.isNullOrBlank()) {
                val fullUrl = if (hdmiIconUrl.startsWith("http")) hdmiIconUrl 
                              else "${SmartTVApp.instance.getServerUrl()}${hdmiIconUrl}"
                iconSky.load(fullUrl) {
                    crossfade(true)
                    error(R.drawable.ic_hdmi_tv)
                    placeholder(R.drawable.ic_hdmi_tv)
                }
            } else {
                iconSky.setImageResource(R.drawable.ic_hdmi_tv)
            }

            btnSky.setOnClickListener {
                exoPlayer?.pause()
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

            val lp = LinearLayout.LayoutParams(btnWidthPx, btnHeightPx)
            lp.marginEnd = dpToPx(14)
            btnApp.layoutParams = lp

            val iconLp = iconApp.layoutParams
            iconLp.width = iconSizePx
            iconLp.height = iconSizePx
            iconApp.layoutParams = iconLp

            textApp.setTextSize(TypedValue.COMPLEX_UNIT_SP, dockTextSize)
            textApp.text = sc.name
            applyShortcutBackground(btnApp, sc.backgroundColor)

            if (!sc.iconUrl.isNullOrBlank()) {
                val fullUrl = if (sc.iconUrl.startsWith("http")) sc.iconUrl 
                              else "${SmartTVApp.instance.getServerUrl()}${sc.iconUrl}"
                iconApp.load(fullUrl) {
                    crossfade(true)
                    error(R.drawable.ic_hdmi_tv)
                    placeholder(R.drawable.ic_hdmi_tv)
                }
            } else {
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
            }

            btnApp.setOnClickListener {
                exoPlayer?.pause()
                AppLauncherManager.launchApp(this, sc.packageName)
            }
            btnApp.isFocusable = true
            containerShortcuts.addView(btnApp)
        }

        if (containerShortcuts.childCount > 0) {
            val targetIndex = if (previousFocusedIndex in 0 until containerShortcuts.childCount) previousFocusedIndex else 0
            containerShortcuts.getChildAt(targetIndex).requestFocus()
        }
    }

    private fun populateSidebarShortcuts(config: TVConfigResponse) {
        containerSidebarShortcuts.removeAllViews()

        // HDMI na Sidebar
        if (config.hdmi.enabled && config.hdmi.inputId != "NONE" && config.hdmi.inputId.isNotBlank()) {
            val btnSky = layoutInflater.inflate(R.layout.item_shortcut_button, containerSidebarShortcuts, false)
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(72))
            params.bottomMargin = dpToPx(10)
            btnSky.layoutParams = params

            val textSky = btnSky.findViewById<TextView>(R.id.tvShortcutName)
            val iconSky = btnSky.findViewById<ImageView>(R.id.ivShortcutIcon)

            textSky.text = config.hdmi.label

            val hdmiShortcut = config.shortcuts.firstOrNull { it.isHdmi }
            val hdmiBgColor = hdmiShortcut?.backgroundColor ?: config.hdmi.backgroundColor
            val hdmiIconUrl = hdmiShortcut?.iconUrl ?: config.hdmi.iconUrl

            if (!hdmiBgColor.isNullOrBlank()) {
                applyShortcutBackground(btnSky, hdmiBgColor)
            } else {
                btnSky.setBackgroundResource(R.drawable.bg_shortcut_sky)
            }

            if (!hdmiIconUrl.isNullOrBlank()) {
                val fullUrl = if (hdmiIconUrl.startsWith("http")) hdmiIconUrl 
                              else "${SmartTVApp.instance.getServerUrl()}${hdmiIconUrl}"
                iconSky.load(fullUrl) {
                    crossfade(true)
                    error(R.drawable.ic_hdmi_tv)
                    placeholder(R.drawable.ic_hdmi_tv)
                }
            } else {
                iconSky.setImageResource(R.drawable.ic_hdmi_tv)
            }

            btnSky.setOnClickListener {
                exoPlayer?.pause()
                HdmiInputManager.switchToHdmiInput(this, config.hdmi.inputId)
            }
            btnSky.isFocusable = true
            containerSidebarShortcuts.addView(btnSky)
        }

        // Apps na Sidebar
        for (sc in config.shortcuts) {
            if (sc.isHdmi) continue

            val btnApp = layoutInflater.inflate(R.layout.item_shortcut_button, containerSidebarShortcuts, false)
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(72))
            params.bottomMargin = dpToPx(10)
            btnApp.layoutParams = params

            val textApp = btnApp.findViewById<TextView>(R.id.tvShortcutName)
            val iconApp = btnApp.findViewById<ImageView>(R.id.ivShortcutIcon)

            textApp.text = sc.name
            applyShortcutBackground(btnApp, sc.backgroundColor)

            if (!sc.iconUrl.isNullOrBlank()) {
                val fullUrl = if (sc.iconUrl.startsWith("http")) sc.iconUrl 
                              else "${SmartTVApp.instance.getServerUrl()}${sc.iconUrl}"
                iconApp.load(fullUrl) {
                    crossfade(true)
                    error(R.drawable.ic_hdmi_tv)
                    placeholder(R.drawable.ic_hdmi_tv)
                }
            } else {
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
            }

            btnApp.setOnClickListener {
                exoPlayer?.pause()
                AppLauncherManager.launchApp(this, sc.packageName)
            }
            btnApp.isFocusable = true
            containerSidebarShortcuts.addView(btnApp)
        }
    }

    private fun resetAutoHideTimer() {
        val config = currentConfig
        val layoutCode = config?.layout?.code ?: "hotel_dock"
        if (layoutCode == "split_sidebar") return // Sidebar permanece visível

        val custom = config?.customSettings ?: emptyMap()
        val autoHide = custom["auto_hide_dock"] as? Boolean ?: false

        // Se autoHide for false (padrão), o menu de canais e apps fica FIXO E SEMPRE VISÍVEL na tela!
        if (!autoHide) {
            layoutDock.visibility = View.VISIBLE
            isDockVisible = true
            autoHideRunnable?.let { handler.removeCallbacks(it) }
            return
        }

        val timeoutSeconds = when (val s = custom["auto_hide_seconds"]) {
            is Number -> s.toLong() * 1000L
            else -> 15000L
        }

        if (!isDockVisible) {
            layoutDock.visibility = View.VISIBLE
            isDockVisible = true
        }
        autoHideRunnable?.let { handler.removeCallbacks(it) }
        autoHideRunnable = Runnable {
            layoutDock.visibility = View.INVISIBLE
            isDockVisible = false
        }
        handler.postDelayed(autoHideRunnable!!, timeoutSeconds)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // Se a dock estava oculta, qualquer clique no controle remoto a restaura imediatamente
        if (!isDockVisible) {
            layoutDock.visibility = View.VISIBLE
            isDockVisible = true
        }
        resetAutoHideTimer()
        return super.dispatchKeyEvent(event)
    }

    override fun onBackPressed() {
        if (layoutPairing.visibility == View.VISIBLE) {
            if (SmartTVApp.instance.isPaired()) {
                showLauncherScreen()
            }
            return
        }
        if (SmartTVApp.instance.isPaired()) {
            promptAdminPinDialog()
        } else {
            togglePairingOverlay()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Teclas MENU, SETTINGS, BACK / RETURN ou ESCAPE abrem o menu secreto de PIN do administrador
        if (keyCode == KeyEvent.KEYCODE_MENU || 
            keyCode == KeyEvent.KEYCODE_SETTINGS || 
            keyCode == KeyEvent.KEYCODE_BACK || 
            keyCode == KeyEvent.KEYCODE_ESCAPE) {
            if (layoutPairing.visibility == View.VISIBLE) {
                if (SmartTVApp.instance.isPaired()) {
                    showLauncherScreen()
                }
                return true
            }
            if (SmartTVApp.instance.isPaired()) {
                promptAdminPinDialog()
            } else {
                togglePairingOverlay()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        exoPlayer?.pause()
    }

    override fun onStop() {
        super.onStop()
        exoPlayer?.pause()
    }

    override fun onResume() {
        super.onResume()
        if (layoutPairing.visibility != View.VISIBLE && currentConfig?.playlist?.items?.isNotEmpty() == true) {
            exoPlayer?.play()
        }
    }

    private fun startClock() {
        val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
        val dateFormat = SimpleDateFormat("EEEE, d 'de' MMM", Locale("pt", "BR"))
        handler.post(object : Runnable {
            override fun run() {
                val now = Date()
                val nowStr = timeFormat.format(now)
                tvTime.text = nowStr
                tvSidebarTime.text = nowStr

                val rawDate = dateFormat.format(now)
                val formattedDate = rawDate.split(" ").joinToString(" ") { word ->
                    val wLower = word.lowercase(Locale("pt", "BR"))
                    if (wLower in listOf("de", "do", "da", "e")) {
                        wLower
                    } else {
                        word.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale("pt", "BR")) else it.toString() }
                    }
                }
                tvDate.text = formattedDate

                handler.postDelayed(this, 30000)
            }
        })
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    private fun parseHexOrRgbaColor(colorStr: String?): Int? {
        if (colorStr.isNullOrBlank()) return null
        val c = colorStr.trim()
        if (c.equals("transparent", ignoreCase = true)) return Color.TRANSPARENT
        try {
            if (c.startsWith("#")) {
                return Color.parseColor(c)
            }
            if (c.startsWith("rgba", ignoreCase = true)) {
                val clean = c.substringAfter("(").substringBefore(")")
                val parts = clean.split(",")
                if (parts.size >= 4) {
                    val r = parts[0].trim().toInt()
                    val g = parts[1].trim().toInt()
                    val b = parts[2].trim().toInt()
                    val a = (parts[3].trim().toFloat() * 255).toInt().coerceIn(0, 255)
                    return Color.argb(a, r, g, b)
                }
            }
            if (c.startsWith("rgb", ignoreCase = true)) {
                val clean = c.substringAfter("(").substringBefore(")")
                val parts = clean.split(",")
                if (parts.size >= 3) {
                    val r = parts[0].trim().toInt()
                    val g = parts[1].trim().toInt()
                    val b = parts[2].trim().toInt()
                    return Color.rgb(r, g, b)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Erro ao converter cor: $colorStr", e)
        }
        return null
    }

    private fun applyShortcutBackground(view: View, customColorStr: String?) {
        val customColor = parseHexOrRgbaColor(customColorStr)
        if (customColor == null) {
            view.setBackgroundResource(R.drawable.bg_shortcut_item)
            return
        }

        val stateList = StateListDrawable()

        // Estado Focado (Borda branca e destaque)
        val focusedShape = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(16).toFloat()
            setColor(customColor)
            setStroke(dpToPx(3), Color.WHITE)
        }
        stateList.addState(intArrayOf(android.R.attr.state_focused), focusedShape)

        // Estado Normal (Borda sutil semi-transparente)
        val normalShape = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(16).toFloat()
            setColor(customColor)
            setStroke(dpToPx(1), Color.parseColor("#26FFFFFF"))
        }
        stateList.addState(intArrayOf(), normalShape)

        view.background = stateList
    }

    /**
     * Heartbeat contínuo:
     * 1. Atualiza status Online no painel a cada 5s
     * 2. Se a TV for alterada no painel web (mudou HDMI, apps, layout, UH, vídeos), sincroniza quase que instantaneamente!
     */
    private fun startHeartbeatLoop() {
        handler.post(object : Runnable {
            override fun run() {
                val deviceId = SmartTVApp.instance.getTvDeviceId()
                val api = TVApiService.create(SmartTVApp.instance.getServerUrl())

                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val reportCleanup = if (pendingCleanupReport) true else null
                        val response = api.ping(
                            PingRequest(
                                deviceId = deviceId,
                                ipAddress = null,
                                appVersion = BuildConfig.VERSION_NAME,
                                cleanupCompleted = reportCleanup
                            )
                        )
                        if (reportCleanup == true) {
                            pendingCleanupReport = false
                        }
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

                handler.postDelayed(this, 5000)
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
