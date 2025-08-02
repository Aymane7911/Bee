// lib/admin-auth.ts - Updated for new database structure
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { masterDb } from './database-connection';
import { PrismaClient } from '@prisma/client';

export interface AdminSession {
  adminId: number;
  email: string;
  role: string;
  databaseId: string;
  databaseUrl: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Generate JWT token for admin
 */
export function generateAdminToken(admin: {
  id: number;
  email: string;
  role: string;
  databaseId: string;
  databaseUrl: string;
}): string {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      databaseId: admin.databaseId,
      databaseUrl: admin.databaseUrl,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify admin token
 */
export function verifyAdminToken(token: string): AdminSession {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminSession;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get admin session from request
 */
export async function getAdminFromRequest(request: NextRequest): Promise<AdminSession> {
  console.log('=== Admin Auth Debug ===');
  console.log('URL:', request.url);
  console.log('Method:', request.method);
  
  // Log all cookies
  const allCookies = request.cookies.getAll();
  console.log('All cookies:', allCookies);
  
  // Log all headers
  console.log('Authorization header:', request.headers.get('authorization'));
  
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('Found Bearer token:', token ? 'YES' : 'NO');
  }

  // If no Authorization header, try to get from cookies
  if (!token) {
    const adminTokenCookie = request.cookies.get('admin-token');
    token = adminTokenCookie?.value || null;
    console.log('Admin token cookie:', adminTokenCookie);
    console.log('Token from cookie:', token ? 'YES' : 'NO');
  }

  console.log('Final token found:', token ? 'YES' : 'NO');

  if (!token) {
    console.log('ERROR: No authentication token provided');
    throw new Error('No authentication token provided');
  }

  console.log('Verifying token...');
  const session = verifyAdminToken(token);
  console.log('Token verified successfully for admin ID:', session.adminId);

  // Get database info from master database
  const database = await masterDb.database.findUnique({
    where: { id: session.databaseId },
  });

  if (!database || !database.isActive) {
    console.log('ERROR: Database not found or inactive');
    throw new Error('Database not found or inactive');
  }

  // Verify admin exists in their own database
  const adminDb = new PrismaClient({
    datasources: {
      db: {
        url: database.databaseUrl,
      },
    },
  });

  try {
    await adminDb.$connect();
    
    const admin = await adminDb.admin.findUnique({
      where: { id: session.adminId },
    });

    if (!admin || !admin.isActive) {
      console.log('ERROR: Admin not found or inactive in their database');
      throw new Error('Admin account not found or inactive');
    }

    console.log('Authentication successful for:', admin.email);
    console.log('=== End Debug ===');

    return {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      databaseId: database.id,
      databaseUrl: database.databaseUrl,
    };

  } finally {
    await adminDb.$disconnect();
  }
}

/**
 * Admin login function - Updated to work with new structure
 */
export async function loginAdmin(email: string, password: string): Promise<{
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
}> {
  const bcrypt = require('bcryptjs');

  // Since admin is no longer in master database, we need to search across all databases
  // First, get all active databases
  const databases = await masterDb.database.findMany({
    where: { isActive: true },
  });

  let foundAdmin: any = null;
  let foundDatabase: any = null;

  // Search for admin across all databases
  for (const database of databases) {
    const adminDb = new PrismaClient({
      datasources: {
        db: {
          url: database.databaseUrl,
        },
      },
    });

    try {
      await adminDb.$connect();
      
      const admin = await adminDb.admin.findUnique({
        where: { email },
      });

      if (admin && admin.isActive) {
        // Verify password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (isValidPassword) {
          foundAdmin = admin;
          foundDatabase = database;
          
          // Update last login in admin's database
          await adminDb.admin.update({
            where: { id: admin.id },
            data: { lastLoginAt: new Date() },
          });
          
          break;
        }
      }
    } catch (error) {
      console.error(`Error checking database ${database.name}:`, error);
    } finally {
      await adminDb.$disconnect();
    }
  }

  if (!foundAdmin || !foundDatabase) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const token = generateAdminToken({
    id: foundAdmin.id,
    email: foundAdmin.email,
    role: foundAdmin.role,
    databaseId: foundDatabase.id,
    databaseUrl: foundDatabase.databaseUrl,
  });

  return {
    token,
    admin: {
      id: foundAdmin.id,
      firstname: foundAdmin.firstname,
      lastname: foundAdmin.lastname,
      email: foundAdmin.email,
      role: foundAdmin.role,
    },
    database: {
      id: foundDatabase.id,
      name: foundDatabase.name,
      displayName: foundDatabase.displayName,
    },
  };
}

/**
 * Get admin by email across all databases (utility function)
 */
export async function findAdminByEmail(email: string): Promise<{
  admin: any;
  database: any;
} | null> {
  const databases = await masterDb.database.findMany({
    where: { isActive: true },
  });

  for (const database of databases) {
    const adminDb = new PrismaClient({
      datasources: {
        db: {
          url: database.databaseUrl,
        },
      },
    });

    try {
      await adminDb.$connect();
      
      const admin = await adminDb.admin.findUnique({
        where: { email },
      });

      if (admin) {
        return { admin, database };
      }
    } catch (error) {
      console.error(`Error checking database ${database.name}:`, error);
    } finally {
      await adminDb.$disconnect();
    }
  }

  return null;
}