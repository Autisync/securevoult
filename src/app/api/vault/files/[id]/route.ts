import { NextRequest, NextResponse } from 'next/server';
import { VaultFile } from '@/lib/models';
import { badRequest, apiError } from '@/lib/api-error';
import { fileRequestUser, validFileId } from '@/lib/vault-files-server';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** The encrypted bytes; decrypted in the browser. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const who = await fileRequestUser(request);
  if ('error' in who) return who.error;
  const { id } = await params;
  if (!validFileId(id)) return badRequest('Invalid file id');
  const doc = await VaultFile.findOne({ userId: who.uid, fileId: id }).select('data').lean() as { data?: { buffer: ArrayBuffer } | Buffer } | null;
  if (!doc?.data) return apiError(404, 'not_found', 'File not found');
  const raw = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from((doc.data as { buffer: ArrayBuffer }).buffer);
  return new NextResponse(new Uint8Array(raw), {
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const who = await fileRequestUser(request);
  if ('error' in who) return who.error;
  const { id } = await params;
  if (!validFileId(id)) return badRequest('Invalid file id');
  await VaultFile.deleteOne({ userId: who.uid, fileId: id });
  return NextResponse.json({ success: true });
}
