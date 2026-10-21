import paramiko
import sys

HOSTNAME = "fassa27.fasanobr.local"
USER = "root"
PASS = "@FasanoS#srv"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {HOSTNAME} as {USER}...")
    client.connect(hostname=HOSTNAME, port=22, username=USER, password=PASS, timeout=10)
    print("SSH Connection SUCCESSFUL!")

    commands = [
        "cat /etc/os-release | grep PRETTY_NAME",
        "which python3; python3 --version",
        "which node; node --version",
        "which nginx; nginx -v",
        "which docker; docker --version",
        "systemctl is-active nginx || systemctl is-active apache2 || true",
        "ls -la /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null || true",
        "ip addr show | grep 'inet ' | grep -v '127.0.0.1'"
    ]

    for cmd in commands:
        print(f"\n--- [CMD: {cmd}] ---")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore').strip()
        err = stderr.read().decode('utf-8', errors='ignore').strip()
        if out:
            print("STDOUT:\n" + out)
        if err:
            print("STDERR:\n" + err)

    client.close()
except Exception as e:
    print("ERROR:", e)
    sys.exit(1)
