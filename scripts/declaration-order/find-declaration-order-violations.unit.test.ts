import { describe, expect, it } from "vitest";
import { findDeclarationOrderViolations } from "./find-declaration-order-violations";

function violationsIn(text: string, fileName = "module.ts"): string[] {
  return findDeclarationOrderViolations(text, fileName).map(
    ({ line, name }) => `${line}:${name}`,
  );
}

describe("findDeclarationOrderViolations", () => {
  it("reports a call above the function declaration", () => {
    expect(
      violationsIn(`export const total = add(1, 2);
function add(a: number, b: number) {
  return a + b;
}
`),
    ).toEqual(["1:add"]);
  });

  it("reports JSX, values passed along and typeof, at any depth", () => {
    expect(
      violationsIn(
        `export function Page() {
  return <Row />;
}
export const routes = [Page, Row].map(render);
export type RowType = typeof Row;
function Row() {
  return null;
}
function render(value: unknown) {
  return value;
}
`,
        "page.tsx",
      ),
    ).toEqual(["2:Row", "4:Row", "4:render", "5:Row"]);
  });

  it("allows uses below the declaration and self-recursion", () => {
    expect(
      violationsIn(`function count(n: number): number {
  return n === 0 ? 0 : count(n - 1);
}
export const three = count(3);
`),
    ).toEqual([]);
  });

  it("ignores shadowing bindings, property names and imports", () => {
    expect(
      violationsIn(`import { parse as format } from "./parse";
export function first(add: () => void, record: { add: number }) {
  add();
  return { add: record.add, format };
}
function add() {}
function parse() {}
`),
    ).toEqual([]);
  });

  it("reports a shorthand property naming a later function", () => {
    expect(
      violationsIn(`export const handlers = { add };
function add() {}
`),
    ).toEqual(["1:add"]);
  });

  it("measures overloads from the first signature", () => {
    expect(
      violationsIn(`function pick(value: string): string;
function pick(value: number): number;
function pick(value: unknown) {
  return value;
}
export const picked = pick("a");
`),
    ).toEqual([]);
  });

  it("exempts a reference only with a reasoned ignore comment", () => {
    expect(
      violationsIn(`// declaration-order-ignore: mutual recursion with isOdd
export const even = isEven(2);
export const odd = isEven(3); // declaration-order-ignore: same as above
// declaration-order-ignore:
export const bare = isEven(4);
export const far = isEven(5);
function isEven(n: number): boolean {
  return n === 0;
}
`),
    ).toEqual(["5:isEven", "6:isEven"]);
  });

  it("ignores type-only uses of a symbol merged with a function", () => {
    expect(
      violationsIn(`export type Shape = Point;
export type Inner = point.Inner;
export interface Point {
  x: number;
}
export function Point() {}
export function point() {}
export namespace point {
  export type Inner = string;
}
`),
    ).toEqual([]);
  });

  it("accepts a reasoned block comment, as JSX needs", () => {
    expect(
      violationsIn(
        `export function Page() {
  return (
    <>
      {/* declaration-order-ignore: rendered by a later layout */}
      <Row />
      {/* declaration-order-ignore: */}
      <Row />
    </>
  );
}
function Row() {
  return null;
}
`,
        "page.tsx",
      ),
    ).toEqual(["7:Row"]);
  });
});
