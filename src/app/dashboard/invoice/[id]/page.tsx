'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, Download, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/billing/invoices/detail?id=${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setInvoice(data.invoice);
      });
  }, [id]);

  if (!invoice) return <div className="min-h-screen bg-black text-white flex items-center justify-center tech-font">Cargando Documento Neural...</div>;

  return (
    <div className="min-h-screen bg-[#050505] p-8 font-sans text-gray-200">
      <div className="max-w-4xl mx-auto">
        {/* Herramientas - No se imprimen */}
        <div className="flex justify-between items-center mb-8 no-print">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors">
            <ChevronLeft size={20} /> Volver al Panel
          </Link>
          <div className="flex gap-4">
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 transition-all">
              <Printer size={18} /> Imprimir PDF
            </button>
          </div>
        </div>

        {/* Factura Real */}
        <div className="bg-white text-black p-12 rounded-sm shadow-2xl invoice-paper overflow-hidden relative">
          {/* Marca de agua sutil */}
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <h1 className="text-8xl font-black rotate-12">BEDASOFT</h1>
          </div>

          <div className="flex justify-between mb-16">
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2">BEDASOFT.AI</h1>
              <p className="text-sm text-gray-500 uppercase tracking-widest">Plataforma de Inteligencia Artificial</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold uppercase mb-1">Factura</h2>
              <p className="text-gray-600 font-mono text-lg">{invoice.numFactura}</p>
              <p className="text-gray-400 text-xs mt-2">{new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-16">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Emisor</h3>
              <p className="font-bold">Bedasoft IA System</p>
              <p className="text-gray-600 text-sm">Calle de la Inteligencia, 101</p>
              <p className="text-gray-600 text-sm">28001 Madrid, España</p>
              <p className="text-gray-600 text-sm">CIF: B99887766</p>
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cliente</h3>
              <p className="font-bold text-xl">{invoice.client?.name || 'Venta Directa'}</p>
              <p className="text-gray-600 text-sm">{invoice.client?.address}</p>
              <p className="text-gray-600 text-sm">{invoice.client?.postalCode} {invoice.client?.city}</p>
              <p className="text-gray-600 text-sm">CIF: {invoice.client?.cif}</p>
            </div>
          </div>

          <table className="w-full mb-16">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-4 text-xs font-bold uppercase tracking-widest">Concepto</th>
                <th className="py-4 text-xs font-bold uppercase tracking-widest text-center">Cant.</th>
                <th className="py-4 text-xs font-bold uppercase tracking-widest text-right">Precio</th>
                <th className="py-4 text-xs font-bold uppercase tracking-widest text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lines.map((line: any, i: number) => (
                <tr key={i}>
                  <td className="py-6 font-medium">{line.description}</td>
                  <td className="py-6 text-center">{line.quantity}</td>
                  <td className="py-6 text-right">{line.unitPrice.toFixed(2)}€</td>
                  <td className="py-6 text-right font-bold">{line.totalPrice.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Base Imponible</span>
                <span>{(invoice.total / 1.21).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">IVA (21%)</span>
                <span>{(invoice.total - (invoice.total / 1.21)).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between py-4 text-2xl font-black bg-black text-white px-4 mt-4">
                <span>TOTAL</span>
                <span>{invoice.total.toFixed(2)}€</span>
              </div>
            </div>
          </div>

          <div className="mt-32 text-[10px] text-gray-400 border-t pt-8">
            <p>Esta factura ha sido generada mediante el Nodo Neural de Bedasoft. Registro Mercantil de Madrid Tomo 1234, Libro 56, Sección 7. Términos de pago: 30 días netos.</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-paper { box-shadow: none !important; padding: 0 !important; }
        }
        .invoice-paper { min-height: 297mm; }
      `}</style>
    </div>
  );
}
