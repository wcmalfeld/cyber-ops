/**
 * Controlled command interpreter for the simulated terminal (PRD §9.1, §15.1).
 *
 * Every command is a TypeScript function over the VirtualFS. Nothing here spawns a
 * process, touches the host filesystem, or evaluates user input as code. Output is
 * computed from the mission's synthetic state, so `ls` without `-a` genuinely hides
 * dotfiles and `cat` genuinely fails on a file without read permission.
 */
import type { TerminalEnv } from "../schema";
import { globToRegExp, hasGlob, parseCommandLine, type Token } from "./parse";
import {
  VirtualFS,
  baseName,
  canExec,
  canRead,
  joinPath,
  modeString,
  normalize,
  parentOf,
  resolvePath,
  sizeOf,
  type Identity,
  type VNode,
} from "./vfs";

export const MAX_INPUT_LENGTH = 500;
const MAX_OUTPUT_CHARS = 64_000;
const MAX_REGEX_LENGTH = 120;
const MAX_HISTORY = 200;

export interface TerminalState {
  cwd: string;
  prevCwd: string;
  history: string[];
  modeOverrides: Record<string, number>;
  observed: { readFiles: string[]; listedHidden: string[]; commands: string[] };
}

export interface ExecResult {
  output: string;
  clear: boolean;
  state: TerminalState;
}

export function initialTerminalState(env: TerminalEnv): TerminalState {
  return {
    cwd: env.cwd,
    prevCwd: env.cwd,
    history: [],
    modeOverrides: {},
    observed: { readFiles: [], listedHidden: [], commands: [] },
  };
}

interface Ctx {
  env: TerminalEnv;
  fs: VirtualFS;
  who: Identity;
  state: TerminalState;
  observe: {
    read(path: string): void;
    listedHidden(dir: string): void;
  };
}

interface Out {
  stdout: string;
  stderr: string;
  code: number;
  clear?: boolean;
}

type Command = (args: string[], stdin: string | null, ctx: Ctx) => Out;

const ok = (stdout: string): Out => ({ stdout, stderr: "", code: 0 });
const fail = (stderr: string, stdout = ""): Out => ({ stdout, stderr, code: 1 });

// ── option parsing ─────────────────────────────────────────────────────────

/** Split short flags (-la → l, a) from operands. Flags listed in `withValue` take an argument. */
function parseOpts(args: string[], withValue: string[] = []) {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const operands: string[] = [];
  let endOfOpts = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (endOfOpts || !a.startsWith("-") || a === "-") {
      operands.push(a);
      continue;
    }
    if (a === "--") {
      endOfOpts = true;
      continue;
    }
    if (a.startsWith("--")) {
      flags.add(a.slice(2));
      continue;
    }
    const body = a.slice(1);
    if (/^\d+$/.test(body)) {
      values.n = body; // head -20 / tail -5
      continue;
    }
    for (let j = 0; j < body.length; j++) {
      const f = body[j];
      if (withValue.includes(f)) {
        const rest = body.slice(j + 1);
        values[f] = rest || args[++i] || "";
        break;
      }
      flags.add(f);
    }
  }
  return { flags, values, operands };
}

// ── shared helpers ─────────────────────────────────────────────────────────

function lookup(ctx: Ctx, input: string, cmd: string): { node?: VNode; path: string; err?: string } {
  const path = resolvePath(input, ctx.state.cwd, ctx.env.home);
  // Traversal requires execute permission on every ancestor directory.
  let cursor = "/";
  for (const seg of path.split("/").filter(Boolean).slice(0, -1)) {
    cursor = joinPath(cursor, seg);
    const dir = ctx.fs.get(cursor);
    if (!dir) break;
    if (dir.type === "dir" && !canExec(dir, ctx.who))
      return { path, err: `${cmd}: ${input}: Permission denied` };
  }
  const node = ctx.fs.get(path);
  if (!node) return { path, err: `${cmd}: ${input}: No such file or directory` };
  return { node, path };
}

