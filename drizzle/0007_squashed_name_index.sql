-- Game names without spaces, for OCR that runs words together ("forsale" -> For Sale).
CREATE INDEX "game_names_squashed_trgm" ON "game_names" USING gin (replace("normalized", ' ', '') gin_trgm_ops);