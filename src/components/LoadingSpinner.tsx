type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
};

const SIZE_MAP: Record<string, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-12 w-12 border-4',
};

export function LoadingSpinner({ size = 'md', color }: LoadingSpinnerProps) {
  const borderColor = color ?? 'border-(--color-primary)';
  const dimension = SIZE_MAP[size] ?? SIZE_MAP.md;

  return (
    <div
      className={`animate-spin rounded-full ${dimension} ${borderColor} border-t-transparent`}
      role="status"
      aria-label="Memuat"
    />
  );
}
