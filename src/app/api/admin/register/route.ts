// app/api/admin/register/route.ts - FIXED VERSION
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { execSync } from 'child_process';

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

// Database creation without user creation
async function createPhysicalDatabase(databaseName: string): Promise<{
  connectionString: string;
  dbUser: string;
  dbPassword: string;
}> {
  console.log('🔍 Testing master database connection...');
  
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

// Schema application
async function applySchemaToNewDatabase(
  connectionString: string, 
  databaseName: string
): Promise<void> {
  try {
    console.log(`📋 Applying schema to database: ${databaseName}`);
    
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

// Create admin as user in beeusers table
async function createAdminAsUser(
  connectionString: string,
  databaseId: string,
  adminId: number,
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  }
): Promise<any> {
  const newDbPrisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });

  try {
    await newDbPrisma.$connect();
    console.log('✅ Connected to new database for user creation');

    // Create admin as a user in beeusers table
    const adminUser = await newDbPrisma.beeusers.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: 'admin', // Set role as admin in beeusers
        isAdmin: true, // Mark as admin
        adminId: adminId, // Reference to admin table
        isConfirmed: true, // Auto-confirm admin users
        isProfileComplete: true, // Mark profile as complete
        databaseId: databaseId, // Required database association
      }
    });

    console.log(`✅ Admin created as user in beeusers table with ID: ${adminUser.id}`);
    return adminUser;

  } catch (error: any) {
    console.error('❌ Failed to create admin as user:', error.message);
    throw new Error(`Failed to create admin as user: ${error.message}`);
  } finally {
    await newDbPrisma.$disconnect();
  }
}

// Create admin in the new database
async function createAdminInNewDatabase(
  connectionString: string,
  adminData: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    role: string;
  }
): Promise<any> {
  const newDbPrisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });

  try {
    await newDbPrisma.$connect();
    console.log('✅ Connected to new database for admin creation');

    // Create admin in the new database
    const admin = await newDbPrisma.admin.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: adminData.password,
        role: adminData.role,
        isActive: true,
      }
    });

    console.log(`✅ Admin created in new database with ID: ${admin.id}`);
    return admin;

  } catch (error: any) {
    console.error('❌ Failed to create admin in new database:', error.message);
    throw new Error(`Failed to create admin in new database: ${error.message}`);
  } finally {
    await newDbPrisma.$disconnect();
  }
}

// Create database record in new database (not master)
async function createDatabaseRecordInNewDatabase(
  connectionString: string,
  adminId: number,
  dbConfig: {
    name: string;
    displayName: string;
    description: string;
    maxUsers: number;
    maxStorage: number;
  }
): Promise<any> {
  const newDbPrisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });

  try {
    await newDbPrisma.$connect();
    console.log('✅ Connected to new database for database record creation');

    // Create database record in the new database itself
    const databaseRecord = await newDbPrisma.database.create({
      data: {
        name: dbConfig.name,
        displayName: dbConfig.displayName,
        databaseUrl: connectionString,
        description: dbConfig.description,
        maxUsers: dbConfig.maxUsers,
        maxStorage: dbConfig.maxStorage,
        managedBy: { connect: { id: adminId } }, // Connect to the admin in the same database
        isActive: true,
      }
    });

    console.log(`✅ Database record created in new database with ID: ${databaseRecord.id}`);
    return databaseRecord;

  } catch (error: any) {
    console.error('❌ Failed to create database record in new database:', error.message);
    throw new Error(`Failed to create database record in new database: ${error.message}`);
  } finally {
    await newDbPrisma.$disconnect();
  }
}

