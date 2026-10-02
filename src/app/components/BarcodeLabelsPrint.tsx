import { forwardRef } from 'react';
import Barcode from 'react-barcode';
import { BookItem } from './BooksManagement';

interface BarcodeLabelsPrintProps {
  libraryName?: string;
  bookTitle: string;
  items: BookItem[];
}

export const BarcodeLabelsPrint = forwardRef<HTMLDivElement, BarcodeLabelsPrintProps>(
  ({ libraryName = 'THƯ VIỆN PKA', bookTitle, items }, ref) => {
    return (
      <div ref={ref} className="p-4 bg-white text-black font-sans">
        <style type="text/css" media="print">
          {`
            @page {
              size: A4;
              margin: 10mm;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .barcode-label-grid {
                display: grid !important;
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 8mm !important;
              }
              .barcode-label-card {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}
        </style>

        <div className="barcode-label-grid grid grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id || item.barcode}
              className="barcode-label-card border-2 border-dashed border-gray-400 rounded-lg p-2.5 flex flex-col items-center justify-between text-center bg-white min-h-[145px] w-full"
              style={{ boxSizing: 'border-box' }}
            >
              {/* Header: Library & Title */}
              <div className="w-full pb-1 mb-1 border-b border-gray-300">
                <p className="text-[11px] font-black tracking-wider text-gray-900 uppercase">
                  {libraryName}
                </p>
                <p className="text-[10px] font-semibold text-gray-800 line-clamp-1 truncate" title={bookTitle}>
                  {bookTitle}
                </p>
              </div>

              {/* Barcode SVG */}
              <div className="my-1 flex items-center justify-center overflow-hidden">
                <Barcode
                  value={item.barcode}
                  width={1.3}
                  height={38}
                  fontSize={11}
                  margin={0}
                  displayValue={true}
                  font="monospace"
                />
              </div>

              {/* Footer: Location & Status */}
              <div className="w-full pt-1 mt-1 border-t border-gray-300 flex justify-between items-center text-[9px] text-gray-600 font-medium">
                <span>Vị trí: <strong>{item.location || 'Khu A - Kệ 1'}</strong></span>
                <span className="uppercase text-[8px] bg-gray-100 px-1 py-0.5 rounded border border-gray-300 font-bold">
                  {item.status || 'AVAILABLE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

BarcodeLabelsPrint.displayName = 'BarcodeLabelsPrint';
