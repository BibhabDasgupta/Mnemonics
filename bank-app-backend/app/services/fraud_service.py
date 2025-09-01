# --- File: app/services/fraud_service.py ---
import pandas as pd
import numpy as np
import torch
import os
import pickle
import json
from sklearn.preprocessing import StandardScaler
from typing import List, Dict
import logging

# Set up logging
logger = logging.getLogger(__name__)

# --- Model & Feature Configuration ---
INPUT_FEATURES = [
    'TX_AMOUNT', 'TX_DURING_WEEKEND', 'TX_DURING_NIGHT', 'CUSTOMER_ID_NB_TX_1DAY_WINDOW',
    'CUSTOMER_ID_AVG_AMOUNT_1DAY_WINDOW', 'CUSTOMER_ID_NB_TX_7DAY_WINDOW',
    'CUSTOMER_ID_AVG_AMOUNT_7DAY_WINDOW', 'CUSTOMER_ID_NB_TX_30DAY_WINDOW',
    'CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW', 'TERMINAL_ID_NB_TX_1DAY_WINDOW',
    'TERMINAL_ID_RISK_1DAY_WINDOW', 'TERMINAL_ID_NB_TX_7DAY_WINDOW',
    'TERMINAL_ID_RISK_7DAY_WINDOW', 'TERMINAL_ID_NB_TX_30DAY_WINDOW',
    'TERMINAL_ID_RISK_30DAY_WINDOW'
]
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_DIR = "app/ml_models/" # Directory to store model files

# --- PyTorch Model Definitions ---
class SimpleAutoencoder(torch.nn.Module):
    def __init__(self, input_size, intermediate_size, code_size):
        super().__init__()
        self.encoder = torch.nn.Sequential(
            torch.nn.Linear(input_size, intermediate_size), torch.nn.ReLU(),
            torch.nn.Linear(intermediate_size, code_size), torch.nn.ReLU()
        )
        self.decoder = torch.nn.Sequential(
            torch.nn.Linear(code_size, intermediate_size), torch.nn.ReLU(),
            torch.nn.Linear(intermediate_size, input_size)
        )
    def forward(self, x): return self.decoder(self.encoder(x))

class SimpleFraudMLP(torch.nn.Module):
    def __init__(self, input_size, hidden_size, dropout_rate):
        super().__init__()
        self.network = torch.nn.Sequential(
            torch.nn.Linear(input_size, hidden_size), torch.nn.ReLU(),
            torch.nn.Dropout(dropout_rate),
            torch.nn.Linear(hidden_size, 1), torch.nn.Sigmoid()
        )
    def forward(self, x): return self.network(x)

# --- Enhanced Fraud Predictor Service ---

