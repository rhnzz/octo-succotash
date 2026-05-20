'use client';

import { useState } from 'react';

type RatingStarsProps = {
  rating: number;
  maxRating?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_MAP: Record<string, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

function StarIcon({ filled, partial, size, className }: {
  filled: boolean;
  partial: number;
  size: string;
  className?: string;
}) {
  if (!partial || partial >= 1) {
    return (
      <svg className={`${size} ${filled ? 'text-yellow-400' : 'text-gray-200'} ${className ?? ''}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    );
  }

  return (
    <span className={`relative inline-block ${size}`}>
      <svg className={`${size} text-gray-200`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${partial * 100}%` }}>
        <svg className={`${size} text-yellow-400`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </span>
    </span>
  );
}

export function RatingStars({
  rating,
  maxRating = 5,
  interactive = false,
  onRate,
  size = 'sm',
}: RatingStarsProps) {
  const [hovered, setHovered] = useState(0);
  const starSize = SIZE_MAP[size] ?? SIZE_MAP.sm;

  if (interactive && onRate) {
    return (
      <span className="inline-flex items-center gap-0.5" role="radiogroup" aria-label="Beri rating">
        {Array.from({ length: maxRating }, (_, i) => {
          const star = i + 1;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star <= hovered}
              aria-label={`${star} dari ${maxRating} bintang`}
              onClick={() => onRate(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="focus:outline-none"
            >
              <StarIcon filled={star <= (hovered || Math.round(rating))} partial={1} size={starSize} className="cursor-pointer" />
            </button>
          );
        })}
        <span className="ml-1 text-xs text-gray-500">{rating.toFixed(1)}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: maxRating }, (_, i) => {
        const star = i + 1;
        const diff = rating - (star - 1);
        const filled = diff >= 1;
        const partial = diff > 0 && diff < 1 ? diff : 0;
        return <StarIcon key={star} filled={filled} partial={partial} size={starSize} />;
      })}
      <span className="ml-1 text-xs text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
}
