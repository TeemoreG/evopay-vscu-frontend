import { useState, useEffect } from 'react';
import XReport from '../components/reports/XReport';
import ZReport from '../components/reports/ZReport';
import ItemReport from '../components/reports/ItemReport';
import TaxReport from '../components/reports/TaxReport';
import { getSales, getItems } from '../api/vscuApi';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('x');
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [openingDeposit, setOpeningDeposit] = useState(0); // From cash drawer

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const salesRes = await getSales();
      const itemsRes = await getItems();
      setSales(salesRes.data || []);
      setItems(itemsRes.data || []);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'x', label: 'X Report' },
    { id: 'z', label: 'Z Report' },
    { id: 'item', label: 'Item Report' },
    { id: 'tax', label: 'Tax Report' },
  ];

  const getFilteredSales = () => {
    if (!dateRange.start || !dateRange.end) return sales;
    return sales.filter(sale => {
      const saleDate = sale.date;
      return saleDate >= dateRange.start && saleDate <= dateRange.end;
    });
  };

  const getXReportData = () => {
    const completed = sales.filter(s => s.status === 'Completed');
    
    // NS (Normal Sale) receipts
    const nsReceipts = completed.filter(s => s.receipt_type === 'NS' || s.rcptTyCd === 'S');
    const ncReceipts = completed.filter(s => s.receipt_type === 'NC' || s.rcptTyCd === 'C');
    
    // Payment method breakdown
    const paymentBreakdown = {};
    nsReceipts.forEach(s => {
      const method = s.payment_method || '01';
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, amount: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].amount += (s.total || 0);
    });

    // Tax breakdown by rate
    const taxBreakdown = { A: { amount: 0, tax: 0 }, B: { amount: 0, tax: 0 }, C: { amount: 0, tax: 0 } };
    nsReceipts.forEach(s => {
      const type = s.tax_type || 'B';
      if (taxBreakdown[type]) {
        taxBreakdown[type].amount += (s.subtotal || 0);
        taxBreakdown[type].tax += (s.tax || 0);
      }
    });

    // Discounts total
    const totalDiscounts = nsReceipts.reduce((sum, s) => sum + (s.discount_amount || 0), 0);
    
    // Total items sold
    const totalItemsSold = nsReceipts.reduce((sum, s) => sum + (s.totItemCnt || 0), 0);

    return {
      totalSales: nsReceipts.length,
      totalCreditNotes: ncReceipts.length,
      totalAmount: nsReceipts.reduce((sum, s) => sum + (s.total || 0), 0),
      totalCreditAmount: ncReceipts.reduce((sum, s) => sum + (s.total || 0), 0),
      totalTax: nsReceipts.reduce((sum, s) => sum + (s.tax || 0), 0),
      totalItems: totalItemsSold,
      totalDiscounts: totalDiscounts,
      openingDeposit: openingDeposit,
      paymentBreakdown: paymentBreakdown,
      taxBreakdown: taxBreakdown,
      // Additional KRA required fields
      copiesCount: completed.filter(s => s.receipt_type === 'CS').length,
      trainingCount: completed.filter(s => s.receipt_type === 'TS').length,
      proformaCount: completed.filter(s => s.receipt_type === 'PS').length,
    };
  };

  const getZReportData = () => {
    const filtered = getFilteredSales().filter(s => s.status === 'Completed');
    const nsReceipts = filtered.filter(s => s.receipt_type === 'NS' || s.rcptTyCd === 'S');
    const ncReceipts = filtered.filter(s => s.receipt_type === 'NC' || s.rcptTyCd === 'C');
    
    // Payment method breakdown
    const paymentBreakdown = {};
    nsReceipts.forEach(s => {
      const method = s.payment_method || '01';
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, amount: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].amount += (s.total || 0);
    });

    const taxBreakdown = { A: { amount: 0, tax: 0 }, B: { amount: 0, tax: 0 }, C: { amount: 0, tax: 0 } };
    nsReceipts.forEach(s => {
      const type = s.tax_type || 'B';
      if (taxBreakdown[type]) {
        taxBreakdown[type].amount += (s.subtotal || 0);
        taxBreakdown[type].tax += (s.tax || 0);
      }
    });

    const totalDiscounts = nsReceipts.reduce((sum, s) => sum + (s.discount_amount || 0), 0);
    const totalItemsSold = nsReceipts.reduce((sum, s) => sum + (s.totItemCnt || 0), 0);

    return {
      totalSales: nsReceipts.length,
      totalCreditNotes: ncReceipts.length,
      totalAmount: nsReceipts.reduce((sum, s) => sum + (s.total || 0), 0),
      totalCreditAmount: ncReceipts.reduce((sum, s) => sum + (s.total || 0), 0),
      totalTax: nsReceipts.reduce((sum, s) => sum + (s.tax || 0), 0),
      totalItems: totalItemsSold,
      totalDiscounts: totalDiscounts,
      openingDeposit: openingDeposit,
      paymentBreakdown: paymentBreakdown,
      taxBreakdown: taxBreakdown,
      copiesCount: filtered.filter(s => s.receipt_type === 'CS').length,
      trainingCount: filtered.filter(s => s.receipt_type === 'TS').length,
      proformaCount: filtered.filter(s => s.receipt_type === 'PS').length,
    };
  };

  const getItemReportData = () => {
    const itemSales = {};
    sales.filter(s => s.status === 'Completed').forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const key = item.itemCd || item.name;
          if (!itemSales[key]) {
            // Find current stock from items list
            const stockItem = items.find(i => i.item_cd === key);
            itemSales[key] = { 
              name: item.itemNm || item.name, 
              quantity: 0, 
              total: 0, 
              price: item.price || 0,
              taxRate: item.tax_type || 'B',
              currentStock: stockItem?.stock || 0
            };
          }
          itemSales[key].quantity += item.qty || item.quantity || 0;
          itemSales[key].total += ((item.qty || item.quantity || 0) * (item.prc || item.price || 0));
        });
      }
    });
    return Object.values(itemSales);
  };

  const getTaxReportData = () => {
    const taxByType = {};
    const productList = [];

    sales.filter(s => s.status === 'Completed').forEach(sale => {
      const type = sale.tax_type || 'B';
      
      if (!taxByType[type]) {
        taxByType[type] = { type, count: 0, totalAmount: 0, taxAmount: 0, products: [] };
      }
      taxByType[type].count += 1;
      taxByType[type].totalAmount += sale.total || 0;
      taxByType[type].taxAmount += sale.tax || 0;

      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const productType = item.tax_type || type;
          const amount = (item.qty || item.quantity || 1) * (item.prc || item.price || 0);
          const taxRate = productType === 'B' ? 0.16 : 0;
          const taxAmount = amount * taxRate;
          
          productList.push({
            name: item.itemNm || item.name || 'Unknown',
            taxType: productType,
            amount: amount,
            taxAmount: taxAmount
          });
        });
      }
    });

    const result = Object.values(taxByType).map(tax => {
      const products = productList.filter(p => p.taxType === tax.type);
      return { ...tax, products };
    });

    return result;
  };

  const xData = getXReportData();
  const zData = getZReportData();
  const itemData = getItemReportData();
  const taxData = getTaxReportData();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'x':
        return <XReport data={xData} loading={loading} />;
      case 'z':
        return <ZReport data={zData} loading={loading} dateRange={dateRange} />;
      case 'item':
        return <ItemReport data={itemData} loading={loading} />;
      case 'tax':
        return <TaxReport data={taxData} loading={loading} />;
      default:
        return <XReport data={xData} loading={loading} />;
    }
  };

  const completedSales = sales.filter(s => s.status === 'Completed');
  const totalRevenue = completedSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalTax = completedSales.reduce((sum, s) => sum + (s.tax || 0), 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2a4a]">KRA Reports</h1>
          <p className="text-gray-500 text-sm">Generate and export KRA eTIMS compliant reports</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg text-sm transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === tab.id
                ? 'bg-[#f47b20] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-[#1a2a4a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">
          Last updated: {lastUpdated || 'Never'}
        </span>
      </div>

      {(activeTab === 'z' || activeTab === 'tax') && (
        <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <label className="text-sm text-gray-600 font-medium">Date Range:</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
          />
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0];
              setDateRange({ start: today, end: today });
            }}
            className="text-sm text-[#f47b20] hover:underline"
          >
            Today
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const weekAgo = new Date(today);
              weekAgo.setDate(today.getDate() - 7);
              setDateRange({
                start: weekAgo.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0],
              });
            }}
            className="text-sm text-[#f47b20] hover:underline"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const monthAgo = new Date(today);
              monthAgo.setDate(today.getDate() - 30);
              setDateRange({
                start: monthAgo.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0],
              });
            }}
            className="text-sm text-[#f47b20] hover:underline"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const yearAgo = new Date(today);
              yearAgo.setFullYear(today.getFullYear() - 1);
              setDateRange({
                start: yearAgo.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0],
              });
            }}
            className="text-sm text-[#f47b20] hover:underline"
          >
            Last Year
          </button>
          <button
            onClick={() => {
              setDateRange({ start: '', end: '' });
            }}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Clear
          </button>
          
          {/* Opening Deposit Input - Required for KRA */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-gray-600 font-medium">Opening Cash:</label>
            <input
              type="number"
              value={openingDeposit}
              onChange={(e) => setOpeningDeposit(parseFloat(e.target.value) || 0)}
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      {/* Stats Cards - KRA Compliant Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Sales</p>
          <p className="text-xl font-bold text-[#1a2a4a]">{sales.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-xl font-bold text-[#1a2a4a]">{completedSales.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-xl font-bold text-[#1a2a4a]">{sales.filter(s => s.status === 'Pending').length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Revenue</p>
          <p className="text-xl font-bold text-[#1a2a4a]">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Total Tax</p>
          <p className="text-xl font-bold text-[#1a2a4a]">KES {totalTax.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Reports;