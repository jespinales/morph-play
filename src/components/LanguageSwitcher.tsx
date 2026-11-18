import React from 'react';
import { Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Locale } from '../i18n/translations';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { locale, setLocale, t } = useAuth();

  const options: Array<{ code: Locale; short: string; label: string }> = [
    { code: 'es', short: 'ES', label: t.language.spanish },
    { code: 'en', short: 'EN', label: t.language.english },
  ];

  return (
    <div
      role="group"
      aria-label={t.language.switcherAria}
      className="inline-flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1"
    >
      {!compact && <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-0.5 shrink-0" />}
      {options.map((opt) => {
        const active = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLocale(opt.code)}
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
