import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import CreateSale from '../components/sales/CreateSale';
import SalesHistory from '../components/sales/SalesHistory';
import ThermalReceipt, { generateThermalReceipt } from '../components/sales/ThermalReceipt';
import { getSales, saveSales, getSyncStatus, processSync, checkVSCUStatus } from '../api/vscuApi';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Sales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentSale, setCurrentSale] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [salesPendingCount, setSalesPendingCount] = useState(0);
  const [vscuOnline, setVscuOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });

  const downloadMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await getSales();
      setSales(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesSyncStatus = async () => {
    try {
      const response = await getSyncStatus();
      const byEndpoint = response.data?.byEndpoint || [];
      let count = 0;
      byEndpoint.forEach(item => {
        if (item.endpoint === '/trnsSales/saveSales') {
          count = item.count;
        }
      });
      setSalesPendingCount(count);
    } catch (error) {
      console.error('Failed to fetch sales sync status:', error);
    }
  };

  const checkVSCU = async () => {
    try {
      const response = await checkVSCUStatus();
      setVscuOnline(response.data?.online || false);
    } catch {
      setVscuOnline(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('Syncing...');

    try {
      const response = await processSync();

      if (response.data.success) {
        if (response.data.synced > 0 && response.data.failed === 0) {
          setSyncMessage(`${response.data.synced} items synced`);
          toast.success(response.data.message || `Synced ${response.data.synced} items`);
        } else if (response.data.synced > 0 && response.data.failed > 0) {
          setSyncMessage(`${response.data.synced} synced, ${response.data.failed} failed`);
          toast.warning(response.data.message || `Sync completed with ${response.data.failed} failures`);
        } else if (response.data.synced === 0 && response.data.failed > 0) {
          setSyncMessage(`${response.data.failed} items failed`);
          toast.error(`Sync failed: ${response.data.failed} items`);
        } else if (response.data.synced === 0 && response.data.failed === 0) {
          setSyncMessage('Nothing to sync');
          toast.info('No pending items to sync');
        } else {
          setSyncMessage(response.data.message || 'Sync completed');
        }
      } else {
        setSyncMessage('Sync issue');
        toast.warning(response.data.message || 'Sync completed with issues');
      }

      fetchSalesSyncStatus();
      checkVSCU();
      fetchSales();

      setTimeout(() => setSyncMessage(''), 5000);
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncMessage('Sync failed');
      toast.error('Sync failed. Please try again.');
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchSalesSyncStatus();
    checkVSCU();
    
    const interval = setInterval(() => {
      checkVSCU();
      fetchSalesSyncStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handleCreateSale = async (newSale) => {
  try {
    const saleWithCashier = {
      ...newSale,
      cashier: user?.full_name || user?.username || 'Unknown',
    };

    const response = await saveSales(saleWithCashier);
    await fetchSales();
    await fetchSalesSyncStatus();
    setShowForm(false);

    // Extract VSCU signature data from response
    const vscuData = {
      cuId: response?.data?.vscuResponse?.data?.sdcId || response?.data?.sale?.scuId || 'KRACU0300003735',
      rcptNo: response?.data?.vscuResponse?.data?.rcptNo || response?.data?.sale?.receipt_no || '1',
      intrlData: response?.data?.vscuResponse?.data?.intrlData || '',
      rcptSign: response?.data?.vscuResponse?.data?.rcptSign || response?.data?.signature || '',
      vscu_signature: response?.data?.signature || response?.data?.vscuResponse?.data?.rcptSign || '',
      synced: response?.data?.synced || 0,
      sdcId: response?.data?.vscuResponse?.data?.sdcId || 'KRACU0300003735',
      totRcptNo: response?.data?.vscuResponse?.data?.totRcptNo || '1',
    };

    // Find the saved sale
    let savedSale = sales.find((s) => s.invoice_no === newSale.invoice_no);
    
    // If not found in sales list, use the response data
    if (!savedSale && response?.data?.sale) {
      savedSale = response.data.sale;
    }

    // Merge sale data with VSCU data for receipt
    const receiptData = {
      ...(savedSale || newSale),
      ...vscuData,
      // Ensure items are included
      items: savedSale?.items || newSale?.items || [],
    };

    // Set current sale for receipt
    setCurrentSale(receiptData);
    setShowReceipt(true);

  } catch (error) {
    console.error('Failed to save sale:', error);
    toast.error('Error saving sale. Check backend.');
  }
};

  const handleRetry = async (id) => {
  try {
    const response = await retrySale(id);
    
    if (response.data?.synced) {
      toast.success('Sale synced successfully!');
      await fetchSales();
      await fetchSalesSyncStatus();
    } else {
      toast.warning('Sale sync failed. Please try again.');
    }
  } catch (error) {
    console.error('Retry failed:', error);
    toast.error('Error retrying sale.');
  }
};
  const handleDownloadIndividualReceipt = async (sale) => {
  try {
    const logoRef = { current: document.querySelector('img[alt="Evopay Logo"]') };
    const doc = await generateThermalReceipt(sale, logoRef); 
    
    if (doc) {
      doc.save(`receipt-${sale.invoice_no || Date.now()}.pdf`);
    } else {
      alert('Error generating receipt. Please try again.');
    }
  } catch (error) {
    console.error('PDF Download Error:', error);
    alert('Error downloading receipt: ' + error.message);
  }
};

  const getFilteredSales = () => {
    let filtered = sales;

    if (searchTerm) {
      filtered = filtered.filter(
        (s) =>
          s.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (s.customer_pin && s.customer_pin.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (dateRange.start) {
      filtered = filtered.filter((s) => s.date >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter((s) => s.date <= dateRange.end);
    }

    return filtered;
  };

  const getPaymentLabel = (code) => {
    const labels = { '01': 'Cash', '02': 'Card', '03': 'Mobile Money' };
    return labels[code] || code || 'N/A';
  };

  const getReceiptTypeLabel = (code) => {
    const labels = { NS: 'Normal Sale', NC: 'Credit Note', CS: 'Copy', PS: 'Proforma' };
    return labels[code] || code || 'N/A';
  };

  const exportCSV = () => {
    const filtered = getFilteredSales();
    if (filtered.length === 0) {
      alert('No sales to export.');
      return;
    }

    try {
      const headers = ['Invoice No', 'Customer', 'Cashier', 'Payment', 'Tax (KES)', 'Receipt Type', 'Total (KES)', 'Date', 'Status'];
      const rows = filtered.map((s) => [
        s.invoice_no || 'N/A',
        s.customer || 'N/A',
        s.cashier || 'Unknown',
        getPaymentLabel(s.payment_method),
        (s.tax || 0).toString(),
        getReceiptTypeLabel(s.receipt_type),
        (s.total || 0).toString(),
        s.date || 'N/A',
        s.status || 'N/A',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sales_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert('Failed to export CSV. Please try again.');
    }
  };

  const exportPDF = () => {
    const filtered = getFilteredSales();
    if (filtered.length === 0) {
      alert('No sales to export.');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      const headerHeight = 45;
      doc.setFillColor(26, 42, 74);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Evopay VSCU Cashier System', pageWidth / 2, 28, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Sales Report', pageWidth / 2, 36, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      let infoText = 'All Sales';
      if (dateRange.start || dateRange.end) {
        infoText = `Period: ${dateRange.start || 'Start'} to ${dateRange.end || 'End'}`;
      }
      if (statusFilter !== 'all') {
        infoText += ` | Status: ${statusFilter}`;
      }
      doc.text(infoText, 14, 52);

      const tableHeaders = ['Invoice', 'Customer', 'Cashier', 'Payment', 'Tax', 'Receipt Type', 'Total (KES)', 'Date', 'Status'];
      const tableRows = filtered.map((s) => [
        s.invoice_no || 'N/A',
        s.customer || 'N/A',
        s.cashier || 'Unknown',
        getPaymentLabel(s.payment_method),
        (s.tax || 0).toLocaleString(),
        getReceiptTypeLabel(s.receipt_type),
        (s.total || 0).toLocaleString(),
        s.date || 'N/A',
        s.status || 'N/A',
      ]);

      doc.autoTable({
        startY: 58,
        head: [tableHeaders],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [244, 123, 32],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 8 },
        foot: [
          [
            'Total',
            `${filtered.length} sales`,
            '',
            '',
            filtered.reduce((sum, s) => sum + (s.tax || 0), 0).toLocaleString(),
            '',
            filtered.reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString(),
            '',
            '',
          ],
        ],
        footStyles: {
          fillColor: [26, 42, 74],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
      });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, finalY);
      doc.text('KRA eTIMS Compliant', pageWidth / 2, finalY, { align: 'center' });
      doc.text('Evopay Limited', pageWidth - 14, finalY, { align: 'right' });

      doc.save(`sales_report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const filteredSales = getFilteredSales();

  const stats = {
    total: sales.length,
    completed: sales.filter((s) => s.status === 'Completed').length,
    pending: sales.filter((s) => s.status === 'Pending').length,
    revenue: sales.filter((s) => s.status === 'Completed').reduce((sum, s) => sum + (s.total || 0), 0),
    totalTax: sales.filter((s) => s.status === 'Completed').reduce((sum, s) => sum + (s.tax || 0), 0),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 space-y-5">
      {/* Hidden logo for PDF generation */}
      <img
        src="/evopay-logo.png"
        alt="Evopay Logo"
        className="hidden"
        onError={(e) => (e.target.style.display = 'none')}
      />

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a2a4a] tracking-tight">Sales</h1>
          <p className="text-slate-500 text-sm">Manage and track all transactions</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleSync}
            disabled={syncing || salesPendingCount === 0}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
              syncing || salesPendingCount === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : vscuOnline
                ? 'bg-[#1a2a4a] hover:bg-[#253b66] text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
            </svg>
            <span>{syncing ? 'Syncing...' : syncMessage || 'Sync to KRA'}</span>
            {salesPendingCount > 0 && !syncMessage && (
              <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">
                {salesPendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex-1 md:flex-initial bg-[#f47b20] hover:bg-[#e06510] text-white px-5 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
            </svg>
            <span>{showForm ? 'Close' : 'New Sale'}</span>
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${vscuOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            <span className="text-slate-600">
              VSCU: <span className="font-semibold text-slate-800">{vscuOnline ? 'Online' : 'Offline'}</span>
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
          <div className="text-slate-600">
            {salesPendingCount > 0 ? (
              <span className="text-amber-600 font-medium">{salesPendingCount} sales pending sync</span>
            ) : (
              <span className="text-emerald-600 font-medium">All sales synced</span>
            )}
          </div>
        </div>
        {!vscuOnline && salesPendingCount > 0 && (
          <span className="text-slate-400 text-xs">Queueing until server reconnects</span>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold text-[#1a2a4a] mt-0.5">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Completed</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending</p>
          <p className="text-xl font-bold text-amber-500 mt-0.5">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue</p>
          <p className="text-xl font-bold text-[#1a2a4a] mt-0.5">KES {stats.revenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tax</p>
          <p className="text-xl font-bold text-[#1a2a4a] mt-0.5">KES {stats.totalTax.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search invoices, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#f47b20] transition"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#f47b20] transition"
          >
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 text-sm">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="bg-transparent border-0 px-2 py-1 text-slate-700 focus:ring-0 text-xs w-28"
            />
            <span className="text-slate-400 mx-0.5">–</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="bg-transparent border-0 px-2 py-1 text-slate-700 focus:ring-0 text-xs w-28"
            />
          </div>

          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              className="px-4 py-2 bg-[#1a2a4a] hover:bg-[#253b66] text-white rounded-lg text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-1.5 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[170px] z-30 overflow-hidden py-1">
                <button
                  onClick={exportPDF}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm10 2H6v10h8V6zM8 8h4v1H8V8zm0 3h4v1H8v-1z" clipRule="evenodd" />
                  </svg>
                  PDF Report
                </button>
                <button
                  onClick={exportCSV}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm10 2H6v10h8V6zM8 8h4v1H8V8zm0 3h4v1H8v-1z" clipRule="evenodd" />
                  </svg>
                  CSV Export
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredSales.length !== sales.length && (
        <p className="text-xs text-slate-400 px-1">
          Showing {filteredSales.length} of {sales.length}
        </p>
      )}

      {/* Create Sale Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
          <CreateSale onSave={handleCreateSale} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <SalesHistory
          sales={filteredSales}
          loading={loading}
          onRetry={handleRetry}
          onDownloadReceipt={handleDownloadIndividualReceipt}
        />
      </div>

      {/* Receipt Modal */}
      {showReceipt && currentSale && (
        <ThermalReceipt
          sale={currentSale}
          onClose={() => {
            setShowReceipt(false);
            setCurrentSale(null);
          }}
          onDownload={() => console.log('Receipt downloaded from modal')}
          onPrint={() => console.log('Receipt printed from modal')}
        />
      )}
    </div>
  );
};
export default Sales;