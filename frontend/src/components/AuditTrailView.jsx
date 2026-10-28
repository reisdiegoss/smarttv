import React, { useState, useEffect } from 'react';
import { 
  Shield, Clock, User, Globe, FileText, ArrowRight, 
  Search, RefreshCw, Filter, ChevronRight, CheckCircle2, 
  AlertTriangle, X, Database, Terminal, ArrowLeftRight
} from 'lucide-react';

export default function AuditTrailView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLogForDiff, setSelectedLogForDiff] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const url = selectedAction !== 'ALL' 
        ? `/api/audit-logs?action=${selectedAction}&limit=150` 
        : `/api/audit-logs?limit=150`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedAction]);

  // Filtering
  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.username && log.username.toLowerCase().includes(term)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(term)) ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.entity_name && log.entity_name.toLowerCase().includes(term)) ||
      (log.description && log.description.toLowerCase().includes(term))
    );
  });

  // Format date and time
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    try {
      let s = String(dateStr).trim();
      if (!s.endsWith('Z') && !s.includes('+') && !s.slice(10).includes('-')) {
        s = s.replace(' ', 'T') + 'Z';
      }
      const d = new Date(s);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Badge styling for action types
  const getActionBadge = (action) => {
    switch (action) {
      case 'TV_UPDATE':
        return { label: 'Atualização TV', bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
      case 'TV_CREATE':
        return { label: 'Nova TV', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'TV_DELETE':
        return { label: 'Exclusão TV', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'TV_CLAIM':
        return { label: 'Pareamento PIN', bg: 'rgba(139, 92, 246, 0.15)', text: '#c084fc', border: 'rgba(139, 92, 246, 0.3)' };
      case 'PLAYLIST_UPDATE':
      case 'PLAYLIST_CREATE':
        return { label: 'Playlist', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'PLAYLIST_DELETE':
        return { label: 'Exclusão Playlist', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'MEDIA_UPLOAD':
        return { label: 'Upload Vídeo', bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.3)' };
      case 'MEDIA_DELETE':
        return { label: 'Exclusão Vídeo', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'AUTH_LOGIN':
        return { label: 'Login Sucesso', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'AUTH_LOGIN_FAILED':
        return { label: 'Falha de Login', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { label: action, bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' };
    }
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '<vazio>';
    if (typeof val === 'boolean') return val ? 'Sim (Habilitado)' : 'Não (Desabilitado)';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // KPI Metrics
  const uniqueIps = new Set(logs.map(l => l.ip_address)).size;
  const recentLogTime = logs.length > 0 ? formatDateTime(logs[0].created_at) : 'Nenhum';

  return (
    <div>
      {/* Metric Cards Banner */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Shield size={26} />
          </div>
          <div>
            <div className="stat-value">{logs.length}</div>
            <div className="stat-label">Total de Eventos Auditados</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <Globe size={26} />
          </div>
          <div>
            <div className="stat-value">{uniqueIps}</div>
            <div className="stat-label">Endereços IP Distintos</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <Clock size={26} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap' }}>
              {recentLogTime}
            </div>
            <div className="stat-label">Última Modificação Registrada</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}>
            <Database size={26} />
          </div>
          <div>
            <div className="stat-value">PostgreSQL</div>
            <div className="stat-label">Auditoria Persistente & Imutável</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 450 }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuário, IP, TV ou ação..."
              className="form-input"
              style={{ paddingLeft: 42 }}
            />
          </div>

          {/* Action Filter */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="form-select"
              style={{ minWidth: 190 }}
            >
              <option value="ALL">Todas as Ações</option>
              <option value="TV_UPDATE">Alteração de TV (TV_UPDATE)</option>
              <option value="TV_CREATE">Criação de TV (TV_CREATE)</option>
              <option value="TV_DELETE">Exclusão de TV (TV_DELETE)</option>
              <option value="TV_CLAIM">Pareamento PIN (TV_CLAIM)</option>
              <option value="PLAYLIST_UPDATE">Alteração de Playlist</option>
              <option value="MEDIA_UPLOAD">Upload de Mídia</option>
              <option value="AUTH_LOGIN">Login de Usuário</option>
            </select>

            <button 
              className="btn btn-secondary" 
              onClick={fetchAuditLogs}
              disabled={loading}
              title="Recarregar logs de auditoria"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <th style={{ padding: '16px 20px' }}>Data & Hora</th>
                <th style={{ padding: '16px 20px' }}>Usuário</th>
                <th style={{ padding: '16px 20px' }}>Endereço IP</th>
                <th style={{ padding: '16px 20px' }}>Ação / Recurso</th>
                <th style={{ padding: '16px 20px' }}>Descrição da Modificação</th>
                <th style={{ padding: '16px 20px', textAlign: 'center' }}>Antes vs Alterado</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
                    Carregando trilha de auditoria...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum registro de auditoria encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const hasDiff = (log.diff_summary && log.diff_summary.length > 0) || 
                                  (log.old_values && Object.keys(log.old_values).length > 0) ||
                                  (log.new_values && Object.keys(log.new_values).length > 0);

                  return (
                    <tr 
                      key={log.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Data e Hora */}
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Usuário */}
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <User size={13} />
                          </div>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
                            {log.username || 'admin'}
                          </span>
                        </div>
                      </td>

                      {/* Endereço IP */}
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: '0.82rem',
                          fontFamily: 'monospace',
                          color: '#38bdf8'
                        }}>
                          <Globe size={13} />
                          <span>{log.ip_address}</span>
                        </div>
                      </td>

                      {/* Ação */}
                      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Descrição */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {log.description || `${log.action} em ${log.entity_name || log.entity}`}
                        </div>
                        {log.diff_summary && log.diff_summary.length > 0 && (
                          <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 4 }}>
                            {log.diff_summary.length} campo(s) modificado(s): {log.diff_summary.map(d => d.label).join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Botão de Antes vs Depois */}
                      <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {hasDiff ? (
                          <button
                            onClick={() => setSelectedLogForDiff(log)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              borderColor: 'rgba(59, 130, 246, 0.35)',
                              color: '#60a5fa'
                            }}
                          >
                            <ArrowLeftRight size={14} />
                            <span>Ver Diff</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
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

      {/* BEFORE / AFTER COMPARISON MODAL */}
      {selectedLogForDiff && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 840, width: '92%' }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Shield size={22} style={{ color: '#38bdf8' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                    Auditoria de Alterações: O que era antes vs O que foi alterado
                  </h2>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
                  Registro #{selectedLogForDiff.id} • Realizado em {formatDateTime(selectedLogForDiff.created_at)}
                </div>
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setSelectedLogForDiff(null)}
                style={{ padding: '6px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Context Metadata Pill Row */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: 20
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Usuário: </span>
                <strong style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{selectedLogForDiff.username}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IP Origem: </span>
                <code style={{ fontSize: '0.82rem', color: '#38bdf8' }}>{selectedLogForDiff.ip_address}</code>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ação: </span>
                <strong style={{ fontSize: '0.82rem', color: '#f59e0b' }}>{selectedLogForDiff.action}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Alvo: </span>
                <strong style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>{selectedLogForDiff.entity_name || selectedLogForDiff.entity}</strong>
              </div>
            </div>

            {/* Structured Diff Comparison Table */}
            {selectedLogForDiff.diff_summary && selectedLogForDiff.diff_summary.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>
                  Campos Alterados Detectados ({selectedLogForDiff.diff_summary.length})
                </div>

                <div style={{
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.04)', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <th style={{ padding: '10px 16px', width: '25%' }}>CAMPO</th>
                        <th style={{ padding: '10px 16px', width: '37.5%', color: '#f87171' }}>O QUE ERA ANTES</th>
                        <th style={{ padding: '10px 16px', width: '37.5%', color: '#34d399' }}>O QUE FOI ALTERADO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLogForDiff.diff_summary.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                            {item.label || item.field}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            background: 'rgba(239, 68, 68, 0.06)',
                            color: '#fca5a5',
                            fontSize: '0.85rem',
                            wordBreak: 'break-word'
                          }}>
                            <span style={{ textDecoration: 'line-through', opacity: 0.85 }}>
                              {formatValue(item.before)}
                            </span>
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: '#86efac',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            wordBreak: 'break-word'
                          }}>
                            {formatValue(item.after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '20px',
                borderRadius: 12,
                textAlign: 'center',
                color: '#94a3b8',
                marginBottom: 20
              }}>
                Nenhum diff campo a campo disponível para esta ação específica. Veja os dados brutos abaixo.
              </div>
            )}

            {/* Raw JSON Snapshot View (Accordion/Tabs) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
                  ESTADO ANTERIOR (OLD_VALUES)
                </div>
                <pre style={{
                  background: 'rgba(7, 9, 14, 0.95)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 10,
                  padding: '12px',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  maxHeight: 180,
                  overflowY: 'auto'
                }}>
                  {JSON.stringify(selectedLogForDiff.old_values || {}, null, 2)}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: 6 }}>
                  NOVO ESTADO (NEW_VALUES)
                </div>
                <pre style={{
                  background: 'rgba(7, 9, 14, 0.95)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 10,
                  padding: '12px',
                  color: '#86efac',
                  fontSize: '0.75rem',
                  maxHeight: 180,
                  overflowY: 'auto'
                }}>
                  {JSON.stringify(selectedLogForDiff.new_values || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedLogForDiff(null)}
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
