import { NextRequest, NextResponse } from 'next/server';
import { masterDb } from '@/lib/database-connection';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const inviteCode = await masterDb.inviteCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        database: {
          select: {
            id: true,
            name: true,
            displayName: true,
            isActive: true
          }
        },
        admin: {
          select: {
            firstname: true,
            lastname: true,
            email: true
          }
        }
      }
    });

    if (!inviteCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if code is still valid
    if (!inviteCode.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invite code has been deactivated' },
        { status: 400 }
      );
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Invite code has expired' },
        { status: 400 }
      );
    }

    if (inviteCode.usedCount >= inviteCode.maxUses) {
      return NextResponse.json(
        { success: false, error: 'Invite code has reached maximum usage' },
        { status: 400 }
      );
    }

    if (!inviteCode.database.isActive) {
      return NextResponse.json(
        { success: false, error: 'Database is not active' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        databaseId: inviteCode.database.id,
        databaseName: inviteCode.database.displayName,
        adminName: `${inviteCode.admin.firstname} ${inviteCode.admin.lastname}`,
        metadata: inviteCode.metadata
      }
    });
    
  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate invite code' },
      { status: 500 }
    );
  }
}