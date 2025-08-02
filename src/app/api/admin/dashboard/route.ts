// app/api/admin/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-auth';
import { masterDb, getAdminDatabaseConnection, getConnectionPoolStats } from '@/lib/database-connection';

interface DashboardData {
  success: boolean;
  error?: string;
  data?: {
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
    adminUser?: {
      id: number;
      firstname: string;
      lastname: string;
      email: string;
      role: string;
      isAdmin: boolean;
      isConfirmed: boolean;
      createdAt: Date;
    };
    stats: {
      totalUsers: number;
      totalBatches: number;
      totalCertifications: number;
      totalApiaries: number;
      activeUsers: number;
      pendingUsers: number;
    };
    recentActivity: {
      recentUsers: Array<{
        id: number;
        firstname: string;
        lastname: string;
        email: string;
        createdAt: Date;
        isConfirmed: boolean;
      }>;
      recentBatches: Array<{
        id: string;
        batchNumber: string;
        batchName: string;
        status: string;
        createdAt: Date;
        user: {
          firstname: string;
          lastname: string;
        };
      }>;
      recentCertifications: Array<{
        id: string;
        verificationCode: string;
        certificationType: string;
        totalCertified: string;
        createdAt: Date;
        user: {
          firstname: string;
          lastname: string;
        };
      }>;
    };
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<DashboardData>> {
  const startTime = Date.now();
  
  try {
    console.log('=== Dashboard API Debug ===');
    console.log('Connection pool stats:', getConnectionPoolStats());
    
    // Enhanced cookie debugging
    const cookies = request.cookies;
    console.log('Available cookies:', cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value })));
    
    // Try multiple cookie names for the admin token
    const adminTokenNames = ['admin-token', 'admin_token', 'adminToken'];
    let adminToken: string | undefined;
    
    for (const tokenName of adminTokenNames) {
      const token = cookies.get(tokenName)?.value;
      if (token) {
        adminToken = token;
        console.log(`Found admin token in cookie: ${tokenName}`);
        break;
      }
    }
    
    // Also check Authorization header
    const authHeader = request.headers.get('authorization');
    if (!adminToken && authHeader?.startsWith('Bearer ')) {
      adminToken = authHeader.substring(7);
      console.log('Found admin token in Authorization header');
    }
    
    if (!adminToken) {
      console.log('No admin token found in any location');
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }
    
    // Verify JWT token manually with better error handling
    let adminSession;
    try {
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET;
      
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }
      
      const decoded = jwt.verify(adminToken, jwtSecret) as any;
      
      adminSession = {
        adminId: decoded.adminId,
        email: decoded.email,
        role: decoded.role,
        databaseId: decoded.databaseId,
        databaseUrl: decoded.databaseUrl
      };
      
