/**
 * Virtual filesystem built from a mission's terminal environment.
 *
 * The base tree is immutable (it comes from the mission definition). Per-session
 * mutations — currently permission changes from chmod — are kept in an overlay on the
 * terminal state, so the same definition can serve every user.
 */
import type { TerminalEnv } from "../schema";

export interface VNode {
  path: string;
  name: string;
  type: "file" | "dir";
  mode: number;
  owner: string;
  group: string;
  mtime: string;
  content: string;
  binary: boolean;
  fileType?: string;
  children: string[]; // child names (dirs only), sorted
}

export interface Identity {
  user: string;
  groups: string[];
}

export class VirtualFS {
  private nodes = new Map<string, VNode>();

  constructor(env: TerminalEnv, private modeOverrides: Record<string, number> = {}) {
    this.ensureDir("/", { mode: 0o755, owner: "root", group: "root", mtime: "2026-01-01T00:00:00Z" });
    for (const d of env.dirs) {
      this.ensureDir(normalize(d.path), d);
    }
    for (const f of env.files) {
      const path = normalize(f.path);
      this.ensureDir(parentOf(path));
      const node: VNode = {
        path,
        name: baseName(path),
        type: "file",
        mode: f.mode,
        owner: f.owner,
        group: f.group,
        mtime: f.mtime,
        content: f.content,
        binary: f.binary,
        fileType: f.fileType,
        children: [],
      };
      this.nodes.set(path, node);
      this.link(path);
    }
    for (const n of this.nodes.values()) n.children.sort();
  }

  private ensureDir(
    path: string,
    meta?: { mode: number; owner: string; group: string; mtime: string },
  ): void {
    const existing = this.nodes.get(path);
    if (existing) {
      if (meta) Object.assign(existing, meta);
      return;
    }
    if (path !== "/") this.ensureDir(parentOf(path));
    this.nodes.set(path, {
      path,
      name: path === "/" ? "/" : baseName(path),
      type: "dir",
      mode: meta?.mode ?? 0o755,
      owner: meta?.owner ?? "root",
      group: meta?.group ?? "root",
      mtime: meta?.mtime ?? "2026-10-01T09:00:00Z",
      content: "",
      binary: false,
      children: [],
    });
    if (path !== "/") this.link(path);
  }

  private link(path: string) {
    const parent = this.nodes.get(parentOf(path));
    const name = baseName(path);
    if (parent && !parent.children.includes(name)) parent.children.push(name);
  }

  get(path: string): VNode | undefined {
    const n = this.nodes.get(normalize(path));
    if (!n) return undefined;
    const override = this.modeOverrides[n.path];
    return override === undefined ? n : { ...n, mode: override };
  }

  children(path: string): VNode[] {
    const dir = this.get(path);
    if (!dir || dir.type !== "dir") return [];
    return dir.children.map((c) => this.get(joinPath(dir.path, c))!).filter(Boolean);
  }

  setMode(path: string, mode: number) {
    this.modeOverrides[normalize(path)] = mode;
  }

  get overrides() {
    return this.modeOverrides;
  }

  /** Walk a subtree depth-first; directories the identity cannot read are reported. */
  walk(
    root: string,
    who: Identity,
    visit: (n: VNode) => void,
    denied: (n: VNode) => void,
  ) {
    const start = this.get(root);
    if (!start) return;
    const stack: VNode[] = [start];
    while (stack.length) {
      const n = stack.shift()!;
      visit(n);
      if (n.type === "dir") {
        if (!canRead(n, who) || !canExec(n, who)) {
          denied(n);
          continue;
        }
        const kids = this.children(n.path);
        stack.unshift(...kids);
      }
    }
  }
}

// ── permission helpers ─────────────────────────────────────────────────────

function bitFor(n: VNode, who: Identity, bit: number): boolean {
  if (n.owner === who.user) return ((n.mode >> 6) & bit) !== 0;
  if (who.groups.includes(n.group)) return ((n.mode >> 3) & bit) !== 0;
  return (n.mode & bit) !== 0;
}
export const canRead = (n: VNode, who: Identity) => bitFor(n, who, 4);
export const canWrite = (n: VNode, who: Identity) => bitFor(n, who, 2);
export const canExec = (n: VNode, who: Identity) => bitFor(n, who, 1);

// ── path helpers ───────────────────────────────────────────────────────────

export function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function resolvePath(input: string, cwd: string, home: string): string {
  if (input === "~") return home;
  if (input.startsWith("~/")) return normalize(home + input.slice(1));
  if (input.startsWith("/")) return normalize(input);
  return normalize(cwd + "/" + input);
}

export function parentOf(path: string): string {
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export function baseName(path: string): string {
  if (path === "/") return "/";
  return path.slice(path.lastIndexOf("/") + 1);
}

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

export function modeString(n: VNode): string {
  const t = n.type === "dir" ? "d" : "-";
  const rwx = (v: number) => (v & 4 ? "r" : "-") + (v & 2 ? "w" : "-") + (v & 1 ? "x" : "-");
  return t + rwx((n.mode >> 6) & 7) + rwx((n.mode >> 3) & 7) + rwx(n.mode & 7);
}

export function sizeOf(n: VNode): number {
  return n.type === "dir" ? 4096 : new TextEncoder().encode(n.content).length;
}
