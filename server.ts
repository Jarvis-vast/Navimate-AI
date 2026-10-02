import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { computeSafeFuelMetrics } from './src/utils/fuelMath.js';
import { platformRouter } from './server/platformRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Mount the unified NaviMate platform router for auth, devices, pairing, trips, vehicle, and realtime sync
app.use('/api', platformRouter);

// Initialize Gemini API client on the server side
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// System instruction enforcing strict geographic honesty
const SYSTEM_INSTRUCTION = `You are NaviMate AI, a professional driving copilot and navigation assistant.

CRITICAL OPERATIONAL RULES:
1. NEVER hallucinate or guess coordinates, driving distances, ETAs, speed limits, hotel prices, or fuel prices.
2. Whenever the user's query depends on navigation, routing, nearby places, fuel calculation, or traffic, YOU MUST CALL THE APPROPRIATE TOOL.
3. If live incident feeds or speed limit data are not available from the tool, state honestly that the data is unavailable in the current region.
4. Keep navigation and driving guidance concise, safety-first, and distraction-free.`;

// Function declarations according to Gemini specification
const functionDeclarations = [
  {
    name: 'get_directions',
    description: 'Calculate driving directions, route alternatives, ETA, distance, and fuel economics.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        origin: { type: Type.STRING, description: 'Starting location' },
        destination: { type: Type.STRING, description: 'Destination name or address' },
        avoidTolls: { type: Type.BOOLEAN, description: 'Whether to avoid toll roads' },
        avoidHighways: { type: Type.BOOLEAN, description: 'Whether to avoid highways' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'search_places',
    description: 'Search for nearby points of interest: fuel stations, food/restaurants, EV charging, rest stops, or hospitals.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ['fuel', 'food', 'charging', 'rest_area', 'hospital'],
          description: 'Category of place to find',
        },
        nearLocation: { type: Type.STRING, description: 'Optional location context' },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_traffic_eta',
    description: 'Get live traffic delay and ETA for the active route or destination.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: { type: Type.STRING, description: 'Target destination' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'get_speed_limit',
    description: 'Query posted road speed limit. Returns unavailable if no provider exists.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        roadName: { type: Type.STRING, description: 'Road name or corridor' },
      },
    },
  },
  {
    name: 'search_hotels',
    description: 'Search for hotels along route with budget filter. Returns benchmark rates.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: { type: Type.STRING, description: 'Destination city or corridor' },
        maxPrice: { type: Type.NUMBER, description: 'Maximum price per night in local currency' },
        minRating: { type: Type.NUMBER, description: 'Minimum star rating' },
      },
    },
  },
  {
    name: 'estimate_fuel_cost',
    description: 'Calculate fuel/energy requirements, trip cost, and remaining vehicle range.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        distanceKm: { type: Type.NUMBER, description: 'Trip distance in km' },
      },
      required: ['distanceKm'],
    },
  },
  {
    name: 'log_fuel_fillup',
    description: 'Record a new vehicle fuel fill-up log with odometer, litres, and cost.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        litres: { type: Type.NUMBER, description: 'Litres filled' },
        totalCost: { type: Type.NUMBER, description: 'Total cost paid' },
        odometer: { type: Type.NUMBER, description: 'Odometer reading' },
      },
      required: ['litres', 'totalCost'],
    },
  },
  {
    name: 'start_navigation',
    description: 'Engage active turn-by-turn navigation mode to destination.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: { type: Type.STRING, description: 'Destination to navigate to' },
      },
      required: ['destination'],
    },
  },
  {
    name: 'reroute',
    description: 'Recalculate route to avoid congestion or road obstacles.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: 'Reason for reroute' },
      },
    },
  },
];

// Health and configuration endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!apiKey,
    hasMapsKey: !!process.env.VITE_GOOGLE_MAPS_API_KEY,
  });
});

// Setup /api/routes/compute endpoint for backend-driven route computation with route tokens
app.post('/api/routes/compute', async (req, res) => {
  try {
    const { origin, destination, waypoints, avoidTolls, avoidHighways, avoidFerries, vehicle } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    const gmpKey = process.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const activeVehicle = vehicle || {
      avgConsumption: 7.5,
      tankCapacity: 45,
      currentFuelLevel: 50,
      fuelPricePerUnit: 98,
      fuelType: 'petrol',
    };

    // If Google Maps API Key is available on backend, compute via Routes API (v2) to generate native route tokens
    if (gmpKey) {
      try {
        const originObj = typeof origin === 'string'
          ? { address: origin }
          : { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } };

        const destObj = typeof destination === 'string'
          ? { address: destination }
          : { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } };

        const intermediates = (waypoints || []).map((wp: any) =>
          typeof wp === 'string'
            ? { address: wp }
            : { location: { latLng: { latitude: wp.lat, longitude: wp.lng } } }
        );

        const routeModifiers: any = {};
        if (avoidTolls) routeModifiers.avoidTolls = true;
        if (avoidHighways) routeModifiers.avoidHighways = true;
        if (avoidFerries) routeModifiers.avoidFerries = true;

        const routesApiUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        const routesResponse = await fetch(routesApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': gmpKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.routeToken,routes.description,routes.warnings,routes.legs',
          },
          body: JSON.stringify({
            origin: originObj,
            destination: destObj,
            intermediates,
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
            computeAlternativeRoutes: true,
            routeModifiers,
          }),
        });

        if (routesResponse.ok) {
          const routesData = await routesResponse.json();
          if (routesData.routes && routesData.routes.length > 0) {
            const formattedRoutes = routesData.routes.map((r: any, idx: number) => {
              const distanceKm = Number(((r.distanceMeters || 0) / 1000).toFixed(1));
              const durationSec = parseInt((r.duration || '0s').replace('s', ''), 10);
              const durationMinutes = Math.max(1, Math.round(durationSec / 60));

              const fuel = computeSafeFuelMetrics({
                distanceKm,
                avgConsumption: activeVehicle.avgConsumption,
                tankCapacity: activeVehicle.tankCapacity,
                currentFuelLevelPercent: activeVehicle.currentFuelLevel,
                fuelPricePerUnit: activeVehicle.fuelPricePerUnit,
                fuelType: activeVehicle.fuelType,
              });

              return {
                id: `routes_api_${idx}_${Date.now()}`,
                routeToken: r.routeToken || null,
                name: r.description ? `Via ${r.description}` : (idx === 0 ? 'Optimal Route' : `Alternative ${idx}`),
                summary: r.description || (idx === 0 ? 'Main Highway Corridor' : 'Alternative Arterial'),
                distanceKm,
                durationMinutes,
                trafficDelayMinutes: 0,
                estimatedFuelLitres: fuel.unitsRequired,
                estimatedFuelCost: fuel.estimatedCost,
                tollsEstimated: avoidTolls ? 0 : (r.warnings?.some((w: string) => w.toLowerCase().includes('toll')) ? 150 : 0),
                hasTolls: !avoidTolls && r.warnings?.some((w: string) => w.toLowerCase().includes('toll')),
                hasHighways: !avoidHighways,
                hasFerries: !avoidFerries,
                encodedPolyline: r.polyline?.encodedPolyline || null,
                tags: idx === 0 ? ['Fastest', 'Routes API'] : ['Alternative'],
              };
            });

            const primaryRoute = formattedRoutes[0];
            const destStr = typeof destination === 'object' ? `${destination.lat},${destination.lng}` : String(destination);
            const waypointsList = (intermediates || []).map((w: any) => typeof w === 'object' ? `${w.lat},${w.lng}` : String(w));

            return res.json({
              route: primaryRoute,
              routes: formattedRoutes,
              routeToken: primaryRoute?.routeToken || null,
              destination: destStr,
              waypoints: waypointsList,
              distance: primaryRoute?.distanceKm || 0,
              duration: primaryRoute?.durationMinutes || 0,
              provider: 'Google Routes API',
              freshness: Date.now(),
              hasRouteToken: !!primaryRoute?.routeToken,
            });
          }
        }
      } catch (routesErr) {
        console.warn('Backend Routes API compute failed, falling back to local calculation:', routesErr);
      }
    }

    // Deterministic fallback computation for development/offline parity
    const o = typeof origin === 'object' ? origin : { lat: 18.5204, lng: 73.8567 };
    const d = typeof destination === 'object' ? destination : { lat: 18.5904, lng: 73.9267 };

    const R = 6371; // km
    const dLat = (d.lat - o.lat) * (Math.PI / 180);
    const dLon = (d.lng - o.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(o.lat * (Math.PI / 180)) * Math.cos(d.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directDist = R * c;
    const roadDist = Math.max(2, Number((directDist * 1.32).toFixed(1)));
    const durationMinutes = Math.max(3, Math.round(roadDist * 1.3));

    const fuel = computeSafeFuelMetrics({
      distanceKm: roadDist,
      avgConsumption: activeVehicle.avgConsumption || 7.5,
      tankCapacity: activeVehicle.tankCapacity || 45,
      currentFuelLevelPercent: activeVehicle.currentFuelLevel || 50,
      fuelPricePerUnit: activeVehicle.fuelPricePerUnit || 98,
      fuelType: activeVehicle.fuelType || 'petrol',
    });

    const fallbackRoute = {
      id: `route_backend_${Date.now()}`,
      routeToken: null,
      name: typeof destination === 'string' ? `Route to ${destination}` : 'Direct Calculated Route',
      summary: 'Via Major Arterial',
      distanceKm: roadDist,
      durationMinutes,
      trafficDelayMinutes: 0,
      estimatedFuelLitres: fuel.unitsRequired,
      estimatedFuelCost: fuel.estimatedCost,
      tollsEstimated: avoidTolls ? 0 : 120,
      hasTolls: !avoidTolls,
      hasHighways: !avoidHighways,
      hasFerries: false,
      tags: ['Backend Computed', 'Live Navigation SDK Ready'],
    };

    const destStr = typeof destination === 'object' ? `${destination.lat},${destination.lng}` : String(destination);

    return res.json({
      route: fallbackRoute,
      routes: [fallbackRoute],
      routeToken: null,
      destination: destStr,
      waypoints: [],
      distance: fallbackRoute.distanceKm,
      duration: fallbackRoute.durationMinutes,
      provider: 'Backend Geometric Fallback',
      freshness: Date.now(),
      hasRouteToken: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Route computation error' });
  }
});

// Lightweight Navigation Session Sync
const activeNavigationSessions = new Map<string, any>();

app.post('/api/navigation/session', (req, res) => {
  const { sessionId, destination, routeId, navigationState, vehicleId, fuelState, preferences } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const existing = activeNavigationSessions.get(sessionId) || { startedAt: Date.now() };
  const updatedSession = {
    ...existing,
    sessionId,
    destination: destination || existing.destination,
    routeId: routeId || existing.routeId,
    navigationState: navigationState || existing.navigationState,
    vehicleId: vehicleId || existing.vehicleId,
    fuelState: fuelState || existing.fuelState,
    preferences: preferences || existing.preferences,
    updatedAt: Date.now(),
  };

  activeNavigationSessions.set(sessionId, updatedSession);
  res.json({ success: true, session: updatedSession });
});

app.get('/api/navigation/session/:sessionId', (req, res) => {
  const session = activeNavigationSessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ session });
});

