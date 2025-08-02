'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  Award, 
  Building2, 
  UserCheck, 
  UserX, 
  Activity,
  RefreshCw,
  AlertCircle,
  UserPlus,
  LogIn,
  TrendingUp,
  Eye,
  Sparkles,
  Shield
} from 'lucide-react';

// Original interfaces from your code
interface AdminData {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
}

interface DatabaseData {
  id: string;
  name: string;
  displayName: string;
}

interface Stats {
  totalUsers: number;
  totalBatches: number;
  totalCertifications: number;
  totalApiaries: number;
  activeUsers: number;
  pendingUsers: number;
}

interface User {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  createdAt: string;
  isConfirmed: boolean;
}

interface Batch {
  id: string;
  batchNumber: string;
  batchName: string;
  status: string;
  createdAt: string;
  user: {
    firstname: string;
    lastname: string;
  };
}

interface Certification {
  id: string;
  verificationCode: string;
  certificationType: string;
  totalCertified: string;
  createdAt: string;
  user: {
    firstname: string;
    lastname: string;
  };
}

interface AdminUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isConfirmed: boolean;
  createdAt: Date;
}

interface DashboardData {
  success: boolean;
  error?: string;
  data?: {
    admin: AdminData;
    database: DatabaseData;
    adminUser?: AdminUser;
    stats: Stats;
    recentActivity: {
      recentUsers: User[];
      recentBatches: Batch[];
      recentCertifications: Certification[];
    };
  };
}

const StatCard = ({ title, value, icon: Icon, color, gradient, trend }: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  color: string;
  gradient: string;
  trend?: number;
}) => (
  <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100">
    {/* Gradient background */}
    <div className={`absolute inset-0 ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-500`} />
    
    {/* Animated border */}
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
    
    <div className="relative p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${gradient} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300 group-hover:scale-110`}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        {trend && (
          <div className="flex items-center space-x-1 text-green-500">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">+{trend}%</span>
          </div>
        )}
      </div>
      
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
        <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform duration-300">
          {value.toLocaleString()}
        </p>
      </div>
      
      {/* Sparkle effect */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
      </div>
    </div>
  </div>
);

