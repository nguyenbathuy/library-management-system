import React, { useState, useRef } from 'react';
import {
  X, FileSpreadsheet, Download, UploadCloud, CheckCircle2,
  AlertTriangle, Loader2, Info, FileText, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { client } from '../api/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SkippedItem {
  row: number;
  title: string;
  isbn: string;
  reason: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  totalCopiesCreated?: number;
  skippedCount: number;
  imported: { title: string; isbn: string; copies: number }[];
  skipped: SkippedItem[];
  totalRows: number;
}

export function ImportExcelModal({ isOpen, onClose, onSuccess }: ImportExcelModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Vui lòng chọn định dạng file Excel (.xlsx hoặc .xls)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước file không được vượt quá 10MB');
      return;
    }
    setSelectedFile(file);
    setResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      // Try backend endpoint first
      try {
        const response = await client.get('/books/import-template', {
          responseType: 'blob'
        });
        const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', 'mau_nhap_sach_thu_vien.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(blobUrl);
        toast.success('Đã tải xuống file mẫu thành công!');
        return;
      } catch (err) {
        console.warn('Backend template download failed, generating client-side fallback:', err);
      }

      // Fallback: Generate client-side using xlsx
      const templateData = [
        {
          'Tiêu đề': 'Đắc Nhân Tâm',
          'Tác giả': 'Dale Carnegie',
          'Thể loại': 'Kỹ năng sống',
          'ISBN': '978-604-58-1234-5',
          'Số lượng bản sao': 5,
          'Nhà xuất bản': 'NXB Tổng Hợp TP.HCM',
          'Năm xuất bản': 2021,
          'Số trang': 320,
          'Ngôn ngữ': 'Tiếng Việt',
          'Mô tả': 'Nghệ thuật thu phục lòng người và giao tiếp ứng xử kinh điển.',
          'Ảnh bìa': 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=400'
        },
        {
          'Tiêu đề': 'Nhà Giả Kim',
          'Tác giả': 'Paulo Coelho',
          'Thể loại': 'Văn học nước ngoài',
          'ISBN': '978-604-58-6789-0',
          'Số lượng bản sao': 3,
          'Nhà xuất bản': 'NXB Hội Nhà Văn',
          'Năm xuất bản': 2020,
          'Số trang': 228,
          'Ngôn ngữ': 'Tiếng Việt',
          'Mô tả': 'Hành trình đi tìm kho báu và lắng nghe tiếng gọi của vũ trụ.',
          'Ảnh bìa': 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400'
        },
        {
          'Tiêu đề': 'Clean Code: A Handbook of Agile Software Craftsmanship',
          'Tác giả': 'Robert C. Martin',
          'Thể loại': 'Công nghệ thông tin',
          'ISBN': '978-013-23-5088-4',
          'Số lượng bản sao': 4,
          'Nhà xuất bản': 'Prentice Hall',
          'Năm xuất bản': 2008,
          'Số trang': 464,
          'Ngôn ngữ': 'Tiếng Anh',
          'Mô tả': 'Cẩm nang viết mã sạch và tư duy kỹ thuật phần mềm chuẩn mực.',
          'Ảnh bìa': 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?auto=format&fit=crop&q=80&w=400'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      worksheet['!cols'] = [
        { wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 },
        { wch: 26 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 45 }, { wch: 35 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'MauNhapSach');
      XLSX.writeFile(workbook, 'mau_nhap_sach_thu_vien.xlsx');
      toast.success('Đã tải xuống file mẫu thành công!');
    } catch (error) {
      console.error('Error generating template:', error);
      toast.error('Không thể tạo file mẫu');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn một file Excel (.xlsx hoặc .xls)');
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data } = await client.post('/books/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResult(data);

      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'] });
      queryClient.invalidateQueries({ queryKey: ['top-books'] });
      queryClient.invalidateQueries({ queryKey: ['all-loans'] });

      const copiesText = data.totalCopiesCreated ? ` (${data.totalCopiesCreated} cuốn bản sao)` : '';
      const skippedText = data.skippedCount > 0 ? `, bỏ qua ${data.skippedCount} cuốn do trùng mã hoặc lỗi` : '';
      const toastMsg = data.message || `Đã thêm thành công ${data.importedCount || 0} đầu sách${copiesText}${skippedText}`;

      if (data.skippedCount > 0 && data.importedCount === 0) {
        toast.warning(toastMsg, { duration: 6000 });
      } else {
        toast.success(toastMsg, { duration: 6000 });
      }

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      const errMsg = error.response?.data?.error || error.message || 'Có lỗi xảy ra khi tải file lên';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Thêm sách hàng loạt từ file Excel (Bulk Import)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Nhập kho nhiều đầu sách tự động, tạo bản sao vật lý và gắn barcode chuẩn hóa.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Template Download Card */}
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  File mẫu chuẩn định dạng
                </h4>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Bao gồm các cột: <strong>Tiêu đề</strong>, <strong>Tác giả</strong>, <strong>Thể loại</strong>, <strong>ISBN</strong>, <strong>Số lượng bản sao</strong>, NXB, Năm XB...
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              className="gap-2 bg-white dark:bg-gray-800 hover:bg-blue-50 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold shrink-0 shadow-xs"
            >
              {isDownloadingTemplate ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              Tải file mẫu (Template)
            </Button>
          </div>

          {/* Upload / Drag & Drop Area */}
          {!result && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls"
                className="hidden"
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-gray-300 dark:border-gray-700 hover:border-emerald-500 hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full">
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Kéo thả file Excel vào đây hoặc <span className="text-emerald-600 hover:underline">duyệt tìm file</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Hỗ trợ định dạng .xlsx, .xls (Kích thước tối đa 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0">
                      <FileText size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Sẵn sàng import
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      Đổi file
                    </Button>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      disabled={isLoading}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Summary after Import */}
          {result && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Summary Card */}
              <div className="p-4 rounded-xl border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  {result.importedCount > 0 ? (
                    <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={22} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {result.message}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tổng số dòng: {result.totalRows} | Thành công: <strong className="text-emerald-600">{result.importedCount}</strong> đầu sách ({result.totalCopiesCreated || 0} bản sao) | Bỏ qua: <strong className="text-rose-600">{result.skippedCount}</strong> cuốn
                    </p>
                  </div>
                </div>
              </div>

              {/* List of Skipped Books (Duplicates / Errors) */}
              {result.skipped && result.skipped.length > 0 && (
                <div className="border border-amber-200 dark:border-amber-900/50 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertCircle size={14} /> Danh sách bỏ qua ({result.skipped.length} cuốn)
                    </span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      Do trùng mã ISBN hoặc thiếu thông tin
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-amber-100 dark:divide-amber-950/40 p-2 text-xs">
                    {result.skipped.map((item, idx) => (
                      <div key={idx} className="p-2 space-y-0.5 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 rounded">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            Dòng {item.row}: {item.title}
                          </span>
                          <span className="font-mono text-[11px] text-gray-500">
                            ISBN: {item.isbn}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Lý do: {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* List of Imported Books */}
              {result.imported && result.imported.length > 0 && (
                <div className="border border-emerald-200 dark:border-emerald-900/50 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle size={14} /> Danh sách đã thêm ({result.imported.length} đầu sách)
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-emerald-100 dark:divide-emerald-950/40 p-2 text-xs">
                    {result.imported.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded">
                        <span className="font-medium text-gray-900 dark:text-white truncate pr-4">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0 font-medium">
                          {item.copies} cuốn
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            {result ? 'Đóng' : 'Hủy'}
          </Button>

          {!result ? (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang xử lý import...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Bắt đầu Import
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setResult(null);
              }}
              variant="outline"
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
            >
              <UploadCloud size={15} />
              Import tiếp file khác
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
