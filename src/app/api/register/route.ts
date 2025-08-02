import { NextResponse } from 'next/server';
import { masterDb, getAdminDatabaseConnection } from '@/lib/database-connection';
import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Get base URL from request headers
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

    const {
      firstname,
      lastname,
      email,
      phonenumber,
      password,
      databaseId,
      databaseName,
      inviteCode,
      role = 'employee', // Default role for regular users
      useEmail = true, // Frontend sends this to indicate email/phone preference
    } = body;

    console.log('Registration request received:', {
      firstname,
      lastname,
      email: email ? 'provided' : 'not provided',
      phonenumber: phonenumber ? 'provided' : 'not provided',
      useEmail,
      role,
      hasInviteCode: !!inviteCode,
      databaseId,
      databaseName
    });

    // Validate required fields
    if (!firstname?.trim() || !lastname?.trim() || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'First name, last name, and password are required.' 
      }, { status: 400 });
    }

    // Validate contact information based on frontend preference
    if (useEmail) {
      if (!email?.trim()) {
        return NextResponse.json({ 
          success: false, 
          error: 'Email address is required.' 
        }, { status: 400 });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Please enter a valid email address.' 
        }, { status: 400 });
      }
    } else {
      if (!phonenumber?.trim()) {
        return NextResponse.json({ 
          success: false, 
          error: 'Phone number is required.' 
        }, { status: 400 });
      }
      if (phonenumber.length < 10) {
        return NextResponse.json({ 
          success: false, 
          error: 'Please enter a valid phone number.' 
        }, { status: 400 });
      }
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password must be at least 8 characters long.' 
      }, { status: 400 });
    }

    // Role validation for regular users (not admins)
    const validRoles = ['employee', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid role specified.' 
      }, { status: 400 });
    }

    let dbInstance;
    let registrationMethod = '';

    // PRIORITY 1: Handle direct database specification
    if (databaseId?.trim() || databaseName?.trim()) {
      registrationMethod = 'direct_database';
      
      // Query master database for database instance
      dbInstance = await masterDb.database.findFirst({
        where: {
          OR: [
            { id: databaseId?.trim() },
            { displayName: databaseName?.trim() },
            { name: databaseName?.trim() }
          ],
          isActive: true,
        },
      });

      if (!dbInstance) {
        return NextResponse.json({ 
          success: false, 
          error: 'Database not found or inactive.' 
        }, { status: 404 });
      }
      
      console.log(`Using directly specified database: ${dbInstance.id} (${dbInstance.displayName || dbInstance.name})`);
    } 
    // PRIORITY 2: Use default database (typically the first active one)
    else {
      registrationMethod = 'default_database';
      
      // Look for any active database in master database
      dbInstance = await masterDb.database.findFirst({
        where: {
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      });

      if (!dbInstance) {
        return NextResponse.json({ 
          success: false, 
          error: 'No active database available for registration. Please contact support.' 
        }, { status: 500 });
      }
      
      console.log(`Using default database: ${dbInstance.id} (${dbInstance.displayName || dbInstance.name})`);
    }

    // Get connection to the target database
    console.log(`Connecting to target database: ${dbInstance.id}`);
    const { db: targetDb } = await getAdminDatabaseConnection({
      databaseId: dbInstance.id,
      databaseUrl: dbInstance.databaseUrl
    });

    // Check for existing users in the target database
    console.log(`Checking for existing users in database: ${dbInstance.id}`);
    
    let existingUser = null;
    let conflictField = '';

    // Check the primary contact method first
    if (useEmail && email?.trim()) {
      existingUser = await targetDb.beeusers.findFirst({
        where: {
          databaseId: dbInstance.id,
          email: email.trim()
        }
      });
      if (existingUser) conflictField = 'email';
    } else if (!useEmail && phonenumber?.trim()) {
      existingUser = await targetDb.beeusers.findFirst({
        where: {
          databaseId: dbInstance.id,
          phonenumber: phonenumber.trim()
        }
      });
      if (existingUser) conflictField = 'phone number';
    }

    if (existingUser) {
      return NextResponse.json({ 
        success: false, 
        error: `An account already exists with that ${conflictField} in ${dbInstance.displayName || dbInstance.name}.` 
      }, { status: 400 });
    }

    // Check user count limit
    const currentUserCount = await targetDb.beeusers.count({
      where: { databaseId: dbInstance.id }
    });

    if (dbInstance.maxUsers && currentUserCount >= dbInstance.maxUsers) {
      return NextResponse.json({ 
        success: false, 
        error: `${dbInstance.displayName || dbInstance.name} has reached its maximum user limit of ${dbInstance.maxUsers}.` 
      }, { status: 400 });
    }

    // Hash password and generate confirmation token
    const hashedPassword = await bcrypt.hash(password, 12);
    const confirmationToken = randomUUID();
    
    // Email confirmation is required if email is provided
    const requiresConfirmation = email?.trim() ? true : false;

    // Create user in the target database
    const result = await targetDb.$transaction(async (tx) => {
      console.log(`Creating user in database: ${dbInstance.id}`);
      
      const newUser = await tx.beeusers.create({
        data: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          email: email?.trim() || '',
          phonenumber: phonenumber?.trim() || null,
          password: hashedPassword,
          confirmationToken: requiresConfirmation ? confirmationToken : null,
          isConfirmed: !requiresConfirmation,
          role,
          isProfileComplete: false,
          databaseId: dbInstance.id,
        },
      });

      // Create token stats
      await tx.tokenStats.create({
        data: {
          userId: newUser.id,
          totalTokens: 0,
          remainingTokens: 0,
          originOnly: 0,
          qualityOnly: 0,
          bothCertifications: 0,
          databaseId: dbInstance.id,
        },
      });

      return { newUser, dbInstance, requiresConfirmation, registrationMethod };
    });

    // Send welcome email if email is provided
    if (email?.trim()) {
      await sendWelcomeEmail(
        result.dbInstance, 
        result.newUser, 
        confirmationToken, 
        result.requiresConfirmation, 
        baseUrl,
        result.registrationMethod
      );
    }

    console.log(`User ${result.newUser.email || result.newUser.phonenumber} successfully registered in database ${result.dbInstance.id} via ${result.registrationMethod}`);

    // Return response matching frontend expectations
    return NextResponse.json({
      success: true,
      message: result.requiresConfirmation
        ? `Account created in ${result.dbInstance.displayName || result.dbInstance.name}! Please check your email to confirm.`
        : `Account created successfully! Welcome to ${result.dbInstance.displayName || result.dbInstance.name}.`,
      userId: result.newUser.id,
      databaseId: result.dbInstance.id,
      displayName: result.dbInstance.displayName || result.dbInstance.name,
      requiresConfirmation: result.requiresConfirmation,
      registrationMethod: result.registrationMethod,
      // Frontend expects these for routing decisions
      user: {
        id: result.newUser.id,
        firstname: result.newUser.firstname,
        lastname: result.newUser.lastname,
        email: result.newUser.email,
        role: result.newUser.role
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error during registration:', error);
    
    // More specific error handling
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ 
        success: false, 
        error: 'An account with this information already exists.' 
      }, { status: 400 });
    }

    // Handle database connection errors
    if (error instanceof Error) {
      if (error.message.includes('Database connection') || 
          error.message.includes('connect') ||
          error.message.includes('ECONNREFUSED')) {
        return NextResponse.json({ 
          success: false, 
          error: 'Database connection failed. Please try again.' 
        }, { status: 503 });
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Registration failed. Please try again.' 
    }, { status: 500 });
  }
}

