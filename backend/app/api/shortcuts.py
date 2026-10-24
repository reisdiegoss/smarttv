from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import get_db
from app.models.schema import AppShortcut, SmartTV, TVGroup
from app.models.dto import AppShortcutOut, AppShortcutBase, AppShortcutUpdate

router = APIRouter(prefix="/shortcuts", tags=["Shortcuts"])

DEFAULT_SHORTCUTS = [
    {
        "name": "TV SKY (HDMI)",
        "package_name": "action.switch_hdmi",
        "icon_name": "Tv",
        "icon_url": None,
        "is_system_app": True,
        "is_hdmi": True,
        "default_order": 1
    },
    {
        "name": "Netflix",
        "package_name": "com.netflix.ninja",
        "icon_name": "PlaySquare",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 2
    },
    {
        "name": "YouTube",
        "package_name": "com.google.android.youtube.tv",
        "icon_name": "Youtube",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 3
    },
    {
        "name": "Prime Video",
        "package_name": "com.amazon.amazonvideo.livingroom",
        "icon_name": "Film",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 4
    },
    {
        "name": "Globoplay",
        "package_name": "com.globo.globotv",
        "icon_name": "Tv2",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 5
    },
    {
        "name": "Disney+",
        "package_name": "com.disney.disneyplus",
        "icon_name": "Sparkles",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 6
    },
    {
        "name": "Max",
        "package_name": "com.wbd.stream",
        "icon_name": "Clapperboard",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 7
    },
    {
        "name": "Spotify",
        "package_name": "com.spotify.tv.android",
        "icon_name": "Music",
        "icon_url": None,
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 8
    }
]

@router.get("", response_model=List[AppShortcutOut])
async def list_shortcuts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppShortcut).order_by(AppShortcut.default_order.asc()))
    shortcuts = result.scalars().all()
    return shortcuts

@router.post("", response_model=AppShortcutOut)
async def create_shortcut(payload: AppShortcutBase, db: AsyncSession = Depends(get_db)):
    shortcut = AppShortcut(
        name=payload.name,
        package_name=payload.package_name,
        icon_name=payload.icon_name,
        icon_url=payload.icon_url,
        background_color=payload.background_color,
        is_system_app=payload.is_system_app,
        is_hdmi=payload.is_hdmi,
        default_order=payload.default_order
    )
    db.add(shortcut)
    await db.flush()

    now = datetime.utcnow()
    await db.execute(update(SmartTV).values(updated_at=now))
    await db.execute(update(TVGroup).values(updated_at=now))

    # Se uma TV ou Grupo tinha selected_shortcuts, adiciona o novo atalho
    tvs_res = await db.execute(select(SmartTV).where(SmartTV.selected_shortcuts.isnot(None)))
    for t in tvs_res.scalars().all():
        if t.selected_shortcuts and shortcut.id not in t.selected_shortcuts:
            t.selected_shortcuts = list(t.selected_shortcuts) + [shortcut.id]

    grps_res = await db.execute(select(TVGroup).where(TVGroup.selected_shortcuts.isnot(None)))
    for g in grps_res.scalars().all():
        if g.selected_shortcuts and shortcut.id not in g.selected_shortcuts:
            g.selected_shortcuts = list(g.selected_shortcuts) + [shortcut.id]

    await db.commit()
    await db.refresh(shortcut)
    return shortcut

@router.put("/{shortcut_id}", response_model=AppShortcutOut)
async def update_shortcut(shortcut_id: int, payload: AppShortcutUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppShortcut).where(AppShortcut.id == shortcut_id))
    shortcut = result.scalar_one_or_none()
    if not shortcut:
        raise HTTPException(status_code=404, detail="Atalho não encontrado")
    
    if payload.name is not None:
        shortcut.name = payload.name.strip()
    if payload.package_name is not None:
        shortcut.package_name = payload.package_name.strip()
    if payload.icon_name is not None:
        shortcut.icon_name = payload.icon_name.strip()
    if payload.icon_url is not None:
        shortcut.icon_url = payload.icon_url.strip() or None
    if payload.background_color is not None:
        shortcut.background_color = payload.background_color.strip() or None
    if payload.is_system_app is not None:
        shortcut.is_system_app = payload.is_system_app
    if payload.is_hdmi is not None:
        shortcut.is_hdmi = payload.is_hdmi
    if payload.default_order is not None:
        shortcut.default_order = payload.default_order
    
    # Atualiza timestamp para notificar TVs via ping
    now = datetime.utcnow()
    await db.execute(update(SmartTV).values(updated_at=now))
    await db.execute(update(TVGroup).values(updated_at=now))

    await db.commit()
    await db.refresh(shortcut)
    return shortcut

@router.delete("/{shortcut_id}")
async def delete_shortcut(shortcut_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppShortcut).where(AppShortcut.id == shortcut_id))
    shortcut = result.scalar_one_or_none()
    if not shortcut:
        raise HTTPException(status_code=404, detail="Atalho não encontrado")
    await db.delete(shortcut)

    now = datetime.utcnow()
    await db.execute(update(SmartTV).values(updated_at=now))
    await db.execute(update(TVGroup).values(updated_at=now))

    # Remove dos selected_shortcuts
    tvs_res = await db.execute(select(SmartTV).where(SmartTV.selected_shortcuts.isnot(None)))
    for t in tvs_res.scalars().all():
        if t.selected_shortcuts and shortcut_id in t.selected_shortcuts:
            t.selected_shortcuts = [x for x in t.selected_shortcuts if x != shortcut_id]

    grps_res = await db.execute(select(TVGroup).where(TVGroup.selected_shortcuts.isnot(None)))
    for g in grps_res.scalars().all():
        if g.selected_shortcuts and shortcut_id in g.selected_shortcuts:
            g.selected_shortcuts = [x for x in g.selected_shortcuts if x != shortcut_id]

    await db.commit()
    return {"message": "Atalho removido com sucesso"}