class FraudPredictor:
    def __init__(self, model_dir: str = MODEL_DIR):
        self.model_dir = model_dir
        self.autoencoder = None
        self.classifier = None
        self.scaler_features = None
        self.scaler_error = None
        self.models_loaded = False
        self._load_models()

    def _load_models(self):
        try:
            # Check if files exist first
            scaler_features_path = os.path.join(self.model_dir, 'scaler_features.pkl')
            scaler_error_path = os.path.join(self.model_dir, 'scaler_error.pkl')
            autoencoder_path = os.path.join(self.model_dir, 'autoencoder_best.pth')
            classifier_path = os.path.join(self.model_dir, 'classifier_best.pth')
            
            for path in [scaler_features_path, scaler_error_path, autoencoder_path, classifier_path]:
                if not os.path.exists(path):
                    logger.error(f"❌ Model file not found: {path}")
                    raise FileNotFoundError(f"Model file not found: {path}")
                logger.info(f"✅ Found model file: {path} (size: {os.path.getsize(path)} bytes)")

            # Load scalers with verification
            with open(scaler_features_path, 'rb') as f:
                self.scaler_features = pickle.load(f)
            logger.info(f"✅ Loaded feature scaler: {type(self.scaler_features)}")
            
            with open(scaler_error_path, 'rb') as f:
                self.scaler_error = pickle.load(f)
            logger.info(f"✅ Loaded error scaler: {type(self.scaler_error)}")

            # Load Autoencoder with verification
            self.autoencoder = SimpleAutoencoder(len(INPUT_FEATURES), 10, 5).to(DEVICE)
            autoencoder_state = torch.load(autoencoder_path, map_location=DEVICE)
            self.autoencoder.load_state_dict(autoencoder_state)
            self.autoencoder.eval()
            logger.info(f"✅ Loaded autoencoder: {len(INPUT_FEATURES)} input features")

            # Load Classifier with verification
            classifier_input_size = len(INPUT_FEATURES) + 1  # Features + reconstruction_error
            self.classifier = SimpleFraudMLP(classifier_input_size, 100, 0.2).to(DEVICE)
            classifier_state = torch.load(classifier_path, map_location=DEVICE)
            self.classifier.load_state_dict(classifier_state)
            self.classifier.eval()
            logger.info(f"✅ Loaded classifier: {classifier_input_size} input features")

            self.models_loaded = True
            logger.info("✅ All fraud detection models loaded successfully.")

        except FileNotFoundError as e:
            logger.error(f"❌ Error loading model files: {e}. Ensure models are in '{self.model_dir}'.")
            self.models_loaded = False
            raise e
        except Exception as e:
            logger.error(f"❌ An unexpected error occurred during model loading: {e}")
            self.models_loaded = False
            raise e

    def manual_anomaly_check(self, transaction_features: Dict[str, float]) -> tuple[bool, float, str]:
        """Manual anomaly detection as backup to ML model"""
        
        tx_amount = transaction_features.get("TX_AMOUNT", 0)
        avg_amount_30d = transaction_features.get("CUSTOMER_ID_AVG_AMOUNT_30DAY_WINDOW", 0)
        avg_amount_7d = transaction_features.get("CUSTOMER_ID_AVG_AMOUNT_7DAY_WINDOW", 0)
        avg_amount_1d = transaction_features.get("CUSTOMER_ID_AVG_AMOUNT_1DAY_WINDOW", 0)
        
        # Use the most recent average (1-day if available, otherwise 7-day, otherwise 30-day)
        recent_avg = avg_amount_1d if avg_amount_1d > 0 else (avg_amount_7d if avg_amount_7d > 0 else avg_amount_30d)
        
        # Check if transaction amount is significantly higher than average
        if recent_avg > 0:
            amount_ratio = tx_amount / recent_avg
            logger.info(f"🔍 Manual check: tx_amount={tx_amount}, recent_avg={recent_avg}, ratio={amount_ratio:.2f}")
            
            if amount_ratio > 20:  # 20x higher than average
                return True, 0.95, f"Amount is {amount_ratio:.1f}x higher than average"
            elif amount_ratio > 10:  # 10x higher than average
                return True, 0.85, f"Amount is {amount_ratio:.1f}x higher than average"
            elif amount_ratio > 5:  # 5x higher than average
                return True, 0.70, f"Amount is {amount_ratio:.1f}x higher than average"
        
        # Check for very high absolute amounts
        if tx_amount > 50000:
            return True, 0.90, f"Very high transaction amount: ₹{tx_amount}"
        elif tx_amount > 20000:
            return True, 0.75, f"High transaction amount: ₹{tx_amount}"
        elif tx_amount > 10000:
            return True, 0.60, f"Elevated transaction amount: ₹{tx_amount}"
        
        # Check for weekend/night transactions with high amounts
        is_weekend = transaction_features.get("TX_DURING_WEEKEND", 0) == 1
        is_night = transaction_features.get("TX_DURING_NIGHT", 0) == 1
        
        if (is_weekend or is_night) and tx_amount > 5000:
            return True, 0.65, f"High amount transaction during {'weekend' if is_weekend else 'night'}"
        
        return False, 0.0, "No manual anomalies detected"

    def debug_prediction(self, transaction_features: Dict) -> Dict:
        """Debug version that shows intermediate steps"""
        
        logger.info(f"🔍 DEBUG: Input features: {transaction_features}")
        
        if not self.models_loaded:
            logger.error("❌ Models not loaded, cannot perform debug prediction")
            return {"error": "Models not loaded"}
        
        try:
            # Create DataFrame and scale features
            df = pd.DataFrame([transaction_features])
            ordered_df = df[INPUT_FEATURES]
            logger.info(f"🔍 DEBUG: Ordered features shape: {ordered_df.shape}")
            logger.info(f"🔍 DEBUG: Ordered features: {ordered_df.iloc[0].to_dict()}")
            
            # Scale features
            scaled_features = self.scaler_features.transform(ordered_df)
            logger.info(f"🔍 DEBUG: Scaled features shape: {scaled_features.shape}")
            logger.info(f"🔍 DEBUG: Scaled features sample: {scaled_features[0][:5]}...")
            
            # Get reconstruction error
            features_tensor = torch.FloatTensor(scaled_features).to(DEVICE)
            
            with torch.no_grad():
                reconstructed = self.autoencoder(features_tensor)
                mse_loss = torch.mean((features_tensor - reconstructed)**2, dim=1).cpu().numpy().reshape(-1, 1)
            
            logger.info(f"🔍 DEBUG: Reconstruction error: {mse_loss}")
            
            # Scale reconstruction error
            error_df = pd.DataFrame(mse_loss, columns=['reconstruction_error'])
            scaled_error = self.scaler_error.transform(error_df)
            logger.info(f"🔍 DEBUG: Scaled reconstruction error: {scaled_error}")
            
            # Combine and predict
            combined_features = np.hstack([scaled_features, scaled_error])
            combined_tensor = torch.FloatTensor(combined_features).to(DEVICE)
            
            with torch.no_grad():
                prediction = self.classifier(combined_tensor)
                prediction_value = prediction.cpu().numpy()[0][0]
            
            logger.info(f"🔍 DEBUG: Final ML prediction: {prediction_value}")
            
            return {
                "scaled_features": scaled_features.tolist(),
                "reconstruction_error": mse_loss.tolist(),
                "scaled_error": scaled_error.tolist(),
                "combined_features_shape": combined_features.shape,
                "ml_prediction": float(prediction_value)
            }
            
        except Exception as e:
            logger.error(f"❌ Debug prediction failed: {e}")
            return {"error": str(e)}

    def predict(self, transaction_features: Dict) -> float:
        # First check if we have all required features
        if not all(k in transaction_features for k in INPUT_FEATURES):
            missing_keys = [k for k in INPUT_FEATURES if k not in transaction_features]
            logger.error(f"❌ Missing required features for prediction: {missing_keys}")
            raise ValueError(f"Missing required features for prediction: {missing_keys}")

        # Manual anomaly check first (as backup)
        manual_anomaly, manual_prob, manual_reason = self.manual_anomaly_check(transaction_features)
        logger.info(f"🔍 Manual anomaly check: anomaly={manual_anomaly}, prob={manual_prob:.3f}, reason='{manual_reason}'")

        # If models are not loaded, fall back to manual detection
        if not self.models_loaded:
            logger.warning("⚠️ ML models not loaded, using manual detection only")
            return manual_prob if manual_anomaly else 0.0

        try:
            # Create a DataFrame from the input dictionary
            df = pd.DataFrame([transaction_features])
            ordered_df = df[INPUT_FEATURES]
            
            # 1. Scale the input features using the DataFrame (preserves feature names)
            scaled_features = self.scaler_features.transform(ordered_df)
            features_tensor = torch.FloatTensor(scaled_features).to(DEVICE)

            # 2. Get reconstruction error from the autoencoder
            with torch.no_grad():
                reconstructed = self.autoencoder(features_tensor)
                mse_loss = torch.mean((features_tensor - reconstructed)**2, dim=1).cpu().numpy().reshape(-1, 1)

            # 3. Scale the reconstruction error using a DataFrame to maintain consistency
            error_df = pd.DataFrame(mse_loss, columns=['reconstruction_error'])
            scaled_error = self.scaler_error.transform(error_df)

            # 4. Combine features and error, and predict with the classifier
            combined_features = np.hstack([scaled_features, scaled_error])
            combined_tensor = torch.FloatTensor(combined_features).to(DEVICE)

            with torch.no_grad():
                ml_prediction = self.classifier(combined_tensor)
                ml_prob = ml_prediction.cpu().numpy()[0][0]

            logger.info(f"🔍 ML prediction: {ml_prob:.6f}")
            
            # Use the higher of ML prediction or manual detection
            final_prob = max(float(ml_prob), manual_prob if manual_anomaly else 0.0)
            
            if manual_anomaly and manual_prob > ml_prob:
                logger.warning(f"⚠️ Manual detection override: manual={manual_prob:.3f} > ml={ml_prob:.6f}")
            
            return final_prob

        except Exception as e:
            logger.error(f"❌ ML prediction failed, falling back to manual detection: {e}")
            return manual_prob if manual_anomaly else 0.0

# Create global instance
fraud_predictor = FraudPredictor()