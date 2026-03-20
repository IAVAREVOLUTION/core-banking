import { useState } from 'react';
import { K_INVOICES, Invoice } from '@/app/data/mockData';
const efinanciaLogo = '';

export function AvisosView() {
  const [invoices] = useState<Invoice[]>(K_INVOICES);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const calculateCompliancePercentage = (totalPayment: number, totalAmount: number) => {
    if (totalAmount === 0) return '0.00';
    return ((totalPayment / totalAmount) * 100).toFixed(2);
  };

  const isOverdue = (dueDate: string, balance: number) => {
    const today = new Date();
    const due = new Date(dueDate);
    return due < today && balance > 0;
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section */}
      <div className="bg-primary-theme px-6 py-3 border-b border-gray-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-normal text-white">Avisos</h1>
              <p className="text-sm text-white/90">Consulta Avisos de Crédito</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="bg-white border border-gray-300 shadow-sm">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-primary-theme text-white">
                <tr>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Fecha de emisión</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Número de referencia</th>
                  <th className="text-right px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Monto total</th>
                  <th className="text-right px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Pago total</th>
                  <th className="text-right px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Saldo</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Estatus</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Condición de pago</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Periodo</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Observaciones</th>
                  <th className="text-left px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Fecha de vencimiento</th>
                  <th className="text-center px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">Alerta</th>
                  <th className="text-right px-3 py-2.5 font-medium border-r border-white/20 whitespace-nowrap">% Cumplimiento</th>
                  <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Origen</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center text-gray-500 text-sm">
                      No hay avisos registrados
                    </td>
                  </tr>
                ) : (
                  invoices
                    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
                    .map((invoice, index) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-gray-200 transition-colors"
                        style={{ backgroundColor: index % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                      >
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{formatDate(invoice.issueDate)}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{invoice.referenceNumber}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right border-r border-gray-200">{formatCurrency(invoice.totalAmount)}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right border-r border-gray-200">{formatCurrency(invoice.totalPayment)}</td>
                        <td className="px-3 py-2.5 text-gray-700 text-right border-r border-gray-200">{formatCurrency(invoice.balance)}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{invoice.status}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{invoice.paymentCondition}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{invoice.period}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{invoice.notes}</td>
                        <td className="px-3 py-2.5 text-gray-700 border-r border-gray-200">{formatDate(invoice.dueDate)}</td>
                        <td className="px-3 py-2.5 text-center border-r border-gray-200">
                          {isOverdue(invoice.dueDate, invoice.balance) && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="inline-block">
                              <circle cx="12" cy="12" r="10" fill="#DC2626"/>
                              <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-right border-r border-gray-200">
                          {calculateCompliancePercentage(invoice.totalPayment, invoice.totalAmount)}%
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{invoice.sourceModule}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}