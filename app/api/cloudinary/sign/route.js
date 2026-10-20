import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const folder = body.folder || 'sur_mithila_covers';
    const timestamp = Math.round(new Date().getTime() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
      return NextResponse.json({ error: 'Cloudinary credentials missing on server' }, { status: 500 });
    }

    // Sort params alphabetically (as required by Cloudinary signature generation)
    // Here we only use folder and timestamp.
    const signatureString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

    return NextResponse.json({
      timestamp,
      signature,
      folder
    });
  } catch (error) {
    console.error('Error generating signature:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
