import { VehicleProfile, UserPreferences, SavedPlace } from '../types/navigation';

export const defaultVehicle: VehicleProfile = {
  id: 'veh_default_1',
  name: 'Hyundai Creta 1.5L',
  fuelType: 'petrol',
  tankCapacity: 50,
  avgConsumption: 6.8, // L/100km
  currentFuelLevel: 65, // 65% full
  fuelPricePerUnit: 98.5, // ₹98.5 / Litre
  currency: '₹',
};

export const defaultPreferences: UserPreferences = {
  units: 'km',
  theme: 'dark',
  voiceEnabled: true,
  voiceVolume: 1.0,
  dataSaver: 'normal',
  locationHistoryConsent: true,
  autoReroute: true,
  speedLimitAlerts: true,
};

export const defaultSavedPlaces: SavedPlace[] = [
  {
    id: 'place_home',
    name: 'Home',
    address: 'B-402, Skyline Residency, Pune',
    lat: 18.5204,
    lng: 73.8567,
    category: 'home',
  },
  {
    id: 'place_work',
    name: 'Office Campus',
    address: 'EON Free Zone IT Park, Kharadi, Pune',
    lat: 18.5514,
    lng: 73.9512,
    category: 'work',
  },
  {
    id: 'place_fav_1',
    name: 'Mumbai Marine Drive',
    address: 'Netaji Subhash Chandra Bose Rd, Mumbai',
    lat: 18.9438,
    lng: 72.8234,
    category: 'favorite',
  },
  {
    id: 'place_fav_2',
    name: 'Lonavala Expressway Stop',
    address: 'Mumbai-Pune Expressway Plaza, Lonavala',
    lat: 18.7557,
    lng: 73.4091,
    category: 'recent',
  },
];
