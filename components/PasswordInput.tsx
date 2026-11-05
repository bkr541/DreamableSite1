'use client';

import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  leftIcon?: React.ReactNode;
};

export default function PasswordInput({ className = '', leftIcon, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`w-full pr-10 ${leftIcon ? 'pl-10' : ''} ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#767676] hover:text-[#555] focus-visible:text-[#555] focus-visible:outline-2 focus-visible:outline-[#4f6df5] transition-colors"
      >
        <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={16} color="currentColor" strokeWidth={1.75} />
      </button>
    </div>
  );
}
