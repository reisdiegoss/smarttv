package com.smarttv.launcher.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import com.smarttv.launcher.ui.MainActivity

class LauncherAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "LauncherAccessibilityService conectado e ativo para proteção de Home!")
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (isExitingAuthorized) return

        // Intercepta quando o sistema Google TV tenta exibir sua Home original
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkg = event.packageName?.toString() ?: return
            if (STOCK_LAUNCHER_PACKAGES.contains(pkg)) {
                Log.w(TAG, "Detectada tentativa de abertura do Launcher padrão do sistema ($pkg). Redirecionando para Fasano SMARTTV...")
                handler.postDelayed({
                    if (!isExitingAuthorized) {
                        bringLauncherToFront()
                    }
                }, 100)
            }
        }
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val keyCode = event.keyCode

        if (keyCode == KeyEvent.KEYCODE_HOME || keyCode == KeyEvent.KEYCODE_APP_SWITCH) {
            if (isExitingAuthorized) {
                return super.onKeyEvent(event)
            }

            if (event.action == KeyEvent.ACTION_UP) {
                Log.d(TAG, "Tecla HOME interceptada pelo AccessibilityService! Notificando MainActivity...")
                val intent = Intent(this, MainActivity::class.java).apply {
                    action = Intent.ACTION_MAIN
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra("EXTRA_HOME_KEY_PRESSED", true)
                }
                startActivity(intent)
            }
            // Consome o evento para impedir que o Google TV / Android TV processe a tecla Home!
            return true
        }

        return super.onKeyEvent(event)
    }

    override fun onInterrupt() {
        Log.w(TAG, "LauncherAccessibilityService interrompido pelo sistema")
    }

    private fun bringLauncherToFront() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao trazer Fasano SMARTTV para primeiro plano", e)
        }
    }

    companion object {
        private const val TAG = "LauncherA11yService"
        var instance: LauncherAccessibilityService? = null

        /**
         * Quando o administrador escolhe "Sair do App" no menu de ações com a senha correta,
         * esta flag é marcada como true para liberar a saída e não redirecionar de volta.
         */
        var isExitingAuthorized: Boolean = false

        val STOCK_LAUNCHER_PACKAGES = setOf(
            "com.google.android.apps.tv.launcherx",
            "com.google.android.tvlauncher",
            "com.google.android.leanbacklauncher",
            "com.tcl.tvplayer",
            "com.tcl.launcher",
            "com.android.tv.settings"
        )
    }
}
