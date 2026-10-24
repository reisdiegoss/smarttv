# Manual Operacional de Versionamento, Build e Releases do APK Fasano SMARTTV

Este documento estabelece o **Padrão Obrigatório** que deve ser rigorosamente seguido a cada nova versão ou build do aplicativo Android TV (`com.smarttv.launcher`), garantindo histórico completo de versões, disponibilidade para download no servidor local e publicação automática de **Releases Versionadas** (`vX.Y.Z`) e **Latest** (`latest`) no GitHub.

---

## 1. Padrão de Nomenclatura e Versionamento

Toda versão do aplicativo é regida por duas variáveis obrigatórias em `android-tv-app/app/build.gradle.kts`:

| Variável | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `versionCode` | Inteiro | Número sequencial absoluto que **deve ser incrementado a cada build**. O Android rejeita atualizações onde o `versionCode` seja menor ou igual ao já instalado na TV. | `10` |
| `versionName` | String | Versão semântica visível ao usuário e administradores no formato `MAJOR.MINOR.PATCH`. | `"1.0.9"` |
| Git Tag | Tag | Identificador Git correspondente precedido pela letra `v`. | `v1.0.9` |

### Arquivos Gerados a Cada Build (Trilogia de APKs)
Para cada compilação, exatamente 3 arquivos são gerados e disponibilizados na raiz do sistema e nos repositórios:

1. **`fasano-smarttv-vX.Y.Z.apk`** *(Histórico Versionado)*: Arquivo imutável daquela versão específica (ex: `fasano-smarttv-v1.0.9.apk`). Fica arquivado permanentemente no servidor e nas Releases do GitHub.
2. **`fasano-smarttv-latest.apk`** *(Ponteiro Estável)*: Cópia atualizada que sempre aponta para a versão estável mais recente.
3. **`smarttv-launcher.apk`** *(URL Canônica OTA)*: Nome padrão servido na raiz do Nginx (`http://192.168.168.27/smarttv-launcher.apk`), utilizado pela rotina de auto-atualização silenciosa das Smart TVs.

---

## 2. Checklist Obrigatório para Toda Nova Versão

Sempre que houver alteração de código ou necessidade de gerar uma nova versão, execute as seguintes etapas sequenciais:

### Etapa 1: Atualizar o Número de Versão no Android
Edite o arquivo `android-tv-app/app/build.gradle.kts`:
```kotlin
defaultConfig {
    applicationId = "com.smarttv.launcher"
    minSdk = 21
    targetSdk = 34
    versionCode = 10     // <-- INCREMENTE O CÓDIGO (ex: 9 -> 10)
    versionName = "1.0.9" // <-- ATUALIZE A VERSÃO (ex: 1.0.8 -> 1.0.9)
}
```

### Etapa 2: Atualizar o Botão de Download no Painel Web
No arquivo `frontend/src/App.jsx`, atualize o link do botão superior de download para a nova versão (`fasano-smarttv-v1.0.9.apk` e texto `Baixar APK v1.0.9`).

### Etapa 3: Compilar o APK Localmente
Execute o script automatizado na raiz do projeto:
```bash
python build_apk_local.py
```
*Este script:*
* Configura automaticamente o `JAVA_HOME` para o JDK do Android Studio (`jbr`).
* Executa `gradlew.bat assembleDebug` com otimização.
* Copia e renomeia o APK gerado para a raiz (`smarttv-launcher.apk`, `fasano-smarttv-latest.apk`, `fasano-smarttv-vX.Y.Z.apk`).
* Atualiza as pastas `frontend/public/` e `frontend/dist/`.

### Etapa 4: Enviar para o Servidor de Produção (192.168.168.27)
Execute o script de upload:
```bash
python upload_apk_to_server.py
```
*Este script:*
* Envia os 3 arquivos APK via SFTP para `/opt/smarttv/frontend/dist/`, `/opt/smarttv/frontend/public/` e `/opt/smarttv/`.
* Aplica as permissões de download no Nginx (`application/vnd.android.package-archive`).
* Sincroniza atalhos e configurações de TVs no banco de dados.
* Reinicia o serviço backend para que as TVs conectadas reconheçam a nova versão no próximo heartbeat.

