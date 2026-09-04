/**
 * seed-experts-from-excel.js
 * 
 * Parses "Expert ID card - with details and email.xlsx" and seeds experts.json.
 * Handles forward-filling of expert details across multi-row BRC allocations.
 * 
 * Usage:
 *   node server/scripts/seed-experts-from-excel.js [path-to-xlsx]
 * 
 * If no path is given, defaults to:
 *   c:\Users\maria\Downloads\Expert ID card - with details and email.xlsx
 */

const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ── Configuration ──
const DEFAULT_XLSX_PATH = path.join('c:', 'Users', 'maria', 'Downloads', 'Expert ID card - with details and email.xlsx');
const EXPERTS_OUT = path.join(__dirname, '../data/experts.json');
const BRCS_FILE = path.join(__dirname, '../data/brcs.json');
const GENERIC_PASSWORD = 'Expert@123';
const SALT_ROUNDS = 12;

// ── Helpers ──

/**
 * Convert Excel serial date number to YYYY-MM-DD string.
 * Excel epoch is 1900-01-01, but it has a bug treating 1900 as a leap year,
 * so we subtract 1 for dates after Feb 28, 1900.
 */
function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel's epoch: Jan 0, 1900 (i.e., Dec 31, 1899)
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + serial * 86400000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip extra spaces, 
 * remove common prefixes like GOVT/GHS/GHSS/GVHSS etc.
 */
function normalizeSchoolName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Extract the "core" part of a school name by removing common prefixes.
 */
function coreSchoolName(name) {
  return normalizeSchoolName(name)
    .replace(/^(GOVT |GOVERNMENT |G |GHS |GHSS |GVHSS |GBHSS |GMHSS |GSHSS |GGHSS |GTHS |GRFTVHSS |PUPS |GUPS |SCUGVHSS |SRVGMVHSS |PCNGHSS |PBMGHSS |SMTGHSS |VNMMGHSS |CHANDRA |ABDURAHIMAN |PERALASSERY |KKN |KKKPS |MVMKVNSGHSS )+/g, '')
    .trim();
}

/**
 * Try to find a BRC code from brcs.json that matches the given hub name.
 * Uses progressively looser matching.
 */
function findBrcCode(hubName, brcName, district, brcsData) {
  if (!hubName) return null;

  const normalizedHub = normalizeSchoolName(hubName);

  // 1. Exact normalized name match
  let match = brcsData.find(b => normalizeSchoolName(b.name) === normalizedHub);
  if (match) return match.code;

  // 2. One name contains the other
  match = brcsData.find(b => {
    const n = normalizeSchoolName(b.name);
    return n.includes(normalizedHub) || normalizedHub.includes(n);
  });
  if (match) return match.code;

  // 3. Match by BRC/location name within same district
  if (brcName && district) {
    const normalizedBrc = brcName.toUpperCase().trim();
    const normalizedDistrict = district.toUpperCase().trim();
    match = brcsData.find(b => {
      const loc = (b.location || '').toUpperCase().trim();
      const dist = (b.district || '').toUpperCase().trim();
      return loc === normalizedBrc && dist === normalizedDistrict;
    });
    if (match) return match.code;
  }

  // 4. Match by BRC/location name only (less precise)
  if (brcName) {
    const normalizedBrc = brcName.toUpperCase().trim();
    match = brcsData.find(b => {
      const loc = (b.location || '').toUpperCase().trim();
      return loc === normalizedBrc;
    });
    if (match) return match.code;
  }

  // 5. Fuzzy match by core school name (Levenshtein distance ≤ 3)
  const coreHub = coreSchoolName(hubName);
  if (coreHub.length > 3) {
    let bestMatch = null;
    let bestDist = Infinity;
    for (const b of brcsData) {
      const coreBrc = coreSchoolName(b.name);
      const dist = levenshtein(coreHub, coreBrc);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = b;
      }
    }
    // Accept if edit distance is small relative to string length
    if (bestMatch && bestDist <= 3) {
      return bestMatch.code;
    }
  }

  // 6. Substring match on location with district filter
  if (brcName && district) {
    const normalizedBrc = brcName.toUpperCase().replace(/[^A-Z]/g, '');
    const normalizedDistrict = district.toUpperCase().trim();
    match = brcsData.find(b => {
      const loc = (b.location || '').toUpperCase().replace(/[^A-Z]/g, '');
      const dist = (b.district || '').toUpperCase().trim();
      return dist === normalizedDistrict && (loc.includes(normalizedBrc) || normalizedBrc.includes(loc));
    });
    if (match) return match.code;
  }

  return null;
}

