import React from 'react';

interface ShopQRCodeProps {
  link: string;
  size?: number;
}

// Semplice generatore QR basato su API pubblica (no dipendenze aggiuntive)
export const ShopQRCode: React.FC<ShopQRCodeProps> = ({ link, size = 200 }) => {
  const encoded = encodeURIComponent(link);
  const src = `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}`;

  return (
    <div className="flex flex-col items-center space-y-2">
      <img
        src={src}
        alt="QR code registrazione clienti"
        className="rounded border border-gray-200 shadow-sm"
        width={size}
        height={size}
      />
      <p className="text-xs text-gray-600 break-all text-center">{link}</p>
    </div>
  );
};


