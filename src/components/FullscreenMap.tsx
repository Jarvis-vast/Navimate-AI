import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Coordinates, RouteOption, POIItem } from '../types/navigation';
import { TrafficAlertIncident } from '../services/trafficAlerts';
import { Compass, Navigation2, Layers, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

interface FullscreenMapProps {
  currentCoords: Coordinates;
  heading: number;
  accuracy: number;
  selectedRoute: RouteOption | null;
  alternateRoute: RouteOption | null;
  pois: POIItem[];
  trafficIncidents?: TrafficAlertIncident[];
  destinationCoords: Coordinates | null;
  isNavigating: boolean;
  isSimulated?: boolean;
  gpsStatusLabel?: string;
  onRecenter: () => void;
  onSelectPOI?: (poi: POIItem) => void;
}

/**
 * Inner component to manage Google Maps Polylines and TrafficLayer
 */
const MapOverlays: React.FC<{
  selectedRoute: RouteOption | null;
  alternateRoute: RouteOption | null;
  currentCoords: Coordinates;
  isNavigating: boolean;
}> = ({ selectedRoute, alternateRoute, currentCoords, isNavigating }) => {
  const map = useMap();
  const selectedPolylineRef = useRef<google.maps.Polyline | null>(null);
  const alternatePolylineRef = useRef<google.maps.Polyline | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  // Initialize Traffic Layer
  useEffect(() => {
    if (!map || !(window as any).google?.maps?.TrafficLayer) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(map);
    }

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
        trafficLayerRef.current = null;
      }
    };
  }, [map]);

  // Render Routes as Polylines
  useEffect(() => {
    if (!map || !(window as any).google?.maps?.Polyline) return;

    // 1. Alternate Route
    if (alternatePolylineRef.current) {
      alternatePolylineRef.current.setMap(null);
      alternatePolylineRef.current = null;
    }

    if (alternateRoute && alternateRoute.path.length > 1) {
      alternatePolylineRef.current = new google.maps.Polyline({
        path: alternateRoute.path,
        geodesic: true,
        strokeColor: '#64748B',
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map,
      });
    }

    // 2. Selected Active Route
    if (selectedPolylineRef.current) {
      selectedPolylineRef.current.setMap(null);
      selectedPolylineRef.current = null;
    }

    if (selectedRoute && selectedRoute.path.length > 1) {
      selectedPolylineRef.current = new google.maps.Polyline({
        path: selectedRoute.path,
        geodesic: true,
        strokeColor: '#2563EB',
        strokeOpacity: 0.95,
        strokeWeight: 7,
        zIndex: 10,
        map,
      });
    }

    return () => {
      if (selectedPolylineRef.current) selectedPolylineRef.current.setMap(null);
      if (alternatePolylineRef.current) alternatePolylineRef.current.setMap(null);
    };
  }, [map, selectedRoute, alternateRoute]);

  // Center during navigation
  useEffect(() => {
    if (map && isNavigating) {
      map.panTo(currentCoords);
    }
  }, [map, isNavigating, currentCoords]);

  return null;
};

