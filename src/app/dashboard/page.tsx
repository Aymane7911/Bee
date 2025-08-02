'use client'

import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Layers, Database, Tag, Package, RefreshCw, Menu, X, Home, Settings, Users, Activity, HelpCircle, Wallet, PlusCircle, MapPin, CheckCircle, Trash2, Globe, FileText, AlertCircle, Sparkles, LogOut, Plus, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Sidebar   from '@/components/Sidebar';
import Backdrop from '@/components/Backdrop';
import Header from '@/components/Header';
import CreateBatchModal from '@/components/modals/CreateBatchModal';
import CreateApiaryModal from '@/components/modals/CreateApiaryModal';
import TokenWalletSection from '@/components/sections/TokenWalletSection';
import ApiaryMapSection from '@/components/sections/ApiaryMapSection';
import CertificationChart from '@/components/sections/CertificationChart';
import BatchStatusSection from '@/components/sections/BatchStatusSection';
import BuyTokensModal from '@/components/modals/BuyTokensModal';
import FloatingActionMenu from '@/components/ui/FloatingActionMenu';
import Notification from '@/components/ui/Notification';
import { useSession } from 'next-auth/react';



// Define your interfaces here, right after imports
interface TokenStats {
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  remainingTokens: number;
  totalTokens: number;
  usedTokens: number;
}

interface SelectedApiary extends Apiary {
  kilosCollected?: number; // Override to ensure this is always present
}

interface User {
  passportId?: string;
  passportFile?: string;
  // Add other user properties as needed
  id?: string;
  name?: string;
  email?: string;
  isProfileComplete: boolean;
  isPremium: boolean;
}

interface ApiaryLocation extends LocationCoordinates {
  id: number;
  name: string;
  createdAt?: string;
}
interface ApiaryFormData {
  name: string;
  number: string;
  hiveCount: number;
  honeyCollected: number;
  location: ApiaryLocation | null;
  locationName?: string;
}
  


// Parent Component
interface Apiary {
  id: string;
  name: string;
  number: number;
  hiveCount: number;
  honeyCollected?: number;  // Make optional to match child
  kilosCollected?: number;  // Add missing property
  location?: ApiaryLocation;
  createdAt?: string;
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}


interface CertifiedHoneyWeight {
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
}

interface BatchData {
  id?: string;
  batchNumber?: string;
  status?: string;
  completedChecks?: number;
  totalChecks?: number;
  certificationDate?: string | null;
  expiryDate?: string | null;
  weightKg?: number;
  jarsUsed?: number;
  originOnly?: number;
  qualityOnly?: number;
  bothCertifications?: number;
  uncertified?: number;
  containerType?: string;
  labelType?: string;
  [key: string]: any; // Allow for other properties
}

interface ProcessedBatch {
  id: string;
  name: string;
  batchNumber?: string; // Add this
  status: string;
  completedChecks: number;
  totalChecks: number;
  certificationDate: string | undefined; // Change to optional: certificationDate?: string;
  expiryDate: string | undefined; // Change to optional: expiryDate?: string;
  totalKg: number; // This maps to weightKg in Batch
  jarsUsed: number;
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
  containerType: string;
  labelType: string;
  originOnlyPercent: number;
  qualityOnlyPercent: number;
  bothCertificationsPercent: number;
  uncertifiedPercent: number;
  
  // Add missing properties from Batch interface
  weightKg: number;
  totalHoneyCollected: number;
  honeyCertified: number;
  honeyRemaining: number;
  createdAt: string;
  updatedAt: string;
}

interface AppData {
  containers: any[];
  labels: any[];
  batches: BatchData[];
  jars: Jar[];
  tokenStats: TokenStats;
  certifiedHoneyWeight: CertifiedHoneyWeight;
}

interface IncomingBatchData {
  batchId?: string;
  batchName?: string;
  category?: string;
  weight?: number;
  status?: string;
  completedChecks?: number;
  totalChecks?: number;
  certificationDate?: string | null;
  expiryDate?: string | null;
  jarsUsed?: number;
  originOnly?: number;
  qualityOnly?: number;
  bothCertifications?: number;
  uncertified?: number;
  containerType?: string;
  labelType?: string;
}
const initialData: AppData = {
  containers: [],
  labels: [],
  batches: [],
  jars: [],
  tokenStats: {
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0,
    remainingTokens: 0,
    totalTokens: 0,
    usedTokens: 0
  },
  certifiedHoneyWeight: {
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0
  }
};

// Mock data - in a real implementation, this would come from your backend microservices


interface Apiary {
  id: string;
  name: string;
  number: number;
  hiveCount: number;
  
  kilosCollected?: number; // Add this if it's a possible property
  location?: ApiaryLocation;
  honeyCollected?: number;
  createdAt?: string;
}
interface FormApiary extends Apiary {
  batchId: string;
  batchNumber: string;
}

interface CertificationStatus {
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
}

interface Jar {
  id?: string;
  jarType?: string;
  labelType?: string;
  count: number;
  // Add other jar properties as needed
}

interface Batch {
  id: string;
  batchNumber: string;
  batchName: string;
  name: string;
  createdAt: string;
  status: string;
  totalKg: number;
  jarsProduced: number;
  apiaries: Apiary[];
  certificationStatus: CertificationStatus;
  containerType: string;
  labelType: string;
  weightKg: number;
  jarUsed: number;
   // Certification data fields
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
  // Percentage fields
  originOnlyPercent: number;
  qualityOnlyPercent: number;
  bothCertificationsPercent: number;
  uncertifiedPercent: number;
   // Progress tracking
  completedChecks: number;
  totalChecks: number;
  
  // Optional dates
  certificationDate?: string;
  expiryDate?: string;
  
  // Optional file paths
  productionReportPath?: string;
  labReportPath?: string;
  
  // JSON field
  jarCertifications?: any;
  
  // Honey data fields
  honeyCertified?: number;
  honeyRemaining?: number;
  totalHoneyCollected?: number;
   // Relations
  userId: number;
  
}

