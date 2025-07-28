'use client'

import React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Check, AlertCircle, Loader, XCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
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
import DeleteConfirmationDialog from '@/components/DeleteConfirmationDialog';
import FiltersAndSearch from '@/components/FiltersAndSearch';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import BatchTableSection from '@/components/sections/BatchTableSection';
import TokenStatistics from '@/components/TokenStatistics';
import PrintNotification from '@/components/PrintNotification';
import CompleteBatchForm from '@/components/CompleteBatchForm';
import ProfileNotification from '@/components/ProfileNotification';
import ProfileSuccessMessage from '@/components/ProfileSuccessMessage';
import SuccessPopup from '@/components/SuccessPopup';
import ProfileForm from '@/components/ProfileForm';
import Header1 from '@/components/Header1';


// Remove duplicate interfaces and consolidate your types
// Make sure you only have ONE definition of each interface

interface Location {
  id: string;
  name?: string;
  address?: string;
  latitude: number;
  longitude: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  // ... other location-related properties
}

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

interface ApiaryLocation extends LocationCoordinates {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
}

interface Apiary {
  id: string;
  batchId: string;
  batchNumber: string;
  name: string;
  number: number; // Keep as number since this seems to be the main definition
  hiveCount: number;
  latitude: number;
  longitude: number;
  honeyCollected: number;
  kilosCollected: number;
  location?: Location | null;
  honeyCertified?: number;
}

interface FormApiary extends Apiary {
  batchId: string;
  batchNumber: string;
  honeyCertified: number;
}

