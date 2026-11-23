'use client';

import { useEffect } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import styles from './delivery-map.module.css';

const markerIcon = divIcon({
  className: 'delivery-map-pin',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function parseCoordinate(value) {
  const [latitude, longitude] = String(value || '').split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return [latitude, longitude];
}

function MapEvents({ onChange }) {
  useMapEvents({
    click(event) {
      onChange(`${event.latlng.lat.toFixed(6)},${event.latlng.lng.toFixed(6)}`);
    },
  });
  return null;
}

function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.35 });
  }, [map, position?.[0], position?.[1]]);
  return null;
}

export default function DeliveryMap({ coordinate, onChange }) {
  const position = parseCoordinate(coordinate);
  const initialCenter = position || [-2.5, 118];
  return (
    <div className={styles.map}>
      <MapContainer center={initialCenter} zoom={position ? 15 : 4.5} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onChange={onChange} />
        <MapCenter position={position} />
        {position && <Marker position={position} icon={markerIcon} draggable eventHandlers={{ dragend(event) {
          const point = event.target.getLatLng();
          onChange(`${point.lat.toFixed(6)},${point.lng.toFixed(6)}`);
        } }} />}
      </MapContainer>
    </div>
  );
}