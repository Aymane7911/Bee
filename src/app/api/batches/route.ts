import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authenticateRequest } from "@/lib/auth";
import { getPrismaClientByDatabaseId } from "@/lib/prisma-manager";

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.warn('[GET /api/batches] ▶ No authenticated user found');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Handle both string and object returns from authenticateRequest
    const userId = typeof authResult === 'string' ? authResult : authResult.userId;
    const databaseId = typeof authResult === 'object' ? authResult.databaseId : null;
    const userIdInt = parseInt(userId);
        
    if (isNaN(userIdInt)) {
      console.error('[GET /api/batches] ▶ Invalid user ID format:', userId);
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    if (!databaseId) {
      console.error('[GET /api/batches] ▶ No database ID found in auth result');
      return NextResponse.json(
        { error: "Database ID not found" },
        { status: 400 }
      );
    }

    console.log(`[GET /api/batches] ▶ Fetching batches for user: ${userIdInt}, database: ${databaseId}`);

    // Get the appropriate Prisma client for this tenant
    const prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      console.error(`[GET /api/batches] ▶ Failed to get Prisma client for database: ${databaseId}`);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const batches = await prisma.batch.findMany({
      where: {
        userId: userIdInt,
      },
      include: {
        apiaries: {
          select: {
            id: true,
            name: true,
            number: true,
            hiveCount: true,
            kilosCollected: true,
            latitude: true,
            longitude: true,
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`[GET /api/batches] ▶ Found ${batches.length} batches for user ${userIdInt}`);

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("[GET /api/batches] ▶ Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch batches" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
             
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Handle both string and object returns from authenticateRequest
    const userId = typeof authResult === 'string' ? authResult : authResult.userId;
    const databaseId = typeof authResult === 'object' ? authResult.databaseId : null;
    const userIdInt = parseInt(userId);
             
    if (isNaN(userIdInt)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    if (!databaseId) {
      return NextResponse.json(
        { error: "Database ID not found" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this tenant
    const prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      console.error(`[POST /api/batches] ▶ Failed to get Prisma client for database: ${databaseId}`);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Get the user's databaseId from the tenant database
    const user = await prisma.beeusers.findUnique({
      where: { id: userIdInt },
      select: { databaseId: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
      
    const body = await request.json();
    const { apiaries, ...batchData } = body;

    // Validate required fields
    if (!batchData.batchNumber) {
      return NextResponse.json(
        { error: "Batch number is required" },
        { status: 400 }
      );
    }
 
    const parseCoordinate = (value: any): number => {
      if (value === null || value === undefined || value === '') {
        return 0; // Default to 0 instead of null
      }
             
      const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
             
      if (isNaN(parsed)) {
        return 0; // Default to 0 for invalid numbers
      }
             
      return parsed;
    };

    console.log(`[POST /api/batches] ▶ Creating batch for user: ${userIdInt}, database: ${databaseId}`);
 
    const batch = await prisma.batch.create({
      data: {
        ...batchData,
        weightKg: parseFloat(batchData.weightKg) || 0, // This is the total honey collected
        userId: userIdInt,
        databaseId: user.databaseId, // Add the required databaseId
        // Initialize honey tracking fields
        totalHoneyCollected: parseFloat(batchData.weightKg) || 0, // Same as weightKg for consistency
        honeyCertified: 0, // No honey certified initially
        honeyRemaining: parseFloat(batchData.weightKg) || 0, // All honey is remaining initially
        status: batchData.status || 'pending', // Add default status
        apiaries: {
          create: apiaries?.map((apiary: any) => ({
            name: apiary.name || '',
            number: apiary.number || '',
            hiveCount: parseInt(apiary.hiveCount) || 0,
            kilosCollected: parseFloat(apiary.kilosCollected) || 0,
            latitude: parseCoordinate(apiary.latitude),
            longitude: parseCoordinate(apiary.longitude),
            userId: userIdInt, // Add userId for apiary
            databaseId: user.databaseId, // Add the required databaseId
          })) || []
        }
      },
      include: {
        apiaries: true,
      },
    });

    console.log(`[POST /api/batches] ▶ Created batch: ${batch.id} for user: ${userIdInt}`);
 
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("[POST /api/batches] ▶ Error:", error);
    
    // Handle Prisma-specific errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
  return NextResponse.json(
    { error: "Batch number already exists" },
    { status: 409 }
  );
}
    
    return NextResponse.json(
      { error: "Failed to create batch" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authentication - get userId and convert to number
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Handle both string and object returns from authenticateRequest
    const userIdString = typeof authResult === 'string' ? authResult : authResult.userId;
    const databaseId = typeof authResult === 'object' ? authResult.databaseId : null;
    const userId = parseInt(userIdString);

    if (!databaseId) {
      return NextResponse.json(
        { error: "Database ID not found" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this tenant
    const prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      console.error(`[PUT /api/batches] ▶ Failed to get Prisma client for database: ${databaseId}`);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Get the user's databaseId from the tenant database
    const user = await prisma.beeusers.findUnique({
      where: { id: userId },
      select: { databaseId: true }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const contentType = request.headers.get('content-type');
    let data;
    
    // Handle both form data and JSON
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      data = JSON.parse(formData.get('data') as string);
    } else {
      data = await request.json();
    }
    
    const { batchId, updatedFields, apiaries, batchJars, jarCertifications } = data;

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    console.log(`[PUT /api/batches] ▶ Updating batch: ${batchId} for user: ${userId}, database: ${databaseId}`);

    // Get the original batch to understand current state
    const originalBatch = await prisma.batch.findFirst({
      where: { 
        id: batchId,
        userId: userId // Ensure user owns this batch
      },
      select: { 
        weightKg: true, // This is the total honey collected
        totalHoneyCollected: true,
        honeyCertified: true,
        honeyRemaining: true
      }
    });

    if (!originalBatch) {
      return NextResponse.json(
        { error: 'Batch not found or access denied' },
        { status: 404 }
      );
    }

    // Calculate honey amounts correctly using weightKg as the source of truth
    let totalHoneyCertifiedInThisSession = 0;
    let totalJarsUsed = 0;

    if (batchJars && batchJars.length > 0) {
      totalHoneyCertifiedInThisSession = batchJars.reduce((sum: number, jar: any) => {
        return sum + (jar.size * jar.quantity / 1000); // Convert grams to kg
      }, 0);
      
      totalJarsUsed = batchJars.reduce((sum: number, jar: any) => sum + jar.quantity, 0);
    }

    // Use weightKg as the definitive source for total honey collected
    const totalHoneyCollected = originalBatch.weightKg || originalBatch.totalHoneyCollected || 0;

    // Calculate cumulative certified amount
    const previousTotalCertified = originalBatch.honeyCertified || 0;
    const newTotalCertified = previousTotalCertified + totalHoneyCertifiedInThisSession;

    // Calculate remaining honey after this certification
    const newHoneyRemaining = Math.max(0, totalHoneyCollected - newTotalCertified);

    // Calculate certification breakdowns from batchJars
    let originOnly = 0;
    let qualityOnly = 0;
    let bothCertifications = 0;

    if (batchJars && jarCertifications) {
      batchJars.forEach((jar: any) => {
        const jarTotalWeight = (jar.size * jar.quantity) / 1000; // Convert to kg
        const certification = jarCertifications[jar.id];

        if (certification) {
          if (certification.origin && certification.quality) {
            bothCertifications += jarTotalWeight;
          } else if (certification.origin && !certification.quality) {
            originOnly += jarTotalWeight;
          } else if (!certification.origin && certification.quality) {
            qualityOnly += jarTotalWeight;
          }
        }
      });
    }

    // Calculate percentages based on the total honey collected (weightKg)
    const originOnlyPercent = totalHoneyCollected > 0 ? Math.round((originOnly / totalHoneyCollected) * 100) : 0;
    const qualityOnlyPercent = totalHoneyCollected > 0 ? Math.round((qualityOnly / totalHoneyCollected) * 100) : 0;
    const bothCertificationsPercent = totalHoneyCollected > 0 ? Math.round((bothCertifications / totalHoneyCollected) * 100) : 0;
    const uncertifiedPercent = totalHoneyCollected > 0 ? Math.round((newHoneyRemaining / totalHoneyCollected) * 100) : 0;

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };

    // Only update fields that are provided
    if (updatedFields) {
      if (updatedFields.status !== undefined) updateData.status = updatedFields.status;
      if (updatedFields.jarCertifications !== undefined) updateData.jarCertifications = updatedFields.jarCertifications;
      if (updatedFields.certificationDate !== undefined) updateData.certificationDate = updatedFields.certificationDate;
      if (updatedFields.expiryDate !== undefined) updateData.expiryDate = updatedFields.expiryDate;
      if (updatedFields.completedChecks !== undefined) updateData.completedChecks = updatedFields.completedChecks;
      if (updatedFields.totalChecks !== undefined) updateData.totalChecks = updatedFields.totalChecks;
    }

    // Add honey tracking if jars are being processed
    if (batchJars && batchJars.length > 0) {
      updateData.totalHoneyCollected = totalHoneyCollected;
      updateData.honeyCertified = newTotalCertified;
      updateData.honeyRemaining = newHoneyRemaining;
      updateData.originOnly = originOnly;
      updateData.qualityOnly = qualityOnly;
      updateData.bothCertifications = bothCertifications;
      updateData.uncertified = newHoneyRemaining;
      updateData.originOnlyPercent = originOnlyPercent;
      updateData.qualityOnlyPercent = qualityOnlyPercent;
      updateData.bothCertificationsPercent = bothCertificationsPercent;
      updateData.uncertifiedPercent = uncertifiedPercent;
      updateData.jarsUsed = totalJarsUsed;
    }

    // Helper function to safely parse coordinates
    const parseCoordinateForUpdate = (value: any): number => {
      if (value == null || value === '' || value === undefined) {
        return 0; // Default to 0 instead of null
      }
      
      const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
      
      if (isNaN(parsed)) {
        return 0; // Default to 0 for invalid numbers
      }
      
      return parsed;
    };

    // Update the batch using transaction for data consistency
    const updatedBatch = await prisma.$transaction(async (tx) => {
      // Update the batch
      const batch = await tx.batch.update({
        where: { id: batchId },
        data: updateData
      });

      // Update associated apiaries if provided
      if (apiaries && apiaries.length > 0) {
        for (const apiaryData of apiaries) {
          // Find the apiary by name and number
          const existingApiary = await tx.apiary.findFirst({
            where: {
              name: apiaryData.name,
              number: apiaryData.number,
              batchId: batchId
            }
          });

          if (existingApiary) {
            // Update existing apiary
            await tx.apiary.update({
              where: { id: existingApiary.id },
              data: {
                hiveCount: apiaryData.hiveCount || 0,
                latitude: parseCoordinateForUpdate(apiaryData.latitude),
                longitude: parseCoordinateForUpdate(apiaryData.longitude),
                kilosCollected: apiaryData.kilosCollected || 0,
              }
            });
          } else {
            // Create new apiary
            await tx.apiary.create({
              data: {
                name: apiaryData.name || '',
                number: apiaryData.number || '',
                hiveCount: apiaryData.hiveCount || 0,
                latitude: parseCoordinateForUpdate(apiaryData.latitude),
                longitude: parseCoordinateForUpdate(apiaryData.longitude),
                kilosCollected: apiaryData.kilosCollected || 0,
                databaseId: user.databaseId,
                batchId: batchId,
                userId: userId
              }
            });
          }
        }
      }

      return batch;
    });

    console.log('Batch update summary:', {
      batchId,
      totalHoneyCollected,
      totalHoneyCertifiedInThisSession,
      newTotalCertified,
      newHoneyRemaining,
      totalJarsUsed
    });

    return NextResponse.json({
      success: true,
      message: 'Batch updated successfully',
      batch: updatedBatch,
      summary: {
        totalHoneyCollected,
        honeyCertifiedThisSession: totalHoneyCertifiedInThisSession,
        totalHoneyCertified: newTotalCertified,
        honeyRemaining: newHoneyRemaining,
        jarsUsed: totalJarsUsed,
        certificationBreakdown: {
          originOnly,
          qualityOnly,
          bothCertifications,
          uncertified: newHoneyRemaining
        }
      }
    });

  } catch (error) {
    console.error('Error updating batch:', error);
    return NextResponse.json(
      { error: 'Failed to update batch' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.warn('[DELETE /api/batches] ▶ No authenticated user found');
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Handle both string and object returns from authenticateRequest
    const userId = typeof authResult === 'string' ? authResult : authResult.userId;
    const databaseId = typeof authResult === 'object' ? authResult.databaseId : null;
    const userIdInt = parseInt(userId);
        
    if (isNaN(userIdInt)) {
      console.error('[DELETE /api/batches] ▶ Invalid user ID format:', userId);
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    if (!databaseId) {
      console.error('[DELETE /api/batches] ▶ No database ID found in auth result');
      return NextResponse.json(
        { error: "Database ID not found" },
        { status: 400 }
      );
    }

    // Get the appropriate Prisma client for this tenant
    const prisma = await getPrismaClientByDatabaseId(databaseId);
    if (!prisma) {
      console.error(`[DELETE /api/batches] ▶ Failed to get Prisma client for database: ${databaseId}`);
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Extract batchId from URL parameters
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    
    if (!batchId) {
      console.error('[DELETE /api/batches] ▶ No batch ID provided');
      return NextResponse.json(
        { error: "Batch ID is required" },
        { status: 400 }
      );
    }

    console.log(`[DELETE /api/batches] ▶ Attempting to delete batch: ${batchId} for user: ${userIdInt}, database: ${databaseId}`);

    // Verify the batch exists and belongs to the authenticated user
    const existingBatch = await prisma.batch.findFirst({
      where: {
        id: batchId,
        userId: userIdInt,
      },
      include: {
        apiaries: true,
      },
    });

    if (!existingBatch) {
      console.warn(`[DELETE /api/batches] ▶ Batch not found or access denied: ${batchId}`);
      return NextResponse.json(
        { error: "Batch not found or access denied" },
        { status: 404 }
      );
    }

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // First, unlink apiaries from this batch (preserve the apiary locations)
      await tx.apiary.updateMany({
        where: {
          batchId: batchId,
        },
        data: {
          batchId: null, // Remove the batch association but keep the apiary
        },
      });

      // Then delete the batch itself
      await tx.batch.delete({
        where: {
          id: batchId,
        },
      });
    });

    console.log(`[DELETE /api/batches] ▶ Successfully deleted batch: ${batchId} and unlinked ${existingBatch.apiaries.length} apiaries`);

    return NextResponse.json(
      { 
        message: "Batch deleted successfully. Apiary locations have been preserved.",
        deletedBatch: {
          id: batchId,
          batchNumber: existingBatch.batchNumber,
          unlinkedApiariesCount: existingBatch.apiaries.length
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("[DELETE /api/batches] ▶ Error:", error);
    return NextResponse.json(
      { error: "Failed to delete batch" },
      { status: 500 }
    );
  }
}