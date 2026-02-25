import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ElementType;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  icon: Icon,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-inverse hover:opacity-90 focus:ring-primary border border-transparent shadow-sm",
    secondary: "bg-surface text-primary border border-border hover:border-secondary focus:ring-border",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border border-transparent shadow-sm",
    outline: "bg-transparent text-primary border border-border hover:bg-surface focus:ring-border",
    ghost: "bg-transparent text-secondary hover:text-primary hover:bg-surface focus:ring-border border border-transparent"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin mr-2" size={size === 'sm' ? 14 : 18} />
      ) : Icon ? (
        <Icon className={children ? "mr-2" : ""} size={size === 'sm' ? 14 : 18} />
      ) : null}
      {children}
    </button>
  );
};

export default Button;