import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One Yuka-style line: icon, what it is, the detail under it, and a value (or gauge) on the right. */
export function DetailRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing}
    </li>
  );
}
