import paramiko

HOSTNAME = "fassa27.fasanobr.local"
USER = "root"
PASS = "@FasanoS#srv"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=HOSTNAME, port=22, username=USER, password=PASS)

commands = [
    "nc -zv 192.168.168.26 5432 2>&1 || (python3 -c 'import socket; s=socket.socket(); s.settimeout(3); s.connect((\"192.168.168.26\", 5432)); print(\"POSTGRES CONNECT SUCCESS\")')",
    "python3 -m pip --version 2>&1 || true",
    "python3 -m venv --help 2>&1 | head -n 3 || true",
    "apt-get update -qq && echo 'APT UPDATE OK' || echo 'APT UPDATE FAILED'"
]

for cmd in commands:
    print(f"\n--- [CMD: {cmd}] ---")
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='ignore').strip())

client.close()
