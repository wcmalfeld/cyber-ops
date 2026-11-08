import { describe, expect, it } from "vitest";
import { terminalEnvSchema, type TerminalEnv } from "@/engine/schema";
import { applyChmod, execute, initialTerminalState, safeRegExp, type TerminalState } from "@/engine/terminal/interpreter";
import { parseCommandLine } from "@/engine/terminal/parse";
import { loadAuthoredMissions } from "@/content/missions";

const env: TerminalEnv = terminalEnvSchema.parse({
  user: "alice",
  uid: 1000,
  groups: ["alice"],
  hostname: "lab",
  home: "/home/alice",
  cwd: "/home/alice",
  dirs: [
    { path: "/home/alice", owner: "alice", group: "alice", mode: 0o750 },
    { path: "/home/bob", owner: "bob", group: "bob", mode: 0o700 },
  ],
  files: [
    { path: "/home/alice/visible.txt", owner: "alice", group: "alice", content: "one\ntwo\nthree\nERROR four\n" },
    { path: "/home/alice/.secret", owner: "alice", group: "alice", content: "hidden\n" },
    { path: "/home/alice/locked.txt", owner: "alice", group: "alice", mode: 0o000, content: "unlocked!\n" },
    { path: "/home/alice/root-owned.txt", owner: "root", group: "root", mode: 0o600, content: "nope\n" },
    { path: "/home/bob/notes.txt", owner: "bob", group: "bob", content: "bob\n" },
    { path: "/opt/tool", owner: "root", group: "root", mode: 0o755, binary: true, content: "\u0001\u0002hello-world.example\u0003\u0004" },
  ],
  processes: [{ pid: 7, user: "alice", command: "/opt/tool --run" }],
});

function run(cmds: string[], start: TerminalState = initialTerminalState(env)) {
  let st = start;
  const outputs: string[] = [];
  for (const c of cmds) {
    const r = execute(env, st, c);
    st = r.state;
    outputs.push(r.output);
  }
  return { outputs, state: st, last: outputs[outputs.length - 1] };
}

