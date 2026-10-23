import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv, Wifi, Clock, CloudSun, Sun, Cloud, CloudRain, Moon, Play, Pause, Volume2, VolumeX, 
  Maximize2, Radio, Sparkles, Film, Video, PlaySquare, Music,
  ArrowRight, QrCode, MonitorPlay, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown
} from 'lucide-react';
import BrandAppIcon from './BrandAppIcon';

const ICON_MAP = {
  Tv: Tv,
  PlaySquare: PlaySquare,
  Youtube: Video,
  Film: Film,
  Tv2: Tv,
  Sparkles: Sparkles,
  Clapperboard: Film,
  Music: Music,
};

export default function TVSimulator({ tv, layout, playlist, shortcuts, onCommand }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dockVisible, setDockVisible] = useState(true);
  const [activeApp, setActiveApp] = useState(null); // When an app is "opened" in simulator
  const [hdmiActive, setHdmiActive] = useState(false);
  const videoRef = useRef(null);
  const dockTimeoutRef = useRef(null);

  // Layout code and config
  const layoutCode = layout?.code || tv?.layout?.code || 'hotel_dock';
  const config = layout?.config || tv?.layout?.config || {};
  const custom = tv?.custom_settings || {};

  const welcomeTitle = custom.welcome_title || 'Seja Bem-vindo(a)!';
  const welcomeSubtitle = custom.welcome_subtitle || 'Aproveite o melhor do entretenimento.';
  const wifiSsid = (custom.wifi_ssid || '').trim();
  const wifiPass = (custom.wifi_password || '').trim();
  const hasWifiQr = Boolean(custom.wifi_qrcode_url && custom.wifi_qrcode_url.trim());
  const showWifi = custom.show_wifi !== false;
  const hasWifiInfo = Boolean(wifiSsid || wifiPass || hasWifiQr);
  const hdmiLabel = tv?.hdmi_label || 'TV SKY';
  const hdmiInput = tv?.hdmi_input_id || 'HDMI 1';

  // Build items from playlist
  const playlistItems = playlist?.items || tv?.playlist?.items || [];
  const currentMedia = playlistItems[currentVideoIndex]?.media;

  // Build active shortcuts for this TV
  const tvShortcuts = React.useMemo(() => {
    if (!shortcuts || shortcuts.length === 0) return [];
    if (tv?.selected_shortcuts && tv.selected_shortcuts.length > 0) {
      return shortcuts.filter(s => tv.selected_shortcuts.includes(s.id));
    }
    return shortcuts;
  }, [shortcuts, tv]);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-advance playlist
  const handleVideoEnded = () => {
    if (playlistItems.length > 1) {
      setCurrentVideoIndex((prev) => (prev + 1) % playlistItems.length);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
  };

  // Auto-hide dock logic
  const resetDockTimer = () => {
    setDockVisible(true);
    if (dockTimeoutRef.current) clearTimeout(dockTimeoutRef.current);
    if (config.auto_hide_dock !== false) {
      const seconds = (config.auto_hide_seconds || 12) * 1000;
      dockTimeoutRef.current = setTimeout(() => {
        setDockVisible(false);
      }, seconds);
    }
  };

  useEffect(() => {
    resetDockTimer();
    return () => {
      if (dockTimeoutRef.current) clearTimeout(dockTimeoutRef.current);
    };
  }, [layoutCode]);

  // Keyboard navigation for TV D-Pad simulation
  useEffect(() => {
    const handleKeyDown = (e) => {
      resetDockTimer();
      const totalItems = tvShortcuts.length;
      if (totalItems === 0) return;

      if (e.key === 'ArrowRight') {
        setFocusedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowLeft') {
        setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        const item = tvShortcuts[focusedIndex];
        if (item) handleSelectShortcut(item);
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        setActiveApp(null);
        setHdmiActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, tvShortcuts]);

  const handleSelectShortcut = (shortcut) => {
    if (shortcut.is_hdmi) {
      setHdmiActive(true);
      setActiveApp(null);
    } else {
      setActiveApp(shortcut);
      setHdmiActive(false);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

  // Fallback video: aesthetic abstract scenic video from reliable public CDN
  const videoSrc = currentMedia?.stream_url || "https://assets.mixkit.co/videos/preview/mixkit-curved-road-on-a-sunny-day-40742-large.mp4";

  return (
    <div className="tv-simulator-wrapper" onMouseMove={resetDockTimer}>
      {/* Top Simulator Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
            padding: '4px 12px', borderRadius: 9999, fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600
          }}>
            <Tv size={14} /> {tv?.name || 'Smart TV'} ({tv?.room_group || 'Quarto'})
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Layout: <strong>{layout?.name || 'Hotel Luxo'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pausar Vídeo" : "Reproduzir Vídeo"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pausar' : 'Play'}
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? "Ativar Áudio" : "Mudo"}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} {isMuted ? 'Mudo' : 'Com Som'}
          </button>
          {(activeApp || hdmiActive) && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => { setActiveApp(null); setHdmiActive(false); }}
            >
              Voltar à Launcher (Home)
            </button>
          )}
        </div>
      </div>

      {/* 16:9 TV Screen Bezel */}
      <div className="tv-simulator-frame">
        {/* Sky HDMI Overlay Mode */}
        {hdmiActive ? (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'linear-gradient(135deg, #0b1528 0%, #030712 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', textAlign: 'center', padding: 30
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)',
              border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)'
            }}>
              <Tv size={42} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 8 }}>{hdmiLabel}</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 450, marginBottom: 24 }}>
              Exibindo sinal de vídeo recebido através da porta <strong>{hdmiInput}</strong> (Decodificador Sky).
            </p>
            <div style={{ display: 'inline-flex', gap: 12 }}>
              <button 
                className="btn btn-primary"
                onClick={() => setHdmiActive(false)}
              >
                Retornar ao Menu da Launcher
              </button>
            </div>
          </div>
        ) : activeApp ? (
          /* Third-Party App Opened Simulation */
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: '#090d16',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', textAlign: 'center', padding: 30
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, boxShadow: '0 0 35px rgba(59, 130, 246, 0.3)'
            }}>
              <MonitorPlay size={40} color="#60a5fa" />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 6 }}>{activeApp.name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: 18 }}>
              Pacote Android: <code>{activeApp.package_name}</code>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 400, marginBottom: 24 }}>
              O aplicativo externo foi executado com sucesso no Android TV. Pressione Voltar no controle para retornar à tela inicial.
            </p>
            <button 
              className="btn btn-secondary"
              onClick={() => setActiveApp(null)}
            >
              Voltar para Launcher
            </button>
          </div>
        ) : (
          /* Normal Launcher UI */
          <>
            {/* Background Video Player */}
            <video
              ref={videoRef}
              src={videoSrc}
              className="tv-screen-video"
              autoPlay
              loop={playlistItems.length <= 1}
              muted={isMuted}
              onEnded={handleVideoEnded}
              playsInline
            />

            {/* Dark gradient overlay for readability */}
            <div style={{
              position: 'absolute', inset: 0,
              background: layoutCode === 'split_sidebar' 
                ? 'linear-gradient(90deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)'
                : 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.85) 100%)',
              pointerEvents: 'none'
            }} />

            {/* LAYOUT 1: HOTEL LUXO (DOCK FLUTUANTE) */}
            {layoutCode === 'hotel_dock' && (() => {
              const titleSizePx = Math.round((custom.title_font_size || 32) * 0.88);
              const subtitleSizePx = Math.max(12, Math.round(titleSizePx * 0.52));
              const clockSizePx = Math.round((custom.clock_font_size || 24) * 0.85);
              const showClock = custom.show_clock !== false;
              const showWeather = custom.show_weather !== false;
              const weatherCity = custom.weather_city || 'Salvador';
              const weatherTemp = custom.weather_temp || '28°C';
              const weatherCond = custom.weather_condition || 'sunny';
              const isReversedHeader = custom.header_layout === 'widgets_left_welcome_right';
              
              const weatherFontSize = custom.weather_font_size || 20;
              const weatherTempSizePx = Math.round(weatherFontSize * 0.8);
              const weatherCitySizePx = Math.max(10, Math.round(weatherTempSizePx * 0.62));
              const weatherIconSizePx = Math.max(16, Math.round(weatherTempSizePx * 0.9));

              const dockBase = custom.dock_icon_size || 72;
              const dockBtnWidth = Math.round(dockBase * 1.65);
              const dockBtnHeight = Math.round(dockBase * 1.15);
              const dockInnerSize = custom.dock_inner_icon_size || Math.round(dockBase * 0.44);
              const dockIconHeight = dockInnerSize;
              const dockTextSize = custom.dock_text_size || Math.max(11, Math.round(dockBase * 0.175));
              const qrSizePx = Math.round((custom.wifi_qr_size || 110) * 0.42);

              const getWeatherIcon = (iconSize = 18) => {
                switch (weatherCond) {
                  case 'sunny': return <Sun size={iconSize} color="#fbbf24" />;
                  case 'partly_cloudy': return <CloudSun size={iconSize} color="#60a5fa" />;
                  case 'cloudy': return <Cloud size={iconSize} color="#94a3b8" />;
                  case 'rain': return <CloudRain size={iconSize} color="#38bdf8" />;
                  case 'clear_night': return <Moon size={iconSize} color="#c084fc" />;
                  default: return <Sun size={iconSize} color="#fbbf24" />;
                }
              };

              return (
              <div className="tv-screen-overlay" style={{ padding: '24px 32px' }}>
                {/* Header: Room & Status with Dynamic Layout Direction */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isReversedHeader ? 'row-reverse' : 'row',
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  gap: 16
                }}>
                  {/* Mensagem de Boas-vindas com Tamanho Dinâmico */}
                  <div style={{ flex: 1, textAlign: isReversedHeader ? 'right' : 'left' }}>
                    <h1 style={{ 
                      fontSize: `${titleSizePx}px`, 
                      fontWeight: 800, 
                      color: '#fff', 
                      lineHeight: 1.15,
                      textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                      margin: 0
                    }}>
                      {welcomeTitle}
                    </h1>
                    <p style={{ 
                      fontSize: `${subtitleSizePx}px`, 
                      color: 'rgba(255,255,255,0.8)', 
                      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                      marginTop: 4,
                      marginBottom: 0
                    }}>
                      {welcomeSubtitle}
                    </p>
                  </div>

                  {/* Widgets: Relógio, Clima e Wi-Fi / QR Code */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {/* Widget de Previsão do Tempo */}
                    {showWeather && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 12,
                        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        {getWeatherIcon(weatherIconSizePx)}
                        <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                          <span style={{ fontSize: `${weatherTempSizePx}px`, fontWeight: 700, color: '#fff' }}>{weatherTemp}</span>
                          <div style={{ fontSize: `${weatherCitySizePx}px`, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
                            {weatherCity}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Relógio Digital com Tamanho Dinâmico e Formato */}
                    {showClock && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 12,
                        padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        <Clock size={Math.max(14, Math.round(clockSizePx * 0.72))} color="#38bdf8" />
                        <span style={{ fontSize: `${clockSizePx}px`, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                          {formattedTime}
                        </span>
                        {custom.clock_format === 'time_and_date' && (
                          <span style={{ fontSize: `${Math.max(10, Math.round(clockSizePx * 0.52))}px`, color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
                            {formattedDate}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Wi-Fi & QR Code */}
                    {showWifi && hasWifiInfo && (
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 12,
                        padding: (wifiSsid || wifiPass) ? '6px 12px' : '6px',
                        display: 'flex', alignItems: 'center', gap: (wifiSsid || wifiPass) ? 8 : 0,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        {hasWifiQr ? (
                          <img 
                            src={custom.wifi_qrcode_url} 
                            alt="Wi-Fi QR"
                            style={{
                              width: qrSizePx,
                              height: qrSizePx,
                              borderRadius: 6,
                              background: '#fff',
                              padding: 2,
                              objectFit: 'contain'
                            }}
                          />
                        ) : (
                          <Wifi size={16} color="#34d399" />
                        )}
                        {(wifiSsid || wifiPass) && (
                          <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                            {wifiSsid && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>{wifiSsid}</div>}
                            {wifiPass && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)' }}>Senha: {wifiPass}</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Dock com Tamanho Dinâmico de Ícones */}
                <div style={{
                  opacity: dockVisible ? 1 : 0.08,
                  transform: dockVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: 'rgba(11, 16, 27, 0.82)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 22,
                  padding: '12px 20px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Canais & Aplicativos
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                      Pressione ◀ ▶ no controle para navegar
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    gap: 12, 
                    overflowX: 'auto', 
                    overflowY: 'visible',
                    padding: '8px 6px 12px 6px',
                    margin: '-4px -6px -6px -6px',
                    alignItems: 'center',
                    scrollbarWidth: 'none'
                  }}>
                    {tvShortcuts.map((item, idx) => {
                      const isFocused = idx === focusedIndex;
                      const isSky = item.is_hdmi;
                      return (
                        <button
                          key={item.id || idx}
                          onClick={() => { setFocusedIndex(idx); handleSelectShortcut(item); }}
                          style={{
                            position: 'relative',
                            zIndex: isFocused ? 10 : 1,
                            background: isSky
                              ? (isFocused 
                                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(185, 28, 28, 0.95) 100%)' 
                                  : 'rgba(239, 68, 68, 0.25)')
                              : (item.background_color
                                  ? item.background_color
                                  : (isFocused 
                                      ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)' 
                                      : 'rgba(0, 0, 0, 0.45)')),
                            backdropFilter: 'blur(12px)',
                            border: isFocused 
                              ? (isSky ? '2.5px solid #ffffff' : '2.5px solid #3b82f6')
                              : (isSky ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)'),
                            boxShadow: isFocused 
                              ? (isSky 
                                  ? '0 0 0 2px rgba(255,255,255,0.85), 0 14px 28px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.6)'
                                  : '0 0 0 2px rgba(255,255,255,0.85), 0 14px 28px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.6)')
                              : '0 4px 12px rgba(0, 0, 0, 0.25)',
                            transform: isFocused ? 'scale(1.08) translateY(-4px)' : 'scale(1)',
                            willChange: 'transform, box-shadow',
                            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.2s ease, background 0.2s ease',
                            borderRadius: 16,
                            padding: '8px 12px',
                            minWidth: dockBtnWidth,
                            height: dockBtnHeight,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            color: '#fff',
                            cursor: 'pointer',
                            outline: 'none',
                            flexShrink: 0
                          }}
                        >
                          <div style={{
                            height: dockIconHeight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transform: isFocused ? 'scale(1.08)' : 'scale(1)',
                            transition: 'transform 0.25s ease'
                          }}>
                            <BrandAppIcon 
                              name={item.name} 
                              packageName={item.package_name} 
                              iconUrl={item.icon_url}
                              isHdmi={isSky} 
                              isFocused={isFocused} 
                              size={dockInnerSize}
                            />
                          </div>
                          <span style={{ 
                            fontSize: `${dockTextSize}px`, 
                            fontWeight: isFocused ? 700 : 600, 
                            whiteSpace: 'nowrap',
                            color: isFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                            letterSpacing: isFocused ? '0.01em' : 'normal'
                          }}>
                            {isSky ? hdmiLabel : item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })()}

            {/* LAYOUT 2: SPLIT SCREEN (70% VIDEO / 30% SIDEBAR) */}
            {layoutCode === 'split_sidebar' && (
              <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                {/* 70% Video Area */}
                <div style={{ flex: 7, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
                    padding: '16px 22px', maxWidth: 450
                  }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                      {welcomeTitle}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
                      {welcomeSubtitle}
                    </p>
                  </div>
                </div>

                {/* 30% Right Sidebar */}
                <div style={{
                  flex: 3,
                  background: 'rgba(9, 14, 24, 0.88)',
                  backdropFilter: 'blur(25px)',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  overflowY: 'auto'
                }}>
                  {/* Clock & Weather Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)', borderRadius: 16,
                    padding: 16, border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                      {formattedTime}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: 4 }}>
                      {formattedDate}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.85rem', color: '#60a5fa' }}>
                      <CloudSun size={18} /> 24°C • Parcialmente Ensolarado
                    </div>
                  </div>

                  {/* Wi-Fi Card */}
                  {showWifi && hasWifiInfo && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12
                    }}>
                      {hasWifiQr ? (
                        <img 
                          src={custom.wifi_qrcode_url} 
                          alt="Wi-Fi QR"
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 6,
                            background: '#fff',
                            padding: 2,
                            objectFit: 'contain'
                          }}
                        />
                      ) : (
                        <QrCode size={36} color="#34d399" />
                      )}
                      {(wifiSsid || wifiPass) ? (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                            Wi-Fi do Quarto
                          </div>
                          {wifiSsid && <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{wifiSsid}</div>}
                          {wifiPass && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Senha: {wifiPass}</div>}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                            Wi-Fi do Quarto
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#fff' }}>Aponte a câmera para conectar</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Shortcuts List */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                      Entretenimento
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tvShortcuts.map((item, idx) => {
                        const isFocused = idx === focusedIndex;
                        const isSky = item.is_hdmi;
                        return (
                          <button
                            key={item.id || idx}
                            onClick={() => { setFocusedIndex(idx); handleSelectShortcut(item); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '10px 16px', borderRadius: 14,
                              background: isSky 
                                ? (isFocused ? '#ef4444' : 'rgba(239, 68, 68, 0.22)')
                                : (item.background_color 
                                    ? item.background_color 
                                    : (isFocused ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'rgba(255, 255, 255, 0.06)')),
                              border: isFocused ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                              boxShadow: isFocused ? '0 0 20px rgba(59, 130, 246, 0.5)' : 'none',
                              color: '#fff', cursor: 'pointer', textAlign: 'left',
                              transform: isFocused ? 'scale(1.04) translateX(4px)' : 'scale(1)',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                          >
                            <div style={{ width: 30, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BrandAppIcon name={item.name} packageName={item.package_name} iconUrl={item.icon_url} isHdmi={isSky} isFocused={isFocused} />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: isFocused ? 700 : 600, flex: 1 }}>
                              {isSky ? hdmiLabel : item.name}
                            </span>
                            <ArrowRight size={14} opacity={isFocused ? 1 : 0.4} color={isFocused ? '#60a5fa' : '#fff'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* LAYOUT 3: VITRINE MINIMALISTA */}
            {layoutCode === 'clean_minimal' && (
              <div className="tv-screen-overlay" style={{ padding: 30 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
                    padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)'
                  }}>
                    {tv?.name} • Pressione qualquer tecla para menu
                  </div>
                </div>

                {dockVisible && (
                  <div style={{
                    alignSelf: 'center', background: 'rgba(10, 14, 23, 0.9)',
                    backdropFilter: 'blur(20px)', borderRadius: 20, padding: '14px 22px',
                    border: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: 12
                  }}>
                    {tvShortcuts.map((item, idx) => {
                      const isFocused = idx === focusedIndex;
                      const isSky = item.is_hdmi;
                      return (
                        <button
                          key={item.id || idx}
                          onClick={() => { setFocusedIndex(idx); handleSelectShortcut(item); }}
                          style={{
                            background: isSky
                              ? (isFocused ? '#ef4444' : 'rgba(239, 68, 68, 0.25)')
                              : (item.background_color 
                                  ? item.background_color 
                                  : (isFocused ? '#2563eb' : 'rgba(255,255,255,0.08)')),
                            border: isFocused ? '2px solid #fff' : '1px solid transparent',
                            boxShadow: isFocused ? '0 0 20px rgba(59, 130, 246, 0.6)' : 'none',
                            color: '#fff', borderRadius: 12, padding: '8px 14px',
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600,
                            transform: isFocused ? 'scale(1.08)' : 'scale(1)',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          <div style={{ width: 22, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BrandAppIcon name={item.name} packageName={item.package_name} iconUrl={item.icon_url} isHdmi={isSky} isFocused={isFocused} size={22} />
                          </div>
                          <span>{item.is_hdmi ? hdmiLabel : item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LAYOUT 4: MURAL DIGITAL (BARRA DE AVISOS TICKER) */}
            {layoutCode === 'digital_mural' && (
              <div className="tv-screen-overlay" style={{ justifyContent: 'space-between' }}>
                {/* Top Header */}
                <div style={{
                  padding: '14px 28px', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                    {tv?.name} <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 500 }}>• {tv?.room_group}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    {tvShortcuts.slice(0, 4).map((item, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleSelectShortcut(item)}
                        style={{
                          background: item.is_hdmi ? '#ef4444' : 'rgba(255,255,255,0.12)',
                          color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px',
                          fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {item.is_hdmi ? hdmiLabel : item.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom Marquee / Ticker */}
                <div style={{
                  background: 'linear-gradient(90deg, #1e3a8a 0%, #0f172a 100%)',
                  padding: '10px 20px', borderTop: '2px solid #3b82f6',
                  display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden'
                }}>
                  <div style={{
                    background: '#ef4444', color: '#fff', fontSize: '0.75rem', fontWeight: 800,
                    padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    Avisos
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', whiteSpace: 'nowrap', animation: 'marquee 20s linear infinite' }}>
                    {custom.welcome_subtitle || (wifiPass ? "Café da manhã servido das 06:00 às 10:00 no restaurante principal. Conecte-se ao Wi-Fi com a senha: " + wifiPass : "Café da manhã servido das 06:00 às 10:00 no restaurante principal.")}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Virtual Remote Control Help Bar */}
      <div style={{
        marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span>Controle Remoto Virtual:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6 }}>
            <ChevronLeft size={12} /> ◀ Navegar ▶ <ChevronRight size={12} />
          </span>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6 }}>
            [Enter] Abrir
          </span>
          <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6 }}>
            [Esc] Voltar
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setFocusedIndex((prev) => Math.max(0, prev - 1))}
          >
            ◀ Esquerda
          </button>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => {
              const item = tvShortcuts[focusedIndex];
              if (item) handleSelectShortcut(item);
            }}
          >
            OK / Abrir
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setFocusedIndex((prev) => Math.min(tvShortcuts.length - 1, prev + 1))}
          >
            Direita ▶
          </button>
        </div>
      </div>
    </div>
  );
}
