// app/api/user/profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from "@/lib/auth";
import { getPrismaClientByDatabaseId } from "@/lib/prisma-manager";
import fs from 'fs';
import path from 'path';

// GET - Get user profile (requires authentication)
export async function GET(request: NextRequest) {
  let prisma = null;
  
  try {
    const authResult = await authenticateRequest(request);
    
    console.log('Raw authResult from auth:', authResult, 'Type:', typeof authResult);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result object
    const { userId: userIdStr, databaseId } = authResult as { 
      userId: string; 
      databaseId: string; 
    };

    // Parse the userId to number
    const parsedUserId = parseInt(userIdStr, 10);

    // Validate the parsed ID
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      console.error('Invalid parsed userId:', parsedUserId, 'from original:', userIdStr);
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // Validate databaseId
    if (!databaseId) {
      return NextResponse.json(
        { error: "Database ID required" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this database
    prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    console.log('Parsed userId for Prisma:', parsedUserId, 'databaseId:', databaseId);

    const user = await prisma.beeusers.findFirst({
      where: { 
        id: parsedUserId,
        databaseId: databaseId
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        phonenumber: true,
        isConfirmed: true,
        phoneConfirmed: true,
        passportId: true,
        passportFile: true,
        isProfileComplete: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
  // Note: No need to disconnect here as the Prisma manager handles connection pooling
}

// PUT - Update user profile (requires authentication)
export async function PUT(request: NextRequest) {
  let prisma = null;
  
  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result object
    const { userId: userIdStr, databaseId } = authResult as { 
      userId: string; 
      databaseId: string; 
    };

    // Parse the userId to number
    const parsedUserId = parseInt(userIdStr, 10);

    // Validate the parsed ID
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    if (!databaseId) {
      return NextResponse.json(
        { error: "Database ID required" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this database
    prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { firstname, lastname, phonenumber } = body;

    // Validate input
    if (!firstname || !lastname) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.beeusers.updateMany({
      where: { 
        id: parsedUserId,
        databaseId: databaseId 
      },
      data: {
        firstname,
        lastname,
        phonenumber,
      },
    });

    if (updatedUser.count === 0) {
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch the updated user to return
    const user = await prisma.beeusers.findFirst({
      where: { 
        id: parsedUserId,
        databaseId: databaseId 
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        phonenumber: true,
        isProfileComplete: true,
      },
    });

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
  // Note: No need to disconnect here as the Prisma manager handles connection pooling
}

// POST - Update passport information with file upload (requires authentication)
export async function POST(request: NextRequest) {
  let prisma = null;
  
  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result object
    const { userId: userIdStr, databaseId } = authResult as { 
      userId: string; 
      databaseId: string; 
    };

    // Parse the userId to number
    const parsedUserId = parseInt(userIdStr, 10);

    // Validate the parsed ID
    if (isNaN(parsedUserId) || parsedUserId <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    if (!databaseId) {
      return NextResponse.json(
        { error: "Database ID required" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this database
    prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const passportId = formData.get('passportId') as string;
    const passportScan = formData.get('passportScan') as File | null;

    // Validate required fields
    if (!passportId?.trim()) {
      return NextResponse.json(
        { error: 'Passport ID is required' },
        { status: 400 }
      );
    }

    let passportFilePath: string | null = null;

    // Handle file upload if present
    if (passportScan && passportScan.size > 0) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      if (!allowedTypes.includes(passportScan.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only PNG, JPG, and PDF files are allowed.' },
          { status: 400 }
        );
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (passportScan.size > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 10MB.' },
          { status: 400 }
        );
      }

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'passports');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Get existing user to check for old passport file
      const existingUser = await prisma.beeusers.findFirst({
        where: { 
          id: parsedUserId,
          databaseId: databaseId 
        },
        select: { passportFile: true },
      });

      // Generate unique filename
      const fileExtension = path.extname(passportScan.name);
      const fileName = `passport_${parsedUserId}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      // Convert file to buffer and save
      const arrayBuffer = await passportScan.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      passportFilePath = `/uploads/passports/${fileName}`;

      // Delete old passport file if it exists
      if (existingUser?.passportFile) {
        const oldFilePath = path.join(process.cwd(), 'public', existingUser.passportFile);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (deleteError) {
            console.warn('Failed to delete old passport file:', deleteError);
          }
        }
      }
    }

    // Update user profile in database
    const updateResult = await prisma.beeusers.updateMany({
      where: { 
        id: parsedUserId,
        databaseId: databaseId 
      },
      data: {
        passportId: passportId.trim(),
        ...(passportFilePath && { passportFile: passportFilePath }),
        isProfileComplete: true,
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Fetch the updated user to return
    const updatedUser = await prisma.beeusers.findFirst({
      where: { 
        id: parsedUserId,
        databaseId: databaseId 
      },
      select: {
        id: true,
        passportId: true,
        passportFile: true,
        isProfileComplete: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Passport information updated successfully',
      user: updatedUser,
    }, { status: 200 });

  } catch (error) {
    console.error('Passport update error:', error);
    
    // Handle Prisma-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { 
            error: 'This passport ID is already in use',
            details: error.message 
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to update passport information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
  // Note: No need to disconnect here as the Prisma manager handles connection pooling
}