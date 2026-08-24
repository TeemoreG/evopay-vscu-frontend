import ItemList from './ItemList';

const ItemManagement = ({ 
  items, 
  loading, 
  onEdit, 
  onDelete,
  onComposition,
  onSyncToVSCU
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-[#1a2a4a]">Item List</h2>
        <span className="text-sm text-gray-500">{items.length} items</span>
      </div>

      <ItemList 
        items={items} 
        loading={loading}
        onEdit={onEdit}
        onDelete={onDelete}
        onComposition={onComposition}
        onSyncToVSCU={onSyncToVSCU}
      />
    </div>
  );
};

export default ItemManagement;