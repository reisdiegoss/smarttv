from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.schema import TVGroup, SmartTV, LayoutPreset, Playlist
from app.models.dto import TVGroupCreate, TVGroupUpdate, TVGroupOut, BulkAssignGroupRequest
from app.services.audit import record_audit_log

router = APIRouter(prefix="/groups", tags=["TV Groups"])

@router.get("", response_model=List[TVGroupOut])
async def list_groups(db: AsyncSession = Depends(get_db)):
    """Lista todos os grupos de TVs com contagem de dispositivos e relacionamentos"""
    stmt = (
        select(TVGroup)
        .options(
            selectinload(TVGroup.layout),
            selectinload(TVGroup.playlist),
            selectinload(TVGroup.tvs)
        )
        .order_by(TVGroup.name.asc())
    )
    result = await db.execute(stmt)
    groups = result.scalars().all()

    out = []
    for g in groups:
        item = TVGroupOut.model_validate(g)
        item.tv_count = len(g.tvs) if g.tvs else 0
        out.append(item)
    return out

@router.get("/{group_id}", response_model=TVGroupOut)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    """Obtém detalhes de um grupo específico"""
    stmt = (
        select(TVGroup)
        .options(
            selectinload(TVGroup.layout),
            selectinload(TVGroup.playlist),
            selectinload(TVGroup.tvs)
        )
        .where(TVGroup.id == group_id)
    )
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    item = TVGroupOut.model_validate(group)
    item.tv_count = len(group.tvs) if group.tvs else 0
    return item

