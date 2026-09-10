import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterSelectProps {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  value, onChange, placeholder, options
}) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalcular posición al hacer scroll o resize
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  };

  const selected = options.find(o => o.value === value);
  const isActive = !!value;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider
          border transition-all duration-200 whitespace-nowrap select-none
          ${isActive
            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-400 hover:text-slate-900 dark:hover:text-white'
          }
        `}
      >
        <span>{selected ? selected.label.replace(/_/g, ' ') : placeholder}</span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''} ${isActive ? 'text-white/80' : 'text-slate-400'}`}
        />
      </button>

      {open && rect && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 8,
            left: rect.left,
            zIndex: 9999,
            minWidth: Math.max(rect.width, 200),
          }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
        >
          {/* Opción "todos" */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors
              ${!value
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            {placeholder}
          </button>
          <div className="border-t border-slate-100 dark:border-slate-700 max-h-56 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-[11px] uppercase tracking-wider transition-colors
                  ${value === opt.value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold'
                  }`}
              >
                {opt.label.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
