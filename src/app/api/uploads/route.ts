import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectImageType, getStorage, imageKey, MAX_UPLOAD_BYTES } from "@/lib/storage";

// Multipart overhead allowance on top of the file itself.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return error(401, "Log in to upload photos.");

  // Reject obviously oversized bodies before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) return error(413, "Photos must be 5 MB or smaller.");

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return error(400, "Send the photo as form data in a field named file.");
  }
  if (!(file instanceof File) || file.size === 0) return error(400, "Choose a photo to upload.");
  if (file.size > MAX_UPLOAD_BYTES) return error(413, "Photos must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType) return error(415, "Use a JPEG, PNG, or WebP photo.");

  const url = await getStorage().save(imageKey(session.user.id, contentType), bytes, contentType);
  return NextResponse.json({ url }, { status: 201 });
}
