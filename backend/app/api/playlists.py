from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.schema import Playlist, PlaylistItem, Media
from app.models.dto import PlaylistCreate, PlaylistUpdate, PlaylistOut, MediaOut

router = APIRouter(prefix="/playlists", tags=["Playlists"])

@router.get("", response_model=List[PlaylistOut])
async def list_playlists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media))
        .order_by(Playlist.created_at.desc())
    )
    playlists = result.scalars().all()
    # Populate stream_urls
    out = []
    for p in playlists:
        p_dto = PlaylistOut.model_validate(p)
        for item in p_dto.items:
            if item.media:
                item.media.stream_url = f"/api/media/stream/{item.media.id}"
        out.append(p_dto)
    return out

@router.post("", response_model=PlaylistOut, status_code=status.HTTP_201_CREATED)
async def create_playlist(payload: PlaylistCreate, db: AsyncSession = Depends(get_db)):
    playlist = Playlist(
        name=payload.name,
        description=payload.description,
        loop_playback=payload.loop_playback
    )
    db.add(playlist)
    await db.flush()

    if payload.items:
        for idx, item in enumerate(payload.items):
            p_item = PlaylistItem(
                playlist_id=playlist.id,
                media_id=item.media_id,
                order_index=item.order_index if item.order_index is not None else idx,
                duration_override=item.duration_override
            )
            db.add(p_item)

    await db.commit()

    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media))
        .where(Playlist.id == playlist.id)
    )
    saved = result.scalar_one()
    p_dto = PlaylistOut.model_validate(saved)
    for item in p_dto.items:
        if item.media:
            item.media.stream_url = f"/api/media/stream/{item.media.id}"
    return p_dto

@router.get("/{playlist_id}", response_model=PlaylistOut)
async def get_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media))
        .where(Playlist.id == playlist_id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")

    p_dto = PlaylistOut.model_validate(playlist)
    for item in p_dto.items:
        if item.media:
            item.media.stream_url = f"/api/media/stream/{item.media.id}"
    return p_dto

@router.put("/{playlist_id}", response_model=PlaylistOut)
async def update_playlist(
    playlist_id: int,
    payload: PlaylistUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items))
        .where(Playlist.id == playlist_id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")

    if payload.name is not None:
        playlist.name = payload.name
    if payload.description is not None:
        playlist.description = payload.description
    if payload.is_active is not None:
        playlist.is_active = payload.is_active
    if payload.loop_playback is not None:
        playlist.loop_playback = payload.loop_playback

    if payload.items is not None:
        # Clear existing items and replace
        playlist.items.clear()
        for idx, item in enumerate(payload.items):
            p_item = PlaylistItem(
                playlist_id=playlist.id,
                media_id=item.media_id,
                order_index=item.order_index if item.order_index is not None else idx,
                duration_override=item.duration_override
            )
            db.add(p_item)

    await db.commit()

    result = await db.execute(
        select(Playlist)
        .options(selectinload(Playlist.items).selectinload(PlaylistItem.media))
        .where(Playlist.id == playlist.id)
    )
    saved = result.scalar_one()
    p_dto = PlaylistOut.model_validate(saved)
    for item in p_dto.items:
        if item.media:
            item.media.stream_url = f"/api/media/stream/{item.media.id}"
    return p_dto

@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(playlist_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist não encontrada")

    await db.delete(playlist)
    await db.commit()
    return None
