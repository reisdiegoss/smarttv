import hashlib
import hmac
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schema import AuditLog

SECRET_KEY = "fasano-smarttv-manager-secure-salt-key-2026"

def hash_password(password: str) -> str:
    """Hashes a password with HMAC SHA256 and salt."""
    salt = "fasano_salt_"
    return hmac.new(SECRET_KEY.encode(), (salt + password).encode(), hashlib.sha256).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against its hash."""
    return hmac.compare_digest(hash_password(plain_password), hashed_password)

def get_client_ip(request: Request) -> str:
    """Extrai o IP real do cliente mesmo operando atrás de Proxy Reverso Nginx."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Pega o primeiro IP da cadeia (IP real de quem originou o request)
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

FIELD_LABELS = {
    "name": "Nome da TV",
    "room_group": "Setor / Quarto",
    "layout_id": "Modelo de Layout",
    "playlist_id": "Playlist de Vídeos",
    "hdmi_input_id": "Porta HDMI Sky",
    "hdmi_label": "Rótulo do Canal Sky",
    "selected_shortcuts": "Atalhos Habilitados",
    "custom_settings": "Configurações (Wi-Fi/Boas-Vindas)",
    "description": "Descrição",
    "loop_playback": "Modo Repetição (Loop)",
    "is_active": "Ativo / Inativo",
    "title": "Título",
    "file_size": "Tamanho do Arquivo",
    "username": "Nome de Usuário",
    "role": "Perfil de Acesso"
}

def compute_diff(old_dict: Dict[str, Any], new_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compara o estado anterior e o novo estado para gerar uma lista legível de diferenças."""
    diff = []
    all_keys = set(old_dict.keys()).union(set(new_dict.keys()))

    # Chaves internas ignoradas no diff
    ignored = {"id", "created_at", "updated_at", "last_ping", "is_online", "device_id", "pairing_code"}

    for key in sorted(all_keys):
        if key in ignored:
            continue
        old_val = old_dict.get(key)
        new_val = new_dict.get(key)

        if old_val != new_val:
            diff.append({
                "field": key,
                "label": FIELD_LABELS.get(key, key),
                "before": old_val,
                "after": new_val
            })
    return diff

async def record_audit_log(
    db: AsyncSession,
    request: Request,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    username: str = "admin",
    user_id: Optional[int] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None
) -> AuditLog:
    """Grava o registro de auditoria completo no banco de dados PostgreSQL."""
    old_vals = old_values or {}
    new_vals = new_values or {}
    diff_summary = compute_diff(old_vals, new_vals)

    ip_address = get_client_ip(request)

    # Se a descrição não foi explicitamente fornecida, monta um resumo legível
    if not description:
        if action == "TV_UPDATE":
            changed_labels = [d["label"] for d in diff_summary]
            description = f"TV '{entity_name or entity_id}' atualizada. Campos modificados: {', '.join(changed_labels) if changed_labels else 'nenhum'}"
        elif action == "TV_CREATE":
            description = f"Nova TV '{entity_name}' cadastrada com ID {entity_id}"
        elif action == "TV_DELETE":
            description = f"TV '{entity_name}' (ID {entity_id}) foi removida do sistema"
        elif action == "TV_CLAIM":
            description = f"TV pareada com sucesso com o nome '{entity_name}'"
        elif action == "PLAYLIST_CREATE":
            description = f"Playlist '{entity_name}' criada"
        elif action == "PLAYLIST_UPDATE":
            description = f"Playlist '{entity_name}' atualizada"
        elif action == "PLAYLIST_DELETE":
            description = f"Playlist '{entity_name}' excluída"
        elif action == "MEDIA_UPLOAD":
            description = f"Upload do arquivo de vídeo '{entity_name}'"
        elif action == "MEDIA_DELETE":
            description = f"Arquivo de vídeo '{entity_name}' removido"
        elif action == "AUTH_LOGIN":
            description = f"Login efetuado com sucesso pelo usuário '{username}'"
        else:
            description = f"Ação {action} realizada em {entity} ({entity_name or entity_id})"

    log = AuditLog(
        user_id=user_id,
        username=username,
        ip_address=ip_address,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        entity_name=entity_name,
        description=description,
        old_values=old_vals,
        new_values=new_vals,
        diff_summary=diff_summary,
        created_at=datetime.utcnow()
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log
