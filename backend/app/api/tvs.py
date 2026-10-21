import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.schema import SmartTV, LayoutPreset, Playlist, PlaylistItem, AppShortcut, DeviceLog
from app.services.audit import record_audit_log
from app.models.dto import (
    SmartTVOut, SmartTVCreate, SmartTVUpdate,
    SmartTVPairRequest, SmartTVClaimRequest, SmartTVPingRequest,
    SmartTVBindRequest, SmartTVQuickUpdateRequest, TVClientConfig
)

router = APIRouter(prefix="/tvs", tags=["Smart TVs"])

def generate_pairing_code() -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=2))
    numbers = "".join(random.choices(string.digits, k=4))
    return f"{letters}-{numbers}"

@router.get("", response_model=List[SmartTVOut])
async def list_tvs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .order_by(SmartTV.name.asc())
    )
    tvs = result.scalars().all()
    
    # Check online status based on last ping (within last 90 seconds)
    now = datetime.utcnow()
    for tv in tvs:
        if tv.last_ping:
            tv.is_online = (now - tv.last_ping) < timedelta(seconds=90)
        else:
            tv.is_online = False
            
    return tvs

@router.post("", response_model=SmartTVOut, status_code=status.HTTP_201_CREATED)
async def create_tv(payload: SmartTVCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # Check if device_id already exists
    existing = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Dispositivo com este ID já cadastrado")

    tv = SmartTV(
        device_id=payload.device_id,
        name=payload.name,
        room_group=payload.room_group or "Geral",
        ip_address=payload.ip_address,
        mac_address=payload.mac_address,
        layout_id=payload.layout_id,
        playlist_id=payload.playlist_id,
        hdmi_input_id=payload.hdmi_input_id or "HDMI 1",
        hdmi_label=payload.hdmi_label or "TV SKY",
        selected_shortcuts=payload.selected_shortcuts or [],
        custom_settings=payload.custom_settings or {},
        is_paired=True
    )
    db.add(tv)
    await db.commit()

    # Grava auditoria
    await record_audit_log(
        db=db,
        request=request,
        action="TV_CREATE",
        entity="SmartTV",
        entity_id=str(tv.id),
        entity_name=tv.name,
        new_values={
            "name": tv.name,
            "room_group": tv.room_group,
            "layout_id": tv.layout_id,
            "playlist_id": tv.playlist_id,
            "hdmi_input_id": tv.hdmi_input_id,
            "hdmi_label": tv.hdmi_label,
            "selected_shortcuts": tv.selected_shortcuts,
            "custom_settings": tv.custom_settings
        }
    )

    result = await db.execute(
        select(SmartTV)
        .options(selectinload(SmartTV.layout), selectinload(SmartTV.playlist))
        .where(SmartTV.id == tv.id)
    )
    return result.scalar_one()

@router.get("/{tv_id}", response_model=SmartTVOut)
async def get_tv(tv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.id == tv_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")
    
    if tv.last_ping:
        tv.is_online = (datetime.utcnow() - tv.last_ping) < timedelta(seconds=90)
    else:
        tv.is_online = False

    return tv

@router.put("/{tv_id}", response_model=SmartTVOut)
async def update_tv(tv_id: int, payload: SmartTVUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(selectinload(SmartTV.layout), selectinload(SmartTV.playlist))
        .where(SmartTV.id == tv_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    # Captura o estado anterior ("O que era antes")
    old_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "layout_id": tv.layout_id,
        "playlist_id": tv.playlist_id,
        "hdmi_input_id": tv.hdmi_input_id,
        "hdmi_label": tv.hdmi_label,
        "selected_shortcuts": list(tv.selected_shortcuts or []),
        "custom_settings": dict(tv.custom_settings or {})
    }

    if payload.name is not None:
        tv.name = payload.name
    if payload.room_group is not None:
        tv.room_group = payload.room_group
    if payload.layout_id is not None:
        tv.layout_id = payload.layout_id
    if payload.playlist_id is not None:
        tv.playlist_id = payload.playlist_id
    if payload.hdmi_input_id is not None:
        tv.hdmi_input_id = payload.hdmi_input_id
    if payload.hdmi_label is not None:
        tv.hdmi_label = payload.hdmi_label
    if payload.selected_shortcuts is not None:
        tv.selected_shortcuts = payload.selected_shortcuts
    if payload.custom_settings is not None:
        # merge settings
        current = dict(tv.custom_settings or {})
        current.update(payload.custom_settings)
        tv.custom_settings = current

    tv.updated_at = datetime.utcnow()
    await db.commit()

    # Captura o novo estado ("O que foi alterado")
    new_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "layout_id": tv.layout_id,
        "playlist_id": tv.playlist_id,
        "hdmi_input_id": tv.hdmi_input_id,
        "hdmi_label": tv.hdmi_label,
        "selected_shortcuts": list(tv.selected_shortcuts or []),
        "custom_settings": dict(tv.custom_settings or {})
    }

    # Grava auditoria detalhada com IP, Data, Hora, Antes e Depois
    await record_audit_log(
        db=db,
        request=request,
        action="TV_UPDATE",
        entity="SmartTV",
        entity_id=str(tv.id),
        entity_name=tv.name,
        old_values=old_values,
        new_values=new_values
    )

    result = await db.execute(
        select(SmartTV)
        .options(selectinload(SmartTV.layout), selectinload(SmartTV.playlist))
        .where(SmartTV.id == tv.id)
    )
    return result.scalar_one()

@router.delete("/{tv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tv(tv_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.id == tv_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    old_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "device_id": tv.device_id,
        "ip_address": tv.ip_address,
        "hdmi_input_id": tv.hdmi_input_id
    }

    await record_audit_log(
        db=db,
        request=request,
        action="TV_DELETE",
        entity="SmartTV",
        entity_id=str(tv.id),
        entity_name=tv.name,
        old_values=old_values,
        new_values={}
    )

    await db.delete(tv)
    await db.commit()
    return None

# Pairing Endpoint (Called by Android TV APK on startup if not paired)
@router.post("/pair-request")
async def pair_request(payload: SmartTVPairRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id))
    tv = result.scalar_one_or_none()

    if not tv:
        code = payload.pairing_code or generate_pairing_code()
        tv = SmartTV(
            device_id=payload.device_id,
            name=f"Smart TV ({code})",
            pairing_code=code,
            is_paired=False,
            is_online=True,
            ip_address=payload.ip_address,
            mac_address=payload.mac_address,
            app_version=payload.app_version or "1.0.0",
            last_ping=datetime.utcnow()
        )
        db.add(tv)
        await db.commit()
        await db.refresh(tv)
    else:
        # Update ping & IP
        tv.ip_address = payload.ip_address or tv.ip_address
        tv.last_ping = datetime.utcnow()
        tv.is_online = True
        await db.commit()

    return {
        "device_id": tv.device_id,
        "pairing_code": tv.pairing_code,
        "is_paired": tv.is_paired,
        "name": tv.name
    }

# Claim Endpoint (Called by Admin in Dashboard to approve and assign a TV)
@router.post("/claim")
async def claim_tv(payload: SmartTVClaimRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.pairing_code == payload.pairing_code.strip().upper()))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="Código de pareamento não encontrado")

    old_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "is_paired": tv.is_paired,
        "layout_id": tv.layout_id,
        "playlist_id": tv.playlist_id,
        "hdmi_input_id": tv.hdmi_input_id,
        "hdmi_label": tv.hdmi_label
    }

    tv.name = payload.name
    tv.room_group = payload.room_group or tv.room_group
    tv.layout_id = payload.layout_id
    tv.playlist_id = payload.playlist_id
    tv.hdmi_input_id = payload.hdmi_input_id or "HDMI 1"
    tv.hdmi_label = payload.hdmi_label or "TV SKY"
    if payload.selected_shortcuts:
        tv.selected_shortcuts = payload.selected_shortcuts
    tv.is_paired = True
    tv.updated_at = datetime.utcnow()

    new_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "is_paired": tv.is_paired,
        "layout_id": tv.layout_id,
        "playlist_id": tv.playlist_id,
        "hdmi_input_id": tv.hdmi_input_id,
        "hdmi_label": tv.hdmi_label
    }

    # Log device pair
    log = DeviceLog(tv_id=tv.id, event_type="PAIR", message=f"TV pareada com o nome '{tv.name}'")
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action="TV_CLAIM",
        entity="SmartTV",
        entity_id=str(tv.id),
        entity_name=tv.name,
        description=f"TV pareada e ativada pelo código '{payload.pairing_code}' com o nome '{tv.name}'",
        old_values=old_values,
        new_values=new_values
    )

    await db.commit()
    await db.refresh(tv)
    return {"message": "TV pareada com sucesso!", "tv_id": tv.id, "name": tv.name}

