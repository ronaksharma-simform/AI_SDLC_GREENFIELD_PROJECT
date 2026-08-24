import { cn } from '@/lib/utils';

/**
 * Route-line motif — the signature "Commute Gradient" detail.
 *
 * A gradient line with a dot at each end representing source → destination.
 * Built with plain flex rows (no SVG ids) so it can be reused freely across
 * server and client components without id collisions. It appears wherever a
 * literal route or connection exists: Ride Creation preview, Ride Feed cards,
 * Ride Detail, My Requests, Incoming Requests, and the Chat header. It is
 * intentionally absent on vehicle pages, auth pages, and notifications.
 *
 * Variants:
 *   - `dashed`   → animated brand-coloured dashes (the "route line" motif)
 *   - `skeleton` → muted, pulsing grayscale dashes (loading placeholders)
 *   - default    → solid gradient line
 */
interface RouteLineProps {
  source?: string;
  destination?: string;
  size?: 'sm' | 'md' | 'lg';
  dashed?: boolean;
  skeleton?: boolean;
  className?: string;
}

const SIZES = {
  sm: { dot: 'h-2 w-2', line: 'h-0.5', label: 'text-[11px]', gap: 'gap-1.5' },
  md: { dot: 'h-2.5 w-2.5', line: 'h-[3px]', label: 'text-xs', gap: 'gap-2' },
  lg: { dot: 'h-3.5 w-3.5', line: 'h-1', label: 'text-sm', gap: 'gap-2.5' }
} as const;

export function RouteLine({
  source,
  destination,
  size = 'md',
  dashed = false,
  skeleton = false,
  className
}: RouteLineProps) {
  const s = SIZES[size];
  const hasLabels = Boolean(source || destination);
  const lineClass = skeleton ? 'route-line-skeleton' : dashed ? 'route-line-dashed' : 'route-line';

  return (
    <div
      className={cn('flex w-full flex-col', s.gap, className)}
      role={hasLabels ? 'img' : undefined}
      aria-label={
        hasLabels ? `Route from ${source ?? 'origin'} to ${destination ?? 'destination'}` : undefined
      }
    >
      <div className={cn('flex w-full items-center', s.gap)}>
        <span
          className={cn('shrink-0 rounded-full bg-primary shadow-sm shadow-primary/30', s.dot)}
          aria-hidden="true"
        />
        <span className={cn('min-w-0 flex-1 rounded-full', s.line, lineClass)} aria-hidden="true" />
        <span
          className={cn('shrink-0 rounded-full bg-coral shadow-sm shadow-coral/30', s.dot)}
          aria-hidden="true"
        />
      </div>
      {hasLabels ? (
        <div className={cn('flex w-full items-center justify-between gap-3', s.label)}>
          <span className="truncate font-medium text-foreground">{source}</span>
          <span className="truncate text-right font-medium text-foreground">{destination}</span>
        </div>
      ) : null}
    </div>
  );
}