// Candidate models in priority order with graceful fallback on high demand (503) or rate limit
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

// Chat & Copilot Orchestration endpoint
app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 1. If Gemini AI is configured server-side, attempt generation with model cascade
  if (ai) {
    let response: any = null;
    let successfulModel = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: message }],
            },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: functionDeclarations as any }],
          },
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Model timeout after 4500ms')), 4500);
        });

        response = await Promise.race([generatePromise, timeoutPromise]);
        if (response) {
          successfulModel = modelName;
          break;
        }
      } catch (err: any) {
        const status = err?.status || err?.error?.code || (err?.message?.includes('503') ? 503 : 0);
        // If high demand (503), timeout, or rate-limit (429), try next model in cascade
        if (status === 503 || status === 429 || `${err}`.includes('high demand') || `${err}`.includes('UNAVAILABLE') || `${err}`.includes('timeout')) {
          continue;
        }
        // If other error, still attempt fallback before giving up
      }
    }

    if (response) {
      const candidate = response.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter((p: any) => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0]?.functionCall;
        if (fc) {
          const toolName = fc.name || '';
          const toolArgs: Record<string, any> = (fc.args as Record<string, any>) || {};

          // Execute server-side tool logic or return action to client
          let toolResultText = '';

          if (toolName === 'get_speed_limit') {
            toolResultText = 'Speed limit unavailable: No municipal speed-limit provider is connected for this corridor.';
          } else if (toolName === 'estimate_fuel_cost') {
            const dist = typeof toolArgs.distanceKm === 'number' ? toolArgs.distanceKm : 50;
            const metrics = computeSafeFuelMetrics({
              distanceKm: dist,
              avgConsumption: Number(context?.vehicle?.avgConsumption) || 7.5,
              tankCapacity: Number(context?.vehicle?.tankCapacity) || 45,
              currentFuelLevelPercent: Number(context?.vehicle?.currentFuelLevel) || 50,
              fuelPricePerUnit: Number(context?.vehicle?.fuelPricePerUnit) || 98,
            });
            toolResultText = `Trip of ${dist} km will require ~${metrics.unitsRequired}L costing ₹${metrics.estimatedCost}. Remaining vehicle range is ~${metrics.remainingRangeKm} km.`;
          } else {
            toolResultText = `Executing ${toolName} for destination: ${toolArgs.destination || toolArgs.category || 'route'}.`;
          }

          return res.json({
            text: toolResultText,
            toolCalls: [
              {
                name: toolName,
                params: toolArgs,
                status: 'success',
              },
            ],
            modelUsed: successfulModel,
          });
        }
      }

      const text = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
      return res.json({
        text,
        toolCalls: [],
        modelUsed: successfulModel,
      });
    }
  }

  // 2. Deterministic Tool Dispatcher (Used when offline or no API key)
  const lower = message.toLowerCase();

  if (lower.includes('petrol') || lower.includes('fuel pump') || lower.includes('gas station') || lower.includes('diesel')) {
    return res.json({
      text: 'Searching for fuel stations along your corridor...',
      toolCalls: [{ name: 'search_places', params: { category: 'fuel' }, status: 'success' }],
    });
  }

  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dhaba') || lower.includes('eat')) {
    return res.json({
      text: 'Finding dining and restaurant options nearby...',
      toolCalls: [{ name: 'search_places', params: { category: 'food' }, status: 'success' }],
    });
  }

  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('lodge')) {
    const priceMatch = lower.match(/under\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    const maxPrice = priceMatch ? parseInt(priceMatch[1], 10) : 4000;
    return res.json({
      text: `Searching for corridor hotels under ₹${maxPrice} (estimated benchmark rates)...`,
      toolCalls: [{ name: 'search_hotels', params: { maxPrice }, status: 'success' }],
    });
  }

  if (lower.includes('speed limit')) {
    return res.json({
      text: 'Speed limit unavailable: No active speed-camera or municipal telemetry feed configured for this route.',
      toolCalls: [{ name: 'get_speed_limit', params: {}, status: 'success' }],
    });
  }

  if (lower.includes('take me to') || lower.includes('navigate to') || lower.includes('directions to') || lower.includes('route to')) {
    const dest = message.replace(/take me to|navigate to|directions to|route to/i, '').replace(/without tolls|avoid tolls/i, '').trim();
    return res.json({
      text: `Calculating driving directions to ${dest || 'destination'}...`,
      toolCalls: [{ name: 'get_directions', params: { destination: dest || 'Destination' }, status: 'success' }],
    });
  }

  if (lower.includes('fuel cost') || lower.includes('how much fuel')) {
    return res.json({
      text: 'Calculating fuel economics for your trip based on vehicle profile...',
      toolCalls: [{ name: 'estimate_fuel_cost', params: { distanceKm: 50 }, status: 'success' }],
    });
  }

  if (lower.includes('reroute') || lower.includes('traffic')) {
    return res.json({
      text: 'Analyzing corridor traffic and recalculating route...',
      toolCalls: [{ name: 'reroute', params: { reason: 'traffic' }, status: 'success' }],
    });
  }

  if (lower.includes('start navigation') || lower.includes("let's go") || lower.includes('start driving')) {
    return res.json({
      text: 'Starting turn-by-turn navigation.',
      toolCalls: [{ name: 'start_navigation', params: { destination: 'Active Route' }, status: 'success' }],
    });
  }

  return res.json({
    text: "NaviMate AI Copilot ready. Ask me to 'Navigate to Pune', 'Find petrol pumps', 'Find hotels under ₹3000', or 'Check fuel cost'.",
    toolCalls: [],
  });
});

