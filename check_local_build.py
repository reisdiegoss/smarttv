import os
import subprocess
import sys

print("=== DIAGNOSTICO DO AMBIENTE LOCAL PARA BUILD DO APK ===")
print("Python:", sys.version)

# 1. Checa Variaveis de Ambiente
java_home = os.environ.get("JAVA_HOME")
android_home = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
path = os.environ.get("PATH", "")

print(f"JAVA_HOME: {java_home}")
print(f"ANDROID_HOME: {android_home}")

# 2. Checa executaveis no PATH
def check_exe(name):
    res = subprocess.run(f"where {name}", shell=True, capture_output=True, text=True)
    if res.returncode == 0:
        lines = res.stdout.strip().split("\n")
        print(f"Encontrado {name}: {lines[0]}")
        return lines[0]
    else:
        print(f"Nao encontrado no PATH: {name}")
        return None

java_path = check_exe("java")
javac_path = check_exe("javac")
gradle_path = check_exe("gradle")
adb_path = check_exe("adb")

# 3. Checa versoes
if java_path:
    try:
        v_res = subprocess.run("java -version", shell=True, capture_output=True, text=True)
        out = v_res.stderr or v_res.stdout
        print(f"Versao do Java:\n{out.strip()}")
    except Exception as e:
        print(f"Erro ao checar versao do Java: {e}")

# 4. Procura instalacoes comuns do Android Studio / SDK
common_sdk_paths = [
    os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk"),
    os.path.expandvars(r"%USERPROFILE%\AppData\Local\Android\Sdk"),
    r"C:\Android\Sdk",
    r"C:\Program Files\Android\Android Studio"
]

print("\n--- Verificando Diretorios Padrao do Android no Windows ---")
for p in common_sdk_paths:
    if os.path.exists(p):
        print(f" [OK] Encontrado: {p}")
    else:
        print(f" [ ] Nao encontrado: {p}")

# 5. Procura JDKs em Program Files
jdk_dirs = [r"C:\Program Files\Java", r"C:\Program Files\Eclipse Adoptium", r"C:\Program Files\Android\Android Studio\jbr"]
print("\n--- Verificando Instalacoes de JDK/Java ---")
for jd in jdk_dirs:
    if os.path.exists(jd):
        print(f" [OK] Diretorio existe: {jd}")
        try:
            print("      Subpastas:", os.listdir(jd))
        except Exception:
            pass
    else:
        print(f" [ ] Nao encontrado: {jd}")

print("\n=== FIM DO DIAGNOSTICO ===")
