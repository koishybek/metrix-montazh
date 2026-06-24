import { useEffect } from 'react';
import api, { endpoints } from '../api';
import { useAuth } from '../context/AuthContext';

const SyncManager = () => {
  const { user } = useAuth();
  const username = user?.username || 'anon';
  useEffect(() => {
    const outboxKey = `installation_outbox_${username}`;
    const historyKey = `installation_history_${username}`;
    const syncOutbox = async () => {
      if (!navigator.onLine) return;

      const outbox = JSON.parse(localStorage.getItem(outboxKey) || '[]');
      if (outbox.length === 0) return;

      console.log(`[SyncManager] Found ${outbox.length} items to sync`);

      const remainingItems = [];
      
      for (const item of outbox) {
        try {
          // 1. Create Address first if needed
          let addressId = item.device__address;
          if (item._offlineAddressData && !addressId) {
            try {
              const addrRes = await api.post(endpoints.address, item._offlineAddressData);
              addressId = addrRes.data.id;
            } catch (addrErr) {
              console.error('[SyncManager] Address sync failed', addrErr);
              // If address fails, we might still want to try the meter if we have fallback logic
            }
          }

          // 2. Create Meter
          const payload = { ...item };
          if (addressId) {
            payload.device__address = addressId;
          }
          // Remove internal sync flags
          delete payload._offlineAddressData;
          delete payload._outboxId;

          const meterRes = await api.post(endpoints.meter, payload);

          // 3. Move to history. Keep the created meter id + upload_status so the
          // History page can show the real "в разработке" -> "Принято" progression.
          const historyItem = {
            ...payload,
            timestamp: new Date().toISOString(),
            meterId: meterRes.data?.id ?? null,
            upload_status: meterRes.data?.upload_status ?? null,
            synced: true
          };
          const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
          existingHistory.unshift(historyItem);
          localStorage.setItem(historyKey, JSON.stringify(existingHistory));
          
          console.log('[SyncManager] Successfully synced item');
        } catch (err) {
          console.error('[SyncManager] Item sync failed', err);
          remainingItems.push(item);
        }
      }

      localStorage.setItem(outboxKey, JSON.stringify(remainingItems));
      
      if (remainingItems.length === 0 && outbox.length > 0) {
        // All synced!
        alert('Все оффлайн-заявки успешно синхронизированы!');
      }
    };

    // Run on mount
    syncOutbox();

    // Listen for online event
    window.addEventListener('online', syncOutbox);
    
    // Also check every minute just in case
    const interval = setInterval(syncOutbox, 60000);

    return () => {
      window.removeEventListener('online', syncOutbox);
      clearInterval(interval);
    };
  }, [username]);

  return null;
};

export default SyncManager;
