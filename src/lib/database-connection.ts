// lib/database-connection.ts - Improved connection management
import { PrismaClient } from '@prisma/client';

// Connection pool configuration
const CONNECTION_CONFIG = {
  MASTER_CONNECTION_LIMIT: 3,
  TENANT_CONNECTION_LIMIT: 2,
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  IDLE_TIMEOUT: 60000, // 1 minute
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

// Cache for database connections with metadata
interface ConnectionInfo {
  client: PrismaClient;
  lastUsed: Date;
  isConnected: boolean;
  retryCount: number;
}

const dbConnections = new Map<string, ConnectionInfo>();

/**
 * Add connection pool parameters to database URL
 */
function addConnectionPoolParams(databaseUrl: string, connectionLimit: number): string {
  // Return original URL if empty or invalid
  if (!databaseUrl || databaseUrl.trim() === '') {
    console.warn('Database URL is empty, returning as-is');
    return databaseUrl;
  }
  
  try {
    const url = new URL(databaseUrl);
    
    // Add connection pool parameters
    url.searchParams.set('connection_limit', connectionLimit.toString());
    url.searchParams.set('pool_timeout', '10');
    url.searchParams.set('connect_timeout', '30');
    url.searchParams.set('statement_timeout', '30000');
    
    return url.toString();
  } catch (error) {
    console.warn('Failed to parse database URL, using original:', error);
    return databaseUrl;
  }
}

// Get master database URL with fallback
function getMasterDatabaseUrl(): string {
  const masterUrl = process.env.MASTER_DATABASE_URL || 
                   process.env.DATABASE_URL || 
                   process.env.POSTGRES_URL || 
                   '';
  
  if (!masterUrl || masterUrl.trim() === '') {
    console.error('No master database URL found in environment variables');
    console.error('Please set one of: MASTER_DATABASE_URL, DATABASE_URL, or POSTGRES_URL');
    throw new Error('Master database URL is not configured');
  }
  
  return masterUrl;
}

// Master database connection with error handling
let masterDb: PrismaClient;

try {
  const masterDbUrl = getMasterDatabaseUrl();
  const optimizedMasterUrl = addConnectionPoolParams(masterDbUrl, CONNECTION_CONFIG.MASTER_CONNECTION_LIMIT);
  
  masterDb = new PrismaClient({
    datasources: {
      db: {
        url: optimizedMasterUrl,
      },
    },
    log: ['error', 'warn'],
  });
} catch (error) {
  console.error('Failed to initialize master database:', error);
  // Create a dummy client that will fail gracefully
  masterDb = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://localhost:5432/dummy',
      },
    },
    log: ['error'],
  });
}

export { masterDb };

/**
 * Create optimized Prisma client with connection pooling
 */
function createOptimizedPrismaClient(databaseUrl: string): PrismaClient {
  if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error('Database URL cannot be empty');
  }
  
  const optimizedUrl = addConnectionPoolParams(databaseUrl, CONNECTION_CONFIG.TENANT_CONNECTION_LIMIT);
  
  return new PrismaClient({
    datasources: {
      db: {
        url: optimizedUrl,
      },
    },
    log: ['error'],
  });
}

/**
 * Clean up stale connections based on idle timeout
 */
async function cleanupStaleConnections(): Promise<void> {
  const now = new Date();
  const staleConnections: string[] = [];

  for (const [databaseId, connectionInfo] of dbConnections.entries()) {
    const idleTime = now.getTime() - connectionInfo.lastUsed.getTime();
    
    if (idleTime > CONNECTION_CONFIG.IDLE_TIMEOUT) {
      staleConnections.push(databaseId);
    }
  }

  // Disconnect stale connections
  for (const databaseId of staleConnections) {
    await disconnectDatabase(databaseId);
    console.log(`Cleaned up stale connection for database: ${databaseId}`);
  }
}

/**
 * Get a Prisma client instance for a specific database with improved error handling
 */
