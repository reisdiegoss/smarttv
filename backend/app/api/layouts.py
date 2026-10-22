from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.schema import LayoutPreset
from app.models.dto import LayoutPresetOut, LayoutPresetBase

router = APIRouter(prefix="/layouts", tags=["Layouts"])

DEFAULT_LAYOUTS = [
    {
        "name": "Hotel Luxo (Dock Flutuante)",
        "code": "hotel_dock",
        "description": "Vídeo em tela cheia com barra inferior translúcida (glassmorphism), relógio sutil e atalhos de apps e TV Sky.",
        "config": {
            "type": "hotel_dock",
            "dock_position": "bottom",
            "dock_bg_opacity": 0.85,
            "show_header": True,
            "show_clock": True,
            "show_weather": True,
            "show_wifi_card": True,
            "auto_hide_dock": True,
            "auto_hide_seconds": 15,
            "accent_color": "#3b82f6",
            "font_family": "Inter",
            "theme": "dark"
        },
        "is_default": True
    },
    {
        "name": "Corporativo (Painel Lateral Split 70/30)",
        "code": "split_sidebar",
        "description": "Vídeo de destaque em 70% da tela e coluna lateral de 30% com relógio, previsão do tempo, QR Code e lista de apps.",
        "config": {
            "type": "split_sidebar",
            "sidebar_position": "right",
            "sidebar_width": "30%",
            "show_clock": True,
            "show_weather": True,
            "show_qr_code": True,
            "show_wifi_card": True,
            "accent_color": "#10b981",
            "theme": "dark"
        },
        "is_default": False
    },
    {
        "name": "Vitrine Minimalista (Tela Cheia)",
        "code": "clean_minimal",
        "description": "Vídeo em 100% da tela sem distrações. A barra de controle e atalhos aparece somente ao tocar qualquer tecla do controle.",
        "config": {
            "type": "clean_minimal",
            "show_clock": False,
            "show_weather": False,
            "auto_hide_dock": True,
            "auto_hide_seconds": 6,
            "accent_color": "#8b5cf6",
            "theme": "dark"
        },
        "is_default": False
    },
    {
        "name": "Mural Informativo (Barra de Avisos)",
        "code": "digital_mural",
        "description": "Vídeo com rodapé dinâmico de avisos e comunicados correndo na parte inferior (ticker), relógio e atalhos no topo.",
        "config": {
            "type": "digital_mural",
            "ticker_text": "Bem-vindo ao nosso espaço! Conecte-se ao Wi-Fi para navegar em alta velocidade. Café da manhã das 06:00 às 10:00.",
            "ticker_speed": 40,
            "show_clock": True,
            "show_weather": True,
            "accent_color": "#f59e0b",
            "theme": "dark"
        },
        "is_default": False
    }
]

@router.get("", response_model=List[LayoutPresetOut])
async def list_layouts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LayoutPreset).order_by(LayoutPreset.id.asc()))
    layouts = result.scalars().all()
    return layouts

@router.post("", response_model=LayoutPresetOut)
async def create_layout(payload: LayoutPresetBase, db: AsyncSession = Depends(get_db)):
    layout = LayoutPreset(
        name=payload.name,
        code=payload.code,
        description=payload.description,
        config=payload.config,
        is_default=payload.is_default
    )
    db.add(layout)
    await db.commit()
    await db.refresh(layout)
    return layout

@router.put("/{layout_id}", response_model=LayoutPresetOut)
async def update_layout(layout_id: int, payload: LayoutPresetBase, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LayoutPreset).where(LayoutPreset.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout não encontrado")

    layout.name = payload.name
    layout.code = payload.code
    layout.description = payload.description
    layout.config = payload.config
    layout.is_default = payload.is_default

    await db.commit()
    await db.refresh(layout)
    return layout

@router.delete("/{layout_id}", status_code=204)
async def delete_layout(layout_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LayoutPreset).where(LayoutPreset.id == layout_id))
    layout = result.scalar_one_or_none()
    if not layout:
        raise HTTPException(status_code=404, detail="Layout não encontrado")
    if layout.is_default:
        raise HTTPException(status_code=400, detail="Não é permitido excluir o layout padrão do sistema")

    await db.delete(layout)
    await db.commit()
    return None

