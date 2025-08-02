// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/admin-auth';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    token: string;
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
    };
    database: {
      id: string;
      name: string;
      displayName: string;
    };
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  const startTime = Date.now();
  
  try {
    console.log('=== Admin Login API Debug ===');
    
    // Parse request body with validation
    let body: LoginRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const { email, password } = body;

    // Enhanced validation
    if (!email || !password) {
      console.log('Missing credentials:', { hasEmail: !!email, hasPassword: !!password });
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('Invalid email format:', email);
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 1) {
      return NextResponse.json(
        { success: false, error: 'Password cannot be empty' },
        { status: 400 }
      );
    }

    console.log('Login attempt for email:', email);
    console.log('Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    });

    // Attempt login with timeout
    let loginResult;
    try {
      loginResult = await Promise.race([
        loginAdmin(email, password),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Login timeout')), 30000)
        )
      ]) as any;
      
      console.log('Login successful for:', email);
    } catch (loginError: any) {
      console.error('Login failed:', {
        email,
        error: loginError.message,
        errorType: loginError.constructor.name,
        processingTime: Date.now() - startTime
      });
      
      // Handle specific login errors
      if (loginError.message.includes('timeout')) {
        return NextResponse.json(
          { success: false, error: 'Login timeout. Please try again.' },
          { status: 408 }
        );
      }
      
      if (loginError.message.includes('Invalid email or password')) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (loginError.message.includes('Account is inactive')) {
        return NextResponse.json(
          { success: false, error: 'Account is inactive. Please contact support.' },
          { status: 403 }
        );
      }

      if (loginError.message.includes('No database associated')) {
        return NextResponse.json(
          { success: false, error: 'Database configuration error. Please contact support.' },
          { status: 500 }
        );
      }
      
      // Handle database connection errors
      if (loginError.message.includes('authentication failed') ||
          loginError.message.includes('database credentials') ||
          loginError.message.includes('not valid') ||
          loginError.message.includes('ECONNREFUSED') ||
          loginError.message.includes('ETIMEDOUT')) {
        console.error('Database connection error during login:', loginError);
        return NextResponse.json(
          { success: false, error: 'Database service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
      
      // Handle Prisma initialization errors
      if (loginError.message.includes('PrismaClientInitializationError') ||
          loginError.message.includes('Cannot reach database server')) {
        console.error('Prisma initialization error:', loginError);
        return NextResponse.json(
          { success: false, error: 'Database connection error. Please try again.' },
          { status: 503 }
        );
      }
      
      // Generic error for unexpected cases
      return NextResponse.json(
        { success: false, error: 'Login failed. Please try again.' },
        { status: 500 }
      );
    }

    // Validate login result
    if (!loginResult || !loginResult.token) {
      console.error('Invalid login result:', loginResult);
      return NextResponse.json(
        { success: false, error: 'Authentication failed. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Creating response with token for:', email);

    // Create response with httpOnly cookie
    const response = NextResponse.json<LoginResponse>({
      success: true,
      message: 'Login successful',
      data: loginResult,
    }, { status: 200 });

    // Set multiple cookie formats for compatibility
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    };

    // Set the primary admin token cookie
    response.cookies.set('admin-token', loginResult.token, cookieOptions);
    
    // Set alternative cookie names for compatibility
    response.cookies.set('admin_token', loginResult.token, cookieOptions);
    response.cookies.set('adminToken', loginResult.token, cookieOptions);

    console.log('Login completed successfully:', {
      email,
      adminId: loginResult.admin.id,
      databaseId: loginResult.database.id,
      processingTime: Date.now() - startTime
    });

    return response;

  } catch (error: any) {
    console.error('Unexpected admin login error:', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      processingTime: Date.now() - startTime
    });

    // Handle unexpected errors
    if (error.message.includes('fetch failed') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNRESET')) {
      return NextResponse.json(
        { success: false, error: 'Network error. Please check your connection and try again.' },
        { status: 503 }
      );
    }

    if (error.message.includes('JSON') || error.message.includes('parse')) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format. Please try again.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  } finally {
    console.log('Login API request completed in', Date.now() - startTime, 'ms');
  }
}

// Handle other HTTP methods with proper responses
export async function GET(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST for login.' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST for login.' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST for login.' },
    { status: 405 }
  );
}

export async function PATCH(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Use POST for login.' },
    { status: 405 }
  );
}