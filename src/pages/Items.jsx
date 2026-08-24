import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import ItemManagement from '../components/items/ItemManagement';
import AddItemForm from '../components/items/AddItemForm';
import { 
  getItems, 
  saveItem, 
  deleteItem, 
  bulkImportItems, 
  checkVSCUStatus,
  sendItem,
  getItemInfo,
  sendItemComposition,
  getSettings,
  updateSettings
} from '../api/vscuApi';
import { useAuth } from '../context/AuthContext';

// Helper to map item to VSCU payload format
const mapItemToVSCUPayload = (item) => {
  return {
    tin: item.tin || '',
    bhfId: item.bhfId || '00',
    itemCd: item.itemCd || item.item_cd,
    itemClsCd: item.itemClsCd || item.item_cls_cd || '5059690809',
    itemTyCd: item.itemTyCd || '1',
    itemNm: item.itemNm || item.item_name,
    itemStdNm: item.itemStdNm || null,
    orgnNatCd: item.orgnNatCd || item.orgn_nat_cd || 'KE',
    pkgUnitCd: item.pkgUnitCd || item.pkg_unit_cd || 'NT',
    qtyUnitCd: item.qtyUnitCd || item.qty_unit_cd || 'U',
    taxTyCd: item.taxTyCd || item.tax_type || 'B',
    btchNo: item.btchNo || null,
    bcd: item.bcd || null,
    dftPrc: item.dftPrc || item.price || 0,
    grpPrcL1: item.grpPrcL1 || item.price || 0,
    grpPrcL2: item.grpPrcL2 || item.price || 0,
    grpPrcL3: item.grpPrcL3 || item.price || 0,
    grpPrcL4: item.grpPrcL4 || item.price || 0,
    grpPrcL5: item.grpPrcL5 || null,
    addInfo: item.addInfo || null,
    sftyQty: item.sftyQty || item.sfty_qty || 5,
    isrcAplcbYn: item.isrcAplcbYn || 'N',
    useYn: item.useYn || item.use_yn || 'Y',
    regrNm: item.regrNm || 'Admin',
    regrId: item.regrId || 'Admin',
    modrNm: item.modrNm || 'Admin',
    modrId: item.modrId || 'Admin'
  };
};

