"use client";

import { Camera } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <Camera className="size-12 text-white/70" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">{t.error.title}</h1>
      <p className="max-w-xs text-sm text-white/70">{t.error.text}</p>
      <Button size="lg" className="h-11 px-6" onClick={retry}>
        {t.error.retry}
      </Button>
    </main>
  );
}