# Direct Bind Endpoint (Called by Android TV APK when user selects room from list on TV)
@router.post("/bind-device")
async def bind_device(payload: SmartTVBindRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.id == payload.tv_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    # Se já existir alguma TV órfã/temporária com o mesmo device_id (diferente desta), deleta
    existing = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id, SmartTV.id != payload.tv_id))
    for old_tv in existing.scalars().all():
        await db.delete(old_tv)

    tv.device_id = payload.device_id
    tv.is_paired = True
    tv.is_online = True
    tv.last_ping = datetime.utcnow()
    if payload.ip_address:
        tv.ip_address = payload.ip_address
    if payload.app_version:
        tv.app_version = payload.app_version

    # Log device pair
    log = DeviceLog(tv_id=tv.id, event_type="BIND", message=f"TV vinculada diretamente pelo controle ao perfil '{tv.name}'")
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action="TV_BIND",
        entity="SmartTV",
        entity_id=str(tv.id),
        entity_name=tv.name,
        description=f"TV vinculada diretamente pelo controle remoto ao perfil '{tv.name}' (DeviceID: {payload.device_id})"
    )

    await db.commit()
    await db.refresh(tv)
    return {"status": "ok", "message": f"TV vinculada a {tv.name}", "device_id": tv.device_id, "tv_id": tv.id}

