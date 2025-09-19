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
      <div className={`bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-600 min-w-[400px] max-w-[560px] overflow-hidden toast-container ${getAnimationClass()}`}>
        {/* Header with gradient background */}
        <div className={`bg-gradient-to-r ${config.bgColor} to-red-600 px-6 py-4 relative`}>
          <div className="flex items-center justify-between">
            {/* Left group: Warning icon + title */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-5 h-5 text-white flex-shrink-0" />
              <h3 className="text-lg font-semibold text-white truncate" title={title}>{title}</h3>
            </div>
            
            {/* Right: Close button */}
            <button 
              className="text-white/80 hover:text-white active:text-white/90 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent p-2 -m-2 flex-shrink-0"
              onClick={onClose}
              title="Close"
              aria-label="Close"
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
        <div className="p-0 dark:bg-gray-800">
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
  
  // Detect dark mode
  const isDarkMode = document.documentElement.classList.contains('dark') || 
                     document.documentElement.classList.contains('dark-mode') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <Toast
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      type="warning"
      position="top-right"
    >
      <div 
        className="duplicate-matches-content"
        style={{
          padding: '16px 20px',
          margin: 0
        }}
      >
        {matches.slice(0, maxDisplay).map((match, index) => (
          <div 
            key={`${match.entry_id || index}-${index}`} 
            className="duplicate-match-item"
            style={{
              padding: '12px 0',
              borderBottom: index < maxDisplay - 1 ? `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}` : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <div 
              className="duplicate-match-title"
              style={{
                fontWeight: 600,
                fontSize: '14px',
                lineHeight: 1.4,
                color: isDarkMode ? '#f9fafb' : '#111827',
                marginBottom: '4px',
                wordWrap: 'break-word'
              }}
            >
              {match.title}
            </div>
            {match.canonical_citation && (
              <div 
                className="duplicate-match-citation"
                style={{
                  fontSize: '12px',
                  lineHeight: 1.3,
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  fontWeight: 400,
                  wordWrap: 'break-word'
                }}
              >
                {match.canonical_citation}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Footer with CTA when there are more results */}
      {hasMore && onViewAll && (
        <div 
          className="duplicate-matches-footer"
          style={{
            marginTop: '16px',
            padding: '12px 20px 16px 20px',
            borderTop: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`
          }}
        >
          <button
            onClick={onViewAll}
            className="duplicate-matches-view-all"
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: isDarkMode ? '#f59e0b' : '#d97706',
              background: 'none',
              border: 'none',
              padding: '8px 0',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
              borderRadius: '4px'
            }}
            aria-label={`View all ${matches.length} matches`}
          >
            View all {matches.length} matches →
          </button>
        </div>
      )}
    </Toast>
  );
};