// A microservice dashboard for jar inventory management
export default function JarManagementDashboard() {
  const [data, setData] = useState<AppData>(initialData);
  const [loading, setLoading] = useState(false);
  
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleString());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);
  const [tokensToAdd, setTokensToAdd] = useState(100);
  // Add these state variables to your existing component
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationCoordinates | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapsLinkInput, setMapsLinkInput] = useState('');
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null); 
  const miniGoogleMapRef = useRef<google.maps.Map | null>(null);
  const googleMapsApiKey = "AIzaSyD5huvOzXDwzQnS6xN9NZ_zKGZ5pX28XUs"; 
  const [savedApiaryLocations, setSavedApiaryLocations] = useState<ApiaryLocation[]>([]);
  const [showApiaryModal, setShowApiaryModal] = useState(false);
  const [availableApiaries, setAvailableApiaries] = useState<Apiary[]>([]); // List of all created apiaries
  const [isLoadingApiaries, setIsLoadingApiaries] = useState(false);
  const [selectedApiaries, setSelectedApiaries] = useState<SelectedApiary[]>([]); // Selected apiaries for current batch
  const [locations, setLocations] = useState<ApiaryLocation[]>([]);
  const [userPremiumStatus, setUserPremiumStatus] = useState(false);
  const { data: session } = useSession(); // if using NextAuth

  // Add these state variables to your component
  const apiaryMarkers = useRef<google.maps.Marker[]>([]);
  const [selectedApiary, setSelectedApiary] = useState<Apiary | null>(null);
  const [selectedDropdownApiary, setSelectedDropdownApiary] = useState('');
  const tempMarker = useRef<google.maps.Marker | null>(null);
  const [apiaryFormData, setApiaryFormData] = useState<ApiaryFormData>({
  name: '',
  number: '',
  hiveCount: 0,
  honeyCollected: 0,
  location: null
});
const [isLoading, setIsLoading] = useState(true);
const [batchHoneyCollected, setBatchHoneyCollected] = useState(0);
const [isLoggingOut, setIsLoggingOut] = useState(false);
const [isOpen, setIsOpen] = useState(false);
const [batches, setBatches] = useState<Batch[]>([]);
const [user, setUser] = useState<User | null>(null);


  // 1. Add clickPosition state to track where user clicked for bubble positioning
  const [clickPosition, setClickPosition] = useState({ x: 0, y: 0 });
  const [batchFormData, setBatchFormData] = useState({
    apiaries: [
      {
        name: '',
        number: '',
        hiveCount: 0,
        kilosCollected: 0,
        locationId: ''
      }
    ],
    containerType: 'Glass',
    labelType: 'Standard',
    weightKg: 10,
    weights: {
      originOnly: 0,
      qualityOnly: 0,
      bothCertifications: 0
    }
  });
  const [batchNumber, setBatchNumber] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '' });
  const [batchName, setBatchName] = useState(''); // Added batch name field

  // Add this function in your parent component
const handleUpdateApiaryHiveCount = async (apiaryId: string, newHiveCount: number) => {
  try {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') ||  localStorage.getItem('admin-token');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`/api/apiaries/${apiaryId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hiveCount: newHiveCount }),
    });
    
    // ... rest of your code
  } catch (error) {
    console.error('Error updating hive count:', error);
    throw error;
  }
};
  {/* Add this function to extract coordinates from Google Maps links */}

{/* Add this function to handle manual coordinate input */}
const parseManualCoordinates = (input: any) => {
  try {
    // Clean the input and try different formats
    const cleanInput = input.trim().replace(/[^\d.,-]/g, '');
    
    // Try different coordinate formats
    const formats = [
      // Format: "lat, lng" or "lat,lng"
      /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/,
      // Format: "lat lng" (space separated)
      /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/
    ];

    for (const format of formats) {
      const match = cleanInput.match(format);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // Validate coordinates
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing manual coordinates:', error);
    return null;
  }
};

{/* Add this function to extract coordinates from Google Maps links */}
const extractCoordinatesFromMapsLink = async (url: any) => {
  try {
    // First check if the input looks like manual coordinates
    const manualCoords = parseManualCoordinates(url);
    if (manualCoords) {
      return manualCoords;
    }

    let workingUrl = url;
    
    // Handle different Google Maps URL formats
    const patterns = [
      // Format: https://www.google.com/maps/@lat,lng,zoom
      /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: https://maps.google.com/?q=lat,lng
      /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: https://www.google.com/maps/place/@lat,lng
      /place\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: https://goo.gl/maps or similar with coordinates (encoded format)
      /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
      // Format: Standard coordinates in URL
      /(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: Alternative coordinate format
      /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: Another common format
      /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
      // Format: Plus codes and other formats
      /data=.*?3d(-?\d+\.?\d*).*?4d(-?\d+\.?\d*)/
    ];

    // Try to extract from the original URL first
    for (const pattern of patterns) {
      const match = workingUrl.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        
        // Validate coordinates
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          console.log('Successfully extracted coordinates:', { lat, lng });
          return { lat, lng };
        }
      }
    }
    
    // For shortened URLs, try opening in a new window approach (user-initiated)
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
      console.log('Detected shortened URL - cannot automatically expand due to CORS restrictions');
      return 'SHORTENED_URL';
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing maps link:', error);
    return null;
  }
};


