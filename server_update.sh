#!/bin/bash
set -e

REPO_DIR="/opt/smarttv"
cd "$REPO_DIR"

echo "=========================================================="
echo "  SMARTTV MANAGER - VERIFICAÇÃO E ATUALIZAÇÃO AUTOMÁTICA  "
echo "=========================================================="

echo "[1/4] Buscando atualizações no GitHub..."
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "O servidor já está na versão mais recente ($LOCAL). Nenhuma alteração necessária."
    exit 0
fi

echo "Nova versão disponível!"
echo ""
echo "=== ARQUIVOS ALTERADOS (DIFF) ==="
git diff --stat HEAD origin/main
echo "================================="
echo ""

echo "[2/4] Baixando atualizações (git pull)..."
git pull origin main

# Verifica se o frontend precisa de rebuild
if git diff --name-only "$LOCAL" HEAD | grep -q "^frontend/"; then
    echo "[3/4] Reconstruindo Frontend React / Vite..."
    cd "$REPO_DIR/frontend"
    if ! command -v npm &> /dev/null; then
        echo "Instalando Node.js / npm para o build..."
        apt-get install -y nodejs npm
    fi
    npm install --silent
    npm run build
    cd "$REPO_DIR"
else
    echo "[3/4] Nenhuma alteração no Frontend. Pulando rebuild."
fi

# Verifica se o backend precisa de novas dependências
if git diff --name-only "$LOCAL" HEAD | grep -q "^backend/requirements.txt"; then
    echo "Atualizando pacotes Python no virtualenv..."
    "$REPO_DIR/backend/venv/bin/pip" install -r "$REPO_DIR/backend/requirements.txt"
fi

echo "[4/4] Reiniciando serviços..."
systemctl restart smarttv-backend
systemctl reload nginx

echo ""
echo "=========================================================="
echo "       ATUALIZAÇÃO DO SERVIDOR CONCLUÍDA COM SUCESSO!     "
echo "=========================================================="
systemctl status smarttv-backend --no-pager | head -n 12
