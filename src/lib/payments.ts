import { authDb as db } from './firebase';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { PaymentItem, PaymentStatus } from '@/types/payment';

// ─── Firestore Collection Names ───────────────────────────────────────────────
export const PAYMENTS_COLLECTION = 'payments';
export const INVOICES_COLLECTION = 'payments';

// ─── Transaction / Invoice Log Type ──────────────────────────────────────────
export interface TransactionLog {
  id: string;
  payment_id?: string;
  user_email: string;
  candidate_name?: string;
  registration_number?: string;
  team?: string;
  payment_title: string;
  amount: number;
  currency: string;
  status: 'Pending' | 'Paid' | 'Failed' | 'Cancelled' | 'Processing';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  payment_method?: string;
  error_description?: string;
  paid_at?: string;
  created_at: string;
  updated_at?: string;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
export const SAMPLE_PAYMENTS: Omit<PaymentItem, 'id' | 'created_at'>[] = [
  {
    title: "VRGC Membership Fee 2026",
    description: "Annual club membership fee covering VR lab access, discord perks, and workshop priority.",
    category: "Club Fee",
    amount: 500,
    currency: "INR",
    status: "Pending",
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: "Cyberpunk Game Jam '26 Pass",
    description: "Registration ticket for the upcoming 48-hour Game Development & VR Hackathon.",
    category: "Event Registration",
    amount: 150,
    currency: "INR",
    status: "Pending",
    due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: "VRGC Cyber Hoodie (Limited Ed.)",
    description: "Official club oversized hoodie with embroidered glow-in-the-dark VRGC insignia.",
    category: "Merchandise",
    amount: 899,
    currency: "INR",
    status: "Pending",
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    title: "VR Lab Equipment Late Fee",
    description: "Overdue return charge for Meta Quest 3 headset (1 day extension).",
    category: "Fine",
    amount: 50,
    currency: "INR",
    status: "Pending",
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

// ─── Firestore Payments CRUD Operations ────────────────────────────────────────

/**
 * Fetch payments from Firestore `invoices` collection.
 * Non-destructive: read-only query.
 */
export async function fetchPaymentsFromFirestore(
  userEmail?: string,
  isAdmin: boolean = false
): Promise<PaymentItem[]> {
  try {
    const colRef = collection(db, INVOICES_COLLECTION);
    let q;

    if (!isAdmin && userEmail && userEmail.trim()) {
      q = query(colRef, where('user_email', '==', userEmail.toLowerCase()));
    } else {
      q = query(colRef);
    }

    const snapshot = await getDocs(q);
    const items: PaymentItem[] = [];

    snapshot.forEach((docSnap) => {
      const data: any = docSnap.data();
      const createdAtIso = data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at || new Date().toISOString();
      const createdTimeMs = new Date(createdAtIso).getTime();
      const nowMs = Date.now();
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

      let status: PaymentStatus = (data.status as PaymentStatus) || 'Pending';
      let errorDesc = data.error_description || '';

      // Auto-expire Pending invoices if created more than 2 hours ago
      if (status === 'Pending' && nowMs - createdTimeMs > TWO_HOURS_MS) {
        status = 'Cancelled';
        errorDesc = 'Invoice expired (2-Hour Expiration Time Exceeded)';
        // Fire-and-forget update to Firestore document
        updateDoc(doc(db, INVOICES_COLLECTION, docSnap.id), {
          status: 'Cancelled',
          error_description: errorDesc,
          updated_at: serverTimestamp(),
        }).catch((e) => console.warn('Auto-expire update warning:', e));
      }

      items.push({
        id: docSnap.id,
        user_email: data.user_email || '',
        candidate_name: data.candidate_name || data.user_name || '',
        registration_number: data.registration_number || data.regNo || '',
        team: data.team || '',
        title: data.title || '',
        description: data.description || '',
        category: data.category || 'Club Fee',
        amount: Number(data.amount) || 0,
        currency: data.currency || 'INR',
        status,
        due_date: data.due_date || new Date(createdTimeMs + TWO_HOURS_MS).toISOString(),
        razorpay_order_id: data.razorpay_order_id || '',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_signature: data.razorpay_signature || '',
        error_description: errorDesc,
        paid_at: data.paid_at || '',
        created_at: createdAtIso,
        updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at || new Date().toISOString(),
      });
    });

    // Client-side sort by created_at descending
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error('Failed to fetch payments from Firestore:', err);
    return [];
  }
}

/**
 * Create a SINGLE payment invoice record in Firestore `invoices` collection.
 */
export async function createPaymentInFirestore(
  paymentData: Omit<PaymentItem, 'id' | 'created_at'> & {
    created_at?: string;
    candidate_name?: string;
    registration_number?: string;
    team?: string;
  }
): Promise<PaymentItem | null> {
  try {
    const nowMs = Date.now();
    const twoHoursLaterMs = nowMs + 2 * 60 * 60 * 1000;
    const nowIso = new Date(nowMs).toISOString();
    const expiryIso = new Date(twoHoursLaterMs).toISOString();
    const cleanEmail = paymentData.user_email ? paymentData.user_email.toLowerCase() : '';

    const defaultDueDate = paymentData.due_date ? paymentData.due_date : expiryIso;
    const expirationNoticeMsg = `⚠️ IMPORTANT: This invoice was generated at ${new Date(nowMs).toLocaleTimeString('en-IN')} and will AUTOMATICALLY EXPIRE in 2 hours (${new Date(twoHoursLaterMs).toLocaleTimeString('en-IN')}). Please complete your payment before expiration.`;
    const fullDescription = paymentData.description
      ? `${paymentData.description}\n\n${expirationNoticeMsg}`
      : expirationNoticeMsg;
    
    // Create EXACTLY 1 document in `invoices` collection
    const docRef = await addDoc(collection(db, INVOICES_COLLECTION), {
      ...paymentData,
      description: fullDescription,
      due_date: defaultDueDate,
      user_email: cleanEmail,
      candidate_name: paymentData.candidate_name || '',
      registration_number: paymentData.registration_number || '',
      team: paymentData.team || '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      source: 'vrgc-forms',
    });

    const newPayment: PaymentItem = {
      ...paymentData,
      id: docRef.id,
      description: fullDescription,
      due_date: defaultDueDate,
      user_email: cleanEmail,
      candidate_name: paymentData.candidate_name || '',
      registration_number: paymentData.registration_number || '',
      team: paymentData.team || '',
      category: paymentData.category as any,
      created_at: paymentData.created_at || nowIso,
      updated_at: nowIso,
    };

    // Send email notification to user via Resend API
    if (cleanEmail && cleanEmail.includes('@')) {
      const resendApiKey = process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY;
      const invoiceEmailText = `
--------------------------------------------------
VRGC PAYMENT INVOICE GENERATED
--------------------------------------------------

INVOICE ID : ${docRef.id}
ITEM / TITLE: ${paymentData.title}
AMOUNT DUE : ₹${paymentData.amount} INR
CATEGORY   : ${paymentData.category}

--------------------------------------------------
⏰ EXPIRATION WARNING:
This invoice has been issued and is VALID FOR 2 HOURS ONLY.
It will automatically expire at: ${new Date(twoHoursLaterMs).toLocaleString('en-IN')}.

Please log in to your VRGC Forms portal to complete your payment before expiration.
--------------------------------------------------
Automated message sent via VRGC Command Center
`;

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "VRGC Billing Desk <onboarding@resend.dev>",
          to: ["vrgcdev@gmail.com"], // In Resend test mode sends to account email; with verified domain sends to cleanEmail
          subject: `[ACTION REQUIRED] VRGC Invoice Generated: ₹${paymentData.amount} (Expires in 2 Hours)`,
          text: invoiceEmailText,
          reply_to: cleanEmail,
        }),
      }).catch((e) => console.warn('Invoice email dispatch warning:', e));
    }

