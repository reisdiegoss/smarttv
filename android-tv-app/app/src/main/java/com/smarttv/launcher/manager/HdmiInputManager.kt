package com.smarttv.launcher.manager

import android.content.Context
import android.content.Intent
import android.media.tv.TvContract
import android.media.tv.TvInputInfo
import android.media.tv.TvInputManager
import android.net.Uri
import android.util.Log
import android.view.KeyEvent

object HdmiInputManager {

    private const val TAG = "HdmiInputManager"

    /**
     * Alterna a TV para a entrada HDMI configurada (onde o decodificador da SKY está conectado).
     */
    fun switchToHdmiInput(context: Context, inputId: String): Boolean {
        try {
            Log.d(TAG, "Tentando mudar para entrada HDMI solicitada: $inputId")

            // 1. Resolve o ID real do hardware de TV Input (TIF)
            val resolvedId = resolveHardwareInputId(context, inputId)
            Log.d(TAG, "ID de entrada resolvido: $resolvedId")

            // Método 1: Android TV TIF (TV Input Framework) com Passthrough URI
            val passthroughUri = TvContract.buildChannelUriForPassthroughInput(resolvedId)
            val intent = Intent(Intent.ACTION_VIEW, passthroughUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            }

            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                Log.i(TAG, "Sucesso ao abrir entrada TIF: $passthroughUri")
                return true
            }

            // Método 2: Intents específicas de fabricantes (TCL, MediaTek, Philips, Live Channels)
            val vendorIntents = listOf(
                Intent(Intent.ACTION_VIEW, Uri.parse("content://android.media.tv/passthrough/$resolvedId")),
                Intent(Intent.ACTION_VIEW, Uri.parse("content://android.media.tv/passthrough/$inputId")),
                Intent("com.android.tv.action.VIEW_INPUT").putExtra("input_id", resolvedId),
                Intent("android.media.tv.action.VIEW_INPUT").putExtra("input_id", resolvedId),
                Intent("com.tcl.tv.action.SOURCE_CHANGE").apply {
                    putExtra("source_type", inputId)
                    putExtra("input_id", resolvedId)
                },
                // Live Channels / TV padrão do Android TV
                Intent(Intent.ACTION_VIEW).apply {
                    setPackage("com.google.android.tv")
                    data = passthroughUri
                },
                Intent(Intent.ACTION_VIEW).apply {
                    setPackage("com.android.tv")
                    data = passthroughUri
                }
            )

            for (vIntent in vendorIntents) {
                vIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                if (vIntent.resolveActivity(context.packageManager) != null) {
                    try {
                        context.startActivity(vIntent)
                        Log.i(TAG, "Sucesso via vendor intent: ${vIntent.action} / ${vIntent.data}")
                        return true
                    } catch (e: Exception) {
                        Log.w(TAG, "Vendor intent falhou na execução", e)
                    }
                }
            }

            // Método 3: Envio de KeyEvent de Entrada HDMI (se suportado pelo hardware da TV)
            val portDigit = inputId.filter { it.isDigit() }.toIntOrNull() ?: 1
            val keycode = when (portDigit) {
                1 -> KeyEvent.KEYCODE_TV_INPUT_HDMI_1
                2 -> KeyEvent.KEYCODE_TV_INPUT_HDMI_2
                3 -> KeyEvent.KEYCODE_TV_INPUT_HDMI_3
                4 -> KeyEvent.KEYCODE_TV_INPUT_HDMI_4
                else -> KeyEvent.KEYCODE_TV_INPUT
            }

            try {
                val inputKeyEventIntent = Intent(Intent.ACTION_MEDIA_BUTTON).apply {
                    putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(KeyEvent.ACTION_DOWN, keycode))
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.sendBroadcast(inputKeyEventIntent)
            } catch (ignored: Exception) {}

            // Método 4: Fallback abrindo seletor de entradas do Android TV
            val fallbackIntents = listOf(
                Intent("android.settings.TV_INPUTS"),
                Intent("com.android.tv.action.VIEW_INPUTS"),
                Intent(Intent.ACTION_VIEW).apply {
                    component = android.content.ComponentName(
                        "com.google.android.tv.frameworkpackagestubs",
                        "com.google.android.tv.frameworkpackagestubs.InputSourceActivity"
                    )
                }
            )

            for (fb in fallbackIntents) {
                fb.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                if (fb.resolveActivity(context.packageManager) != null) {
                    context.startActivity(fb)
                    Log.i(TAG, "Seletor de entradas da TV aberto via fallback")
                    return true
                }
            }

            Log.w(TAG, "Nenhum componente de TV respondeu ao HDMI $inputId")
            return false

        } catch (e: Exception) {
            Log.e(TAG, "Erro ao alternar para entrada HDMI", e)
            return false
        }
    }

    /**
     * Resolve o rótulo amigável (ex: "HDMI 2" ou "HW2") para o ID real do hardware do Android TIF.
     */
    fun resolveHardwareInputId(context: Context, inputId: String): String {
        try {
            val tvInputManager = context.getSystemService(Context.TV_INPUT_SERVICE) as? TvInputManager
            val inputs = tvInputManager?.tvInputList ?: emptyList()
            Log.d(TAG, "Entradas TIF detectadas no Android TV (${inputs.size}):")
            for (info in inputs) {
                Log.d(TAG, "  -> ID: '${info.id}', type: ${info.type}, passthrough: ${info.isPassthroughInput}")
            }

            val clean = inputId.replace(" ", "").uppercase()
            val portNumber = inputId.filter { it.isDigit() }

            // 1. Procura por correspondência exata
            for (info in inputs) {
                if (info.id.equals(inputId, ignoreCase = true)) {
                    return info.id
                }
            }

            // 2. Procura por final /HW{port} ou HDMI_{port} ou HDMI{port}
            if (portNumber.isNotEmpty()) {
                for (info in inputs) {
                    val idUpper = info.id.uppercase()
                    if (idUpper.endsWith("/HW$portNumber") || 
                        idUpper.endsWith(".HW$portNumber") || 
                        idUpper.contains("HDMI$portNumber") || 
                        idUpper.contains("HDMI_$portNumber")) {
                        Log.i(TAG, "Entrada resolvida para hardware ID: ${info.id}")
                        return info.id
                    }
                }
            }

            // 3. Procura por qualquer passthrough que contenha a string limpa
            for (info in inputs) {
                if (info.isPassthroughInput && info.id.uppercase().contains(clean)) {
                    return info.id
                }
            }

            // 4. Se encontrar entradas HDMI registradas, mapeia pelo índice numérico
            val hdmiInputs = inputs.filter { it.type == TvInputInfo.TYPE_HDMI || it.isPassthroughInput }
            if (hdmiInputs.isNotEmpty()) {
                val index = (portNumber.toIntOrNull() ?: 1) - 1
                if (index in hdmiInputs.indices) {
                    return hdmiInputs[index].id
                }
                return hdmiInputs.first().id
            }

        } catch (e: Exception) {
            Log.e(TAG, "Erro ao listar/resolver entradas de TV", e)
        }
        return inputId
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
