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
  size = "md",
  className = "",
}: {
  name?: string | null;
  color?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full font-semibold text-white ${SIZES[size]} ${className}`}
      style={{ backgroundColor: color }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
