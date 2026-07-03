import { initials } from "@/lib/format";

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
};

export function Avatar({
  name,
  color = "#6f53f5",
  avatarUrl = null,
  size = "md",
  className = "",
}: {
  name?: string | null;
  color?: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // Custom photo upload was removed — only the ready-made preset avatars
  // (/avatars/preset-N.svg) are honoured. Any legacy uploaded-photo URLs are
  // ignored, so those profiles fall back to their coloured initials.
  const isPreset = typeof avatarUrl === "string" && avatarUrl.startsWith("/avatars/preset-");
  if (isPreset) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl as string}
        alt={name ?? "Avatar"}
        className={`inline-block shrink-0 rounded-full object-cover ${SIZES[size]} ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${SIZES[size]} ${className}`}
      style={{ backgroundColor: color }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
