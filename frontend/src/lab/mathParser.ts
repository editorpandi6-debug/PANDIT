// Safe-ish math expression compiler: "3*x^2 - 12" -> (x, y) => number. Whitelisted identifiers only.
const FUNCS: Record<string, string> = {
  sin: "Math.sin",
  cos: "Math.cos",
  tan: "Math.tan",
  asin: "Math.asin",
  acos: "Math.acos",
  atan: "Math.atan",
  sinh: "Math.sinh",
  cosh: "Math.cosh",
  tanh: "Math.tanh",
  sqrt: "Math.sqrt",
  cbrt: "Math.cbrt",
  abs: "Math.abs",
  exp: "Math.exp",
  log: "Math.log10",
  ln: "Math.log",
  log10: "Math.log10",
  log2: "Math.log2",
  floor: "Math.floor",
  ceil: "Math.ceil",
  round: "Math.round",
  min: "Math.min",
  max: "Math.max",
  pow: "Math.pow",
  sign: "Math.sign",
  pi: "Math.PI",
  e: "Math.E",
};

export type MathFn = (x: number, y: number) => number;

export function normalizeExpression(raw: string): string {
  let s = raw.trim();
  // Accept "y = ..." / "f(x) = ..." / "z = ..." prefixes.
  s = s.replace(/^\s*(y|z|f\s*\(\s*x\s*(,\s*y\s*)?\))\s*=\s*/i, "");
  s = s.replace(/\\cdot|·|×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**").replace(/π/g, "pi");
  s = s.replace(/\s+/g, "");
  // Implicit multiplication: 2x, 3(x+1), x(x-1)->leave functions, )x, )(
  s = s.replace(/(\d)([a-zA-Z(])/g, "$1*$2").replace(/\)([a-zA-Z0-9(])/g, ")*$1");
  s = s.replace(/([xy])(\()/g, "$1*$2").replace(/([xy])([xy])/g, "$1*$2");
  return s;
}

export function compileExpression(raw: string): MathFn | null {
  const expr = normalizeExpression(raw);
  if (!expr || !/^[0-9a-zA-Z+\-*/().,% ]+$/.test(expr)) return null;
  const translated = expr.replace(/[a-zA-Z_]+/g, (name) => {
    if (name === "x" || name === "y") return name;
    const lower = name.toLowerCase();
    if (lower in FUNCS) return FUNCS[lower];
    throw new Error(`unknown identifier ${name}`);
  });
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("x", "y", `"use strict"; return (${translated});`) as MathFn;
    const probe = fn(1, 1);
    if (typeof probe !== "number") return null;
    return (x, y) => {
      const v = fn(x, y);
      return Number.isFinite(v) ? v : NaN;
    };
  } catch {
    return null;
  }
}

export function prettyExpression(raw: string): string {
  return raw.trim().replace(/\*\*/g, "^").replace(/\*/g, "·");
}
