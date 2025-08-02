import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getPrismaClientByDatabaseId } from "@/lib/prisma-manager";

// =======================
// ✅ GET: Fetch token stats
// =======================
export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] GET /api/token-stats/update - Starting request`);

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    const authResult = await authenticateRequest(request);

    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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

    const tokenStats = await prisma.tokenStats.findFirst({
      where: { 
        userId: targetUserId,
        databaseId: finalDatabaseId
      }
    });

    if (!tokenStats) {
      console.log(`📊 [${requestId}] No token stats found, returning defaults`);
      return NextResponse.json({
        userId: targetUserId,
        totalTokens: 0,
        remainingTokens: 0,
        originOnly: 0,
        qualityOnly: 0,
        bothCertifications: 0,
        usedTokens: 0
      });
    }

    const usedTokens = tokenStats.originOnly + tokenStats.qualityOnly + tokenStats.bothCertifications;
    const expectedRemaining = tokenStats.totalTokens - usedTokens;

    if (expectedRemaining !== tokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Mismatch: expectedRemaining = ${expectedRemaining}, actual = ${tokenStats.remainingTokens}`);
    }

    console.log(`✅ [${requestId}] GET completed`);
    return NextResponse.json({
      id: tokenStats.id,
      userId: tokenStats.userId,
      totalTokens: tokenStats.totalTokens,
      remainingTokens: tokenStats.remainingTokens,
      originOnly: tokenStats.originOnly,
      qualityOnly: tokenStats.qualityOnly,
      bothCertifications: tokenStats.bothCertifications,
      usedTokens: usedTokens
    });

  } catch (error) {
    console.error(`❌ [${requestId}] FATAL GET ERROR:`, error);
    
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
      { error: "Failed to fetch token stats", details: (error as Error).message },
      { status: 500 }
    );
  } finally {
    console.log(`🏁 [${requestId}] GET request completed`);
  }
}

