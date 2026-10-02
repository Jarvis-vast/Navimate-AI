import React, { useState, useMemo } from 'react';
import { POIItem, HotelItem, HotelFilters } from '../types/navigation';
import {
  Fuel,
  Utensils,
  Zap,
  Coffee,
  Hotel,
  Star,
  Navigation,
  ExternalLink,
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
} from 'lucide-react';

interface POIDiscoveryViewProps {
  category: 'fuel' | 'food' | 'charging' | 'hotels';
  pois: POIItem[];
  hotels: HotelItem[];
  onSelectCategory: (cat: 'fuel' | 'food' | 'charging' | 'hotels') => void;
  onSelectPOI: (poi: POIItem) => void;
  onClose: () => void;
  onSelectHotel?: (hotel: HotelItem) => void;
}

export const POIDiscoveryView: React.FC<POIDiscoveryViewProps> = ({
  category,
  pois,
  hotels,
  onSelectCategory,
  onSelectPOI,
  onClose,
  onSelectHotel,
}) => {
  // Hotel Filter States
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(6000);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(25);

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (maxPrice < 6000) count++;
    if (minRating > 0) count++;
    if (maxDistanceKm < 25) count++;
    return count;
  }, [maxPrice, minRating, maxDistanceKm]);

  // Apply filters to hotel list
  const filteredHotels = useMemo(() => {
    return hotels.filter((h) => {
      const matchPrice = h.pricePerNight <= maxPrice;
      const matchRating = h.rating >= minRating;
      const matchDistance = h.distanceFromRouteKm <= maxDistanceKm;
      return matchPrice && matchRating && matchDistance;
    });
  }, [hotels, maxPrice, minRating, maxDistanceKm]);

  const handleResetFilters = () => {
    setMaxPrice(6000);
    setMinRating(0);
    setMaxDistanceKm(25);
  };

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 max-h-[82vh] overflow-y-auto">
      {/* Category Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onSelectCategory('fuel')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              category === 'fuel'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" /> Fuel
          </button>

          <button
            onClick={() => onSelectCategory('food')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              category === 'food'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" /> Food
          </button>

          <button
            onClick={() => onSelectCategory('charging')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              category === 'charging'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> EV Charging
          </button>

          <button
            onClick={() => onSelectCategory('hotels')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              category === 'hotels'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Hotel className="w-3.5 h-3.5" /> Hotels
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hotel Search Filtering Bar (when on hotels tab) */}
      {category === 'hotels' && (
        <div className="flex flex-col gap-2.5 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  activeFiltersCount > 0 || showFilterDrawer
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <span className="text-xs text-slate-400">
                {filteredHotels.length} {filteredHotels.length === 1 ? 'hotel' : 'hotels'} available
              </span>
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          {/* Expanded or Inline Filters */}
          {showFilterDrawer && (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-700/60 text-xs">
              {/* Max Price Filter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-300 font-medium">Max Price / Night</span>
                  <span className="text-emerald-400 font-bold tabular-nums">
                    {maxPrice >= 6000 ? 'Any Price' : `Up to ₹${maxPrice.toLocaleString()}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="6000"
                  step="250"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-purple-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>₹1,000</span>
                  <span>₹3,000</span>
                  <span>₹5,000+</span>
                </div>
              </div>

              {/* Min Star Rating Filter */}
              <div>
                <span className="text-slate-300 font-medium block mb-1.5">Minimum Star Rating</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Any', value: 0 },
                    { label: '3.8★+', value: 3.8 },
                    { label: '4.0★+', value: 4.0 },
                    { label: '4.5★+', value: 4.5 },
                  ].map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setMinRating(r.value)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        minRating === r.value
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Distance from Route Corridor Filter */}
              <div>
                <span className="text-slate-300 font-medium block mb-1.5">
                  Max Distance from Route Corridor
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '≤ 3 km', value: 3 },
                    { label: '≤ 5 km', value: 5 },
                    { label: '≤ 10 km', value: 10 },
                    { label: '≤ 25 km', value: 25 },
                  ].map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setMaxDistanceKm(d.value)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        maxDistanceKm === d.value
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* POI or Hotel Cards */}
      <div className="flex flex-col gap-2.5">
        {category === 'hotels' ? (
          filteredHotels.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col items-center gap-2">
              <Hotel className="w-8 h-8 text-slate-500" />
              <p className="text-xs text-slate-300 font-medium">
                No hotels match the selected filters.
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Try widening your price range, lowering the minimum rating, or increasing the corridor distance.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-purple-500/30"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredHotels.map((hotel) => (
              <div
                key={hotel.id}
                className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{hotel.name}</h4>
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-400 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {hotel.rating}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <span className="text-purple-400 font-medium">{hotel.distanceFromRouteKm} km</span> from route · {hotel.amenities.slice(0, 2).join(', ')}
                  </p>
                  <span className="text-[11px] text-amber-400/80 block truncate">Estimated benchmark · No live GDS connected</span>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div>
                    <span className="text-base font-bold text-emerald-400 tabular-nums">
                      ₹{hotel.pricePerNight.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block -mt-0.5">/night</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onSelectHotel && (
                      <button
                        onClick={() => onSelectHotel(hotel)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3" /> Route
                      </button>
                    )}
                    <a
                      href={hotel.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                    >
                      Book <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )
        ) : pois.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Searching for nearby {category}...
          </p>
        ) : (
          pois.map((poi) => (
            <div
              key={poi.id}
              className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 transition flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{poi.name}</h4>
                  {poi.fuelPrice && (
                    <span className="text-xs font-semibold text-emerald-400">
                      ₹{poi.fuelPrice.toFixed(1)}/L
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {poi.distanceKm} km away · ~{poi.detourMinutes} min detour · {poi.rating}★ ({poi.userRatingsTotal})
                </p>
                {poi.address && (
                  <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">{poi.address}</p>
                )}
              </div>

              <button
                onClick={() => onSelectPOI(poi)}
                className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-bold transition flex items-center gap-1 shrink-0 ml-2"
              >
                <Navigation className="w-3 h-3 fill-current" />
                Add Stop
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
