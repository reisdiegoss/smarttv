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
async def test_ifc8_connection(host: str = "192.168.162.18", port: int = 5020):
    """Testa a conectividade com o servidor IFC8 sem derrubar a conexão socket ativa"""
    # Se o serviço FIAS já possui uma conexão socket ativa com este mesmo host e porta:
    if fias_service.is_connected and fias_service.host == host and fias_service.port == port:
        now = datetime.utcnow()
        last_hb = fias_service.last_heartbeat
        sec_ago = int((now - last_hb).total_seconds()) if last_hb else 0
        
        # Envia um Link Alive (LA) de verificação através da conexão existente
        try:
            now_dt = datetime.now()
            da = now_dt.strftime("%y%m%d")
            ti = now_dt.strftime("%H%M%S")
            await fias_service._send_packet(f"LA|DA{da}|TI{ti}|")
        except Exception:
            pass

        return {
            "status": "success",
            "host": host,
            "port": port,
            "latency_ms": 0,
            "banner": f"Sessão FIAS ativa ({fias_service.packets_recv_count} pacotes recebidos, {fias_service.packets_sent_count} enviados)",
            "message": f"Conexão socket com servidor IFC8 {host}:{port} já está ativa e sincronizada! (Último evento há {sec_ago}s)"
        }

    # Se NÃO estiver conectado (ou testando outro host/porta), testa socket TCP direto:
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
        try:
            s.shutdown(socket.SHUT_RDWR)
        except Exception:
            pass
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

@router.get("/timeline")
def get_pms_timeline(limit: int = 150):
    """Retorna a timeline ativa de eventos e logs do IFC8 / Resync"""
    return fias_service.get_timeline_data(limit=limit)

@router.post("/timeline/clear")
def clear_pms_timeline():
    """Limpa a timeline ativa de logs"""
    fias_service.clear_timeline()
    return {"status": "ok", "message": "Timeline limpa com sucesso"}

class UpdatePMSConfigRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None

@router.post("/config")
def update_pms_config(payload: UpdatePMSConfigRequest):
    """Atualiza o host ou porta do servidor IFC8"""
    fias_service.update_config(host=payload.host, port=payload.port)
    return {
        "status": "ok",
        "message": f"Configuração do IFC8 definida para {fias_service.host}:{fias_service.port}",
        "config": {"host": fias_service.host, "port": fias_service.port}
    }

class DiagnoseRequest(BaseModel):
    host: Optional[str] = None
    ports: Optional[List[int]] = None