// ── Main ──
async function main() {
  const xlsxPath = process.argv[2] || DEFAULT_XLSX_PATH;

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📊 STREAM Expert Seeding from Excel');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Source : ${xlsxPath}`);
  console.log(`  Output : ${EXPERTS_OUT}`);
  console.log('');

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ Excel file not found: ${xlsxPath}`);
    process.exit(1);
  }

  // Load BRCs reference data
  let brcsData = [];
  if (fs.existsSync(BRCS_FILE)) {
    brcsData = JSON.parse(fs.readFileSync(BRCS_FILE, 'utf8'));
    console.log(`  📌 Loaded ${brcsData.length} BRCs from brcs.json`);
  } else {
    console.warn('  ⚠️  brcs.json not found — BRC code resolution will use hub names directly');
  }

  // Read Excel
  const workbook = xlsx.readFile(xlsxPath);
  console.log(`  📋 Sheets: ${workbook.SheetNames.join(', ')}`);
  console.log('');

  // Parse all sheets — each sheet is a district
  // Row 0: Title row (e.g., "Alappuzha - Expert Hub Allocation")
  // Row 1: Header (Expert Name, Hub Name, BRC Name, Date of Birth, Mobile Number, Permanent Address, Email ID)
  // Row 2+: Data with forward-fill pattern

  const expertMap = new Map(); // email -> expert object
  const unmatchedHubs = []; // track hubs that couldn't be resolved to a BRC code
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const district = sheetName.trim();

    console.log(`  ── ${district} ──`);

    // Forward-fill state
    let currentName = null;
    let currentDob = null;
    let currentMobile = null;
    let currentAddress = null;
    let currentEmail = null;

    // Skip row 0 (title) and row 1 (headers), start at row 2
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const [name, hubName, brcName, dob, mobile, address, email] = row;

      // Skip completely empty rows
      if (!name && !hubName && !brcName) continue;

      // Forward-fill: update current expert details when a new expert name appears
      if (name) {
        currentName = String(name).trim();
        currentDob = dob;
        currentMobile = mobile ? String(mobile).trim() : null;
        currentAddress = address ? String(address).trim() : null;
        currentEmail = email ? String(email).trim().toLowerCase() : null;
      }

      // Skip rows where we still don't have a valid expert (shouldn't happen after forward-fill)
      if (!currentName || !currentEmail) continue;

      // This row has a Hub/BRC assignment
      if (!hubName && !brcName) continue;

      totalRows++;

      const hubNameStr = hubName ? String(hubName).trim() : null;
      const brcNameStr = brcName ? String(brcName).trim() : null;

      // Try to resolve to a BRC code
      const brcCode = findBrcCode(hubNameStr, brcNameStr, district, brcsData);

      if (!brcCode) {
        unmatchedHubs.push({ district, hubName: hubNameStr, brcName: brcNameStr, expert: currentName });
      }

      // Create or update expert entry
      if (!expertMap.has(currentEmail)) {
        expertMap.set(currentEmail, {
          name: currentName,
          email: currentEmail,
          dob: excelDateToString(currentDob),
          phone: currentMobile,
          address: currentAddress,
          district, // primary district (first seen)
          assignedBrcs: [],
          hubNames: [], // for reference
        });
      }

      const expert = expertMap.get(currentEmail);
      const assignmentId = brcCode || brcNameStr || hubNameStr;
      if (assignmentId && !expert.assignedBrcs.includes(assignmentId)) {
        expert.assignedBrcs.push(assignmentId);
      }
      if (hubNameStr && !expert.hubNames.includes(hubNameStr)) {
        expert.hubNames.push(hubNameStr);
      }
    }

    const sheetExperts = [...expertMap.values()].filter(e => e.district === district);
    console.log(`     Experts: ${sheetExperts.length}, Hub assignments processed`);
  }

  console.log('');
  console.log(`  📊 Total distinct experts: ${expertMap.size}`);
  console.log(`  📊 Total hub/BRC rows processed: ${totalRows}`);

  // Generate user objects
  console.log('');
  console.log('  🔐 Hashing passwords...');
  const hashedPassword = await bcrypt.hash(GENERIC_PASSWORD, SALT_ROUNDS);

  const experts = [];
  const usernameSet = new Set();

  for (const [email, data] of expertMap) {
    // Generate a unique username from email prefix
    let username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
    if (usernameSet.has(username)) {
      username = email; // fallback to full email if prefix conflicts
    }
    usernameSet.add(username);

    experts.push({
      id: crypto.randomUUID(),
      name: data.name,
      username,
      phone: data.phone,
      email: data.email,
      dob: data.dob,
      address: data.address,
      role: 'EXPERT',
      mustChangePassword: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedBrcs: data.assignedBrcs,
      password: hashedPassword,
    });
  }

  // Write output
  fs.writeFileSync(EXPERTS_OUT, JSON.stringify(experts, null, 2));
  console.log(`  ✅ Wrote ${experts.length} experts to ${EXPERTS_OUT}`);

  // Report unmatched hubs
  if (unmatchedHubs.length > 0) {
    console.log('');
    console.log(`  ⚠️  ${unmatchedHubs.length} hub(s) could not be resolved to BRC codes:`);
    unmatchedHubs.forEach(u => {
      console.log(`     • ${u.district} | Hub: "${u.hubName}" | BRC: "${u.brcName}" | Expert: ${u.expert}`);
    });
    console.log('');
    console.log('  These were stored using the BRC name as a fallback identifier.');
  }

  // Summary table
  console.log('');
  console.log('  ──────────────────────────────────────────');
  console.log('  Expert Summary:');
  console.log('  ──────────────────────────────────────────');
  experts.forEach(e => {
    console.log(`  ${e.name.padEnd(30)} | ${e.email.padEnd(35)} | BRCs: ${e.assignedBrcs.length}`);
  });
  console.log('');
  console.log('  🔑 Default password: Expert@123');
  console.log('  🔒 All accounts require password change on first login.');
  console.log('');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
