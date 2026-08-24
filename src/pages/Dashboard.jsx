import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, 
  PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Package, AlertTriangle, 
  RefreshCw, CheckCircle2, XCircle, ArrowUpRight, Plus, FileText, 
  Layers, Search, Activity, Clock, Calendar, Award, Zap, 
  BarChart3, PieChart as PieChartIcon
} from 'lucide-react';

import RecentSales from '../components/dashboard/RecentSales';
import { getSales, getItems, getStock, checkVSCUStatus } from '../api/vscuApi';

const PIE_COLORS = ['#f47b20', '#1a2a4a', '#10b981', '#8b5cf6', '#ec4899'];

const Dashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalItems: 0,
    totalSales: 0,
    totalRevenue: 0,
    stockValue: 0,
    pendingSales: 0,
    todaySales: 0,
    totalTax: 0,
    todayRevenue: 0,
    avgOrderValue: 0,
    growthRate: 0,
  });

  const [recentSales, setRecentSales] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [salesByPayment, setSalesByPayment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [vscuStatus, setVscuStatus] = useState({ connected: false, checking: true, latency: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  
  // Add a counter to force re-renders
  const [statusCheckCounter, setStatusCheckCounter] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchDashboardData();
    checkVSCU();

    // Poll VSCU status every 5 seconds with force update
    intervalRef.current = setInterval(() => {
      checkVSCU();
      // Force re-render by updating counter
      setStatusCheckCounter(prev => prev + 1);
    }, 5000);

    // Also check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVSCU();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const checkVSCU = async () => {
    try {
      setVscuStatus(prev => ({ ...prev, checking: true }));
      const startTime = Date.now();
      const response = await checkVSCUStatus();
      const latency = Date.now() - startTime;

      setVscuStatus({ 
        connected: response.data?.online === true, 
        checking: false,
        latency: response.data?.online ? latency : null
      });
    } catch (error) {
      console.warn('VSCU Middleware offline:', error.message);
      setVscuStatus({ connected: false, checking: false, latency: null });
    }
  };

  const calculateTopItems = (salesData) => {
    const itemMap = {};
    salesData.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const key = item.item_cd || item.itemCd || 'UNKNOWN';
          if (!itemMap[key]) {
            itemMap[key] = {
              name: item.item_name || item.itemNm || 'Unknown Product',
              sold: 0,
              revenue: 0,
            };
          }
          itemMap[key].sold += item.quantity || 0;
          itemMap[key].revenue += (item.quantity || 0) * (item.price || 0);
        });
      }
    });

    return Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const calculateSalesByPayment = (salesData) => {
    const paymentMap = {};
    const paymentLabels = { '01': 'Cash', '02': 'Card', '03': 'Mobile Money' };
    
    salesData.forEach(sale => {
      const method = sale.payment_method || '01';
      const label = paymentLabels[method] || method;
      if (!paymentMap[label]) {
        paymentMap[label] = { name: label, value: 0 };
      }
      paymentMap[label].value += sale.total || 0;
    });

    return Object.values(paymentMap);
  };

  const processChartData = (salesData, range = '7d') => {
    let days = 7;
    if (range === '30d') days = 30;
    if (range === '90d') days = 90;

    const lastNDays = [...Array(days)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split('T')[0];
    });

    return lastNDays.map(dateStr => {
      const daySales = salesData.filter(s => {
        const sDate = s.date ? new Date(s.date).toISOString().split('T')[0] : '';
        return sDate === dateStr;
      });

      const dayRevenue = daySales
        .filter(s => s.status === 'Completed')
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const dayTax = daySales
        .filter(s => s.status === 'Completed')
        .reduce((sum, s) => sum + (s.tax || 0), 0);

      const daySalesCount = daySales.length;

      const dayLabel = new Date(dateStr).toLocaleDateString('en-KE', { 
        weekday: range === '7d' ? 'short' : 'numeric',
        month: range === '90d' ? 'short' : undefined,
      });

      return {
        date: dayLabel,
        revenue: dayRevenue,
        tax: dayTax,
        salesCount: daySalesCount,
        fullDate: dateStr,
      };
    });
  };

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);

      const [salesRes, itemsRes, stockRes] = await Promise.all([
        getSales().catch(() => ({ data: [] })),
        getItems().catch(() => ({ data: [] })),
        getStock().catch(() => ({ data: [] }))
      ]);

      const sales = salesRes.data || [];
      const items = itemsRes.data || [];
      const stock = stockRes.data || [];

      const completedSales = sales.filter(s => s.status === 'Completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const totalTax = completedSales.reduce((sum, s) => sum + (s.tax || 0), 0);
      const pendingSales = sales.filter(s => s.status === 'Pending').length;

      const todayStr = new Date().toISOString().split('T')[0];
      const todaySalesArr = sales.filter(s => {
        const sDate = s.date ? new Date(s.date).toISOString().split('T')[0] : '';
        return sDate === todayStr;
      });

      const todayRevenue = todaySalesArr
        .filter(s => s.status === 'Completed')
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const stockValue = stock.reduce((sum, s) => sum + ((s.price || 0) * (s.stock || 0)), 0);
      
      const avgOrderValue = completedSales.length > 0 
        ? totalRevenue / completedSales.length 
        : 0;

      const now = new Date();
      const last7Start = new Date(now);
      last7Start.setDate(now.getDate() - 7);
      const prev7Start = new Date(last7Start);
      prev7Start.setDate(last7Start.getDate() - 7);

      const last7Sales = sales.filter(s => {
        const d = new Date(s.date);
        return d >= last7Start && d <= now && s.status === 'Completed';
      });
      const prev7Sales = sales.filter(s => {
        const d = new Date(s.date);
        return d >= prev7Start && d < last7Start && s.status === 'Completed';
      });

      const last7Revenue = last7Sales.reduce((sum, s) => sum + (s.total || 0), 0);
      const prev7Revenue = prev7Sales.reduce((sum, s) => sum + (s.total || 0), 0);
      const growthRate = prev7Revenue > 0 
        ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100 
        : 0;

      setStats({
        totalItems: items.length,
        totalSales: sales.length,
        totalRevenue,
        stockValue,
        pendingSales,
        todaySales: todaySalesArr.length,
        totalTax,
        todayRevenue,
        avgOrderValue,
        growthRate,
      });

      const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentSales(sorted.slice(0, 10));

      setTopItems(calculateTopItems(sales));
      setChartData(processChartData(sales, timeRange));
      setSalesByPayment(calculateSalesByPayment(sales));
      setLastUpdated(new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }));

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    fetchDashboardData();
  };

  const complianceRate = useMemo(() => {
    if (stats.totalSales === 0) return 100;
    const completed = stats.totalSales - stats.pendingSales;
    return Math.round((completed / stats.totalSales) * 100);
  }, [stats.totalSales, stats.pendingSales]);

  const filteredSales = useMemo(() => {
    if (!searchQuery) return recentSales;
    return recentSales.filter(s => 
      (s.invoiceNo || s.id || '').toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recentSales, searchQuery]);

  const todayFormatted = new Date().toLocaleDateString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm font-bold" style={{ color: entry.color }}>
              {entry.name}: KES {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 sm:p-6 space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1a2a4a]">System Overview</h1>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back to Evopay VSCU POS</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
            stats.growthRate > 0 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : stats.growthRate < 0 
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            <TrendingUp className={`w-4 h-4 ${stats.growthRate < 0 ? 'rotate-180' : ''}`} />
            <span>{stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%</span>
            <span className="text-xs text-slate-500 hidden sm:inline">vs last week</span>
          </div>

          <button 
            onClick={() => { fetchDashboardData(); checkVSCU(); }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-200/60 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>

          <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 font-medium flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {todayFormatted}
          </div>
        </div>
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#f47b20]/5 to-transparent rounded-full -translate-y-6 translate-x-6"></div>
          <div className="flex justify-between items-start relative">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue</p>
              <h3 className="text-2xl font-extrabold text-[#1a2a4a] mt-1">
                KES {stats.totalRevenue.toLocaleString()}
              </h3>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>KES {stats.todayRevenue.toLocaleString()} today</span>
            <span className="text-slate-400 ml-1">| {stats.todaySales} orders</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Transactions</p>
              <h3 className="text-2xl font-extrabold text-[#1a2a4a] mt-1">
                {stats.totalSales.toLocaleString()}
              </h3>
            </div>
            <div className="p-2.5 bg-gradient-to-br from-orange-50 to-orange-100/50 text-[#f47b20] rounded-lg group-hover:scale-110 transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-slate-500">Avg Order:</span>
            <span className="font-semibold text-[#1a2a4a]">
              KES {stats.avgOrderValue.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory</p>
              <h3 className="text-2xl font-extrabold text-[#1a2a4a] mt-1">
                {stats.totalItems.toLocaleString()} <span className="text-xs font-normal text-slate-400">Items</span>
              </h3>
            </div>
            <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-lg group-hover:scale-110 transition">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 font-medium truncate">
            <span className="text-slate-400">Value:</span>
            <span className="text-slate-700 font-semibold">KES {stats.stockValue.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm group hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Sync</p>
              <h3 className={`text-2xl font-extrabold mt-1 ${stats.pendingSales > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {stats.pendingSales}
              </h3>
            </div>
            <div className={`p-2.5 rounded-lg transition ${
              stats.pendingSales > 0 
                ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 text-amber-600 group-hover:scale-110' 
                : 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-emerald-600 group-hover:scale-110'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500">Requires sync</span>
            <button 
              onClick={() => navigate('/sales')}
              className="text-[#f47b20] font-semibold hover:underline flex items-center gap-0.5"
            >
              Resolve <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-base font-bold text-[#1a2a4a] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#f47b20]" />
                Revenue & Tax Trend
              </h2>
              <p className="text-xs text-slate-400">Daily financial trajectory from completed sales</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {['7d', '30d', '90d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => handleTimeRangeChange(range)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      timeRange === range 
                        ? 'bg-white text-[#1a2a4a] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {range === '7d' ? '7D' : range === '30d' ? '30D' : '90D'}
                  </button>
                ))}
              </div>
              <span className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 font-medium rounded-md">
                KES
              </span>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f47b20" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f47b20" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a2a4a" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1a2a4a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `KES ${(value/1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#f47b20" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  name="Revenue"
                />
                <Area 
                  type="monotone" 
                  dataKey="tax" 
                  stroke="#1a2a4a" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorTax)" 
                  name="Tax"
                />
                <Line 
                  type="monotone" 
                  dataKey="salesCount" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={{ fill: '#10b981', r: 3 }} 
                  name="Orders"
                  yAxisId="right"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#f47b20]"></span>
              <span className="text-[10px] text-slate-500">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#1a2a4a]"></span>
              <span className="text-[10px] text-slate-500">Tax</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-500"></span>
              <span className="text-[10px] text-slate-500">Orders</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1a2a4a] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#f47b20]" />
                Compliance & Health
              </h2>
            </div>

            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-lg border border-slate-100 mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-600">eTIMS Compliance</span>
                <span className="text-sm font-bold text-[#1a2a4a]">{complianceRate}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 rounded-full ${
                    complianceRate >= 90 ? 'bg-emerald-500' : 
                    complianceRate >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${complianceRate}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                {complianceRate >= 90 ? 'Excellent' : complianceRate >= 60 ? 'Moderate' : 'Needs attention'}
              </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-lg border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">VSCU Middleware</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  vscuStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {vscuStatus.checking ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : vscuStatus.connected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  {vscuStatus.checking ? 'Checking...' : (vscuStatus.connected ? 'Online' : 'Offline')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Latency:</span>
                  <span className="font-semibold text-slate-700 ml-1">
                    {vscuStatus.latency ? `${vscuStatus.latency}ms` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Tax:</span>
                  <span className="font-semibold text-slate-700 ml-1">
                    KES {stats.totalTax.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                checkVSCU();
                setStatusCheckCounter(prev => prev + 1);
              }}
              className="w-full mt-3 text-xs font-medium text-slate-600 hover:text-[#1a2a4a] bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition text-center"
            >
              Re-test Middleware
            </button>
          </div>

          {/* Payment Distribution */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-[#1a2a4a] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#f47b20]" />
                Payment Distribution
              </h2>
            </div>
            {salesByPayment.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesByPayment}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {salesByPayment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend 
                      iconType="circle" 
                      iconSize={6}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      formatter={(value) => (
                        <span className="text-[10px] text-slate-600">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No payment data available
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Recent Sales + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#1a2a4a] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#f47b20]" />
                Recent Invoices
              </h2>
              <p className="text-xs text-slate-400">Latest synchronized and pending fiscal receipts</p>
            </div>
            
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Search invoice or client..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#f47b20]"
              />
            </div>
          </div>

          <RecentSales 
            sales={filteredSales} 
            loading={loading} 
            onViewAll={() => navigate('/sales')} 
          />
        </div>

        <div className="space-y-6">
          
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1a2a4a] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#f47b20]" />
                  Top Products
                </h2>
                <p className="text-xs text-slate-400">By gross revenue</p>
              </div>
              <button 
                onClick={() => navigate('/reports')}
                className="text-xs text-[#f47b20] hover:underline font-semibold"
              >
                All Reports →
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-[#f47b20] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : topItems.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No revenue records logged yet
              </div>
            ) : (
              <div className="space-y-3">
                {topItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 group">
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center justify-center w-6 h-6 text-xs font-bold rounded-md ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="max-w-[110px] sm:max-w-[140px] truncate">
                        <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-[#f47b20] transition">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.sold} units sold</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#1a2a4a]">
                      KES {item.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-base font-bold text-[#1a2a4a] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#f47b20]" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button 
                onClick={() => navigate('/sales')}
                className="flex items-center justify-center gap-1.5 bg-[#f47b20] hover:bg-[#e06d1a] text-white p-2.5 rounded-lg text-xs font-semibold transition hover:scale-105 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> New Sale
              </button>
              <button 
                onClick={() => navigate('/items')}
                className="flex items-center justify-center gap-1.5 bg-[#1a2a4a] hover:bg-[#0f1a33] text-white p-2.5 rounded-lg text-xs font-semibold transition hover:scale-105 active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" /> Items
              </button>
              <button 
                onClick={() => navigate('/reports')}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold transition hover:scale-105 active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" /> Reports
              </button>
              <button 
                onClick={() => navigate('/stock')}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white p-2.5 rounded-lg text-xs font-semibold transition hover:scale-105 active:scale-95"
              >
                <Package className="w-3.5 h-3.5" /> Stock
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-slate-200 text-xs text-slate-400 gap-2">
        <span>Last Synced: <strong className="text-slate-600">{lastUpdated || 'Initializing...'}</strong></span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Evopay VSCU Core v2.0.21 | KRA eTIMS Compliant
        </span>
      </div>

    </div>
  );
};

export default Dashboard;