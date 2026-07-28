const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');
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

async function seedFirestore() {
  console.log(`🚀 Starting Firestore Seeding for project: '${firebaseConfig.projectId}'...`);

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('❌ Missing Firebase config. Check your .env.local file.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 1. Seed Admins
  const defaultAdmins = [
    'vrgc@vitbhopal.ac.in',
    'admin@vrgc.club'
  ];

  console.log('📦 Seeding Admins collection...');
  for (const adminEmail of defaultAdmins) {
    const docId = adminEmail.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await setDoc(doc(db, 'admins', docId), {
      email: adminEmail.toLowerCase(),
      role: 'admin',
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`  ✅ Added Admin: ${adminEmail}`);
  }

  console.log('\n🎉 Firestore Seeding Complete!');
  process.exit(0);
}

seedFirestore().catch(err => {
  console.error('❌ Error seeding Firestore:', err);
  process.exit(1);
});
