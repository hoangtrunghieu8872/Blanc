import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// Utility function for className merging
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}

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
    size?: 'sm' | 'md' | 'lg';
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
    headerText,
    size = 'md'
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

    const sizeStyles = {
        sm: 'px-3 py-2 text-xs',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-4 py-3 text-base'
    };

    return (
        <div className={cn("w-full", className)}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            )}
            <div ref={dropdownRef} className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={cn(
                        "w-full bg-gray-50 border border-gray-200 rounded-xl text-left transition-all outline-none flex items-center justify-between gap-2",
                        sizeStyles[size],
                        "hover:bg-white hover:border-gray-300",
                        "focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500",
                        isOpen && "bg-white ring-2 ring-emerald-500 border-emerald-500",
                        disabled && "opacity-50 cursor-not-allowed",
                        error && "border-red-500 focus:ring-red-500",
                        !disabled && "cursor-pointer"
                    )}
                >
                    <div className="flex items-center gap-2.5 truncate">
                        {selectedOption?.color && (
                            <span className={cn("w-2 h-2 rounded-full shrink-0", selectedOption.color)} />
                        )}
                        {selectedOption?.icon}
                        <span className={cn(
                            "truncate",
                            selectedOption ? "text-gray-900" : "text-gray-400"
                        )}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    </div>
                    <ChevronDown className={cn(
                        "w-4 h-4 text-gray-400 transition-transform shrink-0",
                        isOpen && "rotate-180"
                    )} />
                </button>

                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden animate-fade-in-up drop-shadow-2xl">
                        {headerText && (
                            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{headerText}</p>
                            </div>
                        )}
                        <div className="max-h-[280px] overflow-y-auto p-1.5 bg-white">
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
                                                ? "bg-emerald-50 text-emerald-700 font-medium"
                                                : "text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {option.color && (
                                                <span className={cn("w-2 h-2 rounded-full shrink-0", option.color)} />
                                            )}
                                            {option.icon}
                                            <span>{option.label}</span>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
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

export default Dropdown;