async function sendWelcomeEmail(
  dbInstance: any, 
  user: any, 
  confirmationToken: string, 
  requiresConfirmation: boolean, 
  baseUrl: string,
  registrationMethod: string
) {
  if (!user.email?.trim()) return;

  const confirmationLink = `${baseUrl}/confirm?token=${confirmationToken}&db=${dbInstance.id}`;
  const dashboardLink = `${baseUrl}/dashboard/db/${dbInstance.id}`;

  let emailSubject = `Welcome to ${dbInstance.displayName || dbInstance.name}`;
  let emailContent = '';

  emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f59e0b; margin: 0;">🍯 Welcome to ${dbInstance.displayName || dbInstance.name}!</h1>
      </div>
      
      <p style="font-size: 16px; line-height: 1.5;">Hi ${user.firstname},</p>
      
      <p style="font-size: 16px; line-height: 1.5;">
        Thank you for registering with <strong>${dbInstance.displayName || dbInstance.name}</strong>!
      </p>
      
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); padding: 20px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #f59e0b;">
        <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">👤 Account Details</h3>
        <p style="margin: 8px 0; color: #451a03;"><strong>Name:</strong> ${user.firstname} ${user.lastname}</p>
        <p style="margin: 8px 0; color: #451a03;"><strong>Role:</strong> ${user.role}</p>
        <p style="margin: 8px 0; color: #451a03;"><strong>Database:</strong> ${dbInstance.displayName || dbInstance.name}</p>
      </div>
      
      ${requiresConfirmation ? `
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">📧 Email Confirmation Required</h3>
          <p style="color: #1e40af; margin: 0 0 20px 0;">Please confirm your email address to activate your account:</p>
          <a href="${confirmationLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin-bottom: 15px;">
            ✅ Confirm Email Address
          </a>
        </div>
      ` : `
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
          <p style="color: #1e40af; margin: 0 0 20px 0; font-size: 16px;">
            🎉 Your account is ready to use!
          </p>
        </div>
      `}
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" 
           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          🚀 Go to Dashboard
        </a>
      </div>
      
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: emailSubject,
    html: emailContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${user.email} for database ${dbInstance.displayName || dbInstance.name}`);
  } catch (error) {
    console.error(`Failed to send welcome email to ${user.email}:`, error);
  }
}