import random
import string
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.schema import SmartTV, TVGroup, LayoutPreset, Playlist, PlaylistItem, AppShortcut, DeviceLog
from app.services.audit import record_audit_log
from app.services.weather_service import weather_service
from app.models.dto import (
    SmartTVOut, SmartTVCreate, SmartTVUpdate,
    SmartTVPairRequest, SmartTVClaimRequest, SmartTVPingRequest,
    SmartTVBindRequest, SmartTVQuickUpdateRequest, SmartTVAssignDeviceRequest, TVClientConfig,
    SmartTVPmsSyncRequest, TVGroupOut
)

router = APIRouter(prefix="/tvs", tags=["Smart TVs"])

@router.get("/weather")
@router.get("/weather/{city_name}")
async def get_city_weather(city_name: Optional[str] = None, city: Optional[str] = None):
    """Retorna a previsão do tempo em tempo real para qualquer município via Open-Meteo API"""
    target = city_name or city or "Salvador"
    return await weather_service.get_city_weather(target)

@router.get("/weather/salvador")
async def get_current_salvador_weather():
    """Retorna a previsão do tempo em tempo real para Salvador-BA via Open-Meteo"""
    return await weather_service.get_salvador_weather()

def generate_pairing_code() -> str:
    letters = "".join(random.choices(string.ascii_uppercase, k=2))
    numbers = "".join(random.choices(string.digits, k=4))
    return f"{letters}-{numbers}"

@router.get("", response_model=List[SmartTVOut])
async def list_tvs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist),
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
        tv.group_name = tv.group.name if tv.group else None
            
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
        group_id=payload.group_id,
        uh_number=payload.uh_number,
        guest_name=payload.guest_name,
        pms_enabled=payload.pms_enabled,
        pin_code=payload.pin_code,
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
            "group_id": tv.group_id,
            "uh_number": tv.uh_number,
            "guest_name": tv.guest_name,
            "pin_code": tv.pin_code,
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
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist),
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.id == tv.id)
    )
    new_tv = result.scalar_one()
    new_tv.group_name = new_tv.group.name if new_tv.group else None
    return new_tv

@router.get("/{tv_id}", response_model=SmartTVOut)
async def get_tv(tv_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist),
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
    tv.group_name = tv.group.name if tv.group else None

    return tv

