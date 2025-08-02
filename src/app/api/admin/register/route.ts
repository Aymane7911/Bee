// app/api/admin/register/route.ts - RENDER COMPATIBLE VERSION
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Prisma with connection testing
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Test database connection on startup
async function testPrismaConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connection established successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Prisma connection failed:', error.message);
    console.error('   Make sure your DATABASE_URL is correct and the database is running');
    return false;
  }
}

// Types
interface AdminRegistrationRequest {
  firstname: string;
  lastname: string;
  email?: string;
  phonenumber?: string;
  password: string;
  adminCode: string;
  role: 'admin' | 'super_admin';
  database?: {
    name?: string;
    displayName?: string;
    description?: string;
    maxUsers?: number;
    maxStorage?: number;
  };
}

interface AdminRegistrationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    admin: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      createdAt: Date;
    };
    database: {
      id: string;
      name: string;
      displayName: string;
      connectionString: string;
      maxUsers: number | null;
      maxStorage: number | null;
      createdAt: Date;
    };
    adminUser: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      isAdmin: boolean;
      adminId: number | null;
      createdAt: Date;
    };
  };
}

// Admin authorization codes
const ADMIN_CODES: Record<string, string> = {
  super_admin: process.env.SUPER_ADMIN_CODE || 'super_admin_2024_secure',
  admin: process.env.ADMIN_CODE || 'admin_2024_secure'
};

// Check if we're running on Render or other managed service
function isMangedDatabase(): boolean {
  return (
    process.env.RENDER === 'true' || 
    process.env.DATABASE_PROVIDER === 'render' ||
    process.env.SKIP_DATABASE_CREATION === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

// Create admin in the existing database (Render approach)
async function createAdminInExistingDatabase(
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  },
  dbConfig: {
    name: string;
    displayName: string;
    description: string;
    maxUsers: number;
    maxStorage: number;
  }
): Promise<{ admin: any; database: any; adminUser: any }> {
  
  try {
    console.log('🔧 Creating admin in existing database...');
    
    // Step 1: Create admin record
    const admin = await prisma.admin.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: adminData.role,
        isActive: true,
      }
    });
    console.log(`✅ Admin created with ID: ${admin.id}`);
    
    // Step 2: Create database record (logical database, not physical)
    const database = await prisma.database.create({
      data: {
        name: dbConfig.name,
        displayName: dbConfig.displayName,
        databaseUrl: process.env.DATABASE_URL || '', // Use current database URL
        description: dbConfig.description,
        maxUsers: dbConfig.maxUsers,
        maxStorage: dbConfig.maxStorage,
        managedBy: { connect: { id: admin.id } },
        isActive: true,
      }
    });
    console.log(`✅ Database record created with ID: ${database.id}`);
    
    // Step 3: Create admin as a user in beeusers table
    const adminUser = await prisma.beeusers.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: 'admin',
        isAdmin: true,
        adminId: admin.id,
        isConfirmed: true,
        isProfileComplete: true,
        databaseId: database.id,
      }
    });
    console.log(`✅ Admin user created with ID: ${adminUser.id}`);
    
    return { admin, database, adminUser };
    
  } catch (error: any) {
    console.error('❌ Failed to create admin in existing database:', error.message);
    throw new Error(`Failed to create admin: ${error.message}`);
  }
}

// Original database creation function (for local development)
async function createPhysicalDatabase(databaseName: string): Promise<{
  connectionString: string;
  dbUser: string;
  dbPassword: string;
}> {
  // Only use this in local development
  if (isMangedDatabase()) {
    throw new Error('Physical database creation not supported in managed environment');
  }
  
  console.log('🔍 Testing master database connection...');
  
  const { Client } = require('pg');
  const masterClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_ADMIN_USER || 'postgres',
    password: process.env.DB_ADMIN_PASSWORD,
    database: 'postgres'
  });

  const dbUser = process.env.DB_ADMIN_USER || 'postgres';
  const dbPassword = process.env.DB_ADMIN_PASSWORD || '';

  try {
    await masterClient.connect();
    console.log('✅ Master database connection successful');
    
    // Check if database already exists
    const existingDbResult = await masterClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    );
    
    if (existingDbResult.rows.length > 0) {
      throw new Error(`Database '${databaseName}' already exists`);
    }
    
    // Create ONLY the database
    console.log(`🗄️ Creating database: ${databaseName}`);
    await masterClient.query(`CREATE DATABASE "${databaseName}"`);
    
    await masterClient.end();
    
    const connectionString = `postgresql://${dbUser}:${dbPassword}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${databaseName}`;
    
    console.log('✅ Physical database created successfully');
    return { connectionString, dbUser, dbPassword };
    
  } catch (error: any) {
    console.error('❌ Database creation error:', error.message);
    try {
      await masterClient.end();
    } catch (endError) {
      console.error('Error closing master client:', endError);
    }
    throw new Error(`Failed to create database: ${error.message}`);
  }
}

