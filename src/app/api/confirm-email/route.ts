import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const databaseId = searchParams.get('db'); // Optional database ID parameter

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    console.log(`Confirming email with token: ${token}, database: ${databaseId || 'any'}`);

    // Find user by confirmation token
    // If database ID is provided, search within that database context
    const whereClause: any = { 
      confirmationToken: token,
      isConfirmed: false // Only find unconfirmed users
    };

    // If database ID is provided, add it to the search criteria
    if (databaseId) {
      whereClause.databaseId = databaseId;
    }

    const user = await prisma.beeusers.findFirst({
      where: whereClause
    });

    if (!user) {
      console.log(`User not found with token: ${token} in database: ${databaseId || 'any'}`);
      
      // Check if user exists but is already confirmed
      const confirmedUser = await prisma.beeusers.findFirst({
        where: {
          confirmationToken: token,
          ...(databaseId && { databaseId })
        }
      });

      if (confirmedUser && confirmedUser.isConfirmed) {
        // Get database info separately
        const database = await prisma.database.findUnique({
          where: { id: confirmedUser.databaseId }
        });

        return NextResponse.json(
          { 
            success: true,
            message: 'Email already confirmed',
            user: {
              id: confirmedUser.id,
              email: confirmedUser.email,
              firstname: confirmedUser.firstname,
              lastname: confirmedUser.lastname,
              database: database?.displayName || 'Unknown',
              databaseId: confirmedUser.databaseId
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Invalid or expired confirmation token',
          details: databaseId ? `Token not found in database ${databaseId}` : 'Token not found in any database'
        },
        { status: 400 }
      );
    }

    // Get database info separately
    const database = await prisma.database.findUnique({
      where: { id: user.databaseId }
    });

    console.log(`Found user: ${user.email} in database: ${database?.displayName || 'Unknown'}`);

    // Confirm the user
    const updatedUser = await prisma.beeusers.update({
      where: { id: user.id },
      data: {
        isConfirmed: true,
        confirmationToken: null, // Clear the token after confirmation
      }
    });

    console.log(`Email confirmed successfully for user: ${updatedUser.email}`);

    return NextResponse.json(
      { 
        success: true,
        message: 'Email confirmed successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          database: database?.displayName || 'Unknown',
          databaseId: updatedUser.databaseId
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Handle POST requests for form-based confirmation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, databaseId } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Confirmation token is required' },
        { status: 400 }
      );
    }

    // Use the same logic as GET request
    const whereClause: any = { 
      confirmationToken: token,
      isConfirmed: false
    };

    if (databaseId) {
      whereClause.databaseId = databaseId;
    }

    const user = await prisma.beeusers.findFirst({
      where: whereClause
    });

    if (!user) {
      // Check if already confirmed
      const confirmedUser = await prisma.beeusers.findFirst({
        where: {
          confirmationToken: token,
          ...(databaseId && { databaseId })
        }
      });

      if (confirmedUser && confirmedUser.isConfirmed) {
        // Get database info separately
        const database = await prisma.database.findUnique({
          where: { id: confirmedUser.databaseId }
        });

        return NextResponse.json(
          { 
            success: true,
            message: 'Email already confirmed',
            user: {
              id: confirmedUser.id,
              email: confirmedUser.email,
              firstname: confirmedUser.firstname,
              lastname: confirmedUser.lastname,
              database: database?.displayName || 'Unknown',
              databaseId: confirmedUser.databaseId
            }
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { 
          error: 'Invalid or expired confirmation token',
          details: databaseId ? `Token not found in database ${databaseId}` : 'Token not found in any database'
        },
        { status: 400 }
      );
    }

    // Confirm the user
    const updatedUser = await prisma.beeusers.update({
      where: { id: user.id },
      data: {
        isConfirmed: true,
        confirmationToken: null,
      }
    });

    // Get database info separately
    const database = await prisma.database.findUnique({
      where: { id: updatedUser.databaseId }
    });

    return NextResponse.json(
      { 
        success: true,
        message: 'Email confirmed successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          database: database?.displayName || 'Unknown',
          databaseId: updatedUser.databaseId
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error confirming email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to confirm email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}