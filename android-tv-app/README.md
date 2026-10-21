# Smart TV Launcher - Android TV (Android 9.0+)

Aplicativo nativo para Android TV e Google TV (API 28+) projetado para atuar como Launcher oficial / Modo Kiosk.

## Principais Funcionalidades

1. **Launcher Oficial do Sistema:**
   - Registrado com as categorias `android.intent.category.HOME` e `android.intent.category.DEFAULT`.
   - Ao pressionar o botão **Home** do controle remoto, a TV sempre retorna para a tela da Launcher.
   - Inicia automaticamente quando a TV é ligada (`BOOT_COMPLETED`).

2. **ExoPlayer com Cache Local de Vídeos:**
   - Reproduz sequências de 1 ou mais vídeos em loop contínuo sem interrupções.
   - Cache em disco de até 2GB com `SimpleCache`: se a rede Wi-Fi oscilar ou cair, a reprodução continua perfeitamente da memória interna da TV.

3. **Troca Rápida para o Canal da SKY (HDMI):**
   - Dispara a intent do Android TV TIF (`TvInputManager`) diretamente para a entrada configurada no painel (`HDMI 1`, `HDMI 2`, `HW1`).

4. **Atalhos para Aplicativos Externos:**
   - Abre apps como Netflix, YouTube, Globoplay, Prime Video diretamente pelo controle remoto.

5. **Pareamento Simplificado via Código PIN:**
   - Na primeira inicialização, a TV exibe um código de 6 caracteres na tela (ex: `ST-0101`).
   - O administrador entra no Painel Web, digita o código, define o nome da TV e ativa o dispositivo instantaneamente.

---

## Como Compilar o APK

### Opção 1: Pelo Android Studio
1. Abra o Android Studio e selecione a pasta `android-tv-app`.
2. Aguarde a sincronização do Gradle.
3. No menu superior, clique em **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. O arquivo gerado estará em: `app/build/outputs/apk/debug/app-debug.apk`.

### Opção 2: Pela Linha de Comando (Gradle CLI)
```bash
cd android-tv-app
./gradlew assembleRelease
```

---

## Como Instalar na Smart TV / Google TV

### 1. Habilitar Modo Desenvolvedor e Depuração ADB na TV:
1. Na TV, acesse **Configurações** > **Preferências do Dispositivo** > **Sobre**.
2. Clique 7 vezes seguidas na opção **Número da Versão** (Build Number) até exibir a mensagem *"Você agora é um desenvolvedor!"*.
3. Volte em **Opções do Desenvolvedor** e ative **Depuração USB** e **Depuração de Rede (ADB)**.

### 2. Conectar e Instalar via ADB pelo Computador:
No terminal do seu computador (conectado na mesma rede Wi-Fi da TV):
```bash
# 1. Conectar à TV pelo IP dela
adb connect 192.168.168.X:5555

# 2. Instalar o APK gerado
adb install -r app-debug.apk

# 3. (Opcional) Definir como Launcher padrão imediatamente
adb shell cmd package set-home-activity com.smarttv.launcher/.ui.MainActivity
```

### 3. Definir o Servidor da Rede:
Por padrão, o app aponta para o servidor `http://192.168.168.26:8000/`. Para apontar para outro IP, basta alterar a constante em `TVApiService.kt` ou no SharedPreferences do app.
