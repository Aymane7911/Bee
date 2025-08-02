// /lib/auth.ts - Updated with databaseId support and fixed TypeScript errors
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { masterDb } from '@/lib/database-connection'; 

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    id: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: string;
    databaseId: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      firstName: string;
      lastName: string;
      companyId: string;
      role: string;
      databaseId: string;
    };
  }
}



const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          firstName: profile.given_name || "",
          lastName: profile.family_name || "",
          companyId: "", // Changed from null to empty string
          role: "USER", // Keep as string
          databaseId: "" // Changed from null to empty string
        };
      },
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id,
          name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
          email: profile.emailAddress,
          image: profile.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier,
          firstName: profile.localizedFirstName || "",
          lastName: profile.localizedLastName || "",
          companyId: "", // Added missing property
          role: "USER", // Added missing property
          databaseId: "" // Added missing property
        };
      },
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" || account?.provider === "linkedin") {
        try {
          const existingUser = await prisma.beeusers.findFirst({
            where: { email: user.email! },
            include: { database: true }
          });

          if (!existingUser) {
            // For new users, you need to determine which database they belong to
            // This could be based on domain, invitation, or a default database
            
            // Example: Get default database or create one
            let defaultDatabase = await prisma.database.findFirst({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' }
            });

            if (!defaultDatabase) {
              // Create a default database if none exists
              // You might want to handle this differently based on your business logic
              throw new Error('No active database found. Please contact administrator.');
            }

            const randomPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 12);

            await prisma.beeusers.create({
              data: {
                firstname: (user as any).firstName || user.name?.split(" ")[0] || "",
                lastname: (user as any).lastName || user.name?.split(" ").slice(1).join(" ") || "",
                email: user.email!,
                password: hashedPassword,
                isConfirmed: true,
                isProfileComplete: false,
                databaseId: defaultDatabase.id, // Assign to database
              },
            });
          }
          return true;
        } catch (error) {
          console.error("Error during OAuth sign in:", error);
          return false;
        }
      }
      return true;
    },
    
    async jwt({ token, user, account }) {
      if (user?.email) {
        // Get user from database with database info
        const dbUser = await prisma.beeusers.findFirst({
          where: { email: user.email },
          select: { 
            id: true, 
            email: true, 
            firstname: true, 
            lastname: true,
            databaseId: true 
          }
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.firstName = dbUser.firstname;
          token.lastName = dbUser.lastname;
          token.databaseId = dbUser.databaseId;
          token.companyId = ""; // Set default value
          token.role = "USER"; // Set default value
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      if (token.userId) {
        session.user = {
          id: token.userId.toString(),
          email: token.email as string,
          name: session.user?.name || null,
          image: session.user?.image || null,
          firstName: token.firstName as string,
          lastName: token.lastName as string,
          companyId: token.companyId as string,
          role: token.role as string,
          databaseId: token.databaseId as string,
        };
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

/**
 * Creates a JWT token for API authentication
 */
export function createJWTToken(userId: number, email: string, databaseId: string): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
  }

  const payload = {
    userId,
    email,
    databaseId, // Include databaseId in JWT
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
  };

  return jwt.sign(payload, secret);
}

/**
 * Enhanced JWT verification that checks if user still exists in database
 */
export async function getUserFromToken(token: string): Promise<{ userId: string; databaseId: string } | null> {
  try {
    if (!token) {
      console.log('[getUserFromToken] No token provided');
      return null;
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
        
    if (!cleanToken) {
      console.log('[getUserFromToken] Empty token after cleaning');
      return null;
    }

    // Check if token looks like a JWT (has 3 parts separated by dots)
    const tokenParts = cleanToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('[getUserFromToken] Token does not appear to be a valid JWT format. Parts:', tokenParts.length);
      return null;
    }

    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[getUserFromToken] No JWT secret found');
      return null;
    }

    // Verify and decode JWT
    const decoded = jwt.verify(cleanToken, secret) as any;
    console.log('[getUserFromToken] Decoded JWT payload:', {
      userId: decoded.userId,
      email: decoded.email,
      databaseId: decoded.databaseId,
      iat: decoded.iat,
      exp: decoded.exp
    });

    let userId: string | null = null;
    let databaseId: string | null = decoded.databaseId || null;

    if (decoded.userId) {
      userId = decoded.userId.toString();
    } else if (decoded.email && decoded.databaseId) {
      // ✅ FIX: Search in the TENANT database, not master database
      console.log('[getUserFromToken] userId undefined, searching by email in tenant database:', decoded.databaseId);
      
      // Get the tenant database URL from master database
      const database = await masterDb.database.findUnique({
        where: { id: decoded.databaseId },
        select: { databaseUrl: true, isActive: true }
      });

      if (!database || !database.isActive) {
        console.error('[getUserFromToken] Database not found or inactive:', decoded.databaseId);
        return null;
      }

      // Connect to the tenant database
      const tenantDb = new PrismaClient({
        datasources: {
          db: {
            url: database.databaseUrl,
          },
        },
      });

      try {
        await tenantDb.$connect();
        
        // Search for user in the TENANT database
        const dbUser = await tenantDb.beeusers.findFirst({
          where: { email: decoded.email },
          select: { id: true, databaseId: true }
        });
        
        if (dbUser) {
          userId = dbUser.id.toString();
          databaseId = dbUser.databaseId;
          console.log('[getUserFromToken] Found user in tenant database:', { userId, databaseId });
        } else {
          console.warn('[getUserFromToken] User not found in tenant database with email:', decoded.email);
        }
      } finally {
        await tenantDb.$disconnect();
      }
    }

    if (!userId || !databaseId) {
      console.warn('[getUserFromToken] Missing userId or databaseId after lookup');
      return null;
    }

    // ✅ FIX: Verify user exists in the TENANT database, not master
    console.log('[getUserFromToken] Verifying user exists in tenant database...');
    
    // Get the tenant database URL again
    const database = await masterDb.database.findUnique({
      where: { id: databaseId },
      select: { databaseUrl: true, isActive: true }
    });

    if (!database || !database.isActive) {
      console.error('[getUserFromToken] Database not found or inactive during verification:', databaseId);
      return null;
    }

    // Connect to tenant database for verification
    const tenantDb = new PrismaClient({
      datasources: {
        db: {
          url: database.databaseUrl,
        },
      },
    });

    try {
      await tenantDb.$connect();
      
      const userExists = await tenantDb.beeusers.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, databaseId: true }
      });

      if (!userExists) {
        console.warn('[getUserFromToken] User no longer exists in tenant database:', userId);
        return null;
      }

      console.log('[getUserFromToken] User verified and exists in tenant database:', { userId, databaseId });
      return { userId, databaseId };
      
    } finally {
      await tenantDb.$disconnect();
    }

  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[getUserFromToken] JWT token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[getUserFromToken] Invalid JWT token format or signature');
      console.log('[getUserFromToken] Error details:', error.message);
    } else {
      console.error('[getUserFromToken] JWT verification error:', error.message);
    }
    return null;
  }
}

