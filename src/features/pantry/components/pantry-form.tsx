import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** GET form so results are shareable and work without JavaScript. */
export function PantryForm({ have, staples }: { have: string; staples: boolean }) {
  return (
    <form
      action="/pantry"
      method="get"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="have">What do you have?</Label>
        <Textarea
          id="have"
          name="have"
          defaultValue={have}
          rows={3}
          placeholder="e.g. eggs, rice, spinach, garlic"
          aria-describedby="have-hint"
        />
        <p id="have-hint" className="text-sm text-muted-foreground">
          Separate items with commas or new lines. Up to 30 items.
        </p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="staples"
          value="1"
          defaultChecked={staples}
          className="size-5 shrink-0 accent-primary"
        />
        I have salt, pepper, oil, and water
      </label>
      <Button type="submit" className="self-start">
        Find recipes
      </Button>
    </form>
  );
}