# Heartbeat Ping from APK (returns updated_at so TV reloads in real-time if changed in dashboard)
@router.post("/ping")
async def tv_ping(payload: SmartTVPingRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    tv.last_ping = datetime.utcnow()
    tv.is_online = True
    if payload.ip_address:
        tv.ip_address = payload.ip_address
    if payload.app_version:
        tv.app_version = payload.app_version

    await db.commit()
    return {
        "status": "ok",
        "is_paired": tv.is_paired,
        "updated_at": tv.updated_at.isoformat() if tv.updated_at else None,
        "server_time": datetime.utcnow()
    }

# Quick Update from TV remote control (HDMI port, label, or shortcuts toggled on screen)
@router.post("/quick-update")
async def quick_update(payload: SmartTVQuickUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    if payload.hdmi_input_id is not None:
        tv.hdmi_input_id = payload.hdmi_input_id
    if payload.hdmi_label is not None:
        tv.hdmi_label = payload.hdmi_label
    if payload.selected_shortcuts is not None:
        tv.selected_shortcuts = payload.selected_shortcuts

    tv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tv)
    return {"status": "ok", "message": "TV atualizada com sucesso", "tv_id": tv.id}

# Full Config Endpoint consumed by Android APK
@router.get("/config/{device_id}", response_model=TVClientConfig)
async def get_tv_client_config(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.device_id == device_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    # Load shortcuts
    shortcuts_data = []
    if tv.selected_shortcuts is not None:
        if len(tv.selected_shortcuts) > 0:
            sc_res = await db.execute(select(AppShortcut).where(AppShortcut.id.in_(tv.selected_shortcuts)))
            shortcuts = sc_res.scalars().all()
            sc_dict = {s.id: s for s in shortcuts}
            for sid in tv.selected_shortcuts:
                if sid in sc_dict:
                    s = sc_dict[sid]
                    shortcuts_data.append({
                        "id": s.id,
                        "name": s.name,
                        "package_name": s.package_name,
                        "icon_name": s.icon_name,
                        "is_hdmi": s.is_hdmi,
                        "is_system_app": s.is_system_app
                    })
        else:
            shortcuts_data = []
    else:
        # Fallback to default apps (non-HDMI)
        sc_res = await db.execute(select(AppShortcut).order_by(AppShortcut.default_order.asc()))
        shortcuts = sc_res.scalars().all()
        for s in shortcuts:
            shortcuts_data.append({
                "id": s.id,
                "name": s.name,
                "package_name": s.package_name,
                "icon_name": s.icon_name,
                "is_hdmi": s.is_hdmi,
                "is_system_app": s.is_system_app
            })

    # Playlist structure
    playlist_data = None
    if tv.playlist and tv.playlist.is_active:
        items = []
        for it in tv.playlist.items:
            if it.media:
                items.append({
                    "media_id": it.media.id,
                    "title": it.media.title,
                    "stream_url": f"/api/media/stream/{it.media.id}",
                    "file_size": it.media.file_size,
                    "duration": it.duration_override or it.media.duration,
                    "order_index": it.order_index
                })
        playlist_data = {
            "id": tv.playlist.id,
            "name": tv.playlist.name,
            "loop_playback": tv.playlist.loop_playback,
            "items": items
        }

    # Layout structure
    layout_data = None
    if tv.layout:
        layout_data = {
            "id": tv.layout.id,
            "name": tv.layout.name,
            "code": tv.layout.code,
            "config": tv.layout.config
        }

    is_hdmi_enabled = tv.hdmi_input_id not in ("NONE", "DISABLED", None, "") and not (tv.custom_settings or {}).get("hide_hdmi", False)

    return TVClientConfig(
        device_id=tv.device_id,
        name=tv.name,
        room_group=tv.room_group,
        is_paired=tv.is_paired,
        layout=layout_data,
        hdmi={
            "enabled": is_hdmi_enabled,
            "input_id": tv.hdmi_input_id if is_hdmi_enabled else "NONE",
            "label": tv.hdmi_label or "TV SKY",
            "action": "action.switch_hdmi"
        },
        shortcuts=shortcuts_data,
        playlist=playlist_data,
        custom_settings=tv.custom_settings or {},
        server_time=datetime.utcnow()
    )
