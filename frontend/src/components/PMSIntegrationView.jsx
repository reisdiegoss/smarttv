import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Activity, Wifi, CheckCircle2, AlertCircle, RefreshCw, 
  Send, User, Key, Tv, ShieldCheck, ArrowRight, Clock, Server,
  Sparkles, Layers, CheckSquare, PlusCircle, RotateCw, Filter, Smartphone,
  FileText, UploadCloud, FileSpreadsheet, FolderUp, Download, Eye, FileUp,
  Terminal, Trash2, ArrowUpRight, ArrowDownLeft, AlertTriangle, Radio, Play, Pause,
  ChevronDown, ChevronRight, Copy, Check, Info, Zap
} from 'lucide-react';

export default function PMSIntegrationView({ tvs = [], groups = [], onRefresh, fetchHeaders }) {
  const [pmsStatus, setPmsStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Estados para Timeline Ativa do Resync & IFC8
  const [timeline, setTimeline] = useState([]);
  const [timelineStats, setTimelineStats] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState('ALL'); // ALL, GUEST, RESYNC, SOCKET, ERROR, PACKET
  const [autoScroll, setAutoScroll] = useState(true);
  const [showRawPackets, setShowRawPackets] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [selectedPort, setSelectedPort] = useState(5020);
  const timelineContainerRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);

  // Estados para Carga Inicial em Lote
  const [batchRanges, setBatchRanges] = useState('101-125, 201-225, 301-315');
  const [batchGroupId, setBatchGroupId] = useState('');
  const [batchPrefix, setBatchPrefix] = useState('Quarto');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  // Estados para Database Resync (DR) com o Opera PMS
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState(null);

  // Modo de Carga de UHs do Opera PMS: 'FILE' (Importar do Opera - Recomendado), 'IFC8' (Sincronização Direta DR)
  const [loadMode, setLoadMode] = useState('FILE');
  const [operaImportLoading, setOperaImportLoading] = useState(false);
  const [operaImportResult, setOperaImportResult] = useState(null);
  const [operaTextContent, setOperaTextContent] = useState('');
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Estados para Filtro da Tabela
  const [filterType, setFilterType] = useState('ALL'); // ALL, UH_ONLY, INSTITUTIONAL_ONLY

  // Form states para Sync Manual
  const [uhNumber, setUhNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [actionType, setActionType] = useState('CHECK_IN');
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [isManualUhInput, setIsManualUhInput] = useState(false);

  // Lista ordenada de UHs cadastradas para o dropdown de seleção rápida
  const registeredRooms = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    (tvs || []).forEach(tv => {
      const uh = (tv.uh_number || tv.custom_settings?.uh_number || '').trim();
      if (uh && !seen.has(uh.toLowerCase())) {
        seen.add(uh.toLowerCase());
        list.push({
          uh,
          name: tv.name || `Quarto ${uh}`,
          guest: tv.guest_name || tv.custom_settings?.guest_name || '',
          roomType: tv.custom_settings?.room_type || '',
          isOccupied: Boolean(tv.guest_name || tv.custom_settings?.guest_name)
        });
      }
    });

    return list.sort((a, b) => {
      const numA = parseInt(a.uh.replace(/\D/g, ''), 10);
      const numB = parseInt(b.uh.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.uh.localeCompare(b.uh);
    });
  }, [tvs]);


  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (batchGroupId) formData.append('group_id', batchGroupId);

    setOperaImportLoading(true);
    setOperaImportResult(null);

    try {
      const res = await fetch('/api/pms/import-opera-file', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {},
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao importar arquivo do Opera');
      }

      const data = await res.json();
      setOperaImportResult(data);
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (err) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      setOperaImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextImport = async () => {
    if (!operaTextContent.trim()) {
      alert('Cole o texto ou tabela exportada do Opera.');
      return;
    }

    setOperaImportLoading(true);
    setOperaImportResult(null);

    try {
      const res = await fetch('/api/pms/import-opera-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          content: operaTextContent.trim(),
          group_id: batchGroupId ? parseInt(batchGroupId) : null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao importar dados');
      }

      const data = await res.json();
      setOperaImportResult(data);
      setIsTextModalOpen(false);
      setOperaTextContent('');
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (err) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      setOperaImportLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/pms/status', {
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        setPmsStatus(data);
      }
    } catch (e) {
      console.error('Erro ao carregar status PMS:', e);
    }
  };

  const loadTimeline = async () => {
    try {
      const res = await fetch('/api/pms/timeline?limit=150', {
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
        if (data.status) {
          setTimelineStats(data.status);
          setPmsStatus(data.status);
          if (data.status.port) setSelectedPort(data.status.port);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar timeline PMS:', e);
    }
  };

  const handleClearTimeline = async () => {
    try {
      await fetch('/api/pms/timeline/clear', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      loadTimeline();
    } catch (e) {
      alert('Erro ao limpar timeline: ' + e.message);
    }
  };

  const handleChangePort = async (newPort) => {
    setSelectedPort(newPort);
    try {
      const res = await fetch('/api/pms/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({ port: parseInt(newPort) })
      });
      if (res.ok) {
        loadTimeline();
        loadStatus();
      }
    } catch (e) {
      alert('Erro ao alterar porta: ' + e.message);
    }
  };

  const handleRunDiagnostic = async () => {
    setDiagnosing(true);
    try {
      await fetch('/api/pms/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({ ports: [5020, 5001, 5010, 5060] })
      });
      loadTimeline();
    } catch (e) {
      alert('Erro no diagnóstico: ' + e.message);
    } finally {
      setDiagnosing(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadTimeline();
    const interval = setInterval(() => {
      loadStatus();
      loadTimeline();
    }, resyncing || diagnosing ? 1500 : 3500);
    return () => clearInterval(interval);
  }, [resyncing, diagnosing]);

  useEffect(() => {
    if (autoScroll && timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = timelineContainerRef.current.scrollHeight;
    }
  }, [timeline, autoScroll]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/pms/test-connection', {
        method: 'POST',
        headers: fetchHeaders ? fetchHeaders() : {}
      });
      const data = await res.json();
      setTestResult(data);
      loadStatus();
    } catch (e) {
      setTestResult({
        status: 'error',
        message: `Falha na requisição: ${e.message}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // 1. Carga Inicial em Lote (Gerar TVs para todas as UHs)
  const handleBatchCreateUHs = async (e) => {
    e.preventDefault();
    if (!batchRanges.trim()) {
      alert('Informe ao menos uma faixa de quartos (ex: 101-125).');
      return;
    }

    setBatchGenerating(true);
    setBatchResult(null);
    try {
      const res = await fetch('/api/pms/batch-create-uhs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          uh_ranges: batchRanges.trim(),
          group_id: batchGroupId ? parseInt(batchGroupId) : null,
          prefix: batchPrefix.trim() || 'Quarto',
          enable_pms: true
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao gerar UHs');
      }

      const data = await res.json();
      setBatchResult(data);
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (err) {
      alert(`Erro ao gerar UHs: ${err.message}`);
    } finally {
      setBatchGenerating(false);
    }
  };

  // 2. Database Resync com o Opera PMS (DR)
  const handleRequestResync = async () => {
    setResyncing(true);
    setResyncResult(null);
    try {
      const res = await fetch('/api/pms/request-resync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Falha ao solicitar resync');
      }

      setResyncResult(data);
      if (onRefresh) onRefresh();
      loadTimeline();
      loadStatus();
    } catch (err) {
      alert(`Aviso de Resync: ${err.message}`);
      loadTimeline();
    } finally {
      setResyncing(false);
    }
  };

  // 3. Sincronização Manual de UH
  const handleSyncUH = async (e) => {
    e.preventDefault();
    if (!uhNumber.trim()) {
      alert('Informe o número da UH (Quarto).');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/pms/sync-uh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          uh_number: uhNumber.trim(),
          guest_name: actionType === 'CHECK_IN' ? guestName.trim() : null,
          welcome_title: welcomeTitle.trim() || undefined,
          action: actionType
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao sincronizar UH');
      }

      const data = await res.json();
      alert(`Sucesso: ${data.message}`);
      setUhNumber('');
      setGuestName('');
      setWelcomeTitle('');
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // 4. Quick Checkout
  const handleQuickCheckout = async (uh) => {
    if (!window.confirm(`Confirma o Check-out da UH ${uh}? O nome do hóspede será removido e o título padrão restaurado na TV.`)) {
      return;
    }
    try {
      const res = await fetch('/api/pms/sync-uh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fetchHeaders ? fetchHeaders() : {})
        },
        body: JSON.stringify({
          uh_number: String(uh),
          action: 'CHECK_OUT'
        })
      });
      if (!res.ok) throw new Error('Falha ao realizar check-out');
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (e) {
      alert(`Erro: ${e.message}`);
    }
  };

  // Filtragem da Lista de TVs
  const filteredTvs = tvs.filter(tv => {
    const isUh = tv.pms_enabled !== false;
    if (filterType === 'UH_ONLY') return isUh;
    if (filterType === 'INSTITUTIONAL_ONLY') return !isUh;
    return true;
  });

  const uhTvsCount = tvs.filter(t => t.pms_enabled !== false).length;
  const instTvsCount = tvs.filter(t => t.pms_enabled === false).length;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color="var(--primary)" />
            Integração Hospitality PMS (Opera / IFC8 / FIAS)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Servidor IFC8 em 192.168.162.18 (Thexpos, Vingcard, Leucotron). Sincronização em tempo real de UH e Hóspede.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-primary"
            onClick={handleRequestResync}
            disabled={resyncing || !pmsStatus?.connected}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb' }}
            title="Solicita ao Opera envio de todas as UHs e hóspedes ativos agora"
          >
            <RotateCw size={15} className={resyncing ? 'spin' : ''} />
            {resyncing ? 'Solicitando...' : 'Sincronizar com Opera (DR)'}
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={loadStatus}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} /> Atualizar Status
          </button>
        </div>
      </div>

      {/* Grid de Cartões de Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Cartão 1: Servidor IFC8 */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Servidor de Integração
              </span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: '0.75rem',
                fontWeight: 600,
                background: pmsStatus?.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: pmsStatus?.connected ? '#10b981' : '#ef4444'
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: pmsStatus?.connected ? '#10b981' : '#ef4444' }} />
                {pmsStatus?.connected ? 'SOCKET CONECTADO' : 'AGUARDANDO'}
              </div>
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="var(--primary)" />
              {pmsStatus?.host || '192.168.162.18'}:{pmsStatus?.port || 5020}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Protocolo Oracle FIAS Pipe (Porta 5020) com handshake automático.
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem' }}
            >
              <Activity size={14} /> {testingConnection ? 'Testando Conexão...' : 'Testar Conexão Socket Agora'}
            </button>
          </div>
        </div>

        {/* Cartão 2: Sistemas Integrados */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Serviços Conectados ao IFC8
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Opera / Thexpos (PMS Hotelaria)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Vingcard (Fechaduras Eletrônicas)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Leucotron (Telefonia / Tarifação)</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <CheckCircle2 size={13} /> Integrado
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Smart TV Launcher (Launcher Fasano)</span>
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                <ShieldCheck size={13} /> Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Cartão 3: Métricas de Eventos */}
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: 14,
          padding: 18,
          border: '1px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Último Evento Recebido
          </span>

          <div style={{ marginTop: 12 }}>
            {pmsStatus?.last_event ? (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4 }}>
                  {pmsStatus.last_event.type === 'CHECK_IN' && '🏨 Check-In / Resync'}
                  {pmsStatus.last_event.type === 'CHECK_OUT' && '🚪 Check-Out Realizado'}
                  {pmsStatus.last_event.type === 'GUEST_CHANGE' && '✏️ Alteração de Hóspede'}
                  {pmsStatus.last_event.type === 'RESYNC_REQUESTED' && '🔄 Resync Solicitado'}
                  {pmsStatus.last_event.type === 'RESYNC_END' && '✓ Carga Completa Finalizada'}
                </div>
                <div style={{ color: 'var(--text-main)' }}>
                  {pmsStatus.last_event.uh && (
                    <span>UH: <strong>{pmsStatus.last_event.uh}</strong> </span>
                  )}
                  {pmsStatus.last_event.guest_name && (
                    <span>| Hóspede: <strong>{pmsStatus.last_event.guest_name}</strong></span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '12px 0' }}>
                Ouvinte ativo aguardando eventos do IFC8...
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Sincronizados:</span>
              <strong style={{ color: 'var(--text-main)' }}>{pmsStatus?.synced_events_count || 0} eventos</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de Resync ou Teste */}
      {resyncResult && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid #3b82f6',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <CheckCircle2 color="#60a5fa" size={18} />
          <div>
            <strong style={{ color: '#60a5fa' }}>{resyncResult.message}</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Alvo: {resyncResult.target} • Horário: {new Date(resyncResult.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {testResult && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 10,
          background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${testResult.status === 'success' ? '#10b981' : '#ef4444'}`,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          {testResult.status === 'success' ? <CheckCircle2 color="#10b981" size={18} /> : <AlertCircle color="#ef4444" size={18} />}
          <div>
            <span style={{ fontWeight: 600, color: testResult.status === 'success' ? '#10b981' : '#ef4444' }}>
              {testResult.message}
            </span>
            {testResult.banner && (
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2, fontFamily: 'monospace' }}>
                Banner: {testResult.banner}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TIMELINE ATIVA DO RESYNC & COMUNICAÇÃO IFC8 */}
      <div style={{
        background: 'linear-gradient(180deg, #090e17 0%, #0d1527 100%)',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Cabeçalho da Timeline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
            }}>
              <Terminal size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#fff', margin: 0 }}>
                  Timeline Ativa do Resync & IFC8
                </h3>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 700,
                  background: timelineStats?.socket_state === 'CONECTADO' ? 'rgba(16, 185, 129, 0.15)' : (timelineStats?.socket_state === 'CONECTANDO' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                  color: timelineStats?.socket_state === 'CONECTADO' ? '#34d399' : (timelineStats?.socket_state === 'CONECTANDO' ? '#60a5fa' : '#f87171'),
                  border: `1px solid ${timelineStats?.socket_state === 'CONECTADO' ? 'rgba(16, 185, 129, 0.3)' : (timelineStats?.socket_state === 'CONECTANDO' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
                  {timelineStats?.socket_state || 'DESCONECTADO'} ({timelineStats?.host || '192.168.162.18'}:{timelineStats?.port || 5020})
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '3px 0 0 0' }}>
                Monitore em tempo real as tentativas de conexão, pacotes FIAS enviados/recebidos e cada check-in de hóspede.
              </p>
            </div>
          </div>

          {/* Barra de Ações Rápidas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Seletor de Porta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '4px 10px', borderRadius: 8
            }}>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>Porta IFC8:</span>
              <select
                value={selectedPort}
                onChange={e => handleChangePort(e.target.value)}
                style={{
                  background: 'transparent', color: '#60a5fa', border: 'none',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', outline: 'none'
                }}
              >
                <option value={5020}>5020 (Padrão IFC8 / Pay-TV)</option>
                <option value={5001}>5001 (XML Ativo)</option>
                <option value={5010}>5010 (Auxiliar)</option>
                <option value={5060}>5060 (SIP / PBX)</option>
              </select>
            </div>

            {/* Diagnosticar Portas */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRunDiagnostic}
              disabled={diagnosing}
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              title="Testa portas 5020, 5001, 5010, 5060 e reporta na timeline"
            >
              <Radio size={14} className={diagnosing ? 'spin' : ''} />
              {diagnosing ? 'Varrendo...' : 'Diagnosticar Portas'}
            </button>

            {/* Sincronizar com Opera (DR) */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRequestResync}
              disabled={resyncing}
              style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb' }}
              title="Dispara a solicitação oficial de carga completa (DR) ao Opera"
            >
              <RotateCw size={14} className={resyncing ? 'spin' : ''} />
              {resyncing ? 'Solicitando...' : 'Disparar Resync (DR)'}
            </button>
          </div>
        </div>

        {/* Contadores / Cards de Resumo */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10, marginBottom: 14
        }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Pacotes Enviados</span>
            <strong style={{ fontSize: '1.15rem', color: '#60a5fa' }}>{timelineStats?.packets_sent_count || 0}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Pacotes Recebidos</span>
            <strong style={{ fontSize: '1.15rem', color: '#38bdf8' }}>{timelineStats?.packets_recv_count || 0}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Hóspedes Sincronizados</span>
            <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>{timelineStats?.synced_events_count || 0}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '8px 12px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Avisos / Erros</span>
            <strong style={{ fontSize: '1.15rem', color: (timelineStats?.errors_count || 0) > 0 ? '#f87171' : '#94a3b8' }}>
              {timelineStats?.errors_count || 0}
            </strong>
          </div>
        </div>

        {/* Barra de Filtros e Controles da Timeline */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 10, flexWrap: 'wrap', gap: 10,
          background: 'rgba(15, 23, 42, 0.4)', padding: '6px 12px', borderRadius: 10
        }}>
          {/* Pílulas de Filtro */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Todos os Eventos' },
              { id: 'DIFF', label: 'Diff (Alterações)' },
              { id: 'GUEST', label: 'Hóspedes (Check-In)' },
              { id: 'RESYNC', label: 'Resync (DR)' },
              { id: 'SOCKET', label: 'Conexão & Handshake' },
              { id: 'ERROR', label: 'Erros & Avisos' },
              { id: 'PACKET', label: 'Pacotes Brutos' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTimelineFilter(f.id)}
                style={{
                  fontSize: '0.72rem', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  border: 'none', fontWeight: timelineFilter === f.id ? 700 : 500,
                  background: timelineFilter === f.id ? (f.id === 'DIFF' ? '#8b5cf6' : '#3b82f6') : 'rgba(255, 255, 255, 0.06)',
                  color: timelineFilter === f.id ? '#fff' : '#94a3b8'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Opções (Auto-scroll, Ver Raw, Limpar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRawPackets}
                onChange={e => setShowRawPackets(e.target.checked)}
              />
              Exibir Pacote Bruto
            </label>

            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              style={{
                fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                background: autoScroll ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                color: autoScroll ? '#34d399' : '#94a3b8',
                border: 'none', display: 'flex', alignItems: 'center', gap: 4
              }}
              title={autoScroll ? 'Rolagem automática ativada' : 'Rolagem automática pausada'}
            >
              {autoScroll ? <Play size={10} /> : <Pause size={10} />}
              Auto-Scroll: {autoScroll ? 'Ligado' : 'Pausa'}
            </button>

            <button
              type="button"
              onClick={handleClearTimeline}
              style={{
                fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(239, 68, 68, 0.12)', color: '#f87171',
                border: 'none', display: 'flex', alignItems: 'center', gap: 4
              }}
              title="Limpar logs da timeline"
            >
              <Trash2 size={11} /> Limpar
            </button>
          </div>
        </div>

        {/* Feed de Eventos da Timeline (Console Interativo) */}
        <div
          ref={timelineContainerRef}
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            background: '#030712',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: '12px 14px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {timeline.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
              Nenhum evento registrado ainda. Clique em "Disparar Resync (DR)" ou "Diagnosticar Portas" para iniciar o fluxo.
            </div>
          ) : (
            timeline
              .filter(item => {
                if (timelineFilter === 'ALL') return true;
                if (timelineFilter === 'DIFF') return item.category === 'DIFF';
                if (timelineFilter === 'GUEST') return item.category === 'GUEST' || item.category === 'DIFF';
                if (timelineFilter === 'RESYNC') return item.category === 'RESYNC';
                if (timelineFilter === 'SOCKET') return item.category === 'SOCKET' || item.category === 'HANDSHAKE';
                if (timelineFilter === 'ERROR') return item.level === 'ERROR' || item.level === 'WARNING';
                if (timelineFilter === 'PACKET') return item.category === 'PACKET';
                return true;
              })
              .map(item => {
                const isError = item.level === 'ERROR';
                const isSuccess = item.level === 'SUCCESS';
                const isWarning = item.level === 'WARNING';
                const isDiff = item.category === 'DIFF';
                const borderColor = isError ? '#ef4444' : (isDiff ? '#a855f7' : (isSuccess ? '#10b981' : (isWarning ? '#f59e0b' : '#3b82f6')));
                const textColor = isError ? '#f87171' : (isDiff ? '#c084fc' : (isSuccess ? '#34d399' : (isWarning ? '#fbbf24' : '#93c5fd')));

                return (
                  <div
                    key={item.id}
                    style={{
                      borderLeft: `3px solid ${borderColor}`,
                      background: 'rgba(15, 23, 42, 0.7)',
                      padding: '8px 12px',
                      borderRadius: '0 8px 8px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 600 }}>
                          [{item.time_str}]
                        </span>

                        <span style={{
                          fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                          background: `${borderColor}22`, color: textColor
                        }}>
                          {item.category}
                        </span>

                        <strong style={{ color: textColor, fontSize: '0.82rem' }}>
                          {item.title}
                        </strong>

                        {item.uh && (
                          <span style={{
                            fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', fontWeight: 700
                          }}>
                            UH {item.uh}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: '1.3' }}>
                      {item.details}
                    </div>

                    {(showRawPackets || item.category === 'PACKET') && item.raw_packet && (
                      <div style={{
                        marginTop: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        color: '#a5b4fc',
                        fontSize: '0.72rem',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        <code>{item.raw_packet}</code>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* SEÇÃO 1: CARGA DE UHs (IMPORTAÇÃO VIA PLANILHA OU OPERA) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.28) 0%, rgba(15, 23, 42, 0.45) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: 16,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={20} color="#60a5fa" />
              Carga de UHs via Planilha (Excel / CSV)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0, maxWidth: 820 }}>
              Importe a lista de quartos via planilha Excel (<strong>.xlsx</strong>) ou <strong>CSV</strong> contendo as colunas oficiais.
              <strong> Importante:</strong> Nenhuma atribuição automática de grupo é realizada — as atribuições de grupos permanecem 100% manuais.
            </p>
          </div>

          {/* Seletor de Modo de Carga */}
          <div style={{ display: 'flex', gap: 6, background: 'rgba(15, 23, 42, 0.6)', padding: 4, borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={() => setLoadMode('FILE')}
              style={{
                padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8, cursor: 'pointer',
                background: loadMode === 'FILE' ? '#3b82f6' : 'transparent',
                color: loadMode === 'FILE' ? '#fff' : '#94a3b8',
                border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <FileSpreadsheet size={15} /> 1. Importar Planilha (Recomendado)
            </button>

            <button
              type="button"
              onClick={() => setLoadMode('IFC8')}
              style={{
                padding: '6px 14px', fontSize: '0.8rem', borderRadius: 8, cursor: 'pointer',
                background: loadMode === 'IFC8' ? '#3b82f6' : 'transparent',
                color: loadMode === 'IFC8' ? '#fff' : '#94a3b8',
                border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <RotateCw size={15} /> 2. Resync Socket IFC8
            </button>
          </div>
        </div>

        {/* MODO 1: IMPORTAÇÃO DO ARQUIVO DE PLANILHA */}
        {loadMode === 'FILE' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px dashed rgba(59, 130, 246, 0.4)',
            borderRadius: 14,
            padding: 20,
            marginTop: 10
          }}>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
              style={{ display: 'none' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderUp size={18} color="#60a5fa" />
                  Selecione a Planilha com as Colunas Oficiais
                </div>

                {/* Badge Visual da Estrutura da Planilha */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  marginBottom: 12,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 600 }}>Colunas:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <code style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700 }}>room</code>
                    <code style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700 }}>room_type</code>
                    <code style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', fontWeight: 700 }}>room_status</code>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Ex: 101 | SWC | Vacant &bull; 105 | SJR | Occupied &bull; 107 | DLXM | Vacant
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                      Atribuição de Grupo Inicial
                    </label>
                    <select
                      className="form-control"
                      value={batchGroupId}
                      onChange={e => setBatchGroupId(e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.8)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#fff', fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      <option value="">Manter / Sem Grupo (Atribuição 100% Manual)</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>Vincular ao Grupo: {g.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    <a
                      href="/api/pms/template-excel"
                      download="modelo_importacao_quartos.xlsx"
                      className="btn btn-secondary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 12px' }}
                      title="Baixar planilha modelo no formato Excel com as colunas corretas"
                    >
                      <Download size={14} /> Baixar Modelo (.xlsx)
                    </a>
                    <a
                      href="/api/pms/template-csv"
                      download="modelo_importacao_quartos.csv"
                      className="btn btn-secondary"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '6px 12px' }}
                      title="Baixar modelo em CSV"
                    >
                      <Download size={14} /> Modelo (.csv)
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={operaImportLoading}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 22px', fontSize: '0.88rem', fontWeight: 600, background: '#3b82f6' }}
                >
                  <UploadCloud size={18} />
                  {operaImportLoading ? 'Processando Planilha...' : 'Carregar Planilha (.xlsx / .csv)'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsTextModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.8rem' }}
                >
                  <FileText size={14} /> Colar Tabela em Texto
                </button>
              </div>
            </div>

            {/* Resultado da Importação do Opera */}
            {operaImportResult && (
              <div style={{
                marginTop: 16,
                padding: '14px 18px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                fontSize: '0.86rem'
              }}>
                <div style={{ fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <CheckCircle2 size={18} />
                  {operaImportResult.message}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Total detectado: <strong>{operaImportResult.total_detected} UHs</strong> • Criadas: <strong>{operaImportResult.created_count}</strong> • Atualizadas: <strong>{operaImportResult.updated_count}</strong>
                </div>
                {operaImportResult.samples?.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {operaImportResult.samples.map((s, idx) => (
                      <span key={idx} style={{
                        background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', color: '#fff'
                      }}>
                        UH {s.uh} {s.guest ? `(${s.guest})` : ''} - {s.group}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: '0.82rem', color: '#a7f3d0' }}>
                    Quartos cadastrados com sucesso! Agora você pode puxar os hóspedes ativos via IFC8.
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestResync}
                    disabled={resyncing}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: '#059669', color: '#fff', fontSize: '0.82rem',
                      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)'
                    }}
                  >
                    <RotateCw size={14} className={resyncing ? 'spin' : ''} />
                    {resyncing ? 'Puxando Hóspedes...' : 'Puxar Hóspedes do IFC8 Agora'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO 2: SINCRONIZAÇÃO SOCKET DIRETA COM O OPERA IFC8 */}
        {loadMode === 'IFC8' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 14,
            padding: 20,
            marginTop: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ color: '#fff', margin: '0 0 6px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RotateCw size={16} color="#60a5fa" />
                  Sincronização em Tempo Real via Socket FIAS (IFC8)
                </h4>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0, maxWidth: 650 }}>
                  Envia a solicitação de Database Resync (DR) diretamente para o servidor Opera IFC8 em <code>{pmsStatus?.host || '192.168.162.18'}:{pmsStatus?.port || 5020}</code>. O Opera descarregará todos os quartos e hóspedes ativos em streaming.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRequestResync}
                disabled={resyncing || !pmsStatus?.connected}
                style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, background: '#2563eb' }}
              >
                <RotateCw size={16} className={resyncing ? 'spin' : ''} />
                {resyncing ? 'Solicitando...' : 'Disparar Carga do Opera Agora'}
              </button>
            </div>
          </div>
        )}



        {/* Modal para Colar Texto do Opera */}
        {isTextModalOpen && (
          <div className="modal-overlay" style={{ animation: 'fadeIn 0.2s ease', zIndex: 100 }}>
            <div className="modal-content" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="var(--primary)" />
                  Colar Lista de Quartos / Hóspedes do Opera
                </h3>
                <button className="btn-icon" onClick={() => setIsTextModalOpen(false)}>✕</button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Copie e cole os dados da sua planilha (com ou sem cabeçalho). O sistema detectará automaticamente as colunas <code>room</code>, <code>room_type</code> e <code>room_status</code>:
              </p>

              <textarea 
                className="form-control"
                rows={8}
                value={operaTextContent}
                onChange={e => setOperaTextContent(e.target.value)}
                placeholder={`room, room_type, room_status\n101, SWC, Vacant\n102, SUP, Vacant\n103, SUP, Vacant\n104, SWC, Vacant\n105, SJR, Occupied\n106, SJR, Vacant\n107, DLXM, Vacant`}
                style={{ fontFamily: 'monospace', fontSize: '0.82rem', marginBottom: 16 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsTextModalOpen(false)}>
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleTextImport}
                  disabled={operaImportLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <UploadCloud size={16} />
                  {operaImportLoading ? 'Processando...' : 'Processar e Carregar UHs'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 2: ATUALIZAÇÃO / SINCRONIZAÇÃO MANUAL RÁPIDA DE HÓSPEDE */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid var(--border-color)',
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send size={18} color="var(--primary)" />
          Sincronização / Atualização Rápida de Hóspede na UH
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
          Utilize esta ferramenta para vincular um hóspede a uma UH diretamente ou para testar o comportamento da TV em tempo real.
        </p>

        <form onSubmit={handleSyncUH} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ margin: 0 }}>Número da UH (Quarto) *</label>
              <button
                type="button"
                onClick={() => {
                  setIsManualUhInput(!isManualUhInput);
                  setUhNumber('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {isManualUhInput ? '← Lista de Quartos' : '✍️ Digitar Manual'}
              </button>
            </div>

            {isManualUhInput ? (
              <input 
                type="text" 
                className="form-control" 
                value={uhNumber} 
                onChange={e => setUhNumber(e.target.value)} 
                placeholder="Ex: 101 ou TI"
                required
              />
            ) : (
              <select
                className="form-control"
                value={uhNumber}
                onChange={e => {
                  const val = e.target.value;
                  setUhNumber(val);
                  const found = registeredRooms.find(r => r.uh === val);
                  if (found) {
                    if (actionType === 'CHECK_IN' && found.guest) {
                      setGuestName(found.guest);
                    }
                  }
                }}
                required
              >
                <option value="">Selecione o Quarto ({registeredRooms.length} UHs)...</option>
                {registeredRooms.map(r => (
                  <option key={r.uh} value={r.uh}>
                    UH {r.uh} - {r.name} {r.guest ? `👤 (${r.guest})` : '🟢 (Vago)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="form-label">Tipo de Ação</label>
            <select 
              className="form-control"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
            >
              <option value="CHECK_IN">Check-In / Atualizar Hóspede</option>
              <option value="CHECK_OUT">Check-Out (Liberar Quarto)</option>
            </select>
          </div>

          {actionType === 'CHECK_IN' && (
            <div>
              <label className="form-label">Nome do Hóspede</label>
              <input 
                type="text" 
                className="form-control" 
                value={guestName} 
                onChange={e => setGuestName(e.target.value)} 
                placeholder="Ex: Diego Reis"
              />
            </div>
          )}

          <div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={syncing}
              style={{ width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Send size={15} /> {syncing ? 'Sincronizando...' : 'Enviar para TV'}
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO 3: TABELA DE UHs E TVs CADASTRADAS */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 16,
        padding: 22,
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tv size={18} color="var(--primary)" />
            Lista de TVs & Status PMS ({filteredTvs.length} de {tvs.length})
          </h3>

          {/* Filtros da Tabela */}
          <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 10, border: '1px solid var(--border-color)' }}>
            <button
              className="btn btn-sm"
              onClick={() => setFilterType('ALL')}
              style={{
                fontSize: '0.78rem',
                background: filterType === 'ALL' ? 'var(--primary)' : 'transparent',
                color: filterType === 'ALL' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '4px 10px'
              }}
            >
              Todas ({tvs.length})
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setFilterType('UH_ONLY')}
              style={{
                fontSize: '0.78rem',
                background: filterType === 'UH_ONLY' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                color: filterType === 'UH_ONLY' ? '#60a5fa' : 'var(--text-muted)',
                border: filterType === 'UH_ONLY' ? '1px solid #3b82f6' : '1px solid transparent',
                padding: '4px 10px'
              }}
            >
              🏨 UHs / Quartos ({uhTvsCount})
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setFilterType('INSTITUTIONAL_ONLY')}
              style={{
                fontSize: '0.78rem',
                background: filterType === 'INSTITUTIONAL_ONLY' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                color: filterType === 'INSTITUTIONAL_ONLY' ? '#c084fc' : 'var(--text-muted)',
                border: filterType === 'INSTITUTIONAL_ONLY' ? '1px solid #a855f7' : '1px solid transparent',
                padding: '4px 10px'
              }}
            >
              🏢 Institucionais ({instTvsCount})
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Tipo & UH</th>
                <th style={{ padding: '10px 12px' }}>Nome da TV / Local</th>
                <th style={{ padding: '10px 12px' }}>Categoria (room_type)</th>
                <th style={{ padding: '10px 12px' }}>Status UH</th>
                <th style={{ padding: '10px 12px' }}>Grupo (Manual)</th>
                <th style={{ padding: '10px 12px' }}>Status Pareamento APK</th>
                <th style={{ padding: '10px 12px' }}>Hóspede (Opera IFC8)</th>
                <th style={{ padding: '10px 12px' }}>Conexão</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              {filteredTvs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma TV encontrada com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredTvs.map(tv => {
                  const isUh = tv.pms_enabled !== false;
                  const tvUh = tv.uh_number || tv.custom_settings?.uh_number || '-';
                  const currentGuest = tv.guest_name || tv.custom_settings?.guest_name || null;
                  const roomType = tv.custom_settings?.room_type;
                  const rawStatus = (tv.custom_settings?.room_status || (tv.guest_name ? 'Occupied' : 'Vacant')).trim();
                  const isOccupied = rawStatus.toLowerCase().includes('occupied') || rawStatus.toLowerCase().includes('ocupad');

                  return (
                    <tr key={tv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Tipo & UH */}
                      <td style={{ padding: '12px' }}>
                        {isUh ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: '0.82rem'
                            }}>
                              UH {tvUh}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#38bdf8' }} title="Integrada ao Opera PMS">🏨 PMS</span>
                          </div>
                        ) : (
                          <span style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            color: '#c084fc',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: '0.78rem'
                          }}>
                            🏢 Institucional
                          </span>
                        )}
                      </td>

                      {/* Nome da TV */}
                      <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                        <div style={{ fontWeight: 600 }}>{tv.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {tv.device_id}</div>
                      </td>

                      {/* Categoria / room_type */}
                      <td style={{ padding: '12px' }}>
                        {roomType ? (
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.76rem',
                            fontWeight: 700
                          }}>
                            {roomType}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>---</span>
                        )}
                      </td>

                      {/* Status UH / room_status */}
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: isOccupied ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isOccupied ? '#f59e0b' : '#34d399',
                          border: `1px solid ${isOccupied ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOccupied ? '#f59e0b' : '#10b981' }} />
                          {rawStatus}
                        </span>
                      </td>

                      {/* Grupo Herdado / Atribuição Manual */}
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {tv.group_name || tv.room_group ? (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.76rem',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)'
                          }}>
                            {tv.group_name || tv.room_group}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.74rem' }}>
                            Sem Grupo
                          </span>
                        )}
                      </td>

                      {/* Status Pareamento APK */}
                      <td style={{ padding: '12px' }}>
                        {tv.is_paired ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600 }}>
                            <CheckCircle2 size={13} /> Pareado
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Smartphone size={12} /> PIN: {tv.pairing_code || tv.device_id}
                          </span>
                        )}
                      </td>

                      {/* Hóspede / Mensagem */}
                      <td style={{ padding: '12px' }}>
                        {isUh ? (
                          currentGuest ? (
                            <span style={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <User size={14} /> {currentGuest}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                              Quarto Vago
                            </span>
                          )
                        ) : (
                          <span style={{ color: '#d8b4fe', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            💬 "{tv.custom_settings?.welcome_title || 'Mensagem Manual Fixa'}"
                          </span>
                        )}
                      </td>

                      {/* Conexão */}
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: tv.is_online ? '#10b981' : 'var(--text-muted)'
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: tv.is_online ? '#10b981' : '#6b7280' }} />
                          {tv.is_online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>

                      {/* Ação Rápida */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {isUh && currentGuest && tvUh !== '-' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ fontSize: '0.75rem', padding: '4px 10px', color: '#f59e0b' }}
                            onClick={() => handleQuickCheckout(tvUh)}
                            title="Desvincular hóspede (Check-out)"
                          >
                            Check-Out
                          </button>
                        )}
                        {!isUh && (
                          <span style={{ fontSize: '0.72rem', color: '#a855f7', fontWeight: 600 }}>
                            Fixa (Sem PMS)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
