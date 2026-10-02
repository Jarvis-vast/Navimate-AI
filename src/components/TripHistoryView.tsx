import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  TripRecord,
  TripAnalyticsSummary,
  fetchUserTrips,
  deleteTripRecord,
  computeTripAnalytics,
  saveTripRecord,
} from '../services/tripHistory';
import {
  X,
  Navigation,
  Calendar,
  Clock,
  Fuel,
  TrendingUp,
  MapPin,
  ArrowRight,
  Trash2,
  Download,
  PlusCircle,
  BarChart3,
  Search,
  CheckCircle2,
  DollarSign,
  Route,
  Zap,
} from 'lucide-react';

interface TripHistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRouteAgain?: (origin: string, destination: string) => void;
}

export const TripHistoryView: React.FC<TripHistoryViewProps> = ({
  isOpen,
  onClose,
  onSelectRouteAgain,
}) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'dist_desc' | 'cost_desc'>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);

  const effectiveUserId = user?.uid || 'guest_user';

  // Seed sample completed trips if none exist so the user can immediately experience the analytics
  const loadTrips = async () => {
    setLoading(true);
    try {
      let records: TripRecord[] = [];
      if (user) {
        records = await fetchUserTrips(user.uid);
      } else {
        // Local fallback for guest
        const stored = localStorage.getItem('navimate_guest_trips');
        records = stored ? JSON.parse(stored) : [];
      }

      if (records.length === 0) {
        // Seed default initial completed trip for demonstration
        const sampleTrip: TripRecord = {
          tripId: `trip_sample_${Date.now()}`,
          userId: effectiveUserId,
          originName: 'Baner Tech Hub, Pune',
          destinationName: 'Mumbai Expressway Toll Plaza, Urse',
          distanceMeters: 42500,
          durationSeconds: 2700,
          fuelConsumedLitres: 2.89,
          fuelCost: 285,
          averageSpeedKmh: 56.6,
          fuelType: 'PETROL',
          currency: '₹',
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          completedAt: new Date(Date.now() - 83700000).toISOString(),
          routeSummary: 'Via Mumbai-Pune Expressway Fast Route',
        };

        if (user) {
          await saveTripRecord(sampleTrip);
          records = [sampleTrip];
        } else {
          records = [sampleTrip];
          localStorage.setItem('navimate_guest_trips', JSON.stringify(records));
        }
      }

      setTrips(records);
    } catch (e) {
      console.warn('Could not load trips from Firestore:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTrips();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Sorting
  const sortedTrips = [...trips]
    .filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.originName.toLowerCase().includes(q) ||
        t.destinationName.toLowerCase().includes(q) ||
        t.routeSummary.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime();
        case 'dist_desc':
          return (b.distanceMeters || 0) - (a.distanceMeters || 0);
        case 'cost_desc':
          return (b.fuelCost || 0) - (a.fuelCost || 0);
        case 'date_desc':
        default:
          return new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime();
      }
    });

  // Calculate analytics
  const analytics: TripAnalyticsSummary = computeTripAnalytics(trips);

  // Add dummy completed trip for instant testing
  const handleAddSampleTrip = async () => {
    const destinations = [
      { origin: 'Bandra Kurla Complex, Mumbai', dest: 'Nariman Point, South Mumbai', dist: 18400, dur: 1800, litres: 1.4, cost: 142 },
      { origin: 'Koregaon Park, Pune', dest: 'Lonavala Hill Station', dist: 64200, dur: 4500, litres: 4.3, cost: 425 },
      { origin: 'Indiranagar 100ft Rd, Bengaluru', dest: 'Electronic City Phase 1', dist: 22100, dur: 2400, litres: 1.6, cost: 165 },
    ];
    const pick = destinations[Math.floor(Math.random() * destinations.length)];

    const newTrip: TripRecord = {
      tripId: `trip_${Date.now()}`,
      userId: effectiveUserId,
      originName: pick.origin,
      destinationName: pick.dest,
      distanceMeters: pick.dist,
      durationSeconds: pick.dur,
      fuelConsumedLitres: pick.litres,
      fuelCost: pick.cost,
      averageSpeedKmh: Math.round((pick.dist / 1000) / (pick.dur / 3600)),
      fuelType: 'PETROL',
      currency: '₹',
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: new Date().toISOString(),
      routeSummary: 'Optimized Fuel Saver Corridor',
    };

    if (user) {
      await saveTripRecord(newTrip);
    } else {
      const updated = [newTrip, ...trips];
      localStorage.setItem('navimate_guest_trips', JSON.stringify(updated));
    }
    setTrips((prev) => [newTrip, ...prev]);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (user) {
      await deleteTripRecord(tripId);
    }
    const updated = trips.filter((t) => t.tripId !== tripId);
    setTrips(updated);
    if (!user) {
      localStorage.setItem('navimate_guest_trips', JSON.stringify(updated));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (trips.length === 0) return;
    const headers = ['Trip ID', 'Date', 'Origin', 'Destination', 'Distance (km)', 'Duration (min)', 'Fuel (L)', 'Cost', 'Avg Speed (km/h)'];
    const rows = trips.map((t) => [
      t.tripId,
      new Date(t.completedAt || t.createdAt).toLocaleDateString(),
      `"${t.originName.replace(/"/g, '""')}"`,
      `"${t.destinationName.replace(/"/g, '""')}"`,
      (t.distanceMeters / 1000).toFixed(1),
      Math.round(t.durationSeconds / 60),
      t.fuelConsumedLitres.toFixed(2),
      t.fuelCost,
      t.averageSpeedKmh,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NaviMate_Trip_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Trip History & Driving Analytics</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Cloud Firestore
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {user ? `Logged as ${user.email}` : 'Local preview (Sign in to sync across Android & Web)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              title="Export CSV"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700/60"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={handleAddSampleTrip}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Log Sample Trip
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* SUMMARY ANALYSIS VIEW */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" /> Lifetime Driving Summary Analysis
              </h3>
              <span className="text-xs text-slate-500">{analytics.totalTrips} completed journeys</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Distance */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Total Distance</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Route className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums">
                    {analytics.totalDistanceKm.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-400">km</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Across all completed trips</p>
                </div>
              </div>

              {/* Average Fuel Economy */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Avg Fuel Economy</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Fuel className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-400 tabular-nums">
                    {analytics.averageFuelEconomyL100km || 6.8}{' '}
                    <span className="text-xs font-normal text-slate-400">L/100km</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Eco Optimized
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Fuel Cost */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Total Trip Cost</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-amber-400 tabular-nums">
                    {analytics.currency} {analytics.totalTripCost.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {analytics.totalFuelLitres} L total fuel consumed
                  </p>
                </div>
              </div>

              {/* Driving Time & Speed */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">Driving Hours</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums">
                    {analytics.totalDurationHours}{' '}
                    <span className="text-xs font-normal text-slate-400">hrs</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Avg speed: {analytics.averageSpeedKmh || 48} km/h
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH & SORT BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by destination or origin..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="date_desc">Date: Newest First</option>
                <option value="date_asc">Date: Oldest First</option>
                <option value="dist_desc">Distance: Longest</option>
                <option value="cost_desc">Cost: Highest</option>
              </select>
            </div>
          </div>

          {/* TRIP RECORDS LIST */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Loading trip history from Firestore...
              </div>
            ) : sortedTrips.length === 0 ? (
              <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-8">
                <Navigation className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-white mb-1">No completed trips found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Whenever you complete a route or driving session in NaviMate, it will automatically be recorded here.
                </p>
                <button
                  onClick={handleAddSampleTrip}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add Demo Trip Now
                </button>
              </div>
            ) : (
              sortedTrips.map((trip) => {
                const dateStr = new Date(trip.completedAt || trip.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const distKm = (trip.distanceMeters / 1000).toFixed(1);
                const durMin = Math.round(trip.durationSeconds / 60);

                return (
                  <div
                    key={trip.tripId}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    {/* Left: Origin/Destination & Route Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        <span>{dateStr}</span>
                        <span className="text-slate-600">•</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          {trip.status}
                        </span>
                        {trip.routeSummary && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400 truncate max-w-xs">{trip.routeSummary}</span>
                          </>
                        )}
                      </div>

                      {/* Route Path Indicator */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                          <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="truncate">{trip.originName}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                          <span className="truncate">{trip.destinationName}</span>
                        </div>
                      </div>

                      {/* Metrics Badges */}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Route className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold tabular-nums">{distKm}</span> km
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span className="font-bold tabular-nums">{durMin}</span> min
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Fuel className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold tabular-nums">{trip.fuelConsumedLitres?.toFixed(1) || 0}</span> L
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                          <span>{trip.currency}</span>
                          <span className="tabular-nums">{trip.fuelCost}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {onSelectRouteAgain && (
                        <button
                          onClick={() => {
                            onSelectRouteAgain(trip.originName, trip.destinationName);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Replan
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTrip(trip.tripId)}
                        title="Delete from Firestore"
                        className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-rose-950/60 hover:text-rose-400 text-slate-500 border border-slate-800 hover:border-rose-500/40 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
