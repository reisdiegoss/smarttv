import os
import sys
import paramiko

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ssh_output.txt")

def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")
        f.flush()

with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("Iniciando ssh_check...\n")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    log("Conectando via SSH em 192.168.168.27...")
    client.connect("192.168.168.27", username="root", password="@FasanoS#srv", timeout=8)
    log("Conexão SSH OK!")

    stdin, stdout, stderr = client.exec_command("uname -a && java -version 2>&1 && which gradle adb javac")
    log("--- Info Servidor ---")
    log(stdout.read().decode("utf-8"))

    stdin, stdout, stderr = client.exec_command("ls -la /opt/smarttv/frontend/dist/")
    log("--- Conteudo dist ---")
    log(stdout.read().decode("utf-8"))

    stdin, stdout, stderr = client.exec_command("find /opt/smarttv -name '*.apk'")
    log("--- APKs encontrados no servidor ---")
    log(stdout.read().decode("utf-8"))

except Exception as e:
    log(f"Erro: {e}")
finally:
    client.close()
    log("Fim da execução.")
