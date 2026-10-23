import os
import subprocess
import shutil
import sys

print("=== INICIANDO BUILD LOCAL DO APK VIA GRADLEW ===")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, "android-tv-app")

env = os.environ.copy()
jbr_path = r"C:\Program Files\Android\Android Studio\jbr"
if os.path.exists(jbr_path):
    env["JAVA_HOME"] = jbr_path
    env["PATH"] = os.path.join(jbr_path, "bin") + ";" + env.get("PATH", "")

print(f"Diretório: {APP_DIR}")
print(f"JAVA_HOME: {env.get('JAVA_HOME')}")

cmd = r".\gradlew.bat assembleDebug -Dkotlin.compiler.execution.strategy=in-process --no-daemon --stacktrace"
print(f">> Executando: {cmd}")

process = subprocess.Popen(
    cmd,
    cwd=APP_DIR,
    shell=True,
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

output_lines = []
for line in process.stdout:
    sys.stdout.write(line)
    sys.stdout.flush()
    output_lines.append(line)

# Limpa relatorios para evitar FileAlreadyExistsException de problemas no Windows
reports_dir = os.path.join(APP_DIR, "build", "reports")
if os.path.exists(reports_dir):
    shutil.rmtree(reports_dir, ignore_errors=True)

process.wait()

with open(os.path.join(BASE_DIR, "local_build.log"), "w", encoding="utf-8") as f:
    f.writelines(output_lines)

apk_src = os.path.join(APP_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
if process.returncode != 0 and not os.path.exists(apk_src):
    print(f"\n[FALHA] NO BUILD LOCAL (codigo {process.returncode})")
    sys.exit(process.returncode)

print("\n[SUCESSO] BUILD REALIZADO COM SUCESSO!")
if os.path.exists(apk_src):
    size_mb = os.path.getsize(apk_src) / (1024 * 1024)
    print(f"APK Gerado: {apk_src} ({size_mb:.2f} MB)")

    # Detecta versão no build.gradle.kts
    import re
    app_version = "1.0.8"
    gradle_file = os.path.join(APP_DIR, "app", "build.gradle.kts")
    if os.path.exists(gradle_file):
        with open(gradle_file, "r", encoding="utf-8") as gf:
            m = re.search(r'versionName\s*=\s*"([^"]+)"', gf.read())
            if m:
                app_version = m.group(1)
    print(f"Versão identificada: v{app_version}")

    apk_filenames = [
        "smarttv-launcher.apk",
        "fasano-smarttv-latest.apk",
        f"fasano-smarttv-v{app_version}.apk"
    ]

    # 1. Copia para a raiz do repositório
    for name in apk_filenames:
        dest = os.path.join(BASE_DIR, name)
        shutil.copy2(apk_src, dest)
        print(f"Copiado para a raiz: {name}")

    # 2. Copia para o frontend public (fonte Vite)
    public_dir = os.path.join(BASE_DIR, "frontend", "public")
    os.makedirs(public_dir, exist_ok=True)
    for name in apk_filenames:
        dest = os.path.join(public_dir, name)
        shutil.copy2(apk_src, dest)
        print(f"Copiado para public: {dest}")

    # 3. Copia para o frontend dist (servido pelo Nginx)
    dist_dir = os.path.join(BASE_DIR, "frontend", "dist")
    os.makedirs(dist_dir, exist_ok=True)
    for name in apk_filenames:
        dest = os.path.join(dist_dir, name)
        shutil.copy2(apk_src, dest)
        print(f"Copiado para dist: {dest}")

else:
    print(f"Aviso: Arquivo {apk_src} não encontrado após o build.")
