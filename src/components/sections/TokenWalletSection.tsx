import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface TokenStats {
  totalTokens: number;
  remainingTokens: number;
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  usedTokens: number;
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
  apiaries: any[];
  certificationStatus: any;
  containerType: string;
  labelType: string;
  weightKg: number;
  jarUsed: number;
  // Certification data fields
  originOnly: number;
  qualityOnly: number;
  bothCertifications: number;
  uncertified: number;
  // Progress tracking
  completedChecks: number;
  totalChecks: number;
  // Optional dates
  certificationDate?: string;
  expiryDate?: string;
  // Optional file paths
  productionReportPath?: string;
  labReportPath?: string;
  // JSON field - this contains the jar certifications data
  jarCertifications?: any;
  // Honey data fields
  honeyCertified?: number;
  honeyRemaining?: number;
  totalHoneyCollected?: number;
  // Relations
  userId: number;
}

interface TokenWalletOverviewProps {
  batches?: Batch[];
  tokenBalance: number;
  tokenStats?: TokenStats[];
}

const getTokenFromStorage = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authtoken') ||
           localStorage.getItem('auth_token') ||
           localStorage.getItem('token') ||
           sessionStorage.getItem('authtoken') ||
           sessionStorage.getItem('auth_token') ||
           sessionStorage.getItem('token');
  }
  return null;
};

