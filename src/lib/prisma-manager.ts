// src/lib/prisma-manager.ts
import { PrismaClient } from '@prisma/client';

// Global connection pools
const tenantClients = new Map<string, PrismaClient>();
let masterPrisma: PrismaClient | null = null;

// Get the master Prisma client
function getMasterPrismaClient(): PrismaClient {
  if (masterPrisma) return masterPrisma;

  const masterDbUrl = process.env.DATABASE_URL;
  if (!masterDbUrl) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  console.log('[PrismaManager] Creating master database client');
  masterPrisma = new PrismaClient({
    datasources: { db: { url: masterDbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return masterPrisma;
}

export async function getDatabaseInfo(databaseId: string) {
  const masterPrisma = getMasterPrismaClient();
  
  try {
    const database = await masterPrisma.database.findUnique({
      where: { id: databaseId },
      select: { name: true, databaseUrl: true }
    });

    if (!database) {
      console.error(`[PrismaManager] Database not found for ID: ${databaseId}`);
      return null;
    }

    return {
      name: database.name,
      url: database.databaseUrl
    };
  } catch (error) {
    console.error(`[PrismaManager] Error fetching database info for ID ${databaseId}:`, error);
    return null;
  }
}

export async function getPrismaClientByDatabaseId(databaseId: string): Promise<PrismaClient | null> {
  // Check if we already have a client for this database
  if (tenantClients.has(databaseId)) {
    return tenantClients.get(databaseId)!;
  }

  // Fetch database info from master database
  const dbInfo = await getDatabaseInfo(databaseId);
  if (!dbInfo) return null;

  console.log(`[PrismaManager] Creating new client for database: ${dbInfo.name} (${databaseId})`);
  
  // Create a new client with optimized settings
  const client = new PrismaClient({
    datasources: {
      db: {
        url: dbInfo.url
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  
  // Store the client for reuse
  tenantClients.set(databaseId, client);
  
  return client;
}

// Cleanup function for graceful shutdown
export async function disconnectAllClients(): Promise<void> {
  console.log('[PrismaManager] Disconnecting all clients...');
  
  // Disconnect all tenant clients
  const tenantDisconnects = Array.from(tenantClients.values()).map(
    async (client) => {
      try {
        await client.$disconnect();
      } catch (error) {
        console.error('[PrismaManager] Error disconnecting tenant client:', error);
      }
    }
  );
  
  // Disconnect master client
  if (masterPrisma) {
    tenantDisconnects.push(masterPrisma.$disconnect().catch(error => {
      console.error('[PrismaManager] Error disconnecting master client:', error);
    }));
  }
  
  await Promise.all(tenantDisconnects);
  tenantClients.clear();
  masterPrisma = null;
  
  console.log('[PrismaManager] All clients disconnected');
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('[PrismaManager] Received SIGINT, disconnecting clients...');
  await disconnectAllClients();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[PrismaManager] Received SIGTERM, disconnecting clients...');
  await disconnectAllClients();
  process.exit(0);
});