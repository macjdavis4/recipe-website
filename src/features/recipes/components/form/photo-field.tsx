"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { get, useFormContext, useFormState, useWatch } from "react-hook-form";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeInput } from "../../schemas";
import { FormSection } from "./section";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

async function upload(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
  return json.url;
}

export function PhotoField() {
  const id = useId();
  const { setValue, clearErrors } = useFormContext<RecipeInput>();
  const imageUrl = useWatch<RecipeInput, "imageUrl">({ name: "imageUrl" });
  const { errors } = useFormState({ name: "imageUrl" });
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const shownError = error ?? (get(errors, "imageUrl")?.message as string | undefined);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(undefined);
    if (file.size > MAX_BYTES) return setError("Photos must be 5 MB or smaller.");
    setBusy(true);
    setStatus("Uploading photo...");
    try {
      const url = await upload(file);
      setValue("imageUrl", url, { shouldDirty: true });
      clearErrors("imageUrl");
      setStatus("Photo uploaded.");
    } catch (e) {
      setStatus(undefined);
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSection title="Photo" description="Optional. JPEG, PNG, or WebP up to 5 MB.">
      {imageUrl && (
        <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg bg-muted">
          <Image
            src={imageUrl}
            alt="Recipe photo preview"
            fill
            sizes="384px"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          type="file"
          accept={ACCEPT}
          onChange={onChange}
          disabled={busy}
          className="peer sr-only"
          aria-describedby={shownError ? `${id}-error` : undefined}
        />
        <Button
          asChild
          variant="outline"
          className="peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
        >
          <label htmlFor={id} className="cursor-pointer">
            <ImagePlus aria-hidden="true" />
            {busy ? "Uploading..." : imageUrl ? "Replace photo" : "Add a photo"}
          </label>
        </Button>
        {imageUrl && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setValue("imageUrl", null, { shouldDirty: true })}
          >
            <Trash2 aria-hidden="true" />
            Remove photo
          </Button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
      {shownError && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {shownError}
        </p>
      )}
    </FormSection>
  );
}
