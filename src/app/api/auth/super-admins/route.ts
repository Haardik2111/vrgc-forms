import { NextResponse } from 'next/server';

export async function GET() {
  const superAdminEnv = process.env.SUPER_ADMIN_EMAILS || '';
  const superAdmins = superAdminEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return NextResponse.json(
    { superAdmins },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}