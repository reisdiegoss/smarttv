import re
import socket
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.schema import SmartTV, TVGroup, DeviceLog
from app.models.dto import BatchUHCreateRequest, BatchUHCreateResponse, PMSResyncRequest
from app.services.fias_service import fias_service
from app.services.audit import record_audit_log

router = APIRouter(prefix="/pms", tags=["PMS Hospitality Integration (IFC8 / FIAS)"])

class ManualPMSSyncRequest(BaseModel):
    uh_number: str
    guest_name: Optional[str] = None
    welcome_title: Optional[str] = None
    welcome_subtitle: Optional[str] = None
    action: str = "CHECK_IN" # CHECK_IN, CHECK_OUT

def parse_room_ranges(ranges_str: Optional[str], direct_list: Optional[List[str]] = None) -> List[str]:
    """
    Converte strings de faixas de quartos como "101-125, 201-225, 301-315, 401"
    em uma lista limpa e ordenada de strings de UHs: ["101", "102", ..., "401"].
    """
    rooms = []
    
    if direct_list:
        for r in direct_list:
            clean = str(r).strip()
            if clean and clean not in rooms:
                rooms.append(clean)

    if ranges_str:
        # Divide por vírgula, ponto-e-vírgula ou quebras de linha
        raw_parts = re.split(r'[,;\n\r]+', ranges_str)
        for part in raw_parts:
            part = part.strip()
            if not part:
                continue

            # Checa se é um intervalo com hífen (ex: "101-125")
            if '-' in part:
                sub = part.split('-')
                if len(sub) == 2:
                    start_str, end_str = sub[0].strip(), sub[1].strip()
                    if start_str.isdigit() and end_str.isdigit():
                        start_num, end_num = int(start_str), int(end_str)
                        # Preserva formatação de zeros se aplicável (ex: 0101 -> 4 dígitos)
                        pad_len = max(len(start_str), len(end_str)) if start_str.startswith('0') else 0
                        step = 1 if start_num <= end_num else -1
                        for num in range(start_num, end_num + step, step):
                            val = str(num).zfill(pad_len) if pad_len > 0 else str(num)
                            if val not in rooms:
                                rooms.append(val)
                        continue

            # Se não for intervalo numérico, adiciona o valor literal
            if part not in rooms:
                rooms.append(part)

    return rooms

@router.get("/status")
def get_pms_status():
    """Retorna o status da conexão em tempo real com o servidor IFC8 (192.168.162.18)"""
    return fias_service.get_status()

@router.post("/test-connection")
def test_ifc8_connection(host: str = "192.168.162.18", port: int = 5020):
    """Testa a conectividade direta TCP com a porta FIAS do servidor IFC8"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(4.0)
        start = datetime.now()
        s.connect((host, port))
        latency_ms = int((datetime.now() - start).total_seconds() * 1000)
        
        banner = ""
        try:
            raw = s.recv(512)
            banner = repr(raw)
        except Exception:
            banner = "Conectado (sem banner imediato)"
        s.close()

        return {
            "status": "success",
            "host": host,
            "port": port,
            "latency_ms": latency_ms,
            "banner": banner,
            "message": f"Conexão com servidor IFC8 {host}:{port} realizada com sucesso em {latency_ms}ms!"
        }
    except Exception as e:
        return {
            "status": "error",
            "host": host,
            "port": port,
            "message": f"Falha ao conectar no IFC8 ({host}:{port}): {str(e)}"
        }

@router.post("/batch-create-uhs", response_model=BatchUHCreateResponse)
async def batch_create_uhs(payload: BatchUHCreateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Carga Inicial em Lote: Gera as Smart TVs para todas as UHs informadas (ex: 101-125, 201-225).
    As TVs são criadas com o código de pareamento prévio (ex: UH-0101) para que a equipe técnica
    possa chegar no quarto e parear o APK imediatamente.
    """
    uh_list = parse_room_ranges(payload.uh_ranges, payload.uh_list)
    if not uh_list:
        raise HTTPException(status_code=400, detail="Nenhum número de UH válido foi informado na requisição.")

    # 1. Obter grupo alvo
    target_group = None
    if payload.group_id:
        grp_res = await db.execute(select(TVGroup).where(TVGroup.id == payload.group_id))
        target_group = grp_res.scalar_one_or_none()

    if not target_group:
        grp_res = await db.execute(select(TVGroup).where(TVGroup.name.ilike("%Quartos%")).order_by(TVGroup.id.asc()))
        target_group = grp_res.scalars().first()

    if not target_group:
        grp_res = await db.execute(select(TVGroup).order_by(TVGroup.id.asc()))
        target_group = grp_res.scalars().first()

    # 2. Carregar TVs existentes para evitar duplicidade
    tvs_res = await db.execute(select(SmartTV))
    existing_tvs = tvs_res.scalars().all()
    
    existing_uhs = set()
    for tv in existing_tvs:
        if tv.uh_number:
            existing_uhs.add(tv.uh_number.strip().lower())
        cust = tv.custom_settings or {}
        if cust.get("uh_number"):
            existing_uhs.add(str(cust.get("uh_number")).strip().lower())

    created_rooms: List[str] = []
    already_exists_rooms: List[str] = []

    prefix_label = payload.prefix.strip() if payload.prefix else "Quarto"

    for uh in uh_list:
        clean_uh = uh.strip()
        if clean_uh.lower() in existing_uhs:
            already_exists_rooms.append(clean_uh)
            continue

        clean_code = f"UH-{clean_uh.zfill(4)}"
        new_settings = {
            "uh_number": clean_uh,
            "welcome_title": "Seja Bem-vindo(a) ao Fasano",
            "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
            "pin_code": payload.default_pin or "0000"
        }

        new_tv = SmartTV(
            device_id=f"UH-{clean_uh}",
            name=f"{prefix_label} {clean_uh}",
            room_group=target_group.name if target_group else "TV Quartos",
            group_id=target_group.id if target_group else None,
            uh_number=clean_uh,
            guest_name=None,
            pms_enabled=payload.enable_pms,
            pin_code=payload.default_pin or "0000",
            pairing_code=clean_code,
            is_paired=False,
            is_online=False,
            custom_settings=new_settings
        )
        db.add(new_tv)
        existing_uhs.add(clean_uh.lower())
        created_rooms.append(clean_uh)

    await db.commit()

    # Gravar auditoria
    await record_audit_log(
        db=db,
        request=request,
        action="PMS_BATCH_UH_CREATE",
        entity="SmartTV",
        entity_id=f"BATCH-{len(created_rooms)}",
        entity_name=f"Carga Inicial de {len(created_rooms)} UHs",
        description=f"Geradas {len(created_rooms)} TVs de UHs. {len(already_exists_rooms)} já existiam no sistema."
    )

    msg = f"Carga inicial concluída: {len(created_rooms)} UHs criadas com sucesso."
    if already_exists_rooms:
        msg += f" {len(already_exists_rooms)} UHs já estavam cadastradas."

    return BatchUHCreateResponse(
        total_requested=len(uh_list),
        created_count=len(created_rooms),
        already_exists_count=len(already_exists_rooms),
        created_rooms=created_rooms,
        existing_rooms=already_exists_rooms,
        message=msg
    )

@router.post("/request-resync")
async def request_pms_resync(payload: PMSResyncRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Solicita Database Resync (DR) diretamente ao IFC8/Opera via socket FIAS ativo.
    O Opera enviará todos os hóspedes ativos e UHs ocupadas via registros GI.
    """
    if not fias_service.is_connected:
        raise HTTPException(
            status_code=503,
            detail="Socket com o IFC8 (192.168.162.18:5020) não está conectado no momento. Verifique o status da integração."
        )

    success = await fias_service.request_database_resync(payload.room_number)
    if not success:
        raise HTTPException(status_code=500, detail="Falha ao transmitir pacote DR ao IFC8")

    await record_audit_log(
        db=db,
        request=request,
        action="PMS_RESYNC_REQUEST",
        entity="FIASService",
        entity_id=payload.room_number or "ALL",
        entity_name="Opera IFC8 Database Resync",
        description=f"Solicitação de Resync (DR) disparada para {'UH ' + payload.room_number if payload.room_number else 'Todas as UHs'}"
    )

    return {
        "status": "success",
        "message": f"Comando Database Resync (DR) enviado com sucesso ao IFC8 em 192.168.162.18:5020. Os hóspedes serão atualizados em tempo real.",
        "target": payload.room_number or "ALL",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.post("/sync-uh")
async def manual_sync_uh(payload: ManualPMSSyncRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Vincula ou desvincula manualmente um hóspede a uma UH (Quarto)"""
    clean_uh = payload.uh_number.strip()
    result = await db.execute(select(SmartTV))
    tvs = result.scalars().all()

    target_tv = None
    for tv in tvs:
        if tv.uh_number and tv.uh_number.strip().lower() == clean_uh.lower():
            target_tv = tv
            break
        cust = tv.custom_settings or {}
        if str(cust.get("uh_number") or "").strip().lower() == clean_uh.lower():
            target_tv = tv
            break
        if clean_uh.lower() in tv.name.lower():
            target_tv = tv
            break

    if not target_tv:
        raise HTTPException(status_code=404, detail=f"Nenhuma TV vinculada à UH '{clean_uh}'")

    current_settings = dict(target_tv.custom_settings or {})
    current_settings["uh_number"] = clean_uh

    is_checkin = payload.action.upper() != "CHECK_OUT" and bool(payload.guest_name)
    if is_checkin and payload.guest_name:
        clean_guest = payload.guest_name.strip()
        target_tv.guest_name = clean_guest
        target_tv.uh_number = clean_uh
        current_settings["guest_name"] = clean_guest
        current_settings["welcome_title"] = payload.welcome_title or f"Sr(a). {clean_guest}, Bem-vindo(a) ao Fasano"
    else:
        target_tv.guest_name = None
        target_tv.uh_number = clean_uh
        current_settings.pop("guest_name", None)
        current_settings["welcome_title"] = payload.welcome_title or "Seja Bem-vindo(a) ao Fasano"

    if payload.welcome_subtitle:
        current_settings["welcome_subtitle"] = payload.welcome_subtitle

    target_tv.custom_settings = current_settings
    target_tv.updated_at = datetime.utcnow()

    action_label = "CHECK_IN" if is_checkin else "CHECK_OUT"
    log = DeviceLog(
        tv_id=target_tv.id,
        event_type=f"PMS_{action_label}",
        message=f"PMS Sync: UH {clean_uh} -> '{target_tv.guest_name or 'Quarto Vago'}'"
    )
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action=f"PMS_{action_label}",
        entity="SmartTV",
        entity_id=str(target_tv.id),
        entity_name=target_tv.name,
        description=f"UH {clean_uh} sincronizada com hóspede '{target_tv.guest_name or 'Quarto Vago'}'"
    )

    await db.commit()
    await db.refresh(target_tv)

    return {
        "status": "ok",
        "message": f"UH {clean_uh} atualizada com sucesso",
        "tv_id": target_tv.id,
        "tv_name": target_tv.name,
        "uh_number": clean_uh,
        "guest_name": target_tv.guest_name
    }

@router.post("/toggle-listener")
def toggle_fias_listener(enabled: bool):
    """Liga ou desliga o ouvinte contínuo FIAS no servidor IFC8"""
    if enabled:
        fias_service.start()
        return {"status": "started", "message": "Ouvinte FIAS iniciado para 192.168.162.18:5020"}
    else:
        fias_service.stop()
        return {"status": "stopped", "message": "Ouvinte FIAS interrompido"}