const TokenWalletOverview: React.FC<TokenWalletOverviewProps> = ({ 
  batches = [],
  tokenBalance = 0
}) => {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingTokens, setPendingTokens] = useState({ 
    originOnly: 0, 
    qualityOnly: 0, 
    bothCertifications: 0 
  });

  // Authentication state
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Initialize auth token
  useEffect(() => {
    const token = getTokenFromStorage();
    console.log('TokenWallet: Retrieved token:', token ? 'exists' : 'missing');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  // Get authentication headers
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = authToken || getTokenFromStorage();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }, [authToken]);

  // Fetch token stats from backend
  const fetchTokenStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check authentication before making request
      const token = authToken || getTokenFromStorage();
      if (!token) {
        setError('Authentication required. Please log in.');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      console.log('TokenWallet: Fetching token stats with token:', token.substring(0, 20) + '...');
      
      const response = await fetch('/api/token-stats/update', {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store' // Force fresh data
      });
      
      console.log('TokenWallet: Response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          throw new Error('Authentication required. Please log in.');
        }
        const errorText = await response.text();
        console.error('TokenWallet: API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('TokenWallet: Received data:', data);
      setTokenStats(data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('TokenWallet: Failed to fetch token stats', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch token stats');
      
      // Fallback to default values
      setTokenStats({
        totalTokens: 0,
        remainingTokens: 0,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        usedTokens: 0
      });
    } finally {
      setLoading(false);
    }
  }, [authToken, getAuthHeaders]);

  // Initial fetch when auth token changes
  useEffect(() => {
    if (authToken) {
      console.log('TokenWallet: Auth token changed, fetching stats');
      fetchTokenStats();
    }
  }, [authToken, fetchTokenStats]);

  // Handle batch events with proper dependencies
  useEffect(() => {
    const handleBatchEvent = (event: any) => {
      console.log('TokenWallet: Batch event received:', event.type);
      fetchTokenStats();
    };

    window.addEventListener('batchCompleted', handleBatchEvent);
    window.addEventListener('batchRollback', handleBatchEvent);
    window.addEventListener('tokenStatsUpdated', handleBatchEvent); // Add this custom event

    return () => {
      window.removeEventListener('batchCompleted', handleBatchEvent);
      window.removeEventListener('batchRollback', handleBatchEvent);
      window.removeEventListener('tokenStatsUpdated', handleBatchEvent);
    };
  }, [fetchTokenStats]);

  // Calculate pending tokens
  useEffect(() => {
    const pending = batches.reduce((acc, batch) => {
      if (batch.status === 'processing' && batch.jarCertifications) {
        Object.values(batch.jarCertifications).forEach((cert: any) => {
          if (cert.origin && cert.quality) acc.bothCertifications += 1;
          else if (cert.origin) acc.originOnly += 1;
          else if (cert.quality) acc.qualityOnly += 1;
        });
      }
      return acc;
    }, { originOnly: 0, qualityOnly: 0, bothCertifications: 0 });

    console.log('TokenWallet: Calculated pending tokens:', pending);
    setPendingTokens(pending);
  }, [batches]);

  // Add refresh button functionality
  const handleRefresh = () => {
    console.log('TokenWallet: Manual refresh triggered');
    fetchTokenStats();
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow text-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Token Wallet Overview</h2>
          <button 
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-600">Loading token statistics...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white p-4 rounded-lg shadow text-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Token Wallet Overview</h2>
          <button 
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <div className="h-4 w-4 bg-red-500 rounded-full mr-2"></div>
            <span className="text-red-800 font-medium">Error Loading Token Stats</span>
          </div>
          <p className="text-red-700 text-sm mb-3">{error}</p>
          <button 
            onClick={fetchTokenStats}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Ensure tokenStats is not null at this point
  if (!tokenStats) {
    return null;
  }

  // Calculate total pending tokens
  const totalPendingTokens = pendingTokens.originOnly + pendingTokens.qualityOnly + pendingTokens.bothCertifications;
  
  // Calculate total used tokens
  const totalUsedTokens = tokenStats.totalTokens - tokenStats.remainingTokens;
  
  // Use the remainingTokens from the database, subtract pending tokens
  const availableTokens = Math.max(0, tokenStats.remainingTokens - totalPendingTokens);

  console.log('TokenWallet: Rendering with stats:', {
    totalTokens: tokenStats.totalTokens,
    remainingTokens: tokenStats.remainingTokens,
    totalUsedTokens,
    totalPendingTokens,
    availableTokens
  });

  return (
    <div className="bg-white p-4 rounded-lg shadow text-black">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Token Wallet Overview</h2>
        <button 
          onClick={handleRefresh}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      
     
      
      {/* Token Usage Section */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="text-md font-semibold mb-3">Token Usage Distribution</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Origin Only */}
          <div className="p-3 bg-white rounded-lg shadow">
            <div className="flex items-center mb-1">
              <div className="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
              <p className="text-sm font-medium">Origin Only</p>
            </div>
            <p className="text-xl font-bold">
              {tokenStats.originOnly + pendingTokens.originOnly}
            </p>
            <p className="text-xs text-gray-500">tokens used</p>
            {pendingTokens.originOnly > 0 && (
              <p className="text-xs text-blue-500">
                +{pendingTokens.originOnly} pending
              </p>
            )}
          </div>
          
          {/* Quality Only */}
          <div className="p-3 bg-white rounded-lg shadow">
            <div className="flex items-center mb-1">
              <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
              <p className="text-sm font-medium">Quality Only</p>
            </div>
            <p className="text-xl font-bold">
              {tokenStats.qualityOnly + pendingTokens.qualityOnly}
            </p>
            <p className="text-xs text-gray-500">tokens used</p>
            {pendingTokens.qualityOnly > 0 && (
              <p className="text-xs text-green-500">
                +{pendingTokens.qualityOnly} pending
              </p>
            )}
          </div>
          
          {/* Total Used */}
          <div className="p-3 bg-white rounded-lg shadow">
            <div className="flex items-center mb-1">
              <div className="h-3 w-3 rounded-full bg-yellow-500 mr-2"></div>
              <p className="text-sm font-medium">Total Used</p>
            </div>
            <p className="text-xl font-bold">
              {totalUsedTokens + totalPendingTokens}
            </p>
            <p className="text-xs text-gray-500">tokens used</p>
            {totalPendingTokens > 0 && (
              <p className="text-xs text-yellow-500">
                +{totalPendingTokens} pending
              </p>
            )}
          </div>
          
          {/* Available Tokens */}
          <div className="p-3 bg-white rounded-lg shadow">
            <div className="flex items-center mb-1">
              <div className="h-3 w-3 rounded-full bg-gray-400 mr-2"></div>
              <p className="text-sm font-medium">Available</p>
            </div>
            <p className="text-xl font-bold text-green-600">{availableTokens}</p>
            <p className="text-xs text-gray-500">tokens remaining</p>
            {totalPendingTokens > 0 && (
              <p className="text-xs text-orange-500">
                -{totalPendingTokens} pending
              </p>
            )}
          </div>
        </div>
        
        {/* Usage Summary */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-yellow-700">Usage Rate:</span>
            <span className="text-sm font-medium text-yellow-900">
              {tokenStats.totalTokens > 0 
                ? (((totalUsedTokens + totalPendingTokens) / tokenStats.totalTokens) * 100).toFixed(1) 
                : 0}%
            </span>
          </div>
          {totalPendingTokens > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-orange-700">Pending Tokens:</span>
              <span className="text-sm font-medium text-orange-900">
                {totalPendingTokens}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenWalletOverview;