package com.smarttv.launcher.service

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import com.smarttv.launcher.ui.MainActivity

class LauncherAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "LauncherAccessibilityService conectado e ativo para proteção de Home e Assistência de Limpeza!")
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

        val pkg = event.packageName?.toString() ?: ""

        // 1. Processamento da Rotina de Auto-Limpeza de Apps (se ativa)
        if (isAutoCleaningActive && (pkg.contains("settings") || pkg.contains("packageinstaller"))) {
            handleAutoCleaningEvent(event)
            return
        }

        // 2. Intercepta quando o sistema Google TV tenta exibir sua Home original
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (STOCK_LAUNCHER_PACKAGES.contains(pkg)) {
                Log.w(TAG, "Detectada tentativa de abertura do Launcher padrão do sistema ($pkg). Redirecionando para Fasano SMARTTV...")
                handler.postDelayed({
                    if (!isExitingAuthorized && !isAutoCleaningActive) {
                        bringLauncherToFront()
                    }
                }, 100)
            }
        }
    }

    /**
     * Varre a tela de configurações do aplicativo e clica automaticamente em
     * "Limpar dados" / "Limpar armazenamento" / "Limpar cache" e confirma diálogos "OK"
     */
    private fun handleAutoCleaningEvent(event: AccessibilityEvent) {
        val rootNode = rootInActiveWindow ?: return
        try {
            // Se houver diálogo modal de confirmação ("Excluir todos os dados do aplicativo?")
            val confirmKeywords = listOf("ok", "excluir", "confirmar", "delete", "sim", "limpar")
            for (word in confirmKeywords) {
                val nodes = rootNode.findAccessibilityNodeInfosByText(word)
                for (node in nodes) {
                    val text = node.text?.toString()?.lowercase() ?: ""
                    if (text == word || text.contains(word)) {
                        if (node.isClickable) {
                            Log.i(TAG, "AutoClean: Clicando em confirmação '$text'")
                            node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            scheduleNextCleanStep(1000)
                            return
                        } else if (node.parent?.isClickable == true) {
                            Log.i(TAG, "AutoClean: Clicando no pai de confirmação '$text'")
                            node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                            scheduleNextCleanStep(1000)
                            return
                        }
                    }
                }
            }

            // Procura botões de limpeza na tela de detalhes do app
            val cleanKeywords = listOf(
                "limpar dados",
                "limpar armazenamento",
                "clear data",
                "clear storage",
                "limpar cache",
                "clear cache"
            )

            for (keyword in cleanKeywords) {
                val nodes = rootNode.findAccessibilityNodeInfosByText(keyword)
                for (node in nodes) {
                    val clickableNode = findClickableParent(node)
                    if (clickableNode != null) {
                        Log.i(TAG, "AutoClean: Clicando em '$keyword'")
                        clickableNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                        scheduleNextCleanStep(1200)
                        return
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Aviso durante inspeção de nó no AutoClean: ${e.message}")
        }
    }

    private fun findClickableParent(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        var current = node
        while (current != null) {
            if (current.isClickable) return current
            current = current.parent
        }
        return null
    }

    private var isStepScheduled = false
    private fun scheduleNextCleanStep(delayMs: Long) {
        if (isStepScheduled) return
        isStepScheduled = true
        handler.postDelayed({
            isStepScheduled = false
            // Volta para a tela anterior
            performGlobalAction(GLOBAL_ACTION_BACK)
            handler.postDelayed({
                advanceAutoCleanQueue()
            }, 800)
        }, delayMs)
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

        var isExitingAuthorized: Boolean = false

        // Fila de automação de limpeza
        private val cleanQueue = mutableListOf<String>()
        var isAutoCleaningActive: Boolean = false
        private var onCleanCompleteCallback: (() -> Unit)? = null

        fun startAutoCleanQueue(packages: List<String>, onComplete: () -> Unit) {
            val service = instance
            if (service == null) {
                onComplete()
                return
            }
            cleanQueue.clear()
            cleanQueue.addAll(packages.distinct())
            onCleanCompleteCallback = onComplete
            isAutoCleaningActive = true
            service.advanceAutoCleanQueue()
        }

        fun stopAutoClean() {
            isAutoCleaningActive = false
            cleanQueue.clear()
            instance?.bringLauncherToFront()
        }

        // Lançadores nativos que DEVEM ser interceptados (com.android.tv.settings REMOVIDO para permitir ajustes!)
        val STOCK_LAUNCHER_PACKAGES = setOf(
            "com.google.android.apps.tv.launcherx",
            "com.google.android.tvlauncher",
            "com.google.android.leanbacklauncher",
            "com.tcl.tvplayer",
            "com.tcl.launcher"
        )
    }

    private fun advanceAutoCleanQueue() {
        if (!isAutoCleaningActive) return

        if (cleanQueue.isEmpty()) {
            isAutoCleaningActive = false
            Toast.makeText(this, "🧹 Todos os aplicativos foram limpos com sucesso!", Toast.LENGTH_LONG).show()
            bringLauncherToFront()
            onCleanCompleteCallback?.invoke()
            onCleanCompleteCallback = null
            return
        }

        val nextPkg = cleanQueue.removeAt(0)
        Log.i(TAG, "AutoClean: Abrindo configurações de armazenamento para $nextPkg")
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$nextPkg")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao abrir detalhes do pacote $nextPkg", e)
            handler.postDelayed({ advanceAutoCleanQueue() }, 500)
        }
    }
}
