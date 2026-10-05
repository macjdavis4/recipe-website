"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminDeleteRecipe, adminDeleteUser } from "../actions";

const COPY = {
  recipe: {
    button: "Delete recipe",
    title: "Delete this recipe?",
    body: (name: string) => `"${name}" and its photo will be removed for everyone.`,
    done: "Recipe deleted.",
  },
  user: {
    button: "Delete account",
    title: "Delete this account?",
    body: (name: string) =>
      `${name}'s account, all of their recipes, and their photos will be removed.`,
    done: "Account deleted.",
  },
};

/** Confirms, then calls the admin action. The server checks admin access again. */
export function DeleteButton({
  kind,
  id,
  name,
}: {
  kind: "recipe" | "user";
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = COPY[kind];

  const onConfirm = () =>
    startTransition(async () => {
      const result = kind === "recipe" ? await adminDeleteRecipe(id) : await adminDeleteUser(id);
      if (result.ok) {
        toast.success(copy.done);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={pending} aria-label={`${copy.button}: ${name}`}>
          <Trash2 aria-hidden="true" />
          {pending ? "Deleting..." : copy.button}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body(name)} This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {copy.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
