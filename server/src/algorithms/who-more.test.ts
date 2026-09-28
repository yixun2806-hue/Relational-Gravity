import { describe, expect, it } from "vitest";
import { DIMENSION_KEYS, type DimensionScores } from "../domain/dimensions.js";
import { computeWhoMore, mapWhoMoreItem, type WhoMoreInput } from "./who-more.js";

function vector(value: number): DimensionScores {
  return Object.fromEntries(DIMENSION_KEYS.map((key) => [key, value])) as DimensionScores;
}

describe("whoMore perspective", () => {
  it("stores A/B facts and maps all nine rows for both viewers", () => {
    const items = computeWhoMore(vector(100), vector(0));
    expect(items).toHaveLength(9);
    for (const item of items) {
      expect(item.note).not.toMatch(/你|TA/);
      expect(item.aLabel).toBe("A");
      expect(item.bLabel).toBe("B");
      expect(item.reason.dimensions.length).toBeGreaterThan(0);
      expect(item.winner).not.toBe("tie");
      const aView = mapWhoMoreItem(item, true);
      const bView = mapWhoMoreItem(item, false);
      expect(aView.aPercent).toBe(item.aPercent);
      expect(aView.bPercent).toBe(item.bPercent);
      expect(bView.aPercent).toBe(item.bPercent);
      expect(bView.bPercent).toBe(item.aPercent);
      expect(aView.aLabel).toBe("你");
      expect(aView.bLabel).toBe("TA");
      expect(aView.reason?.youScore).toBe(item.reason.aScore);
      expect(bView.reason?.youScore).toBe(item.reason.bScore);
      expect(bView.reason?.dimensions).toEqual(item.reason.dimensions);
      if (item.winner === "a") {
        expect(aView.winner).toBe("you");
        expect(bView.winner).toBe("ta");
        expect(aView.note).not.toContain("TA");
        expect(bView.note).toContain("TA");
      } else {
        expect(aView.winner).toBe("ta");
        expect(bView.winner).toBe("you");
        expect(aView.note).toContain("TA");
        expect(bView.note).not.toContain("TA");
      }
    }
    expect(items.some((item) => item.winner === "a")).toBe(true);
    expect(items.some((item) => item.winner === "b")).toBe(true);
  });

  it("keeps a tie unchanged for both viewers", () => {
    const items = computeWhoMore(vector(50), vector(50));
    expect(items).toHaveLength(9);
    for (const item of items) {
      expect(item.winner).toBe("tie");
      const aView = mapWhoMoreItem(item, true);
      const bView = mapWhoMoreItem(item, false);
      expect(aView.winner).toBe("tie");
      expect(bView.winner).toBe("tie");
      expect(aView.note).toBe(bView.note);
      expect(aView.aPercent).toBe(bView.aPercent);
      expect(aView.note.length).toBeGreaterThan(0);
    }
  });

  it("flips a saved V1 note without rewriting the stored sentence for A", () => {
    const legacy: WhoMoreInput = {
      id: "cares",
      title: "谁更在乎这段关系",
      aPercent: 72,
      bPercent: 28,
      aLabel: "你",
      bLabel: "TA",
      tie: false,
      note: "投入更明显一点。",
    };
    expect(mapWhoMoreItem(legacy, true).note).toBe("投入更明显一点。");
    const bView = mapWhoMoreItem(legacy, false);
    expect(bView.aPercent).toBe(28);
    expect(bView.bPercent).toBe(72);
    expect(bView.winner).toBe("ta");
    expect(bView.note).toBe("TA 把这段关系放得更靠前。");
    expect(legacy.note).toBe("投入更明显一点。");
  });
});
