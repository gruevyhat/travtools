import type { FocusEventHandler, KeyboardEventHandler, ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

type NumberStepperProps = {
  id?: string;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
};

type StepControlProps = {
  label: string;
  title: string;
  disabled: boolean;
  className: string;
  onPress: () => void;
  children: ReactNode;
};

function asNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === '+' || trimmed === '-' || trimmed === '.') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimals(value: number | string): number {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function formatStepValue(value: number, step: number | string): string {
  const places = decimals(step);
  if (places === 0) return String(Math.trunc(value));
  return Number(value.toFixed(places)).toString();
}

function StepControl({ label, title, disabled, className, onPress, children }: StepControlProps) {
  function activate() {
    if (!disabled) onPress();
  }

  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      title={title}
      aria-disabled={disabled}
      onClick={activate}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      className={`${className} ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </span>
  );
}

export default function NumberStepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  ariaLabel = 'numeric value',
  disabled = false,
  className = '',
  inputClassName = 'input',
  buttonClassName = '',
  onKeyDown,
  onBlur,
}: NumberStepperProps) {
  const stepNumber = Number(step);
  const normalizedStep = Number.isFinite(stepNumber) && stepNumber > 0 ? stepNumber : 1;
  const current = asNumber(value);
  const stepBase = current ?? min ?? 0;
  const canDecrease = !disabled && (min === undefined || stepBase > min);
  const canIncrease = !disabled && (max === undefined || stepBase < max);
  const isDecimal = decimals(step) > 0 || String(value ?? '').includes('.');

  function stepBy(delta: number) {
    const nextRaw = stepBase + delta * normalizedStep;
    const nextMin = min === undefined ? nextRaw : Math.max(min, nextRaw);
    const next = max === undefined ? nextMin : Math.min(max, nextMin);
    onChange(formatStepValue(next, step));
  }

  return (
    <div className={`grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] ${className}`}>
      <StepControl
        label="Decrease value"
        title={`Decrease ${ariaLabel}`}
        disabled={!canDecrease}
        onPress={() => stepBy(-1)}
        className={`border border-steel bg-panel text-body hover:border-amber hover:text-amber disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center ${buttonClassName}`}
      >
        <Minus size={11} />
      </StepControl>
      <input
        id={id}
        aria-label={ariaLabel}
        className={`${inputClassName} rounded-none text-center`}
        type="text"
        inputMode={isDecimal ? 'decimal' : 'numeric'}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <StepControl
        label="Increase value"
        title={`Increase ${ariaLabel}`}
        disabled={!canIncrease}
        onPress={() => stepBy(1)}
        className={`border border-steel bg-panel text-body hover:border-amber hover:text-amber disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center ${buttonClassName}`}
      >
        <Plus size={11} />
      </StepControl>
    </div>
  );
}