// Bulk Import Modal
const BulkImportModal = ({ isOpen, onClose, onImport }) => {
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV must have header row and data rows');
        return;
      }

      const headerRow = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setHeaders(headerRow);

      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headerRow.reduce((obj, header, index) => {
          obj[header] = values[index] || '';
          return obj;
        }, {});
      });

      setCsvData(rows);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (csvData.length === 0) {
      toast.warning('No data to import');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      onImport(csvData);
      setIsLoading(false);
      onClose();
      setCsvData([]);
      setHeaders([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-[#1a2a4a]">Bulk Import Items</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4 hover:border-[#f47b20] transition">
            <svg className="w-14 h-14 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">Upload CSV file</p>
            <p className="text-xs text-gray-400 mt-1">Required: itemCd, itemNm, dftPrc, taxTyCd</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="mt-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#f47b20] file:text-white hover:file:bg-[#e06d1a] file:cursor-pointer"
            />
          </div>

          {csvData.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{csvData.length} items ready</p>
              <div className="overflow-x-auto max-h-48 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {headers.map((h, j) => (
                          <td key={j} className="px-3 py-1.5 text-xs text-gray-600">{row[h] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                    {csvData.length > 10 && (
                      <tr>
                        <td colSpan={headers.length} className="px-3 py-2 text-xs text-gray-400 text-center">
                          ... and {csvData.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={csvData.length === 0 || isLoading}
            className="px-5 py-2 text-sm bg-[#f47b20] hover:bg-[#e06d1a] text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {isLoading ? 'Importing...' : `Import ${csvData.length} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};

// Item Composition Modal
const ItemCompositionModal = ({ isOpen, onClose, onSend, selectedItem, items }) => {
  const [compositionItems, setCompositionItems] = useState([]);
  const [newComposition, setNewComposition] = useState({ cpstItemCd: '', cpstQty: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [existingCompositions, setExistingCompositions] = useState([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Get component name from item code
  const getComponentName = (itemCd) => {
    const found = items?.find(i => i.itemCd === itemCd || i.item_cd === itemCd);
    return found?.itemNm || found?.item_name || itemCd;
  };

  // Get available items for dropdown (exclude parent and already added)
  const availableComponents = items?.filter(i => {
    const code = i.itemCd || i.item_cd;
    const alreadyAdded = compositionItems.some(c => c.cpstItemCd === code);
    const alreadyExisting = existingCompositions.some(c => c.cpstItemCd === code);
    return code !== selectedItem?.itemCd && 
           code !== selectedItem?.item_cd && 
           !alreadyAdded && 
           !alreadyExisting;
  }) || [];

  // Fetch existing compositions when modal opens
  useEffect(() => {
    if (isOpen && selectedItem) {
      fetchExistingCompositions();
    }
  }, [isOpen, selectedItem]);

  const fetchExistingCompositions = async () => {
    setIsLoadingExisting(true);
    try {
      const itemCd = selectedItem?.itemCd || selectedItem?.item_cd;
      const response = await fetch(`/api/items/${itemCd}/compositions`);
      const data = await response.json();
      if (data.success) {
        setExistingCompositions(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch compositions:', error);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const addComposition = () => {
    if (!newComposition.cpstItemCd || !newComposition.cpstQty) {
      toast.warning('Enter component code and quantity');
      return;
    }
    if (parseInt(newComposition.cpstQty) < 1) {
      toast.warning('Quantity must be at least 1');
      return;
    }
    const name = getComponentName(newComposition.cpstItemCd);
    setCompositionItems([...compositionItems, { 
      ...newComposition, 
      cpstItemNm: name 
    }]);
    setNewComposition({ cpstItemCd: '', cpstQty: 1 });
  };

  const removeComposition = (index) => {
    setCompositionItems(compositionItems.filter((_, i) => i !== index));
  };

  const removeExistingComposition = async (cpstItemCd) => {
    if (!confirm(`Remove component ${cpstItemCd} from this composition?`)) return;
    
    try {
      const itemCd = selectedItem?.itemCd || selectedItem?.item_cd;
      const response = await fetch(`/api/items/${itemCd}/compositions/${cpstItemCd}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Component removed');
        setExistingCompositions(existingCompositions.filter(c => c.cpstItemCd !== cpstItemCd));
      } else {
        toast.error(data.message || 'Failed to remove');
      }
    } catch (error) {
      toast.error('Error removing component');
    }
  };

  const handleSend = async () => {
    if (compositionItems.length === 0 && existingCompositions.length === 0) {
      toast.warning('Add at least one component');
      return;
    }

    // Check if parent exists in VSCU
    const parentCode = selectedItem?.itemCd || selectedItem?.item_cd;
    const parentSynced = items?.find(i => (i.itemCd === parentCode || i.item_cd === parentCode))?.synced === 1;
    
    if (!parentSynced) {
      toast.error(`Parent item ${parentCode} must be synced to VSCU first`);
      return;
    }

    // Check if all components exist in VSCU
    const unsyncedComponents = compositionItems.filter(comp => {
      const item = items?.find(i => i.itemCd === comp.cpstItemCd || i.item_cd === comp.cpstItemCd);
      return item?.synced !== 1;
    });

    if (unsyncedComponents.length > 0) {
      const unsyncedNames = unsyncedComponents.map(c => c.cpstItemCd).join(', ');
      toast.error(`Components must be synced first: ${unsyncedNames}`);
      return;
    }

    setIsLoading(true);
    let success = 0;
    let failed = 0;

    // Send each new composition
    for (const comp of compositionItems) {
      const payload = {
        tin: selectedItem?.tin || '',
        bhfId: selectedItem?.bhfId || '00',
        itemCd: parentCode,
        cpstItemCd: comp.cpstItemCd,
        cpstQty: parseInt(comp.cpstQty),
        regrId: 'Admin',
        regrNm: 'Admin'
      };
      try {
        await onSend(payload);
        success++;
      } catch {
        failed++;
      }
    }
    
    setIsLoading(false);
    if (success > 0) {
      toast.success(`✅ Sent ${success} compositions${failed > 0 ? `, ${failed} failed` : ''}`);
    }
    onClose();
    setCompositionItems([]);
    setExistingCompositions([]);
  };

  if (!isOpen) return null;

  const totalComponents = compositionItems.length + existingCompositions.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-[#1a2a4a]">Item Composition</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            Parent Item: <span className="font-medium text-[#1a2a4a]">
              {selectedItem?.itemNm || selectedItem?.item_name || 'Unknown'}
            </span>
            <span className="text-xs text-gray-400 ml-2">
              ({selectedItem?.itemCd || selectedItem?.item_cd})
            </span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
              items?.find(i => (i.itemCd === selectedItem?.itemCd || i.item_cd === selectedItem?.item_cd))?.synced === 1
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {items?.find(i => (i.itemCd === selectedItem?.itemCd || i.item_cd === selectedItem?.item_cd))?.synced === 1
                ? '✓ Synced'
                : '⚠️ Not Synced'}
            </span>
          </p>

          {/* Existing Compositions */}
          {isLoadingExisting ? (
            <p className="text-sm text-gray-400">Loading existing compositions...</p>
          ) : existingCompositions.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Existing Components</p>
              <div className="border rounded-lg divide-y bg-gray-50">
                {existingCompositions.map((comp, idx) => (
                  <div key={`existing-${idx}`} className="flex justify-between items-center p-3 hover:bg-gray-100">
                    <div>
                      <span className="text-sm font-medium text-[#1a2a4a]">
                        {getComponentName(comp.cpstItemCd)}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({comp.cpstItemCd})
                      </span>
                      <span className="text-sm text-gray-500 ml-3">Qty: {comp.cpstQty}</span>
                      {comp.synced === 1 && (
                        <span className="ml-2 text-xs text-green-600">✓ VSCU</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeExistingComposition(comp.cpstItemCd)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Composition */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <select
                value={newComposition.cpstItemCd}
                onChange={(e) => {
                  const code = e.target.value;
                  const name = getComponentName(code);
                  setNewComposition({ ...newComposition, cpstItemCd: code, cpstItemNm: name });
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f47b20]"
              >
                <option value="">Select component...</option>
                {availableComponents.map((item) => {
                  const code = item.itemCd || item.item_cd;
                  const name = item.itemNm || item.item_name;
                  const isSynced = item.synced === 1;
                  return (
                    <option key={code} value={code}>
                      {code} - {name} {!isSynced ? '(⚠️ Not Synced)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <input
              type="number"
              placeholder="Qty"
              value={newComposition.cpstQty}
              onChange={(e) => setNewComposition({ ...newComposition, cpstQty: e.target.value })}
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f47b20]"
              min="1"
            />
            <button
              onClick={addComposition}
              disabled={!newComposition.cpstItemCd}
              className="px-4 py-2 bg-[#1a2a4a] text-white rounded-lg text-sm hover:bg-[#0f1a33] disabled:opacity-50 whitespace-nowrap"
            >
              Add
            </button>
          </div>

          {/* New Compositions List */}
          {compositionItems.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">New Components</p>
              <div className="border rounded-lg divide-y">
                {compositionItems.map((comp, idx) => (
                  <div key={`new-${idx}`} className="flex justify-between items-center p-3 hover:bg-gray-50">
                    <div>
                      <span className="text-sm font-medium text-[#1a2a4a]">
                        {comp.cpstItemNm || comp.cpstItemCd}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        ({comp.cpstItemCd})
                      </span>
                      <span className="text-sm text-gray-500 ml-3">Qty: {comp.cpstQty}</span>
                      <span className="ml-2 text-xs text-blue-600">Pending</span>
                    </div>
                    <button
                      onClick={() => removeComposition(idx)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalComponents === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No components added yet. Select a component above.
            </p>
          )}

          <div className="flex gap-3 mt-4 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={compositionItems.length === 0 || isLoading}
              className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
                compositionItems.length === 0 || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#f47b20] hover:bg-[#e06d1a] text-white'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
                  </svg>
                  Sending...
                </span>
              ) : (
                `Send ${compositionItems.length} New Component${compositionItems.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Items = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [taxFilter, setTaxFilter] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [syncFilter, setSyncFilter] = useState('all');
  const [vscuOnline, setVscuOnline] = useState(false);
  const [showComposition, setShowComposition] = useState(false);
  const [compositionItem, setCompositionItem] = useState(null);
  const [lastSyncDate, setLastSyncDate] = useState('');
  const [saving, setSaving] = useState(false);

  const barcodeInputRef = useRef(null);

  // Check VSCU status
  const checkVSCU = async () => {
    try {
      const response = await checkVSCUStatus();
      setVscuOnline(response.data?.online || false);
    } catch {
      setVscuOnline(false);
    }
  };

  useEffect(() => {
    checkVSCU();
    fetchItems();
    
    const interval = setInterval(checkVSCU, 30000);
    return () => clearInterval(interval);
  }, []);

  // Barcode scanner support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && barcodeInputRef.current) {
        const barcode = barcodeInputRef.current.value.trim();
        if (barcode) {
          const foundItem = items.find(item => 
            item.itemCd === barcode || 
            item.bcd === barcode
          );
          if (foundItem) {
            setSelectedItem(foundItem);
            setShowForm(true);
          }
          barcodeInputRef.current.value = '';
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const [itemsRes, settingsRes] = await Promise.all([
        getItems(),
        getSettings()
      ]);
      
      const data = itemsRes.data || [];
      setItems(data);
      setLastUpdated(new Date().toLocaleString());
      
      if (settingsRes.data?.items_last_sync) {
        const dateStr = settingsRes.data.items_last_sync;
        const date = new Date(
          dateStr.slice(0, 4) + '-' +
          dateStr.slice(4, 6) + '-' +
          dateStr.slice(6, 8) + ' ' +
          dateStr.slice(8, 10) + ':' +
          dateStr.slice(10, 12) + ':' +
          dateStr.slice(12, 14)
        );
        setLastSyncDate(date.toLocaleString());
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // VSCU: Get Item Information with lastReqDt tracking
const syncItemsFromVSCU = async () => {
  if (!vscuOnline) {
    toast.error('VSCU is offline. Please start VSCU first.');
    return;
  }

  setSyncing(true);
  try {
    const settingsRes = await getSettings();
    const lastSync = settingsRes.data?.items_last_sync || '20200101000000';
    
    const payload = {
      tin: user?.tin || '',
      bhfId: user?.bhfId || '00',
      lastReqDt: lastSync
    };

    const response = await getItemInfo(payload);
    
    if (response.data && response.data.items) {
      const vscuItems = response.data.items;
      
      for (const item of vscuItems) {
        await saveItem(item);
      }
      
      const now = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      await updateSettings({ items_last_sync: now });
      
      await fetchItems();
      toast.success(`Synced ${vscuItems.length} items from VSCU`);
    } else {
      toast.info('No new items from VSCU');
    }
  } catch (error) {
    console.error('VSCU sync failed:', error);
    toast.error('Failed to sync from VSCU');
  } finally {
    setSyncing(false);
  }
};

// VSCU: Send Item Information
const handleSendItemToVSCU = async (item) => {
  if (!item || !item.itemCd || !item.itemCd.trim()) {
    console.warn('Skipping VSCU sync - item missing itemCd:', item);
    return;
  }
  
  if (!item.itemNm || !item.itemNm.trim()) {
    console.warn('Skipping VSCU sync - item missing itemNm:', item);
    return;
  }
  
  if (!vscuOnline) {
    toast.info('VSCU offline. Item will be queued for sync.');
    return;
  }

  try {
    const payload = mapItemToVSCUPayload({
      ...item,
      tin: user?.tin || '',
      bhfId: user?.bhfId || '00'
    });

    await sendItem(payload);
    toast.success(`Item ${item.itemCd} sent to VSCU`);
    
    await saveItem({ ...item, synced: 1 });
    await fetchItems();
  } catch (error) {
    console.error('Send item to VSCU failed:', error);
    toast.warning(`Item ${item.itemCd} saved locally but VSCU sync failed. Will retry later.`);
    await saveItem({ ...item, synced: 0 });
    throw error;
  }
};

// VSCU: Send Item Composition
const handleSendComposition = async (payload) => {
  if (!vscuOnline) {
    toast.error('VSCU is offline. Please start VSCU first.');
    return;
  }

  try {
    const fixedPayload = {
      ...payload,
      tin: user?.tin || import.meta.env.VITE_VSCU_TIN || '',
      bhfId: user?.bhfId || import.meta.env.VITE_VSCU_BHF_ID || '00'
    };
    await sendItemComposition(fixedPayload);
    toast.success(`Composition sent for ${payload.itemCd}`);
  } catch (error) {
    console.error('Send composition failed:', error);
    toast.error('Failed to send composition');
  }
};

const handleAddItem = async (newItem) => {
  if (!newItem.itemCd || !newItem.itemCd.trim()) {
    toast.error('Item Code is required');
    return;
  }
  
  if (!newItem.itemNm || !newItem.itemNm.trim()) {
    toast.error('Item Name is required');
    return;
  }

  // Check for duplicate item code
  const existingItem = items.find(item => 
    item.itemCd === newItem.itemCd || item.item_cd === newItem.itemCd
  );
  if (existingItem) {
    toast.error(`Item code "${newItem.itemCd}" already exists!`);
    return;
  }

  setSaving(true);
  try {
    const response = await saveItem(newItem);
    const savedItem = response.data || newItem;
    const itemName = savedItem.itemNm || savedItem.item_name || savedItem.itemCd || savedItem.item_cd || 'Item';
    
    // Update state immediately
    setItems(prev => [...prev, savedItem]);
    setShowForm(false);
    setLastUpdated(new Date().toLocaleString());
    
    if (vscuOnline) {
      try {
        await handleSendItemToVSCU(savedItem);
        toast.success(`"${itemName}" saved and synced to KRA`);
      } catch (syncError) {
        toast.warning(`"${itemName}" saved but VSCU sync failed. Will retry later.`);
      }
    } else {
      toast.info(`"${itemName}" saved locally. Will sync when VSCU is online.`);
    }
    
    await fetchItems();
  } catch (error) {
    console.error('Failed to add item:', error);
    toast.error('Error saving item. Please try again.');
  } finally {
    setSaving(false);
  }
};

const handleEditItem = async (updatedItem) => {
  if (!updatedItem.itemCd || !updatedItem.itemCd.trim()) {
    toast.error('Item Code is required');
    return;
  }
  
  if (!updatedItem.itemNm || !updatedItem.itemNm.trim()) {
    toast.error('Item Name is required');
    return;
  }

  setSaving(true);
  try {
    await saveItem(updatedItem);
    const itemName = updatedItem.itemNm || updatedItem.item_name || updatedItem.itemCd || updatedItem.item_cd || 'Item';
    
    // Update state immediately
    setItems(prev => prev.map(item => 
      (item.itemCd === updatedItem.itemCd || item.item_cd === updatedItem.itemCd) ? updatedItem : item
    ));
    setSelectedItem(null);
    setLastUpdated(new Date().toLocaleString());
    
    if (vscuOnline) {
      try {
        await handleSendItemToVSCU(updatedItem);
        toast.success(`"${itemName}" updated and synced to KRA`);
      } catch (syncError) {
        toast.warning(`"${itemName}" updated but VSCU sync failed. Will retry later.`);
      }
    } else {
      toast.info(`"${itemName}" updated locally. Will sync when VSCU is online.`);
    }
    
    await fetchItems();
  } catch (error) {
    console.error('Failed to update item:', error);
    toast.error('Error updating item. Please try again.');
  } finally {
    setSaving(false);
  }
};

const handleDeleteItem = async (itemCd) => {
  if (!window.confirm('Delete this item?')) return;
  try {
    await deleteItem(itemCd);
    setItems(prev => prev.filter(item => 
      item.itemCd !== itemCd && item.item_cd !== itemCd
    ));
    setLastUpdated(new Date().toLocaleString());
    toast.success('Item deleted');
  } catch (error) {
    console.error('Failed to delete item:', error);
    toast.error('Error deleting item');
  }
};

const handleBulkSync = async () => {
  const unsynced = items.filter(item => item.synced === 0);
  if (unsynced.length === 0) {
    toast.info('All items are synced');
    return;
  }
  
  if (!vscuOnline) {
    toast.error('VSCU is offline. Please start VSCU first.');
    return;
  }

  if (!confirm(`Sync ${unsynced.length} items to VSCU?`)) return;
  
  setSyncing(true);
  let success = 0, failed = 0;

  for (const item of unsynced) {
    try {
      await handleSendItemToVSCU(item);
      success++;
    } catch {
      failed++;
    }
  }
  
  await fetchItems();
  toast.success(`Synced ${success} items, ${failed} failed`);
  setSyncing(false);
};

const handleBulkImport = async (importedData) => {
  try {
    await bulkImportItems(importedData);
    await fetchItems();
    toast.success(`Imported ${importedData.length} items`);
    
    if (vscuOnline) {
      const newItems = items.filter(i => i.synced === 0);
      if (newItems.length > 0) {
        await handleBulkSync();
      }
    }
  } catch (error) {
    console.error('Bulk import failed:', error);
    toast.error('Import failed');
  }
};

const resetLastSync = async () => {
  if (!confirm('Reset last sync date to fetch ALL items from VSCU?')) return;
  try {
    await updateSettings({ items_last_sync: '20200101000000' });
    toast.info('Last sync reset. Fetching all items...');
    await syncItemsFromVSCU();
  } catch (error) {
    toast.error('Reset failed');
  }
};

const getFilteredItems = () => {
  let filtered = items;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      (item.item_name || item.itemNm || '').toLowerCase().includes(term) ||
      (item.item_cd || item.itemCd || '').toLowerCase().includes(term) ||
      (item.item_cls_cd || item.itemClsCd || '').includes(searchTerm)
    );
  }
  if (taxFilter !== 'all') {
    filtered = filtered.filter(item => 
      (item.tax_type || item.taxTyCd) === taxFilter
    );
  }
  if (syncFilter !== 'all') {
    filtered = filtered.filter(item => 
      syncFilter === 'synced' ? item.synced === 1 : item.synced === 0
    );
  }
  return filtered;
};

const filteredItems = getFilteredItems();

const totalValue = items.reduce((sum, item) => {
  const price = item.dftPrc || item.price || 0;
  const stock = item.sftyQty || item.stock || 0;
  return sum + (price * stock);
}, 0);

const stats = {
  total: items.length,
  lowStock: items.filter(i => {
    const stock = i.stock || 0;
    const safety = i.sftyQty || 5;
    return stock > 0 && stock <= safety;
  }).length,
  outOfStock: items.filter(i => (i.stock || 0) === 0).length,
  totalValue: items.reduce((sum, i) => {
    const price = i.dftPrc || i.price || 0;
    const stock = i.stock || 0;
    return sum + (price * stock);
  }, 0),
  synced: items.filter(i => i.synced === 1).length,
  local: items.filter(i => i.synced === 0).length,
};
  return (
    <div>
      <input ref={barcodeInputRef} type="text" className="hidden" aria-hidden="true" />
      
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
      />

      <ItemCompositionModal
        isOpen={showComposition}
        onClose={() => { setShowComposition(false); setCompositionItem(null); }}
        onSend={handleSendComposition}
        selectedItem={compositionItem}
        items={items}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a2a4a]">
          {selectedItem ? 'Edit Item' : 'Item Management'}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {selectedItem ? `Editing ${selectedItem.itemNm || selectedItem.item_name}` : 'Manage inventory with VSCU integration'}
        </p>
      </div>

      {/* VSCU Status - Clean and small */}
      <div className="flex flex-wrap items-center gap-4 mb-4 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200 text-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${vscuOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-gray-600">
            VSCU: <span className={`font-medium ${vscuOnline ? 'text-green-600' : 'text-red-600'}`}>
              {vscuOnline ? 'Online' : 'Offline'}
            </span>
          </span>
        </div>
        {lastSyncDate && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-xs text-gray-400">Last sync: {lastSyncDate}</span>
          </>
        )}
        {!vscuOnline && stats.local > 0 && (
          <span className="text-xs text-amber-600"> {stats.local} items pending sync</span>
        )}
      </div>

      {/* Action Buttons - Only Blue and Orange */}
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-gray-200">
        <button
          onClick={fetchItems}
          disabled={loading}
          className="bg-[#1a2a4a] hover:bg-[#0f1a33] text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
          </svg>
          Refresh
        </button>

        <button
          onClick={syncItemsFromVSCU}
          disabled={syncing || !vscuOnline}
          className={`px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 font-medium ${
            syncing || !vscuOnline ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#1a2a4a] hover:bg-[#0f1a33] text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
          </svg>
          {syncing ? 'Syncing...' : 'Get from VSCU'}
        </button>

        <button
          onClick={resetLastSync}
          disabled={syncing || !vscuOnline}
          className={`px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 font-medium ${
            syncing || !vscuOnline ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#1a2a4a] hover:bg-[#0f1a33] text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
          </svg>
          Reset Sync
        </button>

        <button
          onClick={handleBulkSync}
          disabled={syncing || stats.local === 0 || !vscuOnline}
          className={`px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 font-medium ${
            syncing || stats.local === 0 || !vscuOnline ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#f47b20] hover:bg-[#e06d1a] text-white'
          }`}
        >
          {syncing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
            </svg>
          )}
          Send to VSCU ({stats.local})
        </button>

        <button
          onClick={() => setShowBulkImport(true)}
          className="bg-[#1a2a4a] hover:bg-[#0f1a33] text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Bulk Import
        </button>

        {!selectedItem && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`px-4 py-1.5 rounded-lg text-sm transition flex items-center gap-2 font-medium ${
              showForm ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 'bg-[#f47b20] hover:bg-[#e06d1a] text-white'
            }`}
          >
            {showForm ? 'Cancel' : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </>
            )}
          </button>
        )}
      </div>

      {/* Forms */}
      {showForm && !selectedItem && (
        <div className="mb-6">
          <AddItemForm onSave={handleAddItem} onCancel={() => setShowForm(false)} isSaving={saving} />
        </div>
      )}

      {selectedItem && (
        <div className="mb-6">
          <AddItemForm 
            item={selectedItem} 
            onSave={handleEditItem} 
            onCancel={() => setSelectedItem(null)} 
            isSaving={saving}
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Items</p>
          <p className="text-xl font-bold text-[#1a2a4a] mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Low Stock</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{stats.lowStock}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Out of Stock</p>
          <p className="text-xl font-bold text-red-500 mt-1">{stats.outOfStock}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Inventory Value</p>
          <p className="text-xl font-bold text-[#1a2a4a] mt-1">
            KES {stats.totalValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">VSCU Status</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="font-medium text-[#1a2a4a]">{stats.synced}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="font-medium text-[#1a2a4a]">{stats.local}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
        <div className="flex-1 min-w-[180px] relative">
          <input
            type="text"
            placeholder="Search by name, code, or class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pl-9 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f47b20] bg-gray-50"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          value={taxFilter}
          onChange={(e) => setTaxFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f47b20] bg-gray-50"
        >
          <option value="all">All Tax Types</option>
          <option value="A">A - Exempt</option>
          <option value="B">B - Standard (16%)</option>
          <option value="C">C - Zero Rated</option>
        </select>

        <select
          value={syncFilter}
          onChange={(e) => setSyncFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#f47b20] bg-gray-50"
        >
          <option value="all">All Items</option>
          <option value="synced">Synced</option>
          <option value="local">Local Only</option>
        </select>

        {filteredItems.length !== items.length && (
          <span className="text-sm text-gray-500">{filteredItems.length} of {items.length}</span>
        )}
      </div>

      {/* Item List */}
      {!showForm && !selectedItem && (
        <ItemManagement
          items={filteredItems}
          loading={loading}
          onEdit={setSelectedItem}
          onDelete={handleDeleteItem}
          onComposition={(item) => {
            setCompositionItem(item);
            setShowComposition(true);
          }}
          onSyncToVSCU={handleSendItemToVSCU}
        />
      )}
    </div>
  );
};

export default Items;