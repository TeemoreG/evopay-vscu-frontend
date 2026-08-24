import React, { useRef, useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Helper function to format date/time
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

// Payment method mapping
const getPaymentLabel = (saleData) => {
  let method = null;
  
  const possibleFields = [
    'payment_method',
    'pmtTyCd',
    'paymentType',
    'payment',
    'paymentMethod',
    'pmtType'
  ];
  
  for (const field of possibleFields) {
    if (saleData[field] !== undefined && saleData[field] !== null && saleData[field] !== '') {
      method = String(saleData[field]).trim();
      break;
    }
  }
  
  if (method === '01' || method === '1') return 'Cash';
  if (method === '02' || method === '2') return 'Card';
  if (method === '03' || method === '3') return 'Mobile Money';
  
  const upper = (method || '').toUpperCase();
  if (upper === 'CASH') return 'Cash';
  if (upper === 'CARD' || upper === 'CREDIT' || upper === 'DEBIT') return 'Card';
  if (upper === 'MPESA' || upper === 'MOBILE' || upper === 'MOBILE MONEY') return 'Mobile Money';
  
  return method || 'N/A';
};

// Generate QR Code for KRA
const generateQRCodeDataURL = async (saleData) => {
  try {
    const dateObj = new Date(saleData.created_at || saleData.date || new Date().toISOString());
    const invoiceDate = String(dateObj.getDate()).padStart(2, '0') + 
                       String(dateObj.getMonth() + 1).padStart(2, '0') + 
                       dateObj.getFullYear();

    const invoiceTime = String(dateObj.getHours()).padStart(2, '0') + 
                       String(dateObj.getMinutes()).padStart(2, '0') + 
                       String(dateObj.getSeconds()).padStart(2, '0');

    const cuId = saleData.cuId || 'KRACU0300003735';
    const cuReceiptNumber = saleData.invoice_no || '1';
    const internalData = saleData.internal_data || '';
    const signature = saleData.vscu_signature || '';

    const qrString = `${invoiceDate}#${invoiceTime}#${cuId}#${cuReceiptNumber}#${internalData}#${signature}`;

    const qrImage = await QRCode.toDataURL(qrString, {
      width: 120,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return qrImage;
  } catch (error) {
    console.error('QR Code generation failed:', error);
    return null;
  }
};

// Generate QR string for tooltip
const getQRString = (saleData) => {
  try {
    const dateObj = new Date(saleData.created_at || saleData.date || new Date().toISOString());
    const invoiceDate = String(dateObj.getDate()).padStart(2, '0') + 
                       String(dateObj.getMonth() + 1).padStart(2, '0') + 
                       dateObj.getFullYear();
    const invoiceTime = String(dateObj.getHours()).padStart(2, '0') + 
                       String(dateObj.getMinutes()).padStart(2, '0') + 
                       String(dateObj.getSeconds()).padStart(2, '0');
    const cuId = saleData.cuId || 'KRACU0300003735';
    const cuReceiptNumber = saleData.invoice_no || '1';
    const internalData = saleData.internal_data || '';
    const signature = saleData.vscu_signature || '';
    
    return `${invoiceDate}#${invoiceTime}#${cuId}#${cuReceiptNumber}#${internalData}#${signature}`;
  } catch {
    return '';
  }
};

// Generate thermal receipt PDF - NOW ASYNC
export const generateThermalReceipt = async (saleData, logoRef = null) => {
  try {
    const items = saleData.items || [];
    let calculatedSubtotal = 0;
    let calculatedTax = 0;

    items.forEach((item) => {
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const amount = qty * price;
      calculatedSubtotal += amount;
      const taxType = item.tax_type || item.taxTyCd || 'B';
      const taxAmount = taxType === 'B' ? (amount * 16 / 116) : 0;
      calculatedTax += taxAmount;
    });

    const subtotal = saleData.subtotal || calculatedSubtotal || 0;
    const tax = saleData.tax || calculatedTax || 0;
    const total = saleData.total || subtotal || 0;

    // Generate QR Code FIRST (before PDF creation)
    let qrCodeDataURL = null;
    try {
      qrCodeDataURL = await generateQRCodeDataURL(saleData);
    } catch (qrError) {
      console.error('QR Code generation failed:', qrError);
    }

    // Dynamic height calculation
    const tempDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
    tempDoc.setFont('courier', 'normal');
    tempDoc.setFontSize(7);

    let calculatedItemsHeight = 0;
    items.forEach((item) => {
      const name = item.item_name || item.name || 'Unknown';
      const splitName = tempDoc.splitTextToSize(name, 30);
      const lines = splitName.length;
      calculatedItemsHeight += lines * 3.5 + 2;
    });

    const qrHeight = qrCodeDataURL ? 30 : 0;
    const staticHeight = 130 + qrHeight;
    const totalHeight = staticHeight + (items.length > 0 ? calculatedItemsHeight : 10);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, totalHeight],
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 5;
    const leftCol = margin;
    const rightCol = pageWidth - margin;

    const evopayBlue = [26, 42, 74];
    const evopayOrange = [244, 123, 32];

    let yPos = margin + 2;

    // Logo
    if (logoRef && logoRef.current && logoRef.current.complete && logoRef.current.naturalWidth !== 0) {
      const imgElement = logoRef.current;
      const originalWidth = imgElement.naturalWidth;
      const originalHeight = imgElement.naturalHeight;
      const logoHeight = 14;
      const logoWidth = (originalWidth / originalHeight) * logoHeight;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(imgElement, 'PNG', logoX, yPos, logoWidth, logoHeight);
      yPos += logoHeight + 3;
    } else {
      yPos += 3;
    }

    // Header
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
    doc.text('eTIMS Compliant Receipt', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
    doc.text(`Invoice: ${saleData.invoice_no || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Info Section
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);

    const paymentLabel = getPaymentLabel(saleData);
    const dateStr = formatDateTime(saleData.created_at || saleData.date || new Date().toISOString());
    const receiptTypes = { NS: 'Normal Sale', NC: 'Credit Note', CS: 'Copy', PS: 'Proforma' };

    doc.text(`Cashier: ${saleData.user_name || saleData.cashier || 'Unknown'}`, leftCol, yPos);
    doc.text(`Customer: ${saleData.customer || 'Walk-in Customer'}`, rightCol, yPos, { align: 'right' });
    yPos += 4;

    doc.text(`Date: ${dateStr}`, leftCol, yPos);
    doc.text(`Type: ${receiptTypes[saleData.rcptTyCd] || 'Normal Sale'}`, rightCol, yPos, { align: 'right' });
    yPos += 4;

    doc.text(`Payment: ${paymentLabel}`, leftCol, yPos);
    yPos += 4;

    if (saleData.customer_pin && saleData.customer_pin !== 'N/A' && saleData.customer_pin !== '') {
      doc.text(`PIN: ${saleData.customer_pin}`, leftCol, yPos);
      yPos += 4;
    }

    yPos += 1;

    // Divider
    doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Items Table
    if (items.length > 0) {
      const xItem = leftCol;
      const xQty = 50;
      const xPrice = 58;
      const xTotal = 72;

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);

      doc.text('ITEM', xItem, yPos);
      doc.text('QTY', xQty, yPos, { align: 'center' });
      doc.text('PRICE', xPrice, yPos, { align: 'center' });
      doc.text('TOTAL', xTotal, yPos, { align: 'center' });
      yPos += 3;

      doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.setLineWidth(0.15);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 3;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);

      items.forEach((item) => {
        const qty = item.quantity || 0;
        const price = item.price || 0;
        const amount = qty * price;
        const name = item.item_name || item.name || 'Unknown';

        const splitName = doc.splitTextToSize(name, 35);
        doc.text(splitName, xItem, yPos);

        const totalLines = splitName.length;
        const lineY = yPos + (totalLines - 1) * 3.5;

        doc.text(`${qty}`, xQty, lineY, { align: 'center' });
        doc.text(`${price.toFixed(2)}`, xPrice, lineY, { align: 'center' });
        doc.text(`${amount.toFixed(2)}`, xTotal, lineY, { align: 'center' });

        yPos += totalLines * 3.5 + 2;
      });

      yPos += 2;
      doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // Totals
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);

      doc.text('Subtotal:', leftCol, yPos);
      doc.text(`KES ${subtotal.toFixed(2)}`, rightCol, yPos, { align: 'right' });
      yPos += 4;

      doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.text('VAT (16%):', leftCol, yPos);
      doc.text(`KES ${tax.toFixed(2)}`, rightCol, yPos, { align: 'right' });
      yPos += 4;

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.text('TOTAL:', leftCol, yPos);
      doc.text(`KES ${total.toFixed(2)}`, rightCol, yPos, { align: 'right' });
      yPos += 5;

      doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // VSCU Status
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);

      const vscuSignature = saleData.synced === 1 && saleData.vscu_signature ? saleData.vscu_signature : null;
      if (saleData.synced === 1 && vscuSignature) {
        doc.setTextColor(0, 130, 0);
        doc.text('KRA eTIMS Verified', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      } else {
        doc.setTextColor(180, 120, 0);
        doc.text('Pending VSCU Sync', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }

      // SCU and CU
      doc.setTextColor(0, 0, 0);
      doc.text(`SCU: ${saleData.scuId || 'EVO-VSCU-001'}`, leftCol, yPos);
      doc.text(`CU: ${saleData.cuId || `CU-${String(Date.now()).slice(-6)}`}`, rightCol, yPos, { align: 'right' });
      yPos += 4;

      yPos += 1;
      doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // QR Code
      if (qrCodeDataURL) {
        const qrSize = 22;
        const qrX = (pageWidth - qrSize) / 2;
        try {
          doc.addImage(qrCodeDataURL, 'PNG', qrX, yPos, qrSize, qrSize);
          yPos += qrSize + 2;
          doc.setFont('courier', 'normal');
          doc.setFontSize(5);
          doc.setTextColor(100, 100, 100);
          doc.text('Scan to verify with KRA', pageWidth / 2, yPos, { align: 'center' });
          yPos += 4;
        } catch (qrError) {
          console.error('QR Code add to PDF failed:', qrError);
        }
      }

      yPos += 1;
      doc.setDrawColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // Footer
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(evopayBlue[0], evopayBlue[1], evopayBlue[2]);
      doc.text('Thank you for your business!', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      doc.setFont('courier', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text('KRA eTIMS VSCU v2.0.21', pageWidth / 2, yPos, { align: 'center' });
    } else {
      doc.text('No items found', margin, yPos + 5);
    }

    return doc;
  } catch (error) {
    console.error('Error generating thermal receipt:', error);
    return null;
  }
};

// Thermal Receipt Component for Preview Modal
const ThermalReceipt = ({ sale, onClose, onDownload, onPrint }) => {
  const logoRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrString, setQrString] = useState('');

  // Generate PDF for preview
  useEffect(() => {
    if (sale) {
      const generate = async () => {
        const doc = await generateThermalReceipt(sale, logoRef);
        if (doc) {
          const pdfBlob = doc.output('blob');
          const url = URL.createObjectURL(pdfBlob);
          setPdfUrl(url);
        }
      };
      generate();
    }
  }, [sale]);

  // Generate QR code for preview
  useEffect(() => {
    if (sale) {
      generateQRCodeDataURL(sale).then(qrImage => {
        setQrCodeData(qrImage);
        setQrString(getQRString(sale));
      });
    }
  }, [sale]);

  const handleDownload = async () => {
    try {
      console.log('Generating receipt for download...');
      console.log('Sale data:', sale);
      console.log('Logo ref:', logoRef.current);
      
      const doc = await generateThermalReceipt(sale, logoRef);
      
      console.log('Generated doc:', doc);
      
      if (!doc) {
        console.error('doc is null or undefined');
        toast.error('Failed to generate receipt. Please try again.');
        return;
      }
      
      if (typeof doc.save !== 'function') {
        console.error('doc.save is not a function. doc type:', typeof doc);
        toast.error('Receipt generation error. Please try again.');
        return;
      }
      
      doc.save(`receipt-${sale.invoice_no || Date.now()}.pdf`);
      if (onDownload) onDownload();
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Error downloading receipt: ' + error.message);
    }
  };

  const handlePrint = async () => {
    const doc = await generateThermalReceipt(sale, logoRef);
    if (doc) {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
    if (onPrint) onPrint();
  };

  const paymentLabel = getPaymentLabel(sale);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-[#1a2a4a]">Receipt Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="max-w-[80mm] mx-auto bg-white shadow-lg">
            <div className="p-4 font-mono text-[10px]" style={{ maxWidth: '80mm' }}>
              <div className="flex justify-center mb-2">
                <img 
                  ref={logoRef}
                  src="/evopay-logo.png" 
                  alt="Evopay Logo" 
                  className="h-12 object-contain"
                  onError={(e) => e.target.style.display = 'none'}
                />
              </div>

              <div className="text-center font-bold text-[#1a2a4a] text-xs">
                eTIMS Compliant Receipt
              </div>
              <div className="text-center font-bold text-[#1a2a4a] text-sm mt-1">
                Invoice: {sale.invoice_no || 'N/A'}
              </div>
              <hr className="border-[#1a2a4a] my-2" />

              <div className="text-[8px] leading-relaxed">
                <div className="flex justify-between">
                  <span>Cashier: {sale.user_name || sale.cashier || 'Unknown'}</span>
                  <span>Customer: {sale.customer || 'Walk-in Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date: {formatDateTime(sale.created_at || sale.date || new Date().toISOString())}</span>
                  <span>Type: Normal Sale</span>
                </div>
                <div>Payment: {paymentLabel}</div>
                {sale.customer_pin && sale.customer_pin !== 'N/A' && (
                  <div>PIN: {sale.customer_pin}</div>
                )}
              </div>

              <hr className="border-[#1a2a4a] my-2" />

              <div className="flex font-bold text-[#1a2a4a] text-[8px]">
                <div className="flex-1">ITEM</div>
                <div className="w-8 text-center">QTY</div>
                <div className="w-12 text-center">PRICE</div>
                <div className="w-14 text-center">TOTAL</div>
              </div>
              <hr className="border-[#1a2a4a] my-1" />

              <div className="text-[8px] leading-relaxed">
                {(sale.items || []).map((item, idx) => {
                  const qty = item.quantity || 0;
                  const price = item.price || 0;
                  const amount = qty * price;
                  const name = item.item_name || item.name || 'Unknown';
                  return (
                    <div key={idx} className="mb-1">
                      <div className="whitespace-normal break-words">{name}</div>
                      <div className="flex">
                        <div className="flex-1"></div>
                        <div className="w-8 text-center">{qty}</div>
                        <div className="w-12 text-center">{price.toFixed(2)}</div>
                        <div className="w-14 text-center">{amount.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <hr className="border-[#1a2a4a] my-2" />

              <div className="text-[10px] leading-relaxed">
                <div className="flex justify-between">
                  <span className="text-[#1a2a4a]">Subtotal:</span>
                  <span className="text-[#1a2a4a]">KES {(sale.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#1a2a4a]">VAT (16%):</span>
                  <span className="text-[#1a2a4a]">KES {(sale.tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#1a2a4a] text-sm">
                  <span>TOTAL:</span>
                  <span>KES {(sale.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <hr className="border-[#1a2a4a] my-2" />

              <div className="text-center text-[8px]">
                {sale.synced === 1 && sale.vscu_signature ? (
                  <div className="text-green-700">KRA eTIMS Verified</div>
                ) : (
                  <div className="text-amber-600">Pending VSCU Sync</div>
                )}
              </div>

              <div className="flex justify-between text-[8px] mt-1">
                <span>SCU: {sale.scuId || 'EVO-VSCU-001'}</span>
                <span>CU: {sale.cuId || `CU-${String(Date.now()).slice(-6)}`}</span>
              </div>

              <hr className="border-[#1a2a4a] my-2" />

              {qrCodeData && (
                <div className="text-center my-2 relative group">
                  <img 
                    src={qrCodeData} 
                    alt="KRA QR Code" 
                    className="mx-auto cursor-pointer"
                    style={{ width: '80px', height: '80px' }}
                    title={qrString || 'KRA QR Code'}
                  />
                  <div className="text-[6px] text-gray-600 mt-1">
                    Click to verify with KRA
                  </div>
                  {/* Tooltip with full data */}
                  {qrString && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-[8px] rounded-lg px-3 py-2 max-w-[300px] overflow-hidden text-ellipsis z-10 text-center">
                      <div className="break-all text-[7px]">{qrString}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-center text-[#1a2a4a] text-[10px]">
                Thank you for your business!
              </div>
              <div className="text-center text-gray-500 text-[7px]">
                KRA eTIMS VSCU v2.0.21
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            Print
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-[#1a2a4a] text-white rounded hover:bg-[#2a3a5a] transition"
          >
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThermalReceipt;