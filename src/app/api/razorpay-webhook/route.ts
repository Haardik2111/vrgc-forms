import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    // Optional Webhook Signature Verification
    if (signature && webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.warn('Razorpay Webhook signature mismatch.');
        return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity || {};
      const orderEntity = payload.payload?.order?.entity || {};

      const razorpayPaymentId = paymentEntity.id || '';
      const razorpayOrderId = paymentEntity.order_id || orderEntity.id || '';
      const email = (paymentEntity.email || paymentEntity.notes?.userEmail || '').toLowerCase().trim();
      const amountPaise = Number(paymentEntity.amount) || Number(orderEntity.amount) || 0;
      const targetPaymentId = paymentEntity.notes?.paymentId || '';

      const paymentsCol = collection(db, 'payments');
      const allDocsSnap = await getDocs(paymentsCol);

      for (const pDoc of allDocsSnap.docs) {
        const pData = pDoc.data();
        if (pData.status === 'Paid') continue;

        const docId = pDoc.id;
        const docEmail = (pData.user_email || '').toLowerCase().trim();
        const docAmountPaise = Math.round((Number(pData.amount) || 0) * 100);
        const docOrderId = (pData.razorpay_order_id || '').trim();

        let isMatch = false;
        if (targetPaymentId && targetPaymentId === docId) isMatch = true;
        if (docOrderId && docOrderId === razorpayOrderId) isMatch = true;
        if (docEmail && email && docEmail === email && docAmountPaise === amountPaise) isMatch = true;

        if (isMatch) {
          const paidAtTime = paymentEntity.created_at
            ? new Date(paymentEntity.created_at * 1000).toISOString()
            : new Date().toISOString();

          await updateDoc(pDoc.ref, {
            status: 'Paid',
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            payment_method: paymentEntity.method ? `Razorpay (${String(paymentEntity.method).toUpperCase()})` : 'Razorpay Online',
            paid_at: paidAtTime,
            updated_at: serverTimestamp(),
            error_description: '',
          });

          // Log transaction attempt subdocument
          try {
            const attemptsCol = collection(db, 'payments', docId, 'attempts');
            await addDoc(attemptsCol, {
              payment_id: docId,
              user_email: docEmail,
              candidate_name: pData.candidate_name || '',
              registration_number: pData.registration_number || '',
              team: pData.team || '',
              payment_title: pData.title || '',
              amount: Number(pData.amount) || 0,
              currency: pData.currency || 'INR',
              status: 'Paid',
              razorpay_order_id: razorpayOrderId,
              razorpay_payment_id: razorpayPaymentId,
              paid_at: paidAtTime,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              source: 'razorpay-webhook',
            });
          } catch (e) {
            console.warn('Webhook attempt log warning:', e);
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Webhook handler error' }, { status: 500 });
  }
}
