import type { ReactNode } from "react";

/** A tab's page: room for the status bar on top and the floating tab bar at the bottom. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(var(--tab-bar,6rem)+1rem)] text-foreground">
      {children}
    </main>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 px-4 pt-6 pb-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
