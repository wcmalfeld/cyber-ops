import type { MissionInput } from "@/engine/schema";

// Synthetic ELF-ish blob: binary noise around the printable strings an analyst would find.
// (No NUL bytes: PostgreSQL JSONB cannot store \u0000.)
const NOISE = "\u0001\u0002\u0003\u007f\u0005\u0010\u0006\u0004";
const sysupdateBinary = [
  "\u007fELF\u0002\u0001\u0001",
  NOISE,
  "/lib64/ld-linux-x86-64.so.2",
  NOISE,
  "libc.so.6",
  NOISE,
  "GLIBC_2.34",
  NOISE + NOISE,
  "getaddrinfo",
  NOISE,
  "/proc/self/exe",
  NOISE,
  "User-Agent: Mozilla/5.0 (X11; sysupdate)",
  NOISE,
  "beacon.update-cdn-sync.example",
  NOISE,
  "/api/v2/checkin?id=%s",
  NOISE,
  "sleep_interval=300",
  NOISE,
  "[sysupdate] running quietly",
  NOISE + NOISE,
  "GCC: (Ubuntu 13.2.0) 13.2.0",
  NOISE,
].join("");

export const hiddenInPlainSight: MissionInput = {
  id: "hidden-in-plain-sight",
  version: 1,
  title: "Hidden in Plain Sight",
  codename: "OP-0001",
  summary:
    "Your first shift on a training workstation. Your mentor hid three lessons on the box — and something else is running that nobody installed.",
  category: "linux",
  path: "dfir",
  difficulty: "easy",
  level: 0,
  estimatedMinutes: 20,
  learningObjectives: [
    "Navigate a Linux filesystem with pwd, ls and cd",
    "Reveal hidden files and explain why they are hidden",
    "Read and change file permissions with ls -l and chmod",
    "Inspect running processes with ps",
    "Identify a binary with file and extract indicators with strings",
  ],
  companyIds: ["circadence", "automox"],
  briefing: {
    organization: "Flatiron Analytics (fictional) — a Boulder data firm in the CYBER OPS training ecosystem",
    role: "New security operations intern, first day on ws-train-01",
    situation: [
      "Your mentor, Dana, set up a workstation for you before going on leave. She left a README in your home directory and a few lessons hidden on the machine.",
      "Network monitoring also flagged ws-train-01 for small, regular outbound connections to a domain nobody recognizes. Find out what is responsible.",
      "Everything here is simulated: the terminal runs against a synthetic filesystem, and commands only affect your training session.",
    ],
    glossary: [
      { term: "Hidden file", definition: "On Linux, any file or directory whose name starts with a period (.). `ls` skips them unless you pass -a. They are unlisted, not protected." },
      { term: "Permissions", definition: "Each file has read (r), write (w) and execute (x) bits for its owner, its group and everyone else. `ls -l` shows them as e.g. -rw-r--r--." },
      { term: "chmod", definition: "Changes a file's permission bits. Only the file's owner (or root) can do it. `chmod 600 f` = owner read+write, nobody else anything." },
      { term: "Process", definition: "A running program. `ps aux` lists every process with its owner and the command that started it." },
      { term: "Indicator of compromise (IOC)", definition: "A concrete artifact — a file path, hash, IP address or domain — that suggests malicious activity and can be searched for elsewhere." },
      { term: "Beaconing", definition: "Malware 'phoning home' to a command-and-control server on a regular interval to ask for instructions." },
    ],
  },
  tools: ["terminal"],
  terminal: {
    user: "analyst",
    uid: 1000,
    groups: ["analyst", "users"],
    hostname: "ws-train-01",
    home: "/home/analyst",
    cwd: "/home/analyst",
    motd: "Flatiron Analytics training workstation — authorized use only.\nType 'help' to list available commands.",
    extraCommands: ["wc", "echo"],
    dirs: [
      { path: "/home", mode: 0o755, owner: "root", group: "root" },
      { path: "/home/analyst", mode: 0o750, owner: "analyst", group: "analyst", mtime: "2026-10-30T16:58:00Z" },
      { path: "/home/analyst/.mentor", mode: 0o700, owner: "analyst", group: "analyst", mtime: "2026-10-30T16:55:00Z" },
      { path: "/home/analyst/reports", mode: 0o755, owner: "analyst", group: "analyst" },
      { path: "/home/dana", mode: 0o700, owner: "dana", group: "dana" },
      { path: "/tmp", mode: 0o777, owner: "root", group: "root" },
      { path: "/tmp/.X11-unix", mode: 0o777, owner: "root", group: "root" },
      { path: "/tmp/.X11-cache", mode: 0o755, owner: "analyst", group: "analyst", mtime: "2026-11-01T03:12:44Z" },
      { path: "/var/log", mode: 0o755, owner: "root", group: "root" },
    ],
    files: [
      {
        path: "/home/analyst/README.txt",
        owner: "analyst",
        group: "analyst",
        content:
          "Welcome to ws-train-01.\n\n" +
          "I left you three lessons on this machine:\n" +
          "  1. A note hidden in this home directory.\n" +
          "  2. A report I locked so nobody reads it by accident. You own it, so you can unlock it.\n" +
          "  3. Something on this box is talking to the internet and I didn't install it.\n\n" +
          "Start with `ls`. Then ask yourself what `ls` isn't showing you.\n" +
          "Type `help` for the list of commands.\n\n" +
          "— Dana\n",
      },
      {
        path: "/home/analyst/notes.txt",
        owner: "analyst",
        group: "analyst",
        content: "todo: learn vim properly\ntodo: request VPN access\ncoffee order: oat flat white\n",
      },
      {
        path: "/home/analyst/.bashrc",
        owner: "analyst",
        group: "analyst",
        content: "# ~/.bashrc\nexport PS1='\\u@\\h:\\w\\$ '\nalias ll='ls -la'\n",
      },
      {
        path: "/home/analyst/.mentor/welcome.txt",
        owner: "analyst",
        group: "analyst",
        mtime: "2026-10-30T16:55:00Z",
        content:
          "Nice — you found it. Dotfiles aren't secret, they're just unlisted.\n" +
          "Attackers love that: plenty of malware lives in directories named like .cache or .X11-something.\n\n" +
          "FLAG: CYBEROPS{dotfiles_are_not_invisible}\n\n" +
          "Lesson 2 is in ~/reports. Use `ls -l` to see why you can't read it.\n",
      },
      {
        path: "/home/analyst/reports/incident_brief.txt",
        owner: "analyst",
        group: "analyst",
        mode: 0o000,
        mtime: "2026-10-30T16:57:00Z",
        content:
          "INCIDENT BRIEF — ws-train-01 (TLP:AMBER, training)\n\n" +
          "Netflow shows this workstation contacting an unknown host roughly every 5 minutes since 1 Nov.\n" +
          "Nothing in our software inventory explains it.\n\n" +
          "Start with the running processes. Anything executing out of /tmp deserves a hard look —\n" +
          "legitimate software almost never runs from there.\n\n" +
          "FLAG: CYBEROPS{permissions_are_a_lock_you_own}\n",
      },
      {
        path: "/home/analyst/reports/q3_summary.txt",
        owner: "analyst",
        group: "analyst",
        content: "Q3 SOC summary\n- 1,204 alerts triaged\n- 14 escalations\n- 0 confirmed incidents\n",
      },
      {
        path: "/home/dana/private.txt",
        owner: "dana",
        group: "dana",
        mode: 0o600,
        content: "Not for you. Good instinct trying, though: permission boundaries are real.\n",
      },
      {
        path: "/tmp/.X11-cache/sysupdate",
        owner: "analyst",
        group: "analyst",
        mode: 0o755,
        mtime: "2026-11-01T03:12:44Z",
        binary: true,
        fileType: "ELF 64-bit LSB pie executable, x86-64, dynamically linked, stripped",
        content: sysupdateBinary,
      },
      {
        path: "/etc/hostname",
        content: "ws-train-01\n",
      },
      {
        path: "/etc/passwd",
        content:
          "root:x:0:0:root:/root:/bin/bash\n" +
          "syslog:x:104:110::/home/syslog:/usr/sbin/nologin\n" +
          "dana:x:1001:1001:Dana Ruiz:/home/dana:/bin/bash\n" +
          "analyst:x:1000:1000:Training Analyst:/home/analyst:/bin/bash\n",
      },
      { path: "/etc/shadow", mode: 0o640, group: "shadow", content: "root:*:19700:0:99999:7:::\n" },
      {
        path: "/var/log/syslog",
        mode: 0o644,
        owner: "syslog",
        group: "adm",
        content:
          "Nov  1 03:12:44 ws-train-01 kernel: [ 8812.441] audit: exec /tmp/.X11-cache/sysupdate uid=1000\n" +
          "Nov  1 03:12:45 ws-train-01 systemd-resolved[402]: query A beacon.update-cdn-sync.example\n" +
          "Nov  1 03:17:45 ws-train-01 systemd-resolved[402]: query A beacon.update-cdn-sync.example\n" +
          "Nov  1 03:22:45 ws-train-01 systemd-resolved[402]: query A beacon.update-cdn-sync.example\n" +
          "Nov  1 08:00:01 ws-train-01 CRON[1201]: (root) CMD (run-parts /etc/cron.hourly)\n",
      },
    ],
    processes: [
      { pid: 1, user: "root", command: "/sbin/init", start: "Oct30" },
      { pid: 402, user: "systemd+", command: "/lib/systemd/systemd-resolved", start: "Oct30" },
      { pid: 588, user: "root", command: "/usr/sbin/cron -f", start: "Oct30" },
      { pid: 601, user: "syslog", command: "/usr/sbin/rsyslogd -n", start: "Oct30" },
      { pid: 812, user: "root", command: "/usr/sbin/sshd -D", start: "Oct30" },
      { pid: 1337, user: "analyst", command: "/tmp/.X11-cache/sysupdate --quiet", cpu: 2.1, mem: 0.4, start: "Nov01" },
      { pid: 2210, user: "analyst", command: "-bash", start: "09:01" },
      { pid: 2291, user: "analyst", command: "ps aux", start: "09:14" },
    ],
    history: ["cd ~/reports", "chmod 000 incident_brief.txt", "cd ~", "ls -la", "logout"],
  },
  tasks: [
    {
      id: "reveal-hidden",
      kind: "terminal_observation",
      title: "See what ls isn't showing",
      prompt: "List your home directory in a way that reveals hidden files and directories.",
      xp: 50,
      skills: [{ skill: "linux", weight: 1 }],
      condition: { type: "listed_hidden", dir: "/home/analyst" },
      hints: [
        "On Linux, 'hidden' is a naming convention, not a security control.",
        "Hidden entries are names that start with a period. The README tells you ls is leaving something out.",
        "ls accepts an option that shows all entries, including ones starting with a period.",
        "Run `ls -a` (or `ls -la` for details) inside /home/analyst.",
      ],
      solution: "From /home/analyst run `ls -la`. The `.mentor` directory and `.bashrc` appear; plain `ls` hid them.",
      explanation:
        "`ls` hides names beginning with '.' by default to keep configuration files out of the way. Attackers exploit this habit by naming their files like configuration.",
    },
    {
      id: "mentor-flag",
      kind: "flag",
      title: "Lesson 1: the hidden note",
      prompt: "Find Dana's hidden note and submit the flag inside it.",
      xp: 100,
      skills: [{ skill: "linux", weight: 1 }],
      flags: ["CYBEROPS{dotfiles_are_not_invisible}"],
      hints: [
        "You've revealed a hidden directory. What's inside it?",
        "Hidden directories work like any other — you can cd into them or list them.",
        "Use `ls -a .mentor` or `cd .mentor`, then a command that prints a file's contents.",
        "`cat ~/.mentor/welcome.txt`",
      ],
      solution: "Run `cat ~/.mentor/welcome.txt`. The flag is CYBEROPS{dotfiles_are_not_invisible}.",
      explanation: "Hidden directories are fully usable. Searching for unexpected dot-directories is a staple of host triage.",
    },
    {
      id: "locked-report",
      kind: "flag",
      title: "Lesson 2: the locked report",
      prompt: "Dana locked a report in ~/reports. You own it. Unlock it, read it, and submit its flag.",
      xp: 150,
      skills: [{ skill: "linux", weight: 1.5 }],
      flags: ["CYBEROPS{permissions_are_a_lock_you_own}"],
      hints: [
        "'Permission denied' means the permission bits say no — not that the file is broken.",
        "Look at the report's permission string with a long listing. Who owns it, and what can the owner do?",
        "chmod changes permission bits. Because you own the file, you're allowed to change them.",
        "`chmod 600 ~/reports/incident_brief.txt` (or `chmod u+r ...`), then `cat` it.",
      ],
      solution:
        "`ls -l ~/reports` shows ---------- analyst analyst for incident_brief.txt: no one may read it, but analyst owns it. Run `chmod u+r ~/reports/incident_brief.txt` then `cat ~/reports/incident_brief.txt`.",
      explanation:
        "Permissions are enforced against everyone except root — including the owner. But ownership grants the right to change them. Mode 000 is a speed bump, not a vault.",
    },
    {
      id: "suspicious-process",
      kind: "text",
      title: "Lesson 3: the unexpected process",
      prompt: "Which program is responsible for the unexplained outbound connections? Give the full absolute path of the binary.",
      placeholder: "/path/to/binary",
      xp: 100,
      skills: [
        { skill: "linux", weight: 1 },
        { skill: "endpoint_security", weight: 1 },
        { skill: "threat_hunting", weight: 1 },
      ],
      accept: ["/tmp/.X11-cache/sysupdate"],
      caseSensitive: true,
      feedback: [
        { match: "sysupdate", message: "Right program — the question asks for its full absolute path." },
        { match: "/tmp/.X11-cache", message: "That's the directory. Which file inside it is running?" },
        { match: "/tmp/.x11-cache/sysupdate", message: "Close — Linux paths are case-sensitive. Copy it exactly as ps shows it." },
        { match: "/tmp/.X11-unix", message: ".X11-unix is a normal system directory. Look at the process list again." },
      ],
      hints: [
        "Every connection is made by some running program.",
        "List running processes and look for anything that doesn't belong — especially programs started from unusual locations.",
        "`ps aux` shows each process's command. The incident brief says to watch for /tmp.",
        "Run `ps aux` and look at PID 1337.",
      ],
      solution:
        "`ps aux` shows PID 1337 running `/tmp/.X11-cache/sysupdate --quiet`. The directory imitates the legitimate /tmp/.X11-unix and is hidden by its leading dot.",
      explanation:
        "Software installed through a package manager runs from /usr or /opt. A binary in a world-writable, hidden /tmp directory that mimics a system name is a classic persistence and evasion pattern (MITRE T1036 Masquerading, T1564.001 Hidden Files).",
    },
    {
      id: "c2-domain",
      kind: "text",
      title: "Extract the indicator",
      prompt: "Without running it, determine which domain the binary contacts. Submit the full hostname.",
      placeholder: "host.domain.example",
      xp: 125,
      requires: ["suspicious-process"],
      skills: [
        { skill: "digital_forensics", weight: 1.5 },
        { skill: "threat_hunting", weight: 1 },
      ],
      accept: ["beacon.update-cdn-sync.example"],
      feedback: [
        { match: "update-cdn-sync.example", message: "Close — submit the full hostname including the subdomain." },
        { match: "/api/v2/checkin?id=%s", message: "That's a URL path the binary requests, not the domain." },
      ],
      hints: [
        "Never execute an unknown binary to find out what it does. Static analysis comes first.",
        "Binaries are mostly unreadable bytes, but hostnames and URLs are stored as plain text inside them.",
        "`file` tells you what kind of file it is; `strings` pulls out the readable text.",
        "`strings /tmp/.X11-cache/sysupdate` — look for something shaped like a hostname. /var/log/syslog corroborates it.",
      ],
      solution:
        "`strings /tmp/.X11-cache/sysupdate` reveals `beacon.update-cdn-sync.example` alongside `/api/v2/checkin?id=%s` and `sleep_interval=300` (a 5-minute beacon). /var/log/syslog shows DNS queries for the same name every five minutes.",
      explanation:
        "`strings` is the fastest first look at an unknown binary. Hardcoded domains become IOCs you can block at DNS and hunt for across every other host.",
    },
  ],
  completionXp: 150,
  debrief: {
    summary:
      "You triaged a workstation using only built-in Linux tools: found hidden content, worked through a permission barrier, identified a masquerading process and extracted its command-and-control domain without executing it.",
    whatHappened:
      "A binary named `sysupdate` was dropped into /tmp/.X11-cache — a hidden directory chosen to resemble the legitimate /tmp/.X11-unix. It ran as the analyst user and beaconed to beacon.update-cdn-sync.example every 300 seconds.",
    whyPossible:
      "/tmp is writable by every user, hidden names don't appear in a casual `ls`, and nothing on the host was alerting on executables launched from temporary directories. Masquerading works because it exploits human pattern-matching: '.X11-cache' looks like something that belongs.",
    technicalExplanation:
      "Hidden files are a naming convention (leading '.') enforced only by tools like ls. Permission bits (rwx for user/group/other) are enforced by the kernel, but the owner can always change them with chmod. Processes expose their launching command line, so `ps` reveals the binary's location. Static analysis with `file` and `strings` identifies a binary and extracts embedded indicators safely, without execution.",
    toolsUsed: [
      { name: "ls -la", purpose: "Reveal hidden entries and permission strings" },
      { name: "chmod", purpose: "Restore read permission on a file you own" },
      { name: "ps aux", purpose: "Enumerate running processes and their command lines" },
      { name: "file", purpose: "Identify a binary's format without running it" },
      { name: "strings", purpose: "Extract printable indicators (domains, paths, user-agents)" },
    ],
    techniques: [
      { id: "T1564.001", name: "Hide Artifacts: Hidden Files and Directories", url: "https://attack.mitre.org/techniques/T1564/001/" },
      { id: "T1036", name: "Masquerading", url: "https://attack.mitre.org/techniques/T1036/" },
      { id: "T1071.001", name: "Application Layer Protocol: Web Protocols", url: "https://attack.mitre.org/techniques/T1071/001/" },
    ],
    concepts: [
      { term: "Static analysis", definition: "Examining a file without executing it. Safer and faster than running it, and often enough to extract IOCs." },
      { term: "Beacon interval", definition: "The regular cadence of C2 check-ins. Here sleep_interval=300 matched DNS queries every five minutes." },
      { term: "World-writable directory", definition: "A directory any user can create files in, such as /tmp. A common staging area for attackers." },
    ],
    defenses: [
      "Alert on process execution from /tmp, /var/tmp and /dev/shm, or mount them noexec.",
      "Block the extracted domain at DNS and search every host's DNS logs for it.",
      "Use EDR to baseline expected process paths and flag deviations.",
      "Isolate the host before removing the binary, and preserve a copy for analysis.",
    ],
    commonMistakes: [
      "Running the unknown binary 'to see what it does' — that executes the malware.",
      "Answering with the program name instead of its full path; paths are what you hunt for on other hosts.",
      "Assuming .X11-cache is legitimate because it resembles .X11-unix.",
      "Deleting the binary immediately, destroying evidence before scoping the incident.",
    ],
    resources: [
      { title: "MITRE ATT&CK: Hidden Files and Directories", publisher: "MITRE", url: "https://attack.mitre.org/techniques/T1564/001/" },
      { title: "MITRE ATT&CK: Masquerading", publisher: "MITRE", url: "https://attack.mitre.org/techniques/T1036/" },
    ],
  },
};