// Setup Vite development server middlewares or serve production dist
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Intercept /@vite/client requests to serve a silent HMR-free stub that fulfills
    // stylesheet injection and HMR contexts without opening failing WebSockets or logging [vite] messages
    const sendSilentViteClient = (_req: express.Request, res: express.Response) => {
      res.type('application/javascript');
      res.send(`
export const createHotContext = () => ({
  accept: () => {},
  prune: () => {},
  dispose: () => {},
  decline: () => {},
  invalidate: () => {},
  on: () => {},
  send: () => {},
  data: {}
});
export const updateStyle = (id, content) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    el.setAttribute('type', 'text/css');
    document.head.appendChild(el);
  }
  el.textContent = content;
};
export const removeStyle = (id) => {
  const el = document.getElementById(id);
  if (el) el.remove();
};
export const injectQuery = (url, query) => url + (url.includes('?') ? '&' : '?') + query;
export class ErrorOverlay extends HTMLElement {}
if (typeof customElements !== 'undefined' && !customElements.get('vite-error-overlay')) {
  try { customElements.define('vite-error-overlay', ErrorOverlay); } catch (_) {}
}
      `);
    };

    app.get('/@vite/client', sendSilentViteClient);
    app.get('/node_modules/vite/dist/client/client.mjs', sendSilentViteClient);

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NaviMate AI server running on port ${PORT}`);
  });
}

startServer();
