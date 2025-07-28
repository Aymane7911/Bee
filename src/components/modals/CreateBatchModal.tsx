import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Layers, Database, Tag, Package, RefreshCw, Menu, X, Home, Settings, Users, Activity, HelpCircle, Wallet, PlusCircle, MapPin, CheckCircle, Trash2, Globe, FileText, AlertCircle, Sparkles, LogOut, Plus, Star, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';


// Updated interface to match your parent component
interface ApiaryLocationData {
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

// Main Apiary interface - use ONLY this one throughout your app
interface Apiary {
  id: string;
  batchId?: string;
  batchNumber?: string;
  name: string;
  number: number;
  hiveCount: number;
  honeyCollected?: number;
  kilosCollected?: number;
  honeyCertified?: number;
  
  // Use the unified location type
  location?: ApiaryLocationData | null;
  
  // Keep these for backward compatibility if needed
  latitude?: number;
  longitude?: number;
  locationName?: string;
  
  createdAt?: string;
}

interface CreateBatchModalProps {
  showBatchModal: boolean;
  setShowBatchModal: (show: boolean) => void;
  batchNumber: string;
  setBatchNumber: (value: string) => void;
  batchName: string;
  setBatchName: (value: string) => void;
  batchHoneyCollected: number;
  setBatchHoneyCollected: (value: number) => void;
  selectedApiaries: any[]; // Use any[] temporarily to avoid type conflicts
  setSelectedApiaries: React.Dispatch<React.SetStateAction<any[]>>; // Use React's SetStateAction type
  availableApiaries: Apiary[];
  isLoadingApiaries: boolean;
  setShowApiaryModal: (show: boolean) => void;
  createBatch: () => void;
  selectedDropdownApiary: string;
  setSelectedDropdownApiary: (value: string) => void;
  batches?: any[]; // Add the missing batches prop (optional)
  selectedBatches?: any[]; // Add the missing selectedBatches prop (optional)
  // Add this new prop for updating apiary hive count in database
  updateApiaryHiveCount?: (apiaryId: string, newHiveCount: number) => Promise<void>; // Changed from string | number to string
}

const CreateBatchModal = ({ 
  showBatchModal,
  setShowBatchModal,
  batchNumber,
  setBatchNumber,
  batchName,
  setBatchName,
  batchHoneyCollected,
  setBatchHoneyCollected,
  selectedApiaries,
  setSelectedApiaries,
  availableApiaries,
  isLoadingApiaries,
  setShowApiaryModal,
  createBatch,
  selectedDropdownApiary,
  setSelectedDropdownApiary,
  batches, // Add the batches prop to destructuring
  selectedBatches, // Add the selectedBatches prop to destructuring
  updateApiaryHiveCount
}: CreateBatchModalProps) => {
  
  // Track which apiaries have unsaved changes - updated to use string
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
  const [savingChanges, setSavingChanges] = useState<Set<string>>(new Set());

  const resetBatchForm = () => {
    setBatchNumber('');
    setBatchName('');
    setBatchHoneyCollected(0);
    setSelectedApiaries([]);
    setSelectedDropdownApiary('');
    setUnsavedChanges(new Set());
    setSavingChanges(new Set());
  };

  // Helper function to convert Apiary to SelectedApiary
  const convertApiaryToSelectedApiary = (apiary: Apiary): any => {
    return {
      ...apiary,
      kilosCollected: 0,
      honeyCollected: apiary.honeyCollected || 0,
      batchId: undefined,
      batchNumber: undefined,
      // Flatten location properties for backward compatibility
      latitude: apiary.location?.latitude || apiary.latitude,
      longitude: apiary.location?.longitude || apiary.longitude,
      locationName: apiary.location?.locationName || apiary.locationName
    };
  };

  const saveHiveCount = async (apiaryId: string, newHiveCount: number) => {
    if (!updateApiaryHiveCount) {
      console.warn('updateApiaryHiveCount function not provided');
      return;
    }

    // Mark as saving
    setSavingChanges(prev => new Set(prev).add(apiaryId));
    
    try {
      await updateApiaryHiveCount(apiaryId, newHiveCount);
      
      // Remove from unsaved changes
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(apiaryId);
        return newSet;
      });
      
      console.log(`Successfully updated hive count for apiary ${apiaryId} to ${newHiveCount}`);
    } catch (error) {
      console.error('Failed to update hive count:', error);
      // You might want to show a toast notification here
      alert('Failed to save hive count. Please try again.');
    } finally {
      // Remove from saving state
      setSavingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(apiaryId);
        return newSet;
      });
    }
  };

  return showBatchModal ? (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-30">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Create New Batch</h3>
          <button
            onClick={() => {
              setShowBatchModal(false);
              resetBatchForm();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Batch Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="batchNumber"
              value={batchNumber || ''}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter batch number"
              autoFocus
            />
          </div>

          {/* Batch Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Name (Optional)
            </label>
            <input
              type="text"
              name="batchName"
              value={batchName || ''}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter batch name (optional)"
            />
            <p className="text-xs text-gray-500 mt-1">
              If left empty, will default to "{batchNumber ? `${batchNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}` : 'BatchNumber_YYYY-MM-DDTHH-MM-SS'}"
            </p>
          </div>

          {/* Total Honey Collected */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Honey Collected (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={batchHoneyCollected || ''}
              onChange={(e) => setBatchHoneyCollected(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="Enter total honey collected"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Total honey collected from all apiaries in this batch
            </p>
          </div>
        </div>

        {/* Select Apiaries Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-lg">Select Apiaries</h4>
            <button
              type="button"
              onClick={() => setShowApiaryModal(true)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md border border-blue-200 hover:bg-blue-50"
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              Add New Apiary
            </button>
          </div>

          {/* Apiary Selection Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Available Apiaries <span className="text-red-500">*</span>
            </label>
            
            {isLoadingApiaries ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-gray-500">Loading apiaries...</p>
              </div>
            ) : !Array.isArray(availableApiaries) || availableApiaries.length === 0 ? (
              <div
                className="border border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:bg-gray-50"
                onClick={() => setShowApiaryModal(true)}
              >
                <PlusCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500 font-medium">No apiaries available</p>
                <p className="text-xs text-gray-400 mt-1">Click to create your first apiary</p>
              </div>
            ) : (
              <select
                value={selectedDropdownApiary || ""}
               onChange={(e) => {
  const apiaryId = e.target.value;
  
  console.log('=== APIARY SELECTION DEBUG ===');
  console.log('1. Selected apiary ID from dropdown:', apiaryId, typeof apiaryId);
  
  setSelectedDropdownApiary(apiaryId);
  
  if (apiaryId && apiaryId !== '') {
    console.log('2. Available apiary IDs and types:');
    availableApiaries.forEach(a => {
      console.log(`   - ${a.name}: ID=${a.id} (${typeof a.id})`);
    });
    
    // Clean type-safe comparison - convert both to same type
    const apiary = availableApiaries.find(a => String(a.id) === String(apiaryId));
    
    console.log('3. Found apiary:', apiary ? apiary.name : 'NOT FOUND');
    
    if (apiary) {
      const isAlreadySelected = selectedApiaries.some(a => 
        String(a.id) === String(apiary.id)
      );
      
      console.log('4. Is already selected:', isAlreadySelected);
      
      if (!isAlreadySelected) {
        console.log('5. Adding apiary to selection...');
        const selectedApiary = convertApiaryToSelectedApiary(apiary);
        
        setSelectedApiaries(prev => {
          const newArray = [...prev, selectedApiary];
          console.log('6. New selectedApiaries array length:', newArray.length);
          return newArray;
        });
        
        // Reset dropdown
        setSelectedDropdownApiary('');
        
      } else {
        console.log('7. Apiary already selected');
        setSelectedDropdownApiary('');
        alert('This apiary is already selected!');
      }
    } else {
      console.error('8. Apiary not found - check data types and IDs');
      setSelectedDropdownApiary('');
    }
  }
  
  console.log('=== END DEBUG ===\n');
}}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">Select an apiary to add...</option>
                {availableApiaries
                  .filter(apiary => !selectedApiaries.some(selected => 
                    selected.id === apiary.id
                  ))
                  .map(apiary => (
                    <option key={apiary.id} value={apiary.id}>
                      {apiary.name} (ID: {apiary.number}) - {apiary.hiveCount} hives
                    </option>
                  ))
                }
              </select>
            )}
          </div>

          {/* Selected Apiaries List */}
          {selectedApiaries.length > 0 && (
            <div className="space-y-4">
              <h5 className="font-medium text-gray-800">Selected Apiaries for this Batch:</h5>
              {selectedApiaries.map((apiary) => (
                <div key={apiary.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h6 className="font-medium text-gray-800 text-lg">{apiary.name}</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Apiary ID/Number
                            </label>
                            <input
                              type="text"
                              value={apiary.number}
                              readOnly
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-700 text-sm cursor-not-allowed"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Number of Hives
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="0"
                                value={apiary.hiveCount}
                                onChange={(e) => {
                                  const newHiveCount = parseInt(e.target.value) || 0;
                                  // Update local state only
                                  setSelectedApiaries(prev => 
                                    prev.map(a => 
                                      a.id === apiary.id 
                                        ? { ...a, hiveCount: newHiveCount } 
                                        : a
                                    )
                                  );
                                  // Mark as unsaved
                                  setUnsavedChanges(prev => new Set(prev).add(apiary.id));
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                              {unsavedChanges.has(apiary.id) && (
                                <button
                                  type="button"
                                  onClick={() => saveHiveCount(apiary.id, apiary.hiveCount)}
                                  disabled={savingChanges.has(apiary.id)}
                                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    savingChanges.has(apiary.id)
                                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                      : 'bg-green-600 hover:bg-green-700 text-white'
                                  }`}
                                  title="Save changes to database"
                                >
                                  {savingChanges.has(apiary.id) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                            {unsavedChanges.has(apiary.id) && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Unsaved changes - click save to update database
                              </p>
                            )}
                          </div>

                          {/* Add fields for the additional SelectedApiary properties */}
                          <div>
                            
                            
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                              Location
                            </label>
                            <input
                              type="text"
                              value={
                                apiary.latitude !== undefined && apiary.longitude !== undefined
                                  ? apiary.locationName 
                                    ? `${apiary.locationName} (${apiary.latitude?.toFixed(6)}, ${apiary.longitude?.toFixed(6)})`
                                    : `${apiary.latitude?.toFixed(6)}, ${apiary.longitude?.toFixed(6)}`
                                  : 'No location set'
                              }
                              readOnly
                              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-700 text-sm cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedApiaries((prev: any[]) => 
                          prev.filter(a => a.id !== apiary.id)
                        );
                        // Remove from unsaved changes when removing apiary
                        setUnsavedChanges(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(apiary.id);
                          return newSet;
                        });
                      }}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center ml-4 hover:bg-red-50 px-2 py-1 rounded"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Show warning if there are unsaved changes */}
        {unsavedChanges.size > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
              <p className="text-amber-700 text-sm">
                You have unsaved changes to hive counts. Make sure to save them before creating the batch.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={() => {
              setShowBatchModal(false);
              resetBatchForm();
            }}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={createBatch}
            disabled={
              !batchNumber?.trim() || 
              !batchHoneyCollected ||
              batchHoneyCollected <= 0 ||
              selectedApiaries.length === 0 ||
              unsavedChanges.size > 0 // Prevent creating batch with unsaved changes
            }
            className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
              batchNumber?.trim() && 
              batchHoneyCollected > 0 &&
              selectedApiaries.length > 0 &&
              unsavedChanges.size === 0
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Create Batch
          </button>
        </div>
      </div>
    </div>
  ) : null;
};

export default CreateBatchModal;