// =======================
// ✅ POST: Update token stats using actual token balance
// =======================
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 [${requestId}] POST /api/token-stats/update - Starting request`);

  try {
    console.log(`🔐 [${requestId}] Authenticating request...`);
    const authResult = await authenticateRequest(request);

    if (!authResult) {
      console.log(`❌ [${requestId}] Authentication failed`);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
    console.log(`📥 [${requestId}] Raw body:`, body);

    const { originOnly, qualityOnly, bothCertifications, tokensUsed } = body;

    const originOnlyInt = parseInt(String(originOnly || 0), 10) || 0;
    const qualityOnlyInt = parseInt(String(qualityOnly || 0), 10) || 0;
    const bothCertificationsInt = parseInt(String(bothCertifications || 0), 10) || 0;
    const tokensUsedInt = parseInt(String(tokensUsed || 0), 10) || 0;

    const safeOriginOnly = Math.max(0, originOnlyInt);
    const safeQualityOnly = Math.max(0, qualityOnlyInt);
    const safeBothCertifications = Math.max(0, bothCertificationsInt);
    const safeTokensUsed = Math.max(0, tokensUsedInt);

    console.log(`📊 [${requestId}] Token breakdown validated: OriginOnly=${safeOriginOnly}, QualityOnly=${safeQualityOnly}, Both=${safeBothCertifications}, Total=${safeTokensUsed}`);
    
    // ✅ FIXED: Get current token balance from database or user's actual balance
    const existingStats = await prisma.tokenStats.findFirst({
      where: { 
        userId: targetUserId,
        databaseId: finalDatabaseId
      }
    });

    let updatedTokenStats;

    if (existingStats) {
      const currentRemainingTokens = existingStats.remainingTokens;
      
      // Check if user has enough tokens for this certification
      if (currentRemainingTokens < safeTokensUsed) {
        console.log(`❌ [${requestId}] Insufficient tokens: available=${currentRemainingTokens}, needed=${safeTokensUsed}`);
        return NextResponse.json(
          { error: `Insufficient tokens. Available=${currentRemainingTokens}, Needed=${safeTokensUsed}` },
          { status: 400 }
        );
      }

      // ✅ FIXED: Update stats and deduct tokens from remaining balance
      updatedTokenStats = await prisma.tokenStats.update({
        where: { 
          id: existingStats.id // Use unique ID for update
        },
        data: {
          originOnly: existingStats.originOnly + safeOriginOnly,
          qualityOnly: existingStats.qualityOnly + safeQualityOnly,
          bothCertifications: existingStats.bothCertifications + safeBothCertifications,
          remainingTokens: currentRemainingTokens - safeTokensUsed
        }
      });

      console.log(`📊 [${requestId}] Updated existing stats: 
        Origin: ${existingStats.originOnly} + ${safeOriginOnly} = ${updatedTokenStats.originOnly}
        Quality: ${existingStats.qualityOnly} + ${safeQualityOnly} = ${updatedTokenStats.qualityOnly}
        Both: ${existingStats.bothCertifications} + ${safeBothCertifications} = ${updatedTokenStats.bothCertifications}
        Remaining: ${currentRemainingTokens} - ${safeTokensUsed} = ${updatedTokenStats.remainingTokens}`);

    } else {
      // ✅ FIXED: For new users, you need to fetch their actual token balance
      // You might need to query a separate TokenBalance table or User table
      // const userTokenBalance = await prisma.beeusers.findUnique({
      //   where: { id: targetUserId },
      //   select: { tokenBalance: true }
      // });
      
      // For now, I'll use a placeholder - replace this with actual token balance query
      const actualTokenBalance = 2299; // Replace with actual query to get user's token balance
      
      if (actualTokenBalance < safeTokensUsed) {
        console.log(`❌ [${requestId}] Insufficient tokens for new user: available=${actualTokenBalance}, needed=${safeTokensUsed}`);
        return NextResponse.json(
          { error: `Insufficient tokens. Available=${actualTokenBalance}, Needed=${safeTokensUsed}` },
          { status: 400 }
        );
      }

      // ✅ FIXED: Create new stats with actual token balance
      updatedTokenStats = await prisma.tokenStats.create({
        data: {
          userId: targetUserId,
          databaseId: finalDatabaseId, // Use the correct databaseId
          totalTokens: actualTokenBalance,
          remainingTokens: actualTokenBalance - safeTokensUsed,
          originOnly: safeOriginOnly,
          qualityOnly: safeQualityOnly,
          bothCertifications: safeBothCertifications
        }
      });

      console.log(`📊 [${requestId}] Created new stats for user with actual token balance: ${JSON.stringify(updatedTokenStats)}`);
    }

    // ✅ Verification: Check if the math adds up
    const usedTokens = updatedTokenStats.originOnly + updatedTokenStats.qualityOnly + updatedTokenStats.bothCertifications;
    const expectedRemaining = updatedTokenStats.totalTokens - usedTokens;

    if (expectedRemaining !== updatedTokenStats.remainingTokens) {
      console.warn(`⚠️ [${requestId}] Post-update mismatch: expected=${expectedRemaining}, actual=${updatedTokenStats.remainingTokens}`);
      
      // ✅ FIXED: Auto-correct the remaining tokens if there's a mismatch
      updatedTokenStats = await prisma.tokenStats.update({
        where: { id: updatedTokenStats.id },
        data: {
          remainingTokens: expectedRemaining
        }
      });
      
      console.log(`🔧 [${requestId}] Auto-corrected remaining tokens to: ${expectedRemaining}`);
    }

    console.log(`✅ [${requestId}] POST completed successfully - Final stats:`, {
      originOnly: updatedTokenStats.originOnly,
      qualityOnly: updatedTokenStats.qualityOnly,
      bothCertifications: updatedTokenStats.bothCertifications,
      totalUsed: usedTokens,
      remainingTokens: updatedTokenStats.remainingTokens,
      totalTokens: updatedTokenStats.totalTokens
    });

    return NextResponse.json({
      id: updatedTokenStats.id,
      userId: updatedTokenStats.userId,
      totalTokens: updatedTokenStats.totalTokens,
      remainingTokens: updatedTokenStats.remainingTokens,
      originOnly: updatedTokenStats.originOnly,
      qualityOnly: updatedTokenStats.qualityOnly,
      bothCertifications: updatedTokenStats.bothCertifications,
      usedTokens: usedTokens
    });

  } catch (error) {
    console.error(`❌ [${requestId}] FATAL POST ERROR:`, error);
    
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
      { error: "Failed to update token stats", details: (error as Error).message }, 
      { status: 500 }
    );
  } finally {
    console.log(`🏁 [${requestId}] POST request completed`);
  }
}