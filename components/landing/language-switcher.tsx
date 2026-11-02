"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Globe2 } from "lucide-react";

import { switchLocale, useI18n } from "@/lib/i18n/client";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/i18n/config";

/** The desktop pages' language picker: reopens `path` in the language picked, and remembers the choice. */
export function LanguageSwitcher({ path }: { path: string }) {
  const { locale, t } = useI18n();
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${t.settings.language}: ${LOCALE_NAMES[locale]}`}
        className="flex h-11 items-center gap-2 rounded-full border-2 border-[#103b2c] bg-white px-4 text-sm font-bold shadow-[3px_3px_0_#103b2c] transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#00875a] focus-visible:outline-none data-[popup-open]:translate-y-0"
      >
        <Globe2 className="size-4" aria-hidden />
        {LOCALE_NAMES[locale]}
        <ChevronDown className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={10} className="z-50">
          <Menu.Popup className="min-w-52 rounded-2xl border-2 border-[#103b2c] bg-white p-1.5 text-[#103b2c] shadow-[5px_5px_0_#103b2c] outline-none">
            <Menu.RadioGroup value={locale} onValueChange={(value: Locale) => value !== locale && switchLocale(value, path)}>
              {LOCALES.map((option) => (
                <Menu.RadioItem
                  key={option}
                  value={option}
                  lang={option}
                  closeOnClick
                  className="flex h-10 cursor-pointer items-center justify-between gap-6 rounded-xl px-3 text-sm font-semibold outline-none data-[highlighted]:bg-[#ffc533]"
                >
                  {LOCALE_NAMES[option]}
                  <Menu.RadioItemIndicator>
                    <Check className="size-4 text-[#00875a]" aria-hidden />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
