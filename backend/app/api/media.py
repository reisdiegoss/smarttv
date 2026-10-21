import os
import shutil
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.models.schema import Media
from app.models.dto import MediaOut
from app.services.audit import record_audit_log

router = APIRouter(prefix="/media", tags=["Media"])

@router.get("", response_model=List[MediaOut])
async def list_media(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Media).order_by(Media.created_at.desc()))
    medias = result.scalars().all()
    # Populate stream_url
    out = []
    for m in medias:
        item = MediaOut.model_validate(m)
        item.stream_url = f"/api/media/stream/{m.id}"
        out.append(item)
    return out

@router.post("/upload", response_model=MediaOut)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo sem nome")

    ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = [".mp4", ".mkv", ".webm", ".avi", ".mov"]
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400, 
            detail=f"Formato não suportado ({ext}). Envie um arquivo de vídeo (.mp4, .webm, etc.)"
        )

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, "videos", unique_filename)

    # Save to disk
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(dest_path)

    media = Media(
        title=os.path.splitext(file.filename)[0].replace("_", " ").title(),
        filename=unique_filename,
        original_filename=file.filename,
        file_path=dest_path,
        file_size=file_size,
        mime_type=file.content_type or "video/mp4",
        duration=0.0 # Can be extracted with ffprobe if present
    )
    db.add(media)
    await db.flush()

    new_values = {
        "title": media.title,
        "original_filename": media.original_filename,
        "file_size": media.file_size,
        "mime_type": media.mime_type
    }

    await record_audit_log(
        db=db,
        request=request,
        action="MEDIA_UPLOAD",
        entity="Media",
        entity_id=str(media.id),
        entity_name=media.title,
        description=f"Upload do vídeo '{media.original_filename}' ({file_size} bytes)",
        old_values={},
        new_values=new_values
    )

    await db.commit()
    await db.refresh(media)

    out = MediaOut.model_validate(media)
    out.stream_url = f"/api/media/stream/{media.id}"
    return out

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(media_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")

    old_values = {
        "title": media.title,
        "original_filename": media.original_filename,
        "file_size": media.file_size
    }

    if os.path.exists(media.file_path):
        try:
            os.remove(media.file_path)
        except OSError:
            pass

    await record_audit_log(
        db=db,
        request=request,
        action="MEDIA_DELETE",
        entity="Media",
        entity_id=str(media.id),
        entity_name=media.title,
        description=f"Exclusão da mídia '{media.title}'",
        old_values=old_values,
        new_values={}
    )

    await db.delete(media)
    await db.commit()
    return None

def range_requests_response(
    request: Request, file_path: str, content_type: str
):
    """Handles HTTP 206 Partial Content for efficient video streaming/scrubbing."""
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("range")

    if range_header:
        # Format: bytes=start-end
        bytes_prefix = "bytes="
        if not range_header.startswith(bytes_prefix):
            raise HTTPException(status_code=400, detail="Invalid Range header")

        range_val = range_header[len(bytes_prefix):]
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

        if start >= file_size or end >= file_size:
            raise HTTPException(status_code=416, detail="Requested range not satisfiable")

        chunk_size = end - start + 1

        def iterfile():
            with open(file_path, mode="rb") as file_like:
                file_like.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(64 * 1024, remaining)
                    data = file_like.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_size),
            "Content-Type": content_type,
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers)

    # Full content response
    def full_iter():
        with open(file_path, mode="rb") as file_like:
            while chunk := file_like.read(64 * 1024):
                yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": content_type,
    }
    return StreamingResponse(full_iter(), headers=headers)

@router.get("/stream/{media_id}")
async def stream_media(media_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media or not os.path.exists(media.file_path):
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado no disco")

    return range_requests_response(request, media.file_path, media.mime_type or "video/mp4")