@router.put("/{tv_id}", response_model=SmartTVOut)
async def update_tv(tv_id: int, payload: SmartTVUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist),
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.id == tv_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    # Captura o estado anterior ("O que era antes")
    old_values = {
        "name": tv.name,
        "room_group": tv.room_group,
        "group_id": tv.group_id,
        "uh_number": tv.uh_number,
        "guest_name": tv.guest_name,
        "pin_code": tv.pin_code,
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
    if "group_id" in payload.model_fields_set:
        tv.group_id = payload.group_id
    if payload.uh_number is not None:
        tv.uh_number = payload.uh_number.strip()
        current = dict(tv.custom_settings or {})
        current["uh_number"] = tv.uh_number
        tv.custom_settings = current
    if payload.guest_name is not None:
        tv.guest_name = payload.guest_name.strip()
        current = dict(tv.custom_settings or {})
        if tv.guest_name:
            current["guest_name"] = tv.guest_name
            current["welcome_title"] = f"Sr(a). {tv.guest_name}, Bem-vindo(a) ao Fasano"
        else:
            current.pop("guest_name", None)
            current["welcome_title"] = "Seja Bem-vindo(a) ao Fasano"
        tv.custom_settings = current
    if "pms_enabled" in payload.model_fields_set and payload.pms_enabled is not None:
        tv.pms_enabled = payload.pms_enabled
    if payload.pin_code is not None:
        tv.pin_code = payload.pin_code.strip()
        current = dict(tv.custom_settings or {})
        current["pin_code"] = tv.pin_code
        tv.custom_settings = current
    if "layout_id" in payload.model_fields_set:
        tv.layout_id = payload.layout_id
    if "playlist_id" in payload.model_fields_set:
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
    if payload.device_id is not None and payload.device_id != tv.device_id:
        existing_dev = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id, SmartTV.id != tv.id))
        for old_tv in existing_dev.scalars().all():
            if old_tv.ip_address and not tv.ip_address:
                tv.ip_address = old_tv.ip_address
            if old_tv.app_version and not tv.app_version:
                tv.app_version = old_tv.app_version
            if old_tv.mac_address and not tv.mac_address:
                tv.mac_address = old_tv.mac_address
            if old_tv.pairing_code and not tv.pairing_code:
                tv.pairing_code = old_tv.pairing_code

            await db.execute(update(DeviceLog).where(DeviceLog.tv_id == old_tv.id).values(tv_id=tv.id))
            old_tv.device_id = f"TEMP-DEL-{old_tv.id}-{uuid.uuid4().hex[:6]}"
            old_tv.pairing_code = None
            await db.flush()
            await db.delete(old_tv)
            await db.flush()
        tv.device_id = payload.device_id
        tv.is_paired = True
    if payload.pairing_code is not None:
        clean_code = payload.pairing_code.strip().upper()
        if clean_code and clean_code != tv.pairing_code:
            existing_code = await db.execute(select(SmartTV).where(SmartTV.pairing_code == clean_code, SmartTV.id != tv.id))
            for old_tv in existing_code.scalars().all():
                if old_tv.device_id and not tv.device_id:
                    tv.device_id = old_tv.device_id
                if old_tv.ip_address and not tv.ip_address:
                    tv.ip_address = old_tv.ip_address
                if old_tv.mac_address and not tv.mac_address:
                    tv.mac_address = old_tv.mac_address

                await db.execute(update(DeviceLog).where(DeviceLog.tv_id == old_tv.id).values(tv_id=tv.id))
                old_tv.device_id = f"TEMP-DEL-{old_tv.id}-{uuid.uuid4().hex[:6]}"
                old_tv.pairing_code = None
                await db.flush()
                await db.delete(old_tv)
                await db.flush()
            tv.pairing_code = clean_code
            tv.is_paired = True
    if payload.is_paired is not None:
        tv.is_paired = payload.is_paired

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
        "custom_settings": dict(tv.custom_settings or {}),
        "device_id": tv.device_id,
        "pairing_code": tv.pairing_code,
        "is_paired": tv.is_paired
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
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist),
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.id == tv.id)
    )
    updated_tv = result.scalar_one()
    updated_tv.group_name = updated_tv.group.name if updated_tv.group else None
    if updated_tv.last_ping:
        updated_tv.is_online = (datetime.utcnow() - updated_tv.last_ping) < timedelta(seconds=90)
    else:
        updated_tv.is_online = False
    return updated_tv

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

    # Se já existir alguma TV órfã/temporária com o mesmo device_id (diferente desta),
    # precisamos liberar a UNIQUE constraint ix_smart_tvs_device_id antes de atualizar esta TV
    existing = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id, SmartTV.id != payload.tv_id))
    for old_tv in existing.scalars().all():
        if old_tv.pairing_code and not tv.pairing_code:
            tv.pairing_code = old_tv.pairing_code
        if old_tv.mac_address and not tv.mac_address:
            tv.mac_address = old_tv.mac_address
        if old_tv.ip_address and not payload.ip_address:
            tv.ip_address = old_tv.ip_address

        # Reatribui logs da TV temporária para a TV vinculada
        await db.execute(
            update(DeviceLog).where(DeviceLog.tv_id == old_tv.id).values(tv_id=tv.id)
        )

        # Modifica o device_id e pairing_code da temporária para liberar o índice UNIQUE
        old_tv.device_id = f"TEMP-DEL-{old_tv.id}-{uuid.uuid4().hex[:6]}"
        old_tv.pairing_code = None
        await db.flush()

        await db.delete(old_tv)
        await db.flush()

    tv.device_id = payload.device_id
    tv.is_paired = True
    tv.is_online = True
    tv.last_ping = datetime.utcnow()
    tv.updated_at = datetime.utcnow()
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

