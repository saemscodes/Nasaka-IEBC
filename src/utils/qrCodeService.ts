
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

export interface QRReceiptData {
  systemCode: string;
  userHash: string;
  petitionId: string;
  signatureId: string;
  constituency: string;
  ward: string;
  timestamp: string;
  expiresAt: string;
}

export class QRCodeService {
  private static generateSystemCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private static generateUserHash(name: string, phone: string, ward: string, constituency: string): string {
    const data = `${name}${phone}${ward}${constituency}`;
    // Simple hash implementation for browser compatibility
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(12, '0').substring(0, 12).toUpperCase();
  }

  static async generateQRReceipt(receiptData: {
    signatureId: string;
    petitionId: string;
    voterName: string;
    voterPhone: string;
    constituency: string;
    ward: string;
  }): Promise<{ qrCode: string; receiptCode: string; receiptData: QRReceiptData }> {
    const systemCode = this.generateSystemCode();
    const userHash = this.generateUserHash(
      receiptData.voterName,
      receiptData.voterPhone,
      receiptData.ward,
      receiptData.constituency
    );
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days

    const qrReceiptData: QRReceiptData = {
      systemCode,
      userHash,
      petitionId: receiptData.petitionId,
      signatureId: receiptData.signatureId,
      constituency: receiptData.constituency,
      ward: receiptData.ward,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    const receiptCode = `REC254-${systemCode}-${userHash}-${receiptData.petitionId.substring(0, 6)}`;
    
    // Generate QR code with receipt data
    const qrCodeData = JSON.stringify({
      code: receiptCode,
      data: qrReceiptData
    });

    const qrCodeOptions = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#15803d', // Green-700
        light: '#ffffff'
      },
      width: 256
    };

    const qrCode = await QRCode.toDataURL(qrCodeData, qrCodeOptions);

    // Store QR receipt in database using the correct table name
    await supabase
      .from('signatures')
      .update({
        verification_status: {
          ...receiptData,
          qr_receipt_code: receiptCode,
          qr_generated_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        }
      })
      .eq('id', receiptData.signatureId);

    return {
      qrCode,
      receiptCode,
      receiptData: qrReceiptData
    };
  }

  static async verifyQRReceipt(receiptCode: string, lastFourDigits: string): Promise<{
    isValid: boolean;
    data?: QRReceiptData;
    error?: string;
  }> {
    try {
      // Extract components from receipt code
      const parts = receiptCode.split('-');
      if (parts.length !== 4 || parts[0] !== 'REC254') {
        return { isValid: false, error: 'Invalid receipt code format' };
      }

      const [, systemCode, userHash, petitionPrefix] = parts;

      // Query database for matching signature using the correct table name
      const { data: signatures, error } = await supabase
        .from('signatures')
        .select('*')
        .contains('verification_status', { qr_receipt_code: receiptCode });

      if (error || !signatures || signatures.length === 0) {
        return { isValid: false, error: 'Receipt not found' };
      }

      const signature = signatures[0];
      const receiptData = signature.verification_status as any;

      // Check expiry
      if (new Date(receiptData.expires_at) < new Date()) {
        return { isValid: false, error: 'Receipt has expired' };
      }

      // Verify last 4 digits (this would normally check against encrypted ID fragments)
      // For demo purposes, we'll accept any 4 characters
      if (lastFourDigits.length !== 4) {
        return { isValid: false, error: 'Invalid verification digits' };
      }

      return {
        isValid: true,
        data: receiptData
      };
    } catch (error) {
      return { isValid: false, error: 'Verification failed' };
    }
  }

  static async renewSignature(receiptCode: string): Promise<{
    success: boolean;
    newReceiptCode?: string;
    error?: string;
  }> {
    try {
      const { data: signatures, error } = await supabase
        .from('signatures')
        .select('*')
        .contains('verification_status', { qr_receipt_code: receiptCode });

      if (error || !signatures || signatures.length === 0) {
        return { success: false, error: 'Receipt not found' };
      }

      const signature = signatures[0];
      const oldReceiptData = signature.verification_status as any;

      // Generate new receipt with extended expiry
      const newSystemCode = this.generateSystemCode();
      const newExpiresAt = new Date(Date.now() + (60 * 24 * 60 * 60 * 1000));
      const newReceiptCode = `REC254-${newSystemCode}-${oldReceiptData.userHash}-${oldReceiptData.petitionId.substring(0, 6)}`;

      // Update signature with renewed receipt
      const { error: updateError } = await supabase
        .from('signatures')
        .update({
          verification_status: {
            ...oldReceiptData,
            qr_receipt_code: newReceiptCode,
            renewed_at: new Date().toISOString(),
            expires_at: newExpiresAt.toISOString(),
            renewal_count: (oldReceiptData.renewal_count || 0) + 1
          }
        })
        .eq('id', signature.id);

      if (updateError) {
        return { success: false, error: 'Failed to renew signature' };
      }

      return { success: true, newReceiptCode };
    } catch (error) {
      return { success: false, error: 'Renewal failed' };
    }
  }
}
