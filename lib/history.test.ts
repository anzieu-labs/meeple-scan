import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameCard } from "@/lib/game/types";

const game = (bggId: number, name: string) =>
  ({ bggId, name, thumbnail: null, yearPublished: 2000, type: "boardgame", ratingAverage: 7, usersRated: 100 }) as GameCard;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

// The module keeps an in-memory copy, so each test gets a fresh one.
async function load(storage: unknown = memoryStorage()) {
  vi.stubGlobal("localStorage", storage);
  vi.resetModules();
  return import("./history");
}

describe("history", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("keeps the newest first and one row per game", async () => {
    const h = await load();
    h.addToHistory(game(13, "Catan"), 1);
    h.addToHistory(game(230802, "Azul"), 2);
    h.addToHistory(game(13, "Catan"), 3);
    expect(h.historyStore.getSnapshot().map((e) => [e.bggId, e.scannedAt])).toEqual([
      [13, 3],
      [230802, 2],
    ]);
  });

  it("caps the list at 50", async () => {
    const h = await load();
    for (let i = 1; i <= 60; i++) h.addToHistory(game(i, `Game ${i}`), i);
    const entries = h.historyStore.getSnapshot();
    expect(entries).toHaveLength(h.HISTORY_LIMIT);
    expect(entries[0].bggId).toBe(60);
  });

  it("removes and clears, notifying subscribers", async () => {
    const h = await load();
    const listener = vi.fn();
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    h.historyStore.subscribe(listener);
    h.addToHistory(game(13, "Catan"));
    h.addToHistory(game(230802, "Azul"));
    h.removeFromHistory(13);
    expect(h.historyStore.getSnapshot().map((e) => e.bggId)).toEqual([230802]);
    h.clearHistory();
    expect(h.historyStore.getSnapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("keeps every stat Settings can show, and reads older entries without them", async () => {
    const storage = memoryStorage();
    storage.data.set("meeple-scan:history", JSON.stringify([{ bggId: 13, name: "Catan", ratingAverage: 7, usersRated: 100, scannedAt: 1 }]));
    const h = await load(storage);
    expect(h.historyStore.getSnapshot()[0]).toMatchObject({ weight: null, bestPlayers: [], minPlayTime: null });
    h.addToHistory({ ...game(230802, "Azul"), weight: 1.8, minPlayTime: 30, maxPlayTime: 45, bestPlayers: [2], minPlayers: 2, maxPlayers: 4 });
    expect(h.historyStore.getSnapshot()[0]).toMatchObject({ weight: 1.8, minPlayTime: 30, maxPlayTime: 45, bestPlayers: [2], maxPlayers: 4 });
  });

  it("keeps the history saved under the app's old name, and moves it to the new one", async () => {
    const storage = memoryStorage();
    storage.data.set("bgg-scan:history", JSON.stringify([{ bggId: 13, name: "Catan", scannedAt: 1 }]));
    const h = await load(storage);
    expect(h.historyStore.getSnapshot().map((e) => e.name)).toEqual(["Catan"]);
    h.addToHistory(game(230802, "Azul"));
    expect(JSON.parse(storage.data.get("meeple-scan:history")!).map((e: { name: string }) => e.name)).toEqual(["Azul", "Catan"]);
    expect(storage.data.has("bgg-scan:history")).toBe(false);
  });

  it("reads entries saved by the barcode version: one row per game, newest kept", async () => {
    const storage = memoryStorage();
    storage.data.set(
      "bgg-scan:history",
      JSON.stringify([
        { gtin: "0029877030712", bggId: 13, name: "Catan", scannedAt: 3 },
        { gtin: "bgg-13", bggId: 13, name: "Catan", scannedAt: 2 },
        { gtin: "0826956600107", bggId: 230802, name: "Azul", scannedAt: 1 },
        { gtin: "broken" },
      ]),
    );
    const entries = (await load(storage)).historyStore.getSnapshot();
    expect(entries.map((e) => [e.bggId, e.scannedAt])).toEqual([
      [13, 3],
      [230802, 1],
    ]);
  });

  it("survives a reload and broken or blocked storage", async () => {
    const storage = memoryStorage();
    (await load(storage)).addToHistory(game(13, "Catan"));
    expect((await load(storage)).historyStore.getSnapshot().map((e) => e.name)).toEqual(["Catan"]);

    storage.data.set("meeple-scan:history", "{not json");
    expect((await load(storage)).historyStore.getSnapshot()).toEqual([]);

    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    const h = await load(blocked);
    h.addToHistory(game(13, "Catan"));
    expect(h.historyStore.getSnapshot()).toHaveLength(1);
  });
});