@router.post("", response_model=TVGroupOut)
async def create_group(payload: TVGroupCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Cria um novo grupo de TVs com configurações padrão para herança"""
    existing = await db.execute(select(TVGroup).where(TVGroup.name == payload.name.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Já existe um grupo com o nome '{payload.name}'")

    group = TVGroup(
        name=payload.name.strip(),
        description=payload.description,
        layout_id=payload.layout_id,
        playlist_id=payload.playlist_id,
        hdmi_input_id=payload.hdmi_input_id or "HDMI 1",
        hdmi_label=payload.hdmi_label or "TV SKY",
        selected_shortcuts=payload.selected_shortcuts or [],
        custom_settings=payload.custom_settings or {}
    )
    db.add(group)
    await db.flush()

    await record_audit_log(
        db=db,
        request=request,
        action="GROUP_CREATE",
        entity="TVGroup",
        entity_id=str(group.id),
        entity_name=group.name,
        description=f"Grupo de TVs '{group.name}' criado"
    )

    await db.commit()
    await db.refresh(group)

    # Recarregar relacionamentos
    stmt = (
        select(TVGroup)
        .options(selectinload(TVGroup.layout), selectinload(TVGroup.playlist), selectinload(TVGroup.tvs))
        .where(TVGroup.id == group.id)
    )
    res = await db.execute(stmt)
    full_group = res.scalar_one()

    item = TVGroupOut.model_validate(full_group)
    item.tv_count = 0
    return item

@router.put("/{group_id}", response_model=TVGroupOut)
async def update_group(group_id: int, payload: TVGroupUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    """Atualiza as configurações de um grupo. Todas as TVs vinculadas herdam as mudanças automaticamente."""
    stmt = (
        select(TVGroup)
        .options(selectinload(TVGroup.layout), selectinload(TVGroup.playlist), selectinload(TVGroup.tvs))
        .where(TVGroup.id == group_id)
    )
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"]:
        clean_name = update_data["name"].strip()
        # Verificar duplicidade
        dup = await db.execute(select(TVGroup).where(TVGroup.name == clean_name, TVGroup.id != group_id))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Já existe outro grupo com o nome '{clean_name}'")
        group.name = clean_name

    for key, val in update_data.items():
        if key != "name":
            setattr(group, key, val)

    group.updated_at = datetime.utcnow()

    # Propagar alterações para todas as TVs vinculadas ao grupo
    tvs_res = await db.execute(select(SmartTV).where(SmartTV.group_id == group.id))
    member_tvs = tvs_res.scalars().all()
    now_utc = datetime.utcnow()

    for tv in member_tvs:
        if "layout_id" in update_data:
            tv.layout_id = update_data["layout_id"]
        if "playlist_id" in update_data:
            tv.playlist_id = update_data["playlist_id"]
        if "hdmi_input_id" in update_data:
            tv.hdmi_input_id = update_data["hdmi_input_id"]
        if "hdmi_label" in update_data:
            tv.hdmi_label = update_data["hdmi_label"]
        if "selected_shortcuts" in update_data:
            tv.selected_shortcuts = list(update_data["selected_shortcuts"] or [])

        tc = dict(tv.custom_settings or {})
        saved_uh = tv.uh_number or tc.get("uh_number")
        saved_guest = tv.guest_name or tc.get("guest_name")
        saved_status = tc.get("room_status")
        saved_title = tc.get("welcome_title")
        saved_cleanup = tc.get("checkout_cleanup_pending")

        # Se houver custom_settings atualizado no grupo, mescla preservando a UH
        if "custom_settings" in update_data and update_data["custom_settings"]:
            tc.update(dict(update_data["custom_settings"]))

        if saved_uh: tc["uh_number"] = saved_uh
        if saved_guest: tc["guest_name"] = saved_guest
        if saved_status: tc["room_status"] = saved_status
        if saved_title: tc["welcome_title"] = saved_title
        if saved_cleanup is not None: tc["checkout_cleanup_pending"] = saved_cleanup

        tv.custom_settings = tc
        tv.updated_at = now_utc

    await record_audit_log(
        db=db,
        request=request,
        action="GROUP_UPDATE",
        entity="TVGroup",
        entity_id=str(group.id),
        entity_name=group.name,
        description=f"Grupo '{group.name}' atualizado (herança propagada para {len(member_tvs)} TVs)"
    )

    await db.commit()
    await db.refresh(group)

    item = TVGroupOut.model_validate(group)
    item.tv_count = len(group.tvs) if group.tvs else 0
    return item

@router.delete("/{group_id}")
async def delete_group(group_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Exclui o grupo e desvincula as TVs (define group_id = NULL)"""
    stmt = select(TVGroup).where(TVGroup.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    # Desvincular TVs
    await db.execute(
        update(SmartTV)
        .where(SmartTV.group_id == group_id)
        .values(group_id=None)
    )

    await record_audit_log(
        db=db,
        request=request,
        action="GROUP_DELETE",
        entity="TVGroup",
        entity_id=str(group.id),
        entity_name=group.name,
        description=f"Grupo '{group.name}' excluído (TVs desvinculadas)"
    )

    await db.delete(group)
    await db.commit()
    return {"status": "ok", "message": f"Grupo '{group.name}' excluído com sucesso"}

@router.post("/{group_id}/bulk-assign")
async def bulk_assign_tvs_to_group(group_id: int, payload: BulkAssignGroupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Atribui em massa uma lista de TVs a este grupo com herança instantânea"""
    stmt = select(TVGroup).where(TVGroup.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Grupo não encontrado")

    if not payload.tv_ids:
        return {"status": "ok", "message": "Nenhuma TV informada para atribuição", "count": 0}

    tvs_res = await db.execute(select(SmartTV).where(SmartTV.id.in_(payload.tv_ids)))
    assigned_tvs = tvs_res.scalars().all()
    now_utc = datetime.utcnow()

    for tv in assigned_tvs:
        tv.group_id = group_id
        tv.layout_id = group.layout_id
        tv.playlist_id = group.playlist_id
        tv.hdmi_input_id = group.hdmi_input_id
        tv.hdmi_label = group.hdmi_label
        tv.selected_shortcuts = list(group.selected_shortcuts or [])

        tc = dict(tv.custom_settings or {})
        saved_uh = tv.uh_number or tc.get("uh_number")
        saved_guest = tv.guest_name or tc.get("guest_name")
        saved_status = tc.get("room_status")
        saved_title = tc.get("welcome_title")
        saved_cleanup = tc.get("checkout_cleanup_pending")

        if group.custom_settings:
            tc.update(dict(group.custom_settings))

        if saved_uh: tc["uh_number"] = saved_uh
        if saved_guest: tc["guest_name"] = saved_guest
        if saved_status: tc["room_status"] = saved_status
        if saved_title: tc["welcome_title"] = saved_title
        if saved_cleanup is not None: tc["checkout_cleanup_pending"] = saved_cleanup

        tv.custom_settings = tc
        tv.updated_at = now_utc

    await record_audit_log(
        db=db,
        request=request,
        action="GROUP_BULK_ASSIGN",
        entity="TVGroup",
        entity_id=str(group.id),
        entity_name=group.name,
        description=f"{len(payload.tv_ids)} TV(s) vinculadas em massa ao grupo '{group.name}'"
    )

    await db.commit()
    return {
        "status": "ok",
        "message": f"{len(payload.tv_ids)} TV(s) vinculadas com sucesso ao grupo '{group.name}'",
        "group_id": group_id,
        "tv_ids": payload.tv_ids
    }

@router.post("/seed-defaults")
async def seed_default_groups(db: AsyncSession = Depends(get_db)):
    """Cria os grupos padrão do hotel se nenhum existir (TV Lobby, TV Quartos Standard, TV Vista Mar)"""
    existing = await db.execute(select(TVGroup))
    if existing.scalars().first():
        return {"status": "exists", "message": "Grupos já existentes na base"}

    # Buscar layout e playlist padrão
    layout_res = await db.execute(select(LayoutPreset).order_by(LayoutPreset.id.asc()))
    default_layout = layout_res.scalars().first()
    layout_id = default_layout.id if default_layout else None

    playlist_res = await db.execute(select(Playlist).order_by(Playlist.id.asc()))
    default_playlist = playlist_res.scalars().first()
    playlist_id = default_playlist.id if default_playlist else None

    templates = [
        {
            "name": "TV Lobby",
            "description": "TVs instaladas na Recepção, Hall de Entrada e Restaurante. Vídeos institucionais e canais corporativos.",
            "layout_id": layout_id,
            "playlist_id": playlist_id,
            "hdmi_input_id": "HDMI 1",
            "hdmi_label": "TV Lobby SKY",
            "selected_shortcuts": [1, 2],
            "custom_settings": {
                "welcome_title": "Bem-vindo ao Hotel Fasano",
                "welcome_subtitle": "Desfrute de uma experiência única de hospitalidade e gastronomia.",
                "wifi_ssid": "Fasano-Lobby-5G",
                "wifi_password": "fasanohospitality",
                "show_clock": True,
                "show_weather": True,
                "weather_city": "São Paulo",
                "auto_hide_dock": True,
                "auto_hide_seconds": 20,
                "volume_limit": 60,
                "pin_code": "0000"
            }
        },
        {
            "name": "TV Quartos",
            "description": "TVs dos apartamentos e suítes standard. Vídeos de relaxamento, Netflix, YouTube e Sky TV.",
            "layout_id": layout_id,
            "playlist_id": playlist_id,
            "hdmi_input_id": "HDMI 1",
            "hdmi_label": "TV SKY",
            "selected_shortcuts": [1, 2, 3, 4],
            "custom_settings": {
                "welcome_title": "Seja Bem-vindo(a)!",
                "welcome_subtitle": "Aproveite a sua estadia com o melhor do conforto e entretenimento.",
                "wifi_ssid": "Fasano-Guest-HighSpeed",
                "wifi_password": "fasanobemvindo",
                "show_clock": True,
                "show_weather": True,
                "weather_city": "São Paulo",
                "auto_hide_dock": True,
                "auto_hide_seconds": 15,
                "volume_limit": 80,
                "pin_code": "0000"
            }
        },
        {
            "name": "TV Vista Mar",
            "description": "Suítes especiais e com vista mar. Experiência exclusiva com personalização VIP e canais dedicados.",
            "layout_id": layout_id,
            "playlist_id": playlist_id,
            "hdmi_input_id": "HDMI 1",
            "hdmi_label": "SKY Premium 4K",
            "selected_shortcuts": [1, 2, 3, 4, 5],
            "custom_settings": {
                "welcome_title": "Bem-vindo(a) à Suíte Vista Mar",
                "welcome_subtitle": "Uma vista inesquecível e serviços exclusivos à sua disposição 24 horas.",
                "wifi_ssid": "Fasano-VistaMar-VIP",
                "wifi_password": "fasanovistamar",
                "show_clock": True,
                "show_weather": True,
                "weather_city": "Salvador",
                "auto_hide_dock": True,
                "auto_hide_seconds": 15,
                "volume_limit": 85,
                "pin_code": "0000"
            }
        }
    ]

    created = []
    for t in templates:
        g = TVGroup(**t)
        db.add(g)
        created.append(t["name"])

    await db.commit()
    return {"status": "created", "groups": created}
