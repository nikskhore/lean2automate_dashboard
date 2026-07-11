import { api } from "./api";
import type { Attachment } from "@/types";

export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG, or PDF allowed`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: exceeds 10MB limit`;
  }
  return null;
}

export async function uploadAttachment(transactionId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ attachment: Attachment }>(
    `/transactions/${transactionId}/attachments`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.attachment;
}

/** Fetch an attachment (with auth) as a blob and open it in a new tab. */
export async function openAttachment(att: Attachment): Promise<void> {
  const { data } = await api.get<Blob>(`/attachments/${att.id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  window.open(url, "_blank", "noopener");
  // Revoke shortly after to let the new tab load it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
