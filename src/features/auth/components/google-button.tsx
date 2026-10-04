import { Button } from "@/components/ui/button";
import { googleSignInAction } from "../actions";

export function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <>
      <form action={googleSignInAction.bind(null, callbackUrl)}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Continue with Google
        </Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
