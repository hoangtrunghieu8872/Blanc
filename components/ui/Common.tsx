import React, { useState, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Check, ChevronDown } from 'lucide-react';

// Utility for merging tailwind classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2",
    lg: "h-12 px-6 text-lg",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

// Card
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div className={cn("bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden", className)} {...props}>
    {children}
  </div>
);

// Badge/Chip
export const Badge: React.FC<{ status?: string; children: React.ReactNode; className?: string }> = ({ status, children, className }) => {
  let variantStyles = "bg-slate-100 text-slate-700";

  if (status === 'OPEN') variantStyles = "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (status === 'FULL') variantStyles = "bg-amber-50 text-amber-700 border border-amber-100";
  if (status === 'CLOSED') variantStyles = "bg-slate-100 text-slate-500 border border-slate-200";

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variantStyles, className)}>
      {children}
    </span>
  );
};

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        error && "border-red-500 focus:ring-red-500",
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, error, className, children, ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <select
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none cursor-pointer",
        "bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20width%3d%2224%22%20height%3d%2224%22%20viewBox%3d%220%200%2024%2024%22%20fill%3d%22none%22%20stroke%3d%22%2364748b%22%20stroke-width%3d%222%22%20stroke-linecap%3d%22round%22%20stroke-linejoin%3d%22round%22%3e%3cpolyline%20points%3d%226%209%2012%2015%2018%209%22%3e%3c%2fpolyline%3e%3c%2fsvg%3e')] bg-size-[20px] bg-position-[right_8px_center] bg-no-repeat pr-10",
        error && "border-red-500 focus:ring-red-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// Custom Dropdown
export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  headerText?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  label,
  error,
  disabled = false,
  className,
  headerText
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-left transition-all outline-none flex items-center justify-between gap-2",
            "hover:bg-white hover:border-slate-300",
            "focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
            isOpen && "bg-white ring-2 ring-primary-500 border-primary-500",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-red-500 focus:ring-red-500",
            !disabled && "cursor-pointer"
          )}
        >
          <span className={cn(
            "truncate",
            selectedOption ? "text-slate-900" : "text-slate-400"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={cn(
            "w-4 h-4 text-slate-400 transition-transform shrink-0",
            isOpen && "rotate-180"
          )} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {headerText && (
              <div className="p-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">{headerText}</p>
              </div>
            )}
            <div className="max-h-[280px] overflow-y-auto p-2">
              {options.map(option => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all flex items-center justify-between group",
                      isSelected
                        ? "bg-primary-50 text-primary-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.color && (
                        <span className={cn("w-2 h-2 rounded-full", option.color)} />
                      )}
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

// Tabs
export const Tabs: React.FC<{ tabs: string[]; activeTab: string; onChange: (tab: string) => void }> = ({ tabs, activeTab, onChange }) => (
  <div className="border-b border-slate-200 mb-6">
    <nav className="-mb-px flex space-x-8 overflow-x-auto no-scrollbar" aria-label="Tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors",
            activeTab === tab
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          )}
        >
          {tab}
        </button>
      ))}
    </nav>
  </div>
);

// Skeleton Loading
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("animate-pulse bg-slate-200 rounded", className)} />
);

// Skeleton Card
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <Card className="p-4 space-y-3">
    <Skeleton className="h-4 w-3/4" />
    {Array.from({ length: lines - 1 }).map((_, i) => (
      <Skeleton key={i} className="h-3 w-full" />
    ))}
  </Card>
);

// Avatar with fallback
interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name = 'User', size = 'md', className }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

  return (
    <img
      src={src || fallbackUrl}
      alt={`Avatar of ${name}`}
      className={cn('rounded-full object-cover border border-slate-200', sizes[size], className)}
      onError={(e) => {
        (e.target as HTMLImageElement).src = fallbackUrl;
      }}
    />
  );
};

// Empty State
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="text-center py-12">
    {icon && <div className="mx-auto mb-4 text-slate-300">{icon}</div>}
    <h3 className="text-lg font-medium text-slate-900 mb-2">{title}</h3>
    {description && <p className="text-slate-500 mb-4">{description}</p>}
    {action}
  </div>
);

// Tooltip
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div className={cn(
        'absolute z-50 px-2 py-1 text-xs text-white bg-slate-900 rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all',
        positions[position]
      )}>
        {content}
      </div>
    </div>
  );
};

// Progress Bar
interface ProgressProps {
  value: number;
  max?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({ value, max = 100, color = 'primary', showLabel }) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const colors = {
    primary: 'bg-primary-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        {showLabel && <span className="text-sm text-slate-700">{Math.round(percentage)}%</span>}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', colors[color], `w-[${Math.min(100, Math.max(0, percentage))}%]`)}
        />
      </div>
    </div>
  );
};