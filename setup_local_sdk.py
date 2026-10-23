import os
import sys
import urllib.request
import zipfile
import subprocess
import shutil

SDK_ROOT = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk")
CMDLINE_TOOLS_URL = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
JBR_PATH = r"C:\Program Files\Android\Android Studio\jbr"

os.makedirs(SDK_ROOT, exist_ok=True)
print(f"=== CONFIGURANDO ANDROID SDK EM: {SDK_ROOT} ===")

latest_tools_dir = os.path.join(SDK_ROOT, "cmdline-tools", "latest")
sdkmanager_bat = os.path.join(latest_tools_dir, "bin", "sdkmanager.bat")

if not os.path.exists(sdkmanager_bat):
    zip_path = os.path.join(SDK_ROOT, "cmdline-tools.zip")
    print("Baixando Android Command Line Tools do Google (~140MB)...")
    
    def report(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = (downloaded / total_size) * 100
            sys.stdout.write(f"\rBaixando: {percent:.1f}% ({downloaded/(1024*1024):.1f}MB / {total_size/(1024*1024):.1f}MB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(CMDLINE_TOOLS_URL, zip_path, reporthook=report)
    print("\nDownload concluído! Extraindo...")

    extract_tmp = os.path.join(SDK_ROOT, "tmp_cmdline")
    os.makedirs(extract_tmp, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_tmp)

    # Move cmdline-tools extraído para <SDK_ROOT>/cmdline-tools/latest
    os.makedirs(os.path.join(SDK_ROOT, "cmdline-tools"), exist_ok=True)
    inner_tools = os.path.join(extract_tmp, "cmdline-tools")
    if os.path.exists(latest_tools_dir):
        shutil.rmtree(latest_tools_dir)
    shutil.move(inner_tools, latest_tools_dir)
    shutil.rmtree(extract_tmp, ignore_errors=True)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    print("Command Line Tools instalado com sucesso!")

# Configura ambiente de execução do sdkmanager
env = os.environ.copy()
env["JAVA_HOME"] = JBR_PATH
env["PATH"] = os.path.join(JBR_PATH, "bin") + ";" + env.get("PATH", "")

print("\nAceitando licenças e instalando Android Platform 34 e Build-Tools 34.0.0...")
install_cmd = [
    sdkmanager_bat,
    f"--sdk_root={SDK_ROOT}",
    "platforms;android-34",
    "build-tools;34.0.0"
]

proc = subprocess.Popen(
    install_cmd,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    env=env,
    shell=True
)

# Envia 'y' repetidamente para aceitar todas as licenças
stdout, _ = proc.communicate(input="y\ny\ny\ny\ny\ny\ny\ny\ny\ny\n")
print(stdout)

# Atualiza local.properties do projeto
project_root = os.path.dirname(os.path.abspath(__file__))
local_prop_path = os.path.join(project_root, "android-tv-app", "local.properties")
escaped_sdk_dir = SDK_ROOT.replace("\\", "\\\\")
with open(local_prop_path, "w", encoding="utf-8") as f:
    f.write(f"sdk.dir={escaped_sdk_dir}\n")

print(f"\n[OK] local.properties atualizado com sucesso: {local_prop_path}")
print(f"sdk.dir = {SDK_ROOT}")
