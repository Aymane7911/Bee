import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, 
  XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';


interface Apiary {
  batchId: string;
  batchNumber: string;
  name: string;
  number: number;
  hiveCount: number;
  latitude: number;
  longitude: number;
  honeyCollected: number;
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

interface User {
  passportId?: string;
  passportFile?: string;
  // Add other user properties as needed
  id?: string;
  name?: string;
  email?: string;
  isProfileComplete: boolean;
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

interface JarCertifications {
  [key: number]: JarCertification;
}

interface SelectedApiary extends Apiary {
  kilosCollected: number; // Override to ensure this is always present
}



// Add missing interfaces
interface JarDefinition {
  id: string;
  size: number;
  quantity: number;
  unit: string;
}

interface Certification {
  origin?: boolean;
  quality?: boolean;
  both?: boolean;
  selectedType?: 'origin' | 'quality' | 'both';
}

interface FileData {
  productionReport?: File | null;
  labReport?: File | null;
  [key: string]: any;
}




interface BatchTableProps {
  batches: Batch[];
  filteredBatches: Batch[];
  selectedBatches: string[];
  expandedBatch: string | null;
  toggleBatchSelection: (id: string) => void;
  toggleSelectAll: () => void;
  selectAll: boolean;
  toggleExpand: (id: string) => void;
}

const BatchTable: React.FC<BatchTableProps> = ({
  batches,
  filteredBatches,
  selectedBatches,
  expandedBatch,
  toggleBatchSelection,
  toggleSelectAll,
  selectAll,
  toggleExpand
}) => {
  // Function to get certification data for charts
  const getCertificationData = (batch: Batch) => {
    return [
      { name: 'Origin Only', value: batch.originOnly || 0, color: '#3B82F6' },
      { name: 'Quality Only', value: batch.qualityOnly || 0, color: '#10B981' },
      { name: 'Both Certifications', value: batch.bothCertifications || 0, color: '#8B5CF6' },
      { name: 'Uncertified', value: batch.uncertified || 0, color: '#6B7280' }
    ].filter(item => item.value > 0);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="w-12 py-3 pl-4">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-yellow-600 rounded focus:ring-yellow-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Batch Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total (kg)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jars
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Apiaries
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBatches.map((batch) => {
              const certData = getCertificationData(batch);
              const totalKg = batch.totalKg || batch.weightKg || batch.totalHoneyCollected || 0;
              const jarsProduced = batch.jarsProduced || batch.jarUsed || 0;
              
              return (
                <React.Fragment key={batch.id}>
                  {/* Main row */}
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedBatches.includes(batch.id) ? 'bg-yellow-50' : ''}`}
                    onClick={() => toggleExpand(batch.id)}
                  >
                    <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedBatches.includes(batch.id)}
                        onChange={() => toggleBatchSelection(batch.id)}
                        className="h-4 w-4 text-yellow-600 rounded focus:ring-yellow-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{batch.batchNumber}</span>
                        {batch.status === 'completed' && (
                          <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            Certified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {batch.batchName || batch.name || 'Untitled Batch'}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        batch.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : batch.status === 'partially_completed'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {batch.status === 'completed'
                          ? 'Completed'
                          : batch.status === 'partially_completed'
                          ? 'Partial'
                          : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {typeof totalKg === 'number' ? totalKg.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      {jarsProduced.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span>{batch.apiaries?.length || 0}</span>
                        {batch.apiaries?.length > 0 && (
                          <span className="ml-1 text-xs text-gray-500">
                            ({batch.apiaries.slice(0, 2).map(a => a.name).join(', ')}
                            {batch.apiaries.length > 2 ? '...' : ''})
                          </span>
                          
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(batch.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                      >
                        {expandedBatch === batch.id ? (
                          <>
                            <span>Hide Details</span>
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>View Details</span>
                            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {expandedBatch === batch.id && (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 bg-gray-50 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Batch Details */}
                          <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="text-sm font-semibold mb-3 pb-2 border-b">Batch Details</h3>
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Batch Number:</span>
                                <span className="font-medium">{batch.batchNumber}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Created Date:</span>
                                <span className="font-medium">
                                  {new Date(batch.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Total Honey:</span>
                                <span className="font-medium text-blue-600">
                                  {totalKg.toFixed(2)} kg
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Status:</span>
                                <span className={`font-medium ${
                                  batch.status === 'completed' ? 'text-green-600' : 
                                  batch.status === 'partially_completed' ? 'text-orange-600' : 
                                  'text-yellow-600'
                                }`}>
                                  {batch.status === 'completed' ? 'Completed' : 
                                   batch.status === 'partially_completed' ? 'Partially Completed' : 
                                   'Pending'}
                                </span>
                              </div>
                              {batch.certificationDate && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Certified:</span>
                                  <span className="font-medium">
                                    {new Date(batch.certificationDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {batch.expiryDate && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Expires:</span>
                                  <span className="font-medium">
                                    {new Date(batch.expiryDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Certification Breakdown */}
                          <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="text-sm font-semibold mb-3 pb-2 border-b">Certification Breakdown</h3>
                            <div className="h-64">
                              {certData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={certData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      fill="#8884d8"
                                      dataKey="value"
                                      label={({ name, percent, value }) => 
                                        `${name}: ${value.toFixed(1)}kg (${(percent * 100).toFixed(0)}%)`
                                      }
                                    >
                                      {certData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} kg`, 'Weight']} />
                                  </PieChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                  No certification data available
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Apiaries List */}
                          <div className="bg-white p-4 rounded-lg border shadow-sm">
                            <h3 className="text-sm font-semibold mb-3 pb-2 border-b">Associated Apiaries</h3>
                            {batch.apiaries && batch.apiaries.length > 0 ? (
                              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                                {batch.apiaries.map((apiary, index) => (
                                  <div key={index} className="border-b pb-3 last:border-b-0">
                                    <div className="font-medium text-gray-800">{apiary.name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                      <div>
                                        <span className="text-gray-600">ID:</span>
                                        <span className="ml-1 font-medium">{apiary.number}</span>
                                      </div>
                                      <div>
                                        <span className="text-gray-600">Hives:</span>
                                        <span className="ml-1 font-medium">{apiary.hiveCount}</span>
                                      </div>
                                      
                                      <div>
                                        <span className="text-gray-600">Location:</span>
                                        {apiary.latitude && apiary.longitude ? (
                                          <span className="ml-1 font-medium flex items-center">
                                            <svg className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            {apiary.latitude.toFixed(4)}, {apiary.longitude.toFixed(4)}
                                          </span>
                                        ) : (
                                          <span className="ml-1 text-gray-500">Not set</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                                <svg className="h-12 w-12 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p>No apiaries associated with this batch</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredBatches.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
              <svg className="h-12 w-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-600">No batches found</h3>
            <p className="text-gray-500 mt-2">
              {batches.length > 0 
                ? 'Try adjusting your search or filters'
                : 'Create your first batch to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchTable;