'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}

/** Labeled on/off switch used across the admin portal. */
export default function Toggle({ checked, onChange, label, id, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm font-medium text-[#555] hover:text-[#1a2030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#1a2030]' : 'bg-[#D0D0D0]'}`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
      {label}
    </button>
  );
}
