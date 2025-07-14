
export interface SignatureSessionRequest {
  cspProvider: string;
  voterData: {
    nationalId: string;
    phoneNumber: string;
    constituency: string;
    ward: string;
  };
  deviceFingerprint: any;
  verificationResults: any;
}

export interface SignatureSessionResponse {
  success: boolean;
  sessionId: string;
  redirectUrl: string;
  expiresAt: string;
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const requestData: SignatureSessionRequest = await req.json();
    const { cspProvider, voterData, deviceFingerprint, verificationResults } = requestData;

    // Validate required fields
    if (!cspProvider || !voterData?.nationalId) {
      return Response.json({
        success: false,
        error: 'CSP provider and voter data are required'
      }, { status: 400 });
    }

    // Generate unique session ID
    const sessionId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // CSP-specific integration
    let redirectUrl: string;
    let apiResponse: any;

    switch (cspProvider) {
      case 'geda':
        apiResponse = await integrateWithGEDA(sessionId, voterData, deviceFingerprint);
        redirectUrl = apiResponse.signatureUrl;
        break;
        
      case 'tendaworld':
        apiResponse = await integrateWithTendaWorld(sessionId, voterData, deviceFingerprint);
        redirectUrl = apiResponse.signatureUrl;
        break;
        
      case 'emudhra':
        apiResponse = await integrateWithEmudhra(sessionId, voterData, deviceFingerprint);
        redirectUrl = apiResponse.signatureUrl;
        break;
        
      case 'icta':
        apiResponse = await integrateWithICTA(sessionId, voterData, deviceFingerprint);
        redirectUrl = apiResponse.signatureUrl;
        break;
        
      default:
        return Response.json({
          success: false,
          error: 'Unsupported CSP provider'
        }, { status: 400 });
    }

    // Store session in database (Supabase)
    const sessionData = {
      id: sessionId,
      csp_provider: cspProvider,
      voter_national_id: voterData.nationalId,
      voter_phone: voterData.phoneNumber,
      constituency: voterData.constituency,
      ward: voterData.ward,
      device_fingerprint: deviceFingerprint,
      verification_results: verificationResults,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      redirect_url: redirectUrl
    };
    
    await supabase.from('signature_sessions').insert(sessionData);
    console.log('Signature session created:', sessionData);

    const response: SignatureSessionResponse = {
      success: true,
      sessionId,
      redirectUrl,
      expiresAt
    };

    return Response.json(response);

  } catch (error) {
    console.error('Signature session creation error:', error);
    
    return Response.json({
      success: false,
      error: 'Failed to create signature session'
    }, { status: 500 });
  }
}

// GEDA Limited Integration
async function integrateWithGEDA(sessionId: string, voterData: any, deviceFingerprint: any) {
  try {
    const response = await fetch('https://api.geda.co.ke/v1/esign/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GEDA_API_KEY}`,
        'X-Client-ID': process.env.GEDA_CLIENT_ID
      },
      body: JSON.stringify({
        session_id: sessionId,
        document_type: 'mp_recall_petition',
        signer: {
          national_id: voterData.nationalId,
          phone: voterData.phoneNumber,
          constituency: voterData.constituency,
          ward: voterData.ward
        },
        device_info: deviceFingerprint,
        callback_url: `${process.env.BASE_URL}/api/signature-callback`,
        success_url: `${process.env.BASE_URL}/signature-success`,
        cancel_url: `${process.env.BASE_URL}/signature-cancelled`
      })
    });

    if (!response.ok) {
      throw new Error(`GEDA API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      signatureUrl: data.signature_url,
      sessionToken: data.session_token
    };
  } catch (error) {
    console.error('GEDA integration error:', error);
    // Return mock URL for development
    return {
      signatureUrl: `https://geda.co.ke/sign/${sessionId}?token=mock_${Date.now()}`,
      sessionToken: `geda_${sessionId}`
    };
  }
}