describe("simulated terminal", () => {
  it("hides dotfiles unless -a is passed, and records the observation", () => {
    const plain = run(["ls"]);
    expect(plain.last).not.toContain(".secret");
    expect(plain.state.observed.listedHidden).toEqual([]);

    const all = run(["ls -a"]);
    expect(all.last).toContain(".secret");
    expect(all.state.observed.listedHidden).toContain("/home/alice");
  });

  it("enforces read permissions, and chmod by the owner unlocks", () => {
    const r = run(["cat locked.txt", "chmod u+r locked.txt", "cat locked.txt"]);
    expect(r.outputs[0]).toMatch(/Permission denied/);
    expect(r.outputs[2]).toBe("unlocked!\n");
    expect(r.state.observed.readFiles).toContain("/home/alice/locked.txt");
  });

  it("refuses chmod on files the user does not own", () => {
    const r = run(["chmod 777 root-owned.txt", "cat root-owned.txt"]);
    expect(r.outputs[0]).toMatch(/Operation not permitted/);
    expect(r.outputs[1]).toMatch(/Permission denied/);
  });

  it("enforces directory traversal permissions", () => {
    expect(run(["ls /home/bob"]).last).toMatch(/Permission denied/);
    expect(run(["cat /home/bob/notes.txt"]).last).toMatch(/Permission denied/);
    expect(run(["cd /home/bob"]).last).toMatch(/Permission denied/);
  });

  it("never escapes the synthetic filesystem", () => {
    // Paths normalize inside the virtual root; host files simply don't exist here.
    expect(run(["cat ../../../../etc/passwd"]).last).toMatch(/No such file/);
    expect(run(["cat /proc/self/environ"]).last).toMatch(/No such file/);
  });

  it("supports navigation, pipes and grep options", () => {
    const r = run(["cd /opt", "pwd", "cd -", "grep -n -i error visible.txt", "cat visible.txt | grep -c o", "head -n 2 visible.txt | tail -n 1"]);
    expect(r.outputs[1]).toBe("/opt\n");
    expect(r.outputs[2]).toBe("/home/alice\n");
    expect(r.outputs[3]).toBe("4:ERROR four\n");
    expect(r.outputs[4]).toBe("3\n");
    expect(r.outputs[5]).toBe("two\n");
  });

  it("suppresses binary output under cat but extracts strings", () => {
    expect(run(["cat /opt/tool"]).last).toMatch(/binary data/);
    expect(run(["strings /opt/tool"]).last).toBe("hello-world.example\n");
    expect(run(["file /opt/tool"]).last).toMatch(/data/);
  });

  it("find respects predicates and reports denied directories", () => {
    const out = run(["find /home -type f -name '*.txt'"]).last;
    expect(out).toContain("/home/alice/visible.txt");
    expect(out).toMatch(/find: '\/home\/bob': Permission denied/);
    expect(out).not.toContain("notes.txt");
  });

  it("rejects shell features that imply real process control", () => {
    for (const c of ["ls > out", "ls; id", "ls && id", "echo $(id)", "echo `id`"]) {
      expect(run([c]).last).toMatch(/not supported/);
    }
  });

  it("reports unknown commands without executing anything", () => {
    expect(run(["rm -rf /"]).last).toMatch(/command not found/);
    expect(run(["sudo cat /etc/shadow"]).last).toMatch(/sudoers/);
  });

  it("does not mutate the prior state object", () => {
    const s0 = initialTerminalState(env);
    const snapshot = JSON.stringify(s0);
    execute(env, s0, "chmod 644 locked.txt");
    execute(env, s0, "cd /opt");
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it("caps input length", () => {
    expect(run(["echo " + "a".repeat(600)]).last).toMatch(/input too long/);
  });
});

describe("parser and helpers", () => {
  it("tokenizes quotes and escapes", () => {
    const p = parseCommandLine(`grep "two words" 'single quoted' back\\ slash`);
    expect(p.ok && p.stages[0].map((t) => t.value)).toEqual(["grep", "two words", "single quoted", "back slash"]);
  });

  it("rejects malformed pipelines", () => {
    expect(parseCommandLine("| ls").ok).toBe(false);
    expect(parseCommandLine("ls |").ok).toBe(false);
    expect(parseCommandLine(`echo "unterminated`).ok).toBe(false);
  });

  it("applies octal and symbolic chmod", () => {
    expect(applyChmod("644", 0)).toBe(0o644);
    expect(applyChmod("u+rw,go-w", 0o022)).toBe(0o600);
    expect(applyChmod("a+x", 0o644)).toBe(0o755);
    expect(applyChmod("bogus", 0o644)).toBeNull();
  });

  it("refuses regex patterns prone to catastrophic backtracking", () => {
    expect(typeof safeRegExp("(a+)+$", "", false)).toBe("string");
    expect(typeof safeRegExp("(x*)*", "", false)).toBe("string");
    expect(safeRegExp("error|warn", "i", false)).toBeInstanceOf(RegExp);
    expect(safeRegExp("(a+)+", "", true)).toBeInstanceOf(RegExp); // -F is literal
  });
});

describe("Mission 1 is solvable through the interpreter alone", () => {
  const m = loadAuthoredMissions().find((x) => x.id === "hidden-in-plain-sight")!;
  it("surfaces every answer only after the right commands", () => {
    const e = m.terminal!;
    let st = initialTerminalState(e);
    const exec = (c: string) => {
      const r = execute(e, st, c);
      st = r.state;
      return r.output;
    };
    expect(exec("ls")).not.toContain("CYBEROPS");
    expect(exec("cat reports/incident_brief.txt")).toMatch(/Permission denied/);
    expect(exec("ls -la")).toContain(".mentor");
    expect(exec("cat .mentor/welcome.txt")).toContain("CYBEROPS{dotfiles_are_not_invisible}");
    exec("chmod 400 reports/incident_brief.txt");
    expect(exec("cat reports/incident_brief.txt")).toContain("CYBEROPS{permissions_are_a_lock_you_own}");
    expect(exec("ps aux")).toContain("/tmp/.X11-cache/sysupdate");
    expect(exec("cat /tmp/.X11-cache/sysupdate")).not.toContain("beacon.");
    expect(exec("strings /tmp/.X11-cache/sysupdate")).toContain("beacon.update-cdn-sync.example");
  });
});