@router.post("/diagnose")
async def run_pms_diagnostic(payload: Optional[DiagnoseRequest] = None):
    """Executa diagnóstico de conectividade em portas do IFC8 com streaming na timeline"""
    h = payload.host if payload else None
    p = payload.ports if payload else None
    results = await fias_service.run_diagnostic(target_host=h, test_ports=p)
    return {
        "status": "ok",
        "host": h or fias_service.host,
        "results": results
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
    Todos os passos são registrados em tempo real na Timeline.
    """
    success = await fias_service.request_database_resync(payload.room_number)
    if not success:
        raise HTTPException(
            status_code=502,
            detail=f"Não foi possível transmitir o comando DR ao IFC8 ({fias_service.host}:{fias_service.port}). Verifique a timeline para detalhes."
        )

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
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.post("/sync-uh")
async def manual_sync_uh(payload: ManualPMSSyncRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Vincula ou desvincula manualmente um hóspede a uma UH (Quarto)"""
    clean_uh = payload.uh_number.strip()
    result = await db.execute(select(SmartTV))
    tvs = result.scalars().all()

    target_tv = None
    for tv in tvs:
        if tv.uh_number and tv.uh_number.strip().lstrip('0') == clean_uh.lstrip('0'):
            target_tv = tv
            break
        cust = tv.custom_settings or {}
        cust_uh = str(cust.get("uh_number") or "").strip()
        if cust_uh and cust_uh.lstrip('0') == clean_uh.lstrip('0'):
            target_tv = tv
            break
        name_nums = re.findall(r'\d+', tv.name)
        if name_nums and name_nums[-1].lstrip('0') == clean_uh.lstrip('0'):
            target_tv = tv
            break

    if not target_tv:
        raise HTTPException(status_code=404, detail=f"Nenhuma TV vinculada à UH '{clean_uh}'")

    current_settings = dict(target_tv.custom_settings or {})
    current_settings["uh_number"] = clean_uh

    old_guest = target_tv.guest_name
    old_status = (current_settings.get("room_status") or ("Occupied" if old_guest else "Vacant")).capitalize()

    is_checkin = payload.action.upper() != "CHECK_OUT" and bool(payload.guest_name)
    if is_checkin and payload.guest_name:
        clean_guest = payload.guest_name.split('/')[0].strip()
        target_tv.guest_name = clean_guest
        target_tv.uh_number = clean_uh
        current_settings["guest_name"] = clean_guest
        current_settings["room_status"] = "Occupied"
        current_settings["welcome_title"] = payload.welcome_title or f"Sr(a). {clean_guest}, Bem-vindo(a) ao Fasano"
        new_status = "Occupied"
    else:
        clean_guest = None
        target_tv.guest_name = None
        target_tv.uh_number = clean_uh
        current_settings.pop("guest_name", None)
        current_settings["room_status"] = "Vacant"
        current_settings["welcome_title"] = payload.welcome_title or "Seja Bem-vindo(a) ao Fasano"
        current_settings["checkout_cleanup_pending"] = True
        new_status = "Vacant"

    if payload.welcome_subtitle:
        current_settings["welcome_subtitle"] = payload.welcome_subtitle

    target_tv.custom_settings = current_settings
    target_tv.updated_at = datetime.utcnow()

    action_label = "CHECK_IN" if is_checkin else "CHECK_OUT"
    log = DeviceLog(
        tv_id=target_tv.id,
        event_type=f"PMS_{action_label}",
        message=f"PMS Quick Sync: UH {clean_uh} [{old_guest or 'Vago'} -> {clean_guest or 'Vago'}]"
    )
    db.add(log)

    await record_audit_log(
        db=db,
        request=request,
        action=f"PMS_{action_label}",
        entity="SmartTV",
        entity_id=str(target_tv.id),
        entity_name=target_tv.name,
        description=f"UH {clean_uh} sincronizada: '{old_guest or 'Quarto Vago'}' ➔ '{clean_guest or 'Quarto Vago'}'"
    )

    fias_service.log_timeline(
        "DIFF", "SUCCESS", f"Sincronização Rápida UH {clean_uh}: {old_guest or 'Vago'} ➔ {clean_guest or 'Vago'}",
        f"Ação manual ({action_label}) aplicada: Quarto {clean_uh} alterado de '{old_guest or 'Quarto Vago'}' para '{clean_guest or 'Quarto Vago'}'. Status: {old_status} ➔ {new_status}.",
        uh=clean_uh
    )

    await db.commit()
    await db.refresh(target_tv)

    if target_tv.ip_address:
        import asyncio
        asyncio.create_task(
            fias_service._trigger_remote_cleanup(
                target_tv.id,
                target_tv.ip_address,
                clean_uh,
                f"PMS Manual {action_label}"
            )
        )

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

def extract_rooms_from_excel(raw_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extrai lista de quartos diretamente de arquivos Excel (.xlsx, .xlsm, .xltx)
    Mapeia colunas como 'room', 'room_type', 'room_status'.
    """
    import io
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
    sheet = wb.active
    detected = []

    col_room = -1
    col_type = -1
    col_status = -1
    col_guest = -1
    header_found = False

    for row in sheet.iter_rows(values_only=True):
        if not row or all(v is None for v in row):
            continue

        row_strs = [str(c).strip() if c is not None else "" for c in row]
        low_cells = [c.lower() for c in row_strs]

        # 1. Identificar linha de cabeçalho
        if not header_found:
            for idx, c in enumerate(low_cells):
                if not c:
                    continue
                if any(k in c for k in ["type", "tipo", "category", "categoria"]):
                    col_type = idx
                elif any(k in c for k in ["status", "fo status", "hk status", "situa", "situação"]):
                    col_status = idx
                elif any(k in c for k in ["guest", "hospede", "hóspede", "name", "nome"]):
                    col_guest = idx
                elif c in ["room", "room_number", "quarto", "uh", "apt", "unit", "habitación"] or any(k in c for k in ["room", "quarto", "uh"]):
                    if "type" not in c and "status" not in c:
                        col_room = idx

            # Se a primeira linha já contiver dados numéricos (ex: 101, SWC, Vacant) sem cabeçalho explícito
            if re.match(r"^[0-9]{2,5}[A-Za-z]?$", row_strs[0]):
                col_room = 0
                if len(row) > 1: col_type = 1
                if len(row) > 2: col_status = 2
                header_found = True

        # 2. Linha de dados
        raw_val = row[col_room] if (col_room != -1 and col_room < len(row)) else (row[0] if len(row) > 0 else None)
        if raw_val is None:
            continue

        # Tratar floats do Excel (ex: 101.0 -> "101") ou ints (101 -> "101")
        if isinstance(raw_val, float) and raw_val.is_integer():
            clean_room = str(int(raw_val)).strip()
        elif isinstance(raw_val, int):
            clean_room = str(raw_val).strip()
        else:
            clean_room = str(raw_val).strip()

        # Ignorar linhas de cabeçalho repetidas ou vazias
        if not clean_room or clean_room.lower() in ["room", "quarto", "uh", "total", "room_number"]:
            continue

        if not re.match(r"^[A-Za-z0-9\-_]{1,10}$", clean_room):
            continue

        rtype = str(row[col_type]).strip() if (col_type != -1 and col_type < len(row) and row[col_type] is not None) else ""
        status = str(row[col_status]).strip() if (col_status != -1 and col_status < len(row) and row[col_status] is not None) else ""
        guest = str(row[col_guest]).strip() if (col_guest != -1 and col_guest < len(row) and row[col_guest] is not None) else None

        if guest:
            guest = guest.split('/')[0].strip()
            if guest.lower() in ["vacant", "vago", "limpo", "sujo", "clean", "dirty", "-", "null", "none"]:
                guest = None

        if not any(d["uh"] == clean_room for d in detected):
            detected.append({
                "uh": clean_room,
                "guest_name": guest,
                "room_type": rtype,
                "status": status
            })

    return detected

@router.get("/template-excel")
async def download_template_excel():
    """Gera e retorna a planilha modelo Excel (.xlsx) com as colunas room, room_type, room_status"""
    import io
    import openpyxl
    from fastapi.responses import Response

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Quartos"

    # Cabeçalho exato solicitado
    ws.append(["room", "room_type", "room_status"])

    # Exemplos idênticos à planilha do usuário
    sample_data = [
        [101, "SWC", "Vacant"],
        [102, "SUP", "Vacant"],
        [103, "SUP", "Vacant"],
        [104, "SWC", "Vacant"],
        [105, "SJR", "Occupied"],
        [106, "SJR", "Vacant"],
        [107, "DLXM", "Vacant"],
        [108, "SJR", "Vacant"],
        [109, "TWD", "Vacant"],
        [110, "DLX", "Vacant"],
        [111, "DLX", "Vacant"]
    ]
    for r in sample_data:
        ws.append(r)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=modelo_importacao_quartos.xlsx"}
    )

@router.get("/template-csv")
async def download_template_csv():
    """Gera e retorna o modelo em CSV com as colunas room, room_type, room_status"""
    from fastapi.responses import Response
    csv_content = (
        "room,room_type,room_status\n"
        "101,SWC,Vacant\n"
        "102,SUP,Vacant\n"
        "103,SUP,Vacant\n"
        "104,SWC,Vacant\n"
        "105,SJR,Occupied\n"
        "106,SJR,Vacant\n"
        "107,DLXM,Vacant\n"
        "108,SJR,Vacant\n"
        "109,TWD,Vacant\n"
        "110,DLX,Vacant\n"
        "111,DLX,Vacant\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modelo_importacao_quartos.csv"}
    )

@router.post("/import-opera-file")
async def import_opera_file(
    file: UploadFile = File(...),
    group_id: Optional[int] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Importação Automática da Carga de UHs do Opera PMS / Planilha:
    Suporta Planilhas Excel (.xlsx), CSV, TXT ou Relatório PDF do Opera.
    Colunas esperadas da planilha: 'room', 'room_type', 'room_status'.
    Atribuições de grupos são 100% manuais (nenhuma regra automática).
    """
    raw_bytes = await file.read()
    filename_lower = (file.filename or "").lower()

    # 1. Suporte a Planilha Excel (.xlsx, .xlsm, .xltx ou ZIP magic bytes)
    if (filename_lower.endswith((".xlsx", ".xlsm", ".xltx")) or raw_bytes.startswith(b"PK\x03\x04")) and not filename_lower.endswith(".pdf"):
        try:
            detected_rooms = extract_rooms_from_excel(raw_bytes)
            if detected_rooms:
                return await save_detected_rooms(detected_rooms, group_id, request, db)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao processar planilha Excel: {str(e)}"
            )

    # 2. Suporte a relatórios em PDF do Opera (ex: HouseKeeping Details.pdf)
    text = ""
    if filename_lower.endswith(".pdf") or raw_bytes.startswith(b"%PDF"):
        try:
            import io
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw_bytes))
            pages_text = []
            for p in reader.pages:
                extracted = p.extract_text()
                if extracted:
                    pages_text.append(extracted)
            text = "\n".join(pages_text)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao extrair conteúdo do PDF exportado do Opera: {str(e)}"
            )

    # 3. Suporte a texto plano (CSV / TSV / TXT)
    if not text:
        for enc in ['utf-8-sig', 'utf-8', 'latin1', 'cp1252']:
            try:
                text = raw_bytes.decode(enc)
                break
            except Exception:
                continue

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível ler o arquivo. Formatos suportados: Planilha Excel (.xlsx), CSV, TXT, PDF."
        )

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
    O usuário pode colar linhas de CSV/tabela com as colunas: room, room_type, room_status.
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

    detected_rooms = []
    header_found = False
    col_room = -1
    col_guest = -1
    col_type = -1
    col_status = -1

    for line in lines:
        # 1. Padrão específico para relatórios do Opera em PDF / texto (ex: HouseKeeping Details / Room Status)
        # Ex: "101 SWC Clean 1 / 1 VAC Not Reserved" ou "107 DLXM Clean 1 / 1 VAC Not Reserved"
        opera_hk_match = re.match(
            r'^\s*([0-9]{2,5}[A-Za-z]?)\s+([A-Za-z0-9_-]{2,8})\s+(Clean|Dirty|Inspected|Pickup|OOO|Out of Order|Vago|Limpo|Sujo|Occupied|Vacant)\b(.*)$',
            line,
            re.IGNORECASE
        )
        if opera_hk_match:
            raw_room, rtype, hk_status, rest = opera_hk_match.groups()
            if not any(d["uh"] == raw_room for d in detected_rooms):
                detected_rooms.append({
                    "uh": raw_room,
                    "guest_name": None,
                    "room_type": rtype.upper(),
                    "status": hk_status
                })
                continue

        # 2. Detectar delimitador CSV/TSV/Pipe
        sep = ',' if ',' in line else (';' if ';' in line else ('\t' if '\t' in line else ('|' if '|' in line else None)))
        
        if sep:
            cols = [c.strip().strip('"').strip("'") for c in line.split(sep)]
            low_cols = [c.lower() for c in cols]

            # Detectar linha de cabeçalho
            if not header_found:
                for idx, c in enumerate(low_cols):
                    clean_c = c.strip()
                    if any(k in clean_c for k in ['type', 'tipo', 'category', 'categoria']):
                        col_type = idx
                    elif any(k in clean_c for k in ['status', 'fo status', 'hk status', 'situa', 'situação']):
                        col_status = idx
                    elif any(k in clean_c for k in ['guest', 'hospede', 'hóspede', 'name', 'nome']):
                        col_guest = idx
                    elif clean_c in ['room', 'room_number', 'quarto', 'uh', 'apt', 'unit', 'habitación'] or any(k in clean_c for k in ['room', 'quarto', 'uh']):
                        if 'type' not in clean_c and 'status' not in clean_c:
                            col_room = idx

                if col_room != -1:
                    header_found = True
                    continue

            # Se cabeçalho foi encontrado e temos a coluna de quarto
            if header_found and col_room < len(cols):
                raw_room = cols[col_room].strip()
                if raw_room and re.match(r'^[A-Za-z0-9\-_]{1,10}$', raw_room) and not raw_room.lower() in ['room', 'quarto', 'uh', 'total']:
                    guest = cols[col_guest].strip() if (col_guest != -1 and col_guest < len(cols)) else None
                    rtype = cols[col_type].strip() if (col_type != -1 and col_type < len(cols)) else ""
                    status = cols[col_status].strip() if (col_status != -1 and col_status < len(cols)) else ""
                    
                    if guest and guest.lower() in ['vacant', 'vago', 'limpo', 'sujo', 'clean', 'dirty', '-', 'null', 'none']:
                        guest = None

                    detected_rooms.append({
                        "uh": raw_room,
                        "guest_name": guest,
                        "room_type": rtype,
                        "status": status
                    })
                    continue

        # 3. Fallback para linhas sem delimitador padrão
        match = re.search(r'\b(?:UH|Quarto|Apt|Room)?\s*([0-9]{2,5}[A-Za-z]?)\b', line, re.IGNORECASE)
        if match:
            raw_room = match.group(1).strip()
            after_text = line[match.end():].strip(' -|:;,')
            guest = after_text if len(after_text) > 3 and not re.match(r'^[0-9\s/.-]+$', after_text) else None
            
            if not any(d["uh"] == raw_room for d in detected_rooms):
                detected_rooms.append({
                    "uh": raw_room,
                    "guest_name": guest,
                    "room_type": "",
                    "status": ""
                })

    return await save_detected_rooms(detected_rooms, override_group_id, request, db)

