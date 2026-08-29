/**
 * Regenerate cc_users.json from cc_credentials.csv with correct bcrypt hashes.
 * 
 * This script reads the CSV source of truth and generates fresh user records
 * with properly hashed passwords for Stream@CC2026.
 * 
 * Usage: node regenerate_cc_users.cjs
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const CSV_PATH = path.join(__dirname, 'server', 'data', 'cc_credentials.csv');
const OUTPUT_PATH = path.join(__dirname, 'server', 'data', 'cc_users.json');
const DEFAULT_PASSWORD = 'Stream@CC2026';
const SALT_ROUNDS = 12;

async function main() {
  console.log('📄 Reading cc_credentials.csv...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  const dataLines = lines.slice(1).filter(line => line.trim());
  console.log(`   Found ${dataLines.length} schools in CSV.`);

  console.log(`🔐 Hashing default password "${DEFAULT_PASSWORD}" with ${SALT_ROUNDS} salt rounds...`);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  
  // Verify the hash is correct
  const verified = await bcrypt.compare(DEFAULT_PASSWORD, hashedPassword);
  if (!verified) {
    console.error('❌ FATAL: Hash verification failed!');
    process.exit(1);
  }
  console.log('   ✅ Hash verified successfully.');

  const now = new Date().toISOString();
  const users = [];

  for (const line of dataLines) {
    // CSV format: UDISE+CC Code,School Name,District,Username,Default Password
    // Handle school names that may contain commas
    const parts = line.split(',');
    
    // The CSV has 5 columns. UDISE code is first, district is third-from-last, username is second-from-last.
    const udiseCode = parts[0].trim();
    const district = parts[parts.length - 3].trim();
    const username = parts[parts.length - 2].trim();
    // School name is everything between first and third-from-last column
    const schoolName = parts.slice(1, parts.length - 3).join(',').trim();

    if (!udiseCode || !username) {
      console.warn(`   ⚠️  Skipping invalid line: ${line}`);
      continue;
    }

    users.push({
      id: `cc-${udiseCode}`,
      email: `cc-${udiseCode.toLowerCase()}@stream.edu`,
      username: username,
      password: hashedPassword,
      name: `${district} / ${schoolName}`,
      brcCode: udiseCode,
      role: 'CREATIVE_CORNER',
      district: district,
      schoolName: schoolName,
      mustChangePassword: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`\n📝 Writing ${users.length} users to cc_users.json...`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(users, null, 2));
  console.log('   ✅ cc_users.json regenerated successfully!');

  // Print a sample for verification
  console.log('\n📋 Sample (first 3 users):');
  users.slice(0, 3).forEach(u => {
    console.log(`   ${u.username} | ${u.schoolName} | ${u.district}`);
  });

  console.log(`\n🔑 Default password: ${DEFAULT_PASSWORD}`);
  console.log('   All schools will be prompted to change password on first login.');
  console.log('\n✅ Done! Now delete persisted_users.json, persisted_stocks.json, and persisted_history.json to force a clean reseed.');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