      console.log('JWT decoded successfully:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        databaseId: adminSession.databaseId,
        hasDatabaseUrl: !!adminSession.databaseUrl
      });
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json(
        { success: false, error: 'Invalid authentication token. Please log in again.' },
        { status: 401 }
      );
    }
    
    // Validate required session data
    if (!adminSession.adminId || !adminSession.databaseId) {
      console.log('Invalid session data:', adminSession);
      return NextResponse.json(
        { success: false, error: 'Invalid session data. Please log in again.' },
        { status: 401 }
      );
    }
    
    console.log('Verifying database exists in master database...');
    
    // Test master database connection first
    try {
      await masterDb.$queryRaw`SELECT 1`;
      console.log('Master database connection verified');
    } catch (masterDbError) {
      console.error('Master database connection failed:', masterDbError);
      return NextResponse.json(
        { success: false, error: 'Database service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }
    
    // Verify database exists in master database with timeout
    const databaseRecord = await Promise.race([
      masterDb.database.findUnique({
        where: { 
          id: adminSession.databaseId,
          isActive: true 
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          isActive: true,
          databaseUrl: true, // Include database URL
          managedBy: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true,
              role: true
            }
          }
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 15000)
      )
    ]) as any;

    if (!databaseRecord) {
      console.log('Database record not found in master database:', adminSession.databaseId);
      return NextResponse.json(
        { success: false, error: 'Database configuration not found. Please contact support.' },
        { status: 404 }
      );
    }

    console.log('Database record found in master:', {
      id: databaseRecord.id,
      name: databaseRecord.name,
      isActive: databaseRecord.isActive,
      hasDatabaseUrl: !!databaseRecord.databaseUrl
    });
    
    // Use database URL from database record if not in session
    const effectiveDatabaseUrl = adminSession.databaseUrl || databaseRecord.databaseUrl;
    
    if (!effectiveDatabaseUrl) {
      console.log('No database URL available');
      return NextResponse.json(
        { success: false, error: 'Database configuration incomplete. Please contact support.' },
        { status: 500 }
      );
    }
    
    // Get database connection to admin's own database
    console.log('Connecting to admin database...');
    let db;
    try {
      const connection = await getAdminDatabaseConnection({
        databaseId: adminSession.databaseId,
        databaseUrl: effectiveDatabaseUrl
      });
      db = connection.db;
      console.log('Connected to admin database successfully');
    } catch (connectionError) {
      console.error('Failed to connect to admin database:', connectionError);
      return NextResponse.json(
        { success: false, error: 'Unable to connect to your database. Please try again.' },
        { status: 503 }
      );
    }

    // Test admin database connection
    try {
      await db.$queryRaw`SELECT 1`;
      console.log('Admin database connection verified');
    } catch (testError) {
      console.error('Admin database test query failed:', testError);
      return NextResponse.json(
        { success: false, error: 'Database connection unstable. Please try again.' },
        { status: 503 }
      );
    }

    // Get admin details from their own database
    const adminDetails = await db.admin.findUnique({
      where: { id: adminSession.adminId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    }).catch(err => {
      console.error('Failed to fetch admin details:', err);
      return null;
    });

    console.log('Admin details from own database:', {
      found: !!adminDetails,
      isActive: adminDetails?.isActive
    });

    if (!adminDetails) {
      console.log('Error: Admin not found in their own database');
      return NextResponse.json(
        { success: false, error: 'Admin account not found. Please contact support.' },
        { status: 404 }
      );
    }

    if (!adminDetails.isActive) {
      console.log('Error: Admin account is not active');
      return NextResponse.json(
        { success: false, error: 'Admin account is not active. Please contact support.' },
        { status: 403 }
      );
    }

    // Get admin user details from beeusers table (if exists)
    const adminUser = await db.beeusers.findFirst({
      where: {
        email: adminDetails.email,
        databaseId: adminSession.databaseId,
        isAdmin: true
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        role: true,
        isAdmin: true,
        isConfirmed: true,
        createdAt: true
      }
    }).catch(err => {
      console.log('Admin user not found in beeusers table (this is normal):', err.message);
      return null;
    });

    console.log('Admin user details:', {
      found: !!adminUser,
      isAdmin: adminUser?.isAdmin,
      isConfirmed: adminUser?.isConfirmed
    });

    // Fetch dashboard statistics with better error handling
    console.log('Fetching dashboard statistics...');
    
    const queries = [
      // Stats queries - All filtered by databaseId
      () => db.beeusers.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      () => db.batch.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      () => db.certification.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      () => db.apiary.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      () => db.beeusers.count({
        where: {
          databaseId: adminSession.databaseId,
          isConfirmed: true
        }
      }),
      
      () => db.beeusers.count({
        where: {
          databaseId: adminSession.databaseId,
          isConfirmed: false
        }
      }),
      
      // Recent activity queries - All filtered by databaseId
      () => db.beeusers.findMany({
        where: { databaseId: adminSession.databaseId },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          createdAt: true,
          isConfirmed: true
        }
      }),
      
      () => db.batch.findMany({
        where: { databaseId: adminSession.databaseId },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          batchNumber: true,
          batchName: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              firstname: true,
              lastname: true
            }
          }
        }
      }),
      
      () => db.certification.findMany({
        where: { databaseId: adminSession.databaseId },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          verificationCode: true,
          certificationType: true,
          totalCertified: true,
          createdAt: true,
          user: {
            select: {
              firstname: true,
              lastname: true
            }
          }
        }
      })
    ];

    // Execute queries with individual error handling
    const results = await Promise.allSettled(
      queries.map(async (query, index) => {
        try {
          return await query();
        } catch (error) {
          console.error(`Query ${index} failed:`, error);
          throw error;
        }
      })
    );

    // Extract results with fallbacks
    const extractResult = (result: PromiseSettledResult<any>, fallback: any = 0) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error('Query failed:', result.reason);
        return fallback;
      }
    };

    const [
      totalUsers,
      totalBatches,
      totalCertifications,
      totalApiaries,
      activeUsers,
      pendingUsers,
      recentUsers,
      recentBatches,
      recentCertifications
    ] = results;

    const statsData = {
      totalUsers: extractResult(totalUsers),
      totalBatches: extractResult(totalBatches),
      totalCertifications: extractResult(totalCertifications),
      totalApiaries: extractResult(totalApiaries),
      activeUsers: extractResult(activeUsers),
      pendingUsers: extractResult(pendingUsers)
    };

    const activityData = {
      recentUsers: extractResult(recentUsers, []),
      recentBatches: extractResult(recentBatches, []),
      recentCertifications: extractResult(recentCertifications, []).map((cert: any) => ({
        ...cert,
        totalCertified: cert.totalCertified?.toString() || '0'
      }))
    };

    console.log('Data fetched successfully:', {
      ...statsData,
      recentUsersCount: activityData.recentUsers.length,
      recentBatchesCount: activityData.recentBatches.length,
      recentCertificationsCount: activityData.recentCertifications.length,
      processingTime: Date.now() - startTime
    });

    // Return dashboard data
    const responseData: DashboardData = {
      success: true,
      data: {
        admin: {
          id: adminDetails.id,
          firstname: adminDetails.firstname,
          lastname: adminDetails.lastname,
          email: adminDetails.email,
          role: adminDetails.role
        },
        database: {
          id: databaseRecord.id,
          name: databaseRecord.name,
          displayName: databaseRecord.displayName
        },
        stats: statsData,
        recentActivity: activityData
      }
    };

    // Add admin user info if available
    if (adminUser) {
      responseData.data!.adminUser = {
        id: adminUser.id,
        firstname: adminUser.firstname,
        lastname: adminUser.lastname,
        email: adminUser.email,
        role: adminUser.role,
        isAdmin: adminUser.isAdmin,
        isConfirmed: adminUser.isConfirmed,
        createdAt: adminUser.createdAt
      };
    }

    console.log('Dashboard API completed successfully in', Date.now() - startTime, 'ms');
    console.log('Final connection pool stats:', getConnectionPoolStats());

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Dashboard API error:', error);
    console.log('Connection pool stats on error:', getConnectionPoolStats());
    
    // Handle specific error types
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
      });
      
      // Handle Prisma connection errors specifically
      if (error.message.includes('too many clients already') ||
          error.message.includes('connection pool') ||
          error.message.includes('FATAL: sorry, too many clients')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Database connection limit reached. Please try again in a moment.' 
          },
          { status: 503 }
        );
      }
      
      // Handle authentication errors
      if (error.message.includes('jwt') || 
          error.message.includes('token') ||
          error.message.includes('authentication') ||
          error.message.includes('JsonWebTokenError') ||
          error.message.includes('TokenExpiredError')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication failed. Please log in again.' 
          },
          { status: 401 }
        );
      }
      
      // Handle database authentication errors
      if (error.message.includes('authentication failed') ||
          error.message.includes('database credentials') ||
          error.message.includes('not valid')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Database authentication failed. Please contact support.' 
          },
          { status: 503 }
        );
      }
      
      // Handle database not found errors
      if (error.message.includes('Database configuration not found') ||
          error.message.includes('Admin not found in target database')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Database configuration error. Please contact support.' 
          },
          { status: 404 }
        );
      }
      
      // Handle timeout errors
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout. Please try again.' 
          },
          { status: 408 }
        );
      }
      
      // Handle permission errors
      if (error.message.includes('Admin account is not active') ||
          error.message.includes('permission') ||
          error.message.includes('access denied')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Access denied. Your account may be inactive.' 
          },
          { status: 403 }
        );
      }
    }
    
    // Generic error response
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred. Please try again later.' 
      },
      { status: 500 }
    );
    
  } finally {
    // Log final processing time
    console.log('Dashboard API request completed in', Date.now() - startTime, 'ms');
  }
}