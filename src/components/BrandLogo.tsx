import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md' }) => {
  const heightClass = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14' : 'h-10';

  return (
    <div className={`inline-flex items-center select-none ${heightClass}`}>
      <svg
        viewBox="0 0 210 78"
        className="h-full w-auto drop-shadow-[0_2px_10px_rgba(6,182,212,0.35)]"
        aria-label="AD78"
      >
        <path
          d="M28 42 C34 12, 72 4, 105 4 C138 4, 176 12, 182 42 L196 47 L186 72 L24 72 L14 47 Z"
          fill="#0b1f3a"
          stroke="#06b6d4"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path d="M46 40 A59 59 0 0 1 82 14" fill="none" stroke="#ec4899" strokeWidth="8" />
        <path d="M84 13 A59 59 0 0 1 126 13" fill="none" stroke="#06b6d4" strokeWidth="8" />
        <path d="M128 14 A59 59 0 0 1 164 40" fill="none" stroke="#facc15" strokeWidth="8" />
        <polygon points="105,37 122,19 109,40" fill="#ffffff" />
        <circle cx="105" cy="39" r="5" fill="#e2e8f0" />
        <text
          x="105"
          y="64"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="Plus Jakarta Sans, sans-serif"
          fontWeight="800"
          fontSize="27"
          letterSpacing="3"
        >
          AD78
        </text>
      </svg>
    </div>
  );
};
