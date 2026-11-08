/**
 * Shell-like tokenizer for the simulated terminal.
 *
 * Supports single/double quotes, backslash escapes and pipelines. Anything that would
 * imply real process control (redirection, command chaining, substitution, background
 * jobs) is rejected with a teaching message instead of being half-supported.
 */

export interface Token {
  value: string;
  /** True when any part of the token was quoted — quoted tokens are not glob-expanded. */
  quoted: boolean;
}

export type ParseResult =
  | { ok: true; stages: Token[][] }
  | { ok: false; error: string };

const UNSUPPORTED: Record<string, string> = {
  ">": "output redirection (>) is",
  "<": "input redirection (<) is",
  ";": "command chaining (;) is",
  "&": "'&' and '&&' are",
  "`": "command substitution is",
};

export function parseCommandLine(line: string): ParseResult {
  const stages: Token[][] = [[]];
  let cur = "";
  let quoted = false;
  let inToken = false;
  let quote: '"' | "'" | null = null;

  const push = () => {
    if (inToken) stages[stages.length - 1].push({ value: cur, quoted });
    cur = "";
    quoted = false;
    inToken = false;
  };

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && i + 1 < line.length && '"\\$'.includes(line[i + 1])) {
        cur += line[++i];
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      quoted = true;
      inToken = true;
      continue;
    }
    if (ch === "\\" && i + 1 < line.length) {
      cur += line[++i];
      inToken = true;
      continue;
    }
    if (ch === "$" && line[i + 1] === "(") {
      return { ok: false, error: "command substitution is not supported in this simulated shell" };
    }
    if (ch in UNSUPPORTED) {
      return { ok: false, error: `${UNSUPPORTED[ch]} not supported in this simulated shell — run one command at a time` };
    }
    if (ch === "|") {
      push();
      if (stages[stages.length - 1].length === 0) return { ok: false, error: "syntax error near unexpected token `|'" };
      stages.push([]);
      continue;
    }
    if (ch === " " || ch === "\t") {
      push();
      continue;
    }
    cur += ch;
    inToken = true;
  }
  if (quote) return { ok: false, error: "unexpected end of input: unmatched quote" };
  push();
  if (stages.length > 1 && stages[stages.length - 1].length === 0)
    return { ok: false, error: "syntax error: pipeline ends with '|'" };
  return { ok: true, stages: stages.filter((s) => s.length > 0) };
}

/** Convert a shell glob (* ? [abc]) into an anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else if (c === "[") {
      const end = glob.indexOf("]", i + 1);
      if (end === -1) re += "\\[";
      else {
        re += "[" + glob.slice(i + 1, end).replace(/\\/g, "\\\\") + "]";
        i = end;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(re + "$");
}

export const hasGlob = (s: string) => /[*?[]/.test(s);
