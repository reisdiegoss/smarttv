from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Media DTOs
class MediaBase(BaseModel):
    title: str
    duration: Optional[float] = 0.0

class MediaOut(BaseModel):
    id: int
    title: str
    filename: str
    original_filename: str
    file_size: int
    duration: float
    mime_type: str
    created_at: datetime
    stream_url: Optional[str] = None

    class Config:
        from_attributes = True

# PlaylistItem DTOs
class PlaylistItemCreate(BaseModel):
    media_id: int
    order_index: int
    duration_override: Optional[float] = None

class PlaylistItemOut(BaseModel):
    id: int
    media_id: int
    order_index: int
    duration_override: Optional[float] = None
    media: Optional[MediaOut] = None

    class Config:
        from_attributes = True

# Playlist DTOs
class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    loop_playback: bool = True
    items: Optional[List[PlaylistItemCreate]] = []

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    loop_playback: Optional[bool] = None
    items: Optional[List[PlaylistItemCreate]] = None

class PlaylistOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    loop_playback: bool
    created_at: datetime
    updated_at: datetime
    items: List[PlaylistItemOut] = []

    class Config:
        from_attributes = True

# Layout Preset DTOs
class LayoutPresetBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    config: Dict[str, Any]
    is_default: bool = False

class LayoutPresetOut(LayoutPresetBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# App Shortcut DTOs
class AppShortcutBase(BaseModel):
    name: str
    package_name: str
    icon_name: str
    is_system_app: bool = False
    is_hdmi: bool = False
    default_order: int = 0

class AppShortcutOut(AppShortcutBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# SmartTV DTOs
class SmartTVCreate(BaseModel):
    device_id: str
    name: str
    room_group: Optional[str] = "Geral"
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    layout_id: Optional[int] = None
    playlist_id: Optional[int] = None
    hdmi_input_id: Optional[str] = "HDMI 1"
    hdmi_label: Optional[str] = "TV SKY"
    selected_shortcuts: Optional[List[int]] = []
    custom_settings: Optional[Dict[str, Any]] = None

class SmartTVUpdate(BaseModel):
    name: Optional[str] = None
    room_group: Optional[str] = None
    layout_id: Optional[int] = None
    playlist_id: Optional[int] = None
    hdmi_input_id: Optional[str] = None
    hdmi_label: Optional[str] = None
    selected_shortcuts: Optional[List[int]] = None
    custom_settings: Optional[Dict[str, Any]] = None
    device_id: Optional[str] = None
    pairing_code: Optional[str] = None
    is_paired: Optional[bool] = None

class SmartTVAssignDeviceRequest(BaseModel):
    target_tv_id: int
    pairing_code: Optional[str] = None
    device_id: Optional[str] = None

class SmartTVPairRequest(BaseModel):
    device_id: str
    pairing_code: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    app_version: Optional[str] = "1.0.0"

class SmartTVClaimRequest(BaseModel):
    pairing_code: str
    name: str
    room_group: Optional[str] = "Geral"
    layout_id: Optional[int] = None
    playlist_id: Optional[int] = None
    hdmi_input_id: Optional[str] = "HDMI 1"
    hdmi_label: Optional[str] = "TV SKY"
    selected_shortcuts: Optional[List[int]] = []

class SmartTVPingRequest(BaseModel):
    device_id: str
    ip_address: Optional[str] = None
    app_version: Optional[str] = None
    volume_level: Optional[int] = None
    free_storage_mb: Optional[int] = None
    current_playing_media_id: Optional[int] = None

class SmartTVBindRequest(BaseModel):
    tv_id: int
    device_id: str
    ip_address: Optional[str] = None
    app_version: Optional[str] = "1.0.1"

class SmartTVQuickUpdateRequest(BaseModel):
    device_id: str
    hdmi_input_id: Optional[str] = None
    hdmi_label: Optional[str] = None
    selected_shortcuts: Optional[List[int]] = None

class SmartTVOut(BaseModel):
    id: int
    device_id: str
    name: str
    room_group: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    pairing_code: Optional[str] = None
    is_paired: bool
    is_online: bool
    last_ping: Optional[datetime] = None
    layout_id: Optional[int] = None
    playlist_id: Optional[int] = None
    hdmi_input_id: Optional[str] = None
    hdmi_label: Optional[str] = None
    selected_shortcuts: List[int] = []
    custom_settings: Dict[str, Any] = {}
    app_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    layout: Optional[LayoutPresetOut] = None
    playlist: Optional[PlaylistOut] = None

    class Config:
        from_attributes = True

# Client TV Config Response (consumed by Android APK)
class TVClientConfig(BaseModel):
    device_id: str
    name: str
    room_group: str
    is_paired: bool
    layout: Optional[Dict[str, Any]] = None
    hdmi: Dict[str, Any]
    shortcuts: List[Dict[str, Any]]
    playlist: Optional[Dict[str, Any]] = None
    custom_settings: Dict[str, Any]
    server_time: datetime

# PMS Hospitality Integration Request (UH / Guest Sync)
class SmartTVPmsSyncRequest(BaseModel):
    uh_number: str
    guest_name: Optional[str] = None
    welcome_title: Optional[str] = None
    welcome_subtitle: Optional[str] = None
    auto_checkin: bool = True
