"use client";

import { Check } from "lucide-react";

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
}

export function CustomCheckbox({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = "",
  name,
}: CustomCheckboxProps) {
  const inputId = id || (name ? `cb-${name}` : undefined);

  return (
    <label
      htmlFor={inputId}
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-texto transition ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:text-acento"
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          id={inputId}
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />

        {/* Caixa Visual do Checkbox Customizado */}
        <div
          className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border-2 transition-all duration-200 shadow-xs ${
            checked
              ? "border-acento bg-acento text-white"
              : "border-borda bg-fundo hover:border-acento/60 peer-focus-visible:ring-2 peer-focus-visible:ring-acento/30"
          }`}
        >
          <Check
            className={`h-3 w-3 stroke-[3] transition-transform duration-150 ${
              checked ? "scale-100 opacity-100" : "scale-0 opacity-0"
            }`}
          />
        </div>
      </div>

      {label && <span className="leading-tight">{label}</span>}
    </label>
  );
}
