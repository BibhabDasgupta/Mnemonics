# --- File: bank-app-frontend/app/api/api_v1/endpoints/ml_analytics.py ---
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict
import uuid

from app.db.base import get_db
from app.services.ml_behavior_service import MLBehaviorService
from app.services.ml_restoration_behavior_service import MLRestorationBehaviorService
from app.schemas.ml_behavior import (
    MLBehaviorRequest,
    MLTrainingRequest,
    MLBehaviorResponse,
    MLTrainingResponse,
    MLModelInfoResponse,
    AutoTrainRequest,
    AutoTrainResponse
)

router = APIRouter()

@router.post("/ml-analytics/verify-behavior", response_model=MLBehaviorResponse)
def verify_user_behavior(
    request: MLBehaviorRequest,
    db: Session = Depends(get_db)
):
    """
    Verify if user behavior is anomalous using trained ML model.
    """
    print(f"\n🤖 ML BEHAVIOR VERIFICATION for user {request.customer_unique_id}")
    
    ml_service = MLBehaviorService(db)
    
    # Prepare metrics dictionary
    metrics = {
        'flight_avg': request.flight_avg,
        'traj_avg': request.traj_avg,
        'typing_speed': request.typing_speed,
        'correction_rate': request.correction_rate,
        'clicks_per_minute': request.clicks_per_minute
    }
    
    print(f"Input metrics: {metrics}")
    
    # Perform anomaly detection
    result = ml_service.predict_anomaly(request.customer_unique_id, metrics)
    
    if not result['success']:
        print(f"❌ ML verification failed: {result.get('message', 'Unknown error')}")
        if result.get('requires_training', False):
            # Try to train model if enough data exists
            training_result = ml_service.retrain_if_needed(request.customer_unique_id)
            if training_result['success']:
                # Retry prediction after training
                result = ml_service.predict_anomaly(request.customer_unique_id, metrics)
    
    status_icon = "🚨" if result.get('is_anomaly', False) else "✅"
    print(f"{status_icon} ML Result: {'ANOMALY' if result.get('is_anomaly', False) else 'NORMAL'} "
          f"(confidence: {result.get('confidence', 0):.1f}%)")
    
    return MLBehaviorResponse(**result)

@router.post("/ml-analytics/verify-restoration-behavior", response_model=MLBehaviorResponse)
def verify_user_restoration_behavior(
    request: MLBehaviorRequest,
    db: Session = Depends(get_db)
):
    """
    Verify if user restoration behavior is anomalous using trained ML model.
    """
    print(f"\n🤖 ML RESTORATION BEHAVIOR VERIFICATION for user {request.customer_unique_id}")

    ml_service = MLRestorationBehaviorService(db)

    # Prepare metrics dictionary
    metrics = {
        'flight_avg': request.flight_avg,
        'traj_avg': request.traj_avg,
        'typing_speed': request.typing_speed,
        'correction_rate': request.correction_rate,
        'clicks_per_minute': request.clicks_per_minute
    }

    print(f"Input metrics: {metrics}")

    # Perform anomaly detection
    result = ml_service.predict_anomaly(request.customer_unique_id, metrics)

    if not result['success']:
        print(f"❌ ML verification failed: {result.get('message', 'Unknown error')}")
        if result.get('requires_training', False):
            # Try to train model if enough data exists
            training_result = ml_service.retrain_if_needed(request.customer_unique_id)
            if training_result['success']:
                # Retry prediction after training
                result = ml_service.predict_anomaly(request.customer_unique_id, metrics)

    status_icon = "🚨" if result.get('is_anomaly', False) else "✅"
    print(f"{status_icon} ML Result: {'ANOMALY' if result.get('is_anomaly', False) else 'NORMAL'} "
          f"(confidence: {result.get('confidence', 0):.1f}%)")

    return MLBehaviorResponse(**result)

@router.post("/ml-analytics/train-model", response_model=MLTrainingResponse)
def train_user_model(
    request: MLTrainingRequest,
    db: Session = Depends(get_db)
):
    """
    Train or retrain ML model for a specific user.
    """
    print(f"\n🔧 ML MODEL TRAINING for user {request.customer_unique_id}")
    
    ml_service = MLBehaviorService(db)
    
    if request.force_retrain:
        result = ml_service.train_user_model(request.customer_unique_id)
    else:
        result = ml_service.retrain_if_needed(request.customer_unique_id)
    
    if result['success']:
        print(f"✅ Training successful: {result['message']}")
    else:
        print(f"❌ Training failed: {result['message']}")
    
    return MLTrainingResponse(**result)

