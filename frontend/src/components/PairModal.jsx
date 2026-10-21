import React, { useState } from 'react';
import { X, QrCode, Tv, Sparkles, Check } from 'lucide-react';

export default function PairModal({ isOpen, onClose, onClaim, layouts, playlists }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [roomGroup, setRoomGroup] = useState('Geral');
  const [layoutId, setLayoutId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return setError('Digite o código de 6 dígitos exibido na TV');
    if (!name.trim()) return setError('Informe o nome da TV (ex: Quarto 201)');

    setLoading(true);
    setError('');
    try {
      await onClaim({
        pairing_code: code.trim().toUpperCase(),
        name,
        room_group: roomGroup,
        layout_id: layoutId ? parseInt(layoutId) : (layouts[0]?.id || null),
        playlist_id: playlistId ? parseInt(playlistId) : (playlists[0]?.id || null)
      });
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
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>Parear Nova Smart TV</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Vincule o APK que está rodando na TV digitando o código da tela.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
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
                placeholder="Ex: ST-0101"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Ambiente / Setor</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: 3º Andar"
                  value={roomGroup}
                  onChange={e => setRoomGroup(e.target.value)}
                />
              </div>

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
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Playlist de Vídeos Inicial</label>
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

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Check size={16} /> {loading ? 'Pareando...' : 'Confirmar Pareamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
