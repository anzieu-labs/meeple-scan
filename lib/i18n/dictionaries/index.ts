import "server-only";

import type { Locale } from "../config";

import { de } from "./de";
import { en, type Dictionary } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { pl } from "./pl";
import { ptBR } from "./pt-BR";
import { zhHans } from "./zh-Hans";

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, fr, es, "pt-BR": ptBR, it, pl, ja, "zh-Hans": zhHans, ko };

/** Every word of the app in this language: server pages use it, and hand it to the client through I18nProvider. */
export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];
