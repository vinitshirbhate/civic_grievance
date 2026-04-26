import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

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

function weightBySeverity(severity = "Low") {
  if (severity === "Critical") return 1;
  if (severity === "High") return 0.85;
  if (severity === "Medium") return 0.65;
  return 0.45;
}

function withinPune(lat, lng) {
  return lat >= 18.36 && lat <= 18.68 && lng >= 73.68 && lng <= 74.02;
}

const ComplaintsHeatmap = ({ complaints }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const hotspotLayerRef = useRef(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  const geoComplaints = useMemo(
    () =>
      (complaints || [])
        .filter((c) => c.location && Number.isFinite(c.location.lat) && Number.isFinite(c.location.lng))
        .filter((c) => withinPune(Number(c.location.lat), Number(c.location.lng))),
    [complaints]
  );

  const hotspots = useMemo(() => {
    const cellSize = 0.01;
    const baseLat = 18.36;
    const baseLng = 73.68;
    const buckets = new Map();

    geoComplaints.forEach((complaint) => {
      const lat = Number(complaint.location.lat);
      const lng = Number(complaint.location.lng);
      const latKey = Math.floor((lat - baseLat) / cellSize);
      const lngKey = Math.floor((lng - baseLng) / cellSize);
      const key = `${latKey}-${lngKey}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          centerLat: baseLat + latKey * cellSize + cellSize / 2,
          centerLng: baseLng + lngKey * cellSize + cellSize / 2,
          complaints: [],
          count: 0,
          escalated: 0,
          critical: 0,
        });
      }

      const bucket = buckets.get(key);
      bucket.complaints.push(complaint);
      bucket.count += 1;
      if (complaint.escalated) bucket.escalated += 1;
      if (complaint.severity === "Critical" || complaint.severity === "High") bucket.critical += 1;
    });

    return Array.from(buckets.values())
      .map((bucket) => ({
        ...bucket,
        score: bucket.count + bucket.critical * 1.3 + bucket.escalated * 1.1,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [geoComplaints]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(PUNE_CENTER, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.rectangle(PUNE_BOUNDS, {
      color: "#0E7490",
      weight: 1,
      fillOpacity: 0.03,
      dashArray: "5,5",
    }).addTo(map);

    heatLayerRef.current = L.heatLayer([], { radius: 28, blur: 18, maxZoom: 17 }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    hotspotLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !heatLayerRef.current || !markerLayerRef.current || !hotspotLayerRef.current) return;

    const heatPoints = geoComplaints.map((c) => [Number(c.location.lat), Number(c.location.lng), weightBySeverity(c.severity)]);
    heatLayerRef.current.setLatLngs(heatPoints);

    markerLayerRef.current.clearLayers();
    geoComplaints.forEach((c) => {
      const marker = L.marker([Number(c.location.lat), Number(c.location.lng)]);
      marker.bindPopup(
        `<b>${c.reason}</b><br/>${c.location.name}<br/>Status: ${c.status}<br/>Severity: ${c.severity || "N/A"}<br/>Department: ${c.department || "General"}`
      );
      markerLayerRef.current.addLayer(marker);
    });

    hotspotLayerRef.current.clearLayers();
    hotspots.forEach((hotspot) => {
      const radius = 120 + hotspot.count * 35;
      const circle = L.circle([hotspot.centerLat, hotspot.centerLng], {
        radius,
        color: "#F97316",
        fillColor: "#FB923C",
        fillOpacity: 0.18,
        weight: 1.4,
      });
      circle.bindPopup(
        `Hotspot<br/>Complaints: ${hotspot.count}<br/>Critical/High: ${hotspot.critical}<br/>Escalated: ${hotspot.escalated}`
      );
      hotspotLayerRef.current.addLayer(circle);
    });

    if (geoComplaints.length > 0) {
      const bounds = L.latLngBounds(geoComplaints.map((c) => [Number(c.location.lat), Number(c.location.lng)]));
      mapRef.current.fitBounds(bounds.pad(0.15));
    } else {
      mapRef.current.setView(PUNE_CENTER, 12);
    }
  }, [geoComplaints, hotspots]);

  useEffect(() => {
    if (!mapRef.current || !selectedHotspot) return;
    mapRef.current.setView([selectedHotspot.centerLat, selectedHotspot.centerLng], 14, { animate: true });
  }, [selectedHotspot]);

  return (
    <div className="surface-card mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold">Pune Geo Intelligence</h3>
          <p className="text-sm text-slate-600">Dedicated location operations for Pune complaints, hotspot concentration, and area-wise drill-down.</p>
        </div>
        <div className="text-xs text-slate-500 border border-cyan-200 bg-cyan-50 rounded-full px-3 py-1 self-start lg:self-auto">
          Pune Geofence Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div>
          <div ref={mapContainerRef} style={{ height: 470, width: "100%", borderRadius: 14, overflow: "hidden" }} />
        </div>

        <div className="frost-panel p-3 max-h-[470px] overflow-y-auto">
          <h4 className="font-bold mb-2">High Concentration Areas</h4>
          {hotspots.length === 0 ? (
            <p className="text-sm text-slate-500">No location complaints inside Pune yet.</p>
          ) : (
            <div className="space-y-2">
              {hotspots.map((hotspot, idx) => (
                <button
                  key={hotspot.key}
                  type="button"
                  className={`w-full text-left border rounded-xl p-3 transition ${
                    selectedHotspot?.key === hotspot.key
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-slate-200 bg-white hover:border-cyan-300"
                  }`}
                  onClick={() => setSelectedHotspot(hotspot)}
                >
                  <p className="font-semibold text-sm">Zone Cluster #{idx + 1}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {hotspot.count} complaints • {hotspot.critical} critical/high • {hotspot.escalated} escalated
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Approx center: {hotspot.centerLat.toFixed(4)}, {hotspot.centerLng.toFixed(4)}</p>
                </button>
              ))}
            </div>
          )}

          {selectedHotspot ? (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <h5 className="font-bold text-sm mb-2">Complaints in Selected Area</h5>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {selectedHotspot.complaints.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-2 bg-white">
                    <p className="font-semibold text-sm">{c.reason}</p>
                    <p className="text-xs text-slate-600 mt-1">{c.location.name}</p>
                    <p className="text-xs text-slate-600">{c.status} • {c.severity || "Low"} • {c.department || "General"}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ComplaintsHeatmap;
