import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/admin-auth';
import { getDatabaseFromSession } from '@/lib/database-connection';

export async function POST(request: NextRequest) {
  console.log('=== Register as User API Started ===');
  
  try {
    // 1. Get admin session from request with detailed logging
    console.log('Step 1: Getting admin session from request...');
    
    let adminSession;
    try {
      adminSession = await getAdminFromRequest(request);
      console.log('✅ Admin session retrieved successfully');
      console.log('Admin session details:', {
        adminId: adminSession.adminId,
        email: adminSession.email,
        role: adminSession.role,
        databaseId: adminSession.databaseId,
        databaseUrl: adminSession.databaseUrl ? 'Present' : 'Missing'
      });
    } catch (authError) {
      console.log('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError instanceof Error ? authError.message : 'Unknown error' },
        { status: 401 }
      );
    }

    // 2. Get database connection with detailed logging
    console.log('Step 2: Getting database connection...');
    console.log('Database connection info:', {
      databaseId: adminSession.databaseId,
      hasUrl: !!adminSession.databaseUrl
    });

    let dbConnection;
    try {
      dbConnection = await getDatabaseFromSession(adminSession.databaseId, adminSession.databaseUrl);
      console.log('✅ Database connection established successfully');
      console.log('Database info:', {
        id: dbConnection.databaseInfo.id,
        name: dbConnection.databaseInfo.name,
        displayName: dbConnection.databaseInfo.displayName
      });
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError);
      return NextResponse.json({
        error: 'Database connection failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 });
    }

    const { db } = dbConnection;

    // 3. Validate admin exists in the connected database
    console.log('Step 3: Validating admin exists in target database...');
    
    let adminDetails;
    try {
      adminDetails = await db.admin.findUnique({
        where: { id: adminSession.adminId },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      if (!adminDetails) {
        console.log('❌ Admin not found in target database');
        console.log('Looking for admin ID:', adminSession.adminId);
        
        // List all admins in this database for debugging
        const allAdmins = await db.admin.findMany({
          select: { id: true, email: true, isActive: true }
        });
        console.log('Available admins in database:', allAdmins);
        
        return NextResponse.json({
          error: 'Admin not found in target database',
          details: {
            searchedForAdminId: adminSession.adminId,
            availableAdmins: allAdmins
          }
        }, { status: 404 });
      }

      if (!adminDetails.isActive) {
        console.log('❌ Admin account is inactive');
        return NextResponse.json(
          { error: 'Admin account is inactive' },
          { status: 403 }
        );
      }

      console.log('✅ Admin validated successfully');
      console.log('Admin details:', {
        id: adminDetails.id,
        email: adminDetails.email,
        role: adminDetails.role,
        isActive: adminDetails.isActive
      });

    } catch (adminValidationError) {
      console.log('❌ Error validating admin:', adminValidationError);
      return NextResponse.json({
        error: 'Admin validation failed',
        details: adminValidationError instanceof Error ? adminValidationError.message : 'Unknown error'
      }, { status: 500 });
    }

    // 4. Check if admin is already registered as user in this database
    console.log('Step 4: Checking if admin is already registered as user...');
    
    try {
      const existingUser = await db.beeusers.findFirst({
        where: {
          email: adminDetails.email,
          databaseId: adminSession.databaseId
        },
        select: {
          id: true,
          email: true,
          isAdmin: true,
          adminId: true,
          role: true,
          createdAt: true
        }
      });

      if (existingUser) {
        console.log('⚠️ Admin is already registered as user');
        console.log('Existing user details:', existingUser);
        
        return NextResponse.json({
          message: 'Admin is already registered as user',
          user: existingUser
        }, { status: 200 });
      }

      console.log('✅ Admin is not yet registered as user, proceeding with creation');

    } catch (existingUserCheckError) {
      console.log('❌ Error checking existing user:', existingUserCheckError);
      return NextResponse.json({
        error: 'Failed to check existing user',
        details: existingUserCheckError instanceof Error ? existingUserCheckError.message : 'Unknown error'
      }, { status: 500 });
    }

    // 5. Verify the database record exists in the current database
    console.log('Step 5: Verifying database record exists for foreign key...');
    
    try {
      const databaseRecord = await db.database.findUnique({
        where: { id: adminSession.databaseId },
        select: {
          id: true,
          name: true,
          displayName: true,
          isActive: true
        }
      });

      if (!databaseRecord) {
        console.log('❌ Database record not found in current connection');
        console.log('Expected database ID:', adminSession.databaseId);
        
        // List all available databases for debugging
        const availableDatabases = await db.database.findMany({
          select: { 
            id: true, 
            name: true, 
            displayName: true, 
            isActive: true 
          }
        });
        
        console.log('Available databases in current connection:');
        availableDatabases.forEach((dbRecord, index) => {
          console.log(`  ${index + 1}. ID: ${dbRecord.id}`);
          console.log(`     Name: ${dbRecord.name}`);
          console.log(`     Display: ${dbRecord.displayName}`);
          console.log(`     Active: ${dbRecord.isActive}`);
          console.log('     ---');
        });

        return NextResponse.json({
          error: 'Database foreign key validation failed',
          details: {
            expectedDatabaseId: adminSession.databaseId,
            message: 'The database ID from your session does not exist in the target database',
            availableDatabases: availableDatabases.map(db => ({
              id: db.id,
              name: db.name,
              displayName: db.displayName
            }))
          }
        }, { status: 400 });
      }

      console.log('✅ Database record validated successfully');
      console.log('Database record details:', databaseRecord);

    } catch (dbValidationError) {
      console.log('❌ Error during database validation:', dbValidationError);
      return NextResponse.json({
        error: 'Database validation error',
        details: dbValidationError instanceof Error ? dbValidationError.message : 'Unknown error'
      }, { status: 500 });
    }

    // 6. Create user record
    console.log('Step 6: Creating new user record...');
    
    const userData = {
      firstname: adminDetails.firstname,
      lastname: adminDetails.lastname,
      email: adminDetails.email,
      password: 'admin_placeholder', // You might want to handle this differently
      databaseId: adminSession.databaseId,
      isAdmin: true,
      adminId: adminDetails.id,
      role: 'admin',
      isConfirmed: true, // Admin users should be auto-confirmed
      isProfileComplete: true
    };
    
    console.log('User data to be created:', {
      ...userData,
      password: '[REDACTED]'
    });

    try {
      const newUser = await db.beeusers.create({
        data: userData,
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true,
          isAdmin: true,
          adminId: true,
          databaseId: true,
          createdAt: true,
          isConfirmed: true,
          isProfileComplete: true
        }
      });

      console.log('✅ User created successfully');
      console.log('New user details:', newUser);

      return NextResponse.json({
        message: 'Admin registered as user successfully',
        user: newUser
      }, { status: 201 });

    } catch (userCreationError) {
      console.log('❌ Error creating user:', userCreationError);
      
      // Enhanced error logging for Prisma errors
      if (userCreationError && typeof userCreationError === 'object') {
        const prismaError = userCreationError as any;
        console.log('Prisma error details:', {
          name: prismaError.name,
          code: prismaError.code,
          message: prismaError.message,
          meta: prismaError.meta,
          clientVersion: prismaError.clientVersion
        });

        // Specific handling for foreign key constraint errors
        if (prismaError.code === 'P2003') {
          console.log('Foreign key constraint violation details:');
          if (prismaError.meta && prismaError.meta.field_name) {
            console.log('Field causing issue:', prismaError.meta.field_name);
          }
          if (prismaError.meta && prismaError.meta.constraint) {
            console.log('Constraint name:', prismaError.meta.constraint);
          }
        }
      }

      return NextResponse.json({
        error: 'Failed to create user',
        details: userCreationError instanceof Error ? userCreationError.message : 'Unknown error',
        errorCode: (userCreationError as any)?.code,
        errorMeta: (userCreationError as any)?.meta,
        userData: {
          ...userData,
          password: '[REDACTED]'
        }
      }, { status: 500 });
    }

  } catch (globalError) {
    console.log('❌ Global error in register-as-user API:', globalError);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: globalError instanceof Error ? globalError.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    console.log('=== Register as User API Completed ===');
  }
}