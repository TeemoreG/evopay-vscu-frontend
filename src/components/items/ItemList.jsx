const ItemList = ({ 
  items, 
  loading, 
  onEdit, 
  onDelete,
  onComposition,
  onSyncToVSCU
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-2 border-[#f47b20] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No items found. Click "Add Item" to create one.
      </div>
    );
  }

  const getItemCd = (item) => item.item_cd || item.itemCd;
  const getItemName = (item) => item.item_name || item.itemNm;
  const getItemPrice = (item) => item.price || item.dftPrc || 0;
  const getTaxType = (item) => item.tax_type || item.taxTyCd;
  const getItemClsCd = (item) => item.item_cls_cd || item.itemClsCd;
  const getOrgnNatCd = (item) => item.orgn_nat_cd || item.orgnNatCd;
  const getStock = (item) => item.stock || item.sftyQty || 0;
  const getSynced = (item) => item.synced !== undefined ? item.synced : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider">Code</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider">Name</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider text-right">Price</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider">Tax</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">KRA Class</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Origin</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider text-right">Stock</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider text-center">Sync</th>
            <th className="pb-2.5 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemCd = getItemCd(item);
            const stock = getStock(item);
            const synced = getSynced(item);
            
            return (
              <tr key={itemCd || Math.random()} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-2.5 text-gray-600 font-mono text-xs font-medium">
                  {itemCd || '-'}
                </td>
                <td className="py-2.5 font-medium text-[#1a2a4a] max-w-[150px] truncate" title={getItemName(item)}>
                  {getItemName(item)}
                </td>
                <td className="py-2.5 text-[#1a2a4a] text-right font-medium">
                  KES {getItemPrice(item).toLocaleString()}
                </td>
                <td className="py-2.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    getTaxType(item) === 'B' ? 'bg-orange-100 text-orange-700' :
                    getTaxType(item) === 'A' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {getTaxType(item) || 'B'}
                  </span>
                </td>
                <td className="py-2.5 text-gray-500 font-mono text-xs hidden md:table-cell">
                  {getItemClsCd(item) || '-'}
                </td>
                <td className="py-2.5 text-gray-500 text-xs hidden lg:table-cell">
                  {getOrgnNatCd(item) || 'KE'}
                </td>
                <td className="py-2.5 text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    stock === 0 ? 'bg-red-100 text-red-700' : 
                    stock < 10 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-gray-100 text-[#1a2a4a]'
                  }`}>
                    {stock}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  {synced === 1 ? (
                    <span className="text-xs text-emerald-600 font-medium">✓ Synced</span>
                  ) : (
                    <button
                      onClick={() => onSyncToVSCU && onSyncToVSCU(item)}
                      className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-2.5 py-1 rounded-lg transition font-medium"
                      title="Sync to VSCU"
                    >
                      Sync
                    </button>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onComposition && onComposition(item)}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded transition"
                      title="Add Item Composition"
                    >
                      Comp
                    </button>
                    <button
                      onClick={() => onEdit(item)}
                      className="text-[#1a2a4a] hover:text-[#0f1a33] text-xs px-2 py-1 rounded hover:bg-gray-100 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(itemCd)}
                      className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ItemList;