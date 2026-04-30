'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBBBBB] hover:text-[#555] transition-colors"
      >
        {visible ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
