from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, 
    Text, Float, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0) # bytes
    duration = Column(Float, default=0.0) # seconds
    mime_type = Column(String(100), default="video/mp4")
    thumbnail_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    playlist_items = relationship("PlaylistItem", back_populates="media", cascade="all, delete-orphan")


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    loop_playback = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistItem.order_index")
    tvs = relationship("SmartTV", back_populates="playlist")


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False)
    media_id = Column(Integer, ForeignKey("media.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)
    duration_override = Column(Float, nullable=True) # if we want to limit playback time

    playlist = relationship("Playlist", back_populates="items")
    media = relationship("Media", back_populates="playlist_items")


class LayoutPreset(Base):
    __tablename__ = "layout_presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. "Hotel Luxo - Dock Inferior", "Split Screen Corporativo"
    code = Column(String(50), unique=True, nullable=False) # "hotel_dock", "split_sidebar", "clean_minimal", "mural_digital"
    description = Column(Text, nullable=True)
    config = Column(JSON, default=dict) # visual styles, positions, widgets, colors
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tvs = relationship("SmartTV", back_populates="layout")


class AppShortcut(Base):
    __tablename__ = "app_shortcuts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False) # e.g. "Netflix", "YouTube", "Sky HDMI"
    package_name = Column(String(255), nullable=False) # "com.netflix.ninja" or "action.hdmi"
    icon_name = Column(String(100), nullable=False) # Lucide icon name or image url
    is_system_app = Column(Boolean, default=False)
    is_hdmi = Column(Boolean, default=False)
    default_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class TVGroup(Base):
    __tablename__ = "tv_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True, nullable=False) # e.g. "TV Lobby", "TV Quartos", "TV Vista Mar"
    description = Column(Text, nullable=True)
    
    # Configurações herdadas por padrão pelas TVs deste grupo
    layout_id = Column(Integer, ForeignKey("layout_presets.id", ondelete="SET NULL"), nullable=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    hdmi_input_id = Column(String(150), default="HDMI 1")
    hdmi_label = Column(String(100), default="TV SKY")
    selected_shortcuts = Column(JSON, default=list) # e.g. [1, 2, 3]
    custom_settings = Column(JSON, default=lambda: {
        "welcome_title": "Seja Bem-vindo(a)!",
        "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
        "title_font_size": 32,
        "show_clock": True,
        "clock_font_size": 24,
        "show_weather": True,
        "weather_city": "Salvador",
        "weather_temp": "28°C",
        "weather_condition": "sunny",
        "dock_icon_size": 72,
        "wifi_ssid": "SmartTV-Guest",
        "wifi_password": "bemvindoahotel",
        "wifi_qrcode_url": "",
        "wifi_qr_size": 110,
        "header_layout": "welcome_left_widgets_right",
        "dock_position": "bottom",
        "auto_hide_dock": True,
        "auto_hide_seconds": 15,
        "volume_limit": 80,
        "pin_code": "0000"
    })
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    layout = relationship("LayoutPreset")
    playlist = relationship("Playlist")
    tvs = relationship("SmartTV", back_populates="group")


class SmartTV(Base):
    __tablename__ = "smart_tvs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False) # e.g. "Quarto 101 - Suíte Luxo"
    room_group = Column(String(100), default="Geral") # Legado / texto rápido
    group_id = Column(Integer, ForeignKey("tv_groups.id", ondelete="SET NULL"), nullable=True) # Perfil de Grupo Herdado
    uh_number = Column(String(50), nullable=True, index=True) # Número da UH / Quarto (ex: "101", "204", "TI")
    guest_name = Column(String(150), nullable=True) # Nome do hóspede atual (via PMS IFC8 ou manual)
    pms_enabled = Column(Boolean, default=True) # Se True: UH/Hóspede Opera. Se False: Reunião/Setor/Lobby (mensagens manuais)
    pin_code = Column(String(20), nullable=True) # Senha de saída para launcher original (override)
    ip_address = Column(String(50), nullable=True)
    mac_address = Column(String(50), nullable=True)
    pairing_code = Column(String(20), index=True, nullable=True)
    is_paired = Column(Boolean, default=False)
    is_online = Column(Boolean, default=False)
    last_ping = Column(DateTime, nullable=True)
    
    # TV Configuration (Se null, herda do grupo)
    layout_id = Column(Integer, ForeignKey("layout_presets.id", ondelete="SET NULL"), nullable=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    
    # HDMI Settings
    hdmi_input_id = Column(String(150), default="HDMI 1") # e.g. "com.mediatek.tvinput/.hdmi.HDMIInputService/HW1" or "HDMI 1"
    hdmi_label = Column(String(100), default="TV SKY")
    
    # Custom Shortcuts enabled for this specific TV (list of shortcut IDs)
    selected_shortcuts = Column(JSON, default=list) # e.g. [1, 2, 3, 5]
    
    # Individual Overrides (Welcome message, Wi-Fi info, weather city, volume, orientation)
    custom_settings = Column(JSON, default=lambda: {
        "welcome_title": "Seja Bem-vindo(a)!",
        "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
        "title_font_size": 32,
        "show_clock": True,
        "clock_font_size": 24,
        "show_weather": True,
        "weather_city": "Salvador",
        "weather_temp": "28°C",
        "weather_condition": "sunny",
        "dock_icon_size": 72,
        "wifi_ssid": "SmartTV-Guest",
        "wifi_password": "bemvindoahotel",
        "wifi_qrcode_url": "",
        "wifi_qr_size": 110,
        "header_layout": "welcome_left_widgets_right",
        "dock_position": "bottom",
        "auto_hide_dock": True,
        "auto_hide_seconds": 15,
        "volume_limit": 80
    })
    
    app_version = Column(String(50), default="1.0.0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("TVGroup", back_populates="tvs")
    layout = relationship("LayoutPreset", back_populates="tvs")
    playlist = relationship("Playlist", back_populates="tvs")
    logs = relationship("DeviceLog", back_populates="tv", cascade="all, delete-orphan")


class DeviceLog(Base):
    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, index=True)
    tv_id = Column(Integer, ForeignKey("smart_tvs.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False) # "BOOT", "HEARTBEAT", "PLAY_ERROR", "APP_OPEN", "HDMI_SWITCH"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tv = relationship("SmartTV", back_populates="logs")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), default="Administrador")
    email = Column(String(150), nullable=True)
    role = Column(String(50), default="admin") # "admin", "operator"
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=False, default="admin")
    ip_address = Column(String(100), nullable=False) # IP de quem realizou a alteração
    action = Column(String(50), nullable=False) # "TV_UPDATE", "TV_CREATE", "TV_DELETE", "PLAYLIST_UPDATE", "MEDIA_UPLOAD", "AUTH_LOGIN"
    entity = Column(String(50), nullable=False) # "SmartTV", "Playlist", "Media", "Layout", "Auth"
    entity_id = Column(String(100), nullable=True)
    entity_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    old_values = Column(JSON, default=dict) # O que era antes
    new_values = Column(JSON, default=dict) # O que foi alterado
    diff_summary = Column(JSON, default=list) # [{field, label, before, after}]
    created_at = Column(DateTime, default=datetime.utcnow) # Data e Hora com timezone/UTC

