
import { supabase } from '@/integrations/supabase/client';

export interface BlockchainHashData {
  signatureId: string;
  petitionId: string;
  voterHash: string;
  timestamp: string;
  wardConstituency: string;
}

export class BlockchainService {
  // Simple blockchain-like hash generation
  static async generateBlockchainHash(data: BlockchainHashData): Promise<string> {
    try {
      // Create a deterministic hash from the signature data
      const hashInput = `${data.signatureId}${data.petitionId}${data.voterHash}${data.timestamp}${data.wardConstituency}`;
      
      // Use Web Crypto API for secure hashing
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Add blockchain prefix
      return `BLK254-${hashHex.substring(0, 32)}`;
    } catch (error) {
      console.error('Blockchain hash generation error:', error);
      return `BLK254-${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 10)}`;
    }
  }

  // Verify blockchain hash integrity
  static async verifyBlockchainHash(
    signatureId: string, 
    expectedHash: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Get signature data from database
      const { data: signature, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('id', signatureId)
        .single();

      if (error || !signature) {
        return { isValid: false, error: 'Signature not found' };
      }

      // Recreate hash from stored data
      const hashData: BlockchainHashData = {
        signatureId: signature.id,
        petitionId: signature.petition_id,
        voterHash: this.createVoterHash(signature.voter_id, signature.voter_name),
        timestamp: signature.signature_timestamp,
        wardConstituency: `${signature.ward}-${signature.constituency}`
      };

      const regeneratedHash = await this.generateBlockchainHash(hashData);
      
      return {
        isValid: regeneratedHash === expectedHash,
        error: regeneratedHash !== expectedHash ? 'Hash verification failed' : undefined
      };
    } catch (error) {
      return { isValid: false, error: 'Verification failed' };
    }
  }

  // Create anonymous voter hash for blockchain
  static createVoterHash(voterId: string, voterName: string): string {
    // Create a hash that doesn't expose personal info but is consistent
    const combined = `${voterId.slice(-4)}${voterName.length}${voterId.length}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  }

  // Store blockchain hash in signature record
  static async storeBlockchainHash(signatureId: string, blockchainHash: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('signatures')
        .update({ blockchain_hash: blockchainHash })
        .eq('id', signatureId);

      return !error;
    } catch (error) {
      console.error('Failed to store blockchain hash:', error);
      return false;
    }
  }
}
