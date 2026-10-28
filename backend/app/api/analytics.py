from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.schema import SmartTV, TVUsageSession, TVAppAnalytics, AppShortcut, DeviceLog
from app.models.dto import AppClickEventRequest

router = APIRouter(prefix="/analytics", tags=["Smart TV Analytics & BI"])

APP_BRAND_COLORS = {
    "youtube": "#ef4444",
    "netflix": "#e50914",
    "prime": "#00a8e1",
    "amazon": "#00a8e1",
    "spotify": "#10b981",
    "disney": "#3b82f6",
    "globo": "#f97316",
    "max": "#6366f1",
    "hbo": "#6366f1",
    "sky": "#ef4444",
    "hdmi": "#a855f7",
    "vlc": "#f59e0b",
    "apple": "#94a3b8"
}

def get_brand_color(app_name: str, pkg: str) -> str:
    combined = f"{app_name} {pkg}".lower()
    for key, color in APP_BRAND_COLORS.items():
        if key in combined:
            return color
    return "#38bdf8"


# ──── 1. REGISTRO DE CLIQUE / ABERTURA DE APLICATIVO OU HDMI ─────────────────
@router.post("/app-click")
async def record_app_click(payload: AppClickEventRequest, db: AsyncSession = Depends(get_db)):
    """
    Registra um clique em aplicativo ou canal HDMI acionado pela Smart TV Launcher.
    Associa automaticamente ao hóspede atual e UH da TV.
    """
    result = await db.execute(select(SmartTV).where(SmartTV.device_id == payload.device_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    current_uh = tv.uh_number or (tv.custom_settings or {}).get("uh_number") or ""
    current_guest = tv.guest_name or (tv.custom_settings or {}).get("guest_name") or "Quarto Vago"

    event = TVAppAnalytics(
        tv_id=tv.id,
        uh_number=current_uh,
        guest_name=current_guest,
        shortcut_id=payload.shortcut_id,
        package_name=payload.package_name,
        app_name=payload.app_name,
        action_type=payload.action_type or "CLICK",
        clicked_at=datetime.utcnow()
    )
    db.add(event)

    # Registra no log de auditoria da TV para transparência
    log = DeviceLog(
        tv_id=tv.id,
        event_type="APP_CLICK",
        message=f"App acionado: '{payload.app_name}' ({payload.package_name}) pelo hóspede '{current_guest}' na UH {current_uh or tv.name}"
    )
    db.add(log)
    await db.commit()

    return {
        "status": "ok",
        "message": f"Evento de '{payload.app_name}' computado com sucesso",
        "uh": current_uh,
        "guest": current_guest
    }


# ──── 2. TELEMETRIA DE TEMPO DE TELA / HEARTBEAT ─────────────────────────────
@router.post("/heartbeat")
async def record_screen_heartbeat(
    device_id: str = Query(...),
    screen_on_seconds: int = Query(30),
    launcher_active_seconds: int = Query(30),
    is_screen_on: bool = Query(True),
    db: AsyncSession = Depends(get_db)
):
    """
    Atualiza o tempo de tela ativa da TV e o tempo de exibição da launcher institucional.
    Acumula na sessão ativa vinculada ao hóspede da UH.
    """
    result = await db.execute(select(SmartTV).where(SmartTV.device_id == device_id))
    tv = result.scalar_one_or_none()
    if not tv:
        raise HTTPException(status_code=404, detail="TV não encontrada")

    current_uh = tv.uh_number or (tv.custom_settings or {}).get("uh_number") or ""
    current_guest = tv.guest_name or (tv.custom_settings or {}).get("guest_name") or "Quarto Vago"
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Localiza sessão ativa da TV
    sess_res = await db.execute(
        select(TVUsageSession)
        .where(
            and_(
                TVUsageSession.tv_id == tv.id,
                TVUsageSession.ended_at == None,
                TVUsageSession.session_date == today_str
            )
        )
        .order_by(TVUsageSession.id.desc())
    )
    session = sess_res.scalars().first()

    # Se hóspede mudou ou não há sessão para a data de hoje, encerra a anterior e abre nova
    if session and (session.guest_name != current_guest or session.session_date != today_str):
        session.ended_at = datetime.utcnow()
        session = None

    delta_screen = max(0, min(screen_on_seconds, 120)) if is_screen_on else 0
    delta_launcher = max(0, min(launcher_active_seconds, delta_screen)) if is_screen_on else 0
    delta_external = max(0, delta_screen - delta_launcher)

    if not session:
        session = TVUsageSession(
            tv_id=tv.id,
            uh_number=current_uh,
            guest_name=current_guest,
            session_date=today_str,
            screen_on_seconds=delta_screen,
            launcher_active_seconds=delta_launcher,
            external_app_seconds=delta_external,
            started_at=datetime.utcnow(),
            last_ping_at=datetime.utcnow()
        )
        db.add(session)
    else:
        session.screen_on_seconds += delta_screen
        session.launcher_active_seconds += delta_launcher
        session.external_app_seconds += delta_external
        session.last_ping_at = datetime.utcnow()

    tv.last_ping = datetime.utcnow()
    tv.is_online = True
    await db.commit()

    return {"status": "ok", "total_screen_seconds": session.screen_on_seconds}


# ──── 3. VISÃO GERAL DE ANALYTICS & BI (OVERVIEW) ─────────────────────────────
@router.get("/overview")
async def get_analytics_overview(
    period: str = Query("7days", regex="^(today|7days|30days|all)$"),
    uh_number: Optional[str] = None,
    tv_id: Optional[int] = None,
    guest_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna métricas consolidadas, KPIs, ranking de aplicativos,
    heatmap de horários e detalhamento por UH/Hóspede.
    """
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1)

    # 1. Filtros base para sessões e cliques
    session_filters = [TVUsageSession.started_at >= start_date]
    click_filters = [TVAppAnalytics.clicked_at >= start_date]

    if uh_number and uh_number != "ALL":
        session_filters.append(TVUsageSession.uh_number == uh_number.strip())
        click_filters.append(TVAppAnalytics.uh_number == uh_number.strip())

    if tv_id:
        session_filters.append(TVUsageSession.tv_id == tv_id)
        click_filters.append(TVAppAnalytics.tv_id == tv_id)

    if guest_name and guest_name.strip():
        clean_guest = guest_name.strip().lower()
        session_filters.append(func.lower(TVUsageSession.guest_name).contains(clean_guest))
        click_filters.append(func.lower(TVAppAnalytics.guest_name).contains(clean_guest))

    # 2. Totalização de Sessões de Uso
    sess_query = select(
        func.coalesce(func.sum(TVUsageSession.screen_on_seconds), 0).label("total_screen_sec"),
        func.coalesce(func.sum(TVUsageSession.launcher_active_seconds), 0).label("total_launcher_sec"),
        func.coalesce(func.sum(TVUsageSession.external_app_seconds), 0).label("total_external_sec"),
        func.count(func.distinct(TVUsageSession.tv_id)).label("active_tvs")
    ).where(and_(*session_filters))

    sess_res = await db.execute(sess_query)
    sess_row = sess_res.one()

    total_screen_sec = int(sess_row.total_screen_sec)
    total_launcher_sec = int(sess_row.total_launcher_sec)
    total_external_sec = int(sess_row.total_external_sec)
    active_tvs = int(sess_row.active_tvs)

    # 3. Ranking de Aplicativos Mais Clicados
    click_query = select(
        TVAppAnalytics.app_name,
        TVAppAnalytics.package_name,
        func.count(TVAppAnalytics.id).label("clicks")
    ).where(and_(*click_filters)).group_by(
        TVAppAnalytics.app_name,
        TVAppAnalytics.package_name
    ).order_by(desc("clicks"))

    click_res = await db.execute(click_query)
    click_rows = click_res.all()

    total_clicks = sum(r.clicks for r in click_rows)

    app_ranking = []
    for r in click_rows:
        pct = round((r.clicks / total_clicks * 100), 1) if total_clicks > 0 else 0
        app_ranking.append({
            "app_name": r.app_name,
            "package_name": r.package_name,
            "clicks": r.clicks,
            "percentage": pct,
            "color": get_brand_color(r.app_name, r.package_name)
        })

    most_popular_app = app_ranking[0] if app_ranking else {
        "app_name": "Nenhum app clicado",
        "clicks": 0,
        "percentage": 0,
        "color": "#38bdf8"
    }

    # 4. Tendência Diária (Daily Trend dos últimos N dias)
    days_span = 1 if period == "today" else (7 if period == "7days" else 30)
    daily_trend = []
    for i in range(days_span - 1, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_trend.append({
            "date": d,
            "label": (now - timedelta(days=i)).strftime("%d/%m"),
            "screen_hours": 0.0,
            "launcher_hours": 0.0,
            "clicks": 0
        })

    trend_map = {item["date"]: item for item in daily_trend}

    daily_sess = await db.execute(
        select(
            TVUsageSession.session_date,
            func.sum(TVUsageSession.screen_on_seconds).label("sec"),
            func.sum(TVUsageSession.launcher_active_seconds).label("launcher_sec")
        )
        .where(and_(*session_filters, TVUsageSession.session_date.isnot(None)))
        .group_by(TVUsageSession.session_date)
    )
    for r in daily_sess.all():
        if r.session_date in trend_map:
            trend_map[r.session_date]["screen_hours"] = round(float(r.sec or 0) / 3600.0, 1)
            trend_map[r.session_date]["launcher_hours"] = round(float(r.launcher_sec or 0) / 3600.0, 1)

    daily_clicks = await db.execute(
        select(
            func.to_char(TVAppAnalytics.clicked_at, 'YYYY-MM-DD').label("day"),
            func.count(TVAppAnalytics.id).label("clicks")
        )
        .where(and_(*click_filters))
        .group_by("day")
    )
    for r in daily_clicks.all():
        if r.day in trend_map:
            trend_map[r.day]["clicks"] = int(r.clicks)

    # 5. Heatmap por Hora do Dia (00h às 23h)
    hourly_res = await db.execute(
        select(
            func.extract('hour', TVAppAnalytics.clicked_at).label("hr"),
            func.count(TVAppAnalytics.id).label("count")
        )
        .where(and_(*click_filters))
        .group_by("hr")
    )
    hourly_map = {int(r.hr): int(r.count) for r in hourly_res.all()}
    hourly_distribution = [
        {"hour": f"{h:02d}h", "count": hourly_map.get(h, 0)}
        for h in range(24)
    ]

    # 6. Resumo por UH (Quartos)
    tvs_res = await db.execute(select(SmartTV).order_by(SmartTV.uh_number.asc(), SmartTV.name.asc()))
    all_tvs = tvs_res.scalars().all()

    # Métricas agregadas por TV
    tv_sess_agg = await db.execute(
        select(
            TVUsageSession.tv_id,
            func.sum(TVUsageSession.screen_on_seconds).label("screen_sec"),
            func.sum(TVUsageSession.launcher_active_seconds).label("launcher_sec")
        )
        .where(and_(*session_filters))
        .group_by(TVUsageSession.tv_id)
    )
    tv_screen_map = {r.tv_id: (int(r.screen_sec or 0), int(r.launcher_sec or 0)) for r in tv_sess_agg.all()}

    tv_clicks_agg = await db.execute(
        select(
            TVAppAnalytics.tv_id,
            func.count(TVAppAnalytics.id).label("clicks")
        )
        .where(and_(*click_filters))
        .group_by(TVAppAnalytics.tv_id)
    )
    tv_clicks_map = {r.tv_id: int(r.clicks or 0) for r in tv_clicks_agg.all()}

    # App favorito por TV
    tv_top_app_agg = await db.execute(
        select(
            TVAppAnalytics.tv_id,
            TVAppAnalytics.app_name,
            func.count(TVAppAnalytics.id).label("c")
        )
        .where(and_(*click_filters))
        .group_by(TVAppAnalytics.tv_id, TVAppAnalytics.app_name)
        .order_by(TVAppAnalytics.tv_id, desc("c"))
    )
    tv_top_app_map = {}
    for r in tv_top_app_agg.all():
        if r.tv_id not in tv_top_app_map:
            tv_top_app_map[r.tv_id] = r.app_name

    room_summaries = []
    max_room_hours = 0.0
    most_active_room = {"uh": "-", "name": "-", "hours": 0.0}

    for tv in all_tvs:
        s_sec, l_sec = tv_screen_map.get(tv.id, (0, 0))
        c_count = tv_clicks_map.get(tv.id, 0)
        s_hours = round(s_sec / 3600.0, 1)
        l_hours = round(l_sec / 3600.0, 1)
        uh = tv.uh_number or (tv.custom_settings or {}).get("uh_number") or "-"
        guest = tv.guest_name or (tv.custom_settings or {}).get("guest_name") or ""
        top_app = tv_top_app_map.get(tv.id, "N/A")

        if s_hours > max_room_hours and uh != "-":
            max_room_hours = s_hours
            most_active_room = {"uh": uh, "name": tv.name, "hours": s_hours}

        room_summaries.append({
            "tv_id": tv.id,
            "device_id": tv.device_id,
            "uh_number": uh,
            "tv_name": tv.name,
            "guest_name": guest or "Quarto Vago",
            "is_occupied": bool(guest),
            "is_online": tv.is_online,
            "screen_hours": s_hours,
            "launcher_hours": l_hours,
            "external_hours": round(max(0, s_sec - l_sec) / 3600.0, 1),
            "app_clicks": c_count,
            "top_app": top_app,
            "last_ping": tv.last_ping.isoformat() if tv.last_ping else None
        })

    # Ordena quartos por horas de tela decrescente
    room_summaries.sort(key=lambda x: x["screen_hours"], reverse=True)

    # 7. Histórico de Estadias de Hóspedes (Guest Stays)
    guest_query = select(
        TVUsageSession.uh_number,
        TVUsageSession.guest_name,
        func.min(TVUsageSession.started_at).label("first_seen"),
        func.max(TVUsageSession.last_ping_at).label("last_seen"),
        func.sum(TVUsageSession.screen_on_seconds).label("screen_sec"),
        func.sum(TVUsageSession.launcher_active_seconds).label("launcher_sec")
    ).where(
        and_(
            *session_filters,
            TVUsageSession.guest_name.isnot(None),
            TVUsageSession.guest_name != "Quarto Vago"
        )
    ).group_by(
        TVUsageSession.uh_number,
        TVUsageSession.guest_name
    ).order_by(desc("last_seen")).limit(30)

    guest_res = await db.execute(guest_query)
    guest_stays = []
    for r in guest_res.all():
        s_sec = int(r.screen_sec or 0)
        l_sec = int(r.launcher_sec or 0)
        guest_stays.append({
            "uh_number": r.uh_number or "-",
            "guest_name": r.guest_name,
            "first_seen": r.first_seen.isoformat() if r.first_seen else None,
            "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            "screen_hours": round(s_sec / 3600.0, 1),
            "launcher_hours": round(l_sec / 3600.0, 1),
            "external_hours": round(max(0, s_sec - l_sec) / 3600.0, 1)
        })

    return {
        "period": period,
        "kpis": {
            "total_screen_hours": round(total_screen_sec / 3600.0, 1),
            "total_launcher_hours": round(total_launcher_sec / 3600.0, 1),
            "total_external_app_hours": round(total_external_sec / 3600.0, 1),
            "total_app_clicks": total_clicks,
            "monitored_tvs": len(all_tvs),
            "active_tvs": active_tvs,
            "most_popular_app": most_popular_app,
            "most_active_room": most_active_room
        },
        "app_ranking": app_ranking,
        "hourly_distribution": hourly_distribution,
        "daily_trend": daily_trend,
        "room_summaries": room_summaries,
        "guest_stays": guest_stays
    }


# ──── 4. SEED DE DADOS INICIAIS DE TELEMETRIA (POPULAÇÃO INTELIGENTE) ─────────
@router.post("/seed-demo-data")
async def seed_demo_telemetry(db: AsyncSession = Depends(get_db)):
    """
    Popula métricas de telemetria coerentes e realistas para as TVs cadastradas,
    permitindo que a gestão do hotel visualize os gráficos de BI imediatamente.
    """
    import random
    tvs_res = await db.execute(select(SmartTV))
    tvs = tvs_res.scalars().all()
    if not tvs:
        return {"status": "error", "message": "Nenhuma TV cadastrada"}

    apps = [
        {"name": "Netflix", "pkg": "com.netflix.ninja"},
        {"name": "YouTube", "pkg": "com.google.android.youtube.tv"},
        {"name": "Prime Video", "pkg": "com.amazon.amazonvideo.livingroom"},
        {"name": "Spotify", "pkg": "com.spotify.tv.android"},
        {"name": "Disney+", "pkg": "com.disney.disneyplus"},
        {"name": "TV SKY", "pkg": "action.hdmi"}
    ]

    now = datetime.utcnow()
    added_clicks = 0
    added_sessions = 0

    for tv in tvs[:15]:
        uh = tv.uh_number or (tv.custom_settings or {}).get("uh_number") or f"{100 + tv.id}"
        guest = tv.guest_name or "Hóspede Fasano"

        for day_offset in range(7):
            d_date = (now - timedelta(days=day_offset))
            d_str = d_date.strftime("%Y-%m-%d")

            # Sessão do dia: entre 3 e 9 horas de TV ligada
            screen_hours = random.uniform(3.0, 8.5)
            screen_sec = int(screen_hours * 3600)
            launcher_sec = int(screen_sec * random.uniform(0.15, 0.35))
            ext_sec = screen_sec - launcher_sec

            sess = TVUsageSession(
                tv_id=tv.id,
                uh_number=uh,
                guest_name=guest,
                session_date=d_str,
                screen_on_seconds=screen_sec,
                launcher_active_seconds=launcher_sec,
                external_app_seconds=ext_sec,
                started_at=d_date.replace(hour=8, minute=0),
                last_ping_at=d_date.replace(hour=23, minute=30)
            )
            db.add(sess)
            added_sessions += 1

            # Cliques de apps naquele dia (entre 2 e 7 cliques)
            num_clicks = random.randint(2, 7)
            for _ in range(num_clicks):
                app_choice = random.choices(
                    apps,
                    weights=[40, 30, 15, 8, 5, 12],
                    k=1
                )[0]
                click_time = d_date.replace(
                    hour=random.choice([7, 8, 12, 13, 19, 20, 21, 22, 23]),
                    minute=random.randint(0, 59)
                )
                click_ev = TVAppAnalytics(
                    tv_id=tv.id,
                    uh_number=uh,
                    guest_name=guest,
                    package_name=app_choice["pkg"],
                    app_name=app_choice["name"],
                    action_type="HDMI_SWITCH" if "hdmi" in app_choice["pkg"] else "CLICK",
                    clicked_at=click_time
                )
                db.add(click_ev)
                added_clicks += 1

    await db.commit()
    return {
        "status": "ok",
        "message": f"Telemetria inicial criada: {added_sessions} sessões diárias e {added_clicks} eventos de cliques."
    }