/**
 * Simplified authentication for API routes - JWT ONLY
 */
export async function authenticateRequest(request: NextRequest): Promise<{ userId: string; databaseId: string } | null> {
  try {
    // Only check Authorization header for JWT token
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      console.log('[authenticateRequest] No authorization header');
      return null;
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.log('[authenticateRequest] Invalid authorization header format');
      return null;
    }

    const token = authHeader.substring(7);
    const userInfo = await getUserFromToken(token);

    if (userInfo) {
      console.log('[authenticateRequest] Authenticated user:', userInfo);
      return userInfo;
    } else {
      console.log('[authenticateRequest] Token validation failed');
      return null;
    }

  } catch (error) {
    console.error('[authenticateRequest] Authentication error:', error);
    return null;
  }
}

/**
 * Get current user from JWT token
 */
export async function getCurrentUser(request: NextRequest) {
  try {
    const userInfo = await authenticateRequest(request);
    if (!userInfo) return null;

    const dbUser = await prisma.beeusers.findUnique({
      where: { id: parseInt(userInfo.userId) },
      include: {
        tokenStats: true,
        batches: true,
        database: true, // Include database info
      },
    });

    return dbUser;
  } catch (error) {
    console.error('[getCurrentUser] Error:', error);
    return null;
  }
}

// Keep the rest of your utility functions unchanged
export function clearClientSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('next-auth.session-token');
    localStorage.removeItem('next-auth.csrf-token');
    
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('user');
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('next-auth') || key.startsWith('auth')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[clearClientSession] All client-side auth data cleared');
  }
}

export async function performLogout() {
  try {
    console.log('[performLogout] Starting logout process...');
    
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });

    if (!response.ok) {
      console.warn('[performLogout] Logout API failed, continuing with client cleanup');
    }

    clearClientSession();
    
    console.log('[performLogout] Logout completed successfully');
    return true;
  } catch (error) {
    console.error('[performLogout] Error during logout:', error);
    clearClientSession();
    return false;
  }
}

export default authOptions;