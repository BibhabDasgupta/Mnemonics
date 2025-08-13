import pandas as pd
import numpy as np
import torch
import os
import pickle
import json
from sklearn.preprocessing import StandardScaler
from typing import List, Dict

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

# --- Fraud Predictor Service ---

class FraudPredictor:
    def __init__(self, model_dir: str = MODEL_DIR):
        self.model_dir = model_dir
        self.autoencoder = None
        self.classifier = None
        self.scaler_features = None
        self.scaler_error = None
        self._load_models()

    def _load_models(self):
        try:
            # Load scalers 
            with open(os.path.join(self.model_dir, 'scaler_features.pkl'), 'rb') as f:
                self.scaler_features = pickle.load(f)
            with open(os.path.join(self.model_dir, 'scaler_error.pkl'), 'rb') as f:
                self.scaler_error = pickle.load(f)

            # Load Autoencoder
            autoencoder_path = os.path.join(self.model_dir, 'autoencoder_best.pth')
            self.autoencoder = SimpleAutoencoder(len(INPUT_FEATURES), 10, 5).to(DEVICE)
            self.autoencoder.load_state_dict(torch.load(autoencoder_path, map_location=DEVICE))
            self.autoencoder.eval()

            # Load Classifier
            classifier_path = os.path.join(self.model_dir, 'classifier_best.pth')
            classifier_input_size = len(INPUT_FEATURES) + 1  # Features + reconstruction_error
            self.classifier = SimpleFraudMLP(classifier_input_size, 100, 0.2).to(DEVICE)
            self.classifier.load_state_dict(torch.load(classifier_path, map_location=DEVICE))
            self.classifier.eval()

            print("Fraud detection models and scalers loaded successfully.")

        except FileNotFoundError as e:
            print(f"Error loading model files: {e}. Ensure models are in '{self.model_dir}'.")
            raise e
        except Exception as e:
            print(f"An unexpected error occurred during model loading: {e}")
            raise e

    def predict(self, transaction_features: Dict) -> float:
        if not all(k in transaction_features for k in INPUT_FEATURES):
            missing_keys = [k for k in INPUT_FEATURES if k not in transaction_features]
            raise ValueError(f"Missing required features for prediction: {missing_keys}")

        # Create a DataFrame from the input dictionary - THIS IS THE KEY FIX
        df = pd.DataFrame([transaction_features])
        ordered_df = df[INPUT_FEATURES]  # This maintains the DataFrame structure with feature names
        
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
            prediction = self.classifier(combined_tensor)

        return prediction.cpu().numpy()[0][0]

fraud_predictor = FraudPredictor()