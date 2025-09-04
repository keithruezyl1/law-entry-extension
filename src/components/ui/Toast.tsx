import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import './Toast.css';

export interface ToastProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'warning' | 'success' | 'error';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  duration?: number;
  className?: string;
}

const toastConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-600',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-600',
    iconColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-600',
    iconColor: 'text-green-600',
    borderColor: 'border-green-200',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-600',
    iconColor: 'text-red-600',
    borderColor: 'border-red-200',
  },
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
};

export const Toast: React.FC<ToastProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type = 'info',
  position = 'top-right',
  duration = 0,
  className = '',
}) => {
  const config = toastConfig[type];
  const Icon = config.icon;
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (duration > 0 && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      
      // Progress bar animation
      const progressTimer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);
      
      return () => {
        clearTimeout(timer);
        clearInterval(progressTimer);
      };
    } else {
      setProgress(100);
    }
  }, [duration, isOpen, onClose]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getAnimationClass = () => {
    switch (position) {
      case 'top-left':
        return 'toast-enter-left';
      case 'top-center':
        return 'toast-enter-center';
      default:
        return 'toast-enter';
    }
  };

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={`bg-white shadow-2xl rounded-xl border border-gray-200 min-w-[380px] max-w-[520px] overflow-hidden toast-container ${getAnimationClass()}`}>
        {/* Header with gradient background */}
        <div className={`bg-gradient-to-r ${config.bgColor} to-red-600 px-6 py-4 relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
            <button 
              className="w-8 h-8 text-white/80 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30"
              onClick={onClose}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Progress bar for auto-dismiss */}
          {duration > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div 
                className="h-full bg-white/60 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Specialized Toast for duplicate matches
export interface DuplicateMatchesToastProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Array<{
    title: string;
    type: string;
    canonical_citation?: string;
    entry_id?: string;
    similarity?: number;
  }>;
  maxDisplay?: number;
  onViewAll?: () => void;
}

export const DuplicateMatchesToast: React.FC<DuplicateMatchesToastProps> = ({
  isOpen,
  onClose,
  matches,
  maxDisplay = 5,
  onViewAll,
}) => {
  console.log('🔄 DuplicateMatchesToast rendered with NEW design!', { matches: matches.length, isOpen });
  const displayCount = Math.min(matches.length, maxDisplay);
  const hasMore = matches.length > maxDisplay;
  const titleText = matches.length === 1 ? "Possible match" : `Possible matches (${matches.length})`;

  return (
    <Toast
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      type="warning"
      position="top-right"
    >
      <div className="space-y-3">
        {matches.slice(0, maxDisplay).map((match, index) => (
          <div 
            key={`${match.entry_id || index}-${index}`} 
            className="group p-3 rounded-lg hover:bg-amber-50 focus-within:bg-amber-50 focus-within:ring-2 focus-within:ring-amber-200 focus-within:ring-offset-1 transition-all duration-150 cursor-pointer"
            tabIndex={0}
            role="button"
            aria-label={`View details for ${match.title}`}
          >
            {/* Primary line: Entry title */}
            <div className="font-medium text-gray-900 text-sm leading-snug mb-1 line-clamp-2">
              {match.title}
            </div>
            
            {/* Secondary line: Citation */}
            {match.canonical_citation && (
              <div className="text-xs text-gray-600 leading-relaxed">
                {match.canonical_citation}
              </div>
            )}
            
            {/* Trailing chevron */}
            <div className="flex justify-end mt-2">
              <svg 
                className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer with CTA when there are more results */}
      {hasMore && onViewAll && (
        <div className="mt-4 pt-3 border-t border-amber-200">
          <button
            onClick={onViewAll}
            className="w-full text-center text-sm font-medium text-amber-700 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-1 rounded-md py-2 transition-colors duration-150"
            aria-label={`View all ${matches.length} matches`}
          >
            View all {matches.length} matches →
          </button>
        </div>
      )}
    </Toast>
  );
};
