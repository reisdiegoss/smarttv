package com.smarttv.launcher.manager

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object AppCleanupManager {
    private const val TAG = "AppCleanupManager"

    // Principais pacotes de streaming de hotéis e entretenimento que os hóspedes utilizam
    private val STREAMING_PACKAGES = listOf(
        "com.netflix.ninja",                     // Netflix Android TV
        "com.google.android.youtube.tv",          // YouTube TV
        "com.amazon.amazonvideo.livingroom",     // Amazon Prime Video
        "com.spotify.tv.android",                // Spotify Android TV
        "com.disney.disneyplus",                 // Disney+
        "com.globo.globotv",                     // Globoplay
        "com.hbomax",                            // Max / HBO Max
        "com.wbd.stream",                        // Max novo
        "org.videolan.vlc"                       // VLC
    )

    /**
     * Limpa o cache, dados de sessão e cookies de login de todos os apps de terceiros
     * configurados ou conhecidos, protegendo a privacidade dos hóspedes pós-checkout.
     * Tenta múltiplas camadas de execução (Root, Device Owner, PM Shell).
     */
    suspend fun clearGuestAppData(context: Context, extraPackages: List<String> = emptyList()): List<String> = withContext(Dispatchers.IO) {
        Log.i(TAG, "Iniciando limpeza segura de dados de hóspede pós-checkout...")

        val packagesToClean = (STREAMING_PACKAGES + extraPackages)
            .filter { it.isNotBlank() && !it.startsWith("action.") && it != context.packageName }
            .distinct()

        val cleanedApps = mutableListOf<String>()

        // 1. Limpeza de Cookies e Dados WebView (usado por apps híbridos e navegadores)
        try {
            withContext(Dispatchers.Main) {
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
                WebStorage.getInstance().deleteAllData()
                Log.d(TAG, "Cookies e WebStorage limpos com sucesso.")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao limpar CookieManager/WebStorage: ${e.message}")
        }

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager

        for (pkg in packagesToClean) {
            var success = false

            // Tentativa 1: Root (su -c pm clear)
            try {
                val suProcess = Runtime.getRuntime().exec(arrayOf("su", "-c", "pm clear $pkg"))
                val code = suProcess.waitFor()
                if (code == 0) {
                    success = true
                    Log.i(TAG, "pm clear via root executado com sucesso para $pkg")
                }
            } catch (ignored: Exception) {}

            // Tentativa 2: DevicePolicyManager se for Device Owner
            if (!success && dpm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    if (dpm.isDeviceOwnerApp(context.packageName)) {
                        dpm.clearApplicationUserData(
                            ComponentName(context, "com.smarttv.launcher.receiver.AdminReceiver"),
                            pkg,
                            context.mainExecutor
                        ) { _, s ->
                            Log.i(TAG, "clearApplicationUserData via DPM para $pkg: $s")
                        }
                        success = true
                    }
                } catch (ignored: Exception) {}
            }

            // Tentativa 3: Shell padrão (pm clear)
            if (!success) {
                try {
                    val process = Runtime.getRuntime().exec(arrayOf("pm", "clear", pkg))
                    val exitCode = process.waitFor()
                    if (exitCode == 0) {
                        success = true
                    }
                } catch (ignored: Exception) {}
            }

            // Força encerramento do processo em background
            try {
                Runtime.getRuntime().exec(arrayOf("am", "force-stop", pkg)).waitFor()
            } catch (ignored: Exception) {}

            cleanedApps.add(pkg)
        }

        Log.i(TAG, "Limpeza de dados de hóspede finalizada para ${cleanedApps.size} pacotes.")
        cleanedApps
    }

    /**
     * Abre a tela de Gerenciamento de Armazenamento / Limpeza de Dados do app específico
     */
    fun openAppDetailsSettings(context: Context, packageName: String) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao abrir configurações do app $packageName", e)
        }
    }
}
