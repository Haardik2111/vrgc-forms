const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '..', '.env.local')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim();
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}
loadEnv();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};

async function migrateCsvToFirestore() {
  const targetCsvPath = process.argv[2] || path.join(__dirname, '..', 'public', 'members.csv');
  const targetAdminsCsvPath = process.argv[3] || path.join(__dirname, '..', 'public', 'admins.csv');

  console.log(`🚀 Migrating CSV data into Firestore project: '${firebaseConfig.projectId}'...`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 1. Migrate Admins if file exists
  if (fs.existsSync(targetAdminsCsvPath)) {
    const text = fs.readFileSync(targetAdminsCsvPath, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.toLowerCase().startsWith('email'));
    console.log(`\n📦 Importing ${lines.length} Admins to Firestore...`);

    for (const line of lines) {
      const email = line.trim().toLowerCase();
      if (!email) continue;
      const docId = email.replace(/[^a-z0-9]/g, '_');
      await setDoc(doc(db, 'admins', docId), {
        email: email,
        role: 'admin',
        createdAt: serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ Admin added: ${email}`);
    }
  }

  // 2. Migrate Members if file exists
  if (fs.existsSync(targetCsvPath)) {
    const text = fs.readFileSync(targetCsvPath, 'utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 1) {
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const regIdx = headers.findIndex(h => h.includes('registration'));
      const phoneIdx = headers.findIndex(h => h.includes('phone'));
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const teamIdx = headers.findIndex(h => h.includes('team'));
      const posIdx = headers.findIndex(h => h.includes('position'));

      console.log(`\n📦 Importing ${lines.length - 1} Members to Firestore...`);

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const email = (cols[emailIdx] || '').toLowerCase();
        const regNo = (cols[regIdx] || '').toUpperCase();

        if (!email && !regNo) continue;

        const docId = regNo || email.replace(/[^a-z0-9]/g, '_');
        const memberObj = {
          name: cols[nameIdx] || '',
          registrationNumber: regNo,
          phone: cols[phoneIdx] || '',
          email: email,
          team: cols[teamIdx] || '',
          position: cols[posIdx] || 'Member',
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'members', docId), memberObj, { merge: true });
        console.log(`  ✅ Member added: ${memberObj.name} (${regNo || email})`);
      }
    }
  }

  console.log('\n🎉 Migration complete! Firestore now holds all your member and admin records.');
  process.exit(0);
}

migrateCsvToFirestore().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
