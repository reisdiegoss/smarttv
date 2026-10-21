package com.smarttv.launcher.manager

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.widget.Toast

object AppLauncherManager {

    /**
     * Inicia um aplicativo pelo nome do pacote (ex: com.netflix.ninja)
     */
    fun launchApp(context: Context, packageName: String): Boolean {
        try {
            val pm: PackageManager = context.packageManager
            val intent: Intent? = pm.getLaunchIntentForPackage(packageName)
                ?: pm.getLeanbackLaunchIntentForPackage(packageName)

            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return true
            } else {
                Toast.makeText(context, "App não instalado: $packageName", Toast.LENGTH_SHORT).show()
                return false
            }
        } catch (e: Exception) {
            Toast.makeText(context, "Erro ao abrir aplicativo", Toast.LENGTH_SHORT).show()
            return false
        }
    }

    /**
     * Verifica se determinado pacote está instalado no dispositivo
     */
    fun isAppInstalled(context: Context, packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}
