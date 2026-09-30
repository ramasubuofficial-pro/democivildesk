import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Check, AlertTriangle, Info, CheckCircle2, ShieldAlert, 
  ExternalLink, ArrowRight, Bell 
} from 'lucide-react';
import { useNotifications, getNotificationPriority, formatNotificationTime } from '../../features/notifications/context/NotificationContext';

export function NotificationToaster() {
  const { activeToasts, dismissToast, markAsRead } = useNotifications();
  const navigate = useNavigate();

  if (!activeToasts || activeToasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none font-['Manrope',sans-serif]"
      aria-live="polite"
    >
      {activeToasts.map((toast) => {
        const priority = getNotificationPriority(toast);

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-4 transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in hover:shadow-xl relative overflow-hidden"
            style={{
              borderLeft: `4px solid ${priority.color}`
            }}
          >
            {/* Top row: Priority badge + timestamp + close button */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                  style={{
                    backgroundColor: priority.bg,
                    color: priority.color,
                    border: `1px solid ${priority.border}`
                  }}
                >
                  {priority.label}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {formatNotificationTime(toast.created_at)}
                </span>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-[#061A33] mb-1 leading-snug">
              {toast.title}
            </h4>

            {/* Description */}
            {toast.message && (
              <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                {toast.message}
              </p>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
              {toast.action_url ? (
                <button
                  onClick={() => {
                    markAsRead(toast.id);
                    navigate(toast.action_url);
                  }}
                  className="text-xs font-bold text-[#0056C9] hover:underline flex items-center gap-1"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[10px] text-gray-400 font-semibold uppercase">
                  {toast.source_module || 'System Alert'}
                </span>
              )}

              <button
                onClick={() => markAsRead(toast.id)}
                className="text-[11px] font-semibold text-gray-600 hover:text-[#0056C9] flex items-center gap-1 px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 transition"
              >
                <Check className="w-3 h-3 text-[#10B981]" />
                <span>Mark Read</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