# Assign Device Endpoint (Called by Dashboard to associate a detected PIN/DeviceID to an existing TV profile)
@router.post("/assign-device")
async def assign_device(payload: SmartTVAssignDeviceRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SmartTV).where(SmartTV.id == payload.target_tv_id))
    target_tv = result.scalar_one_or_none()
    if not target_tv:
        raise HTTPException(status_code=404, detail="TV de destino não encontrada")

    source_tv = None
    if payload.pairing_code:
        code = payload.pairing_code.strip().upper()
        res_code = await db.execute(select(SmartTV).where(SmartTV.pairing_code == code, SmartTV.id != target_tv.id))
        source_tv = res_code.scalar_one_or_none()
    elif payload.device_id:
        res_dev = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id.strip(), SmartTV.id != target_tv.id))
        source_tv = res_dev.scalar_one_or_none()

    if source_tv:
        saved_device_id = source_tv.device_id
        saved_pairing_code = source_tv.pairing_code
        target_tv.ip_address = source_tv.ip_address or target_tv.ip_address
        target_tv.mac_address = source_tv.mac_address or target_tv.mac_address
        target_tv.app_version = source_tv.app_version or target_tv.app_version
        target_tv.is_online = source_tv.is_online
        target_tv.last_ping = source_tv.last_ping
        target_tv.is_paired = True
        target_tv.updated_at = datetime.utcnow()

        # Reatribui logs da source_tv para target_tv
        await db.execute(
            update(DeviceLog).where(DeviceLog.tv_id == source_tv.id).values(tv_id=target_tv.id)
        )

        # Libera UNIQUE constraints da source_tv antes de deletar
        source_tv.device_id = f"TEMP-DEL-{source_tv.id}-{uuid.uuid4().hex[:6]}"
        source_tv.pairing_code = None
        await db.flush()

        await db.delete(source_tv)
        await db.flush()

        target_tv.device_id = saved_device_id
        if saved_pairing_code:
            target_tv.pairing_code = saved_pairing_code
    else:
        # Se foi fornecido device_id, limpa qualquer conflito com outras TVs
        if payload.device_id:
            dev_id_clean = payload.device_id.strip()
            conflicts = await db.execute(select(SmartTV).where(SmartTV.device_id == dev_id_clean, SmartTV.id != target_tv.id))
            for c in conflicts.scalars().all():
                c.device_id = f"TEMP-DEL-{c.id}-{uuid.uuid4().hex[:6]}"
                c.pairing_code = None
                await db.flush()
                await db.delete(c)
                await db.flush()
            target_tv.device_id = dev_id_clean

        if payload.pairing_code:
            target_tv.pairing_code = payload.pairing_code.strip().upper()
        target_tv.is_paired = True
        target_tv.updated_at = datetime.utcnow()

    # Log device pair
    log = DeviceLog(tv_id=target_tv.id, event_type="ASSIGN", message=f"Dispositivo {target_tv.device_id} atribuído ao perfil '{target_tv.name}'")
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action="TV_ASSIGN",
        entity="SmartTV",
        entity_id=str(target_tv.id),
        entity_name=target_tv.name,
        description=f"TV '{target_tv.name}' atribuída com sucesso ao dispositivo {target_tv.device_id}"
    )

    await db.commit()
    await db.refresh(target_tv)
    return {
        "status": "ok",
        "message": f"TV '{target_tv.name}' vinculada com sucesso ao dispositivo {target_tv.device_id}!",
        "tv_id": target_tv.id,
        "device_id": target_tv.device_id,
        "name": target_tv.name
    }

