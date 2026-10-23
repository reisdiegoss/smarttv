import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.models.schema import LayoutPreset, AppShortcut, SmartTV, Playlist, PlaylistItem, Media, User, TVGroup
from app.api.layouts import DEFAULT_LAYOUTS, router as layouts_router
from app.api.shortcuts import DEFAULT_SHORTCUTS, router as shortcuts_router
from app.api.media import router as media_router
from app.api.playlists import router as playlists_router
from app.api.tvs import router as tvs_router
from app.api.groups import router as groups_router
from app.api.pms import router as pms_router
from app.api.auth import router as auth_router
from app.services.audit import hash_password
from app.services.fias_service import fias_service

# WebSocket connection manager for live dashboard updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

ws_manager = ConnectionManager()

async def seed_initial_data():
    async with AsyncSessionLocal() as session:
        # 1. Seed Layout Presets
        existing_layouts = await session.execute(select(LayoutPreset))
        if not existing_layouts.scalars().first():
            print("[SEED] Criando layouts padrão...")
            for l_data in DEFAULT_LAYOUTS:
                layout = LayoutPreset(
                    name=l_data["name"],
                    code=l_data["code"],
                    description=l_data["description"],
                    config=l_data["config"],
                    is_default=l_data["is_default"]
                )
                session.add(layout)
            await session.commit()

        # 2. Seed Default App Shortcuts
        existing_shortcuts = await session.execute(select(AppShortcut))
        if not existing_shortcuts.scalars().first():
            print("[SEED] Criando atalhos padrão...")
            for s_data in DEFAULT_SHORTCUTS:
                shortcut = AppShortcut(
                    name=s_data["name"],
                    package_name=s_data["package_name"],
                    icon_name=s_data["icon_name"],
                    is_system_app=s_data["is_system_app"],
                    is_hdmi=s_data["is_hdmi"],
                    default_order=s_data["default_order"]
                )
                session.add(shortcut)
            await session.commit()

        # 3. Create Sample Media / Demo Playlist if empty
        existing_media = await session.execute(select(Media))
        if not existing_media.scalars().first():
            print("[SEED] Criando mídia demo...")
            demo_video_filename = "demo_nature_4k.mp4"
            demo_video_path = os.path.join(settings.UPLOAD_DIR, "videos", demo_video_filename)
            # Create a tiny mock MP4 file if not present so streaming doesn't error
            if not os.path.exists(demo_video_path):
                with open(demo_video_path, "wb") as f:
                    f.write(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free")

            demo_media = Media(
                title="Vídeo Institucional / Paisagens Relaxantes",
                filename=demo_video_filename,
                original_filename="nature_relax_4k.mp4",
                file_path=demo_video_path,
                file_size=os.path.getsize(demo_video_path),
                duration=120.0,
                mime_type="video/mp4"
            )
            session.add(demo_media)
            await session.flush()

            # Create default playlist
            demo_playlist = Playlist(
                name="Playlist Padrão - Recepção & Quartos",
                description="Vídeos institucionais em alta definição e atrações turísticas locais",
                loop_playback=True
            )
            session.add(demo_playlist)
            await session.flush()

            playlist_item = PlaylistItem(
                playlist_id=demo_playlist.id,
                media_id=demo_media.id,
                order_index=0
            )
            session.add(playlist_item)
            await session.commit()

        # 4. Create sample demo TV if empty (e.g. Quarto 101)
        existing_tvs = await session.execute(select(SmartTV))
        if not existing_tvs.scalars().first():
            print("[SEED] Criando TVs demonstrativas...")
            layout_res = await session.execute(select(LayoutPreset).where(LayoutPreset.code == "hotel_dock"))
            default_layout = layout_res.scalar_one_or_none()

            playlist_res = await session.execute(select(Playlist))
            default_playlist = playlist_res.scalars().first()

            shortcuts_res = await session.execute(select(AppShortcut))
            all_sc = shortcuts_res.scalars().all()
            shortcut_ids = [s.id for s in all_sc]

            tv1 = SmartTV(
                device_id="TV-LOBBY-01",
                name="Lobby Principal",
                room_group="Recepção",
                pairing_code="LB-1001",
                is_paired=True,
                is_online=True,
                ip_address="192.168.168.105",
                layout_id=default_layout.id if default_layout else None,
                playlist_id=default_playlist.id if default_playlist else None,
                hdmi_input_id="HDMI 1",
                hdmi_label="SKY TV HD",
                selected_shortcuts=shortcut_ids,
                custom_settings={
                    "welcome_title": "Bem-vindo ao Hotel & Resort",
                    "welcome_subtitle": "Sinta-se em casa. Conheça nossos serviços no menu abaixo.",
                    "wifi_ssid": "Lobby-HighSpeed-5G",
                    "wifi_password": "smarttvresort",
                    "show_clock": True,
                    "show_weather": True,
                    "weather_city": "São Paulo",
                    "auto_hide_dock": True,
                    "auto_hide_seconds": 15
                }
            )

            tv2 = SmartTV(
                device_id="TV-SUITE-101",
                name="Suíte Master 101",
                room_group="1º Andar",
                pairing_code="ST-0101",
                is_paired=True,
                is_online=True,
                ip_address="192.168.168.106",
                layout_id=default_layout.id if default_layout else None,
                playlist_id=default_playlist.id if default_playlist else None,
                hdmi_input_id="HDMI 2",
                hdmi_label="Receptor SKY Premium",
                selected_shortcuts=shortcut_ids[:5],
                custom_settings={
                    "welcome_title": "Olá, Hóspede VIP!",
                    "welcome_subtitle": "Suíte 101 - Ar-condicionado, Wi-Fi e Room Service 24h.",
                    "wifi_ssid": "Quarto101-VIP",
                    "wifi_password": "suitemaster101",
                    "show_clock": True,
                    "show_weather": True,
                    "weather_city": "São Paulo",
                    "auto_hide_dock": True,
                    "auto_hide_seconds": 15
                }
            )

            session.add_all([tv1, tv2])
            await session.commit()
            print("[SEED] Base de dados inicializada com sucesso!")

        # 5. Seed default admin user if not exists
        existing_admin = await session.execute(select(User).where(User.username == "admin"))
        if not existing_admin.scalars().first():
            print("[SEED] Criando usuário administrador padrão (admin / @Fasano2026!)...")
            admin_user = User(
                username="admin",
                password_hash=hash_password("@Fasano2026!"),
                full_name="Administrador Smart TV",
                email="admin@fasanobr.local",
                role="admin",
                is_active=True
            )
            session.add(admin_user)
            await session.commit()

        # 6. Seed Default TV Groups if empty
        existing_groups = await session.execute(select(TVGroup))
        if not existing_groups.scalars().first():
            print("[SEED] Criando grupos padrão de TVs (Lobby, Quartos, Vista Mar)...")
            l_res = await session.execute(select(LayoutPreset))
            d_layout = l_res.scalars().first()
            p_res = await session.execute(select(Playlist))
            d_playlist = p_res.scalars().first()

            g_lobby = TVGroup(
                name="TV Lobby",
                description="TVs instaladas na Recepção, Hall de Entrada e Restaurante. Vídeos institucionais e canais corporativos.",
                layout_id=d_layout.id if d_layout else None,
                playlist_id=d_playlist.id if d_playlist else None,
                hdmi_input_id="HDMI 1",
                hdmi_label="TV Lobby SKY",
                selected_shortcuts=[1, 2],
                custom_settings={
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
            )
            g_quartos = TVGroup(
                name="TV Quartos",
                description="TVs dos apartamentos e suítes standard. Vídeos de relaxamento, Netflix, YouTube e Sky TV.",
                layout_id=d_layout.id if d_layout else None,
                playlist_id=d_playlist.id if d_playlist else None,
                hdmi_input_id="HDMI 1",
                hdmi_label="TV SKY",
                selected_shortcuts=[1, 2, 3, 4],
                custom_settings={
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
            )
            g_vistamar = TVGroup(
                name="TV Vista Mar",
                description="Suítes especiais e com vista mar. Experiência exclusiva com personalização VIP e canais dedicados.",
                layout_id=d_layout.id if d_layout else None,
                playlist_id=d_playlist.id if d_playlist else None,
                hdmi_input_id="HDMI 1",
                hdmi_label="SKY Premium 4K",
                selected_shortcuts=[1, 2, 3, 4, 5],
                custom_settings={
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
            )
            session.add_all([g_lobby, g_quartos, g_vistamar])
            await session.commit()

            # Atribuir TVs existentes aos grupos correspondentes
            tvs_res = await session.execute(select(SmartTV))
            all_tvs = tvs_res.scalars().all()
            for tv in all_tvs:
                if not tv.group_id:
                    if "lobby" in tv.name.lower() or (tv.room_group and "recep" in tv.room_group.lower()):
                        tv.group_id = g_lobby.id
                    else:
                        tv.group_id = g_quartos.id
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migração segura e não-destrutiva de novas colunas no PostgreSQL
        await conn.execute(text("ALTER TABLE smart_tvs ADD COLUMN IF NOT EXISTS pms_enabled BOOLEAN DEFAULT TRUE;"))
        await conn.execute(text("ALTER TABLE smart_tvs ADD COLUMN IF NOT EXISTS uh_number VARCHAR(50);"))
        await conn.execute(text("ALTER TABLE smart_tvs ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150);"))
        await conn.execute(text("ALTER TABLE smart_tvs ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20);"))
        await conn.execute(text("ALTER TABLE smart_tvs ADD COLUMN IF NOT EXISTS group_id INTEGER;"))
        await conn.execute(text("ALTER TABLE app_shortcuts ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500);"))
        await conn.execute(text("ALTER TABLE app_shortcuts ADD COLUMN IF NOT EXISTS background_color VARCHAR(50);"))
    await seed_initial_data()
    # Inicia ouvinte em segundo plano FIAS (IFC8 192.168.162.18)
    fias_service.start()
    yield
    # Shutdown
    fias_service.stop()
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(tvs_router, prefix=settings.API_V1_STR)
app.include_router(groups_router, prefix=settings.API_V1_STR)
app.include_router(pms_router, prefix=settings.API_V1_STR)
app.include_router(media_router, prefix=settings.API_V1_STR)
app.include_router(playlists_router, prefix=settings.API_V1_STR)
app.include_router(layouts_router, prefix=settings.API_V1_STR)
app.include_router(shortcuts_router, prefix=settings.API_V1_STR)

# WebSocket for real-time dashboard events
@app.websocket("/ws/tvs")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or broadcast incoming command
            await ws_manager.broadcast({"event": "tv_update", "data": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

from fastapi.responses import FileResponse

@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "api_version": "v1"
    }

@app.get("/smarttv-launcher.apk")
@app.get("/fasano-smarttv-latest.apk")
def download_launcher_apk():
    candidates = [
        "/opt/smarttv/smarttv-launcher.apk",
        "/opt/smarttv/frontend/dist/smarttv-launcher.apk",
        "/smarttv-launcher.apk",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "smarttv-launcher.apk")
    ]
    for p in candidates:
        if os.path.exists(p):
            return FileResponse(p, media_type="application/vnd.android.package-archive", filename="smarttv-launcher.apk")
    return {"error": "APK não encontrado na raiz do sistema"}

