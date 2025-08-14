// --- File: src/services/securityService.ts ---
interface MLVerificationResult {
  success: boolean;
  is_anomaly: boolean;
  confidence: number;
  decision_score?: number;
  message?: string;
  requires_training: boolean;
  model_info?: {
    trained_at?: string;
    baseline_size?: number;
  };
}

interface SecurityAlert {
  id: string;
  timestamp: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  anomalyType: string;
  decision_score?: number;
  recommendations: string[];
  blocked: boolean;
  transactionDetails?: {
    type: string;
    features: string[];
    timestamp: string;
  };
}

export class SecurityService {
  private static readonly API_BASE = 'http://localhost:8000/api/v1';

  static async verifyBehavior(metrics: {
    customer_unique_id: string;
    flight_avg: number;
    traj_avg: number;
    typing_speed: number;
    correction_rate: number;
    clicks_per_minute: number;
  }): Promise<MLVerificationResult> {
    try {
      const response = await fetch(`${this.API_BASE}/ml-analytics/verify-behavior`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
      });
      
      if (!response.ok) {
        throw new Error(`ML verification failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('ML verification error:', error);
      return {
        success: false,
        is_anomaly: false,
        confidence: 0,
        requires_training: false,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  static async getModelInfo(customerId: string) {
    try {
      const response = await fetch(`${this.API_BASE}/ml-analytics/model-info/${customerId}`);
      return await response.json();
    } catch (error) {
      console.error('Model info error:', error);
      return null;
    }
  }
  
  static createSecurityAlert(
    mlResult: MLVerificationResult,
    metrics: any
  ): SecurityAlert {
    const confidence = mlResult.confidence;
    const riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 
      confidence >= 80 ? 'HIGH' : 
      confidence >= 60 ? 'MEDIUM' : 'LOW';
    
    const recommendations = [
      'Behavioral pattern anomaly detected',
      'Transaction access temporarily restricted',
      'Complete additional identity verification',
      'Return to login for security verification',
      'Contact support if you believe this is an error'
    ];
    
    return {
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString(),
      riskLevel,
      confidence,
      anomalyType: 'Behavioral Pattern Deviation',
      decision_score: mlResult.decision_score,
      recommendations,
      blocked: true
    };
  }

  // ✅ ADD THIS METHOD for transaction fraud alerts
  static createTransactionAlert(fraudDetails: any): SecurityAlert {
  return {
    id: `tx_alert_${Date.now()}`,
    timestamp: new Date().toISOString(),
    riskLevel: fraudDetails.risk_level || 'HIGH',
    confidence: fraudDetails.confidence || 95,
    anomalyType: fraudDetails.anomaly_type || 'Transaction Anomaly',
    decision_score: fraudDetails.decision_score,
    recommendations: fraudDetails.recommendations || [
      'Transaction blocked due to suspicious pattern',
      'Complete biometric re-authentication to proceed',
      'Contact support if this transaction is legitimate',
      'Review recent account activity'
    ],
    blocked: true,
    transactionDetails: {
      type: 'TRANSACTION_FRAUD',
      features: fraudDetails.features_used || [],
      timestamp: new Date().toISOString()
    }
  };
}
}