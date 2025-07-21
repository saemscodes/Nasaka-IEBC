
import { supabase } from '@/integrations/supabase/client';
import { QRCodeService, QRReceiptData } from './qrCodeService';
import { BlockchainService, BlockchainHashData } from './blockchainService';
import { signPetitionData, verifySignatureLocally, getKeyInfo, generateKeyPair } from './cryptoService';

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
  blockchainHash?: string;
  cryptoSignature?: string;
  publicKey?: JsonWebKey;
  deviceId?: string;
  error?: string;
}

export class SignatureFlowService {
  static async processSignature(data: SignatureFlowData, petitionTitle?: string): Promise<SignatureResult> {
    try {
      console.log('🚀 Starting signature processing with crypto integration');
      
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

      // Generate cryptographic signature
      console.log('🔐 Generating cryptographic signature...');
      const cryptoResult = await signPetitionData(
        { petitionId: data.petitionId, petitionTitle: petitionTitle || 'Petition' },
        data,
        'PETITION_SIGNATURE'
      );

      // Verify signature locally for immediate validation
      const verification = await verifySignatureLocally(cryptoResult);
      if (!verification.isValid) {
        throw new Error('Cryptographic signature verification failed');
      }

      console.log('✅ Cryptographic signature verified locally');

      // Get key information
      const keyInfo = await getKeyInfo();

      // Create signature record with crypto data
      const { data: signature, error: signatureError } = await supabase
        .from('signatures')
        .insert({
          petition_id: data.petitionId,
          voter_id: data.voterId,
          voter_name: data.voterName,
          constituency: data.constituency,
          ward: data.ward,
          polling_station: data.pollingStation,
          csp_provider: 'CAK-Licensed-CSP-WebCrypto',
          signature_certificate: JSON.stringify({
            cryptoSignature: cryptoResult.signature,
            publicKey: cryptoResult.publicKeyJwk,
            payload: cryptoResult.payload,
            keyVersion: cryptoResult.keyVersion,
            deviceId: cryptoResult.deviceId,
            algorithm: 'ECDSA-P384-SHA384',
            verified: true
          }),
          verification_status: {
            verified: true,
            crypto_verified: true,
            timestamp: new Date().toISOString(),
            method: 'digital_signature_ecdsa',
            keyVersion: cryptoResult.keyVersion,
            deviceId: cryptoResult.deviceId
          },
          device_fingerprint: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            crypto_algorithm: 'ECDSA-P384-SHA384',
            hasKeys: keyInfo.hasKeys,
            deviceId: keyInfo.deviceId,
            keyVersion: keyInfo.keyVersion,
            created: keyInfo.created
          }
        })
        .select()
        .single();

      if (signatureError) {
        throw signatureError;
      }

      console.log('📝 Signature record created in database');

      // Generate blockchain hash
      const voterHash = BlockchainService.createVoterHash(data.voterId, data.voterName);
      const blockchainHashData: BlockchainHashData = {
        signatureId: signature.id,
        petitionId: data.petitionId,
        voterHash,
        timestamp: signature.signature_timestamp,
        wardConstituency: `${data.ward}-${data.constituency}`
      };

      const blockchainHash = await BlockchainService.generateBlockchainHash(blockchainHashData);
      
      // Store blockchain hash
      await BlockchainService.storeBlockchainHash(signature.id, blockchainHash);

      console.log('⛓️ Blockchain hash generated and stored');

      // Generate QR receipt with crypto info
      const qrResult = await QRCodeService.generateQRReceipt({
        signatureId: signature.id,
        petitionId: data.petitionId,
        voterName: data.voterName,
        voterPhone: data.voterPhone,
        constituency: data.constituency,
        ward: data.ward
      });

      console.log('📱 QR receipt generated');

      // Create comprehensive audit trail entry
      await supabase
        .from('audit_trail')
        .insert({
          action_type: 'signature_created_with_crypto',
          petition_id: data.petitionId,
          signature_id: signature.id,
          action_details: {
            voter_constituency: data.constituency,
            voter_ward: data.ward,
            receipt_code: qrResult.receiptCode,
            blockchain_hash: blockchainHash,
            crypto_signature_hash: await this.hashString(cryptoResult.signature),
            key_version: cryptoResult.keyVersion,
            device_id: cryptoResult.deviceId,
            verification_method: 'ECDSA-P384-SHA384',
            ip_address: await this.getClientIP(),
            user_agent: navigator.userAgent,
            crypto_verified: true
          }
        });

      console.log('📋 Audit trail recorded');

      return {
        success: true,
        signatureId: signature.id,
        receiptCode: qrResult.receiptCode,
        qrCode: qrResult.qrCode,
        receiptData: qrResult.receiptData,
        blockchainHash,
        cryptoSignature: cryptoResult.signature,
        publicKey: cryptoResult.publicKeyJwk,
        deviceId: cryptoResult.deviceId
      };

    } catch (error) {
      console.error('Signature processing error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process signature. Please try again.'
      };
    }
  }

  static async verifySignature(receiptCode: string, lastFourDigits: string): Promise<{
    isValid: boolean;
    data?: QRReceiptData;
    blockchainValid?: boolean;
    cryptoValid?: boolean;
    error?: string;
  }> {
    try {
      console.log('🔍 Starting signature verification...');
      
      const qrResult = await QRCodeService.verifyQRReceipt(receiptCode, lastFourDigits);
      
      if (!qrResult.isValid || !qrResult.data) {
        return qrResult;
      }

      console.log('📱 QR receipt verified');

      // Get signature with crypto data
      const { data: signature } = await supabase
        .from('signatures')
        .select('blockchain_hash, signature_certificate, verification_status')
        .eq('id', qrResult.data.signatureId)
        .single();

      let blockchainValid = false;
      let cryptoValid = false;

      // Verify blockchain hash
      if (signature?.blockchain_hash) {
        const blockchainVerification = await BlockchainService.verifyBlockchainHash(
          qrResult.data.signatureId,
          signature.blockchain_hash
        );
        blockchainValid = blockchainVerification.isValid;
        console.log('⛓️ Blockchain verification:', blockchainValid ? '✅' : '❌');
      }

      // Verify cryptographic signature if available
      if (signature?.signature_certificate) {
        try {
          const certData = JSON.parse(signature.signature_certificate);
          if (certData.cryptoSignature && certData.publicKey && certData.payload) {
            const cryptoVerification = await verifySignatureLocally({
              payload: certData.payload,
              signature: certData.cryptoSignature,
              publicKeyJwk: certData.publicKey,
              keyVersion: certData.keyVersion,
              deviceId: certData.deviceId,
              timestamp: Date.now()
            });
            cryptoValid = cryptoVerification.isValid;
            console.log('🔐 Cryptographic verification:', cryptoValid ? '✅' : '❌');
          }
        } catch (cryptoError) {
          console.warn('Crypto verification failed:', cryptoError);
        }
      }

      return {
        ...qrResult,
        blockchainValid,
        cryptoValid
      };
    } catch (error) {
      console.error('Verification error:', error);
      return {
        isValid: false,
        error: error.message || 'Verification failed'
      };
    }
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

  private static async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
