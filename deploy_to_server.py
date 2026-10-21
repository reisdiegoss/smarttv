import os
import tarfile
import tempfile
import paramiko
from scp import SCPClient

HOSTNAME = "fassa27.fasanobr.local"
USER = "root"
PASS = "@FasanoS#srv"
REMOTE_BASE = "/opt/smarttv"

def run_remote_command(client, cmd, ignore_error=False):
    print(f"\n[REMOTE EXEC] {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='ignore').strip()
    err = stderr.read().decode('utf-8', errors='ignore').strip()
    if out:
        print("OUT:\n" + out)
    if err and not ignore_error:
        print("ERR:\n" + err)
    if exit_status != 0 and not ignore_error:
        raise Exception(f"Command failed with exit code {exit_status}: {cmd}")
    return out

def create_tarball(source_dir, output_filename, arc_prefix=""):
    with tarfile.open(output_filename, "w:gz") as tar:
        for root, dirs, files in os.walk(source_dir):
            # ignore venv and node_modules
            dirs[:] = [d for d in dirs if d not in ('venv', 'node_modules', '__pycache__', '.git')]
            for f in files:
                if f.endswith('.pyc'):
                    continue
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, source_dir)
                arc_name = os.path.join(arc_prefix, rel_path)
                tar.add(full_path, arcname=arc_name)

def main():
    print(f"=== INICIANDO IMPLANTAÇÃO NO SERVIDOR {HOSTNAME} ===")
    
    # 1. Connect SSH
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOSTNAME, port=22, username=USER, password=PASS, timeout=15)
    print("Conexão SSH estabelecida com sucesso!")

    # 2. Install prerequisites on Ubuntu
    print("\n[PASSO 1] Instalando pacotes do sistema (python3-venv, nginx, etc.)...")
    run_remote_command(client, "apt-get update -y")
    run_remote_command(client, "apt-get install -y python3-venv python3-pip nginx curl")

    # 3. Create directories
    print("\n[PASSO 2] Criando diretórios da aplicação em /opt/smarttv...")
    run_remote_command(client, f"mkdir -p {REMOTE_BASE}/backend {REMOTE_BASE}/frontend/dist {REMOTE_BASE}/uploads/videos")

    # 4. Create and upload tarballs
    print("\n[PASSO 3] Compactando e enviando arquivos...")
    with tempfile.TemporaryDirectory() as tmpdir:
        backend_tar = os.path.join(tmpdir, "backend.tar.gz")
        frontend_tar = os.path.join(tmpdir, "frontend.tar.gz")

        print("  - Empacotando backend...")
        create_tarball("backend", backend_tar)

        print("  - Empacotando frontend/dist...")
        create_tarball("frontend/dist", frontend_tar)

        with SCPClient(client.get_transport()) as scp:
            print("  - Transferindo backend.tar.gz...")
            scp.put(backend_tar, "/tmp/backend.tar.gz")
            print("  - Transferindo frontend.tar.gz...")
            scp.put(frontend_tar, "/tmp/frontend.tar.gz")

    # 5. Extract files on remote
    print("\n[PASSO 4] Extraindo arquivos no servidor...")
    run_remote_command(client, f"tar -xzf /tmp/backend.tar.gz -C {REMOTE_BASE}/backend")
    run_remote_command(client, f"tar -xzf /tmp/frontend.tar.gz -C {REMOTE_BASE}/frontend/dist")
    run_remote_command(client, "rm -f /tmp/backend.tar.gz /tmp/frontend.tar.gz")

    # 6. Setup Python Virtual Environment and Dependencies
    print("\n[PASSO 5] Configurando ambiente virtual Python e dependências...")
    run_remote_command(client, f"test -d {REMOTE_BASE}/backend/venv || python3 -m venv {REMOTE_BASE}/backend/venv")
    run_remote_command(client, f"{REMOTE_BASE}/backend/venv/bin/pip install --upgrade pip")
    run_remote_command(client, f"{REMOTE_BASE}/backend/venv/bin/pip install -r {REMOTE_BASE}/backend/requirements.txt")

    # 7. Create .env for backend
    print("\n[PASSO 6] Configurando .env de produção...")
    env_content = """PROJECT_NAME="SmartTV Manager"
DB_USER=postgres
DB_PASSWORD=6ffdd4a3d0e99d78b1e15f411b04e323
DB_HOST=192.168.168.26
DB_PORT=5432
DB_NAME=smarttv
"""
    run_remote_command(client, f"cat << 'EOF' > {REMOTE_BASE}/backend/.env\n{env_content}\nEOF")

    # 8. Create Systemd Service
    print("\n[PASSO 7] Criando serviço systemd para o backend...")
    service_content = f"""[Unit]
Description=SmartTV Manager FastAPI Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={REMOTE_BASE}/backend
ExecStart={REMOTE_BASE}/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
EnvironmentFile={REMOTE_BASE}/backend/.env

[Install]
WantedBy=multi-user.target
"""
    run_remote_command(client, f"cat << 'EOF' > /etc/systemd/system/smarttv-backend.service\n{service_content}\nEOF")
    run_remote_command(client, "systemctl daemon-reload")
    run_remote_command(client, "systemctl enable smarttv-backend")
    run_remote_command(client, "systemctl restart smarttv-backend")

    # 9. Configure Nginx Reverse Proxy (sem portas expostas!)
    print("\n[PASSO 8] Configurando Nginx Reverse Proxy (porta 80 padrão, URLs amigáveis)...")
    nginx_conf = f"""server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 1000M;

    # Frontend (React App)
    root {REMOTE_BASE}/frontend/dist;
    index index.html;

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # Backend REST API
    location /api/ {{
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }}

    # WebSocket Real-time Updates
    location /ws/ {{
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
    }}

    # Swagger API Documentation
    location /docs {{
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }}
    location /openapi.json {{
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
    }}
}}
"""
    run_remote_command(client, f"cat << 'EOF' > /etc/nginx/sites-available/smarttv\n{nginx_conf}\nEOF")
    run_remote_command(client, "rm -f /etc/nginx/sites-enabled/default")
    run_remote_command(client, "ln -sf /etc/nginx/sites-available/smarttv /etc/nginx/sites-enabled/smarttv")
    run_remote_command(client, "nginx -t")
    run_remote_command(client, "systemctl restart nginx")

    # 10. Verification and Health Check
    print("\n[PASSO 9] Realizando checagem de integridade...")
    run_remote_command(client, "sleep 2")
    run_remote_command(client, "systemctl status smarttv-backend --no-pager | head -n 12")
    run_remote_command(client, "curl -sI http://127.0.0.1/ | head -n 5")
    run_remote_command(client, "curl -s http://127.0.0.1/api/tvs | head -c 200; echo ''")

    print("\n=== IMPLANTAÇÃO CONCLUÍDA COM SUCESSO! ===")
    print(f"Acesse o sistema diretamente pela URL:")
    print(f"  -> http://{HOSTNAME}/")
    print(f"  -> http://192.168.168.27/")
    print(f"API Docs:")
    print(f"  -> http://{HOSTNAME}/docs")

    client.close()

if __name__ == "__main__":
    main()