# Heartbeat Ping from APK (returns updated_at so TV reloads in real-time if changed in dashboard)
@router.post("/ping")
async def tv_ping(payload: SmartTVPingRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(selectinload(SmartTV.group))
        .where(SmartTV.device_id == payload.device_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    tv.last_ping = datetime.utcnow()
    tv.is_online = True
    if payload.ip_address:
        tv.ip_address = payload.ip_address
    if payload.app_version:
        tv.app_version = payload.app_version

    # Limpeza de dados de apps pós-checkout confirmada pelo APK
    if payload.cleanup_completed:
        tc = dict(tv.custom_settings or {})
        if tc.get("checkout_cleanup_pending"):
            tc["checkout_cleanup_pending"] = False
            tv.custom_settings = tc
            log = DeviceLog(
                tv_id=tv.id,
                event_type="APP_CLEANUP",
                message="Limpeza de dados e cache de apps (Netflix, YouTube, Prime, etc.) concluída com sucesso na TV após checkout"
            )
            db.add(log)

    effective_updated_at = tv.updated_at
    if tv.group and tv.group.updated_at:
        if not effective_updated_at or tv.group.updated_at > effective_updated_at:
            effective_updated_at = tv.group.updated_at

    await db.commit()
    return {
        "status": "ok",
        "is_paired": tv.is_paired,
        "updated_at": effective_updated_at.isoformat() if effective_updated_at else None,
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

# PMS Hospitality Integration Endpoint (Sincronização de UH e Hóspede via Sistema Externo)
@router.post("/pms-sync")
async def pms_sync_guest(payload: SmartTVPmsSyncRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Endpoint de Integração para sistemas PMS de Hotel (Opera, Totvs, CMNet, Desbravador, etc.).
    Recebe a UH e o Nome do Hóspede para atualizar a TV do quarto em tempo real.
    """
    clean_uh = payload.uh_number.strip()
    result = await db.execute(select(SmartTV))
    tvs = result.scalars().all()

    target_tv = None
    for tv in tvs:
        cust = tv.custom_settings or {}
        tv_uh = str(cust.get("uh_number") or "").strip()
        if tv_uh and tv_uh.lower() == clean_uh.lower():
            target_tv = tv
            break
        # Fallback: se o nome ou grupo da TV contiver a UH (ex: "Quarto 101" ou "UH 101")
        if clean_uh.lower() in tv.name.lower() or (tv.room_group and clean_uh.lower() in tv.room_group.lower()):
            target_tv = tv
            break

    if not target_tv:
        raise HTTPException(status_code=404, detail=f"Nenhuma TV vinculada à UH '{payload.uh_number}'")

    current_settings = dict(target_tv.custom_settings or {})
    current_settings["uh_number"] = clean_uh
    if payload.guest_name is not None:
        clean_guest = payload.guest_name.strip()
        current_settings["guest_name"] = clean_guest
        if clean_guest:
            current_settings["welcome_title"] = payload.welcome_title or f"Sr(a). {clean_guest}, Bem-vindo(a) ao Fasano"
        else:
            current_settings["welcome_title"] = payload.welcome_title or "Seja Bem-vindo(a) ao Fasano"
    if payload.welcome_subtitle is not None:
        current_settings["welcome_subtitle"] = payload.welcome_subtitle

    target_tv.custom_settings = current_settings
    target_tv.updated_at = datetime.utcnow()

    log = DeviceLog(
        tv_id=target_tv.id,
        event_type="PMS_SYNC",
        message=f"Integração PMS: Hóspede '{payload.guest_name}' vinculado à UH {clean_uh}"
    )
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action="PMS_SYNC",
        entity="SmartTV",
        entity_id=str(target_tv.id),
        entity_name=target_tv.name,
        description=f"Hóspede '{payload.guest_name}' sincronizado com UH {clean_uh}"
    )

    await db.commit()
    await db.refresh(target_tv)
    return {
        "status": "ok",
        "message": f"TV da UH {clean_uh} atualizada com sucesso para {payload.guest_name}",
        "tv_id": target_tv.id,
        "tv_name": target_tv.name,
        "uh_number": clean_uh,
        "guest_name": payload.guest_name
    }

@router.get("/config/{device_id}", response_model=TVClientConfig)
async def get_tv_client_config(device_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SmartTV)
        .options(
            selectinload(SmartTV.group).selectinload(TVGroup.layout),
            selectinload(SmartTV.group).selectinload(TVGroup.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media),
            selectinload(SmartTV.layout),
            selectinload(SmartTV.playlist).selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .where(SmartTV.device_id == device_id)
    )
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    grp = tv.group

    # 1. Configurações Customizadas com Herança
    merged_settings = dict(grp.custom_settings or {}) if grp else {}
    merged_settings.update(dict(tv.custom_settings or {}))

    # Vinculação de UH e Hóspede (Integração PMS IFC8)
    if getattr(tv, 'pms_enabled', True):
        if tv.uh_number:
            merged_settings["uh_number"] = tv.uh_number
        if tv.guest_name:
            merged_settings["guest_name"] = tv.guest_name
            merged_settings["welcome_title"] = f"Sr(a). {tv.guest_name}, Bem-vindo(a) ao Fasano"
    else:
        # TV Institucional / Reunião / Setor (Sem PMS):
        # As mensagens são 100% fixas e manuais definidas na TV
        merged_settings.pop("guest_name", None)
        if (tv.custom_settings or {}).get("welcome_title"):
            merged_settings["welcome_title"] = tv.custom_settings["welcome_title"]
        if (tv.custom_settings or {}).get("welcome_subtitle"):
            merged_settings["welcome_subtitle"] = tv.custom_settings["welcome_subtitle"]

    # Senha de saída para launcher original (PIN do painel)
    effective_pin = tv.pin_code or merged_settings.get("pin_code") or (grp.custom_settings.get("pin_code") if grp and grp.custom_settings else "0000") or "0000"
    merged_settings["pin_code"] = effective_pin
    merged_settings["admin_exit_pin"] = effective_pin

    # 1.1 Clima em Tempo Real Automatizado por Cidade / Município via Open-Meteo API
    if merged_settings.get("show_weather") is not False:
        target_city = merged_settings.get("weather_city") or "Salvador"
        try:
            live_weather = await weather_service.get_city_weather(target_city)
            merged_settings["weather_city"] = live_weather.get("city", target_city)
            merged_settings["weather_temp"] = live_weather["temperature"]
            merged_settings["weather_condition"] = live_weather["condition"]
            merged_settings["weather_updated_at"] = live_weather["updated_at"]
        except Exception:
            pass

    # 2. Atalhos com Herança
    effective_shortcut_ids = None
    if tv.selected_shortcuts and len(tv.selected_shortcuts) > 0:
        effective_shortcut_ids = tv.selected_shortcuts
    elif grp and grp.selected_shortcuts and len(grp.selected_shortcuts) > 0:
        effective_shortcut_ids = grp.selected_shortcuts

    shortcuts_data = []
    if effective_shortcut_ids is not None:
        sc_res = await db.execute(select(AppShortcut).where(AppShortcut.id.in_(effective_shortcut_ids)))
        shortcuts = sc_res.scalars().all()
        sc_dict = {s.id: s for s in shortcuts}
        for sid in effective_shortcut_ids:
            if sid in sc_dict:
                s = sc_dict[sid]
                shortcuts_data.append({
                    "id": s.id,
                    "name": s.name,
                    "package_name": s.package_name,
                    "icon_name": s.icon_name,
                    "icon_url": s.icon_url,
                    "is_hdmi": s.is_hdmi,
                    "is_system_app": s.is_system_app
                })
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
                "icon_url": s.icon_url,
                "is_hdmi": s.is_hdmi,
                "is_system_app": s.is_system_app
            })

    # 3. Playlist com Herança
    effective_playlist = None
    if tv.playlist and tv.playlist.is_active:
        effective_playlist = tv.playlist
    elif grp and grp.playlist and grp.playlist.is_active:
        effective_playlist = grp.playlist

    playlist_data = None
    if effective_playlist:
        items = []
        for it in effective_playlist.items:
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
            "id": effective_playlist.id,
            "name": effective_playlist.name,
            "loop_playback": effective_playlist.loop_playback,
            "items": items
        }

    # 4. Layout com Herança
    effective_layout = tv.layout or (grp.layout if grp else None)
    if not effective_layout:
        default_l_res = await db.execute(select(LayoutPreset).order_by(LayoutPreset.id.asc()))
        effective_layout = default_l_res.scalars().first()

    layout_data = None
    if effective_layout:
        layout_data = {
            "id": effective_layout.id,
            "name": effective_layout.name,
            "code": effective_layout.code,
            "config": effective_layout.config
        }

    # 5. HDMI com Herança
    effective_hdmi_id = tv.hdmi_input_id if tv.hdmi_input_id is not None else (grp.hdmi_input_id if grp else "HDMI 1")
    effective_hdmi_label = tv.hdmi_label if tv.hdmi_label is not None else (grp.hdmi_label if grp else "TV SKY")
    is_hdmi_enabled = effective_hdmi_id not in ("NONE", "DISABLED", None, "") and not merged_settings.get("hide_hdmi", False)

    return TVClientConfig(
        device_id=tv.device_id,
        name=tv.name,
        room_group=grp.name if grp else tv.room_group,
        is_paired=tv.is_paired,
        layout=layout_data,
        hdmi={
            "enabled": is_hdmi_enabled,
            "input_id": effective_hdmi_id if is_hdmi_enabled else "NONE",
            "label": effective_hdmi_label or "TV SKY",
            "action": "action.switch_hdmi"
        },
        shortcuts=shortcuts_data,
        playlist=playlist_data,
        custom_settings=merged_settings,
        server_time=datetime.utcnow()
    )
