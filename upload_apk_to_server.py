import os
import sys
import paramiko

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APK_PATH = os.path.join(BASE_DIR, "smarttv-launcher.apk")

if not os.path.exists(APK_PATH):
    print("APK não encontrado na raiz!")
    sys.exit(1)

print(f"Enviando {APK_PATH} ({os.path.getsize(APK_PATH) / (1024*1024):.2f} MB) para o servidor 192.168.168.27...")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect("192.168.168.27", username="root", password="@FasanoS#srv", timeout=10)
    sftp = ssh.open_sftp()
    
    # Garante que a pasta dist existe no servidor
    stdin, stdout, stderr = ssh.exec_command("mkdir -p /opt/smarttv/frontend/dist")
    stdout.channel.recv_exit_status()

    remote_path = "/opt/smarttv/frontend/dist/smarttv-launcher.apk"
    print(f"Copiando via SFTP para {remote_path}...")
    sftp.put(APK_PATH, remote_path)
    sftp.close()

    # Confirma tamanho e permissões no servidor
    stdin, stdout, stderr = ssh.exec_command(f"ls -lh {remote_path}")
    output = stdout.read().decode("utf-8").strip()
    print("Confirmação no servidor:\n", output)

    print("\n[OK] APK enviado e disponível para download no painel web!")

except Exception as e:
    print(f"Erro ao enviar via SFTP: {e}")
finally:
    ssh.close()
