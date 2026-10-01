import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/server/auth';
import { SERVER_CONFIG } from '@/lib/server/config';
import { FieldValue } from 'firebase-admin/firestore';

interface ImportMemberItem {
  name: string;
  registrationNumber: string;
  email: string;
  phone?: string;
  team: string;
  position: string;
}

async function isAuthorizedToImport(email: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();

  // 1. Super Admin via env
  if (SERVER_CONFIG.SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase().trim() === normalized)) {
    return true;
  }

  try {
    // 2. Super Admins collection
    const superDoc = await adminDb.collection('super_admins').doc(normalized).get();
    if (superDoc.exists) return true;

    // 3. Admins collection
    const adminDoc = await adminDb.collection('admins').doc(normalized).get();
    if (adminDoc.exists) return true;

    // 4. Role check from config/permissions or roles collection
    const roleDoc = await adminDb.collection('roles').doc(normalized).get();
    if (roleDoc.exists) {
      const userRole = roleDoc.data()?.role;
      if (userRole && ['admin', 'super admin', 'technical'].includes(userRole.toLowerCase())) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Members Import API] Auth check error:', err);
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateRequest(req);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const callerEmail = authResult.user.email;
    const authorized = await isAuthorizedToImport(callerEmail);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You must be an Administrator to import members.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawMembers: ImportMemberItem[] = Array.isArray(body?.members) ? body.members : [];

    if (rawMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No member records provided to import.' },
        { status: 400 }
      );
    }

    if (rawMembers.length > 2500) {
      return NextResponse.json(
        { success: false, error: 'Exceeded maximum batch limit of 2,500 members per import.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const membersCollection = adminDb.collection('members');

    // Clean and deduplicate payload within the batch
    const sanitizedList: (ImportMemberItem & { docId: string })[] = [];
    const seenKeys = new Set<string>();

    for (const m of rawMembers) {
      const cleanEmail = (m.email || '').toLowerCase().trim();
      const cleanReg = (m.registrationNumber || '').toUpperCase().trim();
      const cleanName = (m.name || '').trim();
      const cleanPhone = (m.phone || '').trim();
      const cleanTeam = (m.team || 'General').trim();
      const cleanPos = (m.position || 'Member').trim();

      if (!cleanEmail && !cleanReg && !cleanName) continue;

      const docId = cleanReg || cleanEmail.replace(/[/@.]/g, '_');
      const uniqueKey = cleanEmail || cleanReg || docId;

      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        sanitizedList.push({
          name: cleanName || 'Member',
          registrationNumber: cleanReg,
          email: cleanEmail || (cleanReg ? `${cleanReg.toLowerCase()}@vitbhopal.ac.in` : ''),
          phone: cleanPhone,
          team: cleanTeam,
          position: cleanPos,
          docId,
        });
      }
    }

    // Process in batches of 400 to respect Firestore transaction limits
    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < sanitizedList.length; i += CHUNK_SIZE) {
      const chunk = sanitizedList.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const item of chunk) {
        const docRef = membersCollection.doc(item.docId);
        batch.set(
          docRef,
          {
            name: item.name,
            registrationNumber: item.registrationNumber,
            email: item.email,
            phone: item.phone || '',
            team: item.team,
            position: item.position,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      await batch.commit();
      savedCount += chunk.length;
    }

    // Record audit log
    try {
      await adminDb.collection('admin_logs').add({
        action: 'IMPORT_CSV_MEMBERS',
        actorEmail: callerEmail,
        timestamp: FieldValue.serverTimestamp(),
        createdAt: nowIso,
        details: {
          totalSubmitted: rawMembers.length,
          savedCount,
        },
      });
    } catch (logErr) {
      console.warn('[Members Import API] Audit log insertion notice:', logErr);
    }

    return NextResponse.json({
      success: true,
      count: savedCount,
      timestamp: nowIso,
      message: `Successfully imported ${savedCount} members into Firestore database.`,
    });
  } catch (err: any) {
    console.error('[Members Import API] Unhandled server error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to import members to database.' },
      { status: 500 }
    );
  }
}