    // Log initial creation attempt inside subcollection `invoices/{id}/attempts`
    try {
      const attemptsColRef = collection(db, INVOICES_COLLECTION, docRef.id, 'attempts');
      await addDoc(attemptsColRef, {
        payment_id: docRef.id,
        user_email: cleanEmail,
        candidate_name: paymentData.candidate_name || '',
        registration_number: paymentData.registration_number || '',
        team: paymentData.team || '',
        payment_title: paymentData.title,
        amount: paymentData.amount,
        currency: paymentData.currency || 'INR',
        status: paymentData.status,
        error_description: 'Invoice issued (Expires in 2 Hours)',
        timestamp: serverTimestamp(),
        created_at: nowIso,
      });
    } catch (e) {
      console.warn('Subcollection attempt log warning:', e);
    }

    return newPayment;
  } catch (err) {
    console.error('Firestore payment create failed:', err);
    return null;
  }
}

/**
 * Update payment status & details in Firestore `invoices` collection.
 */
export async function updatePaymentStatusInFirestore(
  paymentId: string,
  updates: Partial<PaymentItem>
): Promise<boolean> {
  try {
    const docRef = doc(db, INVOICES_COLLECTION, paymentId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Failed to update payment status in Firestore:', err);
    return false;
  }
}

/**
 * Delete a payment record from Firestore `invoices` collection.
 */
export async function deletePaymentFromFirestore(paymentId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, INVOICES_COLLECTION, paymentId));
    return true;
  } catch (err) {
    console.error('Error deleting payment from Firestore:', err);
    return false;
  }
}

