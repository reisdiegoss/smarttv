import React, { useState, useEffect } from 'react';
import { 
  Building2, Activity, Wifi, CheckCircle2, AlertCircle, RefreshCw, 
  Send, User, Key, Tv, ShieldCheck, ArrowRight, Clock, Server,
  Sparkles, Layers, CheckSquare, PlusCircle, RotateCw, Filter, Smartphone
} from 'lucide-react';

export default function PMSIntegrationView({ tvs = [], groups = [], onRefresh, fetchHeaders }) {
  const [pmsStatus, setPmsStatus] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Estados para Carga Inicial em Lote
  const [batchRanges, setBatchRanges] = useState('101-125, 201-225, 301-315');
  const [batchGroupId, setBatchGroupId] = useState('');
  const [batchPrefix, setBatchPrefix] = useState('Quarto');
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  // Estados para Database Resync (DR) com o Opera PMS
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState(null);

  // Estados para Filtro da Tabela
  const [filterType, setFilterType] = useState('ALL'); // ALL, UH_ONLY, INSTITUTIONAL_ONLY

  // Form states para Sync Manual
  const [uhNumber, setUhNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [actionType, setActionType] = useState('CHECK_IN');
  const [welcomeTitle, setWelcomeTitle] = useState('');

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

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
    if (!window.confirm('Deseja solicitar a Carga Completa (Database Resync - DR) do Opera PMS? O servidor IFC8 enviará todas as UHs e hóspedes ativos em tempo real.')) {
      return;
    }

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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao solicitar resync');
      }

      const data = await res.json();
      setResyncResult(data);
      if (onRefresh) onRefresh();
      loadStatus();
    } catch (err) {
      alert(`Erro: ${err.message}`);
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

      {/* SEÇÃO 1: CARGA INICIAL EM LOTE DE UHs (ASSISTENTE PARA INSTALAÇÃO DO APK) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: 16,
        padding: 22,
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={20} color="#60a5fa" />
              Carga Inicial & Gerador de UHs em Lote (Quartos)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0, maxWidth: 800 }}>
              Cadastre previamente todas as UHs do hotel para que os técnicos já encontrem as TVs prontas no painel ao instalar o APK em cada quarto. O Opera PMS atualizará os hóspedes de cada UH automaticamente assim que houver check-in.
            </p>
          </div>

          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '0.78rem',
            color: '#93c5fd',
            fontWeight: 600
          }}>
            Código Prévio: UH-0101
          </div>
        </div>

        <form onSubmit={handleBatchCreateUHs} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginTop: 16 }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
              Faixas de Quartos / UHs (Separadas por vírgula ou hífen) *
            </label>
            <input 
              type="text" 
              className="form-control" 
              value={batchRanges}
              onChange={e => setBatchRanges(e.target.value)}
              placeholder="Ex: 101-125, 201-225, 301-315"
              required
              style={{ background: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#fff' }}
            />
            <small style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginTop: 4 }}>
              Exemplo: <code>101-125</code> cria automaticamente do 101 ao 125.
            </small>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
              Grupo / Perfil Herdado
            </label>
            <select
              className="form-control"
              value={batchGroupId}
              onChange={e => setBatchGroupId(e.target.value)}
              style={{ background: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#fff' }}
            >
              <option value="">TV Quartos (Padrão)</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
              Prefixo do Nome
            </label>
            <input 
              type="text" 
              className="form-control" 
              value={batchPrefix}
              onChange={e => setBatchPrefix(e.target.value)}
              placeholder="Quarto"
              style={{ background: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#fff' }}
            />
          </div>

          <div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={batchGenerating}
              style={{ height: 40, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, padding: '0 18px', background: '#3b82f6' }}
            >
              <PlusCircle size={16} />
              {batchGenerating ? 'Gerando UHs...' : 'Gerar TVs das UHs'}
            </button>
          </div>
        </form>

        {batchResult && (
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            fontSize: '0.85rem'
          }}>
            <div style={{ fontWeight: 600, color: '#34d399', marginBottom: 4 }}>
              ✓ {batchResult.message}
            </div>
            {batchResult.created_rooms.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: 4 }}>
                <strong>Criadas agora ({batchResult.created_count}):</strong> {batchResult.created_rooms.slice(0, 30).join(', ')}
                {batchResult.created_rooms.length > 30 ? ` ... e mais ${batchResult.created_rooms.length - 30} quartos` : ''}
              </div>
            )}
            {batchResult.existing_rooms.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                <strong>Já existentes ({batchResult.already_exists_count}):</strong> {batchResult.existing_rooms.slice(0, 20).join(', ')}
              </div>
            )}
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
            <label className="form-label">Número da UH (Quarto) *</label>
            <input 
              type="text" 
              className="form-control" 
              value={uhNumber} 
              onChange={e => setUhNumber(e.target.value)} 
              placeholder="Ex: 101 ou TI"
              required
            />
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
                <th style={{ padding: '10px 12px' }}>Grupo Herdado</th>
                <th style={{ padding: '10px 12px' }}>Status Pareamento APK</th>
                <th style={{ padding: '10px 12px' }}>Hóspede / Mensagem da Tela</th>
                <th style={{ padding: '10px 12px' }}>Conexão</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Ação Rápida</th>
              </tr>
            </thead>
            <tbody>
              {filteredTvs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma TV encontrada com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredTvs.map(tv => {
                  const isUh = tv.pms_enabled !== false;
                  const tvUh = tv.uh_number || tv.custom_settings?.uh_number || '-';
                  const currentGuest = tv.guest_name || tv.custom_settings?.guest_name || null;

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

                      {/* Grupo Herdado */}
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {tv.group_name || tv.room_group || 'Geral'}
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
