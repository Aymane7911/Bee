// app/cert/[verification]/page.tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

interface CertificationData {
  id: string;
  verificationCode: string;
  batchIds: string;
  certificationDate: string;
  totalCertified: number;
  certificationType: string;
  expiryDate: string;
  totalJars: number;
  companyName: string | null;
  beekeeperName: string | null;
  location: string | null;
  createdAt: string;
}

async function getCertificationData(verificationCode: string): Promise<CertificationData | null> {
  try {
    // Use absolute URL for server-side fetching in Next.js
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
  ? process.env.NEXTAUTH_URL || process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  : '';
    
    const url = `${baseUrl}/api/certification/${verificationCode}`;
    
    console.log('Fetching from URL:', url); // Debug log
    console.log('Is server:', isServer); // Debug log
    
    const response = await fetch(url, {
      cache: 'no-store', // Ensure fresh data
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Response status:', response.status); // Debug log
    console.log('Response headers:', Object.fromEntries(response.headers.entries())); // Debug log

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response not ok:', response.status, response.statusText, errorText);
      return null;
    }

    const data = await response.json();
    console.log('Received data:', data); // Debug log
    
    return data;
  } catch (error) {
    console.error('Error fetching certification:', error);
    return null;
  }
}

function CertificationSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl p-8 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CertificationPage({ 
  params 
}: { 
  params: Promise<{ verification: string }> 
}) {
  const { verification } = await params;
  console.log('Page params:', verification); // Debug log
  
  const certificationData = await getCertificationData(verification);

  console.log('Certification data:', certificationData); // Debug log

  if (!certificationData) {
    console.log('No certification data found, returning 404');
    notFound();
  }

  const batchIds = certificationData.batchIds.split(',');
  const isExpired = new Date(certificationData.expiryDate) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-4xl mx-auto">
        

        {/* Certificate Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Honey Certification</h1>
          </div>
        </div>

        {/* Main Certificate */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Certificate Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Certificate of Authenticity</h2>
                <p className="text-amber-100">Premium Honey Certification</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-amber-100">Verification Code</div>
                <div className="font-mono text-lg font-bold">{certificationData.verificationCode}</div>
              </div>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="p-8">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                isExpired 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {isExpired ? 'EXPIRED' : 'VALID CERTIFICATION'}
              </div>
            </div>

            {/* Main Information Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    Batch Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Batch Count:</span>
                        <div className="text-black">{batchIds.length}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Batch IDs:</span>
                        <div className="text-black">{batchIds.join(', ')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Certification Details
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="text-black">{certificationData.certificationType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Weight:</span>
                        <span className="font-semibold text-green-600">{certificationData.totalCertified} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Jars:</span>
                        <span className="font-semibold text-green-600">{certificationData.totalJars}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Important Dates
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Certified On:</span>
                        <span className="font-semibold">{new Date(certificationData.certificationDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Expires On:</span>
                        <span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-green-600'}`}>
                          {new Date(certificationData.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Issued On:</span>
                        <span className="font-semibold">{new Date(certificationData.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Producer Information */}
                {(certificationData.beekeeperName || certificationData.companyName || certificationData.location) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      Producer Information
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-3 text-sm">
                        {certificationData.beekeeperName && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Beekeeper:</span>
                            <span className="text-black">{certificationData.beekeeperName}</span>
                          </div>
                        )}
                        {certificationData.companyName && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Company:</span>
                            <span className="font-semibold">{certificationData.companyName}</span>
                          </div>
                        )}
                        {certificationData.location && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Location:</span>
                            <span className="font-semibold">{certificationData.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Footer */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Digitally Verified</span>
                </div>
                <div className="w-1 h-4 bg-gray-300"></div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span>Secured & Authentic</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>This certificate verifies the authenticity and quality of the honey batch(es) listed above.</p>
          <p className="mt-2">For verification inquiries, please contact the issuing authority.</p>
        </div>
      </div>
    </div>
  );
}