@router.post("/import-opera-file")
async def import_opera_file(
    file: UploadFile = File(...),
    group_id: Optional[int] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Importação Automática da Carga de UHs do Opera PMS:
    Lê o relatório oficial exportado do Opera (CSV, TXT ou Excel TSV/Semicolon) contendo
    a listagem de quartos, status e hóspedes.
    Cria as TVs automaticamente no grupo correto e atualiza os hóspedes sem digitação manual.
    """
    raw_bytes = await file.read()
    text = ""
    for enc in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']:
        try:
            text = raw_bytes.decode(enc)
            break
        except Exception:
            continue

    if not text:
        raise HTTPException(status_code=400, detail="Não foi possível decodificar o arquivo. Formatos suportados: CSV, TXT, Excel CSV.")

    return await process_opera_rooms_content(text, group_id, request, db)

class OperaTextImportRequest(BaseModel):
    content: str
    group_id: Optional[int] = None

@router.post("/import-opera-text")
async def import_opera_text(
    payload: OperaTextImportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Importação via Colagem de Texto do Relatório do Opera (sem digitar números manualmente).
    O usuário pode simplesmente copiar e colar a tabela do Opera e o sistema detecta as UHs.
    """
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Nenhum conteúdo foi informado.")
    return await process_opera_rooms_content(payload.content, payload.group_id, request, db)

async def process_opera_rooms_content(
    text: str,
    override_group_id: Optional[int],
    request: Request,
    db: AsyncSession
) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="Arquivo ou texto vazio.")

    # 1. Carregar grupos existentes para vinculação inteligente
    grp_res = await db.execute(select(TVGroup))
    all_groups = grp_res.scalars().all()
    default_group = None
    vista_mar_group = None
    lobby_group = None

    for g in all_groups:
        low = g.name.lower()
        if "vista mar" in low or "mar" in low:
            vista_mar_group = g
        elif "lobby" in low:
            lobby_group = g
        elif "quarto" in low and not default_group:
            default_group = g

    if not default_group and all_groups:
        default_group = all_groups[0]

    # 2. Carregar TVs existentes
    tvs_res = await db.execute(select(SmartTV))
    existing_tvs = tvs_res.scalars().all()
    tv_by_uh = {}
    for tv in existing_tvs:
        if tv.uh_number:
            tv_by_uh[tv.uh_number.strip().lower()] = tv
        cust = tv.custom_settings or {}
        if cust.get("uh_number"):
            tv_by_uh[str(cust["uh_number"]).strip().lower()] = tv

    # 3. Parser de Linhas (CSV, delimitado por ;, tab, vírgula ou pipe)
    detected_rooms = []
    header_found = False
    col_room = -1
    col_guest = -1
    col_type = -1
    col_status = -1

    for line in lines:
        # Detectar delimitador
        sep = ',' if ',' in line else (';' if ';' in line else ('\t' if '\t' in line else ('|' if '|' in line else None)))
        
        if sep:
            cols = [c.strip().strip('"').strip("'") for c in line.split(sep)]
            low_cols = [c.lower() for c in cols]

            # Detectar linha de cabeçalho
            if not header_found:
                for idx, c in enumerate(low_cols):
                    if any(k in c for k in ['room', 'quarto', 'uh', 'apt', 'unit', 'habitación']):
                        col_room = idx
                    elif any(k in c for k in ['guest', 'hospede', 'hóspede', 'name', 'nome']):
                        col_guest = idx
                    elif any(k in c for k in ['type', 'tipo', 'category', 'categoria']):
                        col_type = idx
                    elif any(k in c for k in ['status', 'fo status', 'hk status', 'situa']):
                        col_status = idx

                if col_room != -1:
                    header_found = True
                    continue

            # Se cabeçalho foi encontrado e temos a coluna de quarto
            if header_found and col_room < len(cols):
                raw_room = cols[col_room].strip()
                # Validação se parece com número de quarto (ex: 101, 102A, 1002, etc.)
                if raw_room and re.match(r'^[A-Za-z0-9\-_]{1,10}$', raw_room) and not raw_room.lower() in ['room', 'quarto', 'uh', 'total']:
                    guest = cols[col_guest].strip() if (col_guest != -1 and col_guest < len(cols)) else None
                    rtype = cols[col_type].strip() if (col_type != -1 and col_type < len(cols)) else None
                    status = cols[col_status].strip() if (col_status != -1 and col_status < len(cols)) else None
                    
                    if guest and guest.lower() in ['vacant', 'vago', 'limpo', 'sujo', 'clean', 'dirty', '-', 'null', 'none']:
                        guest = None

                    detected_rooms.append({
                        "uh": raw_room,
                        "guest_name": guest,
                        "room_type": rtype,
                        "status": status
                    })
                    continue

        # Fallback para linhas sem delimitador padrão (ex: Regex procurando UH)
        match = re.search(r'\b(?:UH|Quarto|Apt|Room)?\s*([0-9]{2,5}[A-Za-z]?)\b', line, re.IGNORECASE)
        if match:
            raw_room = match.group(1).strip()
            # Tentar achar nome de hóspede se houver
            after_text = line[match.end():].strip(' -|:;,')
            guest = after_text if len(after_text) > 3 and not re.match(r'^[0-9\s/.-]+$', after_text) else None
            
            if not any(d["uh"] == raw_room for d in detected_rooms):
                detected_rooms.append({
                    "uh": raw_room,
                    "guest_name": guest,
                    "room_type": None,
                    "status": None
                })

    if not detected_rooms:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível identificar quartos no arquivo fornecido. Certifique-se de que há uma coluna com o número do quarto (Room / UH)."
        )

    # 4. Criar ou Atualizar TVs no banco
    created_count = 0
    updated_count = 0
    imported_list = []

    for item in detected_rooms:
        clean_uh = item["uh"]
        key = clean_uh.lower()
        guest = item["guest_name"]
        rtype = item["room_type"] or ""

        # Determinar grupo de destino
        target_group = default_group
        if override_group_id:
            target_group = next((g for g in all_groups if g.id == override_group_id), default_group)
        elif "mar" in rtype.lower() and vista_mar_group:
            target_group = vista_mar_group
        elif "lobby" in rtype.lower() and lobby_group:
            target_group = lobby_group

        clean_code = f"UH-{clean_uh.zfill(4)}"

        if key in tv_by_uh:
            # TV já existe -> Atualizar dados PMS se pms_enabled=True
            tv = tv_by_uh[key]
            if getattr(tv, 'pms_enabled', True):
                if guest:
                    tv.guest_name = guest
                    cust = dict(tv.custom_settings or {})
                    cust["guest_name"] = guest
                    cust["welcome_title"] = f"Sr(a). {guest}, Bem-vindo(a) ao Fasano"
                    tv.custom_settings = cust
                updated_count += 1
                imported_list.append({"uh": clean_uh, "action": "UPDATED", "guest": guest, "group": tv.room_group})
        else:
            # TV nova -> Criar no banco
            new_settings = {
                "uh_number": clean_uh,
                "welcome_title": f"Sr(a). {guest}, Bem-vindo(a) ao Fasano" if guest else "Seja Bem-vindo(a) ao Fasano",
                "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
                "pin_code": "0000"
            }
            if guest:
                new_settings["guest_name"] = guest

            new_tv = SmartTV(
                device_id=f"UH-{clean_uh}",
                name=f"Quarto {clean_uh}",
                room_group=target_group.name if target_group else "TV Quartos",
                group_id=target_group.id if target_group else None,
                uh_number=clean_uh,
                guest_name=guest,
                pms_enabled=True,
                pin_code="0000",
                pairing_code=clean_code,
                is_paired=False,
                is_online=False,
                custom_settings=new_settings
            )
            db.add(new_tv)
            created_count += 1
            imported_list.append({"uh": clean_uh, "action": "CREATED", "guest": guest, "group": target_group.name if target_group else "TV Quartos"})

    await db.commit()

    return {
        "status": "success",
        "message": f"Carga do Opera concluída com sucesso! {created_count} novas TVs geradas, {updated_count} quartos atualizados.",
        "total_detected": len(detected_rooms),
        "created_count": created_count,
        "updated_count": updated_count,
        "samples": imported_list[:10]
    }


