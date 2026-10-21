import React, { useState, useEffect } from 'react';
import { X, Tv, Save, CheckSquare, Square, Layers, Film, Wifi, Settings2, Hash } from 'lucide-react';

export default function TVModal({ isOpen, onClose, onSave, tv, layouts, playlists, shortcuts }) {
  const [name, setName] = useState('');
  const [roomGroup, setRoomGroup] = useState('Geral');
  const [layoutId, setLayoutId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [hdmiInputId, setHdmiInputId] = useState('HDMI 1');
  const [hdmiLabel, setHdmiLabel] = useState('TV SKY');
  const [selectedShortcuts, setSelectedShortcuts] = useState([]);
  const [customSettings, setCustomSettings] = useState({
    welcome_title: 'Seja Bem-vindo(a)!',
    welcome_subtitle: 'Aproveite o melhor do entretenimento.',
    wifi_ssid: 'SmartTV-Guest',
    wifi_password: 'smarttvresort',
    auto_hide_dock: true,
    auto_hide_seconds: 15
  });

  useEffect(() => {
    if (tv) {
      setName(tv.name || '');
      setRoomGroup(tv.room_group || 'Geral');
      setLayoutId(tv.layout_id || (layouts[0]?.id || ''));
      setPlaylistId(tv.playlist_id || (playlists[0]?.id || ''));
      setHdmiInputId(tv.hdmi_input_id || 'HDMI 1');
      setHdmiLabel(tv.hdmi_label || 'TV SKY');
      setSelectedShortcuts(tv.selected_shortcuts || shortcuts.map(s => s.id));
      if (tv.custom_settings) {
        setCustomSettings(prev => ({ ...prev, ...tv.custom_settings }));
      }
    } else {
      setName('');
      setRoomGroup('Geral');
      setLayoutId(layouts[0]?.id || '');
      setPlaylistId(playlists[0]?.id || '');
      setHdmiInputId('HDMI 1');
      setHdmiLabel('TV SKY');
      setSelectedShortcuts(shortcuts.map(s => s.id));
    }
  }, [tv, layouts, playlists, shortcuts, isOpen]);

  if (!isOpen) return null;

  const toggleShortcut = (id) => {
    setSelectedShortcuts(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Informe o nome da TV');

    onSave({
      id: tv?.id,
      name,
      room_group: roomGroup,
      layout_id: layoutId ? parseInt(layoutId) : null,
      playlist_id: playlistId ? parseInt(playlistId) : null,
      hdmi_input_id: hdmiInputId,
      hdmi_label: hdmiLabel,
      selected_shortcuts: selectedShortcuts,
      custom_settings: customSettings
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
            }}>
              <Tv size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                {tv ? `Configurar: ${tv.name}` : 'Cadastrar Nova Smart TV'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Personalize os vídeos, atalhos e entrada da Sky individualmente para esta TV.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Section 1: Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome da TV / Localização</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Quarto 102 - Suíte Luxo"
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
                  placeholder="Ex: 1º Andar, Recepção, Bar"
                  value={roomGroup}
                  onChange={e => setRoomGroup(e.target.value)}
                />
              </div>
            </div>

            {/* Section 2: Layout & Playlist Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={14} color="#60a5fa" /> Modelo de Layout da Tela
                </label>
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
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Film size={14} color="#f59e0b" /> Playlist de Vídeos
                </label>
                <select 
                  className="form-select"
                  value={playlistId}
                  onChange={e => setPlaylistId(e.target.value)}
                >
                  {playlists.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.items?.length || 0} vídeos)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3: HDMI Input (Sky) */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 14, padding: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Tv size={18} color="#ef4444" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171' }}>
                  Configuração de Entrada HDMI (Sky TV)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Nome Exibido no Botão</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={hdmiLabel} 
                    onChange={e => setHdmiLabel(e.target.value)} 
                    placeholder="Ex: TV SKY HD"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Porta HDMI Selecionada</label>
                  <select 
                    className="form-select"
                    value={hdmiInputId}
                    onChange={e => setHdmiInputId(e.target.value)}
                  >
                    <option value="HDMI 1">HDMI 1 (Padrão)</option>
                    <option value="HDMI 2">HDMI 2</option>
                    <option value="HDMI 3">HDMI 3</option>
                    <option value="HW1">HW1 (TCL / Philips Passthrough)</option>
                    <option value="HW2">HW2 (Passthrough)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: App Shortcuts to Enable on this TV */}
            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>Atalhos Disponíveis nesta TV ({selectedShortcuts.length} selecionados)</span>
                <span 
                  style={{ color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem' }}
                  onClick={() => setSelectedShortcuts(shortcuts.map(s => s.id))}
                >
                  Selecionar Todos
                </span>
              </label>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10, maxHeight: 180, overflowY: 'auto', padding: '6px 2px'
              }}>
                {shortcuts.map(sc => {
                  const isChecked = selectedShortcuts.includes(sc.id);
                  return (
                    <div 
                      key={sc.id}
                      onClick={() => toggleShortcut(sc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: isChecked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      {isChecked ? <CheckSquare size={16} color="#60a5fa" /> : <Square size={16} color="#64748b" />}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isChecked ? '#fff' : 'var(--text-secondary)' }}>
                        {sc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 5: Custom Welcome & Wi-Fi */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 16
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wifi size={16} color="#34d399" /> Mensagem de Boas-Vindas & Wi-Fi na Tela
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Título de Boas-Vindas</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.welcome_title}
                    onChange={e => setCustomSettings({ ...customSettings, welcome_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Subtítulo / Descrição</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.welcome_subtitle}
                    onChange={e => setCustomSettings({ ...customSettings, welcome_subtitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Nome da Rede Wi-Fi (SSID)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.wifi_ssid}
                    onChange={e => setCustomSettings({ ...customSettings, wifi_ssid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Senha do Wi-Fi</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customSettings.wifi_password}
                    onChange={e => setCustomSettings({ ...customSettings, wifi_password: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} /> Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
