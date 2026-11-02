"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/**
 * A message, and an email if the sender wants an answer; kept in our database (`/api/feedback`). `wide` puts
 * the email and the button beside the message (the landing) instead of under it, with a hint under the email.
 */
export function FeedbackForm({ wide = false }: { wide?: boolean }) {
  const { locale, t } = useI18n();
  const words = t.settings.feedback;
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, locale }),
      });
      if (!res.ok) throw new Error(`feedback failed: ${res.status}`);
      setState("sent");
      setMessage("");
      setEmail("");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm" role="status" data-testid="feedback-sent">
        <Check className="size-4 shrink-0 text-score-excellent" aria-hidden /> {words.sent}
      </p>
    );
  }
  return (
    <form onSubmit={send} className={wide ? "grid grid-cols-[3fr_2fr] gap-3" : "flex flex-col gap-3"} data-testid="feedback-form">
      <label className="flex flex-col gap-1.5">
        <span className="sr-only">{words.message}</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={words.placeholder}
          aria-label={words.message}
          required
          minLength={2}
          maxLength={2000}
          rows={wide ? 3 : 4}
          className="h-full w-full resize-none rounded-xl border bg-muted/40 px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={words.email}
            aria-label={words.email}
            autoComplete="email"
            maxLength={200}
            className="h-11 w-full rounded-xl border bg-muted/40 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {wide && <span className="text-xs text-muted-foreground">{words.emailHint}</span>}
        </label>
        {state === "failed" && (
          <p className="text-sm text-destructive" role="alert">
            {words.failed}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 rounded-xl" disabled={state === "sending" || message.trim().length < 2}>
          {state === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {state === "sending" ? words.sending : words.send}
        </Button>
      </div>
    </form>
  );
}
