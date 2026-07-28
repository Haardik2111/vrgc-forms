import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { CONFIG } from '@/lib/config';

function getEmailFromBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload.email ? String(payload.email).toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const titleFilter = searchParams.get('title');
    const adminKey = searchParams.get('key') || request.headers.get('x-admin-key');
    const authHeader = request.headers.get('authorization');

    // Strict admin authorization check - NO public key fallbacks
    const exportSecret = process.env.ADMIN_EXPORT_SECRET;
    const isAuthorizedSecret = Boolean(exportSecret && adminKey && adminKey === exportSecret);

    const tokenEmail = getEmailFromBearerToken(authHeader);
    const isAuthorizedAdminToken = Boolean(
      tokenEmail && CONFIG.ADMIN_EMAILS.includes(tokenEmail)
    );

    if (!isAuthorizedSecret && !isAuthorizedAdminToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Access to payment exports requires admin authorization.' },
        { status: 401 }
      );
    }

    const colRef = collection(db, 'payments');
    let q;

    if (titleFilter) {
      q = query(colRef, where('title', '==', titleFilter));
    } else {
      q = query(colRef);
    }

    const snapshot = await getDocs(q);
    const payments: any[] = [];

    snapshot.forEach((docSnap) => {
      payments.push({ id: docSnap.id, ...(docSnap.data() as object) });
    });

    // Sort by paid_at descending
    payments.sort((a, b) => {
      const dateA = a.paid_at ? new Date(a.paid_at).getTime() : 0;
      const dateB = b.paid_at ? new Date(b.paid_at).getTime() : 0;
      return dateB - dateA;
    });

    // Construct CSV Header
    const headers = [
      'Payer Email',
      'Payment Title',
      'Category',
      'Amount (INR)',
      'Status',
      'Paid At',
      'Razorpay Payment ID',
      'Razorpay Order ID',
      'Created At',
    ];

    // Format Rows
    const rows = payments.map((p) => [
      `"${p.user_email || ''}"`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${p.category || ''}"`,
      p.amount,
      p.status,
      `"${p.paid_at ? new Date(p.paid_at).toLocaleString('en-IN') : ''}"`,
      `"${p.razorpay_payment_id || ''}"`,
      `"${p.razorpay_order_id || ''}"`,
      `"${p.created_at?.toDate ? p.created_at.toDate().toLocaleString('en-IN') : (p.created_at ? new Date(p.created_at).toLocaleString('en-IN') : '')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const fileName = titleFilter
      ? `VRGC_Payments_${titleFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`
      : `VRGC_All_Payments_${Date.now()}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'CSV Export failed' }, { status: 500 });
  }
}