// ─── Firestore Invoices & Transaction Logs ─────────────────────────────────────

/**
 * Save a payment invoice record to Firestore `invoices` collection.
 */
export async function saveInvoiceToFirestore(invoice: {
  payment_id?: string;
  user_email: string;
  candidate_name?: string;
  registration_number?: string;
  team?: string;
  title: string;
  description?: string;
  category: string;
  amount: number;
  currency?: string;
  status: PaymentStatus;
  due_date?: string;
}): Promise<string | null> {
  return invoice.payment_id || null;
}

/**
 * Save a completed, failed, or cancelled payment transaction log to Firestore `invoices` collection
 * AND subcollection `attempts` on the payment document.
 */
export async function saveTransactionToFirestore(tx: {
  payment_id?: string;
  user_email: string;
  candidate_name?: string;
  registration_number?: string;
  team?: string;
  payment_title: string;
  amount: number;
  currency?: string;
  status: 'Paid' | 'Failed' | 'Pending' | 'Processing' | 'Cancelled';
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  payment_method?: string;
  error_description?: string;
  paid_at?: string;
}): Promise<string | null> {
  try {
    const cleanEmail = tx.user_email ? tx.user_email.toLowerCase() : '';
    if (tx.payment_id) {
      // 1. Update primary payment status in main `invoices` doc
      await updatePaymentStatusInFirestore(tx.payment_id, {
        status: tx.status as PaymentStatus,
        razorpay_order_id: tx.razorpay_order_id || '',
        razorpay_payment_id: tx.razorpay_payment_id || '',
        razorpay_signature: tx.razorpay_signature || '',
        paid_at: tx.paid_at || (tx.status === 'Paid' ? new Date().toISOString() : ''),
        ...(tx.error_description ? { error_description: tx.error_description } : {}),
      });

      // 2. Log payment attempt entry to subcollection `invoices/{payment_id}/attempts`
      const attemptsColRef = collection(db, INVOICES_COLLECTION, tx.payment_id, 'attempts');
      await addDoc(attemptsColRef, {
        payment_id: tx.payment_id,
        user_email: cleanEmail,
        candidate_name: tx.candidate_name || '',
        registration_number: tx.registration_number || '',
        team: tx.team || '',
        payment_title: tx.payment_title,
        amount: tx.amount,
        currency: tx.currency || 'INR',
        status: tx.status,
        razorpay_order_id: tx.razorpay_order_id || '',
        razorpay_payment_id: tx.razorpay_payment_id || '',
        error_description: tx.error_description || '',
        paid_at: tx.paid_at || '',
        timestamp: serverTimestamp(),
        created_at: new Date().toISOString(),
      });

      return tx.payment_id;
    }
    return null;
  } catch (err) {
    console.warn('Firestore transaction update failed:', err);
    return null;
  }
}

/**
 * Update existing invoice document in `invoices` collection by payment_id.
 */
