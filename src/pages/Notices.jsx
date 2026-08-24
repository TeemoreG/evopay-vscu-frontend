import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getNotices, checkVSCUStatus } from '../api/vscuApi';
import axiosInstance from '../api/axiosConfig';

const Notices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vscuOnline, setVscuOnline] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState('');
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkVSCU();
    fetchLocalNotices();
  }, []);

  const checkVSCU = async () => {
    try {
      const response = await checkVSCUStatus();
      setVscuOnline(response.data?.online || false);
    } catch {
      setVscuOnline(false);
    }
  };

  const fetchLocalNotices = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/notices');
      setNotices(response.data || []);
    } catch (error) {
      console.error('Failed to fetch notices:', error);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notices from VSCU
  const fetchNoticesFromVSCU = async () => {
    if (!vscuOnline) {
      toast.error('VSCU is offline. Please start VSCU first.');
      return;
    }

    setFetching(true);
    try {
      const response = await getNotices(lastSyncDate || '20200101000000');
      
      console.log('Notices VSCU Response:', response.data);
      
      if (response.data?.resultCd === '000') {
        const noticeList = response.data?.data?.noticeList || [];
        
        if (noticeList.length > 0) {
          // Bulk save notices
          await axiosInstance.post('/api/notices/bulk', noticeList);
          await fetchLocalNotices();
          setLastSyncDate(new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14));
          toast.success(`Fetched ${noticeList.length} notices from KRA`);
        } else {
          toast.info('No notices found in KRA');
        }
      } else {
        toast.warning(response.data?.resultMsg || 'Failed to fetch notices');
      }
    } catch (error) {
      console.error('Failed to fetch notices from VSCU:', error);
      toast.error('Failed to fetch notices from KRA');
    } finally {
      setFetching(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Format YYYYMMDDHHMMSS to readable date
    if (dateStr.length === 14) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const hour = dateStr.slice(8, 10);
      const minute = dateStr.slice(10, 12);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return dateStr;
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const openNoticeDetail = (notice) => {
    setSelectedNotice(notice);
    setShowModal(true);
  };

  return (
    <div className="p-4">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2a4a]">Notices</h1>
          <p className="text-gray-500 text-sm">KRA announcements and updates</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fetchNoticesFromVSCU}
            disabled={fetching || !vscuOnline}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              fetching || !vscuOnline
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#1a2a4a] hover:bg-[#2a3a5a] text-white'
            }`}
            title={vscuOnline ? 'Fetch notices from KRA' : 'VSCU Offline'}
          >
            {fetching ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
              </svg>
            )}
            <span className="text-sm font-medium">
              {fetching ? 'Fetching...' : 'Get from KRA'}
            </span>
          </button>

          <button
            onClick={fetchLocalNotices}
            disabled={loading}
            className="bg-[#1a2a4a] hover:bg-[#0f1a33] text-white px-4 py-2 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.418 0V4h-5m5.582 0A9 9 0 1112 3" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* VSCU Status Bar */}
      <div className="flex items-center gap-3 mb-4 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100">
        <span className={`inline-block w-2 h-2 rounded-full ${vscuOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-xs font-medium text-gray-600">
          VSCU: {vscuOnline ? 'Online' : 'Offline'}
        </span>
        <div className="h-4 w-px bg-gray-200"></div>
        <span className="text-xs text-gray-500">
          {notices.length} notices
        </span>
        {lastSyncDate && (
          <>
            <div className="h-4 w-px bg-gray-200"></div>
            <span className="text-xs text-gray-400">Last sync: {lastSyncDate}</span>
          </>
        )}
        {!vscuOnline && (
          <span className="text-xs text-yellow-600 ml-auto">(VSCU offline - cannot fetch)</span>
        )}
      </div>

      {/* Notices Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-[#f47b20] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-gray-500">No notices found</p>
          <p className="text-sm text-gray-400 mt-1">Click "Get from KRA" to fetch latest notices</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notices.map((notice) => (
            <div
              key={notice.noticeNo || notice.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
              onClick={() => openNoticeDetail(notice)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#1a2a4a] text-white text-xs rounded-full font-medium">
                      #{notice.noticeNo || notice.id}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(notice.regDt || notice.created_at)}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1a2a4a] mb-2">
                    {notice.title || 'Untitled'}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {truncateText(notice.cont || notice.content || notice.description || '', 150)}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {notice.dtlUrl && (
                <a
                  href={notice.dtlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#f47b20] hover:underline mt-2 inline-block"
                  onClick={(e) => e.stopPropagation()}
                >
                  View full notice →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notice Detail Modal */}
      {showModal && selectedNotice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-semibold text-[#1a2a4a]">
                  {selectedNotice.title || 'Notice'}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Notice #{selectedNotice.noticeNo || selectedNotice.id} • {formatDate(selectedNotice.regDt || selectedNotice.created_at)}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {selectedNotice.cont || selectedNotice.content || selectedNotice.description || 'No content available'}
                </p>
              </div>
              
              {selectedNotice.dtlUrl && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <a
                    href={selectedNotice.dtlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#f47b20] hover:underline text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View full notice on KRA portal
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 text-sm bg-[#1a2a4a] hover:bg-[#0f1a33] text-white rounded-lg transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notices;