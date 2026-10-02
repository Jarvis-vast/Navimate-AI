import { RouteRequest, OnlineRoutingEngine } from './routing';
import { searchPOIs, searchHotels } from './poi';
import { calculateFuelMetrics } from './fuelIntelligence';
import { defaultVehicle } from '../constants/defaults';
import { Coordinates } from '../types/navigation';

export interface OrchestrationCallbacks {
  onRouteCalculated?: (routes: any[]) => void;
  onPOIsFound?: (pois: any[]) => void;
  onHotelsFound?: (hotels: any[]) => void;
  onStartNavigation?: (destination: string) => void;
  onReroute?: () => void;
}

export class GeminiAgentService {
  private currentCoords: Coordinates = { lat: 18.5204, lng: 73.8567 };
  private routingEngine: OnlineRoutingEngine;

  constructor() {
    this.routingEngine = new OnlineRoutingEngine(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
  }

  setCurrentCoordinates(coords: Coordinates) {
    this.currentCoords = coords;
  }

  /**
   * Dispatches user queries through Server-Side Gemini API Orchestration (/api/chat)
   * with graceful client-side tool execution and offline fallback.
   */
  async processUserMessage(
    userText: string,
    history?: Array<{ role: 'user' | 'model'; parts: any[] }>,
    callbacks?: OrchestrationCallbacks
  ): Promise<{ text: string; toolCalled?: string; toolData?: any }> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          context: {
            currentCoords: this.currentCoords,
            vehicle: defaultVehicle,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let executedText = data.text || '';
        let toolNameExecuted: string | undefined;
        let toolResultData: any;

        if (data.toolCalls && data.toolCalls.length > 0) {
          for (const tc of data.toolCalls) {
            toolNameExecuted = tc.name;
            const params = tc.params || {};

            if (tc.name === 'get_directions') {
              const routes = await this.routingEngine.computeRoutes({
                origin: this.currentCoords,
                destination: params.destination || 'Destination',
                avoidTolls: params.avoidTolls,
                avoidHighways: params.avoidHighways,
              });
              if (callbacks?.onRouteCalculated) callbacks.onRouteCalculated(routes);
              toolResultData = routes;
              if (routes.length > 0) {
                const r = routes[0];
                executedText = `Route to ${params.destination || 'destination'} calculated: ${r.distanceKm} km, ~${r.durationMinutes} min. Est. fuel: ${r.estimatedFuelLitres}L (₹${r.estimatedFuelCost}).`;
              }
            } else if (tc.name === 'search_places') {
              const category = params.category || 'fuel';
              const pois = await searchPOIs(category, this.currentCoords);
              if (callbacks?.onPOIsFound) callbacks.onPOIsFound(pois);
              toolResultData = pois;
              if (pois.length > 0) {
                const top = pois[0];
                executedText = `Found ${pois.length} ${category} locations. Nearest: ${top.name} (${top.distanceKm} km away, ~${top.detourMinutes} min detour).`;
              }
            } else if (tc.name === 'search_hotels') {
              const maxPrice = params.maxPrice || 4500;
              const hotels = await searchHotels(this.currentCoords, maxPrice);
              if (callbacks?.onHotelsFound) callbacks.onHotelsFound(hotels);
              toolResultData = hotels;
              if (hotels.length > 0) {
                executedText = `Found ${hotels.length} corridor hotels under ₹${maxPrice} (estimated benchmark rates). Top pick: ${hotels[0]?.name} at ₹${hotels[0]?.pricePerNight}/night.`;
              }
            } else if (tc.name === 'start_navigation') {
              if (callbacks?.onStartNavigation) callbacks.onStartNavigation(params.destination || 'Active Route');
              executedText = 'Engaging turn-by-turn navigation.';
            } else if (tc.name === 'reroute') {
              if (callbacks?.onReroute) callbacks.onReroute();
              executedText = 'Checking corridor traffic. Rerouting via alternative route.';
            }
          }
        }

        return {
          text: executedText,
          toolCalled: toolNameExecuted,
          toolData: toolResultData,
        };
      }
    } catch (apiErr) {
      console.warn('Chat API fetch failed (device may be offline), using offline tool dispatcher:', apiErr);
    }

    // Local offline tool dispatcher fallback
    return this.processOfflineFallback(userText, callbacks);
  }

  private async processOfflineFallback(
    userText: string,
    callbacks?: OrchestrationCallbacks
  ): Promise<{ text: string; toolCalled?: string; toolData?: any }> {
    const textLower = userText.toLowerCase().trim();

    if (textLower.includes('petrol') || textLower.includes('fuel pump') || textLower.includes('gas station') || textLower.includes('diesel')) {
      const pois = await searchPOIs('fuel', this.currentCoords);
      if (callbacks?.onPOIsFound) callbacks.onPOIsFound(pois);
      const top = pois[0];
      return {
        text: `Found ${pois.length} fuel stations nearby. Nearest: ${top.name} (${top.distanceKm} km).`,
        toolCalled: 'search_places',
        toolData: pois,
      };
    }

    if (textLower.includes('food') || textLower.includes('restaurant') || textLower.includes('eat')) {
      const pois = await searchPOIs('food', this.currentCoords);
      if (callbacks?.onPOIsFound) callbacks.onPOIsFound(pois);
      const top = pois[0];
      return {
        text: `Found ${pois.length} dining options. Nearest: ${top.name} (${top.distanceKm} km).`,
        toolCalled: 'search_places',
        toolData: pois,
      };
    }

    if (textLower.includes('hotel') || textLower.includes('stay')) {
      const hotels = await searchHotels(this.currentCoords, 4000);
      if (callbacks?.onHotelsFound) callbacks.onHotelsFound(hotels);
      return {
        text: `Found ${hotels.length} hotels (estimated benchmark index).`,
        toolCalled: 'search_hotels',
        toolData: hotels,
      };
    }

    if (textLower.includes('take me to') || textLower.includes('navigate to') || textLower.includes('directions to')) {
      const dest = userText.replace(/take me to|navigate to|directions to/i, '').trim();
      try {
        const routes = await this.routingEngine.computeRoutes({
          origin: this.currentCoords,
          destination: dest || 'Destination',
        });
        if (callbacks?.onRouteCalculated) callbacks.onRouteCalculated(routes);
        return {
          text: `Route calculated: ${routes[0].distanceKm} km, ~${routes[0].durationMinutes} mins.`,
          toolCalled: 'get_directions',
          toolData: routes,
        };
      } catch (err: any) {
        return {
          text: err.message || 'Routing unavailable offline without pre-cached corridor graph.',
        };
      }
    }

    return {
      text: "NaviMate AI Copilot active. Ask me to 'Find petrol pumps', 'Navigate to destination', or 'Find hotels'.",
    };
  }
}
