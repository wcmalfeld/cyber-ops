"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/", label: "Mission Control" },
  { href: "/paths", label: "Training Paths" },
  { href: "/dossiers", label: "Breach Dossiers" },
  { href: "/industry", label: "Industry Labs" },
  { href: "/labs", label: "Technical Labs" },
  { href: "/soc", label: "SOC Operations" },
  { href: "/skills", label: "Skill Profile" },
  { href: "/career", label: "Career Center" },
];

export function Nav({ footer }: { footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/paths" && path.startsWith("/missions")));
  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-rule bg-panel sticky top-0 z-30">
        <Link href="/" className="font-semibold tracking-tight">CYBER OPS</Link>
        <button className="btn btn-quiet" aria-expanded={open} aria-controls="primary-nav" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <nav
        id="primary-nav"
        aria-label="Primary"
        className={`${open ? "block" : "hidden"} lg:flex lg:flex-col fixed lg:sticky top-14 lg:top-0 inset-x-0 lg:inset-auto z-20 lg:h-dvh w-full lg:w-60 shrink-0 bg-panel border-r border-rule`}
      >
        <Link href="/" className="hidden lg:block px-5 pt-6 pb-5">
          <span className="block font-semibold tracking-tight">CYBER OPS</span>
          <span className="block t-micro text-muted">Colorado training ground</span>
        </Link>
        <ul className="px-2 py-2 lg:py-0 space-y-0.5 flex-1">
          {ITEMS.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={active(i.href) ? "page" : undefined}
                className={`block px-3 py-2 rounded-[4px] t-small ${active(i.href) ? "bg-raised text-ink border-l-2 border-teal" : "text-muted hover:text-ink hover:bg-raised/60"}`}
              >
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-rule p-4">{footer}</div>
      </nav>
    </>
  );
}
