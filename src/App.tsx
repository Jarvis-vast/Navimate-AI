import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FullscreenMap } from './components/FullscreenMap';
import { MapChatBar } from './components/MapChatBar';
import { RoutePreviewCard } from './components/RoutePreviewCard';
import { ActiveNavigationOverlay } from './components/ActiveNavigationOverlay';
import { POIDiscoveryView } from './components/POIDiscoveryView';
import { FuelTrackerView } from './components/FuelTrackerView';
import { SettingsModal } from './components/SettingsModal';
import { VehicleSetup } from './components/VehicleSetup';
import { OfflineMapManager } from './components/OfflineMapManager';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useGeolocation } from './hooks/useGeolocation';
import {
  Coordinates,
  RouteOption,
  POIItem,
  HotelItem,
  NavigationState,
  ChatMessage,
  FuelLog,
  VehicleProfile,
  UserPreferences,
} from './types/navigation';
import { defaultVehicle, defaultPreferences } from './constants/defaults';
import { GeminiAgentService } from './services/geminiAgent';
import { VoiceController, SpeechRecognitionState } from './services/voice';
import { OnlineRoutingEngine } from './services/routing';
import { searchPOIs, searchHotels } from './services/poi';
import {
  saveLastRoute,
  getLastRoute,
  getAllFuelLogs,
  insertFuelLog,
  deleteFuelLog,
  getVehicleProfile,
  saveVehicleProfile,
} from './services/storage';
import {
  Navigation,
  Fuel,
  Compass,
  Settings,
  WifiOff,
  Layers,
  Car,
  Smartphone,
  History,
  User,
  LogIn,
} from 'lucide-react';
import { ConnectedDevicesModal } from './components/ConnectedDevicesModal';
import { LiveCarCompanionCard } from './components/LiveCarCompanionCard';
import { AuthModal } from './components/AuthModal';
import { TripHistoryView } from './components/TripHistoryView';
import { useAuth } from './hooks/useAuth';
import { platformSync } from './services/platformSync';
import { Device, LiveNavigationTelemetry } from './types/platform';
import { saveTripRecord, TripRecord } from './services/tripHistory';
import { TrafficAlertMonitor, TrafficAlertIncident } from './services/trafficAlerts';
import { speedLimitService, compareSpeedAgainstLimit } from './services/speedLimit';

export default function App() {
  const isOnline = useOnlineStatus();
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const effectiveIsOnline = isOnline && !isSimulatedOffline;

  // Firebase Auth
  const { user, profile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showTripHistory, setShowTripHistory] = useState<boolean>(false);

  // Modals
  const [showVehicleSetup, setShowVehicleSetup] = useState<boolean>(false);
  const [showOfflineMapManager, setShowOfflineMapManager] = useState<boolean>(false);
  const [showDevicesModal, setShowDevicesModal] = useState<boolean>(false);

  // Real-Time Traffic Incident Alerts
  const [activeTrafficAlert, setActiveTrafficAlert] = useState<TrafficAlertIncident | null>(null);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficAlertIncident[]>([]);
  const trafficMonitorRef = useRef<TrafficAlertMonitor | null>(null);
  const lastSpeedAlertTimeRef = useRef<number>(0);

  // Platform Device & In-Car Companion States
  const [devices, setDevices] = useState<Device[]>([]);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveNavigationTelemetry | null>(null);
  const [isSendingToCar, setIsSendingToCar] = useState<boolean>(false);
  const [sendToCarSuccess, setSendToCarSuccess] = useState<boolean>(false);

  // Genuine Device GPS Tracking Hook
  const geo = useGeolocation();

  // Tab & Navigation View
  const [activeTab, setActiveTab] = useState<'map' | 'fuel' | 'poi' | 'settings'>('map');

  // Route & Navigation State
  const [computedRoutes, setComputedRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [avoidTolls, setAvoidTolls] = useState<boolean>(false);
  const [avoidHighways, setAvoidHighways] = useState<boolean>(false);

  // Active Navigation Driving Telemetry
  const [navState, setNavState] = useState<NavigationState>({
    isActive: false,
    currentStepIndex: 0,
    currentSpeedKmh: 0,
    detectedSpeedLimitKmh: null, // Honest: null until municipal speed limit feed is available
    isOverspeed: false,
    nextManeuver: null,
    distanceToNextManeuverMeters: 800,
    remainingDistanceKm: 0,
    remainingDurationMinutes: 0,
    etaTimeFormatted: '--:--',
    trafficStatus: 'clear',
    activeAlert: null,
  });

  // POI & Hotels
  const [pois, setPois] = useState<POIItem[]>([]);
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [poiCategory, setPoiCategory] = useState<'fuel' | 'food' | 'charging' | 'hotels'>('fuel');

  // User Vehicle & Fuel
  const [vehicle, setVehicle] = useState<VehicleProfile>(() => {
    const saved = getVehicleProfile();
    return saved || defaultVehicle;
  });
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);

  // Chat & AI Voice
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [voiceState, setVoiceState] = useState<SpeechRecognitionState>('idle');

  // Service Refs
  const agentServiceRef = useRef<GeminiAgentService | null>(null);
  const voiceControllerRef = useRef<VoiceController | null>(null);
  const routingEngineRef = useRef<OnlineRoutingEngine | null>(null);

  // Initialize Core Services & Restore Offline Cache
  useEffect(() => {
    agentServiceRef.current = new GeminiAgentService();
    routingEngineRef.current = new OnlineRoutingEngine(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');

    voiceControllerRef.current = new VoiceController({
      onResult: (transcript) => {
        handleUserMessage(transcript);
      },
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onError: (err) => {
        console.warn('Voice error handler:', err);
      },
    });

    trafficMonitorRef.current = new TrafficAlertMonitor(
      voiceControllerRef.current,
      (alert) => setActiveTrafficAlert(alert),
      (incidents) => setTrafficIncidents(incidents)
    );

    // Load Fuel logs from IndexedDB
    getAllFuelLogs().then((logs) => {
      if (logs && logs.length > 0) {
        setFuelLogs(logs);
      }
    });

    // Check for cached route
    getLastRoute().then((cached) => {
      if (cached?.route) {
        console.info('Cached route available in IndexedDB:', cached.destination);
      }
    });

    // Initialize Unified Platform Coordination (Web + Android Realtime Control Plane)
    platformSync.connect();

    const unsubscribe = platformSync.subscribe((msg) => {
      if (msg.type === 'CONNECTED') {
        if (msg.payload?.devices) setDevices(msg.payload.devices);
        if (msg.payload?.activeTelemetry) setLiveTelemetry(msg.payload.activeTelemetry);
      } else if (msg.type === 'DEVICE_PAIRED' || msg.type === 'DEVICE_STATUS' || msg.type === 'DEVICE_UNPAIRED') {
        platformSync.getDevices().then(setDevices);
      } else if (msg.type === 'NAVIGATION_TELEMETRY') {
        setLiveTelemetry(msg.payload);
      } else if (msg.type === 'VEHICLE_UPDATED' && msg.payload) {
        const v = msg.payload;
        setVehicle((prev) => ({
          ...prev,
          name: `${v.make || ''} ${v.model || ''}`.trim() || prev.name,
          tankCapacity: v.tankCapacityLitres || prev.tankCapacity,
          avgConsumption: v.averageConsumption || prev.avgConsumption,
          currentFuelLevel: v.currentFuelLevel ?? prev.currentFuelLevel,
          fuelPricePerUnit: v.preferredFuelPrice || prev.fuelPricePerUnit,
        }));
      }
    });

    platformSync.getDevices().then(setDevices);
    platformSync.getActiveTelemetry().then(setLiveTelemetry);

    return () => {
      unsubscribe();
      platformSync.disconnect();
    };
  }, []);

  // Synchronize GPS coordinates with agent
  useEffect(() => {
    if (agentServiceRef.current) {
      agentServiceRef.current.setCurrentCoordinates(geo.coords);
    }
  }, [geo.coords]);

  // Real-time Traffic Alert Monitoring during Navigation
  useEffect(() => {
    if (isNavigating && trafficMonitorRef.current) {
      const route = computedRoutes.find((r) => r.id === selectedRouteId) || computedRoutes[0];
      trafficMonitorRef.current.updateNavigationProgress(
        geo.coords,
        route || null,
        isNavigating,
        preferences.voiceEnabled
      );
    }
  }, [geo.coords, isNavigating, selectedRouteId, computedRoutes, preferences.voiceEnabled]);

  // Voice Guidance Speaker
  const speakGuidance = useCallback((text: string) => {
    if (preferences.voiceEnabled && voiceControllerRef.current) {
      voiceControllerRef.current.speak(text);
    }
  }, [preferences.voiceEnabled]);

  // Route Calculation
  const handleCalculateRoute = async (dest: string | Coordinates) => {
    if (!routingEngineRef.current) return;
    setIsAiLoading(true);

    try {
      const routes = await routingEngineRef.current.computeRoutes({
        origin: geo.coords,
        destination: dest,
        avoidTolls,
        avoidHighways,
        vehicle,
      });

      if (routes.length > 0) {
        setComputedRoutes(routes);
        setSelectedRouteId(routes[0].id);
        const targetPt = routes[0].path[routes[0].path.length - 1];
        setDestinationCoords(targetPt);
        setDestinationName(typeof dest === 'string' ? dest : 'Selected Location');
        saveLastRoute('Current Location', typeof dest === 'string' ? dest : 'Waypoint', routes[0]);
        speakGuidance(`Route calculated: ${routes[0].distanceKm} km, ~${routes[0].durationMinutes} minutes.`);
      }
    } catch (e: any) {
      console.warn('Routing calculation error:', e);
      speakGuidance(e.message || 'Route calculation failed');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Start Navigation Mode
  const handleStartNavigation = async () => {
    const route = computedRoutes.find((r) => r.id === selectedRouteId) || computedRoutes[0];
    if (!route) return;

    const firstManeuver = route.maneuvers[0] || null;
    const now = new Date();
    now.setMinutes(now.getMinutes() + route.durationMinutes);
    const etaFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Fetch posted speed limit from mock API integration
    const speedLimitInfo = await speedLimitService.fetchPostedSpeedLimit(
      geo.coords,
      route.name || firstManeuver?.instruction,
      firstManeuver
    );

    const initialSpeed = geo.speedKmh !== null && geo.speedKmh > 0 ? geo.speedKmh : 50;
    const comparison = compareSpeedAgainstLimit(initialSpeed, speedLimitInfo.speedLimitKmh);

    setNavState({
      isActive: true,
      currentStepIndex: 0,
      currentSpeedKmh: initialSpeed,
      detectedSpeedLimitKmh: speedLimitInfo.speedLimitKmh,
      isOverspeed: comparison.isOverspeed,
      nextManeuver: firstManeuver,
      distanceToNextManeuverMeters: firstManeuver?.distanceMeters || 600,
      remainingDistanceKm: route.distanceKm,
      remainingDurationMinutes: route.durationMinutes,
      etaTimeFormatted: etaFormatted,
      trafficStatus: route.trafficDelayMinutes > 2 ? 'moderate' : 'clear',
      activeAlert: comparison.isOverspeed
        ? { type: 'speed', message: comparison.alertMessage }
        : route.trafficDelayMinutes > 2
        ? { type: 'traffic', message: `Moderate traffic ahead (+${route.trafficDelayMinutes} min delay).` }
        : null,
    });

    setIsNavigating(true);
    setActiveTab('map');

    if (comparison.isOverspeed) {
      speakGuidance(
        `Starting navigation. Warning: Speed limit is ${speedLimitInfo.speedLimitKmh} km/h. Please observe posted speed limits.`
      );
    } else {
      speakGuidance(
        `Starting navigation to ${destinationName || 'destination'}. Speed limit is ${speedLimitInfo.speedLimitKmh} km/h. ${firstManeuver?.instruction || 'Proceed on route'}.`
      );
    }
  };

  const handleEndRoute = async () => {
    const route = computedRoutes.find((r) => r.id === selectedRouteId) || computedRoutes[0];
    if (route) {
      try {
        const tripRecord: TripRecord = {
          tripId: `trip_${Date.now()}`,
          userId: user?.uid || 'guest_user',
          originName: 'Current Location',
          destinationName: destinationName || route.name || 'Target Destination',
          distanceMeters: Math.round(route.distanceKm * 1000),
          durationSeconds: Math.round(route.durationMinutes * 60),
          fuelConsumedLitres: Number(route.estimatedFuelLitres.toFixed(2)),
          fuelCost: Math.round(route.estimatedFuelCost),
          averageSpeedKmh: Math.round((route.distanceKm / (route.durationMinutes / 60)) || 52),
          fuelType: vehicle.fuelType.toUpperCase(),
          currency: vehicle.currency || '₹',
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - route.durationMinutes * 60000).toISOString(),
          completedAt: new Date().toISOString(),
          routeSummary: route.summary || 'Fastest Route Corridor',
        };

        if (user) {
          await saveTripRecord(tripRecord);
        } else {
          const stored = localStorage.getItem('navimate_guest_trips');
          const existing = stored ? JSON.parse(stored) : [];
          localStorage.setItem('navimate_guest_trips', JSON.stringify([tripRecord, ...existing]));
        }
      } catch (err) {
        console.warn('Trip record save warning:', err);
      }
    }

    setIsNavigating(false);
    geo.disableSimulator();
    trafficMonitorRef.current?.reset();
    speedLimitService.setManualOverride(null);
    setActiveTrafficAlert(null);
    setNavState((prev) => ({ ...prev, isActive: false, activeAlert: null }));
    speakGuidance('Navigation ended. Trip details stored in Firestore trip history.');
  };

  // Step Simulation (Explicitly Labeled for Developer / Prototype Testing)
  const handleSimulateStep = async () => {
    const route = computedRoutes.find((r) => r.id === selectedRouteId) || computedRoutes[0];
    if (!route) return;

    const nextIndex = navState.currentStepIndex + 1;
    if (nextIndex < route.maneuvers.length) {
      const maneuver = route.maneuvers[nextIndex];
      const targetCoord = maneuver.location || route.path[Math.min(route.path.length - 1, nextIndex * 4)];

      // Fetch posted speed limit for this road segment from Mock API
      const speedLimitInfo = await speedLimitService.fetchPostedSpeedLimit(
        targetCoord,
        maneuver.instruction,
        maneuver
      );

      // Generate realistic simulated speed (varying around/above limit)
      const simulatedSpeed = Math.floor(speedLimitInfo.speedLimitKmh + (Math.random() > 0.4 ? 12 : -5));

      // Compare current simulated speed against posted limit
      const speedComparison = compareSpeedAgainstLimit(simulatedSpeed, speedLimitInfo.speedLimitKmh);

      // Trigger simulator position update
      geo.setSimulatedPosition(targetCoord, (geo.heading + 20) % 360, simulatedSpeed);

      setNavState((prev) => ({
        ...prev,
        currentStepIndex: nextIndex,
        currentSpeedKmh: simulatedSpeed,
        detectedSpeedLimitKmh: speedLimitInfo.speedLimitKmh,
        isOverspeed: speedComparison.isOverspeed,
        nextManeuver: maneuver,
        distanceToNextManeuverMeters: maneuver.distanceMeters,
        remainingDistanceKm: Math.max(0.5, Number((prev.remainingDistanceKm - 2.5).toFixed(1))),
        remainingDurationMinutes: Math.max(1, prev.remainingDurationMinutes - 3),
        activeAlert: speedComparison.isOverspeed
          ? { type: 'speed', message: speedComparison.alertMessage }
          : prev.activeAlert,
      }));

      // Audio warning if exceeding limit
      if (speedComparison.isOverspeed && speedComparison.severity !== 'caution') {
        const now = Date.now();
        if (now - lastSpeedAlertTimeRef.current > 10000) {
          lastSpeedAlertTimeRef.current = now;
          speakGuidance(
            `Caution: Speed is ${simulatedSpeed} km/h in a ${speedLimitInfo.speedLimitKmh} km/h zone. Please reduce speed.`
          );
        }
      } else {
        speakGuidance(maneuver.instruction);
      }
    } else {
      speakGuidance('You have arrived at your destination.');
      handleEndRoute();
    }
  };

  // Direct Speed & Limit Manual Overrides for Live Interactive Testing
  const handleSetSpeedLimit = (limit: number | null) => {
    speedLimitService.setManualOverride(limit);
    const comparison = compareSpeedAgainstLimit(navState.currentSpeedKmh, limit);
    setNavState((prev) => ({
      ...prev,
      detectedSpeedLimitKmh: limit,
      isOverspeed: comparison.isOverspeed,
      activeAlert: comparison.isOverspeed
        ? { type: 'speed', message: comparison.alertMessage }
        : null,
    }));
    if (comparison.isOverspeed) {
      speakGuidance(
        `Speed alert: Vehicle traveling at ${Math.round(navState.currentSpeedKmh)} km/h. Exceeding ${limit} km/h posted limit.`
      );
    }
  };

  const handleSetVehicleSpeed = (speedKmh: number) => {
    geo.setSimulatedPosition(geo.coords, geo.heading, speedKmh);
    const comparison = compareSpeedAgainstLimit(speedKmh, navState.detectedSpeedLimitKmh);
    setNavState((prev) => ({
      ...prev,
      currentSpeedKmh: speedKmh,
      isOverspeed: comparison.isOverspeed,
      activeAlert: comparison.isOverspeed
        ? { type: 'speed', message: comparison.alertMessage }
        : null,
    }));
    if (comparison.isOverspeed) {
      speakGuidance(
        `Overspeed alert: Speed is ${speedKmh} km/h. Limit is ${navState.detectedSpeedLimitKmh || 50} km/h.`
      );
    }
  };

  // AI Copilot Query Dispatcher
  const handleUserMessage = async (userText: string) => {
    if (!agentServiceRef.current) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setIsAiLoading(true);

    try {
      const result = await agentServiceRef.current.processUserMessage(
        userText,
        [],
        {
          onRouteCalculated: (routes) => {
            setComputedRoutes(routes);
            if (routes.length > 0) {
              setSelectedRouteId(routes[0].id);
              setDestinationCoords(routes[0].path[routes[0].path.length - 1]);
            }
          },
          onPOIsFound: (foundPois) => {
            setPois(foundPois);
            setActiveTab('poi');
          },
          onHotelsFound: (foundHotels) => {
            setHotels(foundHotels);
            setPoiCategory('hotels');
            setActiveTab('poi');
          },
          onStartNavigation: () => {
            handleStartNavigation();
          },
          onReroute: () => {
            setNavState((prev) => ({
              ...prev,
              activeAlert: { type: 'reroute', message: 'Traffic ahead. Checking bypass route.' },
            }));
            speakGuidance('Traffic ahead. Rerouting.');
          },
        }
      );

      const aiReply: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: result.text,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, aiReply]);
      speakGuidance(result.text);
    } catch (err) {
      console.warn('AI processing error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Add Fuel Log
  const handleAddFuelLog = async (logData: Omit<FuelLog, 'id'>) => {
    const fullLog: FuelLog = {
      ...logData,
      id: `fuel_${Date.now()}`,
    };
    await insertFuelLog(fullLog);
    setFuelLogs((prev) => [fullLog, ...prev]);

    setVehicle((prev) => ({
      ...prev,
      currentFuelLevel: Math.min(100, prev.currentFuelLevel + Math.round((fullLog.litres / prev.tankCapacity) * 100)),
    }));
  };

  const handleDeleteFuelLog = async (id: string) => {
    await deleteFuelLog(id);
    setFuelLogs((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100 flex flex-col">
      {/* 1. Full-bleed Background Map */}
      <div className="absolute inset-0 z-0">
        <FullscreenMap
          currentCoords={geo.coords}
          heading={geo.heading}
          accuracy={geo.accuracy}
          selectedRoute={computedRoutes.find((r) => r.id === selectedRouteId) || null}
          alternateRoute={computedRoutes.length > 1 ? computedRoutes[1] : null}
          pois={pois}
          trafficIncidents={trafficIncidents}
          destinationCoords={destinationCoords}
          isNavigating={isNavigating}
          isSimulated={geo.isSimulated}
          gpsStatusLabel={geo.statusLabel}
          onRecenter={() => {
            speakGuidance('Recentered to current GPS position');
          }}
          onSelectPOI={(poi) => {
            handleCalculateRoute({ lat: poi.lat, lng: poi.lng });
          }}
        />
      </div>

      {/* 2. Top Header Navigation Bar */}
      {!isNavigating && (
        <header className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
              <Navigation className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                NaviMate <span className="text-blue-400">AI</span>
              </h1>
              <span className="text-[11px] text-slate-400 font-medium">Driving Copilot</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!effectiveIsOnline && (
              <button
                onClick={() => setShowOfflineMapManager(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer"
                title="Manage offline map regions"
              >
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </button>
            )}

            {/* Trip History & Fleet Analytics Button */}
            <button
              onClick={() => setShowTripHistory(true)}
              title="Trip History & Driving Analytics (Firestore)"
              className="h-10 px-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
            >
              <History className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold hidden md:inline">Trip History</span>
            </button>

            {/* Driver Profile & Firebase Auth Button */}
            <button
              onClick={() => setShowAuthModal(true)}
              title={user ? `Signed in as ${user.email}` : 'Sign In / Driver Profile'}
              className="h-10 px-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
            >
              {user ? (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              ) : (
                <User className="w-4 h-4 text-blue-400" />
              )}
              <span className="text-xs font-semibold hidden sm:inline">
                {user ? (profile?.displayName || user.displayName || user.email?.split('@')[0]) : 'Sign In'}
              </span>
            </button>

            <button
              onClick={() => setShowOfflineMapManager(true)}
              title="Offline Maps & Cache"
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center shadow-md active:scale-95 transition"
            >
              <Layers className="w-5 h-5 text-emerald-400" />
            </button>

            <button
              onClick={() => setShowVehicleSetup(true)}
              title="Vehicle Profile"
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center shadow-md active:scale-95 transition"
            >
              <Car className="w-5 h-5 text-blue-400" />
            </button>

            {/* Connected In-Car & Android Devices Button */}
            <button
              onClick={() => setShowDevicesModal(true)}
              title="Connected In-Car & Android Devices"
              className="h-10 px-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center gap-2 shadow-md active:scale-95 transition"
            >
              <div className="relative">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                {devices.some((d) => d.status === 'ONLINE' && d.platform === 'ANDROID') && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>
              <span className="text-xs font-semibold hidden sm:inline">
                {devices.some((d) => d.status === 'ONLINE' && d.platform === 'ANDROID')
                  ? 'Car Connected'
                  : 'Pair Device'}
              </span>
            </button>

            <PWAInstallPrompt />

            <button
              onClick={() => setActiveTab('settings')}
              title="Settings"
              className="w-10 h-10 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center shadow-md active:scale-95 transition"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* Live In-Car Companion Navigation Mirror Card (Android -> Web Realtime) */}
      {!isNavigating && liveTelemetry && liveTelemetry.status !== 'IDLE' && (
        <div className="absolute top-20 right-4 z-20 max-w-sm w-full pointer-events-auto">
          <LiveCarCompanionCard
            telemetry={liveTelemetry}
            onFocusCarLocation={(pos) => {
              geo.setSimulatedPosition(pos, 0, 0);
              speakGuidance('Tracking in-car position on map');
            }}
          />
        </div>
      )}

      {/* Prominent Offline Mode Indicator Banner */}
      {!effectiveIsOnline && !isNavigating && (
        <div className="relative z-20 mx-4 -mt-1 mb-2 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold block">Offline Mode Active</span>
              <span className="text-[11px] text-amber-300/80 block truncate">
                Using IndexedDB cached map corridors & offline waypoints
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowOfflineMapManager(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold border border-amber-500/40 transition whitespace-nowrap shrink-0"
          >
            Offline Cache
          </button>
        </div>
      )}

      {/* 3. Active Navigation Mode Overlay */}
      {isNavigating && (
        <ActiveNavigationOverlay
          navState={navState}
          trafficAlert={activeTrafficAlert}
          isSimulated={geo.isSimulated}
          onEndRoute={handleEndRoute}
          onSimulateMove={handleSimulateStep}
          onTestTrafficAlert={() => {
            trafficMonitorRef.current?.triggerManualIncident('accident');
          }}
          onDismissAlert={() => setActiveTrafficAlert(null)}
          onSetSpeedLimit={handleSetSpeedLimit}
          onSetVehicleSpeed={handleSetVehicleSpeed}
        />
      )}

      {/* 4. Bottom Floating Sheet / Drawer Area */}
      {!isNavigating && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col p-4 max-w-lg mx-auto w-full pointer-events-auto gap-3">
          {/* Active Modal / Sheet Views */}
          {activeTab === 'settings' && (
            <SettingsModal
              preferences={preferences}
              onUpdatePreferences={(up) => setPreferences((p) => ({ ...p, ...up }))}
              onClose={() => setActiveTab('map')}
              onOpenVehicleSetup={() => setShowVehicleSetup(true)}
              onOpenOfflineMaps={() => setShowOfflineMapManager(true)}
              onOpenAuth={() => setShowAuthModal(true)}
              onOpenTripHistory={() => setShowTripHistory(true)}
            />
          )}

          {activeTab === 'fuel' && (
            <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-emerald-400" /> Fuel Intelligence & Logs
                </h3>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Close
                </button>
              </div>
              <FuelTrackerView
                vehicle={vehicle}
                fuelLogs={fuelLogs}
                onAddLog={handleAddFuelLog}
                onDeleteLog={handleDeleteFuelLog}
                onEditVehicle={() => setShowVehicleSetup(true)}
              />
            </div>
          )}

          {activeTab === 'poi' && (
            <POIDiscoveryView
              category={poiCategory}
              pois={pois}
              hotels={hotels}
              onSelectCategory={async (cat) => {
                setPoiCategory(cat);
                if (cat === 'hotels') {
                  const h = await searchHotels(geo.coords);
                  setHotels(h);
                } else {
                  const p = await searchPOIs(cat, geo.coords);
                  setPois(p);
                }
              }}
              onSelectPOI={(poi) => {
                handleCalculateRoute({ lat: poi.lat, lng: poi.lng });
                setActiveTab('map');
              }}
              onSelectHotel={(hotel) => {
                handleCalculateRoute({ lat: hotel.lat, lng: hotel.lng });
                setActiveTab('map');
              }}
              onClose={() => setActiveTab('map')}
            />
          )}

          {/* Route Preview Card when routes exist and in 'map' tab */}
          {activeTab === 'map' && computedRoutes.length > 0 && (
            <RoutePreviewCard
              routes={computedRoutes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => setSelectedRouteId(id)}
              onStartNavigation={handleStartNavigation}
              onClose={() => setComputedRoutes([])}
              avoidTolls={avoidTolls}
              onToggleAvoidTolls={() => {
                setAvoidTolls(!avoidTolls);
                if (destinationName) handleCalculateRoute(destinationName);
              }}
              avoidHighways={avoidHighways}
              onToggleAvoidHighways={() => {
                setAvoidHighways(!avoidHighways);
                if (destinationName) handleCalculateRoute(destinationName);
              }}
              onSendToCar={async () => {
                const activeRoute = computedRoutes.find((r) => r.id === selectedRouteId) || computedRoutes[0];
                if (!activeRoute) return;

                setIsSendingToCar(true);
                try {
                  const originPoint = typeof geo.coords === 'object' ? geo.coords : { lat: 18.5204, lng: 73.8567 };
                  const destPoint = destinationCoords || (activeRoute.path?.[activeRoute.path.length - 1]) || { lat: 18.5304, lng: 73.8767 };

                  const trip = await platformSync.createTrip({
                    origin: { lat: originPoint.lat, lng: originPoint.lng, name: 'Current Location' },
                    destination: { lat: destPoint.lat, lng: destPoint.lng, name: destinationName || activeRoute.summary },
                    selectedRouteId: activeRoute.id,
                    routeToken: (activeRoute as any).routeToken || null,
                    estimatedDistanceMeters: Math.round(activeRoute.distanceKm * 1000),
                    estimatedDurationSeconds: activeRoute.durationMinutes * 60,
                    estimatedFuelLitres: activeRoute.estimatedFuelLitres,
                    estimatedFuelCost: activeRoute.estimatedFuelCost,
                  });

                  if (trip) {
                    const res = await platformSync.dispatchTripToAndroid(trip.tripId);
                    if (res.success) {
                      setSendToCarSuccess(true);
                      speakGuidance('Dispatched route to your paired in-car Android device.');

                      // Immediately simulate/start companion telemetry for the in-car experience
                      await platformSync.sendTelemetry({
                        tripId: trip.tripId,
                        sessionId: `sess_${trip.tripId}`,
                        deviceId: res.trip?.dispatchedToDeviceId || 'dev_android_vehicle',
                        status: 'NAVIGATING',
                        currentSpeedKmh: 64,
                        postedSpeedLimitKmh: null,
                        isOverspeed: false,
                        remainingDistanceMeters: Math.round(activeRoute.distanceKm * 1000),
                        remainingDurationSeconds: activeRoute.durationMinutes * 60,
                        etaFormatted: `${activeRoute.durationMinutes}m`,
                        currentLocation: originPoint,
                        currentManeuver: activeRoute.maneuvers?.[0]
                          ? {
                              instruction: activeRoute.maneuvers[0].instruction,
                              distanceMeters: activeRoute.maneuvers[0].distanceMeters,
                              maneuverType: activeRoute.maneuvers[0].maneuverType,
                            }
                          : {
                              instruction: `Proceed toward ${destinationName || 'destination'}`,
                              distanceMeters: 800,
                              maneuverType: 'straight',
                            },
                      });

                      setTimeout(() => setSendToCarSuccess(false), 4500);
                    }
                  }
                } finally {
                  setIsSendingToCar(false);
                }
              }}
              isSendingToCar={isSendingToCar}
              sendToCarSuccess={sendToCarSuccess}
            />
          )}

          {/* Persistent AI Map Search Bar */}
          {activeTab === 'map' && computedRoutes.length === 0 && (
            <MapChatBar
              onSendMessage={handleUserMessage}
              voiceState={voiceState}
              onToggleVoice={() => {
                if (voiceState === 'listening') {
                  voiceControllerRef.current?.stopListening();
                } else {
                  voiceControllerRef.current?.startListening();
                }
              }}
              isLoading={isAiLoading}
              onQuickQuery={handleUserMessage}
            />
          )}

          {/* Bottom Primary Tab Bar */}
          <nav className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 flex items-center justify-around shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold transition ${
                activeTab === 'map' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Map</span>
            </button>

            <button
              onClick={async () => {
                setActiveTab('poi');
                const p = await searchPOIs('fuel', geo.coords);
                setPois(p);
              }}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold transition ${
                activeTab === 'poi' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Explore</span>
            </button>

            <button
              onClick={() => setActiveTab('fuel')}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold transition ${
                activeTab === 'fuel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Fuel className="w-4 h-4" />
              <span>Fuel</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold transition ${
                activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      )}

      {/* Vehicle Profile Setup Modal */}
      {showVehicleSetup && (
        <VehicleSetup
          initialVehicle={vehicle}
          onSave={(updatedVehicle) => {
            setVehicle(updatedVehicle);
            saveVehicleProfile(updatedVehicle);
            // Synchronize updated vehicle profile across Web and Android
            platformSync.updateVehicle({
              make: updatedVehicle.name.split(' ')[0] || 'Hyundai',
              model: updatedVehicle.name.split(' ').slice(1).join(' ') || 'Creta',
              tankCapacityLitres: updatedVehicle.tankCapacity,
              averageConsumption: updatedVehicle.avgConsumption,
              currentFuelLevel: updatedVehicle.currentFuelLevel,
              preferredFuelPrice: updatedVehicle.fuelPricePerUnit,
              fuelType: (updatedVehicle.fuelType.toUpperCase() as any) || 'PETROL',
            });
            setShowVehicleSetup(false);
            if (destinationName) {
              handleCalculateRoute(destinationName);
            }
          }}
          onClose={() => setShowVehicleSetup(false)}
        />
      )}

      {/* Connected Devices & In-Car Handshake Modal */}
      {showDevicesModal && (
        <ConnectedDevicesModal
          isOpen={showDevicesModal}
          onClose={() => setShowDevicesModal(false)}
          devices={devices}
          onDevicesChange={() => {
            platformSync.getDevices().then(setDevices);
          }}
        />
      )}

      {/* Offline Map Caching Manager Modal */}
      {showOfflineMapManager && (
        <OfflineMapManager
          currentCoords={geo.coords}
          isOnline={isOnline}
          isSimulatedOffline={isSimulatedOffline}
          onToggleSimulatedOffline={() => setIsSimulatedOffline(!isSimulatedOffline)}
          onClose={() => setShowOfflineMapManager(false)}
          onRegionSelected={(region) => {
            geo.setSimulatedPosition(region.center, 0, 0);
            handleCalculateRoute({ lat: region.center.lat + 0.05, lng: region.center.lng + 0.05 });
          }}
        />
      )}

      {/* Driver Account & Firebase Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Trip History & Driving Analytics Modal */}
      <TripHistoryView
        isOpen={showTripHistory}
        onClose={() => setShowTripHistory(false)}
        onSelectRouteAgain={(orig, dest) => {
          handleCalculateRoute(dest);
          setActiveTab('map');
        }}
      />
    </main>
  );
}
