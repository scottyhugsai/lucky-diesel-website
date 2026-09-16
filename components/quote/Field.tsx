interface FieldProps {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function inputClass(error?: string): string {
  return [
    'h-13 w-full rounded-sm border bg-carbon px-4 text-base text-chalk placeholder:text-steel/60',
    'transition-colors duration-150 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30',
    error ? 'border-danger' : 'border-line hover:border-chalk/30',
  ].join(' ');
}

export function Field({ id, label, error, optional = false, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={`field-${id}`} className="mb-2 flex items-baseline justify-between text-sm font-semibold text-chalk/85">
        {label}
        {optional && <span className="text-xs font-normal text-steel">Optional</span>}
      </label>
      {children}
      {error && (
        <p id={`error-${id}`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