// Database initialization with admin creation
async function initializeNewDatabase(
  connectionString: string,
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
    console.log('🔧 Initializing database with admin...');
    
    // Step 1: Create admin in the new database
    const admin = await createAdminInNewDatabase(connectionString, adminData);
    
    // Step 2: Create database record in the new database (with admin reference)
    const database = await createDatabaseRecordInNewDatabase(
      connectionString,
      admin.id,
      dbConfig
    );
    
    // Step 3: Create admin as a user in beeusers table
    console.log('👥 Creating admin as user in beeusers table...');
    const adminUser = await createAdminAsUser(
      connectionString,
      database.id,
      admin.id,
      adminData
    );
    
    console.log('✅ Database initialized successfully with admin, database record, and admin user');
    return { admin, database, adminUser };
    
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    throw new Error(`Failed to initialize database: ${error.message}`);
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

    // Start the process
    let dbConnectionInfo: {
      connectionString: string;
      dbUser: string;
      dbPassword: string;
    } | null = null;

    let createdAdmin: any;
    let newDatabase: any;
    let masterDbAdmin: any;
    let adminUser: any;

    try {
      // Step 1: Create physical database
      console.log('🗄️ Creating physical database...');
      dbConnectionInfo = await createPhysicalDatabase(dbConfig.name);
      console.log('✅ Physical database created successfully');

      // Step 2: Apply schema to new database
      console.log('📋 Applying schema to new database...');
      await applySchemaToNewDatabase(dbConnectionInfo.connectionString, dbConfig.name);
      console.log('✅ Schema applied successfully');

      // Step 3: Create admin in MASTER database first (for tracking purposes)
      console.log('👤 Creating admin in master database...');
      masterDbAdmin = await prisma.admin.create({
        data: {
          firstname,
          lastname,
          email: adminEmail,
          password: hashedPassword,
          role,
          isActive: true,
        }
      });
      console.log('✅ Admin created in master database');

      // Step 4: Create database record in MASTER database
      console.log('💾 Creating database record in master database...');
      const masterDatabaseRecord = await prisma.database.create({
        data: {
          name: dbConfig.name,
          displayName: dbConfig.displayName,
          databaseUrl: dbConnectionInfo.connectionString,
          description: dbConfig.description,
          maxUsers: dbConfig.maxUsers,
          maxStorage: dbConfig.maxStorage,
          managedBy: { connect: { id: masterDbAdmin.id } },
          isActive: true,
        }
      });
      console.log(`✅ Database record created in master database with ID: ${masterDatabaseRecord.id}`);

      // Step 5: Initialize the new database with admin and database record
      console.log('🔧 Initializing new database with admin and database record...');
      const initResult = await initializeNewDatabase(
        dbConnectionInfo.connectionString,
        {
          firstname,
          lastname,
          email: adminEmail,
          password: hashedPassword,
          role
        },
        dbConfig
      );
      
      createdAdmin = initResult.admin;
      newDatabase = initResult.database;
      adminUser = initResult.adminUser;
      console.log('✅ New database initialized successfully');

    } catch (error: any) {
      console.error('❌ Registration process failed:', error.message);
      
      // Cleanup: Try to remove the physical database if it was created
      if (dbConnectionInfo) {
        try {
          console.log('🧹 Attempting to cleanup created database...');
          const masterClient = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.DB_ADMIN_USER || 'postgres',
            password: process.env.DB_ADMIN_PASSWORD,
            database: 'postgres'
          });
          
          await masterClient.connect();
          await masterClient.query(`DROP DATABASE IF EXISTS "${dbConfig.name}"`);
          await masterClient.end();
          console.log('✅ Cleanup completed');
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError);
        }
      }

      // Cleanup: Remove admin from master database if created
      if (masterDbAdmin) {
        try {
          await prisma.admin.delete({ where: { id: masterDbAdmin.id } });
          console.log('✅ Master database admin cleanup completed');
        } catch (cleanupError) {
          console.error('❌ Master database admin cleanup failed:', cleanupError);
        }
      }
      
      throw error;
    }

    console.log('🎉 Admin registration completed successfully!');

    return NextResponse.json<AdminRegistrationResponse>({
      success: true,
      message: 'Admin account and database created successfully. Admin registered in both master and new database, and added as user in beeusers table.',
      data: {
        admin: {
          id: createdAdmin.id,
          firstname: createdAdmin.firstname,
          lastname: createdAdmin.lastname,
          email: createdAdmin.email,
          role: createdAdmin.role,
          createdAt: createdAdmin.createdAt
        },
        database: {
          id: newDatabase.id,
          name: newDatabase.name,
          displayName: newDatabase.displayName,
          connectionString: '***HIDDEN***',
          maxUsers: newDatabase.maxUsers,
          maxStorage: newDatabase.maxStorage,
          createdAt: newDatabase.createdAt
        },
        adminUser: {
          id: adminUser.id,
          firstname: adminUser.firstname,
          lastname: adminUser.lastname,
          email: adminUser.email,
          role: adminUser.role,
          isAdmin: adminUser.isAdmin,
          adminId: adminUser.adminId,
          createdAt: adminUser.createdAt
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
    
    if (error.message.includes('Database creation failed')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { success: false, error: 'Failed to create database. Please contact system administrator.' },
        { status: 500 }
      );
    }
    
    if (error.message.includes('Schema application failed')) {
      return NextResponse.json<AdminRegistrationResponse>(
        { success: false, error: 'Failed to set up database schema. Please contact system administrator.' },
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