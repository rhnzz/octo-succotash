type SkeletonVariant = 'card' | 'row' | 'text' | 'avatar';

type SkeletonLoaderProps = {
  variant?: SkeletonVariant;
  count?: number;
};

function SkeletonBlock({ variant }: { variant: SkeletonVariant }) {
  switch (variant) {
    case 'card':
      return (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="aspect-square bg-gray-200 animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      );
    case 'row':
      return (
        <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
      );
    case 'avatar':
      return (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      );
    case 'text':
    default:
      return (
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
        </div>
      );
  }
}

export function SkeletonLoader({ variant = 'text', count = 1 }: SkeletonLoaderProps) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} variant={variant} />
      ))}
    </div>
  );
}
