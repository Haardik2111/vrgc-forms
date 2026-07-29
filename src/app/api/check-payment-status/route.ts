import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

async function logTransactionToFirestore(tx: {
  payment_id?: string;
  user_email?: string;
  candidate_name?: string;
  registration_number?: string;
  team?: string;
  payment_title?: string;
  amount?: number;
  currency?: string;
  status: 'Paid' | 'Failed' | 'Pending' | 'Processing';
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  payment_method?: string;
  error_description?: string;
  paid_at?: string;
}) {
  try {
    if (tx.payment_id) {
      const attemptsCol = collection(db, 'payments', tx.payment_id, 'attempts');
      const existingSnap = await getDocs(attemptsCol);
      let duplicateDocRef = null;

      existingSnap.forEach((dSnap) => {
        const dData = dSnap.data();
        if (
          dData.status === tx.status &&
          ((tx.razorpay_payment_id && dData.razorpay_payment_id === tx.razorpay_payment_id) ||
            (tx.razorpay_order_id && dData.razorpay_order_id === tx.razorpay_order_id) ||
            (dData.error_description === tx.error_description))
        ) {
          duplicateDocRef = dSnap.ref;
        }
      });

      if (duplicateDocRef) {
        await updateDoc(duplicateDocRef, {
          ...tx,
          updated_at: serverTimestamp(),
        });
      } else {
        await addDoc(attemptsCol, {
          ...tx,
          user_email: (tx.user_email || 'unknown').toLowerCase(),
          payment_title: tx.payment_title || 'Unknown Payment',
          amount: tx.amount || 0,
          currency: tx.currency || 'INR',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          source: 'vrgc-forms',
        });
      }
    }
  } catch (err) {
    console.warn('Transaction log attempt to Firestore failed:', err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentId, razorpay_order_id: providedOrderId, syncAll = false } = body;

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, error: 'Razorpay credentials not configured on server.' },
        { status: 500 }
      );
    }

    let RazorpayConstructor: any;
    try {
      // @ts-ignore
      const mod = await import('razorpay').catch(() => null);
      RazorpayConstructor = mod?.default || mod;
    } catch {
      RazorpayConstructor = null;
    }

    if (!RazorpayConstructor) {
      return NextResponse.json(
        { success: false, error: 'Razorpay SDK unavailable.' },
        { status: 500 }
      );
    }

    const instance = new RazorpayConstructor({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Helper function to check & sync a single payment document with Razorpay
    const syncSingleDoc = async (pDocRef: any, pDocData: any) => {
      const pId = pDocRef.id;

      // If already Paid, no need to touch
      if (pDocData.status === 'Paid') {
        return { paymentId: pId, status: 'Paid', updated: false };
      }

      const orderId = providedOrderId || pDocData.razorpay_order_id;
      if (!orderId) {
        return { paymentId: pId, status: pDocData.status, updated: false, reason: 'No order_id' };
      }

      try {
        // Fetch order and payments list directly from Razorpay API
        const order = await instance.orders.fetch(orderId);
        const paymentsRes = await instance.orders.fetchPayments(orderId);
        const paymentsList = paymentsRes?.items || [];

        // Check if any payment attempt was successful (captured or authorized)
        const successfulPayment = paymentsList.find(
          (p: any) => p.status === 'captured' || p.status === 'authorized'
        );

        if (order.status === 'paid' || successfulPayment) {
          const paidTx = successfulPayment || paymentsList[0] || {};
          const paidPaymentId = paidTx.id || pDocData.razorpay_payment_id || `pay_${orderId}`;
          const paidMethod = paidTx.method ? `Razorpay (${paidTx.method})` : 'Razorpay Online';
          const paidAtTime = paidTx.created_at
            ? new Date(paidTx.created_at * 1000).toISOString()
            : new Date().toISOString();

          // UPDATE FIRESTORE TO PAID
          await updateDoc(pDocRef, {
            status: 'Paid',
            razorpay_order_id: orderId,
            razorpay_payment_id: paidPaymentId,
            payment_method: paidMethod,
            paid_at: paidAtTime,
            updated_at: serverTimestamp(),
            error_description: '',
          });

          await logTransactionToFirestore({
            payment_id: pId,
            user_email: pDocData.user_email,
            candidate_name: pDocData.candidate_name,
            registration_number: pDocData.registration_number,
            team: pDocData.team,
            payment_title: pDocData.title,
            amount: Number(pDocData.amount) || 0,
            currency: pDocData.currency || 'INR',
            status: 'Paid',
            razorpay_order_id: orderId,
            razorpay_payment_id: paidPaymentId,
            payment_method: paidMethod,
            paid_at: paidAtTime,
          });

          return { paymentId: pId, status: 'Paid', updated: true, razorpay_payment_id: paidPaymentId };
        } else {
          // Razorpay confirms payment was NOT captured
          const lastUpdated = pDocData.updated_at?.toDate
            ? pDocData.updated_at.toDate().getTime()
            : pDocData.created_at?.toDate
            ? pDocData.created_at.toDate().getTime()
            : new Date(pDocData.updated_at || pDocData.created_at || Date.now()).getTime();

          const elapsedMs = Date.now() - lastUpdated;
          const TWELVE_MINUTES_MS = 12 * 60 * 1000;

          if (pDocData.status === 'Processing' && elapsedMs >= TWELVE_MINUTES_MS) {
            const failReason = 'Payment session timed out (12 minute limit exceeded and no captured payment found on Razorpay).';
            await updateDoc(pDocRef, {
              status: 'Failed',
              updated_at: serverTimestamp(),
              error_description: failReason,
            });

            await logTransactionToFirestore({
              payment_id: pId,
              user_email: pDocData.user_email,
              candidate_name: pDocData.candidate_name,
              registration_number: pDocData.registration_number,
              team: pDocData.team,
              payment_title: pDocData.title,
              amount: Number(pDocData.amount) || 0,
              currency: pDocData.currency || 'INR',
              status: 'Failed',
              razorpay_order_id: orderId,
              error_description: failReason,
            });

            return { paymentId: pId, status: 'Failed', updated: true };
          }

          return { paymentId: pId, status: pDocData.status, updated: false };
        }
      } catch (rzpErr: any) {
        console.warn(`Razorpay order fetch failed for ${orderId}:`, rzpErr);
        return { paymentId: pId, status: pDocData.status, updated: false, error: rzpErr.message };
      }
    };

    // Case 1: Batch Sync all non-Paid payments with razorpay_order_id
    if (syncAll) {
      const colRef = collection(db, 'payments');
      const q = query(colRef, where('status', 'in', ['Processing', 'Failed', 'Pending']));
      const snapshot = await getDocs(q);

      const results: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.razorpay_order_id) {
          const res = await syncSingleDoc(docSnap.ref, data);
          results.push(res);
        }
      }

      return NextResponse.json({
        success: true,
        syncedCount: results.filter((r) => r.updated).length,
        results,
      });
    }

    // Case 2: Sync single payment doc by paymentId
    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'paymentId or syncAll is required.' },
        { status: 400 }
      );
    }

    const pDocRef = doc(db, 'payments', String(paymentId));
    const pDocSnap = await getDoc(pDocRef);

    if (!pDocSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Payment record not found.' },
        { status: 404 }
      );
    }

    const result = await syncSingleDoc(pDocRef, pDocSnap.data());

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error checking Razorpay payment status:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to check Razorpay payment status' },
      { status: 500 }
    );
  }
}