// Apply schema to new database (only for local development)
async function applySchemaToNewDatabase(
  connectionString: string, 
  databaseName: string
): Promise<void> {
  try {
    console.log(`📋 Applying schema to database: ${databaseName}`);
    
    const { execSync } = require('child_process');
    execSync(`npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate`, {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        DATABASE_URL: connectionString,
        CI: 'true'
      },
      timeout: 45000
    });
    
    console.log(`✅ Schema applied successfully to: ${databaseName}`);
    
  } catch (error: any) {
    console.error(`❌ Failed to apply schema to ${databaseName}:`, error.message);
    throw new Error(`Failed to apply schema to "${databaseName}": ${error.message}`);
  }
}

// Main database initialization function
async function initializeDatabase(
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  },
  dbConfig: {
    name: string;
    displayName: string;
    description: string;
    maxUsers: number;
    maxStorage: number;
  }
): Promise<{ admin: any; database: any; adminUser: any }> {

  if (isMangedDatabase()) {
    console.log('🏢 Detected managed database environment (Render/Production)');
    console.log('⏭️ Skipping physical database creation, using existing database');
    return await createAdminInExistingDatabase(adminData, dbConfig);
  } else {
    console.log('💻 Local development environment detected');
    console.log('🗄️ Creating physical database...');
    
    // Original logic for local development
    const dbConnectionInfo = await createPhysicalDatabase(dbConfig.name);
    await applySchemaToNewDatabase(dbConnectionInfo.connectionString, dbConfig.name);
    
    // Initialize new database with admin (your original complex logic here)
    // ... (keep your original local development logic)
    
    throw new Error('Local development database creation not implemented in this version');
  }
}

function validateRequest(data: Partial<AdminRegistrationRequest>): string | null {
  if (!data.firstname || !data.lastname || !data.password || !data.adminCode || !data.role) {
    return 'Missing required fields';
  }

  if (!data.email && !data.phonenumber) {
    return 'Either email or phone number is required';
  }

  if (!['admin', 'super_admin'].includes(data.role)) {
    return 'Invalid role specified';
  }

  if (data.password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (data.adminCode !== ADMIN_CODES[data.role]) {
    return 'Invalid admin authorization code';
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<AdminRegistrationResponse>> {
  console.log('🚀 Starting admin registration process...');
  
  // Test database connection first
  const connectionTest = await testPrismaConnection();
  if (!connectionTest) {
    return NextResponse.json<AdminRegistrationResponse>(
      { 
        success: false, 
        error: 'Database connection failed. Please check your database configuration and ensure the database server is running.' 
      },
      { status: 500 }
    );
  }
  
  try {
    const body: AdminRegistrationRequest = await request.json();
    
    const { 
      firstname, 
      lastname, 
      email, 
      phonenumber, 
      password, 
      adminCode, 
      role,
      database 
    } = body;

    // Validation
    const validationError = validateRequest(body);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // Prepare admin email
    const adminEmail = email || `${phonenumber}@phone.local`;

    // Prepare database configuration
    const dbConfig = {
      name: database?.name || `${firstname.toLowerCase()}_${lastname.toLowerCase()}_db`,
      displayName: database?.displayName || `${firstname} ${lastname}'s Database`,
      description: database?.description || `Database managed by ${firstname} ${lastname}`,
      maxUsers: database?.maxUsers || 1000,
      maxStorage: database?.maxStorage || 10.0
    };

    console.log('📝 Database config:', dbConfig);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Initialize database and create admin
    const result = await initializeDatabase(
      {
        firstname,
        lastname,
        email: adminEmail,
        password: hashedPassword,
        role
      },
      dbConfig
    );

    console.log('🎉 Admin registration completed successfully!');

    return NextResponse.json<AdminRegistrationResponse>({
      success: true,
      message: isMangedDatabase() 
        ? 'Admin account created successfully in existing database. All records created in the shared database.'
        : 'Admin account and database created successfully. Admin registered in both master and new database, and added as user in beeusers table.',
      data: {
        admin: {
          id: result.admin.id,
          firstname: result.admin.firstname,
          lastname: result.admin.lastname,
          email: result.admin.email,
          role: result.admin.role,
          createdAt: result.admin.createdAt
        },
        database: {
          id: result.database.id,
          name: result.database.name,
          displayName: result.database.displayName,
          connectionString: '***HIDDEN***',
          maxUsers: result.database.maxUsers,
          maxStorage: result.database.maxStorage,
          createdAt: result.database.createdAt
        },
        adminUser: {
          id: result.adminUser.id,
          firstname: result.adminUser.firstname,
          lastname: result.adminUser.lastname,
          email: result.adminUser.email,
          role: result.adminUser.role,
          isAdmin: result.adminUser.isAdmin,
          adminId: result.adminUser.adminId,
          createdAt: result.adminUser.createdAt
        }
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Admin registration error:', error);

    if (error.message.includes('connection') || error.message.includes('Authentication failed')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { 
          success: false, 
          error: 'Database connection failed. Please check your database configuration.' 
        },
        { status: 500 }
      );
    }
    
    if (error.message.includes('Physical database creation not supported')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { 
          success: false, 
          error: 'This operation is not supported in the current environment. Using existing database instead.' 
        },
        { status: 500 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json<AdminRegistrationResponse>(
        { success: false, error: 'Admin with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json<AdminRegistrationResponse>(
      { success: false, error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<AdminRegistrationResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  );
}

export type { AdminRegistrationRequest, AdminRegistrationResponse };