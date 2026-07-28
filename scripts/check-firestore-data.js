const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');
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

async function checkFirestore() {
  console.log(`🔎 Checking Firestore collections for project: '${firebaseConfig.projectId}'...`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const collectionsToCheck = ['members', 'admins', 'users', 'id-cards', 'payments', 'admin_logs'];

  for (const colName of collectionsToCheck) {
    try {
      const colRef = collection(db, colName);
      const snap = await getDocs(query(colRef, limit(10)));
      console.log(`\n📂 Collection '${colName}': ${snap.size} documents found (previewing up to 10)`);
      snap.forEach(docSnap => {
        console.log(`  📄 ID: ${docSnap.id} =>`, JSON.stringify(docSnap.data()).slice(0, 120));
      });
    } catch (err) {
      console.error(`  ❌ Error querying collection '${colName}':`, err.message);
    }
  }
  process.exit(0);
}

checkFirestore();
