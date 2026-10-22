import socket
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.schema import SmartTV, DeviceLog
from app.services.fias_service import fias_service
from app.services.audit import record_audit_log

router = APIRouter(prefix="/pms", tags=["PMS Hospitality Integration (IFC8 / FIAS)"])

class ManualPMSSyncRequest(BaseModel):
    uh_number: str
    guest_name: Optional[str] = None
    welcome_title: Optional[str] = None
    welcome_subtitle: Optional[str] = None
    action: str = "CHECK_IN" # CHECK_IN, CHECK_OUT

@router.get("/status")
def get_pms_status():
    """Retorna o status da conexão em tempo real com o servidor IFC8 (192.168.162.18)"""
    return fias_service.get_status()

@router.post("/test-connection")
def test_ifc8_connection(host: str = "192.168.162.18", port: int = 5020):
    """Testa a conectividade direta TCP com a porta FIAS do servidor IFC8"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4.0)
        start = datetime.now()
        s.connect((host, port))
        latency_ms = int((datetime.now() - start).total_seconds() * 1000)
        
        banner = ""
        try:
            raw = s.recv(512)
            banner = repr(raw)
        except Exception:
            banner = "Conectado (sem banner imediato)"
        s.close()

        return {
            "status": "success",
            "host": host,
            "port": port,
            "latency_ms": latency_ms,
            "banner": banner,
            "message": f"Conexão com servidor IFC8 {host}:{port} realizada com sucesso em {latency_ms}ms!"
        }
    except Exception as e:
        return {
            "status": "error",
            "host": host,
            "port": port,
            "message": f"Falha ao conectar no IFC8 ({host}:{port}): {str(e)}"
        }

@router.post("/sync-uh")
async def manual_sync_uh(payload: ManualPMSSyncRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Vincula ou desvincula manualmente um hóspede a uma UH (Quarto)"""
    clean_uh = payload.uh_number.strip()
    result = await db.execute(select(SmartTV))
    tvs = result.scalars().all()

    target_tv = None
    for tv in tvs:
        if tv.uh_number and tv.uh_number.strip().lower() == clean_uh.lower():
            target_tv = tv
            break
        cust = tv.custom_settings or {}
        if str(cust.get("uh_number") or "").strip().lower() == clean_uh.lower():
            target_tv = tv
            break
        if clean_uh.lower() in tv.name.lower():
            target_tv = tv
            break

    if not target_tv:
        raise HTTPException(status_code=404, detail=f"Nenhuma TV vinculada à UH '{clean_uh}'")

    current_settings = dict(target_tv.custom_settings or {})
    current_settings["uh_number"] = clean_uh

    is_checkin = payload.action.upper() != "CHECK_OUT" and bool(payload.guest_name)
    if is_checkin and payload.guest_name:
        clean_guest = payload.guest_name.strip()
        target_tv.guest_name = clean_guest
        target_tv.uh_number = clean_uh
        current_settings["guest_name"] = clean_guest
        current_settings["welcome_title"] = payload.welcome_title or f"Sr(a). {clean_guest}, Bem-vindo(a) ao Fasano"
    else:
        target_tv.guest_name = None
        target_tv.uh_number = clean_uh
        current_settings.pop("guest_name", None)
        current_settings["welcome_title"] = payload.welcome_title or "Seja Bem-vindo(a) ao Fasano"

    if payload.welcome_subtitle:
        current_settings["welcome_subtitle"] = payload.welcome_subtitle

    target_tv.custom_settings = current_settings
    target_tv.updated_at = datetime.utcnow()

    action_label = "CHECK_IN" if is_checkin else "CHECK_OUT"
    log = DeviceLog(
        tv_id=target_tv.id,
        event_type=f"PMS_{action_label}",
        message=f"PMS Sync: UH {clean_uh} -> '{target_tv.guest_name or 'Quarto Vago'}'"
    )
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action=f"PMS_{action_label}",
        entity="SmartTV",
        entity_id=str(target_tv.id),
        entity_name=target_tv.name,
        description=f"UH {clean_uh} sincronizada com hóspede '{target_tv.guest_name or 'Quarto Vago'}'"
    )

    await db.commit()
    await db.refresh(target_tv)

    return {
        "status": "ok",
        "message": f"UH {clean_uh} atualizada com sucesso",
        "tv_id": target_tv.id,
        "tv_name": target_tv.name,
        "uh_number": clean_uh,
        "guest_name": target_tv.guest_name
    }

@router.post("/toggle-listener")
def toggle_fias_listener(enabled: bool):
    """Liga ou desliga o ouvinte contínuo FIAS no servidor IFC8"""
    if enabled:
        fias_service.start()
        return {"status": "started", "message": "Ouvinte FIAS iniciado para 192.168.162.18:5020"}
    else:
        fias_service.stop()
        return {"status": "stopped", "message": "Ouvinte FIAS interrompido"}
