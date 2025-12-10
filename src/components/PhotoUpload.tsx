import { useState, useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/Button';

interface PhotoUploadProps {
  onUpload: (file: File) => Promise<string>;
  currentImageUrl?: string;
  onRemove?: () => void;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
  allowPdf?: boolean;
  title?: string;
  subtitle?: string;
  helper?: string;
}

export const PhotoUpload = ({
  onUpload,
  currentImageUrl,
  onRemove,
  accept = 'image/*',
  maxSize = 5,
  className = '',
  allowPdf = false,
  title = 'Trascina un file qui',
  subtitle = 'o seleziona un file',
  helper = 'PNG, JPG, GIF fino a 5MB',
}: PhotoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File troppo grande. Massimo ${maxSize}MB.`);
      return;
    }

    // Validate file type (immagini) e opzionale PDF
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !(allowPdf && isPdf)) {
      setError(allowPdf ? 'Sono permessi solo immagini o PDF.' : 'Solo file immagine sono permessi.');
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      setError('Errore durante il caricamento. Riprova.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {currentImageUrl ? (
        <div className="relative">
          <img
            src={currentImageUrl}
            alt="Uploaded"
            className="w-full h-48 object-cover rounded-lg border border-gray-200"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRemove}
            className="absolute top-2 right-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              {isUploading ? (
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isUploading ? 'Caricamento...' : title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isUploading ? null : (
                  <>
                    {subtitle}{' '}
                    <button
                      type="button"
                      onClick={openFileDialog}
                      className="text-blue-600 hover:text-blue-500 underline"
                    >
                      seleziona
                    </button>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {helper || `PNG, JPG${allowPdf ? ', PDF' : ''} fino a ${maxSize}MB`}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
};
