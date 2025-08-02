'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SlidingRegistrationPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phonenumber: '',
    password: '',
    confirmPassword: '',
    adminCode: '',
    role: 'admin', // Default role
    useEmail: true,
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
};

  const handleToggleAuth = () => {
    setFormData(prev => ({ ...prev, useEmail: !prev.useEmail }));
  };

  const handleModeSwitch = (adminMode: any) => {
    setIsAdmin(adminMode);
    setError('');
    setFormData(prev => ({
      ...prev,
      adminCode: '',
      role: 'admin'
    }));
  };

  const handleGoogleAuth = async () => {
    console.log('Google OAuth clicked');
    // Google OAuth logic
  };

 const handleSubmit = async () => {
  setError('');
  setIsLoading(true);

  // Basic validation
  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match');
    setIsLoading(false);
    return;
  }

  if (formData.password.length < 8) {
    setError('Password must be at least 8 characters long');
    setIsLoading(false);
    return;
  }

  if (isAdmin && !formData.adminCode) {
    setError('Admin authorization code is required');
    setIsLoading(false);
    return;
  }

  const { firstname, lastname, email, phonenumber, password, adminCode, role, useEmail } = formData;

  try {
    const endpoint = isAdmin ? '/api/admin/register' : '/api/register';
    
    // Build payload based on user type
    let payload: any;
    
    if (isAdmin) {
      // Admin registration payload
      payload = {
        firstname,
        lastname,
        password,
        adminCode,
        role,
        ...(useEmail ? { email } : { phonenumber }),
        // Database details for admin registration
        database: {
          name: `${firstname.toLowerCase()}_${lastname.toLowerCase()}_db`,
          displayName: `${firstname} ${lastname}'s Database`,
          maxUsers: 1000,
          maxStorage: 10.0
        }
      };
    } else {
      // Regular user registration payload
      payload = {
        firstname,
        lastname,
        password,
        ...(useEmail ? { email } : { phonenumber }),
      };
    }

    console.log('Final payload being sent:', payload);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log('Registration successful:', data);
      
      if (isAdmin) {
        // Admin registration - go to admin dashboard
        router.push('/admin/dashboard');
      } else {
        // User registration - check if confirmation is required
        if (data.requiresConfirmation) {
          router.push('/confirm-pending');
        } else {
          router.push(`/dashboard/db/${data.databaseId || 'default'}`);
        }
      }
    } else {
      setError(data?.error || data?.message || 'Registration failed. Please try again.');
      console.error('Registration failed:', data);
    }
  } catch (err) {
    console.error('Network or unexpected error:', err);
    setError('Something went wrong. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Animated Background */}
      <div className={`absolute inset-0 transition-all duration-1000 ${
        isAdmin 
          ? 'bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900' 
          : 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600'
      }`}>
        {/* Floating Shapes */}
        <div className="absolute inset-0">
          <div className={`absolute top-10 left-10 w-16 h-16 transform rotate-45 animate-pulse transition-colors duration-1000 ${
            isAdmin ? 'bg-blue-400/20' : 'bg-yellow-300/20'
          }`}></div>
          <div className={`absolute top-32 right-20 w-12 h-12 transform rotate-12 animate-bounce transition-colors duration-1000 ${
            isAdmin ? 'bg-indigo-300/30' : 'bg-amber-200/30'
          }`}></div>
          <div className={`absolute bottom-20 left-1/4 w-20 h-20 transform -rotate-45 animate-pulse delay-300 transition-colors duration-1000 ${
            isAdmin ? 'bg-slate-300/15' : 'bg-yellow-200/15'
          }`}></div>
          <div className={`absolute top-1/3 right-1/3 w-8 h-8 transform rotate-30 animate-bounce delay-700 transition-colors duration-1000 ${
            isAdmin ? 'bg-blue-300/25' : 'bg-amber-300/25'
          }`}></div>
          <div className={`absolute bottom-1/3 right-10 w-14 h-14 transform rotate-60 animate-pulse delay-500 transition-colors duration-1000 ${
            isAdmin ? 'bg-indigo-400/20' : 'bg-yellow-300/20'
          }`}></div>
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5"></div>
      </div>

      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            {isAdmin ? (
              <pattern id="circuit" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
                <rect width="25" height="25" fill="none"/>
                <circle cx="5" cy="5" r="1" fill="currentColor"/>
                <circle cx="20" cy="5" r="1" fill="currentColor"/>
                <circle cx="5" cy="20" r="1" fill="currentColor"/>
                <circle cx="20" cy="20" r="1" fill="currentColor"/>
                <path d="M5,5 L20,5 M5,20 L20,20 M5,5 L5,20 M20,5 L20,20" stroke="currentColor" strokeWidth="0.5" fill="none"/>
              </pattern>
            ) : (
              <pattern id="honeycomb" x="0" y="0" width="20" height="17.32" patternUnits="userSpaceOnUse">
                <polygon points="10,0 20,5.77 20,11.55 10,17.32 0,11.55 0,5.77" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            )}
          </defs>
          <rect width="100%" height="100%" fill={isAdmin ? "url(#circuit)" : "url(#honeycomb)"} className={isAdmin ? "text-blue-200" : "text-yellow-900"}/>
        </svg>
      </div>

      {/* Logo - Clickable */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in">
        <div 
          className="relative cursor-pointer transition-transform hover:scale-105"
          onClick={() => console.log('Navigate to home')}
        >
          <div className={`absolute inset-0 blur-xl rounded-xl transition-colors duration-1000 ${
            isAdmin ? 'bg-blue-500/20' : 'bg-yellow-400/20'
          }`}></div>
          <div className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-1000 ${
                isAdmin 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                  : 'bg-gradient-to-br from-yellow-400 to-orange-500'
              }`}>
                {isAdmin ? (
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ) : (
                  <span className="text-2xl">🍯</span>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {isAdmin ? 'Admin Portal' : 'Honey Certify'}
                </h1>
                <p className="text-xs text-gray-200">
                  {isAdmin ? 'System Management' : 'Blockchain Verification'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="absolute top-8 right-8 z-20">
        <div className="flex bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
          <button
            onClick={() => handleModeSwitch(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              !isAdmin 
                ? 'bg-white/20 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            🍯 User
          </button>
          <button
            onClick={() => handleModeSwitch(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              isAdmin 
                ? 'bg-white/20 text-white shadow-lg' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ⚙️ Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 pt-32 pb-8">
        <div className="w-full max-w-lg">
          {/* Register Card */}
          <div className="relative group">
            {/* Glow Effect */}
            <div className={`absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-all duration-1000 group-hover:duration-200 ${
              isAdmin 
                ? 'bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-500' 
                : 'bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400'
            }`}></div>
            
            {/* Card */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 transform hover:scale-[1.02] transition-all duration-300">
              {/* Header */}
              <div className="text-center mb-8">
                <div className={`mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-4 transition-all duration-1000 ${
                  isAdmin 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                    : 'bg-gradient-to-br from-yellow-500 to-amber-500'
                }`}>
                  {isAdmin ? (
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  ) : (
                    <span className="text-2xl">🍯</span>
                  )}
                </div>
                <h1 className={`text-4xl font-bold bg-clip-text text-transparent mb-2 transition-all duration-1000 ${
                  isAdmin 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600' 
                    : 'bg-gradient-to-r from-yellow-600 to-amber-600'
                }`}>
                  {isAdmin ? 'Admin Registration' : 'Join Our Community'}
                </h1>
                <p className="text-gray-600 text-lg">
                  {isAdmin ? 'Create administrator account & database' : 'Create your beekeeper account'}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="relative overflow-hidden bg-red-50 border border-red-200 rounded-xl p-4 animate-slide-down mb-6">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-500 animate-pulse"></div>
                </div>
              )}

              {/* Form */}
              <div className="space-y-6">
                {/* Google OAuth Button - Only for Users */}
                {!isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-100 border border-gray-200 font-semibold py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] hover:-translate-y-1"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500">Or register with email</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Admin Authorization Code - Only for Admins */}
                {isAdmin && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="adminCode"
                      value={formData.adminCode}
                      onChange={handleChange}
                      placeholder="Enter admin authorization code"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      required
                    />
                  </div>
                )}

                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="firstname"
                      value={formData.firstname}
                      onChange={handleChange}
                      placeholder="First name"
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${isAdmin ? 'focus:ring-blue-500' : 'focus:ring-yellow-500'}`}
                      required
                    />
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="lastname"
                      value={formData.lastname}
                      onChange={handleChange}
                      placeholder="Last name"
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${isAdmin ? 'focus:ring-blue-500' : 'focus:ring-yellow-500'}`}
                      required
                    />
                  </div>
                </div>

                {/* Toggle Between Email and Phone */}
                <div className="flex items-center justify-center mb-4">
                  <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, useEmail: true }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        formData.useEmail 
                          ? `${isAdmin ? 'bg-blue-500' : 'bg-yellow-500'} text-white shadow-md` 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📧 Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, useEmail: false }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        !formData.useEmail 
                          ? `${isAdmin ? 'bg-blue-500' : 'bg-yellow-500'} text-white shadow-md` 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      📱 Phone
                    </button>
                  </div>
                </div>

                {/* Email or Phone Input */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {formData.useEmail ? (
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type={formData.useEmail ? "email" : "tel"}
                    name={formData.useEmail ? "email" : "phonenumber"}
                    value={formData.useEmail ? formData.email : formData.phonenumber}
                    onChange={handleChange}
                    placeholder={formData.useEmail ? "Enter your email" : "Enter your phone number"}
                    className={`w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${isAdmin ? 'focus:ring-blue-500' : 'focus:ring-yellow-500'}`}
                    required
                  />
                </div>

                {/* Password Fields */}
                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create password"
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 ${isAdmin ? 'focus:ring-blue-500' : 'focus:ring-yellow-500'}`}
                      required
                    />
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className={`h-5 w-5 text-gray-400 group-focus-within:transition-colors ${isAdmin ? 'group-focus-within:text-blue-500' : 'group-focus-within:text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm password"
                      className={`w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500' : 'focus:ring-yellow-500'}`}
                      required
                    />
                  </div>
                </div>

                {/* Admin Role Selection - Only for Admins */}
                {isAdmin && (
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 appearance-none"
                      required
                    >
                      <option value="admin">System Administrator</option>
                      <option value="super_admin">Super Administrator</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl ${
                    isAdmin
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                      : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <span>{isAdmin ? 'Create Admin Account' : 'Join Community'}</span>
                    </div>
                  )}
                </button>

                {/* Terms and Privacy */}
                <div className="text-center text-sm text-gray-500">
                  By registering, you agree to our{' '}
                  <button type="button" className={`underline transition-colors ${isAdmin ? 'hover:text-blue-600' : 'hover:text-yellow-600'}`}>
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" className={`underline transition-colors ${isAdmin ? 'hover:text-blue-600' : 'hover:text-yellow-600'}`}>
                    Privacy Policy
                  </button>
                </div>

                {/* Login Link */}
                <div className="text-center border-t border-gray-200 pt-6">
                  <p className="text-gray-600">
                    Already have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => router.push('/login')}
                      className={`font-semibold underline transition-colors ${isAdmin ? 'text-blue-600 hover:text-blue-700' : 'text-yellow-600 hover:text-yellow-700'}`}
                    >
                      Sign in here
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Hints */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 border border-white/20">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAdmin ? 'bg-blue-400' : 'bg-yellow-400'}`}></div>
            <span>{isAdmin ? 'Admin Portal Active' : 'User Registration Active'}</span>
          </div>
        </div>
      </div>

      {/* Additional Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </section>
  );
}