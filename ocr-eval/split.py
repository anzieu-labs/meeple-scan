"""Which half of the evaluation a game belongs to: "tune" (settings are chosen on it) or "holdout" (only
used to confirm them). By BGG id, so every photo of a game lands in the same half. Mirrored in
evaluate.test.ts (halfOf)."""


def half_of(bgg_id: int) -> str:
    return "tune" if bgg_id % 2 == 0 else "holdout"
