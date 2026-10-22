import React, { useState, useEffect } from 'react';
import { X, Layers, Save, Palette, Eye, Clock, Wifi, Monitor, AlignVerticalJustifyCenter, Sparkles } from 'lucide-react';

export default function LayoutModal({ isOpen, onClose, onSave, layout }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('hotel_dock');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Config properties
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [dockPosition, setDockPosition] = useState('bottom');
  const [showClock, setShowClock] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showWifiCard, setShowWifiCard] = useState(true);
  const [showQrCode, setShowQrCode] = useState(true);
  const [autoHideDock, setAutoHideDock] = useState(true);
  const [autoHideSeconds, setAutoHideSeconds] = useState(15);
  const [tickerText, setTickerText] = useState('');
  const [tickerSpeed, setTickerSpeed] = useState(40);
  const [sidebarWidth, setSidebarWidth] = useState('30%');

  useEffect(() => {
    if (!isOpen) return;

    if (layout) {
      setName(layout.name || '');
      setCode(layout.code || 'hotel_dock');
      setDescription(layout.description || '');
      setIsDefault(layout.is_default || false);

      const cfg = layout.config || {};
      setAccentColor(cfg.accent_color || '#3b82f6');
      setDockPosition(cfg.dock_position || (cfg.sidebar_position === 'right' ? 'right' : 'bottom'));
      setShowClock(cfg.show_clock !== false);
      setShowWeather(cfg.show_weather !== false);
      setShowWifiCard(cfg.show_wifi_card !== false);
      setShowQrCode(cfg.show_qr_code !== false);
      setAutoHideDock(cfg.auto_hide_dock ?? true);
      setAutoHideSeconds(cfg.auto_hide_seconds || 15);
      setTickerText(cfg.ticker_text || 'Bem-vindo ao nosso espaço! Conecte-se ao Wi-Fi para navegar em alta velocidade.');
      setTickerSpeed(cfg.ticker_speed || 40);
      setSidebarWidth(cfg.sidebar_width || '30%');
    } else {
      setName('');
      setCode('hotel_dock');
      setDescription('');
      setIsDefault(false);
      setAccentColor('#3b82f6');
      setDockPosition('bottom');
      setShowClock(true);
      setShowWeather(true);
      setShowWifiCard(true);
      setShowQrCode(true);
      setAutoHideDock(true);
      setAutoHideSeconds(15);
      setTickerText('Bem-vindo ao nosso espaço! Conecte-se ao Wi-Fi para navegar em alta velocidade.');
      setTickerSpeed(40);
      setSidebarWidth('30%');
    }
  }, [isOpen, layout?.id]);

  if (!isOpen) return null;

  const handlePresetSelect = (presetCode) => {
    setCode(presetCode);
    if (presetCode === 'hotel_dock') {
      setDockPosition('bottom');
      setAutoHideDock(true);
      setAutoHideSeconds(15);
      setAccentColor('#3b82f6');
      setShowClock(true);
      setShowWifiCard(true);
    } else if (presetCode === 'split_sidebar') {
      setDockPosition('right');
      setAutoHideDock(false);
      setAccentColor('#10b981');
      setShowClock(true);
      setShowQrCode(true);
      setShowWifiCard(true);
    } else if (presetCode === 'clean_minimal') {
      setDockPosition('bottom');
      setAutoHideDock(true);
      setAutoHideSeconds(6);
      setAccentColor('#8b5cf6');
      setShowClock(false);
      setShowWeather(false);
      setShowWifiCard(false);
    } else if (presetCode === 'digital_mural') {
      setDockPosition('bottom');
      setAutoHideDock(false);
      setAccentColor('#f59e0b');
      setShowClock(true);
      setShowWifiCard(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Informe o nome do modelo de layout');

    const config = {
      type: code,
      accent_color: accentColor,
      theme: 'dark',
      show_clock: showClock,
      show_weather: showWeather,
      show_wifi_card: showWifiCard,
      show_qr_code: showQrCode,
      auto_hide_dock: autoHideDock,
      auto_hide_seconds: parseInt(autoHideSeconds) || 15
    };

    if (code === 'split_sidebar') {
      config.sidebar_position = 'right';
      config.sidebar_width = sidebarWidth;
    } else if (code === 'digital_mural') {
      config.ticker_text = tickerText;
      config.ticker_speed = parseInt(tickerSpeed) || 40;
    } else {
      config.dock_position = dockPosition;
    }

    onSave({
      id: layout?.id,
      name,
      code,
      description: description || `Modelo de layout ${name}`,
      is_default: isDefault,
      config
    });
  };

  const presetList = [
    { code: 'hotel_dock', label: 'Hotel Luxo', sub: 'Dock Flutuante Inferior', color: '#3b82f6' },
    { code: 'split_sidebar', label: 'Corporativo Split', sub: 'Coluna Lateral 70/30', color: '#10b981' },
    { code: 'clean_minimal', label: 'Vitrine Minimal', sub: 'Tela Cheia sem Distrações', color: '#8b5cf6' },
    { code: 'digital_mural', label: 'Mural Informativo', sub: 'Barra de Avisos Ticker', color: '#f59e0b' }
  ];

  const colorPalette = [
    { color: '#3b82f6', label: 'Azul Hotel' },
    { color: '#10b981', label: 'Esmeralda' },
    { color: '#8b5cf6', label: 'Roxo Premium' },
    { color: '#f59e0b', label: 'Âmbar Dourado' },
    { color: '#f43f5e', label: 'Coral' },
    { color: '#06b6d4', label: 'Ciano' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 660, maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: '#fff' }}>
                {layout ? `Editar Modelo: ${layout.name}` : 'Criar Novo Modelo de Layout'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Configure a distribuição visual da tela, estilo do menu e elementos na TV.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Escolha do Estilo Base */}
            <div>
              <label className="form-label" style={{ marginBottom: 10 }}>Selecione o Estilo Base do Modelo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {presetList.map(p => {
                  const isSelected = code === p.code;
                  return (
                    <div
                      key={p.code}
                      onClick={() => handlePresetSelect(p.code)}
                      style={{
                        padding: 14, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s ease',
                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isSelected ? `2px solid ${p.color}` : '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{p.label}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Identificação */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome do Modelo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Sala de Reunião Premium" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Código Interno</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Descrição</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: Layout otimizado para lobby com avisos contínuos." 
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Cores de Destaque */}
            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Palette size={15} color={accentColor} /> Cor de Destaque da Interface
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {colorPalette.map(c => (
                  <div
                    key={c.color}
                    onClick={() => setAccentColor(c.color)}
                    title={c.label}
                    style={{
                      width: 32, height: 32, borderRadius: 8, background: c.color, cursor: 'pointer',
                      border: accentColor === c.color ? '3px solid #fff' : '2px solid transparent',
                      transform: accentColor === c.color ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
                <input 
                  type="color" 
                  value={accentColor} 
                  onChange={e => setAccentColor(e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }} 
                />
              </div>
            </div>

            {/* Elementos na Tela */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)',
              borderRadius: 14, padding: 16
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Elementos Visíveis na Tela da TV
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox" 
                    checked={showClock} 
                    onChange={e => setShowClock(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor }} 
                  />
                  <span>Relógio Digital no Topo</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox" 
                    checked={showWifiCard} 
                    onChange={e => setShowWifiCard(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor }} 
                  />
                  <span>Card de Wi-Fi e Senha</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox" 
                    checked={showQrCode} 
                    onChange={e => setShowQrCode(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor }} 
                  />
                  <span>QR Code de Conexão</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                  <input 
                    type="checkbox" 
                    checked={autoHideDock} 
                    onChange={e => setAutoHideDock(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor }} 
                  />
                  <span>Auto-ocultar Menu de Apps</span>
                </label>
              </div>

              {autoHideDock && (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.8rem' }}>Tempo até recolher o menu:</label>
                  <select 
                    className="form-select" 
                    value={autoHideSeconds} 
                    onChange={e => setAutoHideSeconds(e.target.value)}
                    style={{ width: 140, padding: '6px 10px' }}
                  >
                    <option value="5">5 segundos</option>
                    <option value="10">10 segundos</option>
                    <option value="15">15 segundos</option>
                    <option value="30">30 segundos</option>
                    <option value="60">1 minuto</option>
                  </select>
                </div>
              )}
            </div>

            {/* Configuração Específica de Ticker (se Mural Digital) */}
            {code === 'digital_mural' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 14, padding: 16
              }}>
                <label className="form-label" style={{ color: '#fcd34d' }}>Texto do Mural Informativo (Ticker Contínuo)</label>
                <textarea 
                  className="form-input"
                  rows={2}
                  value={tickerText}
                  onChange={e => setTickerText(e.target.value)}
                  placeholder="Digite os informes e avisos que rolam no rodapé da TV..."
                />
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={16} /> Salvar Modelo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