interface CertificationStatus {
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
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

interface TokenStats {
  totalTokens: number;
  remainingTokens: number;
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
}

interface CustomJar {
  id: number;
  size: number;
  quantity: number;
  apiaryIndex?: number;
}

interface JarCertification {
  origin?: boolean;
  quality?: boolean;
  both?: boolean;
  selectedType?: 'origin' | 'quality' | 'both';
}

interface JarDefinition {
  id: string | number;
  size: number;
  quantity: number;
  unit?: string;
}

interface User {
  passportId?: string;
  passportFile?: string;
  id?: string;
  name?: string;
  email?: string;
  isProfileComplete: boolean;
}

interface JarCertifications {
  [key: number]: JarCertification;
}

interface SelectedApiary extends Apiary {
  kilosCollected: number; // Override to ensure this is always present
}

interface ApiaryFormData {
  name: string;
  number: string;
  hiveCount: number;
  honeyCollected: number;
  location: ApiaryLocation | null;
}

// Global declarations
declare global {
  interface Window {
    [key: `apiariesMap_${number}`]: google.maps.Map;
    [key: `apiariesMarker_${number}`]: google.maps.Marker;
  }
}

type MapRef = {
  map: google.maps.Map;
  marker: google.maps.Marker;
};



export default function BatchesPage() {
  // State management
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showPrintNotification, setShowPrintNotification] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [lastUpdated, setLastUpdated] = useState('--');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [showProfileNotification, setShowProfileNotification] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [apiaryHoneyValues, setApiaryHoneyValues] = useState<Record<string, number>>({});
  const [showProfileCompletedMessage, setShowProfileCompletedMessage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ production: 0, lab: 0 });
  const [loading, setLoading] = useState(false);
  const [savedApiaryLocations, setSavedApiaryLocations] = useState<ApiaryLocation[]>([]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const miniMapRef = useRef<HTMLDivElement | null>(null); 
   const googleMapRef = useRef<google.maps.Map | null>(null);
  const miniGoogleMapRef = useRef<google.maps.Map | null>(null);
  const apiaryMarkers = useRef<google.maps.Marker[]>([]);
  const tempMarker = useRef<google.maps.Marker | null>(null);
  const [data, setData] = useState({
  tokenStats: {
    originOnly: 0,
    qualityOnly: 0
  }
});
const [isSubmitting, setIsSubmitting] = useState(false);
const [customJarSize, setCustomJarSize] = useState('');
 
 const [user, setUser] = useState<User | null>(null);


  const [showBatchModal, setShowBatchModal] = useState(false);
const [selectedApiaries, setSelectedApiaries] = useState<SelectedApiary[]>([]); // Selected apiaries for current batch
const [isLoadingApiaries, setIsLoadingApiaries] = useState(false);
 const [availableApiaries, setAvailableApiaries] = useState<Apiary[]>([]); // List of all created apiaries
const [selectedApiary, setSelectedApiary] = useState<Apiary | null>(null);
const [isOpen, setIsOpen] = useState(false);
const [batchNumber, setBatchNumber] = useState('');
const [batchName, setBatchName] = useState(''); // Added batch name field
const [selectedDropdownApiary, setSelectedDropdownApiary] = useState('');
const [showApiaryModal, setShowApiaryModal] = useState(false);
const [apiaryFormData, setApiaryFormData] = useState<ApiaryFormData>({
  name: '',
  number: '',
  hiveCount: 0,
  honeyCollected: 0,
  location: null
});
const [batchHoneyCollected, setBatchHoneyCollected] = useState(0);
 // Jar size management states
const [showJarSizeManager, setShowJarSizeManager] = useState<boolean>(false);
const [predefinedJarSizes, setPredefinedJarSizes] = useState<number[]>([250, 500, 1000]); // Default jar sizes
const [newJarSize, setNewJarSize] = useState<string>('');
// Add a new jar size to predefined sizes
const addNewJarSize = () => {
  if (newJarSize && typeof newJarSize === 'number' && !predefinedJarSizes.includes(newJarSize)) {
    setPredefinedJarSizes([...predefinedJarSizes, newJarSize].sort((a, b) => a - b));
    setNewJarSize('');
  }
};

const VERIFICATION_API_URL = 'https://qualityapi.onrender.com';
 const [qualityVerification, setQualityVerification] = useState({
    isVerifying: false,
    isVerified: false,
    result: undefined,
    error: undefined
  });

  // Quality Report Verification Function
  const verifyQualityReport = async (file: File) => {
    if (!file) return;

    setQualityVerification({
      isVerifying: true,
      isVerified: false,
      result: undefined,
      error: undefined
    });

    try {
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch(`${VERIFICATION_API_URL}/verify_document`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const result = data.results?.[0];

      if (!result) {
        throw new Error('No verification result received from API');
      }

      const isVerified = result.status === 'passed';

      setQualityVerification({
        isVerifying: false,
        isVerified,
        result,
        error: isVerified ? undefined : (result.error || 'Document verification failed')
      });

    } catch (error) {
      console.error('Quality verification error:', error);
      setQualityVerification({
        isVerifying: false,
        isVerified: false,
        result: undefined,
        error: (error instanceof Error ? error.message : 'Failed to verify quality report') as any
      });
    }
  };

  // Enhanced lab report file change handler
  const handleLabReportChange = async (file: File | null) => {
    setFormData({
      ...formData, 
      labReport: file
    });

    // Reset verification state when file changes
    setQualityVerification({
      isVerifying: false,
      isVerified: false,
      result: undefined,
      error: undefined
    });

    // Auto-verify if quality certification is needed and file is uploaded
    if (file && needsLabReport()) {
      await verifyQualityReport(file);
    }
  };
  const [userPremiumStatus, setUserPremiumStatus] = useState(false);


// Remove a jar size from predefined sizes
const removeJarSize = (size: number) => {
  setPredefinedJarSizes(predefinedJarSizes.filter(s => s !== size));
  
  // Also remove any jars using this size from all apiaries
  const updatedApiaryJars = { ...apiaryJars };
  Object.keys(updatedApiaryJars).forEach(apiaryIndex => {
    updatedApiaryJars[parseInt(apiaryIndex)] = updatedApiaryJars[parseInt(apiaryIndex)].filter(jar => jar.size !== size);
  });
  setApiaryJars(updatedApiaryJars);
};


const getMaxQuantity = () => {
  if (!newJarSize) return 0;
  
  const sizeInGrams = convertToGrams(newJarSize, newJarUnit);
  const sizeInKg = sizeInGrams / 1000;
  
  // Calculate remaining honey available for allocation (not yet allocated to jars)
  const remainingHoneyAvailable = getTotalRemainingHoneyFromBatch() - getAllocatedHoneyFromJars();
  
  if (remainingHoneyAvailable <= 0) return 0;
  
  // Maximum jars we can create with remaining honey
  const maxByHoney = Math.floor(remainingHoneyAvailable / sizeInKg);
  
  // Maximum jars we can afford with current tokens
  const currentJarCount = batchJars.reduce((sum, jar) => sum + jar.quantity, 0);
  const maxByTokens = tokenBalance - currentJarCount;
  
  return Math.min(maxByHoney, Math.max(0, maxByTokens));
};

  // Add these new state variables at the top of your component
const [showSuccessPopup, setShowSuccessPopup] = useState(false);
const [certificationData, setCertificationData] = useState<any>(null);const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

// Function to generate QR code data URL
 // Function to generate QR code using the qrcode library
 const generateQRCode = async (data: any) => {
  try {
    // Create URL parameters from certification data
    const urlParams = new URLSearchParams({
      batchIds: data.batchIds.join(','),
      certificationDate: data.certificationDate,
      totalCertified: data.totalCertified,
      certificationType: data.certificationType,
      expiryDate: data.expiryDate,
      verification: data.verification,
      totalJars: data.totalJars
    });
    
    // Create the certification verification URL
    // Replace 'your-domain.com' with your actual domain
const certificationUrl = `${process.env.REACT_APP_BASE_URL}/cert/${data.verification}`;    
    // Alternative shorter URL approach using verification code only:
    // const certificationUrl = `https://your-domain.com/cert/${data.verification}`;
    
    const qrDataUrl = await QRCode.toDataURL(certificationUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
};

  // Function to download QR code
  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.download = `honey-certification-${Date.now()}.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const mapRefs = useRef<MapRef[]>([]);
  const mapsLoaded = useRef(false);
  const googleMapsApiKey = "AIzaSyBhRpOpnKWIXGMOTsdVoGKAnAC94Q0Sgxc"; 
  type SortableKey = 'batchNumber' | 'name' | 'status' | 'totalKg' | 'createdAt';
const [certificationAmounts, setCertificationAmounts] = useState({
  origin: 0,
  quality: 0,
  both: 0
});
const [jarSizeDistribution, setJarSizeDistribution] = useState({
  jar250g: 0,
  jar400g: 0,
  jar600g: 0
});


const isFormValid = () => {

   const hasJars = batchJars.length > 0;
    const hasCertifications = hasRequiredCertifications();
    const hasValidTokens = tokenBalance >= batchJars.reduce((sum, jar) => sum + jar.quantity, 0);
    
    // Document requirements
    const needsProduction = needsProductionReport();
    const needsLab = needsLabReport();
    const hasProductionReport = !needsProduction || formData.productionReport;
    const hasLabReport = !needsLab || formData.labReport;
    
    // Quality verification requirement
    const qualityVerificationPassed = !needsLab || 
      (formData.labReport && qualityVerification.isVerified && !qualityVerification.isVerifying);

   
  // Check if there are any jars defined
  if (batchJars.length === 0) return false;
  
  // Check if all jars have certifications selected
  const allJarsHaveCertifications = batchJars.every(jar => {
    const cert = jarCertifications[jar.id];
    return cert && (cert.origin || cert.quality);
  });
  
  if (!allJarsHaveCertifications) return false;
  
  // Check if required documents are uploaded
  if (needsProductionReport() && !formData.productionReport) return false;
  if (needsLabReport() && !formData.labReport) return false;
  
  // Check if we have enough tokens
  const totalJarsNeeded = batchJars.reduce((sum, jar) => sum + jar.quantity, 0);
  if (tokenBalance < totalJarsNeeded) return false;
  
  // Check if jar allocation doesn't exceed remaining honey
  const allocatedHoney = getAllocatedHoneyFromJars();
  const remainingHoney = getTotalRemainingHoneyFromBatch();
  
  if (allocatedHoney > remainingHoney) return false;
  
   return true;
           
};

// Add this function to your component or create a separate utility file

const storeCertificationData = async (certData: any, userData: any) => {
  try {
    const token = localStorage.getItem('authtoken') ||
                  localStorage.getItem('auth_token') ||
                  localStorage.getItem('token') ||
                  sessionStorage.getItem('authtoken') ||
                  sessionStorage.getItem('auth_token') ||
                  sessionStorage.getItem('token');

    if (!token) {
      throw new Error('No auth token found');
    }

    const certificationPayload = {
      verificationCode: certData.verification,
      batchIds: certData.batchIds.join(','), // Store as comma-separated string
      certificationDate: certData.certificationDate,
      totalCertified: parseFloat(certData.totalCertified),
      certificationType: certData.certificationType,
      expiryDate: certData.expiryDate,
      totalJars: certData.totalJars,
      companyName: userData.companyName || null,
      beekeeperName: userData.name || `${userData.firstname} ${userData.lastname}` || null,
      location: userData.location || null,
      userId: userData.id
    };

    const response = await fetch('/api/certification/store', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(certificationPayload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Failed to store certification data');
    }

    const result = await response.json();
    console.log('Certification stored successfully:', result);
    return result;

  } catch (error) {
    console.error('Error storing certification:', error);
    throw error;
  }
};




const createBatch = async () => {
  if (!batchNumber?.trim() || !Array.isArray(selectedApiaries) || selectedApiaries.length === 0) {
    setNotification({
      show: true,
      message: 'Please fill in batch number and select at least one apiary',
    });
    setTimeout(() => setNotification({ show: false, message: '' }), 3000);
    return;
  }

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
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token found. Please log in again.");
    }

    // Generate batch name with timestamp if not provided
    const finalBatchName = batchName && batchName.trim()
      ? batchName.trim()
      : `${batchNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

    // Transform selected apiaries
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
      totalKg: batchHoneyCollected,
      honeyCollected: batchHoneyCollected,
    };

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

    // UPDATE BATCHES STATE DIRECTLY
    setBatches(prev => [result.batch, ...prev]);

    setNotification({
      show: true,
      message: `Batch ${batchNumber} created successfully!`,
    });

    // Reset form
    setBatchNumber('');
    setBatchName('');
    setSelectedApiaries([]);
    setBatchHoneyCollected(0);
    setShowBatchModal(false);

  } catch (error) {
    console.error('Error creating batch:', error);
    setNotification({
      show: true,
      message: `Error: ${(error as Error).message}`,
    });
  } finally {
    setLoading(false);
  }
};


const isAllHoneyAllocated = () => {
  const remainingHoney = getTotalRemainingHoneyFromBatch();
  const allocatedHoney = getAllocatedHoneyFromJars();
  
  // Consider fully allocated if difference is less than 0.01 kg (10g)
  return Math.abs(remainingHoney - allocatedHoney) < 0.01;
};


// 2. Add helper function to check remaining honey for specific apiary
const getRemainingHoneyForApiary = (apiaryIndex: number) => {
  const apiary = formData.apiaries[apiaryIndex];
  const jarsForApiary = getJarsForApiary(apiaryIndex);
  const allocatedHoney = jarsForApiary.reduce((sum, jar) => sum + (jar.size * jar.quantity / 1000), 0);
  return apiary.kilosCollected - allocatedHoney;
};

const isApiaryFullyAllocated = (apiaryIndex: number) => {
  return Math.abs(getRemainingHoneyForApiary(apiaryIndex)) < 0.001;
};


const calculateTotalHoneyToCertify = (amounts : any) => {
  const { origin, quality, both } = amounts;
  // The total honey to certify is the sum of all amounts
  // Note: 'both' means honey that gets both certifications, but it's still the same physical honey
  return origin + quality + both;
};

// Add this helper function to calculate maximum jars possible for each size
const calculateMaxJarsForSize = (totalHoneyToCertify: any, jarSize: any) => {
  return Math.floor(totalHoneyToCertify / jarSize);
};
  const calculateTokensNeeded = (amounts: any, jarSizes: any) => {
  const { origin, quality, both } = amounts;
  const { jar250g, jar400g, jar600g } = jarSizes;
  // Calculate total honey that will be certified
  const totalHoneyToCertify = calculateTotalHoneyToCertify(amounts);
  
  // Calculate total weight to be certified
  const totalWeight = origin + quality + both;
  
  // Calculate jars for each size (1 token per jar regardless of size)
  const totalJars = jar250g + jar400g + jar600g;
  
  
  // Check if jar sizes match the certification amounts
  const totalJarWeight = (jar250g * 0.25) + (jar400g * 0.4) + (jar600g * 0.6);

  // Calculate maximum possible jars for each size
  const maxJar250g = Math.floor(totalHoneyToCertify / 0.25);
  const maxJar400g = Math.floor(totalHoneyToCertify / 0.4);
  const maxJar600g = Math.floor(totalHoneyToCertify / 0.6);
  
  // Check if jar quantities exceed maximum possible
  const jar250gExceeded = jar250g > maxJar250g;
  const jar400gExceeded = jar400g > maxJar400g;
  const jar600gExceeded = jar600g > maxJar600g;

  return {
    tokensNeeded: totalJars,
    totalHoneyToCertify: totalHoneyToCertify,
    totalJarWeight: totalJarWeight,
    isValid: Math.abs(totalJarWeight - totalHoneyToCertify) < 0.01, // Allow small floating point differences
    maxJar250g,
    maxJar400g,
    maxJar600g,
    jar250gExceeded,
    jar400gExceeded,
    jar600gExceeded,
    hasExceededJars: jar250gExceeded || jar400gExceeded || jar600gExceeded
  };
};
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  // Add jar to batch
const addJarToBatch = (sizeInGrams: any, quantity: any) => {
  if (!sizeInGrams || !quantity) return;
  
  const sizeInKg = sizeInGrams / 1000;
  const totalWeightToAdd = sizeInKg * quantity;
  
  // Check if this would exceed remaining honey
  const currentAllocated = getAllocatedHoneyFromJars();
  const remainingHoney = getTotalRemainingHoneyFromBatch();
  
  if (currentAllocated + totalWeightToAdd > remainingHoney) {
    // Calculate maximum quantity we can actually add
    const availableHoney = remainingHoney - currentAllocated;
    const maxQuantity = Math.floor(availableHoney / sizeInKg);
    
    if (maxQuantity <= 0) {
      alert(`Cannot add jars: No remaining honey available for certification.\nRemaining: ${availableHoney.toFixed(2)} kg`);
      return;
    }
    
    alert(`Cannot add ${quantity} jars of ${sizeInGrams}g each.\nThis would require ${totalWeightToAdd.toFixed(2)} kg, but only ${availableHoney.toFixed(2)} kg is available.\nMaximum jars you can add: ${maxQuantity}`);
    return;
  }
  
  // Check token limit
  const totalTokensNeeded = getTotalJarsAcrossApiaries() + quantity;
  if (totalTokensNeeded > tokenBalance) {
    alert(`Insufficient tokens. You need ${totalTokensNeeded} tokens but only have ${tokenBalance}.`);
    return;
  }
  
  // Add the jar
  const newJar = {
    id: Date.now() + Math.random(),
    size: sizeInGrams,
    quantity: quantity
  };
  
  setBatchJars([...batchJars, newJar]);
  
  // Reset form
  setNewJarSize('');
  setNewJarQuantity(1);
};


// Remove jar from batch
const removeJarFromBatch = (jarId: any) => {
  setBatchJars(batchJars.filter(jar => jar.id !== jarId));
};





  const [sortBy, setSortBy] = useState<SortableKey>('batchNumber');
  

  const [profileData, setProfileData] = useState({
    passportId: '',
    passportScan: null
  });
  const [isLoading, setIsLoading] = useState(true);
  // allow error to be a string or null
const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [tokenStats, setTokenStats] = useState({
    totalTokens: 0,
    remainingTokens: 0,
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0
  });
  // Fixed initial state - use null instead of 0 for coordinates
const [formData, setFormData] = useState({
  certificationType: '',
  productionReport: null as File | null,
  labReport: null as File | null,
  apiaries: [{
    batchId: '',
    batchNumber: '',
    name: '',
    number: '',
    hiveCount: 0,
    latitude: null as number | null,  // Changed from 0 to null
    longitude: null as number | null, // Changed from 0 to null
    kilosCollected: 0,
    honeyCertified: 0
  }]
});
const [mapsLinkInput, setMapsLinkInput] = useState('');

// Function to extract coordinates from Google Maps links or coordinate strings
const extractCoordinatesFromMapsLink = async (input: any) => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();

  // Check if it's a shortened URL (goo.gl, maps.app.goo.gl, etc.)
  if (trimmedInput.match(/^https?:\/\/(goo\.gl|maps\.app\.goo\.gl|g\.co)/i)) {
    return 'SHORTENED_URL';
  }

  // Try to extract coordinates directly from input (latitude, longitude format)
  const coordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  const spaceCoordRegex = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s+[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  
  // Check for comma-separated coordinates
  if (coordRegex.test(trimmedInput)) {
    const [lat, lng] = trimmedInput.split(',').map(coord => parseFloat(coord.trim()));
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Check for space-separated coordinates
  if (spaceCoordRegex.test(trimmedInput)) {
    const coords = trimmedInput.split(/\s+/).map(coord => parseFloat(coord.trim()));
    if (coords.length === 2) {
      const [lat, lng] = coords;
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }

  // Check if it's a Google Maps URL
  if (!trimmedInput.startsWith('http')) {
    return null;
  }

  try {
    const url = new URL(trimmedInput);
    
    // Method 1: Check for @coordinates in the URL
    const atMatch = url.href.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Method 2: Check URL parameters
    const searchParams = url.searchParams;
    
    // Check for ll parameter (latitude,longitude)
    const ll = searchParams.get('ll');
    if (ll) {
      const [lat, lng] = ll.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Check for center parameter
    const center = searchParams.get('center');
    if (center) {
      const [lat, lng] = center.split(',').map(coord => parseFloat(coord.trim()));
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Method 3: Check for coordinates in the pathname
    const pathMatch = url.pathname.match(/\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (pathMatch) {
      const lat = parseFloat(pathMatch[1]);
      const lng = parseFloat(pathMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    // Method 4: Check for query parameter coordinates
    const q = searchParams.get('q');
    if (q) {
      const qCoordMatch = q.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (qCoordMatch) {
        const lat = parseFloat(qCoordMatch[1]);
        const lng = parseFloat(qCoordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }

    // Method 5: Check for destination parameter
    const destination = searchParams.get('destination');
    if (destination) {
      const destCoordMatch = destination.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (destCoordMatch) {
        const lat = parseFloat(destCoordMatch[1]);
        const lng = parseFloat(destCoordMatch[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error parsing URL:', error);
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
      //Handle shortened URLs with special instructions
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
  
 const getRemainingHoneyForBatch = (batch: any) => {
  if (!batch) return 0;
  
  // Use the original amount as the base, not the current totalHoneyCollected
  const originalAmount = batch.originalHoneyCollected || batch.totalHoneyCollected || batch.weightKg || 0 ;
  
  // Get the total amount that has been certified across all sessions
  const totalCertified = batch.totalHoneyCertified || 0;
  
  // Calculate remaining honey
  const remaining = Math.max(0, originalAmount - totalCertified);
  
  return remaining;
};


// Updated function to get total remaining honey from all selected batches
const getTotalRemainingHoneyFromBatch = () => {
  return selectedBatches.reduce((total, batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return total;
    
    // Get remaining honey for this batch (original - already certified)
    const remainingHoney = getRemainingHoneyForBatch(batch);
    return total + remainingHoney;
  }, 0);
};

const getTotalHoneyFromBatch = () => {
  return selectedBatches.reduce((total, batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return total;
    
    const originalHoney = batch.weightKg || batch.totalHoneyCollected || 0;
    return total + originalHoney;
  }, 0);
};

const [batchJars, setBatchJars] = useState<JarDefinition[]>([]);
const [newJarQuantity, setNewJarQuantity] = useState<number>(1);
const [newJarUnit, setNewJarUnit] = useState<string>('g');


// Helper function to get total allocated honey from jars
const getAllocatedHoneyFromJars = () => {
  return batchJars.reduce((total, jar) => {
    return total + (jar.size * jar.quantity) / 1000; // Convert grams to kg
  }, 0);
};
// Helper function to convert jar size to grams
const convertToGrams = (size: string, unit: string): number => {
  const numValue = parseFloat(size);
  if (isNaN(numValue) || numValue <= 0) return 0;
  return unit === 'lbs' ? Math.round(numValue * 453.592) : Math.round(numValue);
};



// Add this useEffect after where you define the showCompleteForm state
useEffect(() => {
  if (showCompleteForm && selectedBatches.length > 0) {
    // Handle both single and multiple batch selections
    const allApiaries = selectedBatches.flatMap(batchId => {
      const selectedBatch = batches.find(b => b.id === batchId);
      
      if (selectedBatch && selectedBatch.apiaries && selectedBatch.apiaries.length > 0) {
        return selectedBatch.apiaries.map(apiary => ({
          batchId: apiary.batchId,
          batchNumber: apiary.batchNumber,
          name: apiary.name,
          number: apiary.number,
          hiveCount: apiary.hiveCount,
          kilosCollected: apiary.kilosCollected || 0,
          latitude: apiary.latitude ?? null,    // Allow null values
          longitude: apiary.longitude ?? null,  // Allow null values
          honeyCertified: apiary.honeyCertified ?? 0  // Add this property
        }));
      }
      return [];
    });
    
   if (allApiaries.length > 0) {
  setFormData(prevState => ({
    ...prevState,
    apiaries: allApiaries.map(apiary => ({
      batchId: apiary.batchId || '',
      batchNumber: apiary.batchNumber || '',
      name: apiary.name,
      number: apiary.number.toString(), // Convert number to string if form expects string
      hiveCount: apiary.hiveCount,
      latitude: apiary.latitude || null,
      longitude: apiary.longitude || null,
      kilosCollected: apiary.kilosCollected || 0,
      honeyCertified: apiary.honeyCertified || 0,
    }))
  }));
}
  }
}, [showCompleteForm, selectedBatches, batches]);
  


  // Fetch batches from API
useEffect(() => {
  const token = localStorage.getItem('authtoken') || 
                localStorage.getItem('auth_token') || 
                localStorage.getItem('token') ||
                sessionStorage.getItem('authtoken') ||
                sessionStorage.getItem('auth_token') ||
                sessionStorage.getItem('token');
  
  console.log('[BatchesPage] Token from storage:', token ? 'Found token' : 'No token found');

  if (!token) {
    console.warn('[BatchesPage] No auth token found. User probably needs to login.');
    setIsLoading(false);
    setError('No authentication token found. Please log in.');
    // For demo/testing purposes, you can set a mock token
    // localStorage.setItem('authtoken', 'mock_token_for_testing');
    return;
  }
  const fetchBatches = async () => {
    try {
      setIsLoading(true);

      // Make sure we're using the correct API endpoint
      const response = await fetch('/api/batches', {  // Changed from '/api/create-batch' to '/api/batches'
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('[BatchesPage] Fetch response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BatchesPage] Fetch failed:', errorText);
        throw new Error(`Failed to fetch batches (${response.status}): ${errorText || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('[BatchesPage] Fetched batches data:', data);

      // Set the batches data properly
      setBatches(Array.isArray(data.batches) ? data.batches : []);
      
      // If token stats are available, update them too
      if (data.tokenStats) {
        setTokenStats(data.tokenStats);
      }

      setIsLoading(false);
      
      // Update last updated timestamp
      const now = new Date();
      setLastUpdated(now.toLocaleDateString() + ' ' + now.toLocaleTimeString());
    } catch (err: any) {
      console.error('[BatchesPage] Error fetching batches:', err);
      setError(err.message || 'Unknown error');
      setIsLoading(false);
    }
  };

  fetchBatches();
}, []);


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

  




useEffect(() => {
  if (selectedBatches.length > 0 && showCompleteForm) {
    // Collect all apiaries from selected batches
    const selectedBatchObjects = batches.filter(batch => selectedBatches.includes(batch.id));
    const existingApiaries: FormApiary[] = [];
    
    // Get existing apiaries from the selected batches
    selectedBatchObjects.forEach(batch => {
      if (batch.apiaries && batch.apiaries.length > 0) {
        batch.apiaries.forEach(apiary => {
          existingApiaries.push({
            ...apiary,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            latitude: apiary.latitude ?? null,        // Ensure null instead of undefined
            longitude: apiary.longitude ?? null,      // Ensure null instead of undefined
            honeyCertified: apiary.honeyCertified ?? 0 // Ensure number instead of undefined
          });
        });
      }
    });
    
    // If no existing apiaries, initialize with empty form
    if (existingApiaries.length === 0) {
      setFormData({
        certificationType: '',
        productionReport: null as File | null,
        labReport: null as File | null,
        apiaries: [{
          batchId: '',
          batchNumber: '',
          name: '',
          number: '',
          hiveCount: 0,
          kilosCollected: 0,
          latitude: null,
          longitude: null,
          honeyCertified: 0
        }]
      });
    } else {
      // Use existing apiaries
      setFormData({
  certificationType: '',
  productionReport: null as File | null,
  labReport: null as File | null,
  apiaries: existingApiaries.map(apiary => ({
    batchId: apiary.batchId || '',
    batchNumber: apiary.batchNumber || '',
    name: apiary.name,
    number: apiary.number.toString(), // Convert number to string
    hiveCount: apiary.hiveCount,
    latitude: apiary.latitude || null,
    longitude: apiary.longitude || null,
    kilosCollected: apiary.kilosCollected || 0,
    honeyCertified: apiary.honeyCertified || 0,
  }))
});
    }
  }
}, [selectedBatches, showCompleteForm, batches]);
  
  // Handle profile form changes

  const handleProfileChange = (
  field: 'batchNumber' | 'name' | 'number' | 'hiveCount' | 'latitude' | 'longitude' | 'kilosCollected' | 'passportScan' | 'passportId', 
  value: string | File | number | null
) => {
  setProfileData({
    ...profileData,
    [field]: value
  });
};

// Handle file upload
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files![0];
  if (file) {
    // Validate file type and size
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or PDF file.');
      e.target.value = ''; // Clear the input
      return;
    }
    
    if (file.size > maxSize) {
      alert('File size must be less than 10MB.');
      e.target.value = ''; // Clear the input
      return;
    }
    
    handleProfileChange('passportScan', file);
  }
};

// Handle profile completion form submission
const handleProfileSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate required fields
  if (!profileData.passportId.trim()) {
    alert('Please enter your Passport ID.');
    return;
  }
  
  try {
    setIsSubmitting(true);
    
    // Get JWT token from localStorage (adjust the key name if different)
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('accessToken');
    
    if (!token) {
      alert('Authentication token not found. Please log in again.');
      return;
    }
    
    // Create FormData object to handle file upload
    const formData = new FormData();
    formData.append('passportId', profileData.passportId.trim());
    
    if (profileData.passportScan) {
      formData.append('passportScan', profileData.passportScan);
    }
    
    const response = await fetch('/api/user/profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Close profile form and show success message
      setShowProfileForm(false);
      setShowProfileCompletedMessage(true);
      
      // Reset form data
      setProfileData({
        passportId: '',
        passportScan: null
      });
      
      console.log('Profile updated successfully:', result);
    } else {
      // Handle error
      console.error('Profile update failed:', result.error);
      alert('Failed to update profile: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error submitting profile:', error);
    alert('An error occurred while updating your profile. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
  // 3. Function to fetch saved apiary locations
  const fetchSavedApiaryLocations = async () => {
    try {
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
  
      console.log('Fetching saved locations with auth...');
      const response = await fetch('/api/apiaries/locations', {
        headers,
        credentials: 'include',
      });
  
      if (response.ok) {
        const locations = await response.json();
        console.log('Fetched saved locations:', locations);
        setSavedApiaryLocations(locations);
      } else {
        console.error('Failed to fetch saved locations:', response.status);
      }
    } catch (error) {
      console.error('Error fetching apiary locations:', error);
    }
  };
  
  // 4. Call fetchSavedApiaryLocations on component mount
  useEffect(() => {
    fetchSavedApiaryLocations();
  }, []);

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  //toggle expand
  const toggleExpand = (batchId: string) => {
  if (expandedBatch === batchId) {
    setExpandedBatch(null);
  } else {
    setExpandedBatch(batchId);
  }
};
  // Toggle batch selection
  const toggleBatchSelection = (batchId: string) => {
    if (selectedBatches.includes(batchId)) {
      setSelectedBatches(selectedBatches.filter(id => id !== batchId));
    } else {
      setSelectedBatches([...selectedBatches, batchId]);
    }
  };

  // Toggle select all batches
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedBatches([]);
    } else {
      setSelectedBatches(filteredBatches.map(batch => batch.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle print button click
  const handlePrint = () => {
    // Check if any of the selected batches are pending
    const anyPending = selectedBatches.some(
      batchId => batches.find(batch => batch.id === batchId)?.status === 'pending'
    );
    
    if (anyPending) {
      setShowPrintNotification(true);
    } else {
      // Mock printing functionality
      setShowCompleteForm(true);
    }
  };

const isProfileComplete = (user: User | null | undefined): boolean => {
  // If isProfileComplete is explicitly set in the database, use that
  if (user?.isProfileComplete === true) {
    return true;
  }
  if (user?.isProfileComplete === false) {
    return false;
  }
  // Fallback to checking individual fields
  return !!(user?.passportId && user?.passportFile);
};

  
// Enhanced handleCompleteBatch with proper original value preservation
const handleCompleteBatch = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
  e.preventDefault();

  // Calculate token usage breakdown ONCE at the beginning
  console.log('=== BEFORE TOKEN CALCULATION ===');
  console.log('batchJars:', batchJars);

  // FIXED: Use jar count for tokens, not weight
  const tokensUsed = batchJars.reduce((sum, jar) => sum + jar.quantity, 0);
  
  // Calculate total weight for certification tracking (separate from tokens)
  const totalCertifiedAmount = batchJars.reduce((sum, jar) => {
    return sum + (jar.size * jar.quantity / 1000);
  }, 0);

  console.log('=== FIXED CALCULATION ===');
  console.log('Total jars (tokens to use):', tokensUsed);
  console.log('Total weight (kg for certification):', totalCertifiedAmount);

  // Calculate token breakdown
  const originOnlyTokens = batchJars.reduce((sum, jar) => {
  const cert = jarCertifications[jar.id];
  return cert?.origin && !cert?.quality ? sum + jar.quantity : sum;
}, 0);

const qualityOnlyTokens = batchJars.reduce((sum, jar) => {
  const cert = jarCertifications[jar.id];
  return cert?.quality && !cert?.origin ? sum + jar.quantity : sum;
}, 0);

const bothCertificationsTokens = batchJars.reduce((sum, jar) => {
  const cert = jarCertifications[jar.id];
  return cert?.origin && cert?.quality ? sum + jar.quantity : sum;
}, 0);
  
 // NEW: Calculate what gets added to origin and quality totals
const totalOriginToAdd = originOnlyTokens + bothCertificationsTokens;
const totalQualityToAdd = qualityOnlyTokens + bothCertificationsTokens;

  // Calculate NEW token balance BEFORE making API calls
  const newTokenBalance = tokenBalance - tokensUsed;

  // Validation checks...
  if (tokenBalance < tokensUsed) {
    setNotification({
      show: true,
      message: `Insufficient tokens. Need ${tokensUsed} tokens for ${tokensUsed} jars, have ${tokenBalance}`,
      type: 'error'
    });
    return;
  }

  // Validation checks (keeping existing validation logic)
  const allJarsHaveCertifications = batchJars.every(jar => {
    const certifications = jarCertifications[jar.id];
    return certifications && (certifications.origin || certifications.quality);
  });

  if (!allJarsHaveCertifications) {
    setNotification({
      show: true,
      message: 'Please select a certification type for all jar types',
      type: 'error'
    });
    return;
  }

  // Check required documents based on selected certifications
  const needsProductionReport = batchJars.some(jar => {
    const cert = jarCertifications[jar.id];
    return cert?.quality;
  });

  const needsLabReport = batchJars.some(jar => {
    const cert = jarCertifications[jar.id];
    return cert?.quality;
  });

  if (needsProductionReport && !formData.productionReport) {
    setNotification({
      show: true,
      message: 'Please upload a production report for quality certifications',
      type: 'error'
    });
    return;
  }

  if (needsLabReport && !formData.labReport) {
    setNotification({
      show: true,
      message: 'Please upload a lab report for quality certifications',
      type: 'error'
    });
    return;
  }

  // Additional validation checks...
  if (!selectedBatches || selectedBatches.length === 0) {
    setNotification({
      show: true,
      message: 'Please select at least one batch',
      type: 'error'
    });
    return;
  }

  if (getTotalRemainingHoneyFromBatch() <= 0) {
    setNotification({
      show: true,
      message: 'No honey available from selected batches',
      type: 'error'
    });
    return;
  }

  if (!batchJars || batchJars.length === 0) {
    setNotification({
      show: true,
      message: 'Please define jar configurations for the batch',
      type: 'error'
    });
    return;
  }

  if (tokenBalance < tokensUsed) {
    setNotification({
      show: true,
      message: `Insufficient tokens. Need ${tokensUsed}, have ${tokenBalance}`,
      type: 'error'
    });
    return;
  }

  // Store original state for potential rollback
  const originalTokenBalance = tokenBalance;
  const originalBatches = [...batches];

  try {
    setIsLoading(true);

    // Get authentication token
    const token = localStorage.getItem('authtoken') ||
                  localStorage.getItem('auth_token') ||
                  localStorage.getItem('token') ||
                  sessionStorage.getItem('authtoken') ||
                  sessionStorage.getItem('auth_token') ||
                  sessionStorage.getItem('token');

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    // Fetch fresh user data
    const userResponse = await fetch('/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user profile. Please try again.');
    }

    const userData = await userResponse.json();

    if (!isProfileComplete(userData)) {
      setShowCompleteForm(false);
      setShowProfileNotification(true);
      return;
    }

    // Add this check before API call
    if (tokensUsed !== (originOnlyTokens + qualityOnlyTokens + bothCertificationsTokens)) {
      throw new Error("Token breakdown doesn't match total jar count");
    }
     
    console.log('📊 Token breakdown:', {
  tokensUsed,                    // Total tokens deducted from user's balance
  originOnlyTokens,              // Tokens with ONLY origin certification
  qualityOnlyTokens,             // Tokens with ONLY quality certification  
  bothCertificationsTokens,      // Tokens with BOTH certifications
  totalOriginToAdd,              // What gets added to origin counter
  totalQualityToAdd,             // What gets added to quality counter
});

    // STEP 1: Pre-calculate all batch updates for immediate UI refresh
    const batchUpdates = selectedBatches.map(batchId => {
      const currentBatch = batches.find(b => b.id === batchId);
      if (!currentBatch) {
  // Handle the case where batch is not found
  return null; // or some loading/error component
}
      const currentAvailableHoney = getRemainingHoneyForBatch(currentBatch);
      
      // PRESERVE ORIGINAL VALUES - Don't overwrite totalKg, totalHoneyCollected, or weightKg
      const originalHoneyCollected = currentBatch.totalHoneyCollected || 
                                   currentBatch.totalHoneyCollected || 
                                   currentBatch.totalKg ||
                                   currentBatch.weightKg ||
                                   (currentAvailableHoney + (currentBatch.honeyCertified || 0));

      const batchCertifiedAmount = totalCertifiedAmount;
      const newHoneyRemaining = Math.max(0, currentAvailableHoney - batchCertifiedAmount);
      
      const previouslyCertified = currentBatch.honeyCertified || currentBatch.honeyCertified || 0;
      const totalCumulativeCertified = previouslyCertified + batchCertifiedAmount;

      return {
        batchId,
        updates: {
          status: newHoneyRemaining > 0 ? 'partially_completed' : 'completed',
          // KEEP ORIGINAL VALUES INTACT
          totalHoneyCollected: originalHoneyCollected,
          totalKg: originalHoneyCollected,
          weightKg: originalHoneyCollected,
          // CERTIFICATION TRACKING
          jarsProduced: (currentBatch.jarsProduced || 0) + tokensUsed,
          jarsUsed: (currentBatch.jarUsed || 0) + tokensUsed,
          jarCertifications: {
            ...currentBatch.jarCertifications,
            ...jarCertifications
          },
          certificationDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          completedChecks: 4,
          totalChecks: 4,
          originalHoneyCollected: originalHoneyCollected,
          honeyCertified: batchCertifiedAmount,
          honeyRemaining: newHoneyRemaining,
          totalHoneyCertified: totalCumulativeCertified,
          // Update certification breakdown in batch using calculated values
          uncertified: Math.max(0, (currentBatch.uncertified || 0) - tokensUsed),
          // Update apiaries
          apiaries: currentBatch.apiaries ? currentBatch.apiaries.map(apiary => {
            const storedValue = apiaryHoneyValues ? apiaryHoneyValues[`${batchId}-${apiary.number}`] : undefined;
            const currentApiaryHoney = storedValue !== undefined ? storedValue : apiary.kilosCollected;
            
            const apiaryProportion = currentAvailableHoney > 0 ? currentApiaryHoney / currentAvailableHoney : 0;
            const apiaryCertifiedAmount = batchCertifiedAmount * apiaryProportion;
            const newApiaryRemaining = Math.max(0, currentApiaryHoney - apiaryCertifiedAmount);

            return {
              ...apiary,
              // Keep original collected amount separate
              originalKilosCollected: apiary.kilosCollected,
              kilosCollected: newApiaryRemaining,
              honeyCertified: (apiary.honeyCertified || 0) + apiaryCertifiedAmount
            };
          }) : []
        }
      };
    });

    // STEP 2: Update token balance immediately (optimistic update)
    setTokenBalance(newTokenBalance);
    localStorage.setItem('tokenBalance', newTokenBalance.toString());

    // STEP 3: Update batches state immediately (optimistic update)
  const updatedBatches = batches.map(batch => {
  const batchUpdate = batchUpdates.find(update => update?.batchId === batch.id);
  if (batchUpdate && batchUpdate.updates) {
    return {
      ...batch,
      ...batchUpdate.updates
    };
  }
  return batch;
});
    // IMMEDIATELY update the batches state for instant UI refresh
    setBatches(updatedBatches);

    // STEP 4: ✅ SINGLE TOKEN STATISTICS UPDATE - This is the ONLY place where token stats are updated
    console.log('📊 Updating token statistics in database (SINGLE CALL):', {
      userId: userData.id,
      originOnly: originOnlyTokens,
      qualityOnly: qualityOnlyTokens,
      bothCertifications: bothCertificationsTokens,
      tokensUsed: tokensUsed,
      tokenBalance: tokenBalance,
      totalOriginCertified: originOnlyTokens + bothCertificationsTokens,
      totalQualityCertified: qualityOnlyTokens + bothCertificationsTokens
    });

    try {
      const tokenStatsResponse = await fetch('/api/token-stats/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userData.id,
          originOnly: totalOriginToAdd,
          qualityOnly: totalQualityToAdd,
          bothCertifications: 0,
          tokensUsed: tokensUsed,
        })
      });

      if (!tokenStatsResponse.ok) {
        console.error('Failed to update token statistics:', await tokenStatsResponse.text());
        throw new Error('Failed to update token statistics');
      } else {
        console.log('✅ Token statistics updated successfully (SINGLE UPDATE)');
      }
    } catch (error) {
      console.error('Error updating token statistics:', error);
      throw error; // Re-throw to trigger rollback
    }

    // STEP 5: Send batch updates to server (✅ REMOVED ALL TOKEN STATS - handled separately above)
  const serverUpdatePromises = selectedBatches.map(async (batchId) => {
  const batchUpdate = batchUpdates
    .filter(update => update != null) // Remove null/undefined elements
    .find(update => update.batchId === batchId);
  
  if (!batchUpdate) {
    console.warn(`No batch update found for batchId: ${batchId}`);
    return;
  }
  
  const currentBatch = batches.find(b => b.id === batchId);
  const batchApiaries = formData.apiaries ? formData.apiaries.filter(apiary =>
    apiary.batchId === batchId || !apiary.batchId
  ) : [];
  

      const batchData = {
        batchId,
        // ✅ COMPLETELY REMOVED: originOnlyTokens, qualityOnlyTokens, bothTokens
        // ✅ COMPLETELY REMOVED: tokensUsed from batch data
        updatedFields: batchUpdate?.updates || {},
        apiaries: batchApiaries.map(apiary => {
          const storedValue = apiaryHoneyValues ? apiaryHoneyValues[`${batchId}-${apiary.number}`] : undefined;
          const currentApiaryHoney = storedValue !== undefined ? storedValue : apiary.kilosCollected;
          
          const currentAvailableHoney = getRemainingHoneyForBatch(currentBatch);
          const apiaryProportion = currentAvailableHoney > 0 ? currentApiaryHoney / currentAvailableHoney : 0;
          const apiaryCertifiedAmount = totalCertifiedAmount * apiaryProportion;
          const newApiaryRemaining = Math.max(0, currentApiaryHoney - apiaryCertifiedAmount);

          return {
            ...apiary,
            name: apiary.name,
            number: apiary.number,
            hiveCount: apiary.hiveCount,
            latitude: apiary.latitude !== 0 ? apiary.latitude : null,
            longitude: apiary.longitude !== 0 ? apiary.longitude : null,
            originalKilosCollected:  apiary.kilosCollected,
            kilosCollected: newApiaryRemaining,
            honeyCertified: (apiary.honeyCertified || 0) + apiaryCertifiedAmount
          };
        }),
        batchJars: batchJars,
        jarCertifications: jarCertifications,
        // ✅ COMPLETELY REMOVED: All token statistics from batch update
      };

      const batchFormData = new FormData();
      batchFormData.append('data', JSON.stringify(batchData));

      if (formData.productionReport) {
        batchFormData.append('productionReport', formData.productionReport);
      }

      if (formData.labReport) {
        batchFormData.append('labReport', formData.labReport);
      }

      const response = await fetch('/api/batches', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: batchFormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update batch ${batchId}`);
      }

      return response.json();
    });

    // Wait for all server updates to complete
    await Promise.all(serverUpdatePromises);

    // STEP 6: Generate certification data
    const certData = {
      batchIds: selectedBatches,
      certificationDate: new Date().toISOString().split('T')[0],
      totalCertified: totalCertifiedAmount.toFixed(2),
      certificationType: Object.values(jarCertifications)
        .map(cert => {
          const types = [];
          if (cert?.origin) types.push('origin');
          if (cert?.quality) types.push('quality');
          return types.join('+');
        })
        .filter(Boolean)
        .join(', '),
      expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      verification: `CERT-${Date.now()}`,
      totalJars: tokensUsed,
    };

    // Store certification data
    try {
      await storeCertificationData(certData, {
        id: userData.id,
        companyName: userData.companyName,
        name: userData.name,
        location: userData.location
      });
    } catch (error) {
      console.error('Error storing certification data:', error);
      // Don't throw here - this is not critical for the main flow
    }

    setCertificationData(certData);

    // Generate QR code
    const qrDataUrl = await generateQRCode(certData);
    setQrCodeDataUrl(qrDataUrl);

    // STEP 7: Reset form state
    setShowCompleteForm(false);
    setSelectedBatches([]);
    setBatchJars([]);
    setJarCertifications({});
    setFormData({
      certificationType: '',
      productionReport: null,
      labReport: null,
      apiaries: []
    });

    // STEP 8: CONSOLIDATED DISPATCH - Only dispatch once at the end
    setTimeout(() => {
      // Single combined event dispatch
      window.dispatchEvent(new CustomEvent('batchCompleted', {
  detail: {
    action: 'completed',
    tokensUsed: tokensUsed,
    newTokenBalance: newTokenBalance,
    batchIds: selectedBatches,
    jarCount: tokensUsed,
    updatedBatches: updatedBatches,
    completedBatchIds: selectedBatches,
    totalCertified: totalCertifiedAmount,
    totalOriginCertified: totalOriginToAdd,
    totalQualityCertified: totalQualityToAdd,
    certificationData: certData,
    originOnlyTokens: originOnlyTokens,
    qualityOnlyTokens: qualityOnlyTokens,
    bothCertificationsTokens: bothCertificationsTokens,
    tokenStatsUpdated: true
  }
}));
    }, 100);

    // STEP 9: Show success popup ONLY ONCE
    setShowSuccessPopup(true);

    // SINGLE SUCCESS NOTIFICATION
    setNotification({
      show: true,
      message: `Batch completed successfully! ${tokensUsed} tokens used (${totalOriginToAdd} origin, ${totalQualityToAdd} quality, ${bothCertificationsTokens} both), ${totalCertifiedAmount.toFixed(2)} kg certified.`,
      type: 'success'
    });

    console.log('✅ Batch completion successful - UI updated immediately with token statistics:', {
      tokensUsed,
      totalOriginToAdd,
      totalQualityToAdd,
      originOnlyTokens,
      qualityOnlyTokens,
      bothCertificationsTokens,
      totalCertifiedAmount,
      singleTokenUpdate: true
    });

  } catch (error: any) {
    console.error('Error completing batches:', error);

    // ROLLBACK: Restore original state on error
    setTokenBalance(originalTokenBalance);
    localStorage.setItem('tokenBalance', originalTokenBalance.toString());

    // Rollback batches state
    setBatches(originalBatches);

    // Single rollback event dispatch
    window.dispatchEvent(new CustomEvent('batchRollback', {
      detail: {
        action: 'restore',
        tokensRestored: tokensUsed,
        newBalance: originalTokenBalance,
        error: error.message,
      }
    }));

    // SINGLE ERROR NOTIFICATION
    setNotification({
      show: true,
      message: error.message || 'An error occurred while completing the batch. Please try again.',
      type: 'error'
    });
  } finally {
    setIsLoading(false);
  }
};

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
       const tokensNeeded = getTotalJarsAcrossApiaries();

      // After successful batch completion, update token balance
    const currentBalance = parseInt(localStorage.getItem('tokenBalance') || '0');
    const newBalance = currentBalance - tokensNeeded;
    
    // Update localStorage
    localStorage.setItem('tokenBalance', newBalance.toString());

     // Dispatch custom event to update token balance across the app
    window.dispatchEvent(new CustomEvent('tokensUpdated', {
      detail: { 
        action: 'deduct',
        tokensDeducted: tokensNeeded,
        newBalance: newBalance,
        batchIds: selectedBatches,
        jarCount: tokensNeeded
      }
    }));

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
  
      // PREPARE DATA - Send structure that matches your API interface
      const dataForAPI = {
        name: String(apiaryData.name).trim(),
        number: String(apiaryData.number).trim(),
        hiveCount: Math.max(0, parseInt(apiaryData.hiveCount) || 0),
        honeyCollected: Math.max(0, parseFloat(apiaryData.honeyCollected) || 0),
        location: {
          latitude: lat,
          longitude: lng
        }
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
  
      // SINGLE API CALL - This will create ONE apiary with a batchId
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
  useEffect(() => {
    refreshApiariesFromDatabase();
  }, []);



  const getTotalHoneyFromApiaries = () => {
  return formData.apiaries.reduce((total, apiary) => total + (apiary.kilosCollected || 0), 0);
};


  

  // Handle apiary form field changes
 

  // Refresh data from API
  const refreshData = async () => {
  try {
    setIsLoading(true);
    setError(null);
    
    // Get token from storage
    const token = localStorage.getItem('authtoken') ||
                  localStorage.getItem('auth_token') ||
                  localStorage.getItem('token') ||
                  sessionStorage.getItem('authtoken') ||
                  sessionStorage.getItem('auth_token') ||
                  sessionStorage.getItem('token');
    
    // Fetch batches
    const batchesResponse = await fetch('/api/batches', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!batchesResponse.ok) {
      throw new Error('Failed to fetch batches');
    }
    
    //const batchesData = await batchesResponse.json();
    //setBatches(batchesData);
    const { batches: batchesArray } = await batchesResponse.json();
    setBatches(batchesArray);
    setLastUpdated(new Date().toLocaleTimeString());

    
    
  } catch (error) {
    console.error('Error refreshing data:', error);
    setError((error as Error).message);
  } finally {
    setIsLoading(false);
  }
};
  
  // Filter and sort batches
  const filteredBatches = Array.isArray(batches)
  ? batches
      .filter(batch => {
        const matchesSearch =
          batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.name.toLowerCase().includes(searchTerm.toLowerCase());

        return filterStatus === 'all'
          ? matchesSearch
          : matchesSearch && batch.status === filterStatus;
      })
      .sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        // If these can be string or number, cast or handle both
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      })
  : [];

  // Certification pie chart data for a specific batch
 const getCertificationData = (batch: {
  certificationStatus?: {
    originOnly?: number;
    qualityOnly?: number;
    bothCertifications?: number;
    uncertified?: number;
  };
}) => {
  const certStatus = batch.certificationStatus || {
    originOnly: 0,
    qualityOnly: 0,
    bothCertifications: 0,
    uncertified: 0
  };

  return [
    { name: 'Origin Only', value: certStatus.originOnly || 0, color: '#3182CE' },
    { name: 'Quality Only', value: certStatus.qualityOnly || 0, color: '#38A169' },
    { name: 'Both Certifications', value: certStatus.bothCertifications || 0, color: '#805AD5' },
    { name: 'Uncertified', value: certStatus.uncertified || 0, color: '#CBD5E0' }
  ];
};

  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [notification, setNotification] = useState<{
  show: boolean;
  message: string;
  type?: 'error' | 'success' | 'info';
}>({
  show: false,
  message: '',
  // `type` is optional so you can omit it here
});
  // Add these to your state declarations
const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

// Handler for the delete button click
const handleDelete = () => {
  if (selectedBatches.length > 0) {
    setShowDeleteConfirmation(true);
  }
};

// Handler for confirming the delete operation
const confirmDelete = async () => {
  try {
    setIsDeleting(true);

    for (const batchId of selectedBatches) {
      try {
        const token = localStorage.getItem('authtoken') ||
                      localStorage.getItem('auth_token') ||
                      localStorage.getItem('token') ||
                      sessionStorage.getItem('authtoken') ||
                      sessionStorage.getItem('auth_token') ||
                      sessionStorage.getItem('token');

        const response = await fetch(`/api/batches?batchId=${batchId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        // Check if response is ok
        if (!response.ok) {
          // Try to parse error message from response
          let errorMessage = 'Failed to delete batch';
          const contentType = response.headers.get('content-type');

          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const text = await response.text();
            if (text) errorMessage = text;
          }

          throw new Error(errorMessage);
        }

        console.log(`Successfully deleted batch: ${batchId}`);

      } catch (error) {
        console.error(`Error deleting batch ${batchId}:`, error);

        setNotification({
          show: true,
          message: `Error deleting batch: ${(error as Error).message}`,
          type: 'error'
        });

        // Exit loop on first error
        break;
      }
    }

    // Refresh after successful deletions
    await refreshData();

    setNotification({
      show: true,
      message: `Successfully deleted ${selectedBatches.length} batch${selectedBatches.length > 1 ? 'es' : ''}`,
      type: 'success'
    });

    setSelectedBatches([]);
    setSelectAll(false);

  } catch (error) {
    console.error('Error in batch deletion process:', error);
    setNotification({
      show: true,
      message: `Error: ${(error as Error).message}`,
      type: 'error'
    });
  } finally {
    setIsDeleting(false);
    setShowDeleteConfirmation(false);
  }
};
// Add these state variables to your component
// Replace the above with:
const [apiaryJars, setApiaryJars] = useState<{[key: number]: CustomJar[]}>({});
const [newJarForApiary, setNewJarForApiary] = useState<{[key: number]: Omit<CustomJar, 'id'>}>({});
const [jarCertifications, setJarCertifications] = useState<Record<string, JarCertification>>({});

const getSelectedType = (certificationState: any) => {
  const { origin, quality } = certificationState ?? {};
  if (origin && quality) return 'both';
  if (origin) return 'origin';
  if (quality) return 'quality';
  return undefined;
};

// Add these helper functions
const hasRequiredCertifications = () => {
  return Object.values(apiaryJars).flat().every(jar => jarCertifications[jar.id]?.selectedType);
};

const needsProductionReport = () => {
  return Object.values(jarCertifications).some(cert => 
    cert?.selectedType === 'quality'
  );
};

const needsLabReport = () => {
  return Object.values(jarCertifications).some(cert => cert?.quality);
};
const tokenCalculation = useMemo(() => {
  const allJars = Object.values(apiaryJars).flat();
  const totalJars = allJars.reduce((sum, jar) => sum + jar.quantity, 0);
  const tokensNeeded = totalJars;
  const remaining = tokenBalance - tokensNeeded;
  
  return {
    tokensNeeded,
    remaining,
    isValid: remaining >= 0,
    hasExceededJars: false
  };
}, [apiaryJars, tokenBalance]);

useEffect(() => {
  // Initialize token balance
  const initialBalance = parseInt(localStorage.getItem('tokenBalance') || '0');
  setTokenBalance(initialBalance);

  // Listen for custom token update events from buy tokens page
  const handleTokensUpdated = (event: Event) => {
    const customEvent = event as CustomEvent<{ newBalance: number }>;
    setTokenBalance(customEvent.detail.newBalance);
  };

  // Listen for storage changes
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'tokenBalance') {
      setTokenBalance(parseInt(e.newValue || '0'));
    }
  };

  window.addEventListener('tokensUpdated', handleTokensUpdated);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener('tokensUpdated', handleTokensUpdated);
    window.removeEventListener('storage', handleStorageChange);
  };
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
          
          // Retry up to 5 times with increasing delays
          
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
        const lat = hasNestedLocation && apiary.location
  ? (typeof apiary.location.latitude === 'string' ? parseFloat(apiary.location.latitude) : apiary.location.latitude)
  : (typeof apiary.latitude === 'string' ? parseFloat(apiary.latitude) : apiary.latitude);

const lng = hasNestedLocation && apiary.location
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
                <div><strong>Honey:</strong> ${apiary.kilosCollected || apiary.honeyCollected || 0} kg</div>
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
  const normalizedApiary: Apiary = {
    ...apiary,
    location: hasNestedLocation ? apiary.location : null, // Set to null instead of creating inline object
    honeyCollected: apiary.kilosCollected || apiary.honeyCollected || 0
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


 
// Helper function to get jars for a specific apiary
const getJarsForApiary = (apiaryIndex: number) => {
  return apiaryJars[apiaryIndex] || [];
};

// Helper function to get total jars across all apiaries
const getTotalJarsAcrossApiaries = () => {
  return Object.values(apiaryJars).flat().reduce((sum, jar) => sum + jar.quantity, 0);
};

// Helper function to add jar to specific apiary
const addJarToApiary = (apiaryIndex: number) => {
  const newJar = newJarForApiary[apiaryIndex];
  const jarSize = newJar?.size;
  const jarQuantity = newJar?.quantity || 1;

  if (!jarSize || jarSize <= 0) return;

  const remainingHoney = getRemainingHoneyForApiary(apiaryIndex);
  const requiredHoney = (jarSize * jarQuantity) / 1000;

  if (requiredHoney > remainingHoney + 0.001) {
    alert(
      `Cannot add ${jarQuantity} jars of ${jarSize}g. Only ${remainingHoney.toFixed(
        2
      )} kg of honey remaining for this apiary.`
    );
    return;
  }

  const apiary = formData.apiaries[apiaryIndex];
  const currentJarsForApiary = getJarsForApiary(apiaryIndex);
  const currentTotalWeight = currentJarsForApiary.reduce(
    (sum, jar) => sum + (jar.size * jar.quantity) / 1000,
    0
  );

  const newJarWeight = (jarSize * jarQuantity) / 1000;

  if (currentTotalWeight + newJarWeight <= apiary.kilosCollected) {
    setApiaryJars({
      ...apiaryJars,
      [apiaryIndex]: [
        ...currentJarsForApiary,
        {
          id: Date.now(),
          size: jarSize,
          quantity: jarQuantity,
          apiaryIndex,
        },
      ],
    });

    // Reset the new jar input for this apiary
    setNewJarForApiary({
      ...newJarForApiary,
      [apiaryIndex]: { size: 0, quantity: 1 },
    });
  } else {
    alert(
      `Cannot add jars. Total weight would exceed honey available for this apiary (${apiary.kilosCollected} kg)`
    );
  }
};

// Helper function to remove jar from specific apiary
const removeJarFromApiary = (apiaryIndex: number, jarId: number) => {
  setApiaryJars({
    ...apiaryJars,
    [apiaryIndex]: getJarsForApiary(apiaryIndex).filter(jar => jar.id !== jarId)
  });
};


  if (!tokenStats) {
  // This will show during data loading after deletion or initial load
  return (
    <div className="flex flex-col space-y-6 p-6 min-h-screen bg-gradient-to-b from-yellow-200 to-white text-black">
      {/* Keep the notification visible even during loading */}
      {notification.show && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg flex items-center ${
          notification.type === 'error' ? 'bg-red-600 text-white' : 
          notification.type === 'success' ? 'bg-green-600 text-white' : 
          'bg-gray-800 text-white'
        }`}>
          {notification.type === 'error' && <AlertCircle className="h-4 w-4 mr-2" />}
          {notification.type === 'success' && <Check className="h-4 w-4 mr-2" />}
          {notification.message}
          <button 
            onClick={() => setNotification({ ...notification, show: false })}
            className="ml-2 text-gray-300 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
      
      <div className="bg-white p-8 rounded-lg shadow flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          <p className="mt-4 text-gray-600">Loading data...</p>
        </div>
      </div>
    </div>
  );
}
  
  return (
    <div className="flex flex-col space-y-6 p-6 min-h-screen bg-gradient-to-b from-yellow-200 to-white text-black">
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        toggleSidebar={toggleSidebar}
        isPremium={userPremiumStatus} 
      />
      
      <Backdrop
        sidebarOpen={sidebarOpen} 
        toggleSidebar={toggleSidebar} 
      />
      
      <Header1 
        toggleSidebar={toggleSidebar}
        refreshData={refreshData}
        handleDelete={handleDelete}
        handlePrint={handlePrint}
        selectedBatches={selectedBatches}
        lastUpdated={lastUpdated}
      />
      
      <DeleteConfirmationDialog 
        show={showDeleteConfirmation}
        setShow={setShowDeleteConfirmation}
        isDeleting={isDeleting}
        confirmDelete={confirmDelete}
        selectedBatches={selectedBatches}
        batches={batches}
      />
      
      <Notification 
        notification={notification}
        setNotification={setNotification}
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
        selectedDropdownApiary={selectedDropdownApiary}
        setSelectedDropdownApiary={setSelectedDropdownApiary}
        availableApiaries={availableApiaries}
        isLoadingApiaries={isLoadingApiaries}
        batches={batches}
        selectedBatches={selectedBatches}
        createBatch={createBatch}
        setShowApiaryModal={setShowApiaryModal}
      />
      
      <CreateApiaryModal 
        showApiaryModal={showApiaryModal}
        setShowApiaryModal={setShowApiaryModal}
        apiaryFormData={apiaryFormData}
        setApiaryFormData={setApiaryFormData}
        mapsLinkInput={mapsLinkInput}
        setMapsLinkInput={setMapsLinkInput}
        savedApiaryLocations={savedApiaryLocations}
        setSavedApiaryLocations={setSavedApiaryLocations}
        miniMapRef={miniMapRef}
        miniGoogleMapRef={miniGoogleMapRef}
        handleMapsLinkSubmit={handleMapsLinkSubmit}
        saveApiaryToDatabase={saveApiaryToDatabase}
        isLoadingApiaries={isLoadingApiaries}
        setIsLoadingApiaries={setIsLoadingApiaries}
        refreshApiariesFromDatabase={refreshApiariesFromDatabase}
      />
      
      <FiltersAndSearch 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />
      
      {isLoading && <LoadingState />}
      
      {error && (
        <ErrorState 
          error={error} 
          refreshData={refreshData} 
        />
      )}
      
      {!isLoading && !error && (
        <BatchTableSection 
          batches={batches}
          filteredBatches={filteredBatches}
          selectedBatches={selectedBatches}
          expandedBatch={expandedBatch}
          toggleBatchSelection={toggleBatchSelection}
          toggleSelectAll={toggleSelectAll}
          selectAll={selectAll}
          toggleExpand={toggleExpand}
        />
      )}
      
      <TokenStatistics 
        tokenStats={tokenStats || undefined}
      />
    
      
      <PrintNotification 
        show={showPrintNotification}
        setShow={setShowPrintNotification}
        setShowCompleteForm={setShowCompleteForm}
      />
      
      {showCompleteForm && (
        <CompleteBatchForm 
          show={showCompleteForm}
          setShow={setShowCompleteForm}
          selectedBatches={selectedBatches}
          batches={batches}
          batchJars={batchJars}
          setBatchJars={setBatchJars}
          jarCertifications={jarCertifications}
          setJarCertifications={setJarCertifications}
          formData={formData}
          setFormData={setFormData}
          tokenBalance={tokenBalance}
          predefinedJarSizes={predefinedJarSizes}
          newJarSize={newJarSize}
          setNewJarSize={setNewJarSize}
          newJarUnit={newJarUnit}
          setNewJarUnit={setNewJarUnit}
          newJarQuantity={newJarQuantity}
          setNewJarQuantity={setNewJarQuantity}
          getTotalHoneyFromBatch={getTotalHoneyFromBatch}
          getAllocatedHoneyFromJars={getAllocatedHoneyFromJars}
          getMaxQuantity={getMaxQuantity}
          addJarToBatch={addJarToBatch}
          removeJarFromBatch={removeJarFromBatch}
          addNewJarSize={addNewJarSize}
          removeJarSize={removeJarSize}
          convertToGrams={convertToGrams}
          isAllHoneyAllocated={isAllHoneyAllocated}
          getSelectedType={getSelectedType}
          needsProductionReport={needsProductionReport}
          needsLabReport={needsLabReport}
          isFormValid={isFormValid}
          handleCompleteBatch={handleCompleteBatch}
          router={router}
        />
      )}
      
      <ProfileNotification 
        show={showProfileNotification}
        setShow={setShowProfileNotification}
        setShowProfileForm={setShowProfileForm}
      />
      
      <ProfileForm 
        show={showProfileForm}
        setShow={setShowProfileForm}
        profileData={profileData}
        handleProfileChange={handleProfileChange}
        handleFileUpload={handleFileUpload}
        handleProfileSubmit={handleProfileSubmit}
      />
      
      <ProfileSuccessMessage 
        show={showProfileCompletedMessage}
        setShow={setShowProfileCompletedMessage}
        
      />
      
      <SuccessPopup 
        show={showSuccessPopup}
        certificationData={certificationData}
        qrCodeDataUrl={qrCodeDataUrl}
        downloadQRCode={downloadQRCode}
        setShow={setShowSuccessPopup}
        setSelectedBatches={setSelectedBatches}
        setBatchJars={setBatchJars}
        setJarCertifications={setJarCertifications}
        setFormData={setFormData}
        setNotification={setNotification}
      />
      
      <FloatingActionMenu
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      setShowBatchModal={setShowBatchModal}
      setShowApiaryModal={setShowApiaryModal}
    />
    </div>
  );
}