export const FullscreenMap: React.FC<FullscreenMapProps> = ({
  currentCoords,
  heading,
  accuracy,
  selectedRoute,
  alternateRoute,
  pois,
  trafficIncidents,
  destinationCoords,
  isNavigating,
  isSimulated = false,
  gpsStatusLabel,
  onRecenter,
  onSelectPOI,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [mapLoadError, setMapLoadError] = useState<boolean>(!apiKey);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Setup canvas fallback when Google Maps API key is missing or offline
  useEffect(() => {
    if (!mapLoadError) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number = 0;

    const render = () => {
      const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      const gridSize = 80;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = isNavigating ? height * 0.65 : height / 2;
      const scale = 8000;

      const project = (coord: Coordinates) => ({
        x: centerX + (coord.lng - currentCoords.lng) * scale,
        y: centerY + (currentCoords.lat - coord.lat) * scale,
      });

      // Route
      if (selectedRoute && selectedRoute.path.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        selectedRoute.path.forEach((pt, i) => {
          const { x, y } = project(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // User location dot
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#2563EB';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    };

    render();
    window.addEventListener('resize', render);
    return () => {
      window.removeEventListener('resize', render);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mapLoadError, currentCoords, selectedRoute, isNavigating]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      {/* 1. Google Maps JS SDK Provider when online and key available */}
      {apiKey && !mapLoadError ? (
        <APIProvider
          apiKey={apiKey}
          onError={() => setMapLoadError(true)}
        >
          <div className="w-full h-full">
            <Map
              defaultCenter={currentCoords}
              defaultZoom={15}
              center={isNavigating ? currentCoords : undefined}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              disableDefaultUI={true}
              gestureHandling="greedy"
              className="w-full h-full"
            >
              <MapOverlays
                selectedRoute={selectedRoute}
                alternateRoute={alternateRoute}
                currentCoords={currentCoords}
                isNavigating={isNavigating}
              />

              {/* User Location Marker with Heading Arrow */}
              <AdvancedMarker position={currentCoords}>
                <div className="relative flex items-center justify-center">
                  <div
                    className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center animate-pulse"
                    style={{
                      width: `${Math.max(36, Math.min(80, accuracy * 1.2))}px`,
                      height: `${Math.max(36, Math.min(80, accuracy * 1.2))}px`,
                    }}
                  />
                  <div
                    className="absolute w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center transition-transform duration-300"
                    style={{ transform: `rotate(${heading}deg)` }}
                  >
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-white -mt-1" />
                  </div>
                </div>
              </AdvancedMarker>

              {/* Destination Marker */}
              {destinationCoords && (
                <AdvancedMarker position={destinationCoords}>
                  <div className="flex flex-col items-center">
                    <div className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-md shadow-md mb-1">
                      Destination
                    </div>
                    <div className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-lg" />
                  </div>
                </AdvancedMarker>
              )}

              {/* POI Markers */}
              {pois.map((poi) => (
                <AdvancedMarker
                  key={poi.id}
                  position={{ lat: poi.lat, lng: poi.lng }}
                  onClick={() => onSelectPOI && onSelectPOI(poi)}
                >
                  <div className="flex flex-col items-center cursor-pointer group">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shadow-lg border border-white/80 transition-transform group-hover:scale-110 ${
                        poi.category === 'fuel'
                          ? 'bg-emerald-600 text-white'
                          : poi.category === 'food'
                          ? 'bg-amber-600 text-white'
                          : poi.category === 'charging'
                          ? 'bg-blue-600 text-white'
                          : 'bg-purple-600 text-white'
                      }`}
                    >
                      {poi.category === 'fuel' ? '⛽' : poi.category === 'food' ? '🍴' : poi.category === 'charging' ? '⚡' : '🏨'}
                    </div>
                    <span className="text-[10px] font-semibold text-white bg-slate-900/90 px-1.5 py-0.5 rounded shadow mt-0.5 max-w-[90px] truncate border border-slate-700/60">
                      {poi.name}
                    </span>
                  </div>
                </AdvancedMarker>
              ))}

              {/* Real-Time Traffic Incident Markers */}
              {trafficIncidents &&
                trafficIncidents.map((inc) => (
                  <AdvancedMarker
                    key={inc.id}
                    position={{ lat: inc.location.lat, lng: inc.location.lng }}
                  >
                    <div className="flex flex-col items-center group cursor-pointer">
                      <div
                        className={`w-8 h-8 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white transition-transform group-hover:scale-110 ${
                          inc.type === 'accident'
                            ? 'bg-rose-600 text-white ring-4 ring-rose-500/40'
                            : 'bg-amber-600 text-white ring-4 ring-amber-500/40'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="bg-slate-950/95 border border-slate-700/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-lg mt-0.5 whitespace-nowrap backdrop-blur-md">
                        {inc.title} · +{inc.delayMinutes}m
                      </div>
                    </div>
                  </AdvancedMarker>
                ))}
            </Map>
          </div>
        </APIProvider>
      ) : (
        /* 2. Offline Vector Canvas Fallback */
        <canvas ref={canvasRef} className="w-full h-full block" />
      )}

      {/* Recenter & Compass Controls */}
      <div className="absolute right-4 top-20 flex flex-col gap-3 z-10">
        <button
          onClick={onRecenter}
          title="Recenter Map"
          className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center shadow-lg active:scale-95 transition backdrop-blur-md"
        >
          <Navigation2 className="w-5 h-5 text-blue-400 rotate-45" />
        </button>

        <button
          onClick={() => {}}
          title="Compass North"
          className="w-12 h-12 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition backdrop-blur-md"
        >
          <Compass className="w-5 h-5 text-rose-500" style={{ transform: `rotate(${-heading}deg)` }} />
          <span className="text-[10px] font-bold text-slate-400">N</span>
        </button>
      </div>

      {/* GPS & Status Badges */}
      <div className="absolute left-4 top-20 z-10 flex flex-col gap-1.5 pointer-events-none">
        {/* Simulation Badge */}
        {isSimulated ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs font-bold shadow-lg backdrop-blur-md animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>SIMULATION / DEMO MODE</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 border border-slate-800 text-slate-300 text-xs shadow-md backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{gpsStatusLabel || `GPS Active · ±${Math.round(accuracy)}m`}</span>
          </div>
        )}

        {/* Map Source Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 text-[10px] text-slate-400 border border-slate-800/80 w-fit backdrop-blur-md">
          <Layers className="w-3 h-3 text-blue-400" />
          <span>{apiKey && !mapLoadError ? 'Google Maps Platform · Live' : 'Offline / Vector Mode'}</span>
        </div>
      </div>
    </div>
  );
};
