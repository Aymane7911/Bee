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
    
    // Get admin session - this might fail if database validation fails
    let adminSession;
    try {
      adminSession = await getAdminFromRequest(request);
      console.log('Admin session retrieved successfully:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        role: adminSession.role,
        databaseId: adminSession.databaseId,
        databaseUrl: adminSession.databaseUrl ? 'Present' : 'Missing'
      });
    } catch (authError) {
      // If getAdminFromRequest fails, try to extract info directly from JWT
      console.log('Direct admin auth failed, trying JWT extraction...');
      
      // Extract token manually (fallback approach)
      const cookies = request.cookies;
      const adminToken = cookies.get('admin-token')?.value;
      
      if (!adminToken) {
        throw new Error('No authentication token found');
      }
      
      // Verify JWT manually (you'll need to import jwt)
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(adminToken, process.env.JWT_SECRET) as any;
      
      adminSession = {
        adminId: decoded.adminId,
        email: decoded.email,
        role: decoded.role,
        databaseId: decoded.databaseId,
        databaseUrl: decoded.databaseUrl
      };
      
      console.log('JWT extracted successfully:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        databaseId: adminSession.databaseId
      });
    }
    
    console.log('Verifying database exists in master database...');
    
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
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
    ]) as any;

    if (!databaseRecord) {
      console.log('Database record not found in master database:', adminSession.databaseId);
      return NextResponse.json(
        { success: false, error: 'Database configuration not found' },
        { status: 404 }
      );
    }

    console.log('Database record found in master:', {
      id: databaseRecord.id,
      name: databaseRecord.name,
      isActive: databaseRecord.isActive
    });
    
    // Get database connection to admin's own database using the URL from JWT
    console.log('Connecting to admin database...');
    const { db } = await getAdminDatabaseConnection({
      databaseId: adminSession.databaseId,
      databaseUrl: adminSession.databaseUrl
    });

    console.log('Connected to admin database successfully');

    // Get admin details from their own database (this should work now)
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
    });

    console.log('Admin details from own database:', {
      found: !!adminDetails,
      isActive: adminDetails?.isActive
    });

    if (!adminDetails) {
      console.log('Error: Admin not found in their own database');
      return NextResponse.json(
        { success: false, error: 'Admin not found in target database' },
        { status: 404 }
      );
    }

    if (!adminDetails.isActive) {
      console.log('Error: Admin account is not active');
      return NextResponse.json(
        { success: false, error: 'Admin account is not active' },
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
      console.log('Admin user not found in beeusers table:', err.message);
      return null;
    });

    console.log('Admin user details:', {
      found: !!adminUser,
      isAdmin: adminUser?.isAdmin,
      isConfirmed: adminUser?.isConfirmed
    });

    // Fetch dashboard statistics from admin's database with error handling
    console.log('Fetching dashboard statistics...');
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
    ] = await Promise.allSettled([
      // Stats queries - All filtered by databaseId
      db.beeusers.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      db.batch.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      db.certification.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      db.apiary.count({
        where: { databaseId: adminSession.databaseId }
      }),
      
      db.beeusers.count({
        where: {
          databaseId: adminSession.databaseId,
          isConfirmed: true
        }
      }),
      
      db.beeusers.count({
        where: {
          databaseId: adminSession.databaseId,
          isConfirmed: false
        }
      }),
      
      // Recent activity queries - All filtered by databaseId
      db.beeusers.findMany({
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
      
      db.batch.findMany({
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
      
      db.certification.findMany({
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
    ]);

    // Extract results with fallbacks
    const extractResult = (result: PromiseSettledResult<any>, fallback: any = 0) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error('Query failed:', result.reason);
        return fallback;
      }
    };

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
        stack: error.stack
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
          error.message.includes('authentication')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication failed. Please log in again.' 
          },
          { status: 401 }
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