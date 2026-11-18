import React from 'react';
import { Globe } from 'lucide-react';
import { Locale } from '../i18n/translations';

interface LanguageSwitcherProps {
  locale: Locale;
  onChange: (next: Locale) => void;
  ariaLabel: string;
  labels?: { es: string; en: string };
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  locale,
  onChange,
  ariaLabel,
  labels = { es: 'Español', en: 'English' },
  compact = false,
}) => {
  const options: Array<{ code: Locale; short: string; label: string }> = [
    { code: 'es', short: 'ES', label: labels.es },
    { code: 'en', short: 'EN', label: labels.en },
  ];

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1"
    >
      {!compact && <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-0.5 shrink-0" />}
      {options.map((opt) => {
        const active = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => onChange(opt.code)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              active
                ? 'bg-[#00A4DC] text-white shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-white/10'
            }`}
          >
            {compact ? opt.short : opt.label}
          </button>
        );
      })}
    </div>
  );
};
