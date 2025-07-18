
import { supabase } from '@/integrations/supabase/client';
import { QRCodeService, QRReceiptData } from './qrCodeService';

export interface SignatureFlowData {
  petitionId: string;
  voterName: string;
  voterPhone: string;
  voterId: string;
  constituency: string;
  ward: string;
  pollingStation?: string;
  voterEmail?: string;
}

export interface SignatureResult {
  success: boolean;
  signatureId?: string;
  receiptCode?: string;
  qrCode?: string;
  receiptData?: QRReceiptData;
  error?: string;
}

export class SignatureFlowService {
  static async processSignature(data: SignatureFlowData): Promise<SignatureResult> {
    try {
      // Check for duplicate signatures
      const { data: existingSignature, error: checkError } = await supabase
        .from('signatures')
        .select('id')
        .eq('petition_id', data.petitionId)
        .eq('voter_id', data.voterId)
        .single();

      if (existingSignature) {
        return {
          success: false,
          error: 'You have already signed this petition. Multiple signatures are not allowed.'
        };
      }

      // Create signature record
      const { data: signature, error: signatureError } = await supabase
        .from('signatures')
        .insert({
          petition_id: data.petitionId,
          voter_id: data.voterId,
          voter_name: data.voterName,
          constituency: data.constituency,
          ward: data.ward,
          polling_station: data.pollingStation,
          csp_provider: 'CAK-Licensed-CSP',
          verification_status: {
            verified: true,
            timestamp: new Date().toISOString(),
            method: 'digital_signature'
          }
        })
        .select()
        .single();

      if (signatureError) {
        throw signatureError;
      }

      // Generate QR receipt
      const qrResult = await QRCodeService.generateQRReceipt({
        signatureId: signature.id,
        petitionId: data.petitionId,
        voterName: data.voterName,
        voterPhone: data.voterPhone,
        constituency: data.constituency,
        ward: data.ward
      });

      // Create audit trail entry
      await supabase
        .from('audit_trail')
        .insert({
          action_type: 'signature_created',
          petition_id: data.petitionId,
          signature_id: signature.id,
          action_details: {
            voter_constituency: data.constituency,
            voter_ward: data.ward,
            receipt_code: qrResult.receiptCode,
            ip_address: await this.getClientIP(),
            user_agent: navigator.userAgent
          }
        });

      return {
        success: true,
        signatureId: signature.id,
        receiptCode: qrResult.receiptCode,
        qrCode: qrResult.qrCode,
        receiptData: qrResult.receiptData
      };

    } catch (error) {
      console.error('Signature processing error:', error);
      return {
        success: false,
        error: 'Failed to process signature. Please try again.'
      };
    }
  }

  static async verifySignature(receiptCode: string, lastFourDigits: string): Promise<{
    isValid: boolean;
    data?: QRReceiptData;
    error?: string;
  }> {
    return await QRCodeService.verifyQRReceipt(receiptCode, lastFourDigits);
  }

  static async renewSignature(receiptCode: string): Promise<{
    success: boolean;
    newReceiptCode?: string;
    error?: string;
  }> {
    return await QRCodeService.renewSignature(receiptCode);
  }

  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }
}
