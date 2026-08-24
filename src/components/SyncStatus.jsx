import { useState, useEffect } from 'react';
import { getSyncStatus, processSync, autoSync } from '../api/vscuApi';
import { toast } from 'react-toastify';

const SyncStatus = () => {
  const [status, setStatus] = useState({ 
    pending: 0, 
    failed: 0, 
    total: 0,
    byEndpoint: [],
    recentErrors: []
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // 1. ADDED: Check if the device is initialized (looks for local storage cmcKey/dvcKey or boolean status)
  const isInitialized = localStorage.getItem('dvcKey') || localStorage.getItem('isVscuInitialized') === 'true';

  useEffect(() => {
    // 2. MODIFIED: Stop polling completely if the system hasn't completed Category 1 Initialization
    if (!isInitialized) {
      console.warn('VSCU not initialized. Auto-sync polling suspended to prevent crash loops.');
      return;
    }

    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [isInitialized]); // Dependency array updated

  const fetchStatus = async () => {
    try {
      const response = await getSyncStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
    }
  };

  const handleSync = async () => {
    // 3. ADDED: Guard clause to block manual clicks before initialization
    if (!isInitialized) {
      toast.error('Cannot sync payloads. Please initialize your VSCU device first.');
      return;
    }

    setSyncing(true);
    try {
      const response = await processSync();
      if (response.data.success) {
        toast.success(response.data.message || `Synced ${response.data.synced} items`);
      } else {
        toast.warning(response.data.message || 'Sync completed with issues');
      }
      fetchStatus();
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoSync = async () => {
    // 4. ADDED: Guard clause for auto sync button
    if (!isInitialized) {
      toast.error('Cannot auto-sync payloads. System not initialized.');
      return;
    }

    setSyncing(true);
    try {
      const response = await autoSync();
      if (response.data.success) {
        toast.success(response.data.message || 'Auto-sync completed');
      } else {
        toast.warning(response.data.message || 'Auto-sync issue');
      }
      fetchStatus();
    } catch (error) {
      console.error('Auto-sync failed:', error);
      toast.error('Auto-sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // 5. MODIFIED: Render warning banner if unit needs configuration 
  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 text-xs">
        <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
        <span className="text-amber-800 font-medium">Device Uninitialized</span>
        <span className="text-gray-500">| Complete setup to enable sync features.</span>
      </div>
    );
  }

  // If no pending items, show green check
  if (status.total === 0 && status.pending === 0) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-gray-500">All synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {status.pending > 0 ? (
          <>
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-medium text-yellow-700">
              {status.pending} pending
            </span>
          </>
        ) : (
          <>
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-xs text-gray-500">Synced</span>
          </>
        )}
        
        {status.failed > 0 && (
          <span className="text-xs text-red-600">
            ({status.failed} failed)
          </span>
        )}
      </div>
      
      {/* Sync buttons - only show if there are pending items */}
      {status.pending > 0 && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleAutoSync}
            disabled={syncing}
            className="text-xs px-2 py-0.5 bg-[#f47b20] hover:bg-[#e06d1a] text-white rounded transition disabled:opacity-50"
          >
            {syncing ? '...' : 'Auto'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs px-2 py-0.5 bg-[#1a2a4a] hover:bg-[#2a3a5a] text-white rounded transition disabled:opacity-50"
          >
            {syncing ? '...' : 'Sync'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;