async def save_detected_rooms(
    detected_rooms: List[Dict[str, Any]],
    override_group_id: Optional[int],
    request: Request,
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Grava ou atualiza as UHs detectadas.
    IMPORTANTE: Atribuição de grupos é 100% manual.
    Nenhuma regra automática associa categorias (como DLXM ou TWDM) a grupos.
    Se um grupo for selecionado no momento da importação (override_group_id),
    ele será aplicado; caso contrário, as TVs ficam como 'Sem Grupo' (group_id = None).
    """
    if not detected_rooms:
        raise HTTPException(
            status_code=400,
            detail="Não foi possível identificar quartos no arquivo fornecido. Certifique-se de que há as colunas: room, room_type, room_status."
        )

    # 1. Carregar grupos existentes
    grp_res = await db.execute(select(TVGroup))
    all_groups = grp_res.scalars().all()
    target_group = None
    if override_group_id:
        target_group = next((g for g in all_groups if g.id == override_group_id), None)

    group_name = target_group.name if target_group else "Sem Grupo"
    group_id_val = target_group.id if target_group else None

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

    # 3. Criar ou Atualizar TVs no banco
    created_count = 0
    updated_count = 0
    imported_list = []

    for item in detected_rooms:
        clean_uh = item["uh"]
        key = clean_uh.lower()
        guest = item.get("guest_name")
        rtype = item.get("room_type") or ""
        status = item.get("status") or ""

        clean_code = f"UH-{clean_uh.zfill(4)}"

        if key in tv_by_uh:
            # TV já existe -> Atualiza informações preservando o grupo manual atual
            tv = tv_by_uh[key]
            cust = dict(tv.custom_settings or {})
            cust["uh_number"] = clean_uh
            if rtype:
                cust["room_type"] = rtype
            if status:
                cust["room_status"] = status

            if guest:
                old_guest = tv.guest_name
                tv.guest_name = guest
                cust["guest_name"] = guest
                cust["room_status"] = "Occupied"
                cust["welcome_title"] = f"Sr(a). {guest}, Bem-vindo(a) ao Fasano"
                if (old_guest or "").strip().lower() != guest.strip().lower():
                    fias_service.log_timeline(
                        "DIFF", "SUCCESS", f"Planilha Diff UH {clean_uh}: {old_guest or 'Vago'} ➔ {guest}",
                        f"Importação de planilha atualizou UH {clean_uh} de '{old_guest or 'Quarto Vago'}' para '{guest}'.",
                        uh=clean_uh
                    )

            tv.custom_settings = cust
            tv.pms_enabled = True

            # Se o usuário escolheu explicitamente um grupo na tela de importação, atualiza
            if override_group_id and target_group:
                tv.group_id = target_group.id
                tv.room_group = target_group.name

            updated_count += 1
            imported_list.append({
                "uh": clean_uh,
                "action": "UPDATED",
                "room_type": rtype,
                "status": status,
                "guest": guest,
                "group": tv.room_group or "Sem Grupo"
            })
        else:
            # TV nova -> Criar sem vincular a nenhum grupo automático
            new_settings = {
                "uh_number": clean_uh,
                "room_type": rtype,
                "room_status": status,
                "welcome_title": f"Sr(a). {guest}, Bem-vindo(a) ao Fasano" if guest else "Seja Bem-vindo(a) ao Fasano",
                "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
                "pin_code": "0000"
            }
            if guest:
                new_settings["guest_name"] = guest

            new_tv = SmartTV(
                device_id=f"UH-{clean_uh}",
                name=f"Quarto {clean_uh}",
                room_group=group_name,
                group_id=group_id_val,
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
            imported_list.append({
                "uh": clean_uh,
                "action": "CREATED",
                "room_type": rtype,
                "status": status,
                "guest": guest,
                "group": group_name
            })

    await db.commit()

    if request:
        await record_audit_log(
            db=db,
            request=request,
            action="PMS_ROOMS_IMPORT",
            entity="SmartTV",
            entity_id=f"IMPORT-{len(detected_rooms)}",
            entity_name=f"Importação de {len(detected_rooms)} UHs",
            description=f"Importadas informações de {len(detected_rooms)} quartos: {created_count} criadas, {updated_count} atualizadas. Atribuição de grupos manual."
        )

    return {
        "status": "success",
        "message": f"Importação concluída com sucesso! {created_count} novas TVs geradas, {updated_count} quartos atualizados.",
        "total_detected": len(detected_rooms),
        "created_count": created_count,
        "updated_count": updated_count,
        "samples": imported_list[:15]
    }




