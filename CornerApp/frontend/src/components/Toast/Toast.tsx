import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const toastConfig = {
  success: {
    bg: 'bg-green-500',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-500',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-500',
    icon: Info,
  },
  warning: {
    bg: 'bg-yellow-500',
    icon: AlertTriangle,
  },
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const config = toastConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md animate-slide-in`}
    >
      <Icon size={20} className="flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