/** Read a file's text for a content-consuming command, enforcing permissions. */
function readText(ctx: Ctx, input: string, cmd: string): { text?: string; node?: VNode; err?: string } {
  const r = lookup(ctx, input, cmd);
  if (r.err) return { err: r.err };
  const node = r.node!;
  if (node.type === "dir") return { err: `${cmd}: ${input}: Is a directory` };
  if (!canRead(node, ctx.who)) return { err: `${cmd}: ${input}: Permission denied` };
  ctx.observe.read(node.path);
  return { text: node.content, node };
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

const joinLines = (lines: string[]) => (lines.length ? lines.join("\n") + "\n" : "");

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = String(d.getUTCDate()).padStart(2, " ");
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${mon} ${day} ${hm}`;
}

/**
 * Compile a user-supplied grep pattern defensively. Patterns are short and nested
 * quantifiers — the classic catastrophic-backtracking shape — are refused outright.
 */
export function safeRegExp(pattern: string, flags: string, fixed: boolean): RegExp | string {
  if (pattern.length > MAX_REGEX_LENGTH) return `pattern too long (max ${MAX_REGEX_LENGTH} characters)`;
  const source = fixed ? pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : pattern;
  if (/\([^)]*[+*}][^)]*\)\s*[+*{]/.test(source))
    return "nested quantifiers are not allowed in this simulated grep";
  try {
    return new RegExp(source, flags);
  } catch {
    return `invalid regular expression: ${pattern}`;
  }
}

function expandGlobs(tokens: Token[], ctx: Ctx): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (t.quoted || !hasGlob(t.value)) {
      out.push(t.value);
      continue;
    }
    const abs = resolvePath(t.value, ctx.state.cwd, ctx.env.home);
    const dir = parentOf(abs);
    const re = globToRegExp(baseName(abs));
    const showHidden = baseName(abs).startsWith(".");
    const dirNode = ctx.fs.get(dir);
    const matches =
      dirNode && dirNode.type === "dir" && canRead(dirNode, ctx.who)
        ? ctx.fs
            .children(dir)
            .filter((c) => re.test(c.name) && (showHidden || !c.name.startsWith(".")))
            .map((c) => {
              // Preserve the user's relative form where possible.
              const prefix = t.value.startsWith("~")
                ? (dir === "/" ? "/" : dir + "/")
                : t.value.includes("/")
                  ? t.value.slice(0, t.value.lastIndexOf("/") + 1)
                  : "";
              return prefix + c.name;
            })
        : [];
    if (matches.length) out.push(...matches);
    else out.push(t.value); // bash leaves unmatched globs literal
  }
  return out;
}

// ── commands ───────────────────────────────────────────────────────────────

const pwd: Command = (_a, _s, ctx) => ok(ctx.state.cwd + "\n");

const cd: Command = (args, _s, ctx) => {
  const target = args[0] === "-" ? ctx.state.prevCwd : args[0] ?? ctx.env.home;
  const r = lookup(ctx, target, "cd");
  if (r.err) return fail(r.err);
  if (r.node!.type !== "dir") return fail(`cd: ${target}: Not a directory`);
  if (!canExec(r.node!, ctx.who)) return fail(`cd: ${target}: Permission denied`);
  ctx.state.prevCwd = ctx.state.cwd;
  ctx.state.cwd = r.node!.path;
  return ok(args[0] === "-" ? r.node!.path + "\n" : "");
};

function lsLong(n: VNode, label: string): string {
  return `${modeString(n)} 1 ${n.owner.padEnd(8)} ${n.group.padEnd(8)} ${String(sizeOf(n)).padStart(6)} ${fmtDate(n.mtime)} ${label}`;
}

const ls: Command = (args, _s, ctx) => {
  const { flags, operands } = parseOpts(args);
  const all = flags.has("a") || flags.has("all");
  const almostAll = flags.has("A") || flags.has("almost-all");
  const long = flags.has("l");
  const targets = operands.length ? operands : ["."];
  const blocks: string[] = [];
  const fileEntries: string[] = [];
  const errors: string[] = [];
  const dirTargets = targets.filter((t) => ctx.fs.get(resolvePath(t, ctx.state.cwd, ctx.env.home))?.type === "dir");
  for (const t of targets) {
    const r = lookup(ctx, t, "ls");
    if (r.err) {
      errors.push(r.err.replace(/^ls: (.*): (No such file or directory|Permission denied)$/, "ls: cannot access '$1': $2"));
      continue;
    }
    const node = r.node!;
    if (node.type === "file") {
      fileEntries.push(long ? lsLong(node, t) : t);
      continue;
    }
    if (!canRead(node, ctx.who)) {
      errors.push(`ls: cannot open directory '${t}': Permission denied`);
      continue;
    }
    const kids = ctx.fs.children(node.path);
    const hidden = kids.filter((k) => k.name.startsWith("."));
    const visible = kids.filter((k) => all || almostAll || !k.name.startsWith("."));
    if ((all || almostAll) && hidden.length) ctx.observe.listedHidden(node.path);
    const entries: { label: string; node: VNode }[] = [];
    if (all) {
      entries.push({ label: ".", node });
      entries.push({ label: "..", node: ctx.fs.get(parentOf(node.path))! });
    }
    for (const k of visible) entries.push({ label: k.name + (k.type === "dir" && !long ? "/" : ""), node: k });
    const body = long
      ? [`total ${entries.length * 4}`, ...entries.map((e) => lsLong(e.node, e.label.replace(/\/$/, "")))].join("\n")
      : entries.map((e) => e.label).join("  ");
    blocks.push(targets.length > 1 ? `${t}:\n${body}` : body);
  }
  if (fileEntries.length) blocks.unshift(fileEntries.join(long ? "\n" : "  "));
  const stdout = blocks.filter((b) => b !== "").join(dirTargets.length > 0 && targets.length > 1 ? "\n\n" : "\n");
  return { stdout: stdout ? stdout + "\n" : "", stderr: errors.join("\n"), code: errors.length ? 2 : 0 };
};

function catLike(name: string): Command {
  return (args, stdin, ctx) => {
    const { operands } = parseOpts(args);
    if (!operands.length) return stdin !== null ? ok(stdin) : fail(`${name}: missing file operand`);
    let stdout = "";
    const errors: string[] = [];
    for (const f of operands) {
      const r = readText(ctx, f, name);
      if (r.err) errors.push(r.err);
      else if (r.node!.binary)
        stdout += `[${name}: '${f}' is binary data (${sizeOf(r.node!)} bytes) — output suppressed. Try 'file' or 'strings'.]\n`;
      else stdout += r.text!.endsWith("\n") || r.text === "" ? r.text! : r.text! + "\n";
    }
    return { stdout, stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
  };
}

function headTail(which: "head" | "tail"): Command {
  return (args, stdin, ctx) => {
    const { values, operands } = parseOpts(args, ["n"]);
    const n = Number.parseInt(values.n ?? "10", 10);
    if (!Number.isFinite(n) || n < 0) return fail(`${which}: invalid number of lines: '${values.n}'`);
    const take = (text: string) => {
      const lines = splitLines(text);
      return joinLines(which === "head" ? lines.slice(0, n) : lines.slice(Math.max(0, lines.length - n)));
    };
    if (!operands.length) return stdin !== null ? ok(take(stdin)) : fail(`${which}: missing file operand`);
    let stdout = "";
    const errors: string[] = [];
    operands.forEach((f, i) => {
      const r = readText(ctx, f, which);
      if (r.err) return errors.push(r.err);
      if (r.node!.binary) return errors.push(`${which}: ${f}: binary file — try 'strings'`);
      if (operands.length > 1) stdout += `${i ? "\n" : ""}==> ${f} <==\n`;
      stdout += take(r.text!);
    });
    return { stdout, stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
  };
}

const grep: Command = (args, stdin, ctx) => {
  const { flags, operands } = parseOpts(args);
  if (!operands.length) return fail("usage: grep [-invcrlFE] PATTERN [FILE...]");
  const [pattern, ...files] = operands;
  const re = safeRegExp(pattern, flags.has("i") ? "i" : "", flags.has("F"));
  if (typeof re === "string") return { stdout: "", stderr: `grep: ${re}`, code: 2 };
  const invert = flags.has("v");
  const recursive = flags.has("r") || flags.has("R");

  const sources: { label: string; text: string }[] = [];
  const errors: string[] = [];
  if (!files.length && !recursive) {
    if (stdin === null) return fail("grep: no input — give a file or pipe text into grep");
    sources.push({ label: "(standard input)", text: stdin });
  }
  const roots = files.length ? files : recursive ? ["."] : [];
  for (const f of roots) {
    const r = lookup(ctx, f, "grep");
    if (r.err) {
      errors.push(r.err);
      continue;
    }
    if (r.node!.type === "dir") {
      if (!recursive) {
        errors.push(`grep: ${f}: Is a directory`);
        continue;
      }
      ctx.fs.walk(
        r.node!.path,
        ctx.who,
        (n) => {
          if (n.type !== "file") return;
          const label = f === "." ? n.path.replace(ctx.state.cwd + "/", "") : n.path;
          if (!canRead(n, ctx.who)) return void errors.push(`grep: ${label}: Permission denied`);
          if (n.binary) return;
          ctx.observe.read(n.path);
          sources.push({ label, text: n.content });
        },
        (d) => {
          if (d.path !== r.node!.path) errors.push(`grep: ${d.path}: Permission denied`);
        },
      );
      continue;
    }
    const t = readText(ctx, f, "grep");
    if (t.err) errors.push(t.err);
    else if (t.node!.binary) {
      if (splitLines(t.text!).some((l) => re.test(l) !== invert)) sources.push({ label: f, text: "\u0000binary" });
    } else sources.push({ label: f, text: t.text! });
  }

  const showName = sources.length > 1 || recursive;
  let stdout = "";
  let matchedAny = false;
  for (const s of sources) {
    if (s.text === "\u0000binary") {
      stdout += `grep: ${s.label}: binary file matches\n`;
      matchedAny = true;
      continue;
    }
    const lines = splitLines(s.text);
    let count = 0;
    lines.forEach((line, i) => {
      if (re.test(line) === invert) return;
      count++;
      matchedAny = true;
      if (flags.has("c") || flags.has("l")) return;
      stdout += `${showName ? s.label + ":" : ""}${flags.has("n") ? i + 1 + ":" : ""}${line}\n`;
    });
    if (flags.has("l") && count) stdout += s.label + "\n";
    if (flags.has("c")) stdout += `${showName ? s.label + ":" : ""}${count}\n`;
  }
  return { stdout, stderr: errors.join("\n"), code: errors.length ? 2 : matchedAny ? 0 : 1 };
};

function parsePerm(spec: string): { mode: number; exact: boolean; any: boolean } | null {
  const any = spec.startsWith("/");
  const all = spec.startsWith("-");
  const digits = spec.replace(/^[-/]/, "");
  if (!/^[0-7]{3,4}$/.test(digits)) return null;
  return { mode: Number.parseInt(digits, 8), exact: !any && !all, any };
}

const find: Command = (args, _s, ctx) => {
  const roots: string[] = [];
  let i = 0;
  while (i < args.length && !args[i].startsWith("-")) roots.push(args[i++]);
  if (!roots.length) roots.push(".");
  const preds: ((n: VNode) => boolean)[] = [];
  let maxDepth = Infinity;
  while (i < args.length) {
    const opt = args[i++];
    const val = args[i++];
    if (val === undefined) return fail(`find: missing argument to '${opt}'`);
    switch (opt) {
      case "-name":
      case "-iname": {
        const re = globToRegExp(opt === "-iname" ? val.toLowerCase() : val);
        preds.push((n) => re.test(opt === "-iname" ? n.name.toLowerCase() : n.name));
        break;
      }
      case "-type":
        if (val !== "f" && val !== "d") return fail(`find: unknown argument to -type: ${val}`);
        preds.push((n) => (val === "f" ? n.type === "file" : n.type === "dir"));
        break;
      case "-user":
        preds.push((n) => n.owner === val);
        break;
      case "-group":
        preds.push((n) => n.group === val);
        break;
      case "-perm": {
        const p = parsePerm(val);
        if (!p) return fail(`find: invalid mode '${val}' (use octal, e.g. 644, -400, /002)`);
        preds.push((n) => (p.exact ? n.mode === p.mode : p.any ? (n.mode & p.mode) !== 0 : (n.mode & p.mode) === p.mode));
        break;
      }
      case "-maxdepth": {
        const d = Number.parseInt(val, 10);
        if (!Number.isFinite(d) || d < 0) return fail(`find: invalid -maxdepth '${val}'`);
        maxDepth = d;
        break;
      }
      default:
        return fail(`find: unsupported predicate '${opt}' (supported: -name -iname -type -user -group -perm -maxdepth)`);
    }
  }
  let stdout = "";
  const errors: string[] = [];
  for (const root of roots) {
    const r = lookup(ctx, root, "find");
    if (r.err) {
      errors.push(r.err.replace(/^find: (.*): No such/, "find: '$1': No such"));
      continue;
    }
    const base = r.node!.path;
    const label = (p: string) => {
      if (p === base) return root;
      const rel = p.slice(base === "/" ? 1 : base.length + 1);
      if (root === ".") return "./" + rel;
      return (root.endsWith("/") ? root : root + "/") + rel;
    };
    const depth = (p: string) => (p === base ? 0 : p.slice(base.length).split("/").filter(Boolean).length);
    ctx.fs.walk(
      base,
      ctx.who,
      (n) => {
        if (depth(n.path) > maxDepth) return;
        if (preds.every((p) => p(n))) {
          stdout += label(n.path) + "\n";
          if (n.name.startsWith(".") && n.path !== base) ctx.observe.listedHidden(parentOf(n.path));
        }
      },
      (d) => errors.push(`find: '${label(d.path)}': Permission denied`),
    );
  }
  return { stdout, stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
};

function describe(n: VNode): string {
  if (n.type === "dir") return "directory";
  if (n.fileType) return n.fileType;
  if (n.content === "") return "empty";
  if (n.binary) return "data";
  if (n.name.endsWith(".json")) return "JSON text data";
  if (n.name.endsWith(".csv")) return "CSV text";
  if (n.content.startsWith("#!/bin/bash") || n.content.startsWith("#!/bin/sh"))
    return "Bourne-Again shell script, ASCII text executable";
  return "ASCII text";
}

const file: Command = (args, _s, ctx) => {
  const { operands } = parseOpts(args);
  if (!operands.length) return fail("usage: file FILE...");
  let stdout = "";
  const errors: string[] = [];
  for (const f of operands) {
    const r = lookup(ctx, f, "file");
    if (r.err) {
      stdout += `${f}: cannot open '${f}' (No such file or directory)\n`;
      continue;
    }
    // `file` reads magic bytes, so it needs read permission like the real tool.
    if (r.node!.type === "file" && !canRead(r.node!, ctx.who)) stdout += `${f}: regular file, no read permission\n`;
    else stdout += `${f}: ${describe(r.node!)}\n`;
  }
  return { stdout, stderr: errors.join("\n"), code: 0 };
};

const stat: Command = (args, _s, ctx) => {
  const { operands } = parseOpts(args);
  if (!operands.length) return fail("stat: missing operand");
  let stdout = "";
  const errors: string[] = [];
  for (const f of operands) {
    const r = lookup(ctx, f, "stat");
    if (r.err) {
      errors.push(r.err.replace(/^stat: (.*): No such/, "stat: cannot statx '$1': No such"));
      continue;
    }
    const n = r.node!;
    const ts = n.mtime.replace("T", " ").replace("Z", ".000000000 +0000");
    stdout +=
      `  File: ${f}\n` +
      `  Size: ${sizeOf(n)}\tBlocks: ${Math.ceil(sizeOf(n) / 512) * 8}\t${n.type === "dir" ? "directory" : "regular file"}\n` +
      `Access: (0${(n.mode & 0o777).toString(8)}/${modeString(n)})  Uid: (${n.owner})   Gid: (${n.group})\n` +
      `Modify: ${ts}\n` +
      `Change: ${ts}\n`;
  }
  return { stdout, stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
};

const strings: Command = (args, stdin, ctx) => {
  const { values, operands } = parseOpts(args, ["n"]);
  const min = Number.parseInt(values.n ?? "4", 10) || 4;
  const extract = (text: string) => {
    const runs = text.match(new RegExp(`[\\x20-\\x7e\\t]{${min},}`, "g")) ?? [];
    return joinLines(runs.map((s) => s.trim()).filter((s) => s.length >= min));
  };
  if (!operands.length) return stdin !== null ? ok(extract(stdin)) : fail("usage: strings [-n MIN] FILE...");
  let stdout = "";
  const errors: string[] = [];
  for (const f of operands) {
    const r = readText(ctx, f, "strings");
    if (r.err) errors.push(r.err);
    else stdout += extract(r.text!);
  }
  return { stdout, stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
};

/** Apply a chmod spec (octal or symbolic like u+r,go-w) to an existing mode. */
export function applyChmod(spec: string, current: number): number | null {
  if (/^[0-7]{1,4}$/.test(spec)) return Number.parseInt(spec, 8) & 0o777;
  let mode = current;
  for (const clause of spec.split(",")) {
    const m = clause.match(/^([ugoa]*)([+\-=])([rwx]*)$/);
    if (!m) return null;
    const who = m[1] === "" || m[1].includes("a") ? "ugo" : m[1];
    let bits = 0;
    if (m[3].includes("r")) bits |= 4;
    if (m[3].includes("w")) bits |= 2;
    if (m[3].includes("x")) bits |= 1;
    for (const w of who) {
      const shift = w === "u" ? 6 : w === "g" ? 3 : 0;
      if (m[2] === "+") mode |= bits << shift;
      else if (m[2] === "-") mode &= ~(bits << shift);
      else mode = (mode & ~(7 << shift)) | (bits << shift);
    }
  }
  return mode & 0o777;
}

const chmod: Command = (args, _s, ctx) => {
  const operands = args.filter((a) => a !== "-v");
  if (operands.length < 2) return fail("usage: chmod MODE FILE...");
  const [spec, ...files] = operands;
  const errors: string[] = [];
  for (const f of files) {
    const r = lookup(ctx, f, "chmod");
    if (r.err) {
      errors.push(r.err.replace(/^chmod: (.*): No such/, "chmod: cannot access '$1': No such"));
      continue;
    }
    const n = r.node!;
    if (n.owner !== ctx.who.user) {
      errors.push(`chmod: changing permissions of '${f}': Operation not permitted`);
      continue;
    }
    const next = applyChmod(spec, n.mode);
    if (next === null) return fail(`chmod: invalid mode: '${spec}'`);
    ctx.fs.setMode(n.path, next);
  }
  return { stdout: "", stderr: errors.join("\n"), code: errors.length ? 1 : 0 };
};

const whoami: Command = (_a, _s, ctx) => ok(ctx.env.user + "\n");

const id: Command = (_a, _s, ctx) => {
  const g = ctx.env.groups.map((name, i) => `${i === 0 ? ctx.env.uid : 1000 + 10 * i}(${name})`);
  return ok(`uid=${ctx.env.uid}(${ctx.env.user}) gid=${g[0]} groups=${g.join(",")}\n`);
};

const ps: Command = (_a, _s, ctx) => {
  const rows = ctx.env.processes.map(
    (p) =>
      `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${p.start.padStart(5)} ${p.command}`,
  );
  return ok([`${"USER".padEnd(10)} ${"PID".padStart(6)} %CPU %MEM START COMMAND`, ...rows].join("\n") + "\n");
};

const history: Command = (_a, _s, ctx) => {
  const all = [...ctx.env.history, ...ctx.state.history];
  return ok(all.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n") + "\n");
};

const clear: Command = () => ({ stdout: "", stderr: "", code: 0, clear: true });

// optional, mission-enabled commands

const base64: Command = (args, stdin, ctx) => {
  const { flags, operands } = parseOpts(args);
  let input: string;
  if (operands.length) {
    const r = readText(ctx, operands[0], "base64");
    if (r.err) return fail(r.err);
    input = r.text!;
  } else if (stdin !== null) input = stdin;
  else return fail("usage: base64 [-d] [FILE]");
  if (flags.has("d") || flags.has("decode")) {
    const clean = input.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return fail("base64: invalid input");
    return ok(Buffer.from(clean, "base64").toString("utf8"));
  }
  return ok(Buffer.from(input, "utf8").toString("base64") + "\n");
};

const wc: Command = (args, stdin, ctx) => {
  const { flags, operands } = parseOpts(args);
  const count = (t: string) => {
    const l = (t.match(/\n/g) ?? []).length;
    const w = t.split(/\s+/).filter(Boolean).length;
    const c = new TextEncoder().encode(t).length;
    const pick = flags.size ? [flags.has("l") && l, flags.has("w") && w, flags.has("c") && c].filter((x) => x !== false) : [l, w, c];
    return pick.map((x) => String(x).padStart(flags.size ? 0 : 7)).join(" ");
  };
  if (!operands.length) return stdin !== null ? ok(count(stdin).trim() + "\n") : fail("usage: wc [-lwc] [FILE]");
  let stdout = "";
  for (const f of operands) {
    const r = readText(ctx, f, "wc");
    if (r.err) return fail(r.err, stdout);
    stdout += `${count(r.text!)} ${f}\n`;
  }
  return ok(stdout);
};

const sort: Command = (args, stdin, ctx) => {
  const { flags, operands } = parseOpts(args);
  let text = stdin ?? "";
  if (operands.length) {
    const r = readText(ctx, operands[0], "sort");
    if (r.err) return fail(r.err);
    text = r.text!;
  }
  const lines = splitLines(text);
  lines.sort(flags.has("n") ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (flags.has("r")) lines.reverse();
  return ok(joinLines(lines));
};

const uniq: Command = (args, stdin) => {
  const { flags } = parseOpts(args);
  const lines = splitLines(stdin ?? "");
  const out: { line: string; n: number }[] = [];
  for (const l of lines) {
    if (out.length && out[out.length - 1].line === l) out[out.length - 1].n++;
    else out.push({ line: l, n: 1 });
  }
  return ok(joinLines(out.map((o) => (flags.has("c") ? `${String(o.n).padStart(7)} ${o.line}` : o.line))));
};

const echo: Command = (args) => ok(args.join(" ") + "\n");

const CORE: Record<string, Command> = {
  pwd,
  ls,
  cd,
  cat: catLike("cat"),
  less: catLike("less"),
  head: headTail("head"),
  tail: headTail("tail"),
  grep,
  find,
  file,
  stat,
  strings,
  chmod,
  whoami,
  id,
  ps,
  history,
  clear,
};

const OPTIONAL: Record<string, Command> = { base64, wc, sort, uniq, echo };

export function availableCommands(env: TerminalEnv): string[] {
  return [...Object.keys(CORE), ...env.extraCommands, "help"].sort();
}

const HELP: Record<string, string> = {
  pwd: "print the current directory",
  ls: "list directory contents (-a show hidden, -l long format)",
  cd: "change directory (cd .., cd ~, cd -)",
  cat: "print file contents",
  less: "view a file (non-paged in this terminal)",
  head: "first lines of a file (-n N)",
  tail: "last lines of a file (-n N)",
  grep: "search text (-i ignore case, -n line numbers, -v invert, -c count, -r recursive)",
  find: "search for files (-name, -type f|d, -user, -perm, -maxdepth)",
  file: "identify a file's type",
  stat: "show file metadata",
  strings: "extract printable text from binary files",
  chmod: "change file permissions (chmod 644 f, chmod u+r f)",
  whoami: "print your user name",
  id: "print your user and group ids",
  ps: "list running processes",
  history: "show command history",
  clear: "clear the screen",
  base64: "encode or decode base64 (-d)",
  wc: "count lines, words, bytes",
  sort: "sort lines (-r reverse, -n numeric)",
  uniq: "collapse repeated lines (-c count)",
  echo: "print text",
};

// ── entry point ────────────────────────────────────────────────────────────

export function execute(env: TerminalEnv, prior: TerminalState, rawInput: string): ExecResult {
  const state: TerminalState = structuredClone(prior);
  const input = rawInput.replace(/[\r\n]+/g, " ").trim();
  if (!input) return { output: "", clear: false, state };
  if (input.length > MAX_INPUT_LENGTH)
    return { output: `input too long (max ${MAX_INPUT_LENGTH} characters)\n`, clear: false, state };

  state.history = [...state.history, input].slice(-MAX_HISTORY);

  const fs = new VirtualFS(env, state.modeOverrides);
  const readSet = new Set(state.observed.readFiles);
  const hiddenSet = new Set(state.observed.listedHidden);
  const cmdSet = new Set(state.observed.commands);
  const ctx: Ctx = {
    env,
    fs,
    who: { user: env.user, groups: env.groups },
    state,
    observe: {
      read: (p) => readSet.add(normalize(p)),
      listedHidden: (d) => hiddenSet.add(normalize(d)),
    },
  };

  const parsed = parseCommandLine(input);
  let output: string;
  let clearScreen = false;
  if (!parsed.ok) {
    output = `bash: ${parsed.error}\n`;
  } else {
    const commands: Record<string, Command> = { ...CORE };
    for (const extra of env.extraCommands) commands[extra] = OPTIONAL[extra];
    let stdin: string | null = null;
    output = "";
    for (const stage of parsed.stages) {
      const [head, ...rest] = stage;
      const name = head.value;
      let result: Out;
      if (name === "help") {
        const lines = availableCommands(env)
          .filter((c) => c !== "help")
          .map((c) => `  ${c.padEnd(9)} ${HELP[c] ?? ""}`);
        result = ok(`Simulated shell — available commands:\n${lines.join("\n")}\nPipes (|) are supported. This is a training environment; nothing runs on a real host.\n`);
      } else if (commands[name]) {
        cmdSet.add(name);
        result = commands[name](expandGlobs(rest, ctx), stdin, ctx);
      } else if (name === "sudo") {
        result = fail(`${env.user} is not in the sudoers file. This incident will be reported.`);
      } else {
        result = fail(`bash: ${name}: command not found (type 'help' to list commands available in this environment)`);
      }
      if (result.clear) clearScreen = true;
      if (result.stderr) output += result.stderr.endsWith("\n") ? result.stderr : result.stderr + "\n";
      stdin = result.stdout;
    }
    output += stdin ?? "";
  }

  if (output.length > MAX_OUTPUT_CHARS)
    output = output.slice(0, MAX_OUTPUT_CHARS) + "\n[output truncated — try head, tail or grep]\n";

  state.modeOverrides = { ...fs.overrides };
  state.observed = { readFiles: [...readSet], listedHidden: [...hiddenSet], commands: [...cmdSet] };
  return { output, clear: clearScreen, state };
}
