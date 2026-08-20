export function SiteFooter() {
  return (
    <footer className="border-t py-6">
      <div className="container flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CoRide</p>
        <p>Ride sharing, reimagined.</p>
      </div>
    </footer>
  );
}
