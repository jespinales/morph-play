import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  id: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon?: React.ReactNode;
  highlightActive?: boolean;
  className?: string;
}

/**
 * Uniform dark-themed custom select dropdown with consistent dimensions across filter bars.
 */
export const FilterSelect: React.FC<FilterSelectProps> = ({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  highlightActive = true,
  className = 'w-[calc(50%-0.3125rem)] sm:w-auto sm:max-w-[240px]',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];
  const isFiltered = highlightActive && value !== '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`w-full h-10 px-2.5 sm:px-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC] ${
          isFiltered
            ? 'bg-[#00A4DC]/15 border-[#00A4DC]/60 text-white'
            : open
              ? 'bg-[#181a24] border-[#00A4DC] text-white'
              : 'bg-[#12131a] border-white/10 hover:border-white/25 text-zinc-100'
        }`}
      >
        {icon && (
          <span className={`shrink-0 ${isFiltered ? 'text-[#7dd3fc]' : 'text-zinc-400'}`}>
            {icon}
          </span>
        )}
        <span className="flex-1 min-w-0 truncate text-left">
          {selectedOption?.label ?? ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
            open ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-1.5 z-40 sm:min-w-full sm:w-max sm:max-w-[280px] max-h-64 overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.85)] animate-fadeIn"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value || '__empty__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2.5 transition-colors ${
                  isSelected
                    ? 'bg-[#00A4DC]/20 text-[#7dd3fc] font-semibold'
                    : 'text-zinc-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#00A4DC]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