@router.post("/pull-from-hotel-db")
async def pull_from_hotel_db(
    group_id: Optional[int] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Puxa automaticamente todas as UHs já cadastradas no Banco de Dados Central do Hotel Fasano (TIHFSA em 192.168.168.26).
    Evita qualquer risco de erro de digitação manual de números de quartos.
    """
    import asyncio
    
    def fetch_hotel_rooms():
        # Conecta no Postgres Central do Fasano e extrai todos os 70 quartos de users e assets
        import psycopg2
        import re
        conn = psycopg2.connect("postgresql://postgres:6ffdd4a3d0e99d78b1e15f411b04e323@192.168.168.26:5432/tihfsa", connect_timeout=5)
        cur = conn.cursor()
        
        all_rooms = {}
        # 1. Da tabela users
        cur.execute("SELECT room_number, display_name FROM users WHERE room_number IS NOT NULL OR is_room = true")
        for row in cur.fetchall():
            r = str(row[0]).strip()
            if r:
                all_rooms[r] = str(row[1]).strip() if len(row) > 1 and row[1] else f"Quarto {r}"
                
        # 2. Da tabela assets (onde estão catalogados os equipamentos de rede de todos os 70 quartos dos andares 1 a 6)
        cur.execute("SELECT name, description, model FROM assets")
        for row in cur.fetchall():
            text = f"{row[0] or ''} {row[1] or ''} {row[2] or ''}"
            m = re.findall(r"\b(?:apt|uh|quarto|apartamento|suite)?\s*([1-6][0-1][0-9])\b", text, re.IGNORECASE)
            for r in m:
                if r not in all_rooms:
                    all_rooms[r] = f"Quarto {r}"

        cur.close()
        conn.close()
        sorted_keys = sorted(all_rooms.keys(), key=lambda x: int(x) if x.isdigit() else 9999)
        return [(k, all_rooms[k]) for k in sorted_keys]

    try:
        hotel_rooms = await asyncio.to_thread(fetch_hotel_rooms)
    except Exception as e:
        # Se psycopg2 falhar ou timeout, tentar com psycopg
        try:
            def fetch_with_psycopg():
                import psycopg
                import re
                with psycopg.connect("postgresql://postgres:6ffdd4a3d0e99d78b1e15f411b04e323@192.168.168.26:5432/tihfsa", timeout=5) as c:
                    with c.cursor() as cur:
                        all_rooms = {}
                        cur.execute("SELECT room_number, display_name FROM users WHERE room_number IS NOT NULL OR is_room = true")
                        for row in cur.fetchall():
                            r = str(row[0]).strip()
                            if r:
                                all_rooms[r] = str(row[1]).strip() if len(row) > 1 and row[1] else f"Quarto {r}"
                        cur.execute("SELECT name, description, model FROM assets")
                        for row in cur.fetchall():
                            text = f"{row[0] or ''} {row[1] or ''} {row[2] or ''}"
                            m = re.findall(r"\b(?:apt|uh|quarto|apartamento|suite)?\s*([1-6][0-1][0-9])\b", text, re.IGNORECASE)
                            for r in m:
                                if r not in all_rooms:
                                    all_rooms[r] = f"Quarto {r}"
                        sorted_keys = sorted(all_rooms.keys(), key=lambda x: int(x) if x.isdigit() else 9999)
                        return [(k, all_rooms[k]) for k in sorted_keys]
            hotel_rooms = await asyncio.to_thread(fetch_with_psycopg)
        except Exception as err:
            raise HTTPException(
                status_code=502,
                detail=f"Não foi possível conectar ao banco central do hotel (192.168.168.26): {str(err)}"
            )


    if not hotel_rooms:
        raise HTTPException(status_code=404, detail="Nenhuma UH encontrada no banco central do hotel.")

    # Obter grupo padrão
    grp_res = await db.execute(select(TVGroup))
    all_groups = grp_res.scalars().all()
    target_group = None
    if group_id:
        target_group = next((g for g in all_groups if g.id == group_id), None)
    if not target_group:
        target_group = next((g for g in all_groups if "quarto" in g.name.lower()), None)
    if not target_group and all_groups:
        target_group = all_groups[0]

    # TVs existentes
    tvs_res = await db.execute(select(SmartTV))
    existing_tvs = tvs_res.scalars().all()
    existing_uhs = set()
    for tv in existing_tvs:
        if tv.uh_number:
            existing_uhs.add(tv.uh_number.strip().lower())
        cust = tv.custom_settings or {}
        if cust.get("uh_number"):
            existing_uhs.add(str(cust["uh_number"]).strip().lower())

    created_rooms = []
    already_exists = []

    for row in hotel_rooms:
        uh_num = str(row[0]).strip()
        disp_name = str(row[1]).strip() if len(row) > 1 and row[1] else f"Quarto {uh_num}"
        key = uh_num.lower()

        if key in existing_uhs:
            already_exists.append(uh_num)
            continue

        clean_code = f"UH-{uh_num.zfill(4)}"
        new_settings = {
            "uh_number": uh_num,
            "welcome_title": "Seja Bem-vindo(a) ao Fasano",
            "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
            "pin_code": "0000"
        }

        new_tv = SmartTV(
            device_id=f"UH-{uh_num}",
            name=disp_name,
            room_group=target_group.name if target_group else "TV Quartos",
            group_id=target_group.id if target_group else None,
            uh_number=uh_num,
            guest_name=None,
            pms_enabled=True,
            pin_code="0000",
            pairing_code=clean_code,
            is_paired=False,
            is_online=False,
            custom_settings=new_settings
        )
        db.add(new_tv)
        existing_uhs.add(key)
        created_rooms.append(uh_num)

    await db.commit()

    if request:
        await record_audit_log(
            db=db,
            request=request,
            action="PMS_PULL_HOTEL_DB",
            entity="SmartTV",
            entity_id=f"PULL-{len(created_rooms)}",
            entity_name="Carga Automática do Banco Central do Hotel",
            description=f"Puxadas {len(created_rooms)} UHs do banco central do hotel. {len(already_exists)} já existiam."
        )

    return {
        "status": "success",
        "message": f"Carga das UHs concluída: {len(created_rooms)} UHs puxadas com sucesso do sistema central do hotel! {len(already_exists)} já existiam.",
        "total_found": len(hotel_rooms),
        "created_count": len(created_rooms),
        "already_exists_count": len(already_exists),
        "created_rooms": created_rooms
    }



