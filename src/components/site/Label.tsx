/** Liten etikett med punkt, används som sektionsrubrik. */
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-[13px] leading-none text-ink ${className}`}>
      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-current" />
      {children}
    </p>
  );
}
