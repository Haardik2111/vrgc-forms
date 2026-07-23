const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const firebaseConfig = {
  apiKey: "AIzaSyANu9lQsIX2JXGoViJ_Oag66Cltd0YzXI0",
  authDomain: "vrgc-form.firebaseapp.com",
  projectId: "vrgc-form",
  storageBucket: "vrgc-form.firebasestorage.app",
  messagingSenderId: "830392164988",
  appId: "1:830392164988:web:9613ae484e4ab64d281ff9"
};

const supabaseUrl = "https://fopyejijjeoumimsdgiz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcHllamlqamVvdW1pbXNkZ2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3Mjg4NDMsImV4cCI6MjEwMDMwNDg0M30.NQVEJKOzJnNoFGs8tgDTkbMrc4OgE_w9bhSpsZ4Cxm4";

const sanitize = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

function extractGiphyId(url) {
  if (!url || !url.includes('giphy.com')) return null;
  const match = url.match(/\/([a-zA-Z0-9]{10,30})\/giphy\.gif/i) ||
                url.match(/\/gifs\/(?:.*-)?([a-zA-Z0-9]{10,30})/i) ||
                url.match(/giphy\.com\/media\/([a-zA-Z0-9]{10,30})/i);
  return match ? match[1] : null;
}

function downloadImageViaCurl(url) {
  const tempFile = path.join(os.tmpdir(), `avatar_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  try {
    const cmd = `curl.exe -sL --max-time 15 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}" -o "${tempFile}"`;
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

async function migrateExistingGifAvatars() {
  console.log("🚀 Starting GIF Avatar Migration to Supabase 'avatar' Bucket...");

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const querySnapshot = await getDocs(collection(db, 'id_cards'));
  console.log(`📋 Found ${querySnapshot.size} candidate dossiers in Firestore.`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const docSnap of querySnapshot.docs) {
    const candidateId = docSnap.id;
    const data = docSnap.data();
    const avatarUrl = data.avatarUrl;

    if (!avatarUrl || typeof avatarUrl !== 'string' || !avatarUrl.trim()) {
      totalSkipped++;
      continue;
    }

    // Check if avatar is already hosted on our Supabase bucket
    const isSupabaseHosted = avatarUrl.includes('.supabase.co/storage/v1/object/public/avatar/');

    if (isSupabaseHosted) {
      console.log(`  ✓ Skipping ${candidateId}: Already hosted on Supabase avatar bucket.`);
      totalSkipped++;
      continue;
    }

    console.log(`  ⏳ Processing ${candidateId}: Fetching external GIF link: ${avatarUrl}`);

    try {
      let fetchUrls = [avatarUrl];
      const giphyId = extractGiphyId(avatarUrl);
      if (giphyId) {
        fetchUrls = [
          `https://media.giphy.com/media/${giphyId}/giphy-downsized.gif`,
          `https://i.giphy.com/media/${giphyId}/giphy.gif`,
          `https://i.giphy.com/media/${giphyId}/200.gif`
        ];
      }

      let buffer = null;
      for (const u of fetchUrls) {
        buffer = downloadImageViaCurl(u);
        if (buffer && buffer.length > 0) {
          if (buffer.length < 5242880) {
            break;
          }
        }
      }

      if (!buffer || buffer.length === 0) {
        throw new Error(`Could not fetch binary image data from link.`);
      }

      let avatarExt = 'gif';
      if (buffer.length > 4) {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) avatarExt = 'png';
        else if (buffer[0] === 0xFF && buffer[1] === 0xD8) avatarExt = 'jpg';
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) avatarExt = 'webp';
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) avatarExt = 'gif';
      }

      const userRegNo = data.registrationNumber || candidateId || 'NO_REG';
      const userNameStr = sanitize(data.name || 'user');
      const userEmailStr = sanitize(data.email || candidateId);
      const timestamp = Date.now();

      const avatarFileName = `${userRegNo}_${userNameStr}_${userEmailStr}_avatar_${timestamp}.${avatarExt}`;
      const avatarFilePath = `avatars/${avatarFileName}`;

      let uploadRes = await supabase.storage
        .from('avatar')
        .upload(avatarFilePath, buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: avatarExt === 'gif' ? 'image/gif' : avatarExt === 'png' ? 'image/png' : avatarExt === 'webp' ? 'image/webp' : 'image/jpeg'
        });

      if (uploadRes.error && giphyId) {
        // If uploading full size failed, try downsized variant for Giphy
        for (const downsizedUrl of [`https://media.giphy.com/media/${giphyId}/giphy-downsized.gif`, `https://i.giphy.com/media/${giphyId}/200.gif`]) {
          const downsizedBuffer = downloadImageViaCurl(downsizedUrl);
          if (downsizedBuffer && downsizedBuffer.length > 0) {
            uploadRes = await supabase.storage
              .from('avatar')
              .upload(avatarFilePath, downsizedBuffer, {
                cacheControl: '3600',
                upsert: true,
                contentType: 'image/gif'
              });
            if (!uploadRes.error) break;
          }
        }
      }

      if (uploadRes.error) {
        throw new Error(`Supabase storage error: ${uploadRes.error.message}`);
      }

      const { data: { publicUrl: newSupabaseUrl } } = supabase.storage
        .from('avatar')
        .getPublicUrl(avatarFilePath);

      // Update Firestore document
      await updateDoc(doc(db, 'id_cards', candidateId), {
        avatarUrl: newSupabaseUrl
      });

      totalMigrated++;
      console.log(`  ✅ Successfully migrated ${candidateId} -> ${newSupabaseUrl}`);

    } catch (err) {
      totalFailed++;
      console.error(`  ❌ Failed to migrate avatar for ${candidateId}:`, err.message);
    }
  }

  console.log(`\n🎉 MIGRATION SUMMARY:`);
  console.log(`   - Migrated to Supabase: ${totalMigrated}`);
  console.log(`   - Already hosted / Skipped: ${totalSkipped}`);
  console.log(`   - Failed: ${totalFailed}`);
}

migrateExistingGifAvatars().catch(console.error);