### Etapa 5: Recompilar e Atualizar o Painel Web (Frontend)
```bash
cd frontend
npm run build
cd ..
python -c "import upload_apk_to_server" # ou sincronizar dist
```

---

## 3. Publicação de Releases no GitHub Actions

O repositório possui uma esteira automatizada configurada em `.github/workflows/build-apk.yml`. 

### Como Disparar o Build e Release no GitHub:
Após finalizar as alterações locais, crie o commit e a tag de versão correspondente:

```bash
# 1. Adiciona os arquivos modificados
git add -A

# 2. Cria o commit informativo da versão
git commit -m "chore(release): v1.0.9 - correções de launcher e segurança de tecla home"

# 3. Cria a tag anotada com o número da versão
git tag -a v1.0.9 -m "Release v1.0.9"

# 4. Envia os commits e as tags para o GitHub
git push origin main --tags
```

### O que o GitHub Actions faz automaticamente:
1. Detecta o push da tag `v1.0.9` (ou push na branch `main`).
2. Configura o ambiente Linux Ubuntu com Java 17 e Android SDK.
3. Compila o projeto Android TV via Gradle.
4. Gera e valida os 3 arquivos de APK.
5. **Cria a Release Oficial Versionada** com o nome `SmartTV Launcher v1.0.9` e tag `v1.0.9`.
6. **Atualiza a Release Flutuante** `latest` com os mesmos APKs.
7. Disponibiliza os APKs para download público e seguro no GitHub.

---

## 4. Guia Técnico para Google TV: Tecla Home e Kiosk

### Por que o Google TV fecha o app ao tentar definir como padrão "Sempre"?
Em TVs com **Google TV** (TCL, Philips, Chromecast com Google TV, etc.), a fabricante bloqueia o menu padrão de seleção de Home para forçar a interface proprietária da Google (`com.google.android.apps.tv.launcherx`). Quando se tenta forçar o seletor pelo método padrão de Android puro, o Google TV cancela o seletor e volta para a sua própria Home.

Para contornar essa restrição do Google TV e travar o app na TV, existem **2 métodos**:

### Método A: Proteção por Serviço de Acessibilidade (Recomendado - Sem PC)
O APK **v1.0.9** possui o serviço nativo `LauncherAccessibilityService`:
1. Na TV, abra as **Configurações** (engrenagem).
2. Vá em **Sistema** > **Acessibilidade**.
3. Localize **Fasano SMARTTV** na lista de serviços.
4. Mude para **Ativado / Permitir**.
*Pronto!* A partir deste momento:
- A tecla **HOME** é interceptada antes do Google TV recebê-la.
- Se o usuário apertar HOME, o app **não sai**; exibe o diálogo pedindo a senha de administrador (**`0000`**).
- Se o sistema tentar abrir a tela do Google TV, o serviço detecta e traz o Fasano SMARTTV imediatamente de volta.

### Método B: Desativação do Google TV via ADB (Definitivo / Hotelaria Profissional)
Com a depuração USB/Rede ativada na TV, desativa-se o pacote do Google TV para que o Fasano SMARTTV seja a **única** Home instalada no sistema operacional:

```bash
# 1. Conecta na TV via rede local
adb connect IP_DA_TV

# 2. Desativa o launcher do Google TV
adb shell pm disable-user --user 0 com.google.android.apps.tv.launcherx

# (Em TVs mais antigas com Android TV clássico, se necessário):
# adb shell pm disable-user --user 0 com.google.android.tvlauncher
```

*Resultado:* O Google TV deixa de existir no sistema. A tecla HOME do controle remoto fica 100% vinculada ao Fasano SMARTTV.

*Para reativar o Google TV original (caso a TV mude de finalidade):*
```bash
adb shell pm enable com.google.android.apps.tv.launcherx
```
