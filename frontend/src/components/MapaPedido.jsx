import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet'
import React, { useEffect } from 'react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const carIcon = new L.DivIcon({
  html: `<div style="color: #000;"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.6 2 12.3 2 13v3c0 .6.4 1 1 1h2m14 0c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2zM7 17c0 1.1-.9 2-2 2s-2-.9-2-2 1.1-2 2-2 2 .9 2 2z"/></svg></div>`,
  className: 'custom-car',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const originIcon = new L.DivIcon({
  html: `<div style="color: #3b82f6;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="3"><circle cx="12" cy="12" r="10"/></svg></div>`,
  className: 'custom-circle',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destIcon = new L.DivIcon({
  html: `<div style="color: #f63b3b;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className: 'custom-pin',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      if (onPick) {
        onPick({
          lat: e.latlng.lat,
          lon: e.latlng.lng,
        })
      }
    },
  })
  return null
}

function MapRefresher({ center }) {
  const map = useMapEvents({})
  useEffect(() => {
    if (center) map.setView(center, map.getZoom())
  }, [center, map])
  return null
}

export default function MapaPedido({ origem, destino, onEscolherPonto, routeCoords = [], carPos = null, isInProgress = false }) {
  const centroPortugal = [38.7223, -9.1393]
  const center = carPos ? [carPos.lat, carPos.lon] : (origem ? [origem.lat, origem.lon] : centroPortugal)

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '100%' }}>
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%', minHeight: '100%' }}>
        {/* BACKUP: OSM HOT (Humanitarian) - Good contrast but has electrical lines
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'
          maxZoom={19}
        />
        */}
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution="&copy; Google Maps"
          maxZoom={20}
        />

        <MapRefresher center={center} />
        <ClickHandler onPick={onEscolherPonto} />

        {origem && (
          <Marker position={[origem.lat, origem.lon]} icon={isInProgress ? carIcon : originIcon}>
            <Popup>{isInProgress ? 'Você está aqui' : 'Origem'}</Popup>
          </Marker>
        )}

        {destino && (
          <Marker position={[destino.lat, destino.lon]} icon={destIcon}>
            <Popup>Destino</Popup>
          </Marker>
        )}

        {carPos && (
          <Marker position={[carPos.lat, carPos.lon]} icon={carIcon}>
            <Popup>Motorista</Popup>
          </Marker>
        )}

        {routeCoords && routeCoords.length > 0 && (
          <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.7} />
        )}
      </MapContainer>
    </div>
  )
}
