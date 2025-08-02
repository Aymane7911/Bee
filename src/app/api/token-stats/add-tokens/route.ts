import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPrismaClientByDatabaseId } from "@/lib/prisma-manager";

// ======================= 
// ✅ POST: Add tokens to user's balance
// ======================= 
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/token-stats/add-tokens - Starting request`);

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    
    // Get the authenticated user data
    const authResult = await authenticateRequest(request);
        
    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Extract userId and databaseId from the auth result
    const { userId, databaseId } = authResult;
    console.log(`[${requestId}] ▶ Authenticated user ID:`, userId, 'Database ID:', databaseId);

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
          console.log(`[${requestId}] ▶ Using JWT databaseId:`, finalDatabaseId, 'email:', userEmail);
        }
      } catch (error) {
        console.warn(`[${requestId}] ▶ Could not decode JWT for databaseId fix`);
      }
    }

    if (!userEmail) {
      console.error(`[${requestId}] ▶ No user email found in JWT`);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    // Get Prisma client for the specific database
    const prisma = await getPrismaClientByDatabaseId(finalDatabaseId);
    
    if (!prisma) {
      console.error(`[${requestId}] ▶ Could not get Prisma client for databaseId:`, finalDatabaseId);
      return NextResponse.json(
        { error: "Database configuration not found" },
        { status: 404 }
      );
    }

    console.log(`[${requestId}] ▶ Using database ID:`, finalDatabaseId);

    // FIND THE CORRECT USER ID IN THE TARGET DATABASE
    // The user might have different IDs in different databases
    const userInTargetDb = await prisma.beeusers.findFirst({
      where: { 
        email: userEmail
      }
    });

    if (!userInTargetDb) {
      console.error(`[${requestId}] ▶ User not found in target database:`, finalDatabaseId);
      return NextResponse.json(
        { error: "User not found in target database. Please contact support." },
        { status: 404 }
      );
    }

    const targetUserId = userInTargetDb.id;
    console.log(`[${requestId}] ▶ Using target database user ID:`, targetUserId);

    const body = await request.json();
    console.log(`📥 [${requestId}] Request body:`, body);

    const tokensToAdd = parseInt(String(body.tokensToAdd || 0), 10);
    if (tokensToAdd <= 0) {
      console.log(`❌ [${requestId}] Invalid tokens amount: ${tokensToAdd}`);
      return NextResponse.json({ error: "Tokens to add must be greater than 0" }, { status: 400 });
    }
    console.log(`📊 [${requestId}] Adding ${tokensToAdd} tokens to user ${targetUserId}`);

    // Find or create tokenStats
    let tokenStats = await prisma.tokenStats.findUnique({ 
      where: { 
        userId: targetUserId,
        databaseId: finalDatabaseId
      } 
    });
    
    if (tokenStats) {
      tokenStats = await prisma.tokenStats.update({
        where: { 
          userId: targetUserId,
          databaseId: finalDatabaseId
        },
        data: {
          totalTokens: tokenStats.totalTokens + tokensToAdd,
          remainingTokens: tokenStats.remainingTokens + tokensToAdd,
        },
      });
      console.log(`📊 [${requestId}] Updated stats: Total=${tokenStats.totalTokens}, Remaining=${tokenStats.remainingTokens}`);
    } else {
      tokenStats = await prisma.tokenStats.create({
        data: {
          userId: targetUserId,
          totalTokens: tokensToAdd,
          remainingTokens: tokensToAdd,
          originOnly: 0,
          qualityOnly: 0,
          bothCertifications: 0,
          databaseId: finalDatabaseId,
        },
      });
      console.log(`📊 [${requestId}] Created stats:`, tokenStats);
    }

    // Auto-correct remaining tokens if mismatch
    const usedTokens = tokenStats.originOnly + tokenStats.qualityOnly + tokenStats.bothCertifications;
    const expectedRemaining = tokenStats.totalTokens - usedTokens;
    if (expectedRemaining !== tokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Remaining mismatch: expected=${expectedRemaining}, actual=${tokenStats.remainingTokens}`);
      tokenStats = await prisma.tokenStats.update({
        where: { 
          userId: targetUserId,
          databaseId: finalDatabaseId
        },
        data: { remainingTokens: expectedRemaining },
      });
      console.log(`🔧 [${requestId}] Corrected remaining to ${expectedRemaining}`);
    }

    console.log(`✅ [${requestId}] Final stats:`, tokenStats);
    return NextResponse.json({
      success: true,
      message: `Successfully added ${tokensToAdd} tokens`,
      tokenStats: { ...tokenStats, usedTokens },
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] FATAL ERROR:`, error);
    
    // Handle Prisma foreign key constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Database reference error. Please contact support.',
          details: 'Foreign key constraint violation',
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to add tokens", 
        details: error.message 
      }, 
      { status: 500 }
    );
  } finally {
    console.log(`🏁 [${requestId}] Request completed`);
  }
}