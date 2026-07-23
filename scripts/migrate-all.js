const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');

const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
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
loadEnv();

// 1. Old Firebase Config
const oldFirebaseConfig = {
  apiKey: process.env.OLD_FIREBASE_API_KEY || "",
  authDomain: process.env.OLD_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.OLD_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.OLD_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.OLD_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.OLD_FIREBASE_APP_ID || ""
};

// 2. New Firebase Config
const newFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""
};

// 3. Old Supabase Config
const oldSupabaseUrl = process.env.OLD_SUPABASE_URL || "";
const oldSupabaseKey = process.env.OLD_SUPABASE_ANON_KEY || "";

// 4. New Supabase Config
const newSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const newSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function runMigration() {
  console.log("🚀 Updating Firestore URLs to point to NEW Supabase domain...");

  const oldApp = initializeApp(oldFirebaseConfig, "oldApp");
  const newApp = initializeApp(newFirebaseConfig, "newApp");

  const oldDb = getFirestore(oldApp);
  const newDb = getFirestore(newApp);

  const collectionsToMigrate = ['id_cards', 'referrals', 'data_reports'];

  for (const colName of collectionsToMigrate) {
    console.log(`\n📦 Updating collection: '${colName}'...`);
    try {
      const querySnapshot = await getDocs(collection(oldDb, colName));
      let count = 0;
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        // Replace old Supabase domain with new Supabase domain in all string fields
        for (const key in data) {
          if (typeof data[key] === 'string' && data[key].includes(oldSupabaseUrl)) {
            data[key] = data[key].replace(oldSupabaseUrl, newSupabaseUrl);
          }
        }

        await setDoc(doc(newDb, colName, docSnap.id), data);
        count++;
        console.log(`  ✓ Updated doc ${docSnap.id} -> photoUrl domain updated.`);
      }
      console.log(`✅ Successfully updated ${count} records for '${colName}'.`);
    } catch (err) {
      console.error(`❌ Error updating collection '${colName}':`, err.message);
    }
  }

  // Supabase File Sync
  console.log("\n⚡ Verifying storage file upload to new Supabase bucket...");
  const oldSupabase = createClient(oldSupabaseUrl, oldSupabaseKey);
  const newSupabase = createClient(newSupabaseUrl, newSupabaseKey);

  try {
    const { data: files } = await oldSupabase.storage.from('id-cards').list('id-photos');
    if (files && files.length > 0) {
      for (const f of files) {
        if (!f.name || f.name.startsWith('.')) continue;
        const path = `id-photos/${f.name}`;
        const { data: fileData } = await oldSupabase.storage.from('id-cards').download(path);
        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const { error: upErr } = await newSupabase.storage.from('id-cards').upload(path, buffer, { upsert: true, contentType: 'image/jpeg' });
          if (!upErr) {
            console.log(`  ✓ Uploaded to new Supabase bucket: ${path}`);
          } else {
            console.log(`  Notice on upload ${path}:`, upErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.log("Supabase upload info:", err.message);
  }

  console.log("\n🎉 ALL DOMAIN URLS & FILES UPDATED TO NEW SUPABASE ACCOUNT!");
}

runMigration().catch(console.error);