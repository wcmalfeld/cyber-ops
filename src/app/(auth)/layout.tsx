import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-term border-r border-rule">
        <p className="font-semibold tracking-tight">CYBER OPS: Colorado</p>
        <pre aria-hidden="true" className="data text-muted leading-relaxed whitespace-pre-wrap">
{`analyst@ws-train-01:~$ ls -la
drwx------ analyst  .mentor
-rw-r--r-- analyst  README.txt
analyst@ws-train-01:~$ ps aux | grep tmp
analyst  1337  /tmp/.X11-cache/sysupdate --quiet
analyst@ws-train-01:~$ strings /tmp/.X11-cache/sysupdate | grep example
beacon.update-cdn-sync.example`}
          <span className="text-teal">{"\nanalyst@ws-train-01:~$ "}</span>
        </pre>
        <div className="prose-measure">
          <p className="t-h2">Learn cybersecurity by doing cybersecurity.</p>
          <p className="text-muted mt-2">
            Investigate simulated incidents with real techniques, check your reasoning against the evidence, and finish every mission knowing why it happened.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
