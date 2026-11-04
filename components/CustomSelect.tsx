'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

interface CustomSelectProps {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export default function CustomSelect({ id, value, options, onChange }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(options[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between gap-2 bg-white/60 rounded-xl px-4 py-3 text-left text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 border border-[#D0D0D0] transition-all cursor-pointer"
      >
        <span className="truncate">{value}</span>
<HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          color="currentColor"
          strokeWidth={2}
          className={`shrink-0 text-[#999] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-2 z-30 max-h-64 overflow-auto rounded-xl bg-white border border-[#E5E5E5] shadow-lg p-1.5"
          >
            {options.map((option, i) => {
              const isSelected = option === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={option}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(option)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${isActive ? 'bg-[#eef2ff]' : ''} ${isSelected ? 'text-[#1a2030] font-medium' : 'text-[#555]'}`}
                >
                  <span className="truncate">{option}</span>
                  {isSelected && (
                    <HugeiconsIcon icon={Tick02Icon} size={14} color="currentColor" strokeWidth={2.5} className="shrink-0 text-[#1a2030]" />
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
