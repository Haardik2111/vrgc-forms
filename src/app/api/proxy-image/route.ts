import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    let targetUrl = url;

    // Handle common GIF sharing page links (e.g., Tenor / Giphy view pages) if pasted by user
    if (targetUrl.includes('tenor.com/view/') || targetUrl.includes('giphy.com/gifs/')) {
      try {
        const pageRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            targetUrl = ogImageMatch[1];
          }
        }
      } catch {
        // Fallback to targetUrl as is
      }
    }

    const imageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/gif,image/webp,image/png,image/jpeg,image/*,*/*',
      },
    });

    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch target image (${imageRes.status})` },
        { status: imageRes.status }
      );
    }

    const contentType = imageRes.headers.get('content-type') || 'image/gif';
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error in proxy-image route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
