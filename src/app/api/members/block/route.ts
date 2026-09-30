import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { authenticateRequest } from '@/lib/server/auth';
import { SERVER_CONFIG } from '@/lib/server/config';
import { FieldValue } from 'firebase-admin/firestore';

async function isAuthorizedToBlock(email: string | null): Promise<boolean> {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();

  // 1. Super Admin via env
  if (SERVER_CONFIG.SUPER_ADMIN_EMAILS.includes(normalized)) {
    return true;
  }

  try {
    // 2. Super Admins collection
    const superDoc = await adminDb.collection('super_admins').doc(normalized).get();
    if (superDoc.exists) return true;

    // 3. Admins collection
    const adminDoc = await adminDb.collection('admins').doc(normalized).get();
    if (adminDoc.exists) return true;

    // 4. Role check from config/permissions (allowedBlockAccessRoles)
    const permsDoc = await adminDb.collection('config').doc('permissions').get();
    const permsData = permsDoc.data();
    const allowedRoles: string[] = permsData?.allowedBlockAccessRoles || ['Admin', 'Technical'];

    // Check caller's role doc
    const roleDoc = await adminDb.collection('roles').doc(normalized).get();
    if (roleDoc.exists) {
      const userRole = roleDoc.data()?.role;
      if (userRole && allowedRoles.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
        return true;
      }
    }

    // Check caller's member doc position/role
    const memberSnap = await adminDb.collection('members').where('email', '==', normalized).limit(1).get();
    if (!memberSnap.empty) {
      const memberData = memberSnap.docs[0].data();
      const pos = (memberData.position || memberData.role || '').toLowerCase();
      if (allowedRoles.some(r => pos.includes(r.toLowerCase()))) {
        return true;
      }
    }
  } catch (err) {
    console.warn('[Members Block API] Authorization verification error:', err);
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
    const authorized = await isAuthorizedToBlock(callerEmail);
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not have permission to block or unblock club members.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, registrationNumber, isBlocked } = body;

    if (!email && !registrationNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing identifier: email or registrationNumber is required.' },
        { status: 400 }
      );
    }

    const targetEmail = (email || '').toLowerCase().trim();
    const targetReg = (registrationNumber || '').toUpperCase().trim();
    const blockStatus = Boolean(isBlocked);

    // Prevent blocking Super Admins
    if (targetEmail && SERVER_CONFIG.SUPER_ADMIN_EMAILS.includes(targetEmail)) {
      return NextResponse.json(
        { success: false, error: 'Protection violation: Super Administrators cannot be blocked.' },
        { status: 400 }
      );
    }

    let updatedDocsCount = 0;
    const nowIso = new Date().toISOString();

    // 1. Update matching documents in `members` collection if they exist
    const membersCollection = adminDb.collection('members');
    const matchedDocs = new Map<string, FirebaseFirestore.DocumentReference>();

    if (targetEmail) {
      const emailSnap = await membersCollection.where('email', '==', targetEmail).get();
      emailSnap.forEach(d => {
        // If it was a dummy/stub record created earlier with no valid name, prune it
        const data = d.data();
        if (data.name === 'Member' && (!data.registrationNumber || data.registrationNumber.includes('@'))) {
          d.ref.delete().catch(() => {});
        } else {
          matchedDocs.set(d.id, d.ref);
        }
      });
    }
    if (targetReg) {
      const regSnap = await membersCollection.where('registrationNumber', '==', targetReg).get();
      regSnap.forEach(d => matchedDocs.set(d.id, d.ref));
      const directRegDoc = await membersCollection.doc(targetReg).get();
      if (directRegDoc.exists) matchedDocs.set(directRegDoc.id, directRegDoc.ref);
    }

    if (matchedDocs.size > 0) {
      const batch = adminDb.batch();
      matchedDocs.forEach(ref => {
        batch.set(ref, { isBlocked: blockStatus, updatedAt: nowIso }, { merge: true });
        updatedDocsCount++;
      });
      await batch.commit();
    }

    // 2. Update matching documents in `id_cards` collection ONLY if they exist
    if (targetEmail) {
      try {
        const idCardDoc = await adminDb.collection('id_cards').doc(targetEmail).get();
        if (idCardDoc.exists) {
          const idData = idCardDoc.data();
          // If it was an empty stub, delete it
          if (!idData?.name && !idData?.regNo) {
            await idCardDoc.ref.delete();
          } else {
            await idCardDoc.ref.set({ isBlocked: blockStatus, updatedAt: nowIso }, { merge: true });
          }
        }
      } catch (idErr) {
        console.warn('[Members Block API] Error syncing id_cards doc:', idErr);
      }
    }
    if (targetReg) {
      try {
        const idCardRegSnap = await adminDb.collection('id_cards').where('regNo', '==', targetReg).get();
        if (!idCardRegSnap.empty) {
          const idBatch = adminDb.batch();
          idCardRegSnap.forEach(d => {
            idBatch.set(d.ref, { isBlocked: blockStatus, updatedAt: nowIso }, { merge: true });
          });
          await idBatch.commit();
        }
      } catch (idErr2) {
        console.warn('[Members Block API] Error syncing id_cards by regNo:', idErr2);
      }
    }

    // 3. Always maintain state in `blocked_users` collection for robust authority
    if (targetEmail) {
      try {
        const blockedUsersRef = adminDb.collection('blocked_users').doc(targetEmail);
        if (blockStatus) {
          await blockedUsersRef.set({
            email: targetEmail,
            registrationNumber: targetReg || '',
            isBlocked: true,
            updatedAt: nowIso,
          }, { merge: true });
        } else {
          await blockedUsersRef.delete().catch(() => {});
        }
      } catch (bErr) {
        console.warn('[Members Block API] Error syncing blocked_users doc:', bErr);
      }
    }

    // 3. Update Firebase Auth (backend enforcement: disable account & revoke refresh tokens)
    let firebaseAuthUpdated = false;
    let authUid: string | null = null;

    if (targetEmail) {
      try {
        const authUser = await adminAuth.getUserByEmail(targetEmail);
        authUid = authUser.uid;
        await adminAuth.updateUser(authUser.uid, {
          disabled: blockStatus,
        });

        if (blockStatus) {
          // Immediately revoke all existing refresh tokens so current active session is killed
          await adminAuth.revokeRefreshTokens(authUser.uid);
        }
        firebaseAuthUpdated = true;
      } catch (authErr: any) {
        if (authErr?.code === 'auth/user-not-found') {
          // User hasn't signed in to Firebase Auth yet; Firestore flag will block them upon first login attempt
          firebaseAuthUpdated = false;
        } else {
          console.warn('[Members Block API] Firebase Auth updateUser error:', authErr);
        }
      }
    }

    // 4. Record Administrative Audit Log
    try {
      await adminDb.collection('admin_logs').add({
        action: blockStatus ? 'BLOCK_MEMBER_ACCESS' : 'UNBLOCK_MEMBER_ACCESS',
        actorEmail: callerEmail,
        timestamp: FieldValue.serverTimestamp(),
        createdAt: nowIso,
        details: {
          targetEmail,
          targetReg,
          isBlocked: blockStatus,
          authUid,
          firebaseAuthUpdated,
          updatedDocsCount,
        },
      });
    } catch (logErr) {
      console.warn('[Members Block API] Audit log insertion notice:', logErr);
    }

    return NextResponse.json({
      success: true,
      email: targetEmail,
      registrationNumber: targetReg,
      isBlocked: blockStatus,
      firebaseAuthUpdated,
      message: blockStatus
        ? `Access successfully blocked for ${targetEmail || targetReg}. Backend credentials disabled.`
        : `Access successfully restored for ${targetEmail || targetReg}.`,
    });
  } catch (err: any) {
    console.error('[Members Block API] Unhandled server error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
