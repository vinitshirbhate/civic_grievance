import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import icon from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const PUNE_CENTER = [18.5204, 73.8567];
const PUNE_BOUNDS = [
  [18.36, 73.68],
  [18.68, 74.02],
];

const defaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const PuneLocationPreviewMap = ({ location }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geofenceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(PUNE_CENTER, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    geofenceRef.current = L.rectangle(PUNE_BOUNDS, {
      color: "#0E7490",
      weight: 1,
      fillOpacity: 0.04,
      dashArray: "5,4",
    }).addTo(map);

    markerRef.current = L.marker(PUNE_CENTER).addTo(map).bindPopup("Select your exact Pune location");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !location?.lat || !location?.lng) return;

    const latLng = [Number(location.lat), Number(location.lng)];
    markerRef.current.setLatLng(latLng);
    markerRef.current.bindPopup(location.name || "Detected location");
    mapRef.current.setView(latLng, 15, { animate: true });
  }, [location]);

  return (
    <div className="frost-panel p-3 mt-3">
      <p className="text-sm text-slate-600 mb-2">Detected Pune location preview</p>
      <div ref={containerRef} style={{ height: 240, width: "100%", borderRadius: 12, overflow: "hidden" }} />
    </div>
  );
};

export default PuneLocationPreviewMap;
