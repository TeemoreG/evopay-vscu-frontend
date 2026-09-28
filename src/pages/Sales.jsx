import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import CreateSale from '../components/sales/CreateSale';
import SalesHistory from '../components/sales/SalesHistory';
import ThermalReceipt, { generateThermalReceipt } from '../components/sales/ThermalReceipt';
import { getSales, saveSales, getSyncStatus, processSync, checkVSCUStatus, retrySale } from '../api/vscuApi';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const Sales = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const [now, setNow] = useState(new Date());
  const [mobileTab, setMobileTab] = useState('sales');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const downloadMenuRef = useRef(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Click outside export menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: F1 = New Sale
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowForm(true);
      }
      if (e.key === 'Escape' && showForm) {
        setShowForm(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

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

      let savedSale = sales.find((s) => s.invoice_no === newSale.invoice_no);
      if (!savedSale && response?.data?.sale) {
        savedSale = response.data.sale;
      }

      const receiptData = {
        ...(savedSale || newSale),
        ...vscuData,
        items: savedSale?.items || newSale?.items || [],
      };

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

    if (dateRange.start) filtered = filtered.filter((s) => s.date >= dateRange.start);
    if (dateRange.end) filtered = filtered.filter((s) => s.date <= dateRange.end);

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
      if (statusFilter !== 'all') infoText += ` | Status: ${statusFilter}`;
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
        headStyles: { fillColor: [244, 123, 32], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        foot: [[
          'Total',
          `${filtered.length} sales`,
          '', '',
          filtered.reduce((sum, s) => sum + (s.tax || 0), 0).toLocaleString(),
          '',
          filtered.reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString(),
          '', '',
        ]],
        footStyles: { fillColor: [26, 42, 74], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
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

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
  const todaySales = sales.filter(s => (s.date || '').slice(0, 10) === todayStr);
  const todayRevenue = todaySales.filter(s => s.status === 'Completed').reduce((sum, s) => sum + (s.total || 0), 0);

  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">

      {/* Hidden logo for PDF generation */}
      <img src="/evopay-logo.png" alt="Evopay Logo" className="hidden" onError={(e) => (e.target.style.display = 'none')} />

      {/* ============ POS HEADER ============ */}
      <div className="bg-white border-b border-slate-200/80 px-3 py-2 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#f47b20] flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-bold text-[#1a2a4a] leading-tight">Sales Terminal</h1>
                <span className="text-[10px] font-semibold text-[#f47b20] bg-[#f47b20]/10 px-1.5 py-0.5 rounded">POS</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.full_name || user?.username || 'Cashier'} · {timeStr}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              vscuOnline ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${vscuOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className={`text-[10px] font-semibold ${vscuOnline ? 'text-emerald-700' : 'text-rose-700'}`}>
                VSCU {vscuOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {salesPendingCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-semibold text-amber-700">{salesPendingCount} pending</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500">
                Today <span className="font-bold text-[#1a2a4a]">{todaySales.length}</span>
                <span className="text-slate-400"> sale{todaySales.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-px h-3 bg-slate-300" />
              <div className="text-xs text-slate-500">
                <span className="font-bold text-[#f47b20]">KES {todayRevenue.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 hidden sm:block">
              Total: {stats.total} · Pending: {stats.pending} · Completed: {stats.completed}
            </div>
          </div>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 p-4 space-y-4 max-w-[1600px] w-full mx-auto">

        {/* Actions Row */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center justify-center gap-2 bg-[#f47b20] hover:bg-[#e06510] text-white px-5 py-2 rounded-lg text-sm font-semibold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={showForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
              </svg>
              <span>{showForm ? 'Close Form' : 'New Sale'}</span>
              <kbd className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono">F1</kbd>
            </button>

            <button
              onClick={handleSync}
              disabled={syncing || salesPendingCount === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
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
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded text-xs">{salesPendingCount}</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
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
                  <button onClick={exportPDF} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm10 2H6v10h8V6zM8 8h4v1H8V8zm0 3h4v1H8v-1z" clipRule="evenodd" />
                    </svg>
                    PDF Report
                  </button>
                  <button onClick={exportCSV} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
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

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
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
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'Completed', label: 'Completed' },
                { id: 'Pending', label: 'Pending' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    statusFilter === f.id ? 'bg-white text-[#1a2a4a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* New Sale Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6">
            <CreateSale onSave={handleCreateSale} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {filteredSales.length !== sales.length && (
          <p className="text-xs text-slate-400 px-1">
            Showing <strong className="text-slate-600">{filteredSales.length}</strong> of {sales.length}
          </p>
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

      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:flex fixed bottom-3 right-3 items-center gap-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-500 shadow-sm z-20">
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[9px] font-mono">F1</kbd> New Sale
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[9px] font-mono">Esc</kbd> Close Form
        </span>
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