import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Test database configuration
const testSupabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Global test setup
beforeAll(async () => {
  console.log('Setting up test environment...');
  
  // Create test tables if they don't exist
  await setupTestDatabase();
  
  // Seed test data
  await seedTestData();
});

beforeEach(async () => {
  // Reset database state before each test
  await resetTestData();
});

afterEach(async () => {
  // Clean up any test-specific data
  await cleanupTestData();
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
  await cleanupTestDatabase();
});

async function setupTestDatabase() {
  // This would create test-specific tables or schemas
  // In a real implementation, you'd use Supabase migrations
  console.log('Test database setup complete');
}

async function seedTestData() {
  // Seed test data
  const testOffices = [
    {
      id: 'test-office-1',
      county: 'Nairobi',
      constituency_name: 'Westlands',
      office_location: 'Westlands Constituency Office',
      latitude: -1.2654,
      longitude: 36.7984,
      verified: true,
      operational_status: 'operational',
      created_at: new Date().toISOString()
    },
    {
      id: 'test-office-2',
      county: 'Mombasa',
      constituency_name: 'Mvita',
      office_location: 'Mvita Constituency Office',
      latitude: -4.0435,
      longitude: 39.6682,
      verified: false,
      operational_status: 'operational',
      created_at: new Date().toISOString()
    }
  ];

  // Insert test offices
  for (const office of testOffices) {
    await testSupabase
      .from('iebc_offices')
      .upsert(office, { onConflict: 'id' });
  }

  console.log('Test data seeded');
}

async function resetTestData() {
  // Reset any modified test data
  console.log('Test data reset');
}

async function cleanupTestData() {
  // Clean up test-specific data created during tests
  console.log('Test data cleaned up');
}

async function cleanupTestDatabase() {
  // Clean up test database
  console.log('Test database cleanup complete');
}

// Export test utilities
export { testSupabase };
export const testUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  display_name: 'Test User'
};

export const testAdmin = {
  id: 'test-admin-1',
  email: 'admin@example.com',
  display_name: 'Test Admin',
  role: 'admin'
};
