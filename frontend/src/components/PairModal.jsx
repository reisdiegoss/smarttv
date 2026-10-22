import React, { useState } from 'react';
import { X, QrCode, Tv, Sparkles, Check, Link, PlusCircle } from 'lucide-react';

export default function PairModal({ isOpen, onClose, onClaim, onAssignDevice, tvs = [], layouts = [], playlists = [] }) {
  const [mode, setMode] = useState('assign'); // 'assign' or 'new'
  const [code, setCode] = useState('');
  const [selectedTvId, setSelectedTvId] = useState('');
  const [name, setName] = useState('');
  const [roomGroup, setRoomGroup] = useState('Geral');
  const [layoutId, setLayoutId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return setError('Digite o código de 6 caracteres exibido na TV');

    setLoading(true);
    setError('');
    try {
      if (mode === 'assign') {
        const targetId = selectedTvId ? parseInt(selectedTvId) : (tvs[0]?.id || null);
        if (!targetId) return setError('Selecione uma TV para vincular');
        await onAssignDevice({
          target_tv_id: targetId,
          pairing_code: code.trim().toUpperCase()
        });
      } else {
        if (!name.trim()) return setError('Informe o nome da TV (ex: Quarto 201)');
        await onClaim({
          pairing_code: code.trim().toUpperCase(),
          name,
          room_group: roomGroup,
          layout_id: layoutId ? parseInt(layoutId) : (layouts[0]?.id || null),
          playlist_id: playlistId ? parseInt(playlistId) : (playlists[0]?.id || null)
        });
      }
      setCode('');
      setName('');
      onClose();
    } catch (err) {
      setError(err.message || 'Código não encontrado ou erro ao parear');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399'
            }}>
              <QrCode size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Parear Aparelho de TV</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Vincule o APK que está rodando na TV digitando o código da tela.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Modo Switcher */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 20px 0 20px'
        }}>
          <button
            type="button"
            onClick={() => setMode('assign')}
            style={{
              padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600,
              background: mode === 'assign' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: mode === 'assign' ? '#60a5fa' : '#94a3b8',
              borderBottom: mode === 'assign' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            <Link size={16} /> Vincular a TV Existente
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            style={{
              padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600,
              background: mode === 'new' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: mode === 'new' ? '#34d399' : '#94a3b8',
              borderBottom: mode === 'new' ? '2px solid #10b981' : '2px solid transparent'
            }}
          >
            <PlusCircle size={16} /> Cadastrar Nova TV
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185', padding: '10px 14px', borderRadius: 10, fontSize: '0.85rem'
              }}>
                {error}
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>
                Código PIN Exibido na Tela da TV
              </label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: TM-3400"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                style={{
                  textAlign: 'center', fontSize: '1.8rem', letterSpacing: '0.2em',
                  fontWeight: 800, fontFamily: 'monospace', textTransform: 'uppercase'
                }}
                maxLength={10}
                required
              />
            </div>

            {mode === 'assign' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Selecione a TV Cadastrada no Sistema</label>
                <select 
                  className="form-select"
                  value={selectedTvId}
                  onChange={e => setSelectedTvId(e.target.value)}
                  required
                >
                  <option value="">Selecione uma TV...</option>
                  {tvs.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.room_group || 'Geral'}) - {t.device_id || 'Sem dispositivo'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  O código da tela física passará a controlar as configurações desta TV selecionada.
                </div>
              </div>
            ) : (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Identificação / Nome da TV</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: Quarto 305 - Suíte Presidencial"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Grupo / Setor</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: 3º Andar, Recepção, Bar da Piscina"
                    value={roomGroup}
                    onChange={e => setRoomGroup(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Layout Inicial</label>
                    <select 
                      className="form-select"
                      value={layoutId}
                      onChange={e => setLayoutId(e.target.value)}
                    >
                      {layouts.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Playlist de Vídeos</label>
                    <select 
                      className="form-select"
                      value={playlistId}
                      onChange={e => setPlaylistId(e.target.value)}
                    >
                      {playlists.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none' }}
            >
              {loading ? 'Processando...' : (mode === 'assign' ? 'Vincular à TV' : 'Parear & Ativar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
