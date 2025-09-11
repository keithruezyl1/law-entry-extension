import React from 'react';
import { listNotifications, computeNotifications, dismissNotification, resolveNotification, NotificationItem } from '../services/notificationsApi';

export default function DashboardNotifications() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [computing, setComputing] = React.useState<boolean>(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listNotifications();
      if (resp?.success) setItems(resp.notifications || []);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onCompute = async () => {
    setComputing(true);
    try {
      await computeNotifications();
      await load();
    } finally { setComputing(false); }
  };

  const onDismiss = async (id: string) => {
    await dismissNotification(id);
    await load();
  };

  const onResolve = async (id: string, selected?: string) => {
    await resolveNotification(id, selected);
    await load();
  };

  if (loading) return <div className="p-4">Loading notifications…</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <button className="btn-secondary" onClick={onCompute} disabled={computing}>
          {computing ? 'Scanning…' : 'Scan for suggestions'}
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-sm text-gray-600">No notifications.</div>
      )}

      <div className="space-y-3">
        {items.map(n => (
          <div key={n.id} className="border rounded-lg p-3 bg-white">
            <div className="text-sm font-medium mb-1">Entry {n.entry_id}</div>
            <div className="text-xs text-gray-700 mb-2">
              External: {n.citation_snapshot?.title || n.citation_snapshot?.citation || n.citation_snapshot?.url || '(untitled)'}
            </div>
            {n.matched_entry_ids && n.matched_entry_ids.length > 0 && (
              <div className="text-xs text-gray-600 mb-2">
                {n.matched_entry_ids.length > 1 ? (
                  <>
                    <div className="mb-1">Select a match:</div>
                    <div className="flex flex-wrap gap-2">
                      {n.matched_entry_ids.map(mid => (
                        <button key={mid} className="btn-secondary" onClick={() => onResolve(n.id, mid)}>{mid}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>Match: {n.matched_entry_ids[0]}</>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => onResolve(n.id, n.matched_entry_ids?.[0])}>Add as Internal Instead</button>
              <button className="btn-secondary" onClick={() => onDismiss(n.id)}>No</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


