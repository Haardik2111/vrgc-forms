const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// env loader
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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const sanitize = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

function downloadQrCode(regNo) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vrgcforms.vercel.app';
  const qrContent = `${appUrl}/card/${encodeURIComponent(regNo)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=0-0-0&bgcolor=ffffff&data=${encodeURIComponent(qrContent)}`;
  const tempFile = path.join(os.tmpdir(), `qr_temp_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  
  try {
    const cmd = `curl.exe -sL --max-time 15 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${qrApiUrl}" -o "${tempFile}"`;
    execSync(cmd, { stdio: 'ignore' });
    if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 0) {
      const buffer = fs.readFileSync(tempFile);
      fs.unlinkSync(tempFile);
      return buffer;
    }
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return null;
  } catch (err) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    return null;
  }
}

async function migrateQrCodes() {
  console.log("🚀 Starting QR Code Generation & Upload to Supabase 'qr-codes' Bucket...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const querySnapshot = await getDocs(collection(db, 'id_cards'));
    console.log(`📋 Found ${querySnapshot.docs.length} candidate documents in Firestore.\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const email = docSnap.id.toLowerCase();
      const regNo = data.registrationNumber || '24XXXXXX';
      const name = data.name || 'Candidate';

      console.log(`--------------------------------------------------`);
      console.log(`Candidate: ${name} (${regNo}) | ${email}`);

      if (data.qrCodeUrl && data.qrCodeUrl.includes('/qr-codes/')) {
        console.log(`⏩ Already has Supabase QR code: ${data.qrCodeUrl}`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 Generating 300x300 QR Code for ${regNo}...`);
      const qrBuffer = downloadQrCode(regNo);

      if (!qrBuffer) {
        console.error(`❌ Failed to download QR code image for ${regNo}`);
        errorCount++;
        continue;
      }

      const userRegNoStr = sanitize(regNo);
      const userNameStr = sanitize(name);
      const userEmailStr = sanitize(email);
      const qrFileName = `${userRegNoStr}_${userNameStr}_${userEmailStr}_qr.png`;
      const qrFilePath = `qrcodes/${qrFileName}`;

      console.log(`📤 Uploading to Supabase 'qr-codes' bucket as ${qrFilePath}...`);
      const { data: uploadResult, error: uploadErr } = await supabase.storage
        .from('qr-codes')
        .upload(qrFilePath, qrBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/png'
        });

      if (uploadErr) {
        console.error(`❌ Supabase upload failed for ${email}:`, uploadErr.message);
        errorCount++;
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('qr-codes')
        .getPublicUrl(qrFilePath);

      console.log(`✅ Uploaded successfully! Public URL:\n   ${publicUrl}`);

      console.log(`💾 Updating Firestore document '${email}' with qrCodeUrl...`);
      await updateDoc(doc(db, 'id_cards', email), {
        qrCodeUrl: publicUrl
      });

      console.log(`✨ Successfully migrated QR code for ${name}!`);
      processedCount++;
    }

    console.log(`\n==================================================`);
    console.log(`🎉 QR CODE MIGRATION COMPLETE SUMMARY:`);
    console.log(`   - Total Document Records: ${querySnapshot.docs.length}`);
    console.log(`   - Uploaded & Updated:     ${processedCount}`);
    console.log(`   - Skipped (Already Done): ${skippedCount}`);
    console.log(`   - Failed / Errors:        ${errorCount}`);
    console.log(`==================================================\n`);

  } catch (err) {
    console.error("💥 Critical migration script failure:", err);
  }
}

migrateQrCodes();