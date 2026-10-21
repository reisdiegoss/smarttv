import React, { useState } from 'react';
import { X, Film, Upload, Trash2, Plus, ArrowUp, ArrowDown, Play, Check } from 'lucide-react';

export default function PlaylistModal({ isOpen, onClose, playlist, mediaList, onSave, onUploadMedia, onDeleteMedia }) {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [loopPlayback, setLoopPlayback] = useState(playlist?.loop_playback !== false);
  const [selectedItems, setSelectedItems] = useState(
    playlist?.items?.map(it => ({
      media_id: it.media_id,
      title: it.media?.title || 'Vídeo',
      duration: it.duration_override || it.media?.duration || 0
    })) || []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    try {
      const newMedia = await onUploadMedia(file);
      // Auto add to current playlist
      setSelectedItems(prev => [...prev, {
        media_id: newMedia.id,
        title: newMedia.title,
        duration: newMedia.duration
      }]);
    } catch (err) {
      setUploadError(err.message || 'Erro ao fazer upload do vídeo');
    } finally {
      setUploading(false);
    }
  };

  const addMediaToPlaylist = (media) => {
    setSelectedItems(prev => [...prev, {
      media_id: media.id,
      title: media.title,
      duration: media.duration
    }]);
  };

  const removePlaylistItem = (index) => {
    setSelectedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const moveItem = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= selectedItems.length) return;
    const copy = [...selectedItems];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setSelectedItems(copy);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Informe o nome da playlist');
    if (selectedItems.length === 0) return alert('Adicione pelo menos 1 vídeo à playlist');

    onSave({
      id: playlist?.id,
      name,
      description,
      loop_playback: loopPlayback,
      items: selectedItems.map((item, idx) => ({
        media_id: item.media_id,
        order_index: idx
      }))
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
            }}>
              <Film size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                {playlist ? `Editar Playlist: ${playlist.name}` : 'Criar Nova Playlist de Vídeos'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configure a ordem e sequência de vídeos que rodarão na Launcher da TV.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome da Playlist</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Recepção - Institucional 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Repetição Contínua (Loop)</label>
                <select 
                  className="form-select"
                  value={loopPlayback ? 'true' : 'false'}
                  onChange={e => setLoopPlayback(e.target.value === 'true')}
                >
                  <option value="true">Sim (Loop Infinito)</option>
                  <option value="false">Não (Tocar uma vez)</option>
                </select>
              </div>
            </div>

            {/* Upload Area */}
            <div style={{
              border: '2px dashed rgba(255, 255, 255, 0.15)', borderRadius: 16,
              padding: '20px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <Upload size={28} color="#60a5fa" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: 4 }}>
                Enviar Novo Vídeo (.mp4, .webm)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                O vídeo será salvo no servidor e transmitido para as TVs conectadas.
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                {uploading ? 'Enviando...' : 'Selecionar Arquivo no Computador'}
                <input type="file" accept="video/mp4,video/webm" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
              </label>
              {uploadError && <div style={{ color: '#fb7185', fontSize: '0.8rem', marginTop: 8 }}>{uploadError}</div>}
            </div>

            {/* Sequence of Videos in this Playlist */}
            <div>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sequência de Reprodução ({selectedItems.length} vídeos na fila)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Use as setas para reordenar</span>
              </label>

              {selectedItems.length === 0 ? (
                <div style={{
                  padding: 24, textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 12, border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.85rem'
                }}>
                  Nenhum vídeo adicionado ainda. Escolha na biblioteca abaixo ou envie um novo vídeo acima.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {selectedItems.map((item, idx) => (
                    <div 
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10,
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>{item.title}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px 8px' }}
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          title="Mover para cima"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px 8px' }}
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === selectedItems.length - 1}
                          title="Mover para baixo"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-danger btn-sm" 
                          style={{ padding: '4px 8px' }}
                          onClick={() => removePlaylistItem(idx)}
                          title="Remover da playlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Media Library Picker */}
            <div>
              <label className="form-label">Adicionar Vídeos da Biblioteca Disponível</label>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10, maxHeight: 150, overflowY: 'auto'
              }}>
                {mediaList.map(media => (
                  <div 
                    key={media.id}
                    style={{
                      padding: '10px 12px', background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 10, border: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: 6 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {media.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {(media.file_size / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>
                    <button 
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => addMediaToPlaylist(media)}
                      title="Adicionar à sequência"
                    >
                      <Plus size={14} color="#60a5fa" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} /> Salvar Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
