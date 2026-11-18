import React, { useEffect, useId, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSafeLogoUrl } from '../services/jellyfinApi';

interface BrandLogoProps {
  className?: string;
  iconSize?: number;
  showText?: boolean;
  textClassName?: string;
  appNameOverride?: string;
  logoUrlOverride?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  iconSize = 32,
  showText = true,
  textClassName = 'text-xl font-extrabold tracking-tight text-white',
  appNameOverride,
  logoUrlOverride,
}) => {
  const { brand } = useAuth();
  const gradId = useId();
  const [imgFailed, setImgFailed] = useState(false);

  const effectiveName = (appNameOverride ?? brand.appName).trim() || brand.appName;
  const rawLogo = logoUrlOverride !== undefined ? logoUrlOverride.trim() : brand.logoUrl;
  const effectiveLogoUrl = isSafeLogoUrl(rawLogo) ? rawLogo : '';

  useEffect(() => {
    setImgFailed(false);
  }, [effectiveLogoUrl]);

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {effectiveLogoUrl && !imgFailed ? (
        <img
          src={effectiveLogoUrl}
          alt={effectiveName}
          onError={() => setImgFailed(true)}
          style={{ width: iconSize, height: iconSize }}
          className="shrink-0 object-contain rounded-md"
        />
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0 drop-shadow-[0_2px_10px_rgba(0,164,220,0.35)]"
        >
          <defs>
            <linearGradient id={gradId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#AA5CC3" />
              <stop offset="100%" stopColor="#00A4DC" />
            </linearGradient>
          </defs>
          <rect x="6" y="10" width="52" height="44" rx="14" stroke={`url(#${gradId})`} strokeWidth="5" />
          <path
            d="M25 22.5C25 20.8 26.9 19.7 28.4 20.6L43.4 29.9C44.8 30.8 44.8 32.8 43.4 33.7L28.4 43C26.9 43.9 25 42.8 25 41.1V22.5Z"
            fill={`url(#${gradId})`}
          />
          <path
            d="M14 26V38"
            stroke={`url(#${gradId})`}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {showText && <span className={textClassName}>{effectiveName}</span>}
    </div>
  );
};
