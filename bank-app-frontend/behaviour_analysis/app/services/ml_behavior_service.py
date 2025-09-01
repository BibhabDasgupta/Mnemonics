# --- File: bank-app-frontend/behaviour_analysis/app/services/ml_behavior_service.py ---
import os
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, List, Optional, Tuple
import uuid
from datetime import datetime

from app.db.models.behavior import UserBehavior
from app.db.base import get_db

class MLBehaviorService:
    def __init__(self, db: Session):
        self.db = db
        self.model_dir = "app/ml_models/user_specific_models"
        self.ensure_model_directory()
    
    def ensure_model_directory(self):
        """Ensure the model directory exists."""
        os.makedirs(self.model_dir, exist_ok=True)
    
    def get_user_model_path(self, customer_id: uuid.UUID) -> str:
        """Get the file path for a user's specific model."""
        return os.path.join(self.model_dir, f"behavioral_model_{customer_id}.pkl")
    
    def get_quality_user_data(self, customer_id: uuid.UUID) -> List[Dict]:
        """Fetch quality behavioral data for a specific user."""
        try:
            # Convert UUID to string for SQLite compatibility
            customer_id_str = str(customer_id)
            
            # Query using SQLAlchemy
            behaviors = self.db.query(UserBehavior).filter(
                UserBehavior.customer_unique_id == customer_id_str
            ).order_by(UserBehavior.created_at.desc()).all()
            
            if not behaviors:
                return []
            
            # Convert to list of dicts and filter quality data
            quality_data = []
            for behavior in behaviors:
                # Apply basic quality filters
                if (behavior.flight_avg >= 0 and behavior.traj_avg >= 1.0 and 
                    behavior.typing_speed >= 0 and behavior.correction_rate >= 0 and 
                    behavior.clicks_per_minute >= 0):
                    
                    # Skip sessions with too many zeros (likely system artifacts)
                    zero_count = sum([
                        1 for val in [behavior.flight_avg, behavior.traj_avg, 
                                    behavior.typing_speed, behavior.clicks_per_minute]
                        if val == 0
                    ])
                    
                    if zero_count <= 2:  # Allow max 2 zero values
                        quality_data.append({
                            'flight_avg': behavior.flight_avg,
                            'traj_avg': behavior.traj_avg,
                            'correction_rate': behavior.correction_rate,
                            'typing_speed': behavior.typing_speed,
                            'clicks_per_minute': behavior.clicks_per_minute,
                            'created_at': behavior.created_at
                        })
            
            print(f"Retrieved {len(quality_data)} quality sessions out of {len(behaviors)} total for user {customer_id}")
            return quality_data
            
        except Exception as e:
            print(f"Error fetching user data: {e}")
            return []
    
    def train_user_model(self, customer_id: uuid.UUID) -> Dict[str, any]:
        """Train an Isolation Forest model for a specific user."""
        print(f"--- Starting Enhanced Model Training for User {customer_id} ---")
        
        data = self.get_quality_user_data(customer_id)
        
        MIN_DATA_POINTS = 40
        if len(data) < MIN_DATA_POINTS:
            return {
                'success': False,
                'message': f"Insufficient baseline data. Only {len(data)} sessions found, need {MIN_DATA_POINTS} for training.",
                'data_count': len(data)
            }
        
        print(f"Training model on {len(data)} baseline behavior sessions...")
        print("Features: flight_avg, traj_avg, correction_rate, typing_speed, clicks_per_minute")
        
        # Prepare feature matrix
        X = np.array([[
            d['flight_avg'], d['traj_avg'], d['correction_rate'], 
            d['typing_speed'], d['clicks_per_minute']
        ] for d in data])
        
        # Display baseline statistics
        print(f"\n--- USER {customer_id} BASELINE BEHAVIOR ---")
        feature_names = ['flight_avg', 'traj_avg', 'correction_rate', 'typing_speed', 'clicks_per_minute']
        feature_units = ['s', 'px', '/min', 'chars/min', '/min']
        
        baseline_stats = {}
        for i, (name, unit) in enumerate(zip(feature_names, feature_units)):
            mean_val = np.mean(X[:, i])
            std_val = np.std(X[:, i])
            min_val = np.min(X[:, i])
            max_val = np.max(X[:, i])
            
            baseline_stats[name] = {
                'mean': float(mean_val), 'std': float(std_val),
                'min': float(min_val), 'max': float(max_val)
            }
            
            print(f"{name.replace('_', ' ').title()} - Mean: {mean_val:.4f}{unit}, "
                  f"Std: {std_val:.4f}{unit}, Range: [{min_val:.4f}, {max_val:.4f}]")
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train Isolation Forest
        model = IsolationForest(
            contamination=0.05,       # Expect 5% outliers
            n_estimators=200,         # More trees for stability
            max_samples=min(len(data), 40),  # Use available data up to 40
            max_features=5,           # All 5 features
            random_state=42,
            bootstrap=True
        )
        model.fit(X_scaled)
        
        try:
            scores = model.score_samples(X_scaled)
            avg_score = float(np.mean(scores))
            std_score = float(np.std(scores))
            min_score = float(np.min(scores))
            
            print(f"\n--- BASELINE BEHAVIOR LEARNED ---")
            print(f"Model Baseline Score: {avg_score:.6f} ± {std_score:.6f}")
            print(f"Acceptance Threshold: {min_score:.6f}")
            print("Model has learned normal behavior patterns for this user.")
            
        except Exception as e:
            print(f"Could not calculate baseline scores: {e}")
            avg_score = std_score = min_score = 0.0
        
        # Save model artifacts
        model_path = self.get_user_model_path(customer_id)
        artifacts = {
            'model': model,
            'scaler': scaler,
            'feature_names': feature_names,
            'baseline_stats': baseline_stats,
            'baseline_size': len(data),
            'customer_id': str(customer_id),
            'trained_at': datetime.utcnow().isoformat(),
            'model_scores': {
                'avg_score': avg_score,
                'std_score': std_score,
                'min_score': min_score
            }
        }
        
        try:
            joblib.dump(artifacts, model_path)
            print(f"\nModel successfully trained and saved: {model_path}")
            
            return {
                'success': True,
                'message': f"Model trained successfully on {len(data)} sessions",
                'data_count': len(data),
                'model_path': model_path,
                'baseline_stats': baseline_stats,
                'model_scores': artifacts['model_scores']
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f"Failed to save model: {str(e)}",
                'data_count': len(data)
            }
    
    def predict_anomaly(self, customer_id: uuid.UUID, metrics: Dict[str, float]) -> Dict[str, any]:
        """Predict if new behavioral metrics are anomalous for a user."""
        model_path = self.get_user_model_path(customer_id)
        
        if not os.path.exists(model_path):
            return {
                'success': False,
                'message': "Model not found. User needs baseline training.",
                'is_anomaly': False,
                'confidence': 0.0,
                'requires_training': True
            }
        
        try:
            # Load model artifacts
            artifacts = joblib.load(model_path)
            model = artifacts['model']
            scaler = artifacts['scaler']
            
            # Prepare input data
            X_new = np.array([[
                metrics['flight_avg'], metrics['traj_avg'], 
                metrics['correction_rate'], metrics['typing_speed'], 
                metrics['clicks_per_minute']
            ]])
            
            # Scale features
            X_new_scaled = scaler.transform(X_new)
            print(f"New data standardized using user's baseline scaler.")
            
            # Make prediction
            prediction = model.predict(X_new_scaled)[0]
            is_anomaly = prediction == -1
            
            # Calculate decision score and confidence
            decision_score = model.decision_function(X_new_scaled)[0]
            
            # Enhanced confidence calculation
            CERTAINTY_THRESHOLD = 0.15
            confidence_percentage = 50 + (abs(decision_score) / CERTAINTY_THRESHOLD) * 50
            confidence_percentage = min(confidence_percentage, 100.0)
            
            print(f"Anomaly Detection Result:")
            print(f"  Prediction: {'ANOMALY' if is_anomaly else 'NORMAL'}")
            print(f"  Decision Score: {decision_score:.6f}")
            print(f"  Confidence: {confidence_percentage:.2f}%")
            
            return {
                'success': True,
                'is_anomaly': is_anomaly,
                'confidence': float(confidence_percentage),
                'decision_score': float(decision_score),
                'requires_training': False,
                'model_info': {
                    'trained_at': artifacts.get('trained_at'),
                    'baseline_size': artifacts.get('baseline_size', 0)
                }
            }
            
        except Exception as e:
            print(f"Error during anomaly prediction: {e}")
            return {
                'success': False,
                'message': f"Prediction failed: {str(e)}",
                'is_anomaly': False,
                'confidence': 0.0,
                'requires_training': False
            }
    
    def get_user_model_info(self, customer_id: uuid.UUID) -> Dict[str, any]:
        """Get information about a user's trained model."""
        model_path = self.get_user_model_path(customer_id)
        
        if not os.path.exists(model_path):
            data_count = len(self.get_quality_user_data(customer_id))
            return {
                'model_exists': False,
                'data_count': data_count,
                'requires_training': data_count >= 40,
                'message': f"No model found. User has {data_count} quality sessions."
            }
        
        try:
            artifacts = joblib.load(model_path)
            return {
                'model_exists': True,
                'customer_id': artifacts.get('customer_id'),
                'trained_at': artifacts.get('trained_at'),
                'baseline_size': artifacts.get('baseline_size', 0),
                'baseline_stats': artifacts.get('baseline_stats', {}),
                'model_scores': artifacts.get('model_scores', {}),
                'requires_training': False
            }
            
        except Exception as e:
            return {
                'model_exists': False,
                'error': str(e),
                'message': "Model file corrupted or unreadable"
            }
    
    def retrain_if_needed(self, customer_id: uuid.UUID, force_retrain: bool = False) -> Dict[str, any]:
        """Retrain user model if conditions are met."""
        data = self.get_quality_user_data(customer_id)
        model_path = self.get_user_model_path(customer_id)
        
        # Check if retraining is needed
        needs_training = False
        reason = ""
        
        if not os.path.exists(model_path):
            needs_training = True
            reason = "No existing model"
        elif force_retrain:
            needs_training = True
            reason = "Forced retrain requested"
        elif len(data) >= 40:  # Retrain every 40 sessions
            try:
                artifacts = joblib.load(model_path)
                last_baseline_size = artifacts.get('baseline_size', 0)
                if len(data) >= last_baseline_size + 40:  # Significant new data
                    needs_training = True
                    reason = f"Significant new data: {len(data)} vs {last_baseline_size}"
            except:
                needs_training = True
                reason = "Model file corrupted"
        
        if needs_training and len(data) >= 40:
            print(f"Retraining model for user {customer_id}: {reason}")
            return self.train_user_model(customer_id)
        else:
            return {
                'success': False,
                'message': f"No retraining needed. Reason checked: {reason}. Data count: {len(data)}",
                'data_count': len(data)
            }