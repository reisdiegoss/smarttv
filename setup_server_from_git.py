import paramiko
import sys

HOSTNAME = "fassa27.fasanobr.local"
USER = "root"
PASS = "@FasanoS#srv"
REPO_URL = "https://github.com/reisdiegoss/smarttv.git"
INSTALL_DIR = "/opt/smarttv"

def execute_remote(client, cmd, ignore_error=False):
    print(f"\n>>> [SERVER] {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(out)
    if err and not ignore_error:
        print("ERR: " + err)
    if exit_status != 0 and not ignore_error:
        raise Exception(f"Comando falhou com código {exit_status}: {cmd}")
    return out

def main():
    print(f"=== CONECTANDO AO SERVIDOR {HOSTNAME} ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOSTNAME, port=22, username=USER, password=PASS, timeout=15)
    print("Conexão SSH bem-sucedida!")

    # 1. Instalação de pacotes essenciais
    print("\n--- PASSO 1: Instalando dependências (git, python3-venv, nginx, nodejs, npm) ---")
    execute_remote(client, "DEBIAN_FRONTEND=noninteractive apt-get update -y -q")
    execute_remote(client, "DEBIAN_FRONTEND=noninteractive apt-get install -y -q git python3-venv python3-pip nginx nodejs npm curl")

    # 2. Clonagem ou Atualização do Repositório Git
    print("\n--- PASSO 2: Clonando repositório do GitHub em /opt/smarttv ---")
    check_repo = execute_remote(client, f"test -d {INSTALL_DIR}/.git && echo 'EXISTS' || echo 'NEW'", ignore_error=True)
    if 'EXISTS' in check_repo:
        print("Repositório já existe. Executando git pull...")
        execute_remote(client, f"cd {INSTALL_DIR} && git fetch origin main && git reset --hard origin/main")
    else:
        print("Clonando repositório limpo...")
        execute_remote(client, f"rm -rf {INSTALL_DIR}")
        execute_remote(client, f"git clone {REPO_URL} {INSTALL_DIR}")

    # 3. Configuração do Backend Python
    print("\n--- PASSO 3: Configurando Backend Python e Virtualenv ---")
    execute_remote(client, f"mkdir -p {INSTALL_DIR}/uploads/videos")
    execute_remote(client, f"test -d {INSTALL_DIR}/backend/venv || python3 -m venv {INSTALL_DIR}/backend/venv")
    execute_remote(client, f"{INSTALL_DIR}/backend/venv/bin/pip install --upgrade pip -q")
    execute_remote(client, f"{INSTALL_DIR}/backend/venv/bin/pip install -r {INSTALL_DIR}/backend/requirements.txt -q")

    # Cria .env com credenciais do PostgreSQL
    env_content = """PROJECT_NAME="SmartTV Manager"
DB_USER=postgres
DB_PASSWORD=6ffdd4a3d0e99d78b1e15f411b04e323
DB_HOST=192.168.168.26
DB_PORT=5432
DB_NAME=smarttv
"""
    execute_remote(client, f"cat << 'EOF' > {INSTALL_DIR}/backend/.env\n{env_content}\nEOF")

    # 4. Build do Frontend
    print("\n--- PASSO 4: Instalando dependências e compilando o Frontend React ---")
    execute_remote(client, f"cd {INSTALL_DIR}/frontend && npm install --silent && npm run build")

    # 5. Configuração do Serviço Systemd
    print("\n--- PASSO 5: Criando e ativando serviço Systemd (smarttv-backend) ---")
    service_content = f"""[Unit]
Description=SmartTV Manager Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={INSTALL_DIR}/backend
ExecStart={INSTALL_DIR}/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
EnvironmentFile={INSTALL_DIR}/backend/.env

[Install]
WantedBy=multi-user.target
"""
    execute_remote(client, f"cat << 'EOF' > /etc/systemd/system/smarttv-backend.service\n{service_content}\nEOF")
    execute_remote(client, "systemctl daemon-reload")
    execute_remote(client, "systemctl enable smarttv-backend")
    execute_remote(client, "systemctl restart smarttv-backend")

    # 6. Configuração do Nginx (Porta 80 padrão, URLs amigáveis sem portas expostas)
    print("\n--- PASSO 6: Configurando Nginx Reverse Proxy ---")
    nginx_conf = f"""server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 1000M;

    # Frontend estático compilado
    root {INSTALL_DIR}/frontend/dist;
    index index.html;

    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # API REST
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

    # WebSockets para atualizações em tempo real
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

    # Swagger Docs
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
    execute_remote(client, f"cat << 'EOF' > /etc/nginx/sites-available/smarttv\n{nginx_conf}\nEOF")
    execute_remote(client, "rm -f /etc/nginx/sites-enabled/default")
    execute_remote(client, "ln -sf /etc/nginx/sites-available/smarttv /etc/nginx/sites-enabled/smarttv")
    execute_remote(client, "nginx -t")
    execute_remote(client, "systemctl restart nginx")

    # 7. Configura script de update global
    print("\n--- PASSO 7: Configurando comando de atualização 'smarttv-update' ---")
    execute_remote(client, f"chmod +x {INSTALL_DIR}/server_update.sh")
    execute_remote(client, f"ln -sf {INSTALL_DIR}/server_update.sh /usr/local/bin/smarttv-update")

    # 8. Testes finais de conectividade local
    print("\n--- PASSO 8: Validando funcionamento do sistema no servidor ---")
    execute_remote(client, "sleep 2")
    execute_remote(client, "systemctl is-active smarttv-backend")
    execute_remote(client, "systemctl is-active nginx")
    execute_remote(client, "curl -sI http://127.0.0.1/ | head -n 4")
    execute_remote(client, "curl -s http://127.0.0.1/api/tvs | head -c 250; echo ''")

    print("\n==================================================================")
    print("           IMPLANTAÇÃO NO SERVIDOR CONCLUÍDA COM SUCESSO!         ")
    print("==================================================================")
    print(f"URL de Acesso ao Painel: http://{HOSTNAME}/  ou  http://192.168.168.27/")
    print(f"API & Swagger:            http://{HOSTNAME}/docs")
    print(f"Comando para atualizar:   smarttv-update (no terminal do servidor)")
    print("==================================================================")

    client.close()

if __name__ == "__main__":
    main()
