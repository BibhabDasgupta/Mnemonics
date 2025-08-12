# --- File: bank-app-backend/app/api/api_v1/endpoints/analytics.py ---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.schemas.behavior import BehaviorDataCreate, BehaviorDataResponse
from app.services.behavior_service import BehaviorService
from app.services.ml_behavior_service import MLBehaviorService

router = APIRouter()

@router.post("/analytics/behavior", response_model=BehaviorDataResponse, status_code=201)
def log_behavioral_data(
    *,
    db: Session = Depends(get_db),
    behavior_in: BehaviorDataCreate
):
    """
    Enhanced behavioral analytics with ML anomaly detection.
    Receives behavioral data from the frontend, validates it,
    logs it to the database, and performs ML-based anomaly detection.
    """
    print(f"\n🔍 ENHANCED ANALYTICS: Received behavioral data")
    print(f"Customer ID: {behavior_in.customer_unique_id}")
    print(f"Raw metrics: flight_avg={behavior_in.flight_avg}, traj_avg={behavior_in.traj_avg}")
    print(f"             typing_speed={behavior_in.typing_speed}, correction_rate={behavior_in.correction_rate}")
    print(f"             clicks_per_minute={behavior_in.clicks_per_minute}")
    
    # Step 1: Standard validation and saving using existing service
    behavior_service = BehaviorService(db)
    success, behavior_obj, message = behavior_service.validate_and_save_behavior(behavior_in)
    
    if not success:
        print(f"❌ Standard validation failed: {message}")
        raise HTTPException(status_code=400, detail=message)
    
    # Step 2: ML Anomaly Detection (non-blocking)
    ml_anomaly_detected = False
    ml_confidence = 0.0
    
    try:
        print(f"\n🤖 Running ML anomaly detection...")
        ml_service = MLBehaviorService(db)
        
        metrics = {
            'flight_avg': behavior_in.flight_avg,
            'traj_avg': behavior_in.traj_avg,
            'typing_speed': behavior_in.typing_speed,
            'correction_rate': behavior_in.correction_rate,
            'clicks_per_minute': behavior_in.clicks_per_minute
        }
        
        ml_result = ml_service.predict_anomaly(behavior_in.customer_unique_id, metrics)
        
        if ml_result['success']:
            ml_anomaly_detected = ml_result['is_anomaly']
            ml_confidence = ml_result['confidence']
            
            if ml_anomaly_detected:
                print(f"🚨 ML ANOMALY DETECTED: Confidence {ml_confidence:.1f}%")
                print(f"   Decision Score: {ml_result.get('decision_score', 'N/A')}")
                # Here you could:
                # - Log to security monitoring system
                # - Send alerts to fraud team
                # - Flag account for manual review
                # - Trigger additional authentication steps
                # For now, just log the detection
            else:
                print(f"✅ ML VERIFICATION PASSED: Confidence {ml_confidence:.1f}%")
        else:
            print(f"⚠️ ML verification unavailable: {ml_result.get('message', 'Unknown')}")
            
            # Auto-train if enough data and no model exists
            if ml_result.get('requires_training', False):
                print(f"🔧 Attempting auto-training for user...")
                training_result = ml_service.retrain_if_needed(behavior_in.customer_unique_id)
                if training_result['success']:
                    print(f"✅ Auto-trained model: {training_result['message']}")
                    
                    # Retry ML detection after training
                    retry_result = ml_service.predict_anomaly(behavior_in.customer_unique_id, metrics)
                    if retry_result['success']:
                        ml_anomaly_detected = retry_result['is_anomaly']
                        ml_confidence = retry_result['confidence']
                        print(f"🔄 Retry ML result: {'ANOMALY' if ml_anomaly_detected else 'NORMAL'} "
                              f"(confidence: {ml_confidence:.1f}%)")
                else:
                    print(f"❌ Auto-training failed: {training_result['message']}")
    
    except Exception as e:
        print(f"⚠️ ML processing failed (non-critical): {str(e)}")
        # Don't fail the main request due to ML issues
    
    # Step 3: Log final results
    print(f"\n📊 FINAL ANALYTICS RESULTS:")
    print(f"   ✅ Standard Validation: PASSED")
    print(f"   🤖 ML Anomaly Detection: {'ANOMALY' if ml_anomaly_detected else 'NORMAL'} ({ml_confidence:.1f}%)")
    print(f"   💾 Data Saved: Session ID {behavior_obj.session_id}")
    print(f"✅ ENHANCED ANALYTICS: Successfully processed behavioral data")
    
    return behavior_obj