const ActivityCard = ({ title, items, renderItem, icon: Icon }: {
  title: string;
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
        <div className="p-2 bg-white rounded-xl shadow-sm">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        {title}
      </h3>
    </div>
    
    <div className="p-6">
      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        {items.length > 0 ? (
          items.map(renderItem)
        ) : (
          <div className="text-center py-8">
            <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

const formatDate = (dateString: string | Date) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadgeColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'completed':
      return 'bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg';
    case 'pending':
    case 'processing':
      return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg';
    case 'inactive':
    case 'cancelled':
      return 'bg-gradient-to-r from-red-400 to-red-600 text-white shadow-lg';
    default:
      return 'bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg';
  }
};

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registeringUser, setRegisteringUser] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/dashboard');
      const data: DashboardData = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch dashboard data');
      }
      
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAsUser = async () => {
    try {
      setRegisteringUser(true);
      
      const response = await fetch('/api/admin/register-as-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      // Check if the response was successful (status 200 or 201)
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to register as user');
      }

      // Success! The API returns either:
      // - { message: "Admin registered as user successfully", user: {...} } for new user (201)
      // - { message: "Admin is already registered as user", user: {...} } for existing user (200)
      
      console.log('Registration successful:', data);
      
      // Show success message
      alert(data.message || 'Successfully registered as user!');
      
      // Refresh dashboard to show the updated admin user status
      await fetchDashboardData();
      
    } catch (err) {
      console.error('Error registering as user:', err);
      
      // Show detailed error message
      const errorMessage = err instanceof Error ? err.message : 'Failed to register as user';
      alert(`Registration failed: ${errorMessage}`);
    } finally {
      setRegisteringUser(false);
    }
  };

  const handleGoToApp = () => {
    // Use Next.js router if available, otherwise fallback to window.location
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 flex items-center space-x-4">
          <div className="relative">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Loading Dashboard</h2>
            <p className="text-gray-600">Gathering your data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-100">
          <div className="flex items-center space-x-3 text-red-600 mb-6">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Error Loading Dashboard</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 px-6 rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // Type-safe destructuring with proper null checking
  if (!dashboardData?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-2xl p-8">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-xl text-gray-600">No dashboard data available</p>
        </div>
      </div>
    );
  }

  const { admin, database, adminUser, stats, recentActivity } = dashboardData.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full opacity-10 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-pink-400 to-red-600 rounded-full opacity-10 animate-pulse" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-green-400 to-blue-600 rounded-full opacity-5 animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Admin Dashboard
                  </h1>
                  <p className="text-gray-600 flex items-center space-x-2">
                    <span>Welcome back,</span>
                    <span className="font-semibold text-blue-600">
                      {admin.firstname} {admin.lastname}
                    </span>
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <p className="text-sm font-bold text-gray-900">{database.displayName}</p>
                <p className="text-xs text-blue-600 font-medium">{admin.role}</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                {!adminUser && (
                  <button
                    onClick={handleRegisterAsUser}
                    disabled={registeringUser}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    {registeringUser ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {registeringUser ? 'Registering...' : 'Register as User'}
                    </span>
                  </button>
                )}
                
                {adminUser && (
                  <button
                    onClick={handleGoToApp}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="font-medium">Go to App</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin User Status */}
      {adminUser && (
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-3 bg-white rounded-xl shadow-sm mr-4">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-800">
                  🎉 You're registered as a user in the beekeeping platform
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Role: <span className="font-semibold">{adminUser.role}</span> | 
                  Status: <span className="font-semibold">{adminUser.isConfirmed ? 'Confirmed ✅' : 'Pending ⏳'}</span> | 
                  Registered: <span className="font-semibold">{formatDate(adminUser.createdAt)}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            color="#3B82F6"
            gradient="bg-gradient-to-br from-blue-400 to-blue-600"
            trend={12}
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            icon={UserCheck}
            color="#10B981"
            gradient="bg-gradient-to-br from-green-400 to-green-600"
            trend={8}
          />
          <StatCard
            title="Pending Users"
            value={stats.pendingUsers}
            icon={UserX}
            color="#F59E0B"
            gradient="bg-gradient-to-br from-yellow-400 to-orange-500"
            trend={-3}
          />
          <StatCard
            title="Total Batches"
            value={stats.totalBatches}
            icon={Package}
            color="#8B5CF6"
            gradient="bg-gradient-to-br from-purple-400 to-purple-600"
            trend={15}
          />
          <StatCard
            title="Certifications"
            value={stats.totalCertifications}
            icon={Award}
            color="#EF4444"
            gradient="bg-gradient-to-br from-red-400 to-red-600"
            trend={20}
          />
          <StatCard
            title="Apiaries"
            value={stats.totalApiaries}
            icon={Building2}
            color="#06B6D4"
            gradient="bg-gradient-to-br from-cyan-400 to-cyan-600"
            trend={5}
          />
        </div>

        {/* Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Recent Users */}
          <ActivityCard
            title="Recent Users"
            icon={Users}
            items={recentActivity.recentUsers}
            renderItem={(user, index) => (
              <div key={user.id} className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:from-blue-50 hover:to-purple-50 transition-all duration-300 border border-gray-100 hover:border-blue-200 hover:shadow-md">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {user.firstname} {user.lastname}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    user.isConfirmed ? 'bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg' : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg'
                  }`}>
                    {user.isConfirmed ? '✅ Confirmed' : '⏳ Pending'}
                  </span>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    {formatDate(user.createdAt)}
                  </p>
                </div>
              </div>
            )}
          />

          {/* Recent Batches */}
          <ActivityCard
            title="Recent Batches"
            icon={Package}
            items={recentActivity.recentBatches}
            renderItem={(batch, index) => (
              <div key={batch.id} className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50 rounded-xl hover:from-purple-50 hover:to-pink-50 transition-all duration-300 border border-gray-100 hover:border-purple-200 hover:shadow-md">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {batch.batchName}
                    </p>
                    <p className="text-xs text-gray-600">#{batch.batchNumber}</p>
                    <p className="text-xs text-purple-600 font-medium">
                      by {batch.user.firstname} {batch.user.lastname}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(batch.status)}`}>
                    {batch.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    {formatDate(batch.createdAt)}
                  </p>
                </div>
              </div>
            )}
          />

          {/* Recent Certifications */}
          <ActivityCard
            title="Recent Certifications"
            icon={Award}
            items={recentActivity.recentCertifications}
            renderItem={(cert, index) => (
              <div key={cert.id} className="group flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-red-50 rounded-xl hover:from-red-50 hover:to-orange-50 transition-all duration-300 border border-gray-100 hover:border-red-200 hover:shadow-md">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {cert.certificationType}
                    </p>
                    <p className="text-xs text-gray-600">Code: {cert.verificationCode}</p>
                    <p className="text-xs text-red-600 font-medium">
                      by {cert.user.firstname} {cert.user.lastname}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {cert.totalCertified} units
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {formatDate(cert.createdAt)}
                  </p>
                </div>
              </div>
            )}
          />
        </div>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <button
            onClick={fetchDashboardData}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 px-8 rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-3 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 font-bold text-lg"
          >
            <RefreshCw className="w-6 h-6" />
            <span>Refresh Dashboard</span>
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Custom CSS for scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #2563eb, #7c3aed);
        }
      `}</style>
    </div>
  );
}