{/* Add this function to handle maps link processing */}
const handleMapsLinkSubmit = async () => {
  if (!mapsLinkInput.trim()) {
    alert('Please enter a Google Maps link or coordinates');
    return;
  }

  try {
    const coordinates = await extractCoordinatesFromMapsLink(mapsLinkInput);
    
    if (coordinates === 'SHORTENED_URL') {
      // Handle shortened URLs with special instructions
      const userChoice = confirm(
        'This appears to be a shortened Google Maps link. Due to browser security restrictions, we cannot automatically extract coordinates from shortened links.\n\n' +
        'Would you like to:\n\n' +
        '• Click "OK" to open the link in a new tab so you can copy the full URL\n' +
        '• Click "Cancel" to manually enter coordinates instead\n\n' +
        'Instructions:\n' +
        '1. The link will open in a new tab\n' +
        '2. Copy the full URL from the address bar\n' +
        '3. Come back and paste that URL here\n' +
        '4. Or copy the coordinates and paste them as "latitude, longitude"'
      );
      
      if (userChoice) {
        // Open the shortened URL in a new tab
        window.open(mapsLinkInput, '_blank');
        alert('The link has been opened in a new tab. Please copy the full URL from the address bar and paste it here, or copy the coordinates and enter them as "latitude, longitude".');
      } else {
        alert('You can also enter coordinates directly in the format: "25.2048, 55.2708" (latitude, longitude)');
      }
      return;
    }
    
    if (coordinates) {
      const newLocation = {
        id: Date.now(),
        name: `Location from ${mapsLinkInput.includes('http') ? 'Maps Link' : 'Coordinates'}`,
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        lat: coordinates.lat,
        lng: coordinates.lng,
        createdAt: new Date().toISOString()
      };

      setApiaryFormData(prev => ({
        ...prev,
        location: newLocation
      }));

      // Center the map on the new location
      if (miniGoogleMapRef.current) {
        const newCenter = new google.maps.LatLng(coordinates.lat, coordinates.lng);
        miniGoogleMapRef.current.setCenter(newCenter);
        miniGoogleMapRef.current.setZoom(15);
      }

      // Clear the input
      setMapsLinkInput('');
      
      alert(`Location set successfully! Coordinates: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`);
    } else {
      alert(
        'Could not extract coordinates. Please try:\n\n' +
        '📍 DIRECT COORDINATES:\n' +
        '   • Format: "25.2048, 55.2708"\n' +
        '   • Format: "25.2048 55.2708"\n\n' +
        '🔗 GOOGLE MAPS LINKS:\n' +
        '   • Full URL from browser address bar\n' +
        '   • Right-click on location → "What\'s here?" → copy coordinates\n\n' +
        '📱 FROM MOBILE APP:\n' +
        '   • Share → Copy Link (then open link in browser and copy full URL)\n' +
        '   • Long press on location → copy coordinates'
      );
    }
  } catch (error) {
    console.error('Error processing maps link:', error);
    alert('An error occurred while processing the input. Please try entering coordinates directly in the format: "latitude, longitude"');
  }
};

 

  function getAuthToken() {
  // Replace this with however you store your JWT token
  // Could be localStorage, sessionStorage, cookies, context, etc.
  return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// Function to make authenticated API requests


 async function saveApiaryToDatabase(apiaryData: any) {
  console.log('=== SAVING APIARY - SINGLE SAVE ===');
  console.log('Raw apiaryData received:', apiaryData);
  
  try {
    // INPUT VALIDATION
    if (!apiaryData.name || !apiaryData.number) {
      throw new Error('Apiary name and number are required');
    }

    // Enhanced location validation
    if (!apiaryData.location) {
      throw new Error('Location is required');
    }

    // Extract and validate coordinates
    let latitude, longitude;
    
    if (typeof apiaryData.location === 'object') {
      latitude = apiaryData.location.latitude;
      longitude = apiaryData.location.longitude;
    } else {
      throw new Error('Location must be an object with latitude and longitude');
    }

    // Convert to numbers and validate
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.error('Invalid coordinates:', { latitude, longitude, lat, lng });
      throw new Error('Invalid latitude or longitude values');
    }

    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (lng < -180 || lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    // Process location name - use provided name or generate from coordinates
    let locationName = null; // Default to null to match database schema
    if (apiaryData.locationName && typeof apiaryData.locationName === 'string') {
      const trimmedLocationName = apiaryData.locationName.trim();
      if (trimmedLocationName.length > 0) {
        locationName = trimmedLocationName;
      }
    }
    
    // If no location name provided, keep it as null (optional field in database)
    // The coordinates will be stored separately in latitude/longitude fields

    // PREPARE DATA - Send structure that matches your API interface
    const dataForAPI = {
      name: String(apiaryData.name).trim(),
      number: String(apiaryData.number).trim(),
      hiveCount: Math.max(0, parseInt(apiaryData.hiveCount) || 0),
      honeyCollected: Math.max(0, parseFloat(apiaryData.honeyCollected) || 0),
      kilosCollected: Math.max(0, parseFloat(apiaryData.kilosCollected) || 0), // Added to match schema
      latitude: lat,
      longitude: lng,
      locationName: locationName // This will be null if no name provided, which is fine for optional field
    };

    console.log('Data being sent to API:', dataForAPI);

    // Get auth token
    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth-token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('auth-token');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('Making SINGLE POST request to /api/apiaries');

    // SINGLE API CALL - This will create ONE apiary with locationName included
    const response = await fetch('/api/apiaries', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(dataForAPI)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error Response:', errorData);
      
      let errorMessage = 'Failed to save apiary';
      
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication failed. Please log in again.';
          break;
        case 409:
          errorMessage = errorData.message || errorData.error || 'An apiary with this name or number already exists.';
          break;
        case 400:
          errorMessage = errorData.message || errorData.error || 'Invalid data provided.';
          break;
        case 500:
          errorMessage = 'Server error. Please try again later.';
          break;
        default:
          errorMessage = errorData.message || errorData.error || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Apiary saved successfully:', result);

    // Return the created apiary
    return result;
  
  } catch (error) {
    console.error('Error in saveApiaryToDatabase:', error);
    throw error;
  }
}


const refreshApiariesFromDatabase = async () => {
  try {
    console.log('=== REFRESH APIARIES DEBUG ===');
    
    // Enhanced token retrieval with better debugging
    let token = null;
    
    if (typeof window !== 'undefined') {
      // Check localStorage first
      token = localStorage.getItem('auth-token');
      console.log('localStorage token:', token ? 'exists' : 'missing');
      
      // Check sessionStorage as fallback
      if (!token) {
        token = sessionStorage.getItem('auth-token');
        console.log('sessionStorage token:', token ? 'exists' : 'missing');
      }
      
      // Check for other possible token names
      if (!token) {
        token = localStorage.getItem('token') || localStorage.getItem('authToken');
        console.log('Alternative token names:', token ? 'exists' : 'missing');
      }
    }
    
    // Check cookies as last resort
    if (!token && typeof document !== 'undefined') {
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];
      
      if (cookieToken) {
        token = cookieToken;
        console.log('Cookie token found');
      }
    }
    
    console.log('Final token status:', token ? 'exists' : 'MISSING');
    
    // If no token found, throw early
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }
    
    // Create headers with proper token format
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Always include if we have a token
    };
    
    console.log('Request headers:', {
      ...headers,
      'Authorization': token ? 'Bearer [TOKEN_EXISTS]' : 'MISSING'
    });
    
    const response = await fetch('/api/apiaries', {
      method: 'GET',
      credentials: 'include', // This ensures cookies are sent
      headers,
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Refresh API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      if (response.status === 401) {
        // Clear invalid token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-token');
          sessionStorage.removeItem('auth-token');
        }
        throw new Error('Authentication failed. Please log in again.');
      }
      
      throw new Error(`Failed to fetch apiaries: ${response.status} ${response.statusText}`);
    }
    
    const apiaries = await response.json();
    console.log('Fetched apiaries count:', apiaries.length);
    
    setAvailableApiaries(apiaries);
    console.log('Apiaries list refreshed successfully!');
    
  } catch (error: unknown) {
    console.error('Error refreshing apiaries:', error);
    
    if (error instanceof Error) {
      if (
        error.message.includes('401') ||
        error.message.toLowerCase().includes('authentication') ||
        error.message.includes('No authentication token')
      ) {
        console.error('Authentication failed during refresh');
        // Show user-friendly message
        alert('Your session has expired. Please log in again.');
        // Redirect to login page
        window.location.href = '/login';
      } else {
        // Show other errors to user
        alert(`Failed to load apiaries: ${error.message}`);
      }
    } else {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred while loading apiaries.');
    }
  }
};
// You should also add a useEffect to load apiaries when the component mounts:
useEffect(() => {
  refreshApiariesFromDatabase();
}, []);
  
 // Fetch batches data
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoading(true);
        // Replace with your actual API call
        const response = await fetch('/api/batches');
        const data = await response.json();
        setBatches(data.batches || []);
      } catch (error) {
        console.error('Error fetching batches:', error);
        setBatches([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, []);

// Define performLogout function
const performLogout = async () => {
  // Clear the ACTUAL localStorage keys (based on your debug output)
  const keysToRemove = [
    'token',           // ← This is the main token
    'authtoken',       // ← This is another token 
    'authToken',       // Keep this in case it exists sometimes
    'refreshToken',    // Keep this in case it exists sometimes
    'user',
    'tokenBalance',    // This might be auth-related
    'isProfileComplete', // This might be user-related
    'nextauth.message', // NextAuth related
    'honeycertify_apiaries', // This might contain user data
  ];
  
  // Remove all auth keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Cleared localStorage key: ${key}`);
  });
  
  // Clear session storage completely
  sessionStorage.clear();
  
  // Make API call to backend logout endpoint
  try {
    await fetch('/api/auth/logout', { 
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('Backend logout failed:', error);
  }
};

const handleLogout = async () => {
  try {
    setIsLoggingOut(true);
    console.log('Starting logout process...');
    
    // Clear client-side auth data and call logout API
    await performLogout();
    
    // Also sign out from NextAuth if using OAuth
    await signOut({ redirect: false });
    
    console.log('Logout completed, redirecting to login...');
    
    // Redirect to login page
    router.push('/login');
    
    // Force a hard refresh to ensure all state is cleared
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
    
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect even if there's an error
    router.push('/login');
  } finally {
    setIsLoggingOut(false);
  }
};



// Also add this helper function to clean location data
const cleanLocationData = (location: any) => {
  if (!location) return null;
  
  return {
    id: location.id,
    name: location.name,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    lat: Number(location.latitude || location.lat),
    lng: Number(location.longitude || location.lng),
    createdAt: location.createdAt
  };
};

  const [isSaving, setIsSaving] = useState<boolean>(false);

  

// 3. Function to fetch saved apiary locations
// Define interfaces for type safety
interface LocationTemplate {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

interface Apiary {
  kilosCollected?: any;
  location: any;
  id: string;
  name: string;
  number: number;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  hiveCount: number;
}




interface ProcessedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  isTemplate: boolean;
  originalApiaryId?: string | number;
}

interface ApiariesResponse {
  apiaries?: Apiary[];
  data?: Apiary[];
}

const fetchSavedApiaryLocations = async (): Promise<void> => {
  try {
    // Get auth token
    let token: string | null = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('auth-token') ||
               localStorage.getItem('token') ||
               sessionStorage.getItem('auth-token');
    }

    // Define headers with proper typing
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('Fetching saved locations with auth...');
    
    // First try to get saved location templates
    const locationsResponse = await fetch('/api/apiaries/locations', {
      headers,
      credentials: 'include',
    });

    let locations: ApiaryLocation[] = [];

    if (locationsResponse.ok) {
      const locationTemplates: LocationTemplate[] = await locationsResponse.json();
      console.log('Fetched location templates:', locationTemplates);
      
      locations = locationTemplates.map((loc: LocationTemplate) => ({
        id: Number(loc.id),
        name: loc.name,
        lat: loc.latitude,
        lng: loc.longitude,
        latitude: loc.latitude,
        longitude: loc.longitude,
        createdAt: loc.createdAt,
        isTemplate: true // Mark as template (note: this property might need to be added to your ApiaryLocation type)
      }));
    }

    // Also get unique locations from all apiaries (including those with batchId)
    const apiariesResponse = await fetch('/api/apiaries', {
      headers,
      credentials: 'include',
    });

    if (apiariesResponse.ok) {
      const apiariesData: Apiary[] | ApiariesResponse = await apiariesResponse.json();
      console.log('Fetched apiaries for location extraction:', apiariesData);
      
      let apiaries: Apiary[] = [];
      if (Array.isArray(apiariesData)) {
        apiaries = apiariesData;
      } else if (apiariesData.apiaries && Array.isArray(apiariesData.apiaries)) {
        apiaries = apiariesData.apiaries;
      } else if (apiariesData.data && Array.isArray(apiariesData.data)) {
        apiaries = apiariesData.data;
      }

      // Extract unique locations from apiaries
      const apiaryLocations: ApiaryLocation[] = apiaries
        .filter((apiary: Apiary) => apiary.latitude && apiary.longitude)
        .map((apiary: Apiary) => ({
          id: Number(apiary.id),
          name: `${apiary.name} (${apiary.number})`,
          lat: apiary.latitude!,
          lng: apiary.longitude!,
          latitude: apiary.latitude!,
          longitude: apiary.longitude!,
          createdAt: apiary.createdAt,
          isTemplate: false, // Mark as from apiary (note: this property might need to be added to your ApiaryLocation type)
          originalApiaryId: apiary.id // Note: this property might need to be added to your ApiaryLocation type
        }));

      // Remove duplicates based on coordinates (within 0.001 degree tolerance)
      const uniqueApiaryLocations = apiaryLocations.filter((loc: ApiaryLocation, index: number, arr: ApiaryLocation[]) => {
        return !arr.slice(0, index).some((existingLoc: ApiaryLocation) => 
          Math.abs(existingLoc.latitude - loc.latitude) < 0.001 &&
          Math.abs(existingLoc.longitude - loc.longitude) < 0.001
        );
      });

      // Also remove apiaries that are too close to existing templates
      const uniqueNewLocations = uniqueApiaryLocations.filter((apiaryLoc: ApiaryLocation) => {
        return !locations.some((templateLoc: ApiaryLocation) => 
          Math.abs(templateLoc.latitude - apiaryLoc.latitude) < 0.001 &&
          Math.abs(templateLoc.longitude - apiaryLoc.longitude) < 0.001
        );
      });

      locations = [...locations, ...uniqueNewLocations];
    }

    console.log('Final processed locations:', locations);
    setSavedApiaryLocations(locations);
    
  } catch (error) {
    console.error('Error fetching apiary locations:', error);
  }
};
// 4. Call fetchSavedApiaryLocations on component mount
useEffect(() => {
  fetchSavedApiaryLocations();
}, []);


  // Add state to track token balance
const [tokenBalance, setTokenBalance] = useState(0); // Start with 0
  const handleApiaryChange = (
  index: number,
  field: keyof typeof batchFormData.apiaries[number],
  value: string | number
) => {
  const updatedApiaries = [...batchFormData.apiaries];
  updatedApiaries[index] = {
    ...updatedApiaries[index],
    [field]: value
  };
  setBatchFormData({
    ...batchFormData,
    apiaries: updatedApiaries
  });
};

  
 useEffect(() => {
  // Function to fetch data from API
  

  const fetchData = async () => {
    setLoading(true);
    try {
      // Initialize with default values to prevent null reference errors
      const defaultData: AppData = {
  containers: [],
  labels: [],
  batches: [], // This should be BatchData[], not never[]
  jars: [], // Add the missing jars property
  tokenStats: {
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0,
    remainingTokens: 0,
    totalTokens: 0,
    usedTokens: 0 // Add missing usedTokens property
  },
  certifiedHoneyWeight: {
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0
  }
};

      let data: AppData = defaultData;
      
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authtoken') ||  localStorage.getItem('admin-token');
        
        if (token) {
          // Only attempt to fetch if a token exists
          const response = await fetch('/api/batches', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const fetchedData = await response.json();
            console.log('API response:', fetchedData);
            console.log('Batches received:', fetchedData.batches);
            // Merge with default data to ensure all properties exist
            data = {
              ...defaultData,
              ...fetchedData,
              tokenStats: {
                ...defaultData.tokenStats,
                ...(fetchedData.tokenStats || {})
              },
              certifiedHoneyWeight: {
                ...defaultData.certifiedHoneyWeight,
                ...(fetchedData.certifiedHoneyWeight || {})
              }
            };
          } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch data');
          }
        } else {
          console.log('No auth token found, using mock data');
          // Use mock data if no token exists - useful for development
          // You can add more mock data here if needed
          data = {
            ...defaultData,
            batches: allBatches // Make sure allBatches is properly typed as BatchData[]
          };
        }
      } catch (error) {
        console.error('Error fetching from API:', error);
        // Fallback to default data structure
      }

      // Ensure tokenStats and certifiedHoneyWeight exist
      data.tokenStats = data.tokenStats || defaultData.tokenStats;
      data.certifiedHoneyWeight = data.certifiedHoneyWeight || defaultData.certifiedHoneyWeight;

    const certifiedTotal = 
  data.certifiedHoneyWeight.originOnly +
  data.certifiedHoneyWeight.qualityOnly +
  data.certifiedHoneyWeight.bothCertifications;

const uncertifiedTotal = data.batches.reduce((sum: number, batch: any) => {
  return sum + (batch.uncertified ?? 0);
}, 0);

const totalHoney = certifiedTotal + uncertifiedTotal;

      

      setData(data);
      
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('Error in fetchData:', error);
      setNotification({
        show: true,
        message: `Error: ${(error as Error).message}`,
      });

      setTimeout(() => {
        setNotification({ show: false, message: '' });
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  fetchData();
  
  // Set up a refresh interval (optional)
  // const intervalId = setInterval(fetchData, 60000); // Refresh every minute
  // return () => clearInterval(intervalId); // Clean up on unmount 
}, []);  // Empty dependency array means this effect runs once on mount

// Define these functions outside of useEffect
const toggleSidebar = () => {
  setSidebarOpen(!sidebarOpen);
};

const refreshData = () => {
  setLoading(true);
  
  // Simulate a microservice API call with setTimeout
  setTimeout(() => {
    // In a real app, you would fetch data from your microservices here
    // Using fake data for demonstration purposes
    const updatedData = {
      ...data,
      jars: data.jars.map(jar => ({ 
        ...jar, 
        count: jar.count + Math.floor(Math.random() * 10) - 3
      })),
      batches: [
        { id: 'B1005', jarType: 'Plastic', labelType: 'Custom', quantity: 45, date: '2025-05-13' },
        ...data.batches.slice(0, 3)
      ]
    };
    
    setData(updatedData);
    setLoading(false);
    setLastUpdated(new Date().toLocaleString());
  }, 1000);
};



const handleBuyTokens = () => {
  // In a real app, this would connect to a payment processor
  // For demo purposes, we'll just update the token count
  const updatedTokenStats = {
    ...data.tokenStats,
    totalTokens: data.tokenStats.totalTokens + tokensToAdd,
    remainingTokens: data.tokenStats.remainingTokens + tokensToAdd
  };
  
  setData({
    ...data,
    tokenStats: updatedTokenStats
  });
  
  setShowBuyTokensModal(false);
};

 const createBatch = async () => {
  // Improved validation with proper array checking
  if (!batchNumber?.trim() || !Array.isArray(selectedApiaries) || selectedApiaries.length === 0) {
    setNotification({
      show: true,
      message: 'Please fill in batch number and select at least one apiary',
    });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
    return;
  }

  // FIXED: Check batchHoneyCollected instead of totalKg
  if (!batchHoneyCollected || batchHoneyCollected <= 0) {
    setNotification({
      show: true,
      message: 'Please enter the total honey collection amount',
    });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
    return;
  }

  setLoading(true);

  try {
    const token = localStorage.getItem("token") || localStorage.getItem('admin-token');
    if (!token) {
      throw new Error("No token found. Please log in again.");
    }

    // Generate batch name with timestamp if not provided
    const finalBatchName = batchName && batchName.trim()
      ? batchName.trim()
      : `${batchNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

    // Transform selected apiaries to match the expected format
    const apiariesForBatch = selectedApiaries.map(apiary => ({
      id: apiary.id,
      name: apiary.name,
      number: apiary.number,
      hiveCount: apiary.hiveCount || 0,
      kilosCollected: apiary.kilosCollected ?? 0,
      locationId: apiary.location?.id || null,
      location: apiary.location || null
    }));

    const formData = {
      batchNumber: batchNumber.trim(),
      batchName: finalBatchName,
      apiaries: apiariesForBatch,
      totalHives: selectedApiaries.reduce((sum, apiary) => sum + (apiary.hiveCount || 0), 0),
      // FIXED: Use batchHoneyCollected instead of totalKg
      totalKg: batchHoneyCollected,
      // ADDED: Store the batch total honey amount
      honeyCollected: batchHoneyCollected,
    };

    console.log('Creating batch with data:', formData);

    const response = await fetch('/api/create-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to create batch');
    }

    // Update data state with new batch (ensure data exists)
    if (data && data.batches) {
      setData({
        ...data,
        batches: [result.batch, ...data.batches],
        tokenStats: data.tokenStats,
      });
    }

    setNotification({
      show: true,
      message: `Batch ${batchNumber} created successfully with ${selectedApiaries.length} apiaries!`,
    });

    setTimeout(() => {
      setNotification({ show: false, message: '' });
    }, 5000);

    // Reset form data and close modal
    setBatchNumber('');
    setBatchName('');
    setSelectedApiaries([]);
    setSelectedDropdownApiary('');
    // FIXED: Reset batchHoneyCollected instead of totalKg
    setBatchHoneyCollected(0);
    setShowBatchModal(false);

  } catch (error) {
    console.error('Error creating batch:', error);
    setNotification({
      show: true,
      message: `Error: ${(error as Error).message}`,
    });

    setTimeout(() => {
      setNotification({ show: false, message: '' });
    }, 5000);
  } finally {
    setLoading(false);
  }
};



const [showAllBatches, setShowAllBatches] = useState(false);
const [expandedBatches, setExpandedBatches] = useState<string[]>([]);

// Function to toggle batch expansion
    const toggleBatchExpansion = (batchId: string) => {
      if (expandedBatches.includes(batchId)) {
        setExpandedBatches(expandedBatches.filter(id => id !== batchId));
      } else {
        setExpandedBatches([...expandedBatches, batchId]);
      }
    };
    


// Convert data.batches to an array if it isn't already
const batchesArray: IncomingBatchData[] = Array.isArray(data.batches) ? data.batches : [];

const allBatches: ProcessedBatch[] = batchesArray.map((batch: IncomingBatchData) => ({
  id: batch.batchId || '',
  name: batch.batchName || '',
  batchNumber: batch.batchId || undefined,
  status: batch.status || 'Pending',
  completedChecks: batch.completedChecks || 0,
  totalChecks: batch.totalChecks || 10,
  certificationDate: batch.certificationDate || undefined,
  expiryDate: batch.expiryDate || undefined, // Changed from undefined to null
  totalKg: batch.weight || 0,
  jarsUsed: batch.jarsUsed || 0,
  originOnly: batch.originOnly || 0,
  qualityOnly: batch.qualityOnly || 0,
  bothCertifications: batch.bothCertifications || 0,
  uncertified: batch.uncertified || 0,
  containerType: batch.containerType || '',
  labelType: batch.labelType || '',
  originOnlyPercent: 0,
  qualityOnlyPercent: 0,
  bothCertificationsPercent: 0,
  uncertifiedPercent: 0,
  
  // Missing properties
  weightKg: batch.weight || 0,
  totalHoneyCollected: batch.weight || 0,
  honeyCertified: (batch.originOnly || 0) + (batch.qualityOnly || 0) + (batch.bothCertifications || 0),
  honeyRemaining: Math.max(0, (batch.weight || 0) - (batch.jarsUsed || 0)),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

   // Fix the percentage calculations to properly handle edge cases
allBatches.forEach(batch => {
  const total = batch.originOnly + batch.qualityOnly + batch.bothCertifications + batch.uncertified;
  
  // Handle zero total case to avoid NaN
  if (total === 0) {
    batch.originOnlyPercent = 0;
    batch.qualityOnlyPercent = 0;
    batch.bothCertificationsPercent = 0;
    batch.uncertifiedPercent = 100; // Default to 100% uncertified if no data
  } else {
    // Calculate percentages and round to ensure they add up to 100%
    batch.originOnlyPercent = Math.round((batch.originOnly / total) * 100);
    batch.qualityOnlyPercent = Math.round((batch.qualityOnly / total) * 100);
    batch.bothCertificationsPercent = Math.round((batch.bothCertifications / total) * 100);
    
    // Calculate uncertified as remainder to ensure percentages sum to 100
    batch.uncertifiedPercent = 100 - (
      batch.originOnlyPercent + 
      batch.qualityOnlyPercent + 
      batch.bothCertificationsPercent
    );
    
    // Handle edge case where rounding made total > 100
    if (batch.uncertifiedPercent < 0) batch.uncertifiedPercent = 0;
  }
});
    const [searchTerm, setSearchTerm] = useState('');
    // Filter batches based on search term
    const filteredBatches = allBatches.filter(batch => 
      batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.status.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Determine which batches to display
    const displayedBatches = showAllBatches ? filteredBatches : filteredBatches.slice(0, 3);

    
  interface BatchData {
  batchName: string;
  batchId: string;
  category: string;
  weight: number;
  jars: number;
  containerType: string;
  labelType: string;
  stockLevel: string;
  location: string;
  lastUpdated: string;
}
  // Calculate totals
  const totalWeight = data.containers.reduce((sum, container) => sum + container.weight, 0);
  const totalLabels = data.labels.reduce((sum, label) => sum + label.count, 0);
  const totalBatches = data.batches.length;

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedCertification, setSelectedCertification] = useState(null);
  const [selectedItem, setSelectedItem] = useState<BatchData | null>(null);
  const [timeRange, setTimeRange] = useState('Monthly');
  const router = useRouter();

 useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const tokensAdded = parseInt(urlParams.get('tokensAdded') || '0');
  
  if (tokensAdded > 0) {
    setTokenBalance(prev => prev + tokensAdded);
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
useEffect(() => {
  const handleTokensUpdated = (event: Event) => {
    const customEvent = event as CustomEvent<{
      action: string;
      tokensAdded: number;
      newBalance: number;
    }>;

    const { action, tokensAdded, newBalance } = customEvent.detail;

    if (action === 'add') {
      setTokenBalance(newBalance);
    } else {
      setTokenBalance(prev => prev + tokensAdded);
    }
  };

  window.addEventListener('tokensUpdated', handleTokensUpdated);

  return () => {
    window.removeEventListener('tokensUpdated', handleTokensUpdated);
  };
}, []);
// In your main component's initialization
useEffect(() => {
  const savedBalance = parseInt(localStorage.getItem('tokenBalance') || '0');
  setTokenBalance(savedBalance);
}, []);

// Add this useEffect to load saved locations when component mounts
useEffect(() => {
  const loadSavedData = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem('admin-token');
      if (!token) {
        console.error("No token found. Please log in again.");
        return;
      }

      // Load saved locations
      const locationsResponse = await fetch('/api/apiaries/locations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (locationsResponse.ok) {
        const locations = await locationsResponse.json();
        setSavedApiaryLocations(locations);
      } else {
        console.error('Failed to load saved locations');
      }

      // Load available apiaries
      const apiariesResponse = await fetch('/api/apiaries', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (apiariesResponse.ok) {
        const apiaries = await apiariesResponse.json();
        setAvailableApiaries(apiaries);
      } else {
        console.error('Failed to load available apiaries');
      }

    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  loadSavedData();
}, []);

useEffect(() => {
  const initMaps = () => {
    if (window.google) {
      console.log('Initializing maps...');
      
      // Common map configuration
      const mapConfig = {
        center: { lat: 52.0907, lng: 5.1214 }, // Netherlands coordinates
        zoom: 8,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ],
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: window.google.maps.ControlPosition.TOP_CENTER,
        },
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        },
        scaleControl: true,
        streetViewControl: true,
        streetViewControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_TOP,
        },
        fullscreenControl: true
      };

      // Initialize main map for displaying apiary markers
      if (mapRef.current) {
        console.log('Initializing main map...');
        const map = new window.google.maps.Map(mapRef.current, mapConfig);
        googleMapRef.current = map;
        console.log('Main map initialized');

        // Add apiary markers to main map
        addApiaryMarkersToMap(map);
      } else {
        console.log('Main map ref not found');
      }

      // Initialize mini map with better timing and error handling
      const initMiniMap = (attempt = 1) => {
        console.log(`Mini map initialization attempt ${attempt}`);
        
        if (miniMapRef.current) {
          console.log('Mini map ref found, initializing...');
          
          try {
            const miniMapConfig = {
              ...mapConfig,
              zoom: 6, // Slightly different zoom for mini map
              zoomControl: false, // Custom zoom controls in overlay
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false
            };

            const miniMap = new window.google.maps.Map(miniMapRef.current, miniMapConfig);
            miniGoogleMapRef.current = miniMap;
            console.log('Mini map instance created successfully');
            
            // Force resize after a short delay to ensure proper rendering
            setTimeout(() => {
              console.log('Triggering mini map resize...');
              window.google.maps.event.trigger(miniMap, 'resize');
              miniMap.setCenter(mapConfig.center);
            }, 100);

            // Add click listener to mini map for apiary creation
            miniMap.addListener('click', (event: any) => {
              handleMiniMapClick(event);
            });
            
            console.log('Mini map initialization complete');
            
          } catch (error) {
            console.error('Error creating mini map:', error);
            
            
          }
        } else {
          console.log(`Mini map ref not found on attempt ${attempt}`);
          
          
        }
      };
      
      // Start mini map initialization with delay to ensure modal is rendered
      setTimeout(() => initMiniMap(), 200);
    }
  };

  // Function to add apiary markers to the main map
  // Function to add apiary markers to the main map
const addApiaryMarkersToMap = (map: any) => {
  // Clear existing markers
  if (apiaryMarkers.current && Array.isArray(apiaryMarkers.current)) {
    apiaryMarkers.current.forEach((marker: any) => marker.setMap(null));
  }
  apiaryMarkers.current = [];

  // Add markers for each apiary
  if (Array.isArray(availableApiaries) && availableApiaries.length > 0) {
    console.log('Adding apiary markers:', availableApiaries.length);
    
    availableApiaries.forEach((apiary, index) => {
      if (index < 3) { // Only log first 3 to avoid spam
        console.log('Full apiary object:', JSON.stringify(apiary, null, 2));
      }

      console.log('Processing apiary:', apiary.name, 'Latitude:', apiary.latitude, 'Longitude:', apiary.longitude);

      // Check if apiary has coordinates (either in nested location or directly on apiary)
      const hasNestedLocation = apiary.location && apiary.location.latitude && apiary.location.longitude;
      const hasDirectCoordinates = apiary.latitude && apiary.longitude;

      if (hasNestedLocation || hasDirectCoordinates) {
        // Get coordinates from the appropriate location
        const lat = hasNestedLocation 
          ? (typeof apiary.location.latitude === 'string' ? parseFloat(apiary.location.latitude) : apiary.location.latitude)
          : (typeof apiary.latitude === 'string' ? parseFloat(apiary.latitude) : apiary.latitude);
        
        const lng = hasNestedLocation 
          ? (typeof apiary.location.longitude === 'string' ? parseFloat(apiary.location.longitude) : apiary.location.longitude)
          : (typeof apiary.longitude === 'string' ? parseFloat(apiary.longitude) : apiary.longitude);
        
        console.log('Creating marker at:', { lat, lng });

        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: map,
          title: `${apiary.name} (${apiary.number})`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#FCD34D;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#F59E0B;stop-opacity:1" />
                  </linearGradient>
                </defs>
                <path d="M20 0C13.373 0 8 5.373 8 12c0 9 12 28 12 28s12-19 12-28c0-6.627-5.373-12-12-12z" fill="url(#grad)" stroke="#D97706" stroke-width="2"/>
                <circle cx="20" cy="12" r="6" fill="white"/>
                <text x="20" y="17" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="#F59E0B">🍯</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(40, 50),
            anchor: new window.google.maps.Point(20, 50)
          },
          animation: window.google.maps.Animation.DROP
        });

        // Add hover info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: bold;">
                ${apiary.name}
              </h3>
              <div style="color: #6b7280; font-size: 14px; line-height: 1.4;">
                <div><strong>ID:</strong> ${apiary.number}</div>
                <div><strong>Hives:</strong> ${apiary.hiveCount}</div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
                Click for more details
              </div>
            </div>
          `
        });

        // Add event listeners
        marker.addListener('click', () => {
          console.log('Apiary marker clicked:', apiary.name);
          // Create a normalized apiary object for the modal
          const normalizedApiary = {
            ...apiary,
            location: hasNestedLocation ? apiary.location : {
              latitude: lat,
              longitude: lng
            },
            honeyCollected: apiary.kilosCollected  || 0
          };
          setSelectedApiary(normalizedApiary);
        });

        // Show info window on hover
        marker.addListener('mouseover', () => {
          infoWindow.open(map, marker);
        });

        // Hide info window when mouse leaves
        marker.addListener('mouseout', () => {
          infoWindow.close();
        });

        // Store marker reference
        if (Array.isArray(apiaryMarkers.current)) {
          apiaryMarkers.current.push(marker);
        }
      } else {
        console.log('Apiary has no valid coordinates:', apiary.name);
      }
    });

    // Adjust map bounds to fit all markers if there are any
    if (apiaryMarkers.current && Array.isArray(apiaryMarkers.current) && apiaryMarkers.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      apiaryMarkers.current.forEach((marker: any) => {
        const position = marker.getPosition();
        if (position) {
          bounds.extend(position);
        }
      });
      
      if (apiaryMarkers.current.length === 1) {
        // If only one marker, center on it with a reasonable zoom
        const position = apiaryMarkers.current[0].getPosition();
        if (position) {
          map.setCenter(position);
          map.setZoom(15);
        }
      } else {
        // If multiple markers, fit bounds
        map.fitBounds(bounds);
        
        // Ensure minimum zoom level
        const listener = window.google.maps.event.addListener(map, 'bounds_changed', () => {
          if (map.getZoom() && map.getZoom() > 18) {
            map.setZoom(18);
          }
          window.google.maps.event.removeListener(listener);
        });
      }
    }
  } else {
    console.log('No apiaries to display on map');
  }
};

  // Helper function to handle mini map clicks for apiary creation
  const handleMiniMapClick = (event: any) => {
    const lat = event.latLng?.lat();
    const lng = event.latLng?.lng();
    
    if (!lat || !lng) return;
    
    console.log('Mini map clicked for apiary location:', { lat, lng });
    
    // Update the apiary form data with the selected location - FIXED TYPE ISSUE
    setApiaryFormData((prev) => ({
  ...prev,
  location: {
    lat: lat,
    lng: lng,
    latitude: lat,
    longitude: lng,
    name: `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    id: Date.now()
  }
}));
    // Add a temporary marker to show selected location
    if (tempMarker.current) {
      tempMarker.current.setMap(null);
    }
    
    if (miniGoogleMapRef.current) {
      tempMarker.current = new window.google.maps.Marker({
        position: { lat, lng },
        map: miniGoogleMapRef.current,
        title: 'Selected Apiary Location',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 0C9.477 0 5 4.477 5 10c0 7.5 10 25 10 25s10-17.5 10-25c0-5.523-4.477-10-10-10z" fill="#10B981" stroke="#059669" stroke-width="2"/>
              <circle cx="15" cy="10" r="4" fill="white"/>
              <text x="15" y="15" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#10B981">✓</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(30, 40),
          anchor: new window.google.maps.Point(15, 40)
        }
      });
    }
  };

  // Load Google Maps API if not already loaded
  if (!window.google) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.onload = initMaps;
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
    };
    document.head.appendChild(script);
  } else {
    initMaps();
  }

  // Cleanup function
  return () => {
    // Clean up any event listeners if needed
    if (googleMapRef.current) {
      window.google?.maps?.event?.clearInstanceListeners(googleMapRef.current);
    }
    if (miniGoogleMapRef.current) {
      window.google?.maps?.event?.clearInstanceListeners(miniGoogleMapRef.current);
    }
    
    // Clean up markers
    if (apiaryMarkers.current && Array.isArray(apiaryMarkers.current)) {
      apiaryMarkers.current.forEach((marker: any) => marker.setMap(null));
    }
    if (tempMarker.current) {
      tempMarker.current.setMap(null);
    }
  };
}, [showApiaryModal, availableApiaries]);





// Add these handler functions
const handleLocationConfirm = async (name: string | null = null) => {
  if (!selectedLocation) return;

  try {
    setIsSaving(true);
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('admin-token');
    
    if (!token) {
      setNotification({
        show: true,
        message: 'Authentication required. Please log in again.',
      });
      setTimeout(() => setNotification({ show: false, message: '' }), 3000);
      return;
    }

    // Create clean location data (avoid circular references)
    const locationData = {
      latitude: Number(selectedLocation.latitude),
      longitude: Number(selectedLocation.longitude),
      name: name || `Location ${new Date().toLocaleDateString()}`,
    };

    console.log('Sending location data:', locationData); // Debug log

     
    const response = await fetch('/api/apiaries/locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      
      body: JSON.stringify(locationData)
    });
    console.log('→ payload about to be stringified:', locationData);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Failed to save location' };
      }
      throw new Error(errorData.error || errorData.message || 'Failed to save location');
    }

    const newLocation = await response.json();
    console.log('Location saved successfully:', newLocation);
    
    // Create clean location object for state updates
    const cleanLocation = {
      id: newLocation.id,
      name: newLocation.name,
      latitude: Number(newLocation.latitude),
      longitude: Number(newLocation.longitude),
      lat: Number(newLocation.latitude),
      lng: Number(newLocation.longitude),
      createdAt: newLocation.createdAt
    };
    
    // Update the locations list
    setLocations(prev => [cleanLocation, ...prev]);
    setSavedApiaryLocations(prev => [cleanLocation, ...prev]);
    
    // If we're in the context of creating an apiary, set this as the selected location
    if (showApiaryModal) {
      setApiaryFormData(prev => ({
        ...prev,
        location: cleanLocation
      }));
    }
    
    // Close the confirmation dialog
    setShowLocationConfirm(false);
    setSelectedLocation(null);
    
    // Show success notification
    setNotification({
      show: true,
      message: 'Location saved successfully!',
    });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
    
  } catch (error) {
    console.error('Error saving location:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    setNotification({
      show: true,
      message: `Error saving location: ${errorMessage}`,
    });
    setTimeout(() => setNotification({ show: false, message: '' }), 5000);
  } finally {
    setIsSaving(false);
  }
};


const handleSelectExistingLocation = (location: ApiaryLocation) => {
  setApiaryFormData(prev => ({
    ...prev,
    location: {
      id: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      lat: location.latitude,
      lng: location.longitude
    }
  }));
  
  setNotification({
    show: true,
    message: `Location "${location.name}" selected for apiary`,
  });
  setTimeout(() => setNotification({ show: false, message: '' }), 2000);
};


useEffect(() => {
  // Initialize premium status from localStorage
  const storedPremium = localStorage.getItem('honeycertify_premium') === 'true';
  setUserPremiumStatus(storedPremium);
  
  // Listen for premium status changes
  const handlePremiumUpdate = () => {
    const updatedPremium = localStorage.getItem('honeycertify_premium') === 'true';
    setUserPremiumStatus(updatedPremium);
  };
  
  window.addEventListener('storage', handlePremiumUpdate);
  return () => window.removeEventListener('storage', handlePremiumUpdate);
}, []);


// Remove the unused saveApiaryLocation function
const handleLocationCancel = () => {
  setShowLocationConfirm(false);
  setSelectedLocation(null);
};

  return (
  <div className="flex flex-col space-y-6 p-6 min-h-screen bg-gradient-to-b from-yellow-200 to-white text-black">
    <Sidebar 
      sidebarOpen={sidebarOpen} 
      toggleSidebar={toggleSidebar}
      userPremiumStatus={user?.isPremium}
    />
    
    <Backdrop 
      sidebarOpen={sidebarOpen} 
      toggleSidebar={toggleSidebar} 
    />
    
    <Header 
  toggleSidebar={toggleSidebar}
  tokenBalance={tokenBalance || 0}
  router={router}
  setShowBatchModal={setShowBatchModal}
  handleLogout={handleLogout}
  isLoggingOut={isLoggingOut}
  lastUpdated={lastUpdated}
  batches={batches}           // Add this - array of batch data
  tokenStats={data.tokenStats}     // Add this - token statistics from database
/>
    
    <CreateBatchModal
      showBatchModal={showBatchModal}
      setShowBatchModal={setShowBatchModal}
      batchNumber={batchNumber}
      setBatchNumber={setBatchNumber}
      batchName={batchName}
      setBatchName={setBatchName}
      batchHoneyCollected={batchHoneyCollected}
      setBatchHoneyCollected={setBatchHoneyCollected}
      selectedApiaries={selectedApiaries}
      setSelectedApiaries={setSelectedApiaries}
      availableApiaries={availableApiaries}
      isLoadingApiaries={isLoadingApiaries}
      setShowApiaryModal={setShowApiaryModal}
      createBatch={createBatch}
      selectedDropdownApiary={selectedDropdownApiary}
      setSelectedDropdownApiary={setSelectedDropdownApiary}
      updateApiaryHiveCount={handleUpdateApiaryHiveCount}
    />
    
   <CreateApiaryModal
  showApiaryModal={showApiaryModal}
  setShowApiaryModal={setShowApiaryModal}
  apiaryFormData={apiaryFormData}
  setApiaryFormData={setApiaryFormData}
  savedApiaryLocations={savedApiaryLocations}
  setSavedApiaryLocations={setSavedApiaryLocations} // Add this missing prop
  mapsLinkInput={mapsLinkInput}
  setMapsLinkInput={setMapsLinkInput}
  handleMapsLinkSubmit={handleMapsLinkSubmit}
  miniMapRef={miniMapRef}
  miniGoogleMapRef={miniGoogleMapRef}
  saveApiaryToDatabase={saveApiaryToDatabase}
  refreshApiariesFromDatabase={refreshApiariesFromDatabase}
  isLoadingApiaries={isLoadingApiaries}
  setIsLoadingApiaries={setIsLoadingApiaries} // Add this missing prop
/>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TokenWalletSection 
        tokenStats={[data.tokenStats]}
        tokenBalance={tokenBalance}
        batches={batches} 
      />
      
      <ApiaryMapSection 
        mapRef={mapRef}
        selectedApiary={selectedApiary}
        setSelectedApiary={setSelectedApiary}
      />
    </div>
    
    <CertificationChart 
      filteredBatches={filteredBatches}
      timeRange={timeRange}
      setTimeRange={setTimeRange}
    />
    
    <BatchStatusSection
      filteredBatches={filteredBatches}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      showAllBatches={showAllBatches}
      setShowAllBatches={setShowAllBatches}
      expandedBatches={expandedBatches}
      toggleBatchExpansion={toggleBatchExpansion}
      selectedItem={selectedItem}
      setSelectedItem={setSelectedItem}
    />
    
    <BuyTokensModal
      showBuyTokensModal={showBuyTokensModal}
      setShowBuyTokensModal={setShowBuyTokensModal}
      tokensToAdd={tokensToAdd}
      setTokensToAdd={setTokensToAdd}
      handleBuyTokens={handleBuyTokens}
    />
    
    <FloatingActionMenu
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      setShowBatchModal={setShowBatchModal}
      setShowApiaryModal={setShowApiaryModal}
    />
    
    {notification.show && (
  <Notification 
    notification={notification} 
    setNotification={setNotification} 
  />
)}
  </div>
);
  };


