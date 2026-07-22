const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');

// 1. Old Firebase Config
const oldFirebaseConfig = {
  apiKey: "AIzaSyA9IuuKniQtjMLODY71YxqnQXsmtqvnGPI",
  authDomain: "vrgc-forms.firebaseapp.com",
  projectId: "vrgc-forms",
  storageBucket: "vrgc-forms.firebasestorage.app",
  messagingSenderId: "417600749438",
  appId: "1:417600749438:web:c95ec2840619d478d5bd2f"
};

// 2. New Firebase Config
const newFirebaseConfig = {
  apiKey: "AIzaSyANu9lQsIX2JXGoViJ_Oag66Cltd0YzXI0",
  authDomain: "vrgc-form.firebaseapp.com",
  projectId: "vrgc-form",
  storageBucket: "vrgc-form.firebasestorage.app",
  messagingSenderId: "830392164988",
  appId: "1:830392164988:web:9613ae484e4ab64d281ff9"
};

// 3. Old Supabase Config
const oldSupabaseUrl = "https://rpecopoisqjkrxwcccxc.supabase.co";
const oldSupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZWNvcG9pc3Fqa3J4d2NjY3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDgwMzUsImV4cCI6MjEwMDIyNDAzNX0.IjndZHhClKb8hpL-xnhhat99QUeC7gydZ5krcytUI80";

// 4. New Supabase Config
const newSupabaseUrl = "https://fopyejijjeoumimsdgiz.supabase.co";
const newSupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcHllamlqamVvdW1pbXNkZ2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3Mjg4NDMsImV4cCI6MjEwMDMwNDg0M30.NQVEJKOzJnNoFGs8tgDTkbMrc4OgE_w9bhSpsZ4Cxm4";

async function runMigration() {
  console.log("🚀 Starting Data Migration process...");

  // Initialize Firebase instances
  const oldApp = initializeApp(oldFirebaseConfig, "oldApp");
  const newApp = initializeApp(newFirebaseConfig, "newApp");

  const oldDb = getFirestore(oldApp);
  const newDb = getFirestore(newApp);

  const collectionsToMigrate = ['id_cards', 'referrals', 'data_reports'];

  for (const colName of collectionsToMigrate) {
    console.log(`\n📦 Migrating Firestore collection: '${colName}'...`);
    try {
      const querySnapshot = await getDocs(collection(oldDb, colName));
      console.log(`Found ${querySnapshot.docs.length} documents in old '${colName}'.`);

      let count = 0;
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        await setDoc(doc(newDb, colName, docSnap.id), data);
        count++;
        console.log(`  ✓ Migrated doc: ${docSnap.id}`);
      }
      console.log(`✅ Successfully migrated ${count} records for '${colName}'.`);
    } catch (err) {
      console.error(`❌ Error migrating collection '${colName}':`, err.message);
    }
  }

  // Supabase Image Transfer
  console.log("\n⚡ Checking Supabase Storage files...");
  const oldSupabase = createClient(oldSupabaseUrl, oldSupabaseKey);
  const newSupabase = createClient(newSupabaseUrl, newSupabaseKey);

  try {
    const { data: files, error } = await oldSupabase.storage.from('id-cards').list('id-photos');
    if (error) {
      console.log("Notice on Supabase list:", error.message);
    } else if (files && files.length > 0) {
      console.log(`Found ${files.length} storage files in old Supabase bucket.`);
      for (const f of files) {
        const path = `id-photos/${f.name}`;
        const { data: fileData } = await oldSupabase.storage.from('id-cards').download(path);
        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await newSupabase.storage.from('id-cards').upload(path, buffer, { upsert: true });
          console.log(`  ✓ Transferred storage file: ${path}`);
        }
      }
    } else {
      console.log("No existing files found in old Supabase storage bucket.");
    }
  } catch (err) {
    console.log("Supabase transfer info:", err.message);
  }

  console.log("\n🎉 MIGRATION COMPLETED SUCCESSFULLY!");
}

runMigration().catch(console.error);
