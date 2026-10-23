package com.smarttv.launcher.manager

import android.content.Context
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
     */
    suspend fun clearGuestAppData(context: Context, extraPackages: List<String> = emptyList()) = withContext(Dispatchers.IO) {
        Log.i(TAG, "Iniciando limpeza segura de dados de hóspede pós-checkout...")

        val packagesToClean = (STREAMING_PACKAGES + extraPackages).distinct()

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

        // 2. Limpeza via comando nativo 'pm clear' (Android TV shell)
        for (pkg in packagesToClean) {
            if (pkg == context.packageName) continue // Nunca limpa o próprio launcher

            try {
                val process = Runtime.getRuntime().exec(arrayOf("pm", "clear", pkg))
                val exitCode = process.waitFor()
                Log.i(TAG, "pm clear para $pkg (exitCode: $exitCode)")
            } catch (e: Exception) {
                Log.d(TAG, "Erro ao executar pm clear para $pkg: ${e.message}")
            }

            // Encerra qualquer processo em background
            try {
                Runtime.getRuntime().exec(arrayOf("am", "force-stop", pkg)).waitFor()
            } catch (ignored: Exception) {}
        }

        Log.i(TAG, "Limpeza de dados de hóspede finalizada.")
    }
}