export async function updateInvoiceInFirestore(
  paymentId: string,
  updates: Partial<{
    status: PaymentStatus;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    paid_at: string;
    error_description: string;
  }>
): Promise<boolean> {
  try {
    const colRef = collection(db, INVOICES_COLLECTION);
    const q = query(colRef, where('payment_id', '==', paymentId));
    const snap = await getDocs(q);

    if (snap.empty) {
      // If invoice doc doesn't exist yet, get primary payment doc to create it
      const payDocRef = doc(db, PAYMENTS_COLLECTION, paymentId);
      const paySnap = await getDoc(payDocRef);
      if (paySnap.exists()) {
        const pData: any = paySnap.data();
        await addDoc(colRef, {
          payment_id: paymentId,
          user_email: (pData.user_email || '').toLowerCase(),
          candidate_name: pData.candidate_name || '',
          registration_number: pData.registration_number || '',
          team: pData.team || '',
          title: pData.title || '',
          description: pData.description || '',
          category: pData.category || 'Club Fee',
          amount: Number(pData.amount) || 0,
          currency: pData.currency || 'INR',
          status: updates.status || pData.status || 'Pending',
          due_date: pData.due_date || '',
          razorpay_order_id: updates.razorpay_order_id || '',
          razorpay_payment_id: updates.razorpay_payment_id || '',
          error_description: updates.error_description || '',
          paid_at: updates.paid_at || '',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
    } else {
      for (const docSnap of snap.docs) {
        await updateDoc(docSnap.ref, {
          ...updates,
          updated_at: serverTimestamp(),
        });
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to update invoice in Firestore:', err);
    return false;
  }
}

/**
 * Fetch all attempt logs for a specific payment ID from Firestore.
 */
export async function fetchPaymentAttemptsFromFirestore(paymentId: string): Promise<TransactionLog[]> {
  try {
    const attemptsColRef = collection(db, PAYMENTS_COLLECTION, paymentId, 'attempts');
    const snapshot = await getDocs(attemptsColRef);
    const logs: TransactionLog[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        payment_id: paymentId,
        user_email: data.user_email || '',
        candidate_name: data.candidate_name || '',
        registration_number: data.registration_number || '',
        team: data.team || '',
        payment_title: data.payment_title || data.title || '',
        amount: Number(data.amount) || 0,
        currency: data.currency || 'INR',
        status: (data.status as any) || 'Pending',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_order_id: data.razorpay_order_id || '',
        error_description: data.error_description || '',
        paid_at: data.paid_at || '',
        created_at: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.created_at || new Date().toISOString(),
      });
    });

    return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error('Failed to fetch payment attempt logs:', err);
    return [];
  }
}

/**
 * Fetch invoice / transaction logs from Firestore `invoices` collection.
 */
export async function fetchInvoicesFromFirestore(
  email: string,
  isAdmin: boolean = false
): Promise<TransactionLog[]> {
  try {
    const colRef = collection(db, PAYMENTS_COLLECTION);
    
    const q = isAdmin
      ? query(colRef, orderBy('created_at', 'desc'))
      : query(colRef, where('user_email', '==', email.toLowerCase()), orderBy('created_at', 'desc'));

    const snapshot = await getDocs(q);
    const logs: TransactionLog[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        id: docSnap.id,
        payment_id: docSnap.id,
        user_email: data.user_email || '',
        payment_title: data.title || '',
        amount: Number(data.amount) || 0,
        currency: data.currency || 'INR',
        status: (data.status as any) || 'Pending',
        razorpay_payment_id: data.razorpay_payment_id || '',
        razorpay_order_id: data.razorpay_order_id || '',
        error_description: data.error_description || '',
        created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at || new Date().toISOString(),
      });
    });

    return logs;
  } catch (err) {
    console.error('Failed to fetch transaction logs from Firestore:', err);
    return [];
  }
}

/**
 * Seed sample payment dues into Firestore `payments` & `invoices` collections.
 */
export async function seedDemoPayments(targetEmail: string): Promise<PaymentItem[]> {
  try {
    const createdItems: PaymentItem[] = [];
    const email = targetEmail ? targetEmail.toLowerCase() : 'user@vrgc.club';

    for (const sample of SAMPLE_PAYMENTS) {
      const created = await createPaymentInFirestore({
        ...sample,
        user_email: email,
      });
      if (created) {
        createdItems.push(created);
      }
    }

    return createdItems;
  } catch (err) {
    console.error('Error seeding demo payments in Firestore:', err);
    return [];
  }
}
