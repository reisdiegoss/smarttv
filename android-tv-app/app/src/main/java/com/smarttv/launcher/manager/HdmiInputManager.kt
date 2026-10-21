package com.smarttv.launcher.manager

import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.media.tv.TvInputInfo
import android.media.tv.TvInputManager
import android.net.Uri
import android.util.Log

object HdmiInputManager {

    private const val TAG = "HdmiInputManager"

    /**
     * Alterna a TV para a entrada HDMI configurada (onde o decodificador da SKY está conectado).
     */
    fun switchToHdmiInput(context: Context, inputId: String): Boolean {
        try {
            Log.d(TAG, "Tentando mudar para entrada HDMI: $inputId")

            // Método 1: Android TV TIF (TV Input Framework) com Passthrough URI
            val passthroughUri = TvContract.buildChannelUriForPassthroughInput(inputId)
            val intent = Intent(Intent.ACTION_VIEW, passthroughUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            }

            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                return true
            }

            // Método 2: Tentativa via Intent de Fabricante Direto (TCL, Philips, MStar, MediaTek)
            val vendorIntents = listOf(
                Intent("android.intent.action.VIEW", Uri.parse("content://android.media.tv/passthrough/$inputId")),
                Intent("com.android.tv.action.VIEW_INPUT").putExtra("input_id", inputId),
                Intent("android.media.tv.action.VIEW_INPUT").putExtra("input_id", inputId)
            )

            for (vIntent in vendorIntents) {
                vIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                if (vIntent.resolveActivity(context.packageManager) != null) {
                    context.startActivity(vIntent)
                    return true
                }
            }

            // Método 3: Fallback genérico para abrir o seletor de entradas da TV
            val fallbackIntent = Intent(Intent.ACTION_VIEW).apply {
                component = android.content.ComponentName("com.google.android.tv.frameworkpackagestubs", "com.google.android.tv.frameworkpackagestubs.InputSourceActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (fallbackIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(fallbackIntent)
                return true
            }

            Log.w(TAG, "Nenhum componente padrão de TV Input respondeu ao ID $inputId")
            return false

        } catch (e: Exception) {
            Log.e(TAG, "Erro ao alternar para entrada HDMI", e)
            return false
        }
    }

    /**
     * Lista todas as entradas físicas e passthrough disponíveis na TV (HDMI 1, HDMI 2, etc.)
     */
    fun getAvailableInputs(context: Context): List<String> {
        val list = mutableListOf<String>()
        try {
            val tvInputManager = context.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager
            val inputs = tvInputManager?.tvInputList ?: emptyList()
            for (info in inputs) {
                if (info.type == TvInputInfo.TYPE_HDMI || info.isPassthroughInput) {
                    list.add(info.id)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao listar entradas de TV", e)
        }
        return list
    }
}
