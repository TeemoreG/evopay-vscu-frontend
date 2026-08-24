import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const AddItemForm = ({ item, onSave, onCancel, isSaving }) => {
  const { user } = useAuth();
  const isEditing = !!item;

  const [formData, setFormData] = useState({
    itemCd: '',
    itemNm: '',
    itemStdNm: '',
    itemClsCd: '',
    itemTyCd: '1',
    dftPrc: '',
    taxTyCd: 'B',
    sftyQty: '',
    orgnNatCd: 'KE',
    pkgUnitCd: 'NT',
    qtyUnitCd: 'U',
    useYn: 'Y',
    isrcAplcbYn: 'N',
    bcd: '',
    addInfo: '',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        itemCd: item.itemCd || item.item_cd || '',
        itemNm: item.itemNm || item.item_name || '',
        itemStdNm: item.itemStdNm || '',
        itemClsCd: item.itemClsCd || item.item_cls_cd || '',
        itemTyCd: item.itemTyCd || '1',
        dftPrc: item.dftPrc || item.price || '',
        taxTyCd: item.taxTyCd || item.tax_type || 'B',
        sftyQty: item.sftyQty || item.sfty_qty || '',
        orgnNatCd: item.orgnNatCd || item.orgn_nat_cd || 'KE',
        pkgUnitCd: item.pkgUnitCd || item.pkg_unit_cd || 'NT',
        qtyUnitCd: item.qtyUnitCd || item.qty_unit_cd || 'U',
        useYn: item.useYn || item.use_yn || 'Y',
        isrcAplcbYn: item.isrcAplcbYn || item.isrc_aplcb_yn || 'N',
        bcd: item.bcd || '',
        addInfo: item.addInfo || '',
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const emptyForm = {
    itemCd: '',
    itemNm: '',
    itemStdNm: '',
    itemClsCd: '',
    itemTyCd: '1',
    dftPrc: '',
    taxTyCd: 'B',
    sftyQty: '',
    orgnNatCd: 'KE',
    pkgUnitCd: 'NT',
    qtyUnitCd: 'U',
    useYn: 'Y',
    isrcAplcbYn: 'N',
    bcd: '',
    addInfo: '',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.itemCd || !formData.itemNm || !formData.dftPrc || !formData.itemClsCd) {
      alert('Please fill in: Item Code, Name, Price, and KRA Class Code');
      return;
    }

    // Validate price is positive
    if (parseFloat(formData.dftPrc) < 0) {
      alert('Price must be greater than or equal to 0');
      return;
    }

    const payload = {
      tin: user?.tin || '',
      bhfId: user?.bhfId || '00',
      itemCd: formData.itemCd,
      itemNm: formData.itemNm,
      itemStdNm: formData.itemStdNm || null,
      itemClsCd: formData.itemClsCd,
      itemTyCd: formData.itemTyCd || '1',
      orgnNatCd: formData.orgnNatCd,
      pkgUnitCd: formData.pkgUnitCd,
      qtyUnitCd: formData.qtyUnitCd,
      taxTyCd: formData.taxTyCd,
      btchNo: null,
      bcd: formData.bcd || null,
      dftPrc: parseFloat(formData.dftPrc) || 0,
      grpPrcL1: parseFloat(formData.dftPrc) || 0,
      grpPrcL2: parseFloat(formData.dftPrc) || 0,
      grpPrcL3: parseFloat(formData.dftPrc) || 0,
      grpPrcL4: parseFloat(formData.dftPrc) || 0,
      grpPrcL5: null,
      addInfo: formData.addInfo || null,
      sftyQty: parseInt(formData.sftyQty) || 0,
      isrcAplcbYn: formData.isrcAplcbYn || 'N',
      useYn: formData.useYn || 'Y',
      regrNm: user?.full_name || user?.username || 'Admin',
      regrId: user?.username || 'Admin',
      modrNm: user?.full_name || user?.username || 'Admin',
      modrId: user?.username || 'Admin',
    };

    // This form gets unmounted by the parent (Items.jsx) as soon as the
    // save succeeds, so success/error feedback is handled by the parent's
    // toast notifications (react-toastify), not by local state here —
    // a message set on this component after unmount would never render.
    onSave(payload);
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setSuccessMsg('');
    onCancel();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-[#1a2a4a]">
          {isEditing ? '✏️ Edit Item' : '➕ Add New Item'}
        </h3>
        {isEditing && (
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {formData.itemCd}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Item Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Code {!isEditing && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            name="itemCd"
            value={formData.itemCd}
            onChange={handleChange}
            disabled={isEditing}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm ${
              isEditing ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
            }`}
            placeholder="e.g. KE1NTXU0000001"
            required={!isEditing}
          />
          {isEditing && (
            <p className="text-xs text-gray-400 mt-1">Code cannot be changed</p>
          )}
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="itemNm"
            value={formData.itemNm}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. Office Chair"
            required
          />
        </div>

        {/* Standard Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Standard Name
          </label>
          <input
            type="text"
            name="itemStdNm"
            value={formData.itemStdNm}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. Chair, Office"
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price (KES) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="dftPrc"
            value={formData.dftPrc}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. 12500"
            required
            min="0"
            step="0.01"
          />
        </div>

        {/* KRA Class Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            KRA Class Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="itemClsCd"
            value={formData.itemClsCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. 5059690809"
            required
          />
          <p className="text-xs text-gray-400 mt-1">KRA item classification code</p>
        </div>

        {/* Item Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Item Type
          </label>
          <select
            name="itemTyCd"
            value={formData.itemTyCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="1">Goods</option>
            <option value="2">Service</option>
            <option value="3">Mixed</option>
          </select>
        </div>

        {/* Tax Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax Type
          </label>
          <select
            name="taxTyCd"
            value={formData.taxTyCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="A">A - Exempt (0%)</option>
            <option value="B">B - Standard (16%)</option>
            <option value="C">C - Zero Rated (0%)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">VAT rate applied to this item</p>
        </div>

        {/* Safety Stock */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Safety Stock
          </label>
          <input
            type="number"
            name="sftyQty"
            value={formData.sftyQty}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. 5"
            min="0"
          />
          <p className="text-xs text-gray-400 mt-1">Minimum stock level alert</p>
        </div>

        {/* Origin */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country of Origin
          </label>
          <input
            type="text"
            name="orgnNatCd"
            value={formData.orgnNatCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="KE"
            maxLength="2"
          />
        </div>

        {/* Package Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Package Unit
          </label>
          <select
            name="pkgUnitCd"
            value={formData.pkgUnitCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="NT">NT - Each</option>
            <option value="U">U - Unit</option>
            <option value="KG">KG - Kilogram</option>
            <option value="L">L - Liter</option>
            <option value="M">M - Meter</option>
            <option value="CM">CM - Centimeter</option>
            <option value="MM">MM - Millimeter</option>
          </select>
        </div>

        {/* Quantity Unit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantity Unit
          </label>
          <select
            name="qtyUnitCd"
            value={formData.qtyUnitCd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="U">U - Unit</option>
            <option value="NT">NT - Each</option>
            <option value="KG">KG - Kilogram</option>
            <option value="L">L - Liter</option>
            <option value="M">M - Meter</option>
          </select>
        </div>

        {/* Barcode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Barcode
          </label>
          <input
            type="text"
            name="bcd"
            value={formData.bcd}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="e.g. 8901234567890"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="useYn"
            value={formData.useYn}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="Y">✅ Active</option>
            <option value="N">⛔ Inactive</option>
          </select>
        </div>

        {/* Insurance Applicable */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Insurance Applicable
          </label>
          <select
            name="isrcAplcbYn"
            value={formData.isrcAplcbYn}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
          >
            <option value="N">No</option>
            <option value="Y">Yes</option>
          </select>
        </div>

        {/* Additional Info */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Info
          </label>
          <input
            type="text"
            name="addInfo"
            value={formData.addInfo}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent text-sm"
            placeholder="Any extra details about the item"
          />
        </div>

        {/* Actions */}
        <div className="flex items-end gap-3 md:col-span-3 pt-2 border-t border-gray-100 mt-2">
          <button
            type="submit"
            disabled={isSaving}
            className={`bg-[#f47b20] hover:bg-[#e06d1a] text-white px-6 py-2.5 rounded-lg transition font-medium text-sm flex items-center gap-2 ${
              isSaving ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
                </svg>
                {isEditing ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {isEditing ? 'Update Item' : 'Save Item'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="border border-gray-300 hover:bg-gray-50 px-5 py-2.5 rounded-lg transition text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          {isEditing && (
            <span className="text-xs text-gray-400 ml-auto">
              Last modified: {item?.modrNm || 'Admin'}
            </span>
          )}
        </div>
      </form>

      {/* VSCU Info */}
      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-600">
          📋 VSCU fields: tin, bhfId, itemCd, itemNm, itemClsCd, taxTyCd, dftPrc
        </p>
      </div>
    </div>
  );
};

export default AddItemForm;