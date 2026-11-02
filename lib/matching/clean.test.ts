import { describe, expect, it } from "vitest";

import { cleanTitle } from "./clean";
import { nameSimilarity, normalizeName } from "./rank";

describe("cleanTitle", () => {
  it.each([
    ["Catan Family Strategy Board Game: 5th Edition for Ages 10 and up  from Asmodee", "Asmodee", "catan"],
    ["Settlers of Catan 5th Edition (2015) - Board Game by Mayfair Games (3071)", "Asmodee", "settlers of catan"],
    [
      "Buy Ticket to Ride and Get Ticket to Ride London for FREE Board Games",
      "Days of Wonder",
      "ticket to ride london",
    ],
    ["CGE00026 Tzolkin Tribes & Prophecies Board Game", "Rio Grande Games", "tzolkin tribes prophecies"],
    ["Tzolk’in: Tribes and Prophecies", "Rio Grande Games", "tzolk'in"],
    ["Pandemic Board Game by Z-Man Games, Multicolor", null, "pandemic"],
    ["Azul Family Tile Strategy Game for Ages 8+  from Asmodee", "Asmodee", "azul"],
    ["7 Wonders Board Game 3-7 Players English", null, "7 wonders"],
    ["Dixit 5 Daydream Expansion Libellud Origins", "Libellud", "dixit 5 daydream origins"],
    ["Téléstration Édition Québécoise (In French)", "Randolph", "telestration"],
    ["Decrypto Jeu En Francais", "Scorpion Masque", "decrypto"],
    ["Welcome To Your Perfect Home", "Deep Water Games", "welcome to your perfect home"],
  ])("%s -> %s", (title, brand, head) => {
    expect(cleanTitle(title, brand).head).toBe(head);
  });
});

describe("nameSimilarity", () => {
  it("prefers the exact game over spin-offs and expansions", () => {
    expect(nameSimilarity("catan", "Catan")).toBe(1);
    expect(nameSimilarity("catan", "Catan Junior")).toBeLessThan(0.8);
    expect(nameSimilarity("catan", "Catan: Seafarers")).toBeLessThan(0.8);
  });

  it("ignores linking words the box prints small, but not missing words", () => {
    expect(nameSimilarity("king tokyo", "King of Tokyo")).toBe(1);
    expect(nameSimilarity("king tokyo", "King")).toBeLessThan(0.8);
    expect(nameSimilarity("grande", "El Grande")).toBeLessThan(0.8);
  });

  it("matches one part of a long name, for less than the whole name", () => {
    const fellowship = "Le Seigneur des Anneaux: La Communauté de l'Anneau, Le jeu de plis coopératif";
    expect(nameSimilarity("communaute de l'anneau", fellowship)).toBeGreaterThan(0.6);
    expect(nameSimilarity("catan", "Catan: Seafarers")).toBeLessThan(nameSimilarity("catan", "Catan"));
  });

  it("reads big letters run together as the spaced name", () => {
    expect(nameSimilarity("forsale", "For Sale")).toBe(0.97);
    expect(nameSimilarity("endeavor deepsea", "Endeavor: Deep Sea")).toBe(0.97);
    expect(nameSimilarity("forsale", "Forsaken")).toBeLessThan(0.8);
    expect(nameSimilarity("city line", "Cityline")).toBeLessThan(nameSimilarity("city line", "City Line"));
  });

  it("ignores apostrophes, accents and ampersands", () => {
    expect(normalizeName("Tzolk'in: Tribes & Prophecies")).toBe("tzolkin tribes prophecies");
    expect(normalizeName("Les Colons de Catane – Édition")).toBe("les colons de catane edition");
  });
});
