export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 py-6">
      {/* Brand gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 w-full bg-gradient-brand" aria-hidden="true" />
      <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CoRide</p>
        <p>
          Ride sharing, <span className="text-gradient-brand">reimagined.</span>
        </p>
      </div>
    </footer>
  );
}
