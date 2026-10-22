package com.smarttv.launcher.ui

import android.app.Activity
import android.os.Bundle

/**
 * Activity fantasma desabilitada por padrão.
 * Usada pelo LauncherHelper para invalidar o cache de Home padrão do Android TV
 * e forçar a exibição do diálogo de seleção de Launcher ("Sempre / Desta vez").
 */
class FakeHomeActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        finish()
    }
}
