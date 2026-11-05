import { NextRequest, NextResponse } from 'next/server';
import { VaultFile } from '@/lib/models';
import { resolveEntitlements } from '@/lib/entitlements';
import { badRequest } from '@/lib/api-error';
import { fileRequestUser, validFileId, MAX_FILE_BYTES, FILE_OVERHEAD } from '@/lib/vault-files-server';

export const runtime = 'nodejs';

async function usedBytes(uid: string): Promise<number> {
  const [row] = await VaultFile.aggregate([{ $match: { userId: uid } }, { $group: { _id: null, total: { $sum: '$size' } } }]);
  return Number(row?.total ?? 0);
}

/** How much attachment space is used and allowed. */
export async function GET(request: NextRequest) {
  const who = await fileRequestUser(request);
  if ('error' in who) return who.error;
  const { limits } = await resolveEntitlements(who.uid);
  return NextResponse.json({
    success: true,
    usedBytes: await usedBytes(who.uid),
    limitBytes: limits.fileStorageMB < 0 ? -1 : limits.fileStorageMB * 1024 * 1024,
    maxFileBytes: MAX_FILE_BYTES,
  });
}

/** Stores one encrypted file. Body: the encrypted bytes. Header X-File-Id. */
export async function POST(request: NextRequest) {
  const who = await fileRequestUser(request);
  if ('error' in who) return who.error;
  const id = request.headers.get('x-file-id') ?? '';
  if (!validFileId(id)) return badRequest('Missing or invalid file id');

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_FILE_BYTES + FILE_OVERHEAD) return NextResponse.json({ error: true, code: 'file_too_large', message: 'Files can be up to 25 MB.' }, { status: 413 });
  const data = Buffer.from(await request.arrayBuffer());
  if (data.length < FILE_OVERHEAD) return badRequest('Empty file');
  if (data.length > MAX_FILE_BYTES + FILE_OVERHEAD) return NextResponse.json({ error: true, code: 'file_too_large', message: 'Files can be up to 25 MB.' }, { status: 413 });

  const { limits, effectivePlan } = await resolveEntitlements(who.uid);
  if (limits.fileStorageMB >= 0) {
    const allowed = limits.fileStorageMB * 1024 * 1024;
    if ((await usedBytes(who.uid)) + data.length > allowed) {
      return NextResponse.json({
        error: true, code: 'storage_full', currentPlan: effectivePlan,
        message: `Your ${effectivePlan} plan includes ${limits.fileStorageMB >= 1024 ? `${limits.fileStorageMB / 1024} GB` : `${limits.fileStorageMB} MB`} of file storage, and it's full.`,
      }, { status: 422 });
    }
  }

  await VaultFile.updateOne(
    { userId: who.uid, fileId: id },
    { $set: { size: data.length, data } },
    { upsert: true },
  );
  return NextResponse.json({ success: true, id, size: data.length });
}
