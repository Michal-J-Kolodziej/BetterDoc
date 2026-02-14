import { Link } from '@tanstack/react-router'

import { Panel } from '@/components/ui/Panel'
import type { TipComponentLink } from '@/features/dashboard/types'

type WatchSubscription = {
  componentFilePath: string
  componentName: string
  projectName: string
  subscriptionId: string
  updatedAt: number
  workspaceId: string
}

type WatchNotification = {
  componentName: string
  createdAt: number
  deliveryStatus: string
  eventType: string
  isRead: boolean
  notificationId: string
  projectName: string
  revisionNumber: number
  tipSlug: string
  tipTitle: string
  workspaceId: string
}

type WatchlistPanelProps = {
  canReadTips: boolean
  encodeWorkspaceId: (workspaceId: string) => string
  notificationMessage: string | null
  notifications: WatchNotification[] | undefined
  onMarkAllNotificationsAsRead: () => void
  onMarkNotificationAsRead: (id: string) => void
  onRemoveWatchSubscription: (link: TipComponentLink) => void
  onSetShowUnreadOnly: (value: boolean) => void
  showUnreadOnly: boolean
  subscriptions: WatchSubscription[] | undefined
  watchlistMessage: string | null
}

export function WatchlistPanel({
  canReadTips,
  encodeWorkspaceId,
  notificationMessage,
  notifications,
  onMarkAllNotificationsAsRead,
  onMarkNotificationAsRead,
  onRemoveWatchSubscription,
  onSetShowUnreadOnly,
  showUnreadOnly,
  subscriptions,
  watchlistMessage,
}: WatchlistPanelProps) {
  return (
    <div className="space-y-4">
      <Panel description="Component subscriptions tied to your account." title="My Watchlist">
        {!canReadTips ? (
          <p className="text-sm text-amber-200">Permission denied. tips.read is required.</p>
        ) : (
          <>
            {subscriptions === undefined ? <p className="text-sm text-slate-300">Loading watchlist...</p> : null}
            {subscriptions?.length === 0 ? (
              <p className="text-sm text-slate-300">
                You are not watching any components yet. Open a component page in explorer to subscribe.
              </p>
            ) : null}

            {subscriptions && subscriptions.length > 0 ? (
              <ul className="space-y-2">
                {subscriptions.map((subscription) => (
                  <li key={subscription.subscriptionId} className="app-card py-3">
                    <p className="text-sm text-slate-100">
                      <code className="app-code">
                        {subscription.workspaceId}/{subscription.projectName}/{subscription.componentName}
                      </code>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      <code className="app-code">{subscription.componentFilePath}</code>
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Updated {new Date(subscription.updatedAt).toLocaleString()}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        className="app-btn-secondary"
                        params={{
                          projectName: subscription.projectName,
                          workspaceId: encodeWorkspaceId(subscription.workspaceId),
                        }}
                        to="/explorer/$workspaceId/project/$projectName"
                      >
                        Open project
                      </Link>
                      <button
                        className="app-btn-danger"
                        onClick={() =>
                          onRemoveWatchSubscription({
                            workspaceId: subscription.workspaceId,
                            projectName: subscription.projectName,
                            componentName: subscription.componentName,
                            componentFilePath: subscription.componentFilePath,
                          })
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {watchlistMessage ? <p className="mt-3 text-sm text-cyan-100">{watchlistMessage}</p> : null}
          </>
        )}
      </Panel>

      <Panel
        description="Notifications are created when linked tips are published or updated."
        title="Watch Notifications"
      >
        {!canReadTips ? (
          <p className="text-sm text-amber-200">Permission denied. tips.read is required.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="app-checkbox-label" htmlFor="notification-unread-toggle">
                <input
                  checked={showUnreadOnly}
                  id="notification-unread-toggle"
                  onChange={(event) => onSetShowUnreadOnly(event.target.checked)}
                  type="checkbox"
                />
                Show unread only
              </label>

              <button className="app-btn-secondary" onClick={onMarkAllNotificationsAsRead} type="button">
                Mark all as read
              </button>
            </div>

            {notifications === undefined ? <p className="text-sm text-slate-300">Loading notifications...</p> : null}
            {notifications?.length === 0 ? (
              <p className="text-sm text-slate-300">No notifications match the current filter.</p>
            ) : null}

            {notifications && notifications.length > 0 ? (
              <ul className="space-y-2">
                {notifications.map((notification) => (
                  <li key={notification.notificationId} className="app-card py-3">
                    <p className="text-sm text-slate-100">
                      <code className="app-code">{notification.eventType}</code> · {notification.tipTitle} (
                      <code className="app-code">{notification.tipSlug}</code>) · r
                      {notification.revisionNumber}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(notification.createdAt).toLocaleString()} ·{' '}
                      <code className="app-code">
                        {notification.workspaceId}/{notification.projectName}/{notification.componentName}
                      </code>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Status: {notification.deliveryStatus} · {notification.isRead ? 'read' : 'unread'}
                    </p>
                    {!notification.isRead ? (
                      <button
                        className="app-btn-secondary mt-3"
                        onClick={() => onMarkNotificationAsRead(notification.notificationId)}
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {notificationMessage ? <p className="text-sm text-cyan-100">{notificationMessage}</p> : null}
          </div>
        )}
      </Panel>
    </div>
  )
}
