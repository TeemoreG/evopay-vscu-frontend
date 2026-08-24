import React, { useMemo, useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import evopayLogo from '../../assets/evopay-logo.png';
import { getSettings } from '../../api/vscuApi';

const SaleReceipt = ({ sale, onClose }) => {
  const logoRef = useRef(null);
  const [settings, setSettings] = useState({
    receipt_footer: 'Thank you for your business',
    company_name: 'Evopay Limited'
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getSettings();
        if (response.data) {
          setSettings(prev => ({ ...prev, ...response.data }));
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  if (!sale) return null;

  const receiptNo = useMemo(() => {
    return sale.receiptNo || sale.invoice_no || `RCP-${String(Date.now()).slice(-8)}`;
  }, [sale]);

  const scuId = useMemo(() => sale.scuId || 'EVO-VSCU-001', [sale]);
  const cuId = useMemo(() => sale.cuId || `CU-${String(Date.now()).slice(-6)}`, [sale]);
  
  const vscuSignature = useMemo(() => {
    if (sale.synced === 1 && sale.vscu_signature) {
      return sale.vscu_signature;
    }
    return null;
  }, [sale]);

  const receiptTypes = {
    'NS': 'Normal Sale',
    'NC': 'Normal Credit Note',
    'CS': 'Copy Sale',
    'PS': 'Proforma Sale'
  };

  const taxLabels = {
    'A': 'Exempt (0%)',
    'B': 'Standard (16%)',
    'C': 'Zero Rated (0%)'
  };

  const paymentLabels = {
    '01': 'Cash',
    '02': 'Card',
    '03': 'Mobile Money'
  };

  const calculatedData = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let total = 0;
    const breakdown = {};

    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach(item => {
        const qty = item.quantity || 0;
        const price = item.price || 0;
        const amount = qty * price;
        subtotal += amount;

        const taxType = item.tax_type || item.taxTyCd || 'B';
        let taxRate = 0;
        if (taxType === 'B') taxRate = 0.16;
        else if (taxType === 'A' || taxType === 'C') taxRate = 0;

        const taxAmount = amount * (taxRate / (1 + taxRate));
        tax += taxAmount;
        total += amount;

        if (!breakdown[taxType]) {
          breakdown[taxType] = { count: 0, taxAmount: 0 };
        }
        breakdown[taxType].count += 1;
        breakdown[taxType].taxAmount += taxAmount;
      });
    }

    return { subtotal, tax, total, breakdown };
  }, [sale.items]);

  const subtotal = calculatedData.subtotal;
  const tax = calculatedData.tax;
  const total = calculatedData.total;
  const taxBreakdown = calculatedData.breakdown;

  const customerName = sale.customer || 'Walk-in Customer';
  const cashierName = sale.cashier || 'Unknown';
  
  const paymentMethod = sale.pmtTyCd || sale.payment_method || '01';
  const paymentLabel = paymentLabels[paymentMethod] || paymentMethod || 'N/A';

  const formatDateTime = (dateStr) => {
    if (!dateStr) return new Date().toLocaleString();
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-KE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return dateStr;
    }
  };

  const displayDateTime = sale.created_at || sale.date || new Date().toISOString();

  const downloadPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let yPos = 20;

      // Logo at top center
      const imgElement = logoRef.current;
      if (imgElement && imgElement.complete && imgElement.naturalWidth !== 0) {
        const originalWidth = imgElement.naturalWidth;
        const originalHeight = imgElement.naturalHeight;
        const logoHeight = 20;
        const logoWidth = (originalWidth / originalHeight) * logoHeight;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(imgElement, 'PNG', logoX, 6, logoWidth, logoHeight);
        yPos = 32;
      }

      // Business Name
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 42, 74);
      doc.text(settings.company_name || 'Evopay VSCU', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Receipt title
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('KRA eTIMS Compliant Receipt', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      
      // Receipt number
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`Receipt #${receiptNo}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 5;

      // Header info
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      doc.text(`Cashier: ${cashierName}`, 14, yPos);
      doc.text(`Date: ${formatDateTime(displayDateTime)}`, pageWidth - 14, yPos, { align: 'right' });
      yPos += 4.5;
      
      doc.text(`Customer: ${customerName}`, 14, yPos);
      if (sale.customer_pin && sale.customer_pin !== 'N/A') {
        doc.text(`PIN: ${sale.customer_pin}`, 14, yPos + 4.5);
        yPos += 4.5;
      }
      doc.text(`Invoice: ${sale.invoice_no || 'N/A'}`, pageWidth - 14, yPos, { align: 'right' });
      yPos += 4.5;
      
      doc.text(`Payment: ${paymentLabel}`, 14, yPos);
      doc.text(`Type: ${receiptTypes[sale.rcptTyCd] || 'Sale'}`, pageWidth - 14, yPos, { align: 'right' });
      yPos += 8;

      // Items Table
      const tableData = Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items.map(item => {
            const qty = item.quantity || 0;
            const price = item.price || 0;
            const amount = qty * price;
            return [
              item.item_name || item.name || 'Unknown',
              `${qty}`,
              `KES ${price.toLocaleString()}`,
              `KES ${amount.toLocaleString()}`
            ];
          })
        : [['No items', '', '', '']];

      doc.autoTable({
        startY: yPos,
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'plain',
        headStyles: { 
          fillColor: [245, 245, 245], 
          textColor: [26, 42, 74],
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        styles: { textColor: [40, 40, 40] },
      });

      let finalY = doc.lastAutoTable.finalY + 6;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(14, finalY, pageWidth - 14, finalY);
      finalY += 6;

      // Totals
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      doc.text(`Subtotal:`, pageWidth - 70, finalY);
      doc.text(`KES ${subtotal.toLocaleString()}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 4.5;
      
      doc.setTextColor(244, 123, 32);
      doc.text(`VAT (16%):`, pageWidth - 70, finalY);
      doc.text(`KES ${tax.toLocaleString()}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 5;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 42, 74);
      doc.text(`TOTAL:`, pageWidth - 70, finalY);
      doc.text(`KES ${total.toLocaleString()}`, pageWidth - 14, finalY, { align: 'right' });
      finalY += 8;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(14, finalY, pageWidth - 14, finalY);
      finalY += 6;

      // VSCU Info
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      
      if (sale.synced === 1 && vscuSignature) {
        doc.text(`VSCU Signature: ${vscuSignature}`, 14, finalY);
        finalY += 4;
        doc.text(`SCU ID: ${scuId} | CU ID: ${cuId}`, 14, finalY);
        finalY += 6;
        doc.setTextColor(0, 150, 0);
        doc.text('KRA eTIMS Verified ✅', pageWidth / 2, finalY, { align: 'center' });
        finalY += 6;
      } else {
        doc.setTextColor(194, 180, 0);
        doc.text('Pending VSCU Sync', 14, finalY);
        finalY += 4;
        doc.setTextColor(100, 100, 100);
        doc.text(`SCU ID: ${scuId} | CU ID: ${cuId}`, 14, finalY);
        finalY += 6;
        doc.text('Pending VSCU Verification', pageWidth / 2, finalY, { align: 'center' });
        finalY += 6;
      }

      // Footer - from settings
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(settings.receipt_footer || 'Thank you for your business', pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.save(`receipt-${receiptNo}.pdf`);
    } catch (error) {
      console.error('PDF Download Error:', error);
      alert('Error downloading PDF: ' + error.message);
    }
  };

  const exportCSV = () => {
    try {
      const lines = [];

      lines.push('"Evopay VSCU Cashier System"');
      lines.push('"Tax Receipt"');
      lines.push(`"Receipt: ${receiptNo}"`);
      lines.push(`"Cashier: ${cashierName}"`);
      lines.push(`"Customer: ${customerName}"`);
      if (sale.customer_pin && sale.customer_pin !== 'N/A') {
        lines.push(`"PIN: ${sale.customer_pin}"`);
      }
      lines.push(`"Date/Time: ${formatDateTime(displayDateTime)}"`);
      lines.push(`"Invoice: ${sale.invoice_no || 'N/A'}"`);
      lines.push(`"Payment: ${paymentLabel}"`);
      lines.push('');

      lines.push('Item,Quantity,Price (KES),Total (KES)');

      if (Array.isArray(sale.items) && sale.items.length > 0) {
        sale.items.forEach(item => {
          const qty = item.quantity || 0;
          const price = item.price || 0;
          const amount = qty * price;
          lines.push(`"${item.item_name || item.name || 'Unknown'}",${qty},${price.toFixed(2)},${amount.toFixed(2)}`);
        });
      } else {
        lines.push('"No items",0,0.00,0.00');
      }

      lines.push('');
      lines.push(`"Subtotal",,,${subtotal.toFixed(2)}`);
      lines.push(`"VAT (16%)",,,${tax.toFixed(2)}`);
      lines.push(`"Total",,,${total.toFixed(2)}`);

      lines.push('');
      if (sale.synced === 1 && vscuSignature) {
        lines.push(`"VSCU Signature: ${vscuSignature}"`);
        lines.push(`"SCU ID: ${scuId} | CU ID: ${cuId}"`);
        lines.push('"Status: KRA eTIMS Verified"');
      } else {
        lines.push(`"SCU ID: ${scuId} | CU ID: ${cuId}"`);
        lines.push('"Status: Pending VSCU Sync"');
      }
      lines.push('');
      lines.push(`"Generated: ${new Date().toLocaleString()}"`);
      lines.push(`"${settings.receipt_footer || 'Thank you for your business'}"`);
      lines.push('"Evopay Limited | KRA eTIMS Compliant"');

      const csvContent = lines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNo}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV Export Error:', error);
      alert('Error exporting CSV: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              max-width: 100%;
              box-shadow: none;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div
        id="printable-receipt"
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="text-center border-b pb-3 mb-3">
          <div className="flex justify-center items-center mb-2 min-h-[48px]">
            <img 
              ref={logoRef}
              src={evopayLogo}
              alt="Evopay Logo" 
              className="h-10 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                if (!e.target.parentNode.querySelector('.fallback-logo')) {
                  const fallback = document.createElement('span');
                  fallback.className = 'fallback-logo text-xl font-bold text-[#1a2a4a]';
                  fallback.textContent = 'Evopay';
                  e.target.parentNode.appendChild(fallback);
                }
              }}
            />
          </div>
          <h2 className="text-lg font-bold text-[#1a2a4a]">{settings.company_name || 'Evopay VSCU'}</h2>
          <p className="text-xs text-gray-500">KRA eTIMS Compliant Receipt</p>
          <p className="text-xs text-gray-400 mt-1">Receipt #{receiptNo}</p>
        </div>

        {/* Info */}
        <div className="mb-3 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Cashier: {cashierName}</span>
            <span>Date: {formatDateTime(displayDateTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer: {customerName}</span>
            <span>Invoice: {sale.invoice_no || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment: {paymentLabel}</span>
            <span>Type: {receiptTypes[sale.rcptTyCd] || 'Sale'}</span>
          </div>
          {sale.customer_pin && sale.customer_pin !== 'N/A' && (
            <div>PIN: {sale.customer_pin}</div>
          )}
        </div>

        {/* Items Table */}
        <div className="border-t border-b py-2 mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-1 font-medium">Item</th>
                <th className="pb-1 text-center font-medium">Qty</th>
                <th className="pb-1 text-right font-medium">Price</th>
                <th className="pb-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(sale.items) && sale.items.length > 0 ? (
                sale.items.map((item, index) => {
                  const qty = item.quantity || 0;
                  const price = item.price || 0;
                  const amount = qty * price;
                  return (
                    <tr key={item.id || index} className="border-b border-gray-50">
                      <td className="py-1 text-[#1a2a4a]">{item.item_name || item.name || 'Unknown'}</td>
                      <td className="py-1 text-center">{qty}</td>
                      <td className="py-1 text-right">KES {price.toLocaleString()}</td>
                      <td className="py-1 text-right font-medium">KES {amount.toLocaleString()}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-2 text-gray-400">No items</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Subtotal:</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">VAT (16%):</span>
            <span className="text-[#f47b20]">KES {tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
            <span className="text-[#1a2a4a]">TOTAL:</span>
            <span className="text-[#f47b20]">KES {total.toLocaleString()}</span>
          </div>
        </div>

        {/* VSCU Info */}
        {sale.synced === 1 && vscuSignature ? (
          <div className="text-center text-[10px] text-gray-400 border-t pt-2 mb-2">
            <p className="text-green-600 font-medium">✅ KRA eTIMS Verified</p>
            <p>VSCU Signature: {vscuSignature}</p>
            <p>SCU ID: {scuId} | CU ID: {cuId}</p>
          </div>
        ) : (
          <div className="text-center text-[10px] border-t pt-2 mb-2">
            <p className="text-yellow-600 font-medium">Pending VSCU Sync</p>
            <p className="text-gray-400">This receipt will be verified when VSCU is online</p>
            <p className="text-gray-400">SCU ID: {scuId} | CU ID: {cuId}</p>
          </div>
        )}

        {/* Footer - from settings */}
        <div className="text-center text-xs text-gray-400 border-t pt-2 mt-2">
          <p>{settings.receipt_footer || 'Thank you for your business'}</p>
          <p className="text-[10px] text-gray-300 mt-1">KRA eTIMS VSCU v2.0.21</p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t no-print">
          <button
            type="button"
            onClick={downloadPDF}
            className="flex-1 bg-[#f47b20] hover:bg-[#e06d1a] text-white px-3 py-1.5 rounded-lg transition text-xs font-medium"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-[#1a2a4a] hover:bg-[#2a3a5a] text-white px-3 py-1.5 rounded-lg transition text-xs font-medium"
          >
            Print
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition text-xs font-medium"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleReceipt;