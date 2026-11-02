import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses BGG's ranks dump format", () => {
    const csv = [
      "id,name,yearpublished,rank,is_expansion",
      '224517,"Brass: Birmingham",2018,1,0',
      '1,"Die Macher",1986,382,0',
      '2,"Say ""Cheese"", Please",2001,,1',
      "3,Plain name,1999,0,0",
      "",
    ].join("\r\n");
    expect(parseCsv(csv)).toEqual([
      { id: "224517", name: "Brass: Birmingham", yearpublished: "2018", rank: "1", is_expansion: "0" },
      { id: "1", name: "Die Macher", yearpublished: "1986", rank: "382", is_expansion: "0" },
      { id: "2", name: 'Say "Cheese", Please', yearpublished: "2001", rank: "", is_expansion: "1" },
      { id: "3", name: "Plain name", yearpublished: "1999", rank: "0", is_expansion: "0" },
    ]);
  });

  it("keeps newlines inside quotes and handles a missing final newline", () => {
    expect(parseCsv('a,b\n"x\ny",z')).toEqual([{ a: "x\ny", b: "z" }]);
  });
});
