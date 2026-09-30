import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Check, CheckCheck, ExternalLink, Clock, AlertTriangle, 
  Info, CheckCircle2, ShieldAlert, Sparkles, X, ChevronRight 
} from 'lucide-react';
import { useNotifications, getNotificationPriority, formatNotificationTime } from '../../features/notifications/context/NotificationContext';

export function NotificationDropdown({ onClose }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'priority'
  const navigate = useNavigate();

  const filteredNotifications = notifications.filter(item => {
    const isUnread = !item.is_read || item.is_read === 0 || item.is_read === '0';
    if (filter === 'unread') return isUnread;
    if (filter === 'priority') {
      const p = getNotificationPriority(item);
      return p.label === 'CRITICAL' || p.label === 'HIGH';
    }
    return true;
  });

  const handleActionClick = (notification, e) => {
    e.stopPropagation();
    markAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
      if (onClose) onClose();
    }
  };

  return (
    <div 
      className="w-[380px] sm:w-[420px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-[#061A33] font-['Manrope',sans-serif]"
      onClick={e => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="p-4 border-b border-gray-100 bg-[#061A33] text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#EF4444] rounded-full ring-2 ring-[#061A33]"></span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0056C9] text-white">
                  {unreadCount} new
                </span>
              )}
            </h3>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition font-medium"
            title="Mark all as read"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center px-4 pt-2 border-b border-gray-100 bg-gray-50/70 text-xs font-semibold">
        <button
          onClick={() => setFilter('all')}
          className={`pb-2 mr-4 border-b-2 transition-colors ${
            filter === 'all' 
              ? 'border-[#0056C9] text-[#0056C9]' 
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`pb-2 mr-4 border-b-2 transition-colors ${
            filter === 'unread' 
              ? 'border-[#0056C9] text-[#0056C9]' 
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('priority')}
          className={`pb-2 border-b-2 transition-colors ${
            filter === 'priority' 
              ? 'border-[#0056C9] text-[#0056C9]' 
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Priority
        </button>
      </div>

      {/* NOTIFICATION LIST */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((item) => {
            const isUnread = !item.is_read || item.is_read === 0 || item.is_read === '0';
            const priority = getNotificationPriority(item);

            return (
              <div
                key={item.id}
                onClick={() => isUnread && markAsRead(item.id)}
                className={`p-4 transition-colors relative group cursor-pointer ${
                  isUnread ? 'bg-[#0056C9]/[0.04] hover:bg-[#0056C9]/[0.08]' : 'hover:bg-gray-50'
                }`}
              >
                {/* Unread Accent Dot */}
                {isUnread && (
                  <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-[#0056C9]"></span>
                )}

                <div className="flex items-start justify-between gap-2 mb-1.5 pl-1">
                  {/* Priority Badge */}
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

                  {/* Timestamp */}
                  <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium ml-auto">
                    <Clock className="w-3 h-3 text-gray-400" />
                    {formatNotificationTime(item.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h4 className={`text-sm mb-1 leading-snug pl-1 ${
                  isUnread ? 'font-bold text-[#061A33]' : 'font-semibold text-gray-700'
                }`}>
                  {item.title}
                </h4>

                {/* Description / Message */}
                {item.message && (
                  <p className="text-xs text-gray-600 leading-relaxed pl-1 mb-2.5 line-clamp-3">
                    {item.message}
                  </p>
                )}

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between pt-1 pl-1 text-xs">
                  {item.action_url ? (
                    <button
                      onClick={(e) => handleActionClick(item, e)}
                      className="text-xs font-bold text-[#0056C9] hover:underline flex items-center gap-1"
                    >
                      <span>Take Action</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400 font-medium">
                      {item.source_module || 'System'}
                    </span>
                  )}

                  {isUnread && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(item.id);
                      }}
                      className="text-[11px] text-gray-500 hover:text-[#0056C9] flex items-center gap-1 font-medium px-2 py-0.5 rounded hover:bg-white shadow-xs transition"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5 text-[#0056C9]" />
                      <span>Mark read</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-600">No notifications found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === 'unread' ? 'You have read all your notifications.' : 'New notifications will appear here.'}
            </p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
        <button
          onClick={() => {
            navigate('/alerts');
            if (onClose) onClose();
          }}
          className="text-xs font-bold text-[#0056C9] hover:text-[#061A33] flex items-center justify-center gap-1.5 transition mx-auto"
        >
          <span>View Alerts & Risk Center</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
