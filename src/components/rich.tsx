/** Renders `backtick` spans in authored content as inline code. No HTML is ever interpreted. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className="data px-1 py-px rounded-[3px] bg-term text-ink">{p.slice(1, -1)}</code>
        ) : (
          p
        ),
      )}
    </>
  );
}
