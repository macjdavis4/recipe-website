import { BookOpen, ChefHat, Home, Sparkles, type LucideIcon } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon };

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/pantry", label: "Pantry", icon: ChefHat },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
