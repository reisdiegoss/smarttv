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
import com.smarttv.launcher.service.LauncherAccessibilityService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class AppCleanupReport(
    val silentSuccessPackages: List<String>,
    val remainingPackages: List<String>,
    val isDeviceOwner: Boolean,
    val isRoot: Boolean
)

object AppCleanupManager {
    private const val TAG = "AppCleanupManager"

    // Principais pacotes de streaming de hotéis e entretenimento que os hóspedes utilizam
    val STREAMING_PACKAGES = listOf(
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
     * Tenta limpar o cache e dados de sessão de forma silenciosa via Root ou Device Owner.
     * Retorna um relatório claro com o que conseguiu limpar e o que requer assistência.
     */
    suspend fun clearGuestAppData(context: Context, extraPackages: List<String> = emptyList()): AppCleanupReport = withContext(Dispatchers.IO) {
        Log.i(TAG, "Iniciando verificação e limpeza silenciosa de dados...")

        val packagesToClean = (STREAMING_PACKAGES + extraPackages)
            .filter { it.isNotBlank() && !it.startsWith("action.") && it != context.packageName }
            .distinct()

        val silentSuccess = mutableListOf<String>()
        val remaining = mutableListOf<String>()

        // 1. Limpeza universal de Cookies e WebView
        try {
            withContext(Dispatchers.Main) {
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
                WebStorage.getInstance().deleteAllData()
                Log.d(TAG, "Cookies e WebStorage limpos.")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao limpar CookieManager: ${e.message}")
        }

        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        val isDeviceOwner = dpm != null && dpm.isDeviceOwnerApp(context.packageName)
        var hasRoot = false

        for (pkg in packagesToClean) {
            var cleaned = false

            // Tentativa 1: Root (su -c pm clear)
            try {
                val suProcess = Runtime.getRuntime().exec(arrayOf("su", "-c", "pm clear $pkg"))
                val code = suProcess.waitFor()
                if (code == 0) {
                    cleaned = true
                    hasRoot = true
                    Log.i(TAG, "Root: pm clear bem-sucedido para $pkg")
                }
            } catch (ignored: Exception) {}

            // Tentativa 2: DevicePolicyManager (Device Owner oficial do Google)
            if (!cleaned && isDeviceOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    dpm?.clearApplicationUserData(
                        ComponentName(context, "com.smarttv.launcher.receiver.AdminReceiver"),
                        pkg,
                        context.mainExecutor
                    ) { _, success ->
                        Log.i(TAG, "DPM clearApplicationUserData para $pkg: $success")
                    }
                    cleaned = true
                } catch (e: Exception) {
                    Log.w(TAG, "Erro no DPM para $pkg: ${e.message}")
                }
            }

            if (cleaned) {
                silentSuccess.add(pkg)
            } else {
                remaining.add(pkg)
            }

            // Força fechamento do processo
            try {
                Runtime.getRuntime().exec(arrayOf("am", "force-stop", pkg)).waitFor()
            } catch (ignored: Exception) {}
        }

        Log.i(TAG, "Limpeza silenciosa concluída: ${silentSuccess.size} limpos, ${remaining.size} pendentes.")
        AppCleanupReport(
            silentSuccessPackages = silentSuccess,
            remainingPackages = remaining,
            isDeviceOwner = isDeviceOwner,
            isRoot = hasRoot
        )
    }

    /**
     * Inicia a sequência de limpeza assistida via AccessibilityService
     */
    fun startAssistedClean(packages: List<String>, onComplete: () -> Unit) {
        LauncherAccessibilityService.startAutoCleanQueue(packages, onComplete)
    }

    /**
     * Abre a tela de Gerenciamento / Limpeza de Dados de um aplicativo específico
     */
    fun openAppDetailsSettings(context: Context, packageName: String) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao abrir configurações do app $packageName", e)
        }
    }
}
