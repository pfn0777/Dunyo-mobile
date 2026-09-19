/** Round Dunyo Mobile logo, used in the top-left of the Home header per the
 * Stitch design. `public/logo.webp` is a placeholder (plain gold square) —
 * replace with the real mark before shipping. */
export function Logo({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <img
      src="/logo.webp"
      alt="Dunyo Mobile"
      width={size}
      height={size}
      className="rounded-lg object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
