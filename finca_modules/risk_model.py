"""
risk_model.py — ML risk profile prediction
==========================================
Loads the best model from model_comparison.py if available,
falls back to K-Means trained on 48 synthetic profiles.

Risk profiles: aggressive / moderate / conservative
Features:      [age, surplus_ratio, dependents, has_emi]

To generate best_model.pkl:
    python3 model_comparison.py
"""

import os
import pickle
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def load_best_model(base_dir=None):
    """
    Load best supervised model saved by model_comparison.py.
    Returns (model, scaler, label_encoder_or_cluster_map, model_name).
    Returns (None, None, None, None) if pkl not found.
    """
    if base_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    pkl_path = os.path.join(base_dir, "best_model.pkl")
    if os.path.exists(pkl_path):
        with open(pkl_path, "rb") as f:
            data = pickle.load(f)
        print(
            f"  Loaded best model: {data['model_name']} "
            f"(CV acc: {data['cv_accuracy']:.1%}) from best_model.pkl"
        )
        return data["model"], data["scaler"], data["le"], data["model_name"]
    return None, None, None, None


def train_kmeans_fallback():
    """
    K-Means trained on 48 hand-crafted synthetic profiles.
    Used only when best_model.pkl doesn't exist.
    Clusters are mapped to risk labels by surplus_ratio of cluster centres.
    """
    training_profiles = np.array([
        # AGGRESSIVE: young, high surplus, few dependents
        [22,0.65,0,0],[23,0.60,0,0],[24,0.58,0,0],[25,0.55,0,0],
        [23,0.70,0,0],[24,0.62,0,0],[26,0.55,0,0],[27,0.50,0,0],
        [25,0.60,1,0],[26,0.58,0,0],[22,0.72,0,0],[28,0.52,0,0],
        [27,0.48,1,0],[29,0.50,0,0],[24,0.65,0,0],[23,0.68,0,0],
        # MODERATE: mid-age, moderate surplus, some dependents
        [28,0.40,1,0],[30,0.38,1,1],[31,0.35,1,1],[32,0.32,1,1],
        [29,0.42,0,1],[33,0.30,2,0],[34,0.28,1,1],[35,0.35,1,0],
        [36,0.30,2,1],[30,0.45,1,0],[31,0.40,0,1],[32,0.38,1,0],
        [33,0.36,2,0],[34,0.32,1,1],[29,0.44,1,1],[35,0.33,1,1],
        # CONSERVATIVE: older, low surplus, many dependents
        [38,0.20,2,1],[40,0.18,2,1],[42,0.15,3,1],[44,0.12,2,1],
        [45,0.10,3,1],[47,0.14,2,1],[48,0.08,3,1],[50,0.10,2,1],
        [52,0.12,2,0],[54,0.09,3,1],[56,0.08,2,1],[58,0.07,1,0],
        [39,0.16,3,1],[43,0.13,2,1],[46,0.11,3,1],[55,0.10,2,1],
    ])

    scaler = StandardScaler()
    X = scaler.fit_transform(training_profiles)
    km = KMeans(n_clusters=3, random_state=42, n_init=20)
    km.fit(X)

    centers = scaler.inverse_transform(km.cluster_centers_)
    surplus_rank = sorted(range(3), key=lambda i: centers[i][1], reverse=True)
    cluster_map = {
        surplus_rank[0]: "aggressive",
        surplus_rank[1]: "moderate",
        surplus_rank[2]: "conservative",
    }
    return km, scaler, cluster_map


def get_risk_model():
    """
    Entry point for finca.py.
    Returns (model, scaler, label_encoder_or_cluster_map, model_name).
    """
    model, scaler, le, name = load_best_model()
    if model is not None:
        return model, scaler, le, name

    print("  best_model.pkl not found — training K-Means fallback...", end=" ")
    km, scaler, cluster_map = train_kmeans_fallback()
    print("done.")
    return km, scaler, cluster_map, "K-Means"


def predict_risk_profile(age, surplus_ratio, dependents, has_emi,
                          model, scaler, label_encoder_or_map, model_name):
    """
    Predicts risk profile with hard override rules applied first.

    Override rules (domain knowledge that overrides the model):
      - Age >= 55              → always conservative
      - Very young, high surplus, no dependents → always aggressive
      - Very low surplus or many dependents + EMI → always conservative

    Falls through to ML model for all other cases.
    """
    # Hard overrides
    if age >= 55:
        return "conservative"
    if age <= 25 and surplus_ratio > 0.55 and dependents == 0 and not has_emi:
        return "aggressive"
    if surplus_ratio < 0.10 or (dependents >= 3 and has_emi):
        return "conservative"

    # ML prediction
    features = np.array([[age, surplus_ratio, dependents, int(has_emi)]])
    scaled   = scaler.transform(features)

    if model_name == "K-Means":
        return label_encoder_or_map[model.predict(scaled)[0]]
    else:
        pred_enc = model.predict(scaled)[0]
        return label_encoder_or_map.inverse_transform([pred_enc])[0]
