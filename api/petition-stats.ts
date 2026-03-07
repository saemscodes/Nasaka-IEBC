
export interface PetitionStats {
  totalSignatures: number;
  validSignatures: number;
  wardsCovered: number;
  totalWards: number;
  complianceScore: number;
  recentActivity: {
    signaturesLast24h: number;
    averagePerHour: number;
    peakHour: string;
  };
  distribution: {
    urban: number;
    rural: number;
    mobile: number;
    web: number;
    ussd: number;
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // In production, these would be real-time queries from Supabase
    // For now, we'll simulate realistic data
    
    const currentTime = new Date();
    const last24Hours = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
    
    // Simulate database queries
    const stats: PetitionStats = {
      totalSignatures: 8750,
      validSignatures: 8520, // 97.4% success rate
      wardsCovered: 12,
      totalWards: 20,
      complianceScore: 87,
      recentActivity: {
        signaturesLast24h: 247,
        averagePerHour: 10.3,
        peakHour: '18:00-19:00' // Evening peak
      },
      distribution: {
        urban: Math.floor(8520 * 0.67), // 67% urban
        rural: Math.floor(8520 * 0.33), // 33% rural
        mobile: Math.floor(8520 * 0.45), // 45% mobile app
        web: Math.floor(8520 * 0.35), // 35% web platform
        ussd: Math.floor(8520 * 0.20)  // 20% USSD
      }
    };

    // Add some realistic variance
    const variance = () => Math.floor(Math.random() * 10) - 5; // +/- 5
    stats.totalSignatures += variance();
    stats.validSignatures += variance();

    // Calculate real-time compliance score
    const wardCoverage = (stats.wardsCovered / stats.totalWards) * 100;
    const signatureSuccess = (stats.validSignatures / stats.totalSignatures) * 100;
    const distributionBalance = Math.min(
      (stats.distribution.urban / stats.validSignatures) * 100,
      (stats.distribution.rural / stats.validSignatures) * 100
    ) * 2; // Balanced distribution bonus

    stats.complianceScore = Math.round(
      (wardCoverage * 0.4) + // 40% weight for ward coverage
      (signatureSuccess * 0.4) + // 40% weight for signature validity
      (distributionBalance * 0.2) // 20% weight for geographic distribution
    );

    // Log for monitoring
    console.log(`Petition stats request: ${stats.totalSignatures} signatures, ${stats.complianceScore}% compliance`);
    
    return Response.json(stats, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'X-Update-Frequency': '60', // Update every minute
        'X-Last-Updated': currentTime.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching petition stats:', error);
    
    return Response.json({
      error: 'Failed to fetch petition statistics'
    }, { status: 500 });
  }
}

// Helper function to get real-time ward data
async function getWardSignatureData() {
  // In production, this would query Supabase for ward-specific data
  const wards = [
    { name: 'Ziwani', signatures: 890, required: 750 },
    { name: 'Kariokor', signatures: 650, required: 600 },
    { name: 'Ngara', signatures: 420, required: 650 },
    { name: 'Landhies', signatures: 780, required: 700 },
    { name: 'Nairobi Central', signatures: 950, required: 800 }
  ];

  return wards.map(ward => ({
    ...ward,
    percentage: Math.round((ward.signatures / ward.required) * 100),
    status: ward.signatures >= ward.required ? 'adequate' : 'insufficient'
  }));
}

// Helper function for CSP performance monitoring
async function getCSPPerformanceData() {
  return {
    geda: { success: 99.2, responseTime: 250, usage: 15 },
    tendaworld: { success: 98.7, responseTime: 180, usage: 45 },
    emudhra: { success: 99.8, responseTime: 320, usage: 25 },
    icta: { success: 97.5, responseTime: 450, usage: 15 }
  };
}
