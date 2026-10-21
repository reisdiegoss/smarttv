from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.schema import AppShortcut
from app.models.dto import AppShortcutOut, AppShortcutBase

router = APIRouter(prefix="/shortcuts", tags=["Shortcuts"])

DEFAULT_SHORTCUTS = [
    {
        "name": "TV SKY (HDMI)",
        "package_name": "action.switch_hdmi",
        "icon_name": "Tv",
        "is_system_app": True,
        "is_hdmi": True,
        "default_order": 1
    },
    {
        "name": "Netflix",
        "package_name": "com.netflix.ninja",
        "icon_name": "PlaySquare",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 2
    },
    {
        "name": "YouTube",
        "package_name": "com.google.android.youtube.tv",
        "icon_name": "Youtube",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 3
    },
    {
        "name": "Prime Video",
        "package_name": "com.amazon.amazonvideo.livingroom",
        "icon_name": "Film",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 4
    },
    {
        "name": "Globoplay",
        "package_name": "com.globo.globotv",
        "icon_name": "Tv2",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 5
    },
    {
        "name": "Disney+",
        "package_name": "com.disney.disneyplus",
        "icon_name": "Sparkles",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 6
    },
    {
        "name": "Max",
        "package_name": "com.wbd.stream",
        "icon_name": "Clapperboard",
        "is_system_app": False,
        "is_hdmi": False,
        "default_order": 7
    },
    {
        "name": "Spotify",
        "package_name": "com.spotify.tv.android",
        "icon_name": "Music",
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
        is_system_app=payload.is_system_app,
        is_hdmi=payload.is_hdmi,
        default_order=payload.default_order
    )
    db.add(shortcut)
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
    await db.commit()
    return {"message": "Atalho removido com sucesso"}