export async function getDatabaseConnection(
  databaseUrl: string, 
  databaseId: string
): Promise<PrismaClient> {
  // Clean up stale connections periodically
  await cleanupStaleConnections();

  // Check if we have an existing, healthy connection
  const existingConnection = dbConnections.get(databaseId);
  if (existingConnection?.isConnected) {
    existingConnection.lastUsed = new Date();
    return existingConnection.client;
  }

  // Remove unhealthy connection if it exists
  if (existingConnection && !existingConnection.isConnected) {
    await disconnectDatabase(databaseId);
  }

  // Create new connection with retry logic
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
    try {
      const client = createOptimizedPrismaClient(databaseUrl);
      
      // Test connection with timeout
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_CONFIG.CONNECTION_TIMEOUT)
        ),
      ]);

      // Cache the successful connection
      dbConnections.set(databaseId, {
        client,
        lastUsed: new Date(),
        isConnected: true,
        retryCount: 0,
      });

      console.log(`Successfully connected to database: ${databaseId}`);
      return client;

    } catch (error: any) {
      lastError = error;
      retryCount++;
      
      if (retryCount < CONNECTION_CONFIG.MAX_RETRIES) {
        console.warn(`Connection attempt ${retryCount} failed for ${databaseId}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_CONFIG.RETRY_DELAY * retryCount));
      }
    }
  }

  throw new Error(`Failed to connect to database ${databaseId} after ${CONNECTION_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Get database connection from session info with improved error handling
 */
export async function getDatabaseFromSession(
  databaseId: string,
  databaseUrl: string
): Promise<{
  db: PrismaClient;
  databaseInfo: {
    id: string;
    name: string;
    displayName: string;
  };
}> {
  let database;
  
  try {
    // Use a timeout for master DB queries to prevent hanging
    database = await Promise.race([
      masterDb.database.findUnique({
        where: { id: databaseId },
        select: {
          id: true,
          name: true,
          displayName: true,
          isActive: true,
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Master DB query timeout')), 10000)
      ),
    ]) as any;

  } catch (error: any) {
    console.error(`Master DB query failed for database ${databaseId}:`, error);
    throw new Error(`Master database query failed: ${error.message}`);
  }

  if (!database) {
    throw new Error('Database not found');
  }

  if (!database.isActive) {
    throw new Error('Database is not active');
  }

  // Get tenant database connection
  const db = await getDatabaseConnection(databaseUrl, databaseId);

  return {
    db,
    databaseInfo: {
      id: database.id,
      name: database.name,
      displayName: database.displayName,
    },
  };
}

/**
 * Get admin database connection using admin session info
 */
export async function getAdminDatabaseConnection(adminSession: {
  databaseId: string;
  databaseUrl: string;
}): Promise<{
  db: PrismaClient;
  databaseInfo: {
    id: string;
    name: string;
    displayName: string;
  };
}> {
  console.log('Getting admin database connection for:', {
    databaseId: adminSession.databaseId,
    hasUrl: !!adminSession.databaseUrl
  });

  return getDatabaseFromSession(adminSession.databaseId, adminSession.databaseUrl);
}

/**
 * Get database connection by database ID (from master database lookup)
 */
export async function getDatabaseById(databaseId: string): Promise<{
  db: PrismaClient;
  databaseInfo: {
    id: string;
    name: string;
    displayName: string;
    databaseUrl: string;
  };
}> {
  let database;
  
  try {
    // Use timeout for master DB query
    database = await Promise.race([
      masterDb.database.findUnique({
        where: { id: databaseId },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Master DB query timeout')), 10000)
      ),
    ]) as any;

  } catch (error: any) {
    console.error(`Master DB query failed for database ${databaseId}:`, error);
    throw new Error(`Master database query failed: ${error.message}`);
  }

  if (!database) {
    throw new Error('Database not found');
  }

  if (!database.isActive) {
    throw new Error('Database is not active');
  }

  // Get connection to the specific database
  const db = await getDatabaseConnection(database.databaseUrl, database.id);

  return {
    db,
    databaseInfo: {
      id: database.id,
      name: database.name,
      displayName: database.displayName,
      databaseUrl: database.databaseUrl,
    },
  };
}

/**
 * Get all active databases with timeout protection
 */
export async function getAllActiveDatabases(): Promise<Array<{
  id: string;
  name: string;
  displayName: string;
  databaseUrl: string;
  createdAt: Date;
}>> {
  try {
    const databases = await Promise.race([
      masterDb.database.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          displayName: true,
          databaseUrl: true,
          createdAt: true,
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Master DB query timeout')), 15000)
      ),
    ]) as any;

    return databases;
  } catch (error: any) {
    console.error('Failed to get active databases:', error);
    throw new Error(`Failed to retrieve active databases: ${error.message}`);
  }
}

/**
 * Execute a query across all active databases with improved error handling
 */
export async function executeAcrossAllDatabases<T>(
  queryFunction: (db: PrismaClient, databaseInfo: any) => Promise<T>
): Promise<Array<{ databaseId: string; result: T | null; error?: string }>> {
  const databases = await getAllActiveDatabases();
  const results: Array<{ databaseId: string; result: T | null; error?: string }> = [];

  // Process databases in batches to avoid overwhelming the connection pool
  const batchSize = 3;
  for (let i = 0; i < databases.length; i += batchSize) {
    const batch = databases.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (database) => {
      try {
        const db = await getDatabaseConnection(database.databaseUrl, database.id);
        const result = await queryFunction(db, database);
        return { databaseId: database.id, result };
      } catch (error: any) {
        console.error(`Error executing query on database ${database.name}:`, error);
        return { 
          databaseId: database.id, 
          result: null, 
          error: error.message 
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Disconnect a specific database connection
 */
export async function disconnectDatabase(databaseId: string): Promise<void> {
  const connectionInfo = dbConnections.get(databaseId);
  if (connectionInfo) {
    try {
      await connectionInfo.client.$disconnect();
      dbConnections.delete(databaseId);
      console.log(`Disconnected database: ${databaseId}`);
    } catch (error) {
      console.error(`Error disconnecting from database ${databaseId}:`, error);
      // Still remove from cache even if disconnect failed
      dbConnections.delete(databaseId);
    }
  }
}

/**
 * Clean up all database connections
 */
export async function disconnectAllDatabases(): Promise<void> {
  console.log('Disconnecting all database connections...');
  
  // Disconnect master database
  try {
    await masterDb.$disconnect();
    console.log('Master database disconnected');
  } catch (error) {
    console.error('Error disconnecting master database:', error);
  }

  // Disconnect all cached database connections
  const disconnectPromises = Array.from(dbConnections.keys()).map(databaseId => 
    disconnectDatabase(databaseId)
  );

  await Promise.all(disconnectPromises);
  console.log(`Disconnected ${disconnectPromises.length} tenant databases`);
}

/**
 * Test database connection with improved error handling
 */
export async function testDatabaseConnection(databaseUrl: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  let testClient: PrismaClient | null = null;
  const startTime = Date.now();
  
  try {
    testClient = createOptimizedPrismaClient(databaseUrl);

    // Test the connection with timeout
    await Promise.race([
      testClient.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 5000)
      ),
    ]);
    
    const responseTime = Date.now() - startTime;
    return { success: true, responseTime };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return { 
      success: false, 
      error: error.message,
      responseTime 
    };
  } finally {
    if (testClient) {
      try {
        await testClient.$disconnect();
      } catch (error) {
        console.error('Error disconnecting test client:', error);
      }
    }
  }
}

/**
 * Create a new database entry in the master database
 */
export async function createDatabase(databaseInfo: {
  name: string;
  displayName: string;
  databaseUrl: string;
  description?: string;
  managedByAdminId: number;
}): Promise<{
  id: string;
  name: string;
  displayName: string;
  databaseUrl: string;
  isActive: boolean;
  createdAt: Date;
}> {
  // First test the connection
  const connectionTest = await testDatabaseConnection(databaseInfo.databaseUrl);
  
  if (!connectionTest.success) {
    throw new Error(`Cannot connect to database: ${connectionTest.error}`);
  }

  try {
    // Create the database record with timeout
    const database = await Promise.race([
      masterDb.database.create({
        data: {
          name: databaseInfo.name,
          displayName: databaseInfo.displayName,
          databaseUrl: databaseInfo.databaseUrl,
          description: databaseInfo.description,
          managedBy: {
            connect: {
              id: databaseInfo.managedByAdminId,
            },
          },
          isActive: true,
        },
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database creation timeout')), 10000)
      ),
    ]) as any;

    return database;
  } catch (error: any) {
    console.error('Failed to create database:', error);
    throw new Error(`Database creation failed: ${error.message}`);
  }
}

/**
 * Get connection pool statistics
 */
export function getConnectionPoolStats(): {
  totalConnections: number;
  activeConnections: string[];
  connectionDetails: Array<{
    databaseId: string;
    lastUsed: Date;
    isConnected: boolean;
    retryCount: number;
  }>;
} {
  const connectionDetails = Array.from(dbConnections.entries()).map(([id, info]) => ({
    databaseId: id,
    lastUsed: info.lastUsed,
    isConnected: info.isConnected,
    retryCount: info.retryCount,
  }));

  return {
    totalConnections: dbConnections.size,
    activeConnections: Array.from(dbConnections.keys()),
    connectionDetails,
  };
}

/**
 * Force cleanup of all connections (emergency use)
 */
export async function forceCleanupConnections(): Promise<void> {
  console.log('Force cleaning up all connections...');
  
  // Clear the connections map first to prevent new connections
  const connectionIds = Array.from(dbConnections.keys());
  dbConnections.clear();
  
  // Try to disconnect each connection
  for (const id of connectionIds) {
    try {
      const connectionInfo = dbConnections.get(id);
      if (connectionInfo) {
        await connectionInfo.client.$disconnect();
      }
    } catch (error) {
      console.error(`Error force disconnecting ${id}:`, error);
    }
  }
  
  console.log(`Force cleaned up ${connectionIds.length} connections`);
}

// Enhanced graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await Promise.race([
      disconnectAllDatabases(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Shutdown timeout')), 10000)
      ),
    ]);
    console.log('Graceful shutdown completed');
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    await forceCleanupConnections();
  }
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Periodic cleanup of stale connections (every 5 minutes)
setInterval(async () => {
  try {
    await cleanupStaleConnections();
  } catch (error) {
    console.error('Error during periodic cleanup:', error);
  }
}, 5 * 60 * 1000);

export default {
  masterDb,
  getDatabaseConnection,
  getDatabaseFromSession,
  getAdminDatabaseConnection,
  getDatabaseById,
  getAllActiveDatabases,
  executeAcrossAllDatabases,
  disconnectDatabase,
  disconnectAllDatabases,
  testDatabaseConnection,
  createDatabase,
  getConnectionPoolStats,
  forceCleanupConnections,
};