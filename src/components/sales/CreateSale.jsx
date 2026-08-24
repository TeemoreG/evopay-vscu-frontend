import { useState, useEffect, useRef } from 'react';
import { getItems } from '../../api/vscuApi';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../api/axiosConfig';
import { toast } from 'react-toastify';

// Barcode SVG Icon
const BarcodeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14M21 5v14" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 19h18" strokeWidth="1.5" />
  </svg>
);

const CreateSale = ({ onSave, onCancel }) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState('');
  const [customerPin, setCustomerPin] = useState('');
  const [isB2B, setIsB2B] = useState(false);
  const [validatingPin, setValidatingPin] = useState(false);
  const [pinValid, setPinValid] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [taxType, setTaxType] = useState('B');
  const [paymentMethod, setPaymentMethod] = useState('01');
  const [salesType, setSalesType] = useState('N');
  const [receiptType, setReceiptType] = useState('NS');
  const [orgInvoiceNo, setOrgInvoiceNo] = useState('');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [barcode, setBarcode] = useState('');
  const [barcodeError, setBarcodeError] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer dropdown states
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [barcodeFocus, setBarcodeFocus] = useState(false);

  const barcodeInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);

  const TAX_RATES = {
    'A': { rate: 0, label: 'Exempt' },
    'B': { rate: 0.16, label: 'Standard (16%)' },
    'C': { rate: 0, label: 'Zero Rated' },
  };

  const PAYMENT_METHODS = [
    { code: '01', label: 'Cash', image: '/cash.jfif' },
    { code: '02', label: 'Card', image: '/card payment.jpg' },
    { code: '03', label: 'M-Pesa', image: '/m-pesa-logo_1.png' },
  ];

  const SALES_TYPES = [
    { code: 'N', label: 'Normal Sale' },
    { code: 'C', label: 'Credit Note' },
    { code: 'R', label: 'Return' },
  ];

  const RECEIPT_TYPES = [
    { code: 'NS', label: 'Normal Sale' },
    { code: 'NC', label: 'Credit Note' },
    { code: 'CS', label: 'Copy' },
    { code: 'PS', label: 'Proforma' },
  ];

  const DISCOUNT_TYPES = [
    { code: 'none', label: 'No Discount' },
    { code: 'percentage', label: 'Percentage (%)' },
    { code: 'fixed', label: 'Fixed Amount' },
  ];

  const calculateTaxFromInclusive = (inclusivePrice, taxType) => {
    const rate = TAX_RATES[taxType]?.rate || 0;
    if (rate === 0) return { tax: 0, exclusive: inclusivePrice };
    const tax = inclusivePrice * (rate / (1 + rate));
    return { tax, exclusive: inclusivePrice - tax };
  };

  // Validate customer PIN against KRA
  const validateCustomerPin = async (pin) => {
    if (!pin || pin.length < 9) return;
    
    setValidatingPin(true);
    try {
      const response = await axiosInstance.post('/customers/selectCustomer', {
        tin: import.meta.env.VITE_VSCU_TIN,
        bhfId: import.meta.env.VITE_VSCU_BHF_ID,
        custmTin: pin
      });
      
      if (response.data && response.data.custNm) {
        setCustomer(response.data.custNm);
        setCustomerSearch(response.data.custNm);
        setPinValid(true);
        toast.success(`Customer found: ${response.data.custNm}`);
      } else {
        setPinValid(false);
        toast.warning('Customer PIN not found in KRA system');
      }
    } catch (error) {
      setPinValid(false);
      toast.error('Invalid PIN or network error');
    } finally {
      setValidatingPin(false);
    }
  };

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axiosInstance.get('/api/customers');
        setCustomers(response.data || []);
        setFilteredCustomers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      }
    };
    fetchCustomers();
  }, []);

  // Filter customers based on search
  useEffect(() => {
    if (customerSearch.trim() === '') {
      setFilteredCustomers(customers);
      return;
    }
    const query = customerSearch.toLowerCase();
    const filtered = customers.filter(c => 
      c.name?.toLowerCase().includes(query) ||
      c.pin?.toLowerCase().includes(query)
    );
    setFilteredCustomers(filtered.slice(0, 15));
  }, [customerSearch, customers]);

  // Click outside for customer dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getItems();
        setAvailableItems(response.data || []);
        setFilteredItems(response.data || []);
      } catch (error) {
        console.error('Failed to fetch items:', error);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(availableItems);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = availableItems.filter(item => 
      item.item_name?.toLowerCase().includes(query) ||
      item.item_cd?.toLowerCase().includes(query)
    );
    setFilteredItems(filtered.slice(0, 30));
  }, [searchQuery, availableItems]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Barcode scanner - handles Enter key on barcode input
  useEffect(() => {
    const handleBarcodeScan = (e) => {
      if (e.key === 'Enter' && barcodeInputRef.current) {
        const value = barcodeInputRef.current.value.trim();
        if (value) {
          const found = availableItems.find(item => 
            item.item_cd === value || 
            item.bcd === value
          );
          
          if (found) {
            addItemToCart(found, 1);
            setBarcodeError('');
            toast.success(`${found.item_name} added via barcode!`);
            barcodeInputRef.current.value = '';
            setBarcodeFocus(false);
          } else {
            setBarcodeError(`Item not found: ${value}`);
            toast.error(`Item not found: ${value}`);
            setTimeout(() => setBarcodeError(''), 3000);
            barcodeInputRef.current.value = '';
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleBarcodeScan);
    return () => document.removeEventListener('keydown', handleBarcodeScan);
  }, [availableItems, items]);

  const addItemToCart = (item, qty = 1) => {
    const inclusivePrice = item.price;
    const { tax } = calculateTaxFromInclusive(inclusivePrice, item.tax_type || taxType);
    
    setItems([...items, {
      id: items.length + 1,
      itemCd: item.item_cd,
      name: item.item_name,
      quantity: qty,
      price: inclusivePrice,
      taxTyCd: item.tax_type || taxType,
      taxAmount: tax * qty,
      subtotal: inclusivePrice * qty,
      total: inclusivePrice * qty,
      itemClsCd: item.item_cls_cd || '',
      orgnNatCd: item.orgn_nat_cd || 'KE',
    }]);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item.item_cd);
    setPrice(item.price.toString());
    setTaxType(item.tax_type || 'B');
    setSearchQuery(item.item_name);
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowDropdown(true);
    if (selectedItem && value !== availableItems.find(i => i.item_cd === selectedItem)?.item_name) {
      setSelectedItem('');
      setPrice('');
    }
  };

  const handleAddItem = () => {
    if (!selectedItem || !quantity || !price) {
      toast.warning('Please select item, quantity, and price.');
      return;
    }

    const item = availableItems.find(i => i.item_cd === selectedItem);
    if (!item) {
      toast.warning('Item not found.');
      return;
    }

    const qty = parseInt(quantity, 10);
    addItemToCart(item, qty);

    setSelectedItem('');
    setQuantity(1);
    setPrice('');
    setTaxType('B');
    setSearchQuery('');
    setShowDropdown(false);
    toast.success(`${item.item_name} added to cart!`);
  };

  const handleRemoveItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    let subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    let tax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    let total = items.reduce((sum, item) => sum + item.total, 0);

    if (discountType !== 'none' && discountValue) {
      const discount = parseFloat(discountValue);
      if (discountType === 'percentage') {
        const discountAmount = (total * discount) / 100;
        total = total - discountAmount;
        subtotal = subtotal - discountAmount;
      } else if (discountType === 'fixed') {
        total = Math.max(0, total - discount);
        subtotal = Math.max(0, subtotal - discount);
      }
    }

    return { subtotal, tax, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Please add at least one item to the sale.');
      return;
    }

    if (!customer.trim()) {
      toast.error('Please enter customer name.');
      return;
    }

    if (isB2B && !customerPin.trim()) {
      toast.error('Customer PIN is required for B2B sales.');
      return;
    }

    if ((salesType === 'C' || salesType === 'R') && !orgInvoiceNo.trim()) {
      toast.error('Original invoice number is required for Credit Notes and Returns.');
      return;
    }

    setIsSubmitting(true);

    try {
      const totals = calculateTotals();
      const cashierName = user?.user_name || user?.username || user?.full_name || 'Unknown';

      const saleData = {
        invoice_no: `INV-${String(Date.now()).slice(-6)}`,
        customer: customer.trim(),
        customer_pin: customerPin.trim() || '',
        cashier: cashierName,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        payment_method: paymentMethod,
        sales_type: salesType,
        receipt_type: receiptType,
        org_invoice_no: orgInvoiceNo || null,
        discount_type: discountType,
        discount_value: discountValue || null,
        remarks: remarks || null,
        status: 'Completed',
        date: new Date().toISOString().split('T')[0],
        items: items.map(item => ({
          item_cd: item.itemCd,
          item_name: item.name,
          item_cls_cd: item.itemClsCd || '50101010',
          quantity: item.quantity,
          price: item.price,
          tax_type: item.taxTyCd,
          tax_amount: item.taxAmount,
          total: item.total
        }))
      };

      await onSave(saleData);
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to save sale:', error);
      setIsSubmitting(false);
      toast.error('Error saving sale. Please try again.');
    }
  };

  const totals = calculateTotals();
  const selectedPayment = PAYMENT_METHODS.find(p => p.code === paymentMethod);
  const selectedSalesType = SALES_TYPES.find(s => s.code === salesType);
  const selectedReceiptType = RECEIPT_TYPES.find(r => r.code === receiptType);
  const selectedDiscountType = DISCOUNT_TYPES.find(d => d.code === discountType);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <h3 className="text-lg font-semibold text-[#1a2a4a] mb-4">New Sale</h3>

      {/* Barcode Scanner Input - Professional Design */}
      <div className="mb-4 bg-gray-50 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center gap-2">
          <BarcodeIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
          <input
            ref={barcodeInputRef}
            type="text"
            className="flex-1 px-3 py-2 border-0 bg-transparent focus:ring-0 focus:outline-none text-sm"
            placeholder="Scan barcode or type item code..."
            onFocus={() => setBarcodeFocus(true)}
            onBlur={() => setBarcodeFocus(false)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              if (barcodeInputRef.current) {
                const value = barcodeInputRef.current.value.trim();
                if (value) {
                  const found = availableItems.find(item => 
                    item.item_cd === value || 
                    item.bcd === value
                  );
                  if (found) {
                    addItemToCart(found, 1);
                    toast.success(`${found.item_name} added!`);
                    barcodeInputRef.current.value = '';
                  } else {
                    toast.error(`Item not found: ${value}`);
                    barcodeInputRef.current.value = '';
                  }
                }
              }
            }}
            className="px-4 py-2 bg-[#1a2a4a] hover:bg-[#2a3a5a] text-white rounded-lg text-sm transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find
          </button>
        </div>
        {barcodeError && (
          <p className="text-red-500 text-xs mt-1">{barcodeError}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Scan a barcode or type item code, then press Enter</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* B2B Checkbox */}
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isB2B}
              onChange={(e) => {
                setIsB2B(e.target.checked);
                if (!e.target.checked) {
                  setCustomerPin('');
                  setPinValid(null);
                }
              }}
              className="w-4 h-4 text-[#f47b20] focus:ring-[#f47b20] rounded"
            />
            <span className="font-medium">B2B Sale (Business Customer)</span>
          </label>
          {isB2B && (
            <span className="text-xs text-red-500">* PIN Required</span>
          )}
        </div>

        {/* Customer Info with Dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative" ref={customerDropdownRef}>
            <label className="block text-sm text-gray-600 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customer}
              onChange={(e) => {
                const value = e.target.value;
                setCustomer(value);
                setCustomerSearch(value);
                setShowCustomerDropdown(true);
                const matched = customers.find(c => c.name?.toLowerCase() === value.toLowerCase());
                if (!matched) {
                  setCustomerPin('');
                  setPinValid(null);
                }
              }}
              onFocus={() => {
                setShowCustomerDropdown(true);
                if (customerSearch.trim() === '') {
                  setFilteredCustomers(customers);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
              placeholder="Type customer name..."
              required
            />
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.pin || c.id}
                    type="button"
                    onClick={() => {
                      setCustomer(c.name);
                      setCustomerPin(c.pin || '');
                      setCustomerSearch(c.name);
                      setPinValid(!!c.pin);
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-400">{c.pin || 'No PIN'}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">Start typing to see saved customers</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Customer PIN {isB2B && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerPin}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  setCustomerPin(value);
                  if (isB2B && value.length >= 9) {
                    validateCustomerPin(value);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent ${
                  pinValid === true ? 'border-green-500 bg-green-50' :
                  pinValid === false ? 'border-red-500 bg-red-50' :
                  'border-gray-300'
                }`}
                placeholder="e.g. A123456789Z"
                required={isB2B}
              />
              {validatingPin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
                  </svg>
                </div>
              )}
              {pinValid === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {isB2B ? 'PIN required for B2B sales to claim Input VAT' : 'Required if claiming Input VAT'}
            </p>
          </div>
        </div>

        {/* Sale & Receipt Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Sales Type</label>
            <select
              value={salesType}
              onChange={(e) => {
                setSalesType(e.target.value);
                if (e.target.value === 'N') {
                  setOrgInvoiceNo('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
            >
              {SALES_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Selected: {selectedSalesType?.label}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Receipt Type</label>
            <select
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
            >
              {RECEIPT_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Selected: {selectedReceiptType?.label}</p>
          </div>
        </div>

        {/* Original Invoice (for Credit Notes/Returns) */}
        {(salesType === 'C' || salesType === 'R') && (
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">
              Original Invoice Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orgInvoiceNo}
              onChange={(e) => setOrgInvoiceNo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
              placeholder="e.g. INV-123456"
              required={salesType === 'C' || salesType === 'R'}
            />
            <p className="text-xs text-gray-400 mt-1">Original invoice number for credit note or return</p>
          </div>
        )}

        {/* Payment Method */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Payment Method</label>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.code}
                type="button"
                onClick={() => setPaymentMethod(method.code)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 transition ${
                  paymentMethod === method.code
                    ? 'border-[#f47b20] bg-[#f47b20]/10 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <img src={method.image} alt={method.label} className="h-8 w-8 object-contain rounded" />
                <span className="text-sm font-medium text-gray-700">{method.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Selected: {selectedPayment?.label}</p>
        </div>

        {/* Discount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value);
                if (e.target.value === 'none') {
                  setDiscountValue('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
            >
              {DISCOUNT_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Selected: {selectedDiscountType?.label}</p>
          </div>
          {discountType !== 'none' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Discount {discountType === 'percentage' ? '(%)' : '(KES)'} 
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step={discountType === 'percentage' ? '0.01' : '1'}
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                required={discountType !== 'none'}
              />
              <p className="text-xs text-gray-400 mt-1">
                {discountType === 'percentage' ? 'Percentage discount applied to total' : 'Fixed amount discount applied to total'}
              </p>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Remarks / Notes</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent resize-none"
            placeholder="Additional notes about this sale..."
          />
          <p className="text-xs text-gray-400 mt-1">Optional - for internal reference</p>
        </div>

        {/* Items Section */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm text-gray-600 mb-1">Item</label>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                setShowDropdown(true);
                if (searchQuery.trim() === '') {
                  setFilteredItems(availableItems);
                }
              }}
              placeholder="Search for item..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
            />
            {showDropdown && filteredItems.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {filteredItems.map((item) => (
                  <button
                    key={item.item_cd}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center"
                  >
                    <span className="font-medium">{item.item_name}</span>
                    <span className="text-xs text-gray-400">KES {item.price}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery && filteredItems.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-400 text-sm">
                No items found
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Qty</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Price (incl. VAT)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tax Type</label>
            <select
              value={taxType}
              onChange={(e) => setTaxType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
            >
              <option value="A">A - Exempt (0%)</option>
              <option value="B">B - Standard (16%)</option>
              <option value="C">C - Zero Rated (0%)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full bg-[#1a2a4a] hover:bg-[#2a3a5a] text-white px-4 py-2 rounded-lg transition"
            >
              Add Item
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-center">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-center">Tax</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-2">
                      {item.name}
                      <span className="ml-2 text-xs text-gray-400">({item.taxTyCd})</span>
                    </td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">KES {item.price.toLocaleString()}</td>
                    <td className="py-2 text-center">KES {item.taxAmount.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium">KES {item.total.toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold border-t-2">
                  <td colSpan="2" className="py-2 text-right">Subtotal:</td>
                  <td className="py-2" colSpan="3">KES {totals.subtotal.toLocaleString()}</td>
                  <td></td>
                </tr>
                <tr className="font-bold">
                  <td colSpan="2" className="py-2 text-right text-[#f47b20]">VAT (16%):</td>
                  <td className="py-2 text-[#f47b20]" colSpan="3">KES {totals.tax.toLocaleString()}</td>
                  <td></td>
                </tr>
                {discountType !== 'none' && discountValue && (
                  <tr className="font-bold text-blue-600 border-t-2">
                    <td colSpan="2" className="py-2 text-right">Discount:</td>
                    <td className="py-2 text-blue-600" colSpan="3">
                      {discountType === 'percentage' ? `${discountValue}%` : `KES ${parseFloat(discountValue).toLocaleString()}`}
                    </td>
                    <td></td>
                  </tr>
                )}
                <tr className="font-bold text-[#f47b20] border-t-2">
                  <td colSpan="2" className="py-2 text-right">Total:</td>
                  <td className="py-2 text-[#f47b20]" colSpan="3">KES {totals.total.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`bg-[#f47b20] hover:bg-[#e06d1a] text-white px-6 py-2 rounded-lg transition flex items-center justify-center gap-2 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
                </svg>
                Processing...
              </>
            ) : (
              'Complete Sale'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateSale;