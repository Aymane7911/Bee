import { NextResponse, NextRequest } from 'next/server';
import { authenticateRequest } from "@/lib/auth";
import { getPrismaClientByDatabaseId } from "@/lib/prisma-manager";

// UPDATED Type definitions to match the actual frontend structure
interface ApiaryObject {
  id: number;
  name: string;
  number: string;
  hiveCount: number;
  kilosCollected: number;
  locationId: number | null;
  location: any;
}

interface BatchRequestBody {
  batchNumber: string;
  batchName?: string;
  apiaries?: ApiaryObject[]; // Changed to match what frontend sends
  totalHives?: number;
  totalKg?: number; // Updated to totalKg
}

// GET: Fetch batches for logged-in user
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user data
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.warn('[GET /api/create-batch] ▶ No authenticated user found');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result
    const { userId, databaseId } = authResult;
    console.log('[GET /api/create-batch] ▶ Authenticated user ID:', userId, 'Database ID:', databaseId);

    // Get the correct databaseId from JWT and extract user email
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    let finalDatabaseId = databaseId;
    let userEmail = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.decode(token);
        if (payload && payload.databaseId) {
          finalDatabaseId = payload.databaseId;
          userEmail = payload.email;
          console.log('[GET /api/create-batch] ▶ Using JWT databaseId:', finalDatabaseId, 'email:', userEmail);
        }
      } catch (error) {
        console.warn('[GET /api/create-batch] ▶ Could not decode JWT for databaseId fix');
      }
    }

    if (!userEmail) {
      console.error('[GET /api/create-batch] ▶ No user email found in JWT');
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    // Get Prisma client for the specific database
    const prisma = await getPrismaClientByDatabaseId(finalDatabaseId);
    
    if (!prisma) {
      console.error('[GET /api/create-batch] ▶ Could not get Prisma client for databaseId:', finalDatabaseId);
      return NextResponse.json(
        { error: "Database configuration not found" },
        { status: 404 }
      );
    }

    console.log('[GET /api/create-batch] ▶ Using database ID:', finalDatabaseId);

    // FIND THE CORRECT USER ID IN THE TARGET DATABASE
    // The user might have different IDs in different databases
    const userInTargetDb = await prisma.beeusers.findFirst({
      where: { 
        email: userEmail
      }
    });

    if (!userInTargetDb) {
      console.error('[GET /api/create-batch] ▶ User not found in target database:', finalDatabaseId);
      return NextResponse.json(
        { error: "User not found in target database. Please contact support." },
        { status: 404 }
      );
    }

    const targetUserId = userInTargetDb.id;
    console.log('[GET /api/create-batch] ▶ Using target database user ID:', targetUserId);

    const batches = await prisma.batch.findMany({
      where: { 
        userId: targetUserId,
        databaseId: finalDatabaseId // Add database filter
      },
      orderBy: { createdAt: 'desc' },
      include: { apiaries: true },
    });

    const tokenStats = {
      totalTokens: 0,
      remainingTokens: 0,
      originOnly: 0,
      qualityOnly: 0,
      bothCertifications: 0,
    };

    const certifiedHoneyWeight = {
      originOnly: batches.reduce((sum, b) => sum + (b.originOnly || 0), 0),
      qualityOnly: batches.reduce((sum, b) => sum + (b.qualityOnly || 0), 0),
      bothCertifications: batches.reduce((sum, b) => sum + (b.bothCertifications || 0), 0),
    };

    return NextResponse.json({
      batches,
      tokenStats,
      certifiedHoneyWeight,
    });

  } catch (error) {
    console.error('[GET /api/create-batch] Error fetching batches:', error);
    return NextResponse.json({ message: 'An error occurred while fetching batches' }, { status: 500 });
  }
}

// FIXED POST: Handle the actual frontend data structure
export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user data
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result
    const { userId, databaseId } = authResult;
    console.log('[POST /api/create-batch] ▶ Authenticated user ID:', userId, 'Database ID:', databaseId);

    // Get the correct databaseId from JWT and extract user email
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    let finalDatabaseId = databaseId;
    let userEmail = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.decode(token);
        if (payload && payload.databaseId) {
          finalDatabaseId = payload.databaseId;
          userEmail = payload.email;
          console.log('[POST /api/create-batch] ▶ Using JWT databaseId:', finalDatabaseId, 'email:', userEmail);
        }
      } catch (error) {
        console.warn('[POST /api/create-batch] ▶ Could not decode JWT for databaseId fix');
      }
    }

    if (!userEmail) {
      console.error('[POST /api/create-batch] ▶ No user email found in JWT');
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    // Get Prisma client for the specific database
    const prisma = await getPrismaClientByDatabaseId(finalDatabaseId);
    
    if (!prisma) {
      console.error('[POST /api/create-batch] ▶ Could not get Prisma client for databaseId:', finalDatabaseId);
      return NextResponse.json(
        { error: "Database configuration not found" },
        { status: 404 }
      );
    }

    console.log('[POST /api/create-batch] ▶ Using database ID:', finalDatabaseId);

    // FIND THE CORRECT USER ID IN THE TARGET DATABASE
    // The user might have different IDs in different databases
    const userInTargetDb = await prisma.beeusers.findFirst({
      where: { 
        email: userEmail
      }
    });

    if (!userInTargetDb) {
      console.error('[POST /api/create-batch] ▶ User not found in target database:', finalDatabaseId);
      return NextResponse.json(
        { error: "User not found in target database. Please contact support." },
        { status: 404 }
      );
    }

    const targetUserId = userInTargetDb.id;
    console.log('[POST /api/create-batch] ▶ Using target database user ID:', targetUserId);

    const body = await request.json();
    // FIXED: Changed totalHoney to totalKg to match frontend
    const { batchNumber, batchName, apiaries = [], totalHives, totalKg } = body;

    console.log('[POST /api/create-batch] ▶ Request body:', body);

    if (!batchNumber) {
      return NextResponse.json({ message: 'Batch number is required' }, { status: 400 });
    }

    // FIXED: Add validation for totalKg
    if (!totalKg || totalKg <= 0) {
      return NextResponse.json({ message: 'Total honey amount (kg) is required and must be greater than 0' }, { status: 400 });
    }

    // FIXED: Validate apiaries array (not apiaryReferences)
    if (!Array.isArray(apiaries) || apiaries.length === 0) {
      return NextResponse.json({ message: 'At least one apiary is required' }, { status: 400 });
    }

    // Validate each apiary object
    for (const apiary of apiaries) {
      if (!apiary.id || typeof apiary.id !== 'number') {
        return NextResponse.json({ message: 'Each apiary must have a valid id' }, { status: 400 });
      }
      
      // Verify the apiary exists and belongs to the user in the same database
      const existingApiary = await prisma.apiary.findFirst({
        where: { 
          id: apiary.id,
          userId: targetUserId,
          databaseId: finalDatabaseId // Add database filter
        }
      });
      
      if (!existingApiary) {
        return NextResponse.json({ 
          message: `Apiary with ID ${apiary.id} not found or doesn't belong to user` 
        }, { status: 404 });
      }
    }

    const finalBatchName = batchName?.trim() || `${batchNumber}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;

    // Check if batch number already exists for this user in this database
    const existingBatch = await prisma.batch.findFirst({
      where: { 
        batchNumber, 
        userId: targetUserId,
        databaseId: finalDatabaseId // Add database filter
      },
    });

    if (existingBatch) {
      return NextResponse.json({ message: 'Batch number already exists' }, { status: 409 });
    }

    // STEP 1: Create the batch
    const batch = await prisma.batch.create({
      data: {
        user: { connect: { id: targetUserId } },
        database: { connect: { id: finalDatabaseId } }, // Connect to database
        batchNumber,
        batchName: finalBatchName,
        containerType: 'Glass',
        labelType: 'Standard',
        // FIXED: Use totalKg instead of totalHoney
        weightKg: totalKg,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        uncertified: 0,
        originOnlyPercent: 0,
        qualityOnlyPercent: 0,
        bothCertificationsPercent: 0,
        uncertifiedPercent: 0,
        completedChecks: 0,
        totalChecks: 4,
      },
    });

    console.log('[POST /api/create-batch] ▶ Created batch:', batch);

    // STEP 2: UPDATE existing apiaries with batch ID
    const updatedApiaries = [];

    for (const apiary of apiaries) {
      console.log('[POST /api/create-batch] ▶ Updating apiary with ID:', apiary.id);
      
      // UPDATE the existing apiary record to link it to the batch
      const updatedApiary = await prisma.apiary.update({
        where: { id: apiary.id },
        data: {
          batchId: batch.id, // Link to the batch
          // Keep the existing kilosCollected value from the apiary object
        },
      });
      
      updatedApiaries.push(updatedApiary);
      console.log('[POST /api/create-batch] ▶ Updated apiary:', updatedApiary);
    }

    console.log('[POST /api/create-batch] ▶ All apiaries updated successfully');

    // STEP 3: Return the complete batch with associated apiaries
    const completeBatch = await prisma.batch.findUnique({
      where: { id: batch.id },
      include: { apiaries: true },
    });

    // Get updated list of all batches for the user in this database
    const batches = await prisma.batch.findMany({
      where: { 
        userId: targetUserId,
        databaseId: finalDatabaseId // Add database filter
      },
      orderBy: { createdAt: 'desc' },
      include: { apiaries: true },
    });

    console.log('[POST /api/create-batch] ▶ Success - returning batch');

    return NextResponse.json({ 
      batch: completeBatch, 
      batchNumber: completeBatch?.batchNumber,
      batches,
      message: `Batch created successfully and ${updatedApiaries.length} existing apiaries updated`
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/create-batch] Error creating batch:', error);
    
    // Handle Prisma foreign key constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        {
          message: 'Database reference error. Please contact support.',
          error: 'Foreign key constraint violation',
        },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to create batch';
    return NextResponse.json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error : undefined 
    }, { status: 500 });
  }
}