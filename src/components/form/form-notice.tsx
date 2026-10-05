import { CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** A success message. role="status" so screen readers announce it politely. */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert role="status">
      <CircleCheck aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
