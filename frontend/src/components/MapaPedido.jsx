import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import React from 'react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({
        lat: e.latlng.lat,
        lon: e.latlng.lng,
      })
    },
  })

  return null
}

export default function MapaPedido({ origem, destino, onEscolherPonto }) {
  const centroPortugal = [38.7223, -9.1393]

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '100%' }}>
      <MapContainer center={centroPortugal} zoom={13} style={{ height: '100%', width: '100%', minHeight: '100%' }}>
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          maxZoom={19}
        />

        <ClickHandler onPick={onEscolherPonto} />

        {origem && (
          <Marker position={[origem.lat, origem.lon]}>
            <Popup>Origem</Popup>
          </Marker>
        )}

        {destino && (
          <Marker position={[destino.lat, destino.lon]}>
            <Popup>Destino</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}