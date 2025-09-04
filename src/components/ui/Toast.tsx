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
    bgColor: 'bg-yellow-600',
    iconColor: 'text-yellow-600',
    borderColor: 'border-yellow-200',
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
              className="w-8 h-8 text-white/80 hover:text-white hover:bg-white/20 rounded-lg flex items-center justify-center transition-all duration-200"
              onClick={onClose}
              title="Close notification"
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
  return (
    <Toast
      isOpen={isOpen}
      onClose={onClose}
      title="Possible Matches"
      type="warning"
      position="top-right"
    >
      <div className="space-y-6">
        {matches.slice(0, maxDisplay).map((match, index) => (
          <div key={`${match.entry_id || index}-${index}`} className="group">
            {/* Title - Large and bold */}
            <div className="font-bold text-gray-900 text-lg leading-tight mb-3">
              {match.title}
            </div>
            
            {/* Match details */}
            <div className="flex items-start gap-3">
              {/* Match indicator dot */}
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
              
              {/* Citation */}
              {match.canonical_citation && (
                <div className="text-sm text-gray-700">
                  {match.canonical_citation}
                </div>
              )}
            </div>
            
            {/* Divider between items */}
            {index < Math.min(matches.length, maxDisplay) - 1 && (
              <div className="h-px bg-gray-200 my-4"></div>
            )}
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Found {matches.length} potential match{matches.length !== 1 ? 'es' : ''}
        </div>
      </div>
    </Toast>
  );
};