@router.get("/ml-analytics/model-info/{customer_id}", response_model=MLModelInfoResponse)
def get_model_info(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Get information about a user's trained ML model.
    """
    print(f"\n📊 ML MODEL INFO for user {customer_id}")
    
    ml_service = MLBehaviorService(db)
    result = ml_service.get_user_model_info(customer_id)
    
    return MLModelInfoResponse(**result)

@router.post("/ml-analytics/auto-train-all", response_model=AutoTrainResponse)
def auto_train_all_eligible_users(
    request: AutoTrainRequest,
    db: Session = Depends(get_db)
):
    """
    Automatically train models for all users with sufficient data.
    """
    print(f"\n🚀 AUTO-TRAINING all eligible users (min {request.min_sessions} sessions)")
    
    try:
        # Get all unique customer IDs with enough data
        from sqlalchemy import func
        from app.db.models.behavior import UserBehavior
        
        users_with_data = db.query(
            UserBehavior.customer_unique_id,
            func.count(UserBehavior.id).label('session_count')
        ).group_by(
            UserBehavior.customer_unique_id
        ).having(
            func.count(UserBehavior.id) >= request.min_sessions
        ).all()
        
        ml_service = MLBehaviorService(db)
        results = []
        
        for user_data in users_with_data:
            customer_id = user_data.customer_unique_id
            session_count = user_data.session_count
            
            print(f"Processing user {customer_id} with {session_count} sessions...")
            
            # Check if model needs training/retraining
            training_result = ml_service.retrain_if_needed(customer_id)
            
            results.append({
                'customer_id': str(customer_id),
                'session_count': session_count,
                'training_success': training_result['success'],
                'message': training_result['message']
            })
        
        successful_trainings = sum(1 for r in results if r['training_success'])
        
        return AutoTrainResponse(
            success=True,
            message=f"Auto-training completed. {successful_trainings}/{len(results)} users trained successfully.",
            total_eligible_users=len(results),
            successful_trainings=successful_trainings,
            results=results
        )
        
    except Exception as e:
        print(f"❌ Auto-training failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-training failed: {str(e)}"
        )

@router.delete("/ml-analytics/model/{customer_id}")
def delete_user_model(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Delete a user's trained ML model.
    """
    print(f"\n🗑️ DELETING ML MODEL for user {customer_id}")
    
    try:
        ml_service = MLBehaviorService(db)
        model_path = ml_service.get_user_model_path(customer_id)
        
        import os
        if os.path.exists(model_path):
            os.remove(model_path)
            print(f"✅ Model deleted: {model_path}")
            return {
                "success": True,
                "message": f"Model successfully deleted for user {customer_id}",
                "customer_id": str(customer_id)
            }
        else:
            print(f"⚠️ Model not found: {model_path}")
            return {
                "success": False,
                "message": f"No model found for user {customer_id}",
                "customer_id": str(customer_id)
            }
            
    except Exception as e:
        print(f"❌ Model deletion failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model: {str(e)}"
        )

@router.get("/ml-analytics/health")
def ml_service_health(db: Session = Depends(get_db)):
    """
    Check the health of the ML service and return system status.
    """
    print(f"\n🏥 ML SERVICE HEALTH CHECK")
    
    try:
        ml_service = MLBehaviorService(db)
        
        # Check if model directory exists
        import os
        model_dir_exists = os.path.exists(ml_service.model_dir)
        
        # Count total behavioral data records
        from app.db.models.behavior import UserBehavior
        total_behavior_records = db.query(UserBehavior).count()
        
        # Count users with sufficient data for training
        from sqlalchemy import func
        users_with_sufficient_data = db.query(
            func.count(func.distinct(UserBehavior.customer_unique_id))
        ).filter(
            UserBehavior.customer_unique_id.in_(
                db.query(UserBehavior.customer_unique_id)
                .group_by(UserBehavior.customer_unique_id)
                .having(func.count(UserBehavior.id) >= 40)
                .subquery()
                .select()
            )
        ).scalar()
        
        # Count existing trained models
        trained_models = 0
        if model_dir_exists:
            model_files = [f for f in os.listdir(ml_service.model_dir) if f.endswith('.pkl')]
            trained_models = len(model_files)
        
        health_status = {
            "service_status": "healthy",
            "model_directory_exists": model_dir_exists,
            "model_directory_path": ml_service.model_dir,
            "total_behavior_records": total_behavior_records,
            "users_with_sufficient_data": users_with_sufficient_data,
            "trained_models_count": trained_models,
            "ml_service_ready": model_dir_exists and total_behavior_records > 0
        }
        
        print(f"✅ ML Service Health: {health_status}")
        return health_status
        
    except Exception as e:
        print(f"❌ Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )