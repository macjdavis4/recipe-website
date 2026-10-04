import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

export async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Button asChild variant="outline">
        <Link href="/login">Log in</Link>
      </Button>
    );
  }

  const { id, name, email, image } = session.user;
  return (
    <UserMenuDropdown id={id} name={name ?? null} email={email ?? null} image={image ?? null} />
  );
}