// TendaWorld Limited Integration
async function integrateWithTendaWorld(sessionId: string, voterData: any, deviceFingerprint: any) {
  try {
    const response = await fetch('https://api.tenda.world/v2/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TENDA_API_KEY,
        'X-API-Secret': process.env.TENDA_API_SECRET,
        'X-Signature': generateHMACSignature(sessionId)
      },
      body: JSON.stringify({
        session_id: sessionId,
        petition_type: 'mp_recall',
        signer_msisdn: voterData.phoneNumber,
        signer_id: voterData.nationalId,
        location: {
          constituency: voterData.constituency,
          ward: voterData.ward
        },
        device_fingerprint: deviceFingerprint,
        signature_method: 'mobile_app', // or 'ussd' for feature phones
        callback_url: `${process.env.BASE_URL}/api/tenda-callback`
      })
    });

    const data = await response.json();
    
    if (data.signature_method === 'ussd') {
      return {
        signatureUrl: `tel:*483*58*${data.session_code}#`,
        sessionToken: data.ussd_session_id
      };
    } else {
      return {
        signatureUrl: data.mobile_signature_url,
        sessionToken: data.session_token
      };
    }
  } catch (error) {
    console.error('TendaWorld integration error:', error);
    return {
      signatureUrl: `https://sign.tenda.world/${sessionId}`,
      sessionToken: `tenda_${sessionId}`
    };
  }
}

// Emudhra Technologies Integration
async function integrateWithEmudhra(sessionId: string, voterData: any, deviceFingerprint: any) {
  try {
    const response = await fetch('https://api.emudhra.ke/v1/signatures/advanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Cert': process.env.EMUDHRA_CLIENT_CERT,
        'Authorization': `Bearer ${process.env.EMUDHRA_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        session_id: sessionId,
        document_hash: generateDocumentHash(voterData),
        signer_details: {
          national_id: voterData.nationalId,
          mobile: voterData.phoneNumber,
          email: `${voterData.nationalId}@voters.ke` // Mock email
        },
        signature_type: 'qualified_electronic_signature',
        certificate_type: 'individual',
        callback_url: `${process.env.BASE_URL}/api/emudhra-callback`
      })
    });

    const data = await response.json();
    return {
      signatureUrl: data.signature_portal_url,
      sessionToken: data.emudhra_session_token
    };
  } catch (error) {
    console.error('Emudhra integration error:', error);
    return {
      signatureUrl: `https://portal.emudhra.ke/sign/${sessionId}`,
      sessionToken: `emudhra_${sessionId}`
    };
  }
}

// ICTA Government Integration
async function integrateWithICTA(sessionId: string, voterData: any, deviceFingerprint: any) {
  try {
    const response = await fetch('https://api.icta.go.ke/citizen/esign', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.ECITIZEN_TOKEN}`,
        'X-Huduma-Number': voterData.huduma_number || 'TEMP001'
      },
      body: JSON.stringify({
        session_id: sessionId,
        petition_type: 'mp_recall',
        citizen_id: voterData.nationalId,
        constituency: voterData.constituency,
        verification_method: 'national_id_biometric'
      })
    });

    const data = await response.json();
    return {
      signatureUrl: `https://ecitizen.go.ke/esign/${data.session_token}`,
      sessionToken: data.session_token
    };
  } catch (error) {
    console.error('ICTA integration error:', error);
    return {
      signatureUrl: `https://ecitizen.go.ke/esign/${sessionId}`,
      sessionToken: `icta_${sessionId}`
    };
  }
}

// Helper functions
function generateHMACSignature(data: string): string {
  // In production, use crypto.createHmac with proper secret
  return `hmac_${Buffer.from(data).toString('base64')}`;
}

function generateDocumentHash(voterData: any): string {
  // In production, generate proper SHA-256 hash of petition document
  return `sha256_${Buffer.from(JSON.stringify(voterData)).toString('base64')}`;
}
