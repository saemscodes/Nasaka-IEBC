
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Copy, Mail, RefreshCw, CheckCircle, Calendar, MapPin, User } from 'lucide-react';
import { QRReceiptData } from '@/utils/qrCodeService';
import { toast } from 'sonner';

interface QRReceiptViewerProps {
  qrCode: string;
  receiptCode: string;
  receiptData: QRReceiptData;
  voterName: string;
  voterEmail?: string;
  onRenew?: () => void;
  onEmailReceipt?: () => void;
}

const QRReceiptViewer: React.FC<QRReceiptViewerProps> = ({
  qrCode,
  receiptCode,
  receiptData,
  voterName,
  voterEmail,
  onRenew,
  onEmailReceipt
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const copyReceiptCode = () => {
    navigator.clipboard.writeText(receiptCode);
    toast.success('Receipt code copied to clipboard!');
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = `petition-receipt-${receiptCode}.png`;
    link.href = qrCode;
    link.click();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = () => {
    const now = new Date();
    const expiry = new Date(receiptData.expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiry = getDaysUntilExpiry();
  const isExpiringSoon = daysUntilExpiry <= 7;
  const isExpired = daysUntilExpiry <= 0;

  return (
    <Card className="w-full max-w-2xl mx-auto border-green-200 dark:border-green-700 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-gray-800">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-green-900 dark:text-green-100">
          Digital Signature Receipt
        </CardTitle>
        <p className="text-green-700 dark:text-green-300">
          Your petition signature has been recorded and secured
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* QR Code Display */}
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
            <img 
              src={qrCode} 
              alt="QR Receipt Code" 
              className="w-48 h-48 mx-auto"
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Scan this QR code to verify your signature later
          </p>
        </div>

        {/* Receipt Code */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Your Receipt Code:
              </label>
              <div className="font-mono text-lg font-bold text-green-700 dark:text-green-300 break-all">
                {receiptCode}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyReceiptCode}
              className="border-green-200 dark:border-green-600 text-green-700 dark:text-green-300"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expiry Status */}
        <Alert className={`${
          isExpired 
            ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/20' 
            : isExpiringSoon 
              ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20'
              : 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20'
        }`}>
          <Calendar className={`h-4 w-4 ${
            isExpired ? 'text-red-600 dark:text-red-400' 
            : isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400'
          }`} />
          <AlertDescription className={
            isExpired ? 'text-red-800 dark:text-red-200' 
            : isExpiringSoon ? 'text-yellow-800 dark:text-yellow-200'
            : 'text-green-800 dark:text-green-200'
          }>
            {isExpired ? (
              <span>
                <strong>Signature Expired</strong> - This signature expired on {formatDate(receiptData.expiresAt)}. 
                Click "Renew" to extend for another 60 days.
              </span>
            ) : isExpiringSoon ? (
              <span>
                <strong>Expiring Soon</strong> - This signature expires in {daysUntilExpiry} days on {formatDate(receiptData.expiresAt)}. 
                Consider renewing it.
              </span>
            ) : (
              <span>
                <strong>Valid Until</strong> {formatDate(receiptData.expiresAt)} ({daysUntilExpiry} days remaining)
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Signature Details */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-center text-green-700 dark:text-green-300"
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </Button>

          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-green-200 dark:border-green-700">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Signer</div>
                    <div className="font-medium">{voterName}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Location</div>
                    <div className="font-medium">{receiptData.ward}, {receiptData.constituency}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Signed At</div>
                  <div className="font-medium">{formatDate(receiptData.timestamp)}</div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">System Code</div>
                  <div className="font-mono text-sm">{receiptData.systemCode}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-green-200 dark:border-green-700">
          <Button
            onClick={downloadQRCode}
            variant="outline"
            className="flex-1 border-green-200 dark:border-green-600 text-green-700 dark:text-green-300"
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>

          {voterEmail && onEmailReceipt && (
            <Button
              onClick={onEmailReceipt}
              variant="outline"
              className="flex-1 border-green-200 dark:border-green-600 text-green-700 dark:text-green-300"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Receipt
            </Button>
          )}

          {(isExpired || isExpiringSoon) && onRenew && (
            <Button
              onClick={onRenew}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Renew Signature
            </Button>
          )}
        </div>

        {/* Security Notice */}
        <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Keep This Safe:</strong> Your receipt code is the only way to verify your signature later. 
            Store it securely and don't share it with others. This signature is legally binding under KICA §83C.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default QRReceiptViewer;
