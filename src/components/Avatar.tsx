import { initials } from "@/lib/format";

export function Avatar({ name, photoUrl, large }: { name: string; photoUrl?: string | null; large?: boolean }) {
  const cls = `avatar${large ? " avatar-lg" : ""}`;
  // eslint-disable-next-line @next/next/no-img-element
  if (photoUrl) return <img className={cls} src={photoUrl} alt="" />;
  return <span className={cls} aria-hidden="true">{initials(name)}</span>;
}
