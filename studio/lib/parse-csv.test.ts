import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvToRecords } from "./parse-csv";

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('name,note\n"Somchai","Likes coffee, and tea"')).toEqual([
      ["name", "note"],
      ["Somchai", "Likes coffee, and tea"],
    ]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    expect(parseCsv('field\n"She said ""hi"""')).toEqual([["field"], ['She said "hi"']]);
  });

  it("handles CRLF and bare LF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("drops fully blank rows", () => {
    expect(parseCsv("a,b\n1,2\n,\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseCsvToRecords", () => {
  it("maps rows to objects keyed by lower-cased header", () => {
    expect(parseCsvToRecords("Name,Email\nSomchai,somchai@example.com")).toEqual([
      { name: "Somchai", email: "somchai@example.com" },
    ]);
  });

  it("returns an empty array when there is no data", () => {
    expect(parseCsvToRecords("")).toEqual([]);
  });

  it("fills missing trailing cells with an empty string", () => {
    expect(parseCsvToRecords("a,b,c\n1")).toEqual([{ a: "1", b: "", c: "" }]);
  });
});
