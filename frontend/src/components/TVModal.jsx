import React, { useState, useEffect } from 'react';
import { X, Tv, Save, CheckSquare, Square, Layers, Film, Wifi, Settings2, Hash, Power, Check } from 'lucide-react';

export default function TVModal({ isOpen, onClose, onSave, tv, layouts, playlists, shortcuts }) {
  const [name, setName] = useState('');
  const [roomGroup, setRoomGroup] = useState('Geral');
  const [layoutId, setLayoutId] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [enableHdmi, setEnableHdmi] = useState(true);
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

  const appShortcuts = shortcuts.filter(s => !s.is_hdmi);

  useEffect(() => {
    if (tv) {
      setName(tv.name || '');
      setRoomGroup(tv.room_group || 'Geral');
      setLayoutId(tv.layout_id || (layouts[0]?.id || ''));
      setPlaylistId(tv.playlist_id || (playlists[0]?.id || ''));
      
      const isHdmiOn = tv.hdmi_input_id !== 'NONE' && tv.hdmi_input_id !== 'DISABLED' && tv.hdmi_input_id !== null && tv.custom_settings?.hide_hdmi !== true;
      setEnableHdmi(isHdmiOn);
      setHdmiInputId(isHdmiOn ? (tv.hdmi_input_id || 'HDMI 1') : 'HDMI 1');
      setHdmiLabel(tv.hdmi_label || 'TV SKY');
      
      if (Array.isArray(tv.selected_shortcuts) && tv.selected_shortcuts.length > 0) {
        // Filtra apenas atalhos que não sejam HDMI
        setSelectedShortcuts(tv.selected_shortcuts.filter(id => appShortcuts.some(a => a.id === id)));
      } else if (Array.isArray(tv.selected_shortcuts) && tv.selected_shortcuts.length === 0 && tv.id) {
        // Usuário desmarcou todos intencionalmente
        setSelectedShortcuts([]);
      } else {
        setSelectedShortcuts(appShortcuts.map(s => s.id));
      }
      
      if (tv.custom_settings) {
        setCustomSettings(prev => ({ ...prev, ...tv.custom_settings }));
      }
    } else {
      setName('');
      setRoomGroup('Geral');
      setLayoutId(layouts[0]?.id || '');
      setPlaylistId(playlists[0]?.id || '');
      setEnableHdmi(true);
      setHdmiInputId('HDMI 1');
      setHdmiLabel('TV SKY');
      setSelectedShortcuts(appShortcuts.map(s => s.id));
    }
  }, [tv, layouts, playlists, shortcuts, isOpen]);

  if (!isOpen) return null;

  const toggleShortcut = (id) => {
    setSelectedShortcuts(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedShortcuts(appShortcuts.map(s => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedShortcuts([]);
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
      hdmi_input_id: enableHdmi ? hdmiInputId : 'NONE',
      hdmi_label: hdmiLabel,
      selected_shortcuts: selectedShortcuts,
      custom_settings: {
        ...customSettings,
        hide_hdmi: !enableHdmi
      }
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
            }}>
              <Tv size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                {tv ? `Configurar: ${tv.name}` : 'Cadastrar Nova Smart TV'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Personalize os vídeos, atalhos de apps e entrada HDMI individualmente para esta TV.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Seção 1: Identificação Básica */}
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

            {/* Seção 2: Layout e Playlist de Vídeos */}
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
                  <Film size={14} color="#f59e0b" /> Playlist de Vídeos em Loop
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

            {/* Seção 3: Entrada HDMI (Sky / Receptor) */}
            <div style={{
              background: enableHdmi ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: enableHdmi ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14, padding: 16, transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: enableHdmi ? 14 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tv size={18} color={enableHdmi ? "#ef4444" : "#64748b"} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: enableHdmi ? '#f87171' : '#94a3b8' }}>
                    Entrada HDMI (TV SKY / Receptor)
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox"
                    checked={enableHdmi}
                    onChange={e => setEnableHdmi(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#ef4444', cursor: 'pointer' }}
                  />
                  <span>Habilitar nesta TV</span>
                </label>
              </div>

              {enableHdmi && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Rótulo do Botão na TV</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={hdmiLabel} 
                      onChange={e => setHdmiLabel(e.target.value)} 
                      placeholder="Ex: TV SKY, SKY HD, TV A CABO"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Porta HDMI Conectada</label>
                    <select 
                      className="form-select"
                      value={hdmiInputId}
                      onChange={e => setHdmiInputId(e.target.value)}
                    >
                      <option value="HDMI 1">HDMI 1 (Padrão)</option>
                      <option value="HDMI 2">HDMI 2</option>
                      <option value="HDMI 3">HDMI 3</option>
                      <option value="HDMI 4">HDMI 4</option>
                      <option value="HW1">HW1 (TCL / Philips Passthrough)</option>
                      <option value="HW2">HW2 (Passthrough)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Seção 4: Seleção Individual de Aplicativos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Aplicativos Ativos nesta TV <strong>({selectedShortcuts.length} de {appShortcuts.length})</strong>
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span 
                    style={{ color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                    onClick={handleSelectAll}
                  >
                    Marcar Todos
                  </span>
                  <span style={{ color: '#475569', fontSize: '0.78rem' }}>•</span>
                  <span 
                    style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}
                    onClick={handleDeselectAll}
                  >
                    Desmarcar Todos
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 10, maxHeight: 180, overflowY: 'auto', padding: '4px'
              }}>
                {appShortcuts.map(sc => {
                  const isChecked = selectedShortcuts.includes(sc.id);
                  return (
                    <div 
                      key={sc.id}
                      onClick={() => toggleShortcut(sc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: isChecked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isChecked ? '1px solid rgba(59, 130, 246, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                    >
                      {isChecked ? <CheckSquare size={17} color="#60a5fa" /> : <Square size={17} color="#64748b" />}
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: isChecked ? '#fff' : '#94a3b8' }}>
                        {sc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seção 5: Mensagem de Boas-Vindas e Wi-Fi */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 16
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wifi size={16} color="#34d399" /> Mensagem no Topo da TV & Rede Wi-Fi
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
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Subtítulo</label>
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

          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={16} /> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
