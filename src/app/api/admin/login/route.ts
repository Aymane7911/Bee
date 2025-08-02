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
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Attempt login
    const loginResult = await loginAdmin(email, password);

    // Create response with httpOnly cookie
    const response = NextResponse.json<LoginResponse>({
      success: true,
      message: 'Login successful',
      data: loginResult,
    }, { status: 200 });

    // Set httpOnly cookie for additional security
    response.cookies.set('admin-token', loginResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('Admin login error:', error);

    if (error.message.includes('Invalid email or password')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (error.message.includes('Account is inactive')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    if (error.message.includes('No database associated')) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Database not found. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json<LoginResponse>(
      { success: false, error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<LoginResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}