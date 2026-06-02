import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createTrip, listTrips, clientAcceptTrip, cancelTrip, getPricing, getRouteGeometry, listRatings } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Bell, Search, MapPin, ChevronLeft, Target, Plus, Minus, Check, X } from 'lucide-react';
import MapaPedido from '../../components/MapaPedido';
import { getAddressFromCoords, getCoordsFromAddress } from '../../components/geocoding';
import ConfirmationModal from '../../components/ConfirmationModal';
import ProfileModal from '../../components/ProfileModal';
import { EuropeanDateTimeInput } from '../../components/EuropeanDateInput';
import { calculateEstimatedPrice } from '../../utils/pricing';
import './client.css';
import '../../components/map-background.css';
import { formatDateTimePT } from '../../utils/dateFormat';

export default function ClientMain() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [currentView, setCurrentView] = useState('initial'); // 'initial', 'selection', 'searching'
  const [searchValue, setSearchValue] = useState('');

  const getNowFormatted = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const [origin_address, setOriginAddress] = useState('');
  const [dest_address, setDestinationAddress] = useState('');
  const [dateTime, setDateTime] = useState(getNowFormatted());

  const [num_passengers, setPassengers] = useState(1);
  const [comfort_level, setComfort] = useState('basic');
  const [activeTrip, setActiveTrip] = useState(null);

  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [selectingFor, setSelectingFor] = useState(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [driverRating, setDriverRating] = useState('N/A');
  const [driverRatingCount, setDriverRatingCount] = useState(0);

  const [pricingConfig, setPricingConfig] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0); // in minutes

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const showConfirm = (title, message, onConfirm) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeModal();
      }
    });
  };

  const simplifyAddress = (addr) => {
    if (!addr || addr === 'Current Location' || addr === 'Localização Atual') return addr;
    const parts = addr.split(',').map(p => p.trim());

    // Portuguese street prefixes to identify the main street part
    const streetPrefixes = ['Rua', 'Avenida', 'Av.', 'Travessa', 'Tv.', 'Praça', 'Largo', 'Estrada', 'Azinhaga', 'Caminho', 'Beco', 'Calçada'];

    let streetIdx = -1;
    // Look for the street name in the first 3 parts (skipping POI name if present)
    for (let i = 0; i < Math.min(parts.length, 3); i++) {
      if (streetPrefixes.some(prefix => parts[i].toLowerCase().startsWith(prefix.toLowerCase()))) {
        streetIdx = i;
        break;
      }
    }

    // Fallback: if we couldn't find a prefix, check if part 1 is a number and part 2 is the street
    if (streetIdx === -1 && parts.length > 2 && /^\d/.test(parts[1])) {
      streetIdx = 2;
    }

    // Final fallback to part 0
    if (streetIdx === -1) streetIdx = 0;

    let street = parts[streetIdx];
    // If the previous part is a building number, include it
    if (streetIdx > 0 && /^\d/.test(parts[streetIdx - 1])) {
      street = `${parts[streetIdx - 1]} ${street}`;
    }

    // Freguesia is usually the next part, Concelho the one after
    const freguesia = parts[streetIdx + 1] || '';
    const concelho = parts[streetIdx + 2] || '';

    return [street, freguesia, concelho].filter(Boolean).join(', ');
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const originCoords = { 
            lat: position.coords.latitude, 
            lon: position.coords.longitude 
          };
          
          getAddressFromCoords(originCoords.lat, originCoords.lon).then(address => {
            setOrigem(originCoords);
            setOriginAddress(address);
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Fallback if denied
          const defaultCoords = { lat: 38.7111, lon: -9.1368 };
          getAddressFromCoords(defaultCoords.lat, defaultCoords.lon).then(address => {
            setOrigem(defaultCoords);
            setOriginAddress(address);
          });
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocalização não é suportada por este navegador.");
    }
  };


  const checkActiveTrip = async () => {
    try {
      const { data } = await listTrips();
      // Filter active trips for this client
      const mine = data.filter(t =>
        t.client_id === user.id &&
        ['PENDING', 'DRIVER_ACCEPTED', 'CLIENT_ACCEPTED', 'IN_PROGRESS', 'WAITING_PAYMENT', 'PAID'].includes(t.status)
      );

      if (mine.length > 0) {
        const trip = mine[0];
        setActiveTrip(trip);
        // If trip is in a state that should be shown in ClientTrip, navigate there
        navigate('/client/trip', { state: { tripId: trip.id, origem, destino } });
      }
    } catch (err) {
      console.error('Error checking active trip:', err);
    }
  };

  useEffect(() => {
    if (activeTrip?.driver_id) {
      const fetchDriverRating = async () => {
        try {
          const { data } = await listRatings(activeTrip.driver_id);
          if (data.length > 0) {
            const sum = data.reduce((acc, r) => acc + r.score, 0);
            setDriverRating((sum / data.length).toFixed(1));
            setDriverRatingCount(data.length);
          } else {
            setDriverRating('N/A');
            setDriverRatingCount(0);
          }
        } catch (err) {
          console.error('Error fetching driver ratings:', err);
        }
      };
      fetchDriverRating();
    }
  }, [activeTrip?.driver_id]);

  const fetchPricing = async () => {
    try {
      const { data } = await getPricing();
      setPricingConfig(data);
    } catch (err) {
      console.error('Error fetching pricing:', err);
    }
  };

  // Set current location as default origin on mount and check for active trips
  useEffect(() => {
    handleUseCurrentLocation();
    checkActiveTrip();
    fetchPricing();
  }, []);

  const handleSearchAddress = async (type) => {
    const addressToSearch = type === 'origin' ? origin_address : (type === 'destination' ? dest_address : searchValue);
    if (!addressToSearch) return;

    const coords = await getCoordsFromAddress(addressToSearch);
    if (coords) {
      const ponto = { lat: coords.lat, lon: coords.lon };
      if (type === 'origin') {
        setOrigem(ponto);
        setOriginAddress(simplifyAddress(coords.display_name));
      } else {
        setDestino(ponto);
        setDestinationAddress(simplifyAddress(coords.display_name));
        setSearchValue(simplifyAddress(coords.display_name));
      }
    } else {
      alert('Endereço não encontrado');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (path) => {
    setIsMenuOpen(false);
    if (path) navigate(path);
  };

  async function handleEscolherPonto(ponto) {
    const address = await getAddressFromCoords(ponto.lat, ponto.lon);

    if (selectingFor) {
      if (selectingFor === 'origin') {
        setOrigem(ponto);
        setOriginAddress(simplifyAddress(address));
      } else if (selectingFor === 'destination') {
        setDestino(ponto);
        setDestinationAddress(simplifyAddress(address));
        setSearchValue(simplifyAddress(address));
      }
      setSelectingFor(null);
    } else if (currentView === 'initial') {
      // Main view behavior: clicking map sets destination automatically
      setDestino(ponto);
      setDestinationAddress(simplifyAddress(address));
      setSearchValue(simplifyAddress(address));
    }
  }

  const handleProceedToSelection = async () => {
    // Basic validation
    if (!origin_address && !origem) {
      alert('Por favor, especifique uma origem.');
      return;
    }
    if (!dest_address && !destino && !searchValue) {
      alert('Por favor, especifique um destino.');
      return;
    }

    let finalOrigem = origem;
    let finalDestino = destino;
    const finalOriginAddr = origin_address || 'Localização Atual';
    const finalDestAddr = dest_address || searchValue;

    // Ensure we have coordinates even if the user didn't click/search specifically
    if (!finalOrigem && finalOriginAddr && finalOriginAddr !== 'Localização Atual') {
      const coords = await getCoordsFromAddress(finalOriginAddr);
      if (coords) {
        finalOrigem = { lat: coords.lat, lon: coords.lon };
        setOrigem(finalOrigem);
      }
    }
    if (!finalDestino && finalDestAddr) {
      const coords = await getCoordsFromAddress(finalDestAddr);
      if (coords) {
        finalDestino = { lat: coords.lat, lon: coords.lon };
        setDestino(finalDestino);
      }
    }

    // Ensure state matches what's in the text inputs if they were typed manually
    if (searchValue && dest_address !== searchValue) {
      setDestinationAddress(searchValue);
    }

    // Fetch Route Geometry and calculate price estimate
    if (finalOrigem && finalDestino) {
      try {
        const originStr = `${finalOrigem.lat},${finalOrigem.lon}`;
        const destStr = `${finalDestino.lat},${finalDestino.lon}`;
        const { data } = await getRouteGeometry(originStr, destStr);

        if (data.duration) {
          const minutes = data.duration / 60;
          setEstimatedDuration(Math.round(minutes));

          if (pricingConfig) {
            const price = calculateEstimatedPrice(minutes, comfort_level, pricingConfig);
            setEstimatedPrice(price);
          }
        }
      } catch (err) {
        console.error('Error calculating estimate:', err);
      }
    }

    setCurrentView('selection');
  };

  const handleConfirmRide = async () => {
    try {
      const { data } = await createTrip({
        client_id: user.id,
        originAddress: origin_address,
        destAddress: dest_address || searchValue,
        originCoords: origem ? `${origem.lat},${origem.lon}` : null,
        destCoords: destino ? `${destino.lat},${destino.lon}` : null,
        comfort_level,
        num_passengers,
        scheduled_time: dateTime ? new Date(dateTime).toISOString() : null,
      });

      // Navigate to the trip tracking page
      navigate('/client/trip', {
        state: {
          tripId: data.id,
          origem,
          destino
        }
      });
    } catch (error) {
      const errorData = error.response?.data;
      let errorMsg = error.message;

      if (errorData) {
        if (typeof errorData === 'object') {
          errorMsg = Object.entries(errorData)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('\n');
        } else if (typeof errorData === 'string') {
          errorMsg = errorData;
        }
      }

      alert('Erro ao criar viagem:\n' + errorMsg);
    }
  }

  const handleCancelTrip = async () => {
    if (!activeTrip) return;

    showConfirm(
      'Recusar Motorista?',
      'Tem a certeza que deseja recusar este motorista? A sua viagem será cancelada.',
      async () => {
        try {
          await cancelTrip(activeTrip.id);
          setActiveTrip(null);
          setCurrentView('initial');
        } catch (err) {
          alert('Erro ao cancelar viagem');
        }
      }
    );
  };

  const handleClientAccept = async () => {
    if (!activeTrip) return;

    showConfirm(
      'Confirmar Motorista?',
      'Deseja aceitar este motorista para a sua viagem?',
      async () => {
        try {
          await clientAcceptTrip(activeTrip.id);
          setCurrentView('in_progress');
        } catch (err) {
          alert('Error accepting trip');
        }
      }
    );
  };

  const renderSearchPanel = () => {
    switch (currentView) {
      case 'accepted':
        return (
          <div className="accepted-view" style={{ textAlign: 'center' }}>
            <div className="driver-info" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <div className="driver-photo" style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: '#eee', overflow: 'hidden' }}>
                <img src={`/PFPs/${activeTrip?.driver_pfp || 1}.jpg`} alt="Driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{activeTrip?.driver_name}</h3>
                <div style={{ color: '#f1af3d', fontWeight: 'bold' }}>⭐ {driverRating} ({driverRatingCount} reviews)</div>
              </div>
            </div>
            <div className="car-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #eee', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0 }}>{activeTrip?.taxi_brand} {activeTrip?.taxi_model}</h4>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{activeTrip?.taxi_plate}</div>
              </div>
              <div className="car-icon">🚗</div>
            </div>
            <div className="actions" style={{ display: 'flex', gap: '10px' }}>
              <button
                className="search-btn"
                onClick={handleCancelTrip}
                style={{ flex: 1, backgroundColor: '#e53e3e', color: '#fff' }}
              >
                Recusar
              </button>
              <button
                className="search-btn"
                onClick={handleClientAccept}
                style={{ flex: 1, backgroundColor: '#f1cf58', color: '#fff' }}
              >
                Aceitar
              </button>
            </div>
          </div>
        );

      case 'in_progress':
        return (
          <div className="in-progress-view" style={{ textAlign: 'center', padding: '20px' }}>
            <h2 className="view-title">Viagem em Curso</h2>
            <p>O seu motorista está a caminho!</p>
            <div className="driver-brief" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
              <span>🚗</span>
              <strong>{activeTrip?.driver_name}</strong>
              <span style={{ marginLeft: 'auto' }}>{activeTrip?.taxi_plate}</span>
            </div>
          </div>
        );

      case 'selection':
        return (
          <div className="selection-view">
            <div className="view-header">
              <button
                className="back-btn"
                onClick={() => setCurrentView('initial')}
                title="Voltar"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="view-title">Quando deseja partir?</h2>
            </div>

            <div className="trip-summary-mini" style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '10px',
              border: '1.5px solid #f1cf58',
              marginBottom: '16px',
              fontSize: '1.05rem',
              color: '#374151',
              textAlign: 'left'
            }}>
              <div style={{ marginBottom: '6px' }}><strong>De:</strong> {simplifyAddress(origin_address) || 'Localização Atual'}</div>
              <div style={{ marginBottom: '6px' }}><strong>Para:</strong> {simplifyAddress(dest_address || searchValue)}</div>
              <div style={{ marginBottom: '6px' }}><strong>Serviço:</strong> {comfort_level === 'basic' ? 'Básico' : 'Luxo'} • {num_passengers} {num_passengers > 1 ? 'passageiros' : 'passageiro'}</div>
              {estimatedPrice > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #f1cf58', fontWeight: '800', color: '#000', fontSize: '1.2rem' }}>
                  Estimativa: €{estimatedPrice.toFixed(2)} ({estimatedDuration} min)
                </div>
              )}
            </div>

            {!isScheduling ? (
              <div className="selection-options" style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginTop: '10px' }}>
                <button
                  className="search-btn"
                  style={{ flex: 1, height: '52px', fontSize: '1.05rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' }}
                  onClick={() => setIsScheduling(true)}
                >
                  Agendar
                </button>
                <button
                  className="search-btn search-btn--primary"
                  style={{ flex: 1, height: '52px', fontSize: '1.05rem' }}
                  onClick={() => {
                    setDateTime('');
                    setCurrentView('confirmation');
                  }}
                >
                  Partir Agora
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                <EuropeanDateTimeInput
                  className="timestamp-input"
                  value={dateTime}
                  onChange={setDateTime}
                />
                <button
                  className="search-btn search-btn--primary"
                  style={{ flex: 'none', width: '48px', height: '48px', padding: 0 }}
                  onClick={() => {
                    if (!dateTime) {
                      alert('Por favor, selecione uma data e hora para a sua viagem agendada.');
                      return;
                    }
                    setCurrentView('confirmation');
                  }}
                >
                  <Check size={24} />
                </button>
                <button
                  className="search-btn"
                  style={{ flex: 'none', width: '48px', height: '48px', padding: 0, backgroundColor: '#fee2e2', color: '#ef4444' }}
                  onClick={() => setIsScheduling(false)}
                >
                  <X size={24} />
                </button>
              </div>
            )}
          </div>
        );

      case 'confirmation':
        return (
          <div className="confirmation-view" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            minHeight: '320px',
            justifyContent: 'space-between'
          }}>
            <div className="view-header">
              <button
                className="back-btn"
                onClick={() => setCurrentView('selection')}
                title="Voltar"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="view-title" style={{ fontSize: '1.3rem' }}>Resumo da Viagem</h2>
            </div>

            <div className="details-list" style={{
              background: '#fff',
              border: '2px solid #f1cf58',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              overflowY: 'auto'
            }}>
              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>De</span>
                <div style={{ fontSize: '1rem', color: '#1f2937', lineHeight: '1.3' }}>{origin_address || 'Localização Atual'}</div>
              </div>

              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Para</span>
                <div style={{ fontSize: '1rem', color: '#1f2937', lineHeight: '1.3' }}>{dest_address || searchValue}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', borderTop: '2px dashed #f3f4f6', paddingTop: '12px' }}>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Serviço</span>
                  <div style={{ fontSize: '0.95rem', color: '#1f2937' }}>{comfort_level === 'basic' ? 'Básico' : 'Luxo'}</div>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lugares</span>
                  <div style={{ fontSize: '0.95rem', color: '#1f2937' }}>{num_passengers}</div>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duração</span>
                  <div style={{ fontSize: '0.95rem', color: '#1f2937' }}>{estimatedDuration} min</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '15px', borderTop: '2px dashed #f3f4f6', paddingTop: '12px' }}>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hora de Recolha</span>
                  <div style={{ fontSize: '1rem', color: '#f1af3d', fontWeight: '700' }}>
                    {dateTime ? formatDateTimePT(dateTime) : 'Imediata'}
                  </div>
                </div>
                <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f1af3d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preço</span>
                  <div style={{ fontSize: '1.1rem', color: '#000', fontWeight: '800' }}>€{estimatedPrice.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <button
              className="search-btn search-btn--primary"
              onClick={handleConfirmRide}
              style={{
                marginTop: '5px',
                padding: '10px 0',
                height: '56px',
                fontSize: '1.1rem',
                letterSpacing: '0.5px'
              }}
            >
              Confirmar Viagem
            </button>
          </div>
        );

      default:
        return (
          <div className="more-options-form">
            <div className="form-group">
              <label>Introduza a origem:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <button
                    className="input-search-btn"
                    onClick={() => handleSearchAddress('origin')}
                    title="Pesquisar endereço"
                  >
                    <Search size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Rua das Oliveiras, Campo Grande"
                    value={origin_address}
                    onChange={(e) => setOriginAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress('origin')}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className={`pinpoint-btn pinpoint-btn--small ${selectingFor === 'origin' ? 'active' : ''}`}
                  onClick={() => setSelectingFor(selectingFor === 'origin' ? null : 'origin')}
                  title="Selecionar origem no mapa"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Introduza o destino:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <button
                    className="input-search-btn"
                    onClick={() => handleSearchAddress('destination')}
                    title="Pesquisar endereço"
                  >
                    <Search size={16} />
                  </button>
                  <input
                    type="text"
                    placeholder="Avenida Dos Campos, Saldanha"
                    value={dest_address}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress('destination')}
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className={`pinpoint-btn pinpoint-btn--small ${selectingFor === 'destination' ? 'active' : ''}`}
                  onClick={() => setSelectingFor(selectingFor === 'destination' ? null : 'destination')}
                  title="Selecionar destino no mapa"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="trip-settings-row">
              <div className="setting-item">
                <label>Nível de Conforto</label>
                <select
                  className="setting-input"
                  value={comfort_level}
                  onChange={(e) => setComfort(e.target.value)}
                >
                  <option value="basic">Básico</option>
                  <option value="luxury">Luxo</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Passageiros</label>
                <div className="number-control">
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.max(1, num_passengers - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="number-value">{num_passengers}</span>
                  <button
                    className="number-btn"
                    onClick={() => setPassengers(Math.min(6, num_passengers + 1))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="search-actions">
              <button
                className="search-btn search-btn--primary"
                onClick={handleProceedToSelection}
                style={{ width: '100%' }}
              >
                Pedir Tuxy
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="client-layout">
      <header className="client-header">
        <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
          <Menu size={24} color="#000" />
        </button>

        <div className="client-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icon_small.png" alt="TUXY Icon" style={{ width: '28px', height: '28px' }} />
          <span className="client-brand-name">TUXY</span>
        </div>

        <div
          className="user-name-container"
          onClick={() => setIsProfileModalOpen(true)}
          style={{ cursor: 'pointer' }}
        >
          <span className="user-name-text">{user?.name?.split(' ')[0]}</span>
          <img
            src={`/PFPs/${user?.profile_pic || 1}.jpg`}
            alt="Profile"
            className="user-pfp-small"
          />
        </div>
      </header>

      <main className="client-main-content">
        <div className="map-wrapper">
          <MapaPedido
            origem={origem}
            destino={destino}
            onEscolherPonto={handleEscolherPonto}
          />
        </div>

        <section className="search-panel">
          {renderSearchPanel()}
        </section>

      </main>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              className="drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              className="drawer-menu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <div className="drawer-header">
                <span className="drawer-title">Menu</span>
                <button className="drawer-close" onClick={() => setIsMenuOpen(false)}>
                  <ChevronLeft size={24} />
                </button>
              </div>

              <nav className="drawer-nav">
                <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
                  Início
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client')}>
                  Pedir Viagem
                </button>
                <button className="drawer-link" onClick={() => handleMenuClick('/client/history')}>
                  Histórico
                </button>
              </nav>

              <div className="drawer-footer">
                <button className="drawer-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        forcedType="CLIENT"
      />
    </div>
  );
}
