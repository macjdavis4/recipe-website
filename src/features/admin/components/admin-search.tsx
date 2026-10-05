import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A plain GET form, so search works without JavaScript and the URL can be shared. */
export function AdminSearch({
  name,
  label,
  value,
  keep,
}: {
  name: string;
  label: string;
  value: string;
  keep: Record<string, string>;
}) {
  return (
    <form method="get" className="flex flex-col gap-2" role="search">
      <Label htmlFor={`search-${name}`}>{label}</Label>
      <div className="flex gap-2">
        {Object.entries(keep).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <Input id={`search-${name}`} name={name} defaultValue={value} type="search" />
        <Button type="submit" variant="outline">
          <Search aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  );
}
