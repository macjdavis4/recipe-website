"use client";

import Link from "next/link";
import { useTransition } from "react";
import { BookOpen, LogOut, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/features/auth/actions";

type Props = { id: string; name: string | null; email: string | null; image: string | null };

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  ).toUpperCase();
}

export function UserMenuDropdown({ id, name, email, image }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-9">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="bg-primary text-sm text-primary-foreground">
              {initials(name, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium text-foreground">{name ?? "Your account"}</span>
          {email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/recipes/new">
            <Plus aria-hidden="true" />
            Share a recipe
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-11">
          <Link href={`/u/${id}`}>
            <BookOpen aria-hidden="true" />
            My recipes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11"
          disabled={pending}
          onSelect={() => startTransition(() => logoutAction())}
        >
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
