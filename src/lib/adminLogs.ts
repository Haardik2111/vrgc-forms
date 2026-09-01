import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export const MAX_LOG_RETENTION_COUNT = 15;

export type AdminActionType =
  | 'VERIFY'
  | 'PAYMENT_PAID'
  | 'SET_PENDING'
  | 'CREATE_DUE'
  | 'EDIT_DUE'
  | 'EDIT_INVOICE_CAMPAIGN'
  | 'EDIT_INVOICE_SINGLE'
  | 'ASSIGN_ALL'
  | 'ASSIGN_MULTI'
  | 'DELETE'
  | 'SYNC_SHEETS'
  | 'DOWNLOAD';

interface LogAdminActionParams {
  adminEmail: string;
  action: AdminActionType;
  targetEmail?: string;
  targetName?: string;
  details?: string;
}

/**
 * Automatically prunes the Firestore `admin_logs` collection to keep only the latest 15 logs.
 * Any log beyond the top 15 most recent entries is permanently deleted from Firestore.
 */
export const purgeExpiredLogs = async (maxLogs = MAX_LOG_RETENTION_COUNT): Promise<number> => {
  try {
    const q = query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    
    if (snap.docs.length <= maxLogs) return 0;

    // Everything after index (maxLogs - 1) should be deleted
    const docsToDelete = snap.docs.slice(maxLogs);
    let deletedCount = 0;

    const deletions = docsToDelete.map(async (docSnap) => {
      await deleteDoc(doc(db, 'admin_logs', docSnap.id));
      deletedCount++;
    });

    await Promise.allSettled(deletions);
    return deletedCount;
  } catch (err) {
    console.warn('[AdminLogs] Retention limit cleanup notice:', err);
    return 0;
  }
};

/**
 * Writes an admin action log entry to the `admin_logs` Firestore collection.
 * Automatically retains only the latest 15 logs in Firebase by pruning older ones in the background.
 */
export const logAdminAction = async ({
  adminEmail,
  action,
  targetEmail,
  targetName,
  details,
}: LogAdminActionParams): Promise<void> => {
  try {
    await addDoc(collection(db, 'admin_logs'), {
      adminEmail,
      action,
      targetEmail: targetEmail || null,
      targetName: targetName || null,
      details: details || null,
      timestamp: serverTimestamp(),
    });

    // Automatically enforce 15-logs retention limit in Firebase
    purgeExpiredLogs(MAX_LOG_RETENTION_COUNT).catch(() => {});
  } catch (err) {
    console.error('[AdminLogs] Failed to write log entry:', err);
  }
};
