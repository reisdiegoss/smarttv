import asyncio
import logging
import re
import socket
from collections import deque
from datetime import datetime
from typing import Optional, Dict, Any, List
import xml.etree.ElementTree as ET

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.schema import SmartTV, DeviceLog

logger = logging.getLogger("FIASService")

class FIASService:
    def __init__(self, host: str = "192.168.162.18", port: int = 5020):
        self.host = host
        self.port = port
        self.is_running = False
        self.is_connected = False
        self.last_heartbeat: Optional[datetime] = None
        self.last_event: Optional[Dict[str, Any]] = None
        self.last_resync_time: Optional[datetime] = None
        self.synced_events_count: int = 0
        self.packets_sent_count: int = 0
        self.packets_recv_count: int = 0
        self.errors_count: int = 0
        self.socket_state: str = "DESCONECTADO"

        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._task: Optional[asyncio.Task] = None
        
        # Buffer de eventos para Timeline ao vivo (máx 300 eventos)
        self.timeline: deque = deque(maxlen=300)
        self._event_id_seq: int = 1

    def log_timeline(
        self,
        category: str,
        level: str,
        title: str,
        details: str,
        raw_packet: Optional[str] = None,
        uh: Optional[str] = None
    ):
        """Registra um evento na timeline ativa para visualização pelo operador"""
        now = datetime.now()
        event = {
            "id": self._event_id_seq,
            "timestamp": now.isoformat(),
            "time_str": now.strftime("%H:%M:%S"),
            "category": category, # SOCKET, HANDSHAKE, RESYNC, GUEST, PACKET, ERROR, DIAGNOSTIC
            "level": level,       # SUCCESS, INFO, WARNING, ERROR
            "title": title,
            "details": details,
            "raw_packet": raw_packet,
            "uh": uh
        }
        self._event_id_seq += 1
        self.timeline.append(event)
        
        if level == "ERROR":
            self.errors_count += 1
            logger.error(f"[FIAS Timeline] {title}: {details}")
        elif level == "WARNING":
            logger.warning(f"[FIAS Timeline] {title}: {details}")
        else:
            logger.info(f"[FIAS Timeline] {title}: {details}")

    def clear_timeline(self):
        """Limpa o histórico de eventos da timeline"""
        self.timeline.clear()
        self.log_timeline("INFO", "INFO", "Timeline Reiniciada", "Histórico de logs do resync foi limpo pelo usuário.")

    def update_config(self, host: Optional[str] = None, port: Optional[int] = None):
        """Atualiza host e porta de conexão com o IFC8 e reinicia o socket se necessário"""
        changed = False
        if host and host != self.host:
            self.host = host.strip()
            changed = True
        if port and port != self.port:
            self.port = int(port)
            changed = True

        if changed:
            self.log_timeline(
                "SOCKET", "INFO", "Configuração Atualizada",
                f"Servidor IFC8 redefinido para {self.host}:{self.port}. Reiniciando conexão..."
            )
            # Reconectar no novo endereço
            if self.is_running:
                self.stop()
                self.start()

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.socket_state = "CONECTANDO"
            self._task = asyncio.create_task(self._run_loop())
            self.log_timeline(
                "SOCKET", "INFO", "Ouvinte FIAS Iniciado",
                f"Serviço de escuta contínua ativado para {self.host}:{self.port}"
            )

    def stop(self):
        self.is_running = False
        self.socket_state = "DESCONECTADO"
        if self._writer:
            try:
                self._writer.close()
            except Exception:
                pass
        if self._task:
            self._task.cancel()
            self._task = None
        self.is_connected = False
        self.log_timeline("SOCKET", "INFO", "Ouvinte FIAS Parado", "Conexão socket encerrada.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": self.is_running,
            "connected": self.is_connected,
            "host": self.host,
            "port": self.port,
            "socket_state": self.socket_state,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "last_resync_time": self.last_resync_time.isoformat() if self.last_resync_time else None,
            "last_event": self.last_event,
            "synced_events_count": self.synced_events_count,
            "packets_sent_count": self.packets_sent_count,
            "packets_recv_count": self.packets_recv_count,
            "errors_count": self.errors_count
        }

    def get_timeline_data(self, limit: int = 150) -> Dict[str, Any]:
        """Retorna os eventos da timeline e o status atual para a interface web"""
        events = list(self.timeline)[-limit:]
        return {
            "status": self.get_status(),
            "timeline": events
        }

    async def _send_packet(self, text: str):
        """Transmite um pacote no padrão FIAS delimitado por STX (0x02) e ETX (0x03)"""
        if self._writer:
            try:
                payload = f"\x02{text}\x03".encode('latin1')
                self._writer.write(payload)
                await self._writer.drain()
                self.packets_sent_count += 1
                self.log_timeline(
                    "PACKET", "INFO", f"Pacote Enviado ({text[:15]}...)",
                    f"Frame transmitido para {self.host}:{self.port}",
                    raw_packet=text
                )
            except Exception as e:
                self.log_timeline(
                    "ERROR", "ERROR", "Falha no Envio de Pacote",
                    f"Erro de socket ao transmitir: {str(e)}",
                    raw_packet=text
                )

    async def _run_loop(self):
        """Loop contínuo de conexão e recepção assíncrona de pacotes do IFC8"""
        while self.is_running:
            try:
                self.socket_state = "CONECTANDO"
                self.log_timeline(
                    "SOCKET", "INFO", "Tentando Conectar ao IFC8",
                    f"Abrindo socket TCP em {self.host}:{self.port}..."
                )

                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.host, self.port),
                    timeout=6.0
                )
                self.is_connected = True
                self.socket_state = "CONECTADO"
                self.last_heartbeat = datetime.utcnow()
                
                self.log_timeline(
                    "SOCKET", "SUCCESS", "Conexão TCP Estabelecida",
                    f"Socket conectado com sucesso a {self.host}:{self.port}. Aguardando Link Start (LS) do IFC8..."
                )

                buffer = bytearray()
                while self.is_running:
                    chunk = await self._reader.read(2048)
                    if not chunk:
                        self.log_timeline(
                            "SOCKET", "WARNING", "Conexão Encerrada pelo IFC8",
                            f"O servidor remoto {self.host}:{self.port} encerrou o fluxo de dados (EOF)."
                        )
                        break

                    buffer.extend(chunk)
                    while b'\x03' in buffer:
                        idx_etx = buffer.index(b'\x03')
                        packet = buffer[:idx_etx]
                        buffer = buffer[idx_etx + 1:]

                        if b'\x02' in packet:
                            idx_stx = packet.index(b'\x02')
                            record_raw = packet[idx_stx + 1:].decode('latin1', errors='replace').strip()
                            if record_raw:
                                self.packets_recv_count += 1
                                await self._handle_fias_record(record_raw)

            except asyncio.CancelledError:
                break
            except ConnectionResetError:
                self.is_connected = False
                self.socket_state = "RESET_BY_PEER"
                self.log_timeline(
                    "ERROR", "ERROR", "Conexão Reiniciada (Reset by Peer)",
                    f"O servidor {self.host}:{self.port} rejeitou a conexão com RST (Errno 104). "
                    f"Isso ocorre se o IFC8 só aceitar outro IP, se a porta estiver travada, ou se o driver estiver em outra porta (ex: 5001)."
                )
            except Exception as e:
                self.is_connected = False
                self.socket_state = "ERRO"
                self.log_timeline(
                    "SOCKET", "WARNING", "Falha de Conexão Socket",
                    f"Erro ao comunicar com {self.host}:{self.port}: {str(e)}. Nova tentativa em 12s..."
                )
            finally:
                self.is_connected = False
                if self._writer:
                    try:
                        self._writer.close()
                        await self._writer.wait_closed()
                    except Exception:
                        pass
                    self._writer = None
                    self._reader = None

            if self.is_running:
                await asyncio.sleep(12)

    async def _handle_fias_record(self, record: str):
        """Processa um pacote recebido do Opera/IFC8 (suporta ASCII FIAS e XML FIAS)"""
        now = datetime.now()
        da = now.strftime("%y%m%d")
        ti = now.strftime("%H%M%S")
        self.last_heartbeat = datetime.utcnow()

        # 1. PROCESSAR PACOTES XML (ex: <LinkStart .../>, <GuestCheckIn .../>)
        if record.startswith("<"):
            await self._handle_xml_record(record, da, ti)
            return

        # 2. PROCESSAR PACOTES ASCII FIAS PADRÃO (ex: GI|RN101|GNReis|GS...)
        parts = record.split('|')
        if not parts:
            return

        cmd = parts[0].upper()
        fields = {}
        for p in parts[1:]:
            if len(p) >= 2:
                key = p[:2].upper()
                val = p[2:]
                fields[key] = val

        self.log_timeline(
            "PACKET", "INFO", f"Comando FIAS Recebido: {cmd}",
            f"Campos: {list(fields.keys())}",
            raw_packet=record
        )

        if cmd == "LS":
            self.log_timeline(
                "HANDSHAKE", "SUCCESS", "Link Start (LS) Recebido",
                "IFC8 iniciou handshake. Enviando Link Description (LD), Link Records (LR) e Link Alive (LA)...",
                raw_packet=record
            )
            await self._send_packet(f"LD|DA{da}|TI{ti}|V#01.00|IFTV|")
            await self._send_packet("LR|RIGI|FLRNGNG#GSGL|")
            await self._send_packet("LR|RIGO|FLRN|")
            await self._send_packet("LR|RIGC|FLRNGNG#GSGL|")
            await self._send_packet("LR|RIDR|FLRN|")
            await self._send_packet("LR|RIDS|")
            await self._send_packet("LR|RIDE|")
            await self._send_packet("LR|RILA|")
            await self._send_packet(f"LA|DA{da}|TI{ti}|")

            # Solicita resync automático após o handshake se for inicialização
            await asyncio.sleep(0.5)
            await self._send_packet(f"DR|DA{da}|TI{ti}|")
            self.log_timeline(
                "RESYNC", "INFO", "DR Automático Pós-Handshake",
                "Comando de Database Resync (DR) transmitido automaticamente para obter hóspedes ativos."
            )

        elif cmd == "LA":
            self.log_timeline(
                "HANDSHAKE", "INFO", "Link Alive (LA / Heartbeat)",
                "IFC8 enviou pulso de vida. Respondendo com LA...",
                raw_packet=record
            )
            await self._send_packet(f"LA|DA{da}|TI{ti}|")

        elif cmd == "DS":
            self.log_timeline(
                "RESYNC", "SUCCESS", "Início de Database Resync (DS)",
                "O Opera PMS iniciou o envio dos hóspedes ativos em lote!",
                raw_packet=record
            )

        elif cmd in ("DE", "RE"):
            self.last_resync_time = datetime.utcnow()
            self.log_timeline(
                "RESYNC", "SUCCESS", f"Fim de Database Resync ({cmd})",
                f"Sincronização de hóspedes concluída com sucesso! Total eventos processados: {self.synced_events_count}",
                raw_packet=record
            )

        elif cmd in ("GI", "GC"):
            rn = fields.get("RN")
            gn = fields.get("GN", "").strip()
            gs = fields.get("GS", "").strip().upper()
            guest_num = fields.get("G#", "").strip()

            # GN é o nome ou sobrenome real retornado pelo Opera (ex: "Serapiao", "Rosa", "Hornby")
            # GS é apenas a flag de share ('Y'/'N') e NUNCA deve ser usada como nome do hóspede!
            guest_name = gn if gn else "Hóspede"

            self.synced_events_count += 1
            self.last_event = {"type": cmd, "uh": rn, "guest_name": guest_name, "time": datetime.utcnow().isoformat()}

            self.log_timeline(
                "GUEST", "SUCCESS", f"Hóspede Check-In: UH {rn}",
                f"Hóspede '{guest_name}' vinculado à UH {rn} (Reserva: {guest_num or 'N/A'}, Share: {gs})",
                raw_packet=record,
                uh=rn
            )
            if rn:
                await self._sync_tv_guest(rn, guest_name, is_checkin=True, fields=fields)

        elif cmd == "GO":
            rn = fields.get("RN")
            self.synced_events_count += 1
            self.last_event = {"type": "CHECK_OUT", "uh": rn, "time": datetime.utcnow().isoformat()}

            self.log_timeline(
                "GUEST", "INFO", f"Hóspede Check-Out: UH {rn}",
                f"Check-out registrado. UH {rn} definida como vaga.",
                raw_packet=record,
                uh=rn
            )
            if rn:
                await self._sync_tv_guest(rn, None, is_checkin=False, fields=fields)

        elif cmd in ("WR", "RS"):
            rn = fields.get("RN")
            rs = fields.get("RS", "")
            self.log_timeline(
                "GUEST", "INFO", f"Status de UH ({cmd}): {rn}",
                f"Situação informada pelo Opera: {rs}",
                raw_packet=record,
                uh=rn
            )

    async def _handle_xml_record(self, record: str, da: str, ti: str):
        """Interpreta registros no formato XML emitidos pelo IFC8"""
        tag_match = re.search(r'<([A-Za-z0-9_-]+)', record)
        if not tag_match:
            return

        tag_name = tag_match.group(1)
        tag_lower = tag_name.lower()

        # Parse atributos simples via regex
        attrs = dict(re.findall(r'([A-Za-z0-9_-]+)=["\']([^"\']*)["\']', record))
        attrs_lower = {k.lower(): v for k, v in attrs.items()}

        self.log_timeline(
            "PACKET", "INFO", f"XML IFC8 Recebido: <{tag_name}>",
            f"Atributos: {list(attrs.keys())}",
            raw_packet=record
        )

        if "linkstart" in tag_lower:
            self.log_timeline(
                "HANDSHAKE", "SUCCESS", "XML LinkStart Recebido",
                "IFC8 abriu sessão XML. Respondendo com LinkDescription e LinkAlive...",
                raw_packet=record
            )
            await self._send_packet(f'<LinkDescription Date="{da}" Time="{ti}" InterfaceFamily="TV" VerNum="1.00"/>')
            await self._send_packet(f'<LinkAlive Date="{da}" Time="{ti}"/>')

        elif "linkalive" in tag_lower:
            self.log_timeline(
                "HANDSHAKE", "INFO", "XML LinkAlive (Heartbeat)",
                "Pulso de vida XML recebido do IFC8. Respondendo com LinkAlive...",
                raw_packet=record
            )
            await self._send_packet(f'<LinkAlive Date="{da}" Time="{ti}"/>')

        elif "linkend" in tag_lower:
            self.log_timeline(
                "WARNING", "WARNING", "XML LinkEnd Recebido do IFC8",
                "O IFC8 encerrou a sessão com LinkEnd.",
                raw_packet=record
            )

        elif any(k in tag_lower for k in ["guestcheckin", "guestdata", "checkin"]):
            rn = attrs_lower.get("roomnumber") or attrs_lower.get("room") or attrs_lower.get("rn")
            guest = attrs_lower.get("guestname") or attrs_lower.get("gn") or attrs_lower.get("name")
            if rn:
                guest_clean = guest or "Hóspede"
                self.synced_events_count += 1
                self.log_timeline(
                    "GUEST", "SUCCESS", f"XML Check-in: UH {rn}",
                    f"Hóspede '{guest_clean}' sincronizado via XML FIAS!",
                    raw_packet=record,
                    uh=rn
                )
                await self._sync_tv_guest(rn, guest_clean, is_checkin=True, fields=attrs)

        elif any(k in tag_lower for k in ["guestcheckout", "checkout"]):
            rn = attrs_lower.get("roomnumber") or attrs_lower.get("room") or attrs_lower.get("rn")
            if rn:
                self.synced_events_count += 1
                self.log_timeline(
                    "GUEST", "INFO", f"XML Check-out: UH {rn}",
                    f"Check-out recebido. UH {rn} definida como vaga.",
                    raw_packet=record,
                    uh=rn
                )
                await self._sync_tv_guest(rn, None, is_checkin=False, fields=attrs)

    async def request_database_resync(self, room_number: Optional[str] = None) -> bool:
        """Dispara a solicitação oficial de Database Resync (DR) ao IFC8/Opera"""
        now = datetime.now()
        da = now.strftime("%y%m%d")
        ti = now.strftime("%H%M%S")
        uh_target = room_number.strip() if room_number else "ALL"

        self.log_timeline(
            "RESYNC", "INFO", f"Disparando Resync (DR) para UH {uh_target}",
            f"Solicitando ao Opera envio de todos os hóspedes ativos via {self.host}:{self.port}..."
        )

        # Se o loop contínuo ainda não conectou, aguarda até 8 segundos
        if not self.is_connected or not self._writer:
            self.log_timeline(
                "WARNING", "WARNING", "Socket Conectando em Segundo Plano",
                f"Aguardando o link ativo com {self.host}:{self.port}..."
            )
            for _ in range(16):
                if self.is_connected and self._writer:
                    break
                await asyncio.sleep(0.5)

        if not self.is_connected or not self._writer:
            self.log_timeline(
                "ERROR", "ERROR", "Socket Desconectado para Resync",
                f"Não foi possível transmitir o comando DR: socket não conectado em {self.host}:{self.port}."
            )
            return False

        # Envia pacote DR padrão ASCII (ou XML se conectado na porta XML 5001)
        if self.port == 5001:
            pkt = f'<DatabaseResync Date="{da}" Time="{ti}"/>'
        elif room_number:
            pkt = f"DR|DA{da}|TI{ti}|RN{room_number.strip()}|"
        else:
            pkt = f"DR|DA{da}|TI{ti}|"

        await self._send_packet(pkt)

        self.last_resync_time = datetime.utcnow()
        self.last_event = {
            "type": "RESYNC_REQUESTED",
            "uh": uh_target,
            "time": self.last_resync_time.isoformat()
        }

        self.log_timeline(
            "RESYNC", "SUCCESS", "Comando DR Transmitido",
            f"Solicitação de carga de hóspedes (DR) transmitida ao IFC8. "
            f"O Opera responderá com o início da transmissão (DS), quartos vagos (GO) e check-ins ativos (GI).",
            raw_packet=pkt
        )
        return True

    async def run_diagnostic(self, target_host: Optional[str] = None, test_ports: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """Realiza teste rápido e diagnóstico de conectividade nas portas do IFC8 com log na timeline"""
        h = target_host or self.host
        ports = test_ports or [5020, 5001, 5010, 5060]

        self.log_timeline(
            "DIAGNOSTIC", "INFO", "Iniciando Diagnóstico IFC8",
            f"Testando conectividade de portas em {h} ({ports})..."
        )

        results = []
        for p in ports:
            port_info = {"port": p, "open": False, "banner": None, "detail": ""}
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(h, p),
                    timeout=2.0
                )
                port_info["open"] = True

                # Tenta ler banner ou resposta inicial
                try:
                    data = await asyncio.wait_for(reader.read(512), timeout=1.5)
                    if data:
                        port_info["banner"] = repr(data)
                except asyncio.TimeoutError:
                    pass

                writer.close()
                await writer.wait_closed()
                
                status_msg = f"Porta {p}: ABERTA"
                if port_info["banner"]:
                    status_msg += f" (Banner: {port_info['banner']})"

                self.log_timeline(
                    "DIAGNOSTIC", "SUCCESS", f"Porta {p} Aberta",
                    f"Conexão TCP aceita em {h}:{p}. {port_info['banner'] or 'Pronta para tráfego'}"
                )
                port_info["detail"] = status_msg
            except ConnectionResetError:
                port_info["detail"] = f"Porta {p}: Conexão reiniciada (Reset by peer - Errno 104)"
                self.log_timeline(
                    "DIAGNOSTIC", "WARNING", f"Porta {p} Reiniciada (RST)",
                    f"Servidor aceitou e em seguida enviou TCP Reset (Errno 104). "
                    f"Geralmente indica filtro por IP de origem no IFC8 ou driver exclusivo."
                )
            except Exception as e:
                port_info["detail"] = f"Porta {p}: Fechada ou timeout ({str(e)})"
                self.log_timeline(
                    "DIAGNOSTIC", "INFO", f"Porta {p} Indisponível",
                    f"Falha ao conectar: {str(e)}"
                )

            results.append(port_info)

        self.log_timeline(
            "DIAGNOSTIC", "SUCCESS", "Diagnóstico Finalizado",
            f"Varredura concluída para {len(ports)} portas em {h}."
        )
        return results

    async def _sync_tv_guest(self, uh: str, guest_name: Optional[str], is_checkin: bool, fields: Optional[Dict[str, Any]] = None):
        """Salva a UH e o hóspede correspondente no banco de dados da aplicação"""
        clean_uh = str(uh).strip()
        if not clean_uh:
            return

        from app.models.schema import TVGroup

        async with AsyncSessionLocal() as session:
            try:
                # 1. Localizar TV existente pela UH
                result = await session.execute(select(SmartTV))
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
                    # Comparação no nome: "Quarto 105"
                    name_nums = re.findall(r'\d+', tv.name)
                    if name_nums and name_nums[-1].lstrip('0') == clean_uh.lstrip('0'):
                        target_tv = tv
                        break

                if target_tv:
                    # Se TV tiver pms_enabled=False (ex: Institucional), ignora
                    if not getattr(target_tv, 'pms_enabled', True):
                        self.log_timeline(
                            "GUEST", "INFO", f"UH {clean_uh} Ignorada",
                            f"TV '{target_tv.name}' possui pms_enabled=False (Modo Institucional Manual).",
                            uh=clean_uh
                        )
                        return

                    target_tv.uh_number = clean_uh
                    cust = dict(target_tv.custom_settings or {})
                    cust["uh_number"] = clean_uh

                    if is_checkin and guest_name:
                        # Regra: quando for necessário colocar '/', mantemos apenas o que vem antes da '/'
                        raw_guest = guest_name.split('/')[0].strip()

                        # Se for share e já tiver hóspede cadastrado, preserva o hóspede principal (o primeiro cadastrado)
                        existing = target_tv.guest_name
                        if existing and existing not in ("Hóspede", "Y", "N", ""):
                            final_guest = existing.split('/')[0].strip()
                        else:
                            final_guest = raw_guest

                        target_tv.guest_name = final_guest
                        cust["guest_name"] = final_guest
                        cust["room_status"] = "Occupied"
                        cust["welcome_title"] = f"Sr(a). {final_guest}, Bem-vindo(a) ao Fasano"
                    else:
                        target_tv.guest_name = None
                        cust.pop("guest_name", None)
                        cust["room_status"] = "Vacant"
                        cust["welcome_title"] = "Seja Bem-vindo(a) ao Fasano"

                    target_tv.custom_settings = cust
                    target_tv.updated_at = datetime.utcnow()

                    action_name = "CHECK_IN" if is_checkin else "CHECK_OUT"
                    log_msg = f"PMS Opera: UH {clean_uh} -> '{target_tv.guest_name or 'Quarto Vago'}'"
                    log = DeviceLog(tv_id=target_tv.id, event_type=f"PMS_{action_name}", message=log_msg)
                    session.add(log)

                    await session.commit()
                    self.log_timeline(
                        "GUEST", "SUCCESS", f"TV {target_tv.name} Atualizada",
                        f"Banco de dados sincronizado: Quarto {clean_uh} agora exibe '{target_tv.guest_name or 'Quarto Vago'}'.",
                        uh=clean_uh
                    )
                else:
                    # Se a TV NÃO existe no banco, criamos como Sem Grupo (atribuição 100% manual)
                    clean_code = f"UH-{clean_uh.zfill(4)}"
                    clean_guest = guest_name.split('/')[0].strip() if (is_checkin and guest_name) else None
                    new_settings = {
                        "uh_number": clean_uh,
                        "room_status": "Occupied" if (is_checkin and clean_guest) else "Vacant",
                        "welcome_title": f"Sr(a). {clean_guest}, Bem-vindo(a) ao Fasano" if (is_checkin and clean_guest) else "Seja Bem-vindo(a) ao Fasano",
                        "welcome_subtitle": "Aproveite a sua estadia com o melhor do entretenimento.",
                        "pin_code": "0000"
                    }
                    if is_checkin and clean_guest:
                        new_settings["guest_name"] = clean_guest

                    new_tv = SmartTV(
                        device_id=f"UH-{clean_uh}",
                        name=f"Quarto {clean_uh}",
                        room_group="Sem Grupo",
                        group_id=None,
                        uh_number=clean_uh,
                        guest_name=clean_guest,
                        pms_enabled=True,
                        pin_code="0000",
                        pairing_code=clean_code,
                        is_paired=False,
                        is_online=False,
                        custom_settings=new_settings
                    )
                    session.add(new_tv)
                    await session.flush()

                    log = DeviceLog(
                        tv_id=new_tv.id,
                        event_type="PMS_AUTO_CREATE_UH",
                        message=f"TV criada automaticamente a partir do Opera: UH {clean_uh} ('{guest_name or 'Quarto Vago'}')"
                    )
                    session.add(log)
                    await session.commit()
                    self.log_timeline(
                        "GUEST", "SUCCESS", f"Nova UH {clean_uh} Criada",
                        f"Smart TV gerada com código de pareamento {clean_code} vinculada ao hóspede '{guest_name or 'Quarto Vago'}'.",
                        uh=clean_uh
                    )

            except Exception as e:
                self.log_timeline(
                    "ERROR", "ERROR", f"Erro ao Gravar Hóspede UH {clean_uh}",
                    f"Exceção no banco de dados: {str(e)}",
                    uh=clean_uh
                )

fias_service = FIASService()
