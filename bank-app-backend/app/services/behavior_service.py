# --- File: bank-app-backend/app/services/behavior_service.py ---
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Optional, Tuple, List
import uuid
import statistics
import math

from app.db.models.behavior import UserBehavior
from app.schemas.behavior import BehaviorDataCreate

class BehaviorService:
    def __init__(self, db: Session):
        self.db = db
    
    # ✅ RELAXED: More realistic deviation thresholds for production use
    BASE_DEVIATION_THRESHOLDS = {
        'flight_avg': 1.5,        # ±1.5 seconds (was 0.5) - typing speed varies a lot
        'traj_avg': 50.0,         # ±50 pixels (was 25.0) - mouse movements are highly variable
        'typing_speed': 30.0,     # ±30 chars/min (was 15.0) - typing speed varies significantly
        'correction_rate': 10.0,  # ±10 corrections/min (was 5.0) - depends on content complexity
        'clicks_per_minute': 25.0 # ±25 clicks/min (was 10.0) - UI interaction patterns vary widely
    }
    
    # ✅ RELAXED: More lenient minimum acceptable values
    MIN_ACCEPTABLE_VALUES = {
        'flight_avg': 0.001,      # 1ms minimum (was 0.01) - very fast typists exist
        'traj_avg': 2.0,          # 2 pixels minimum (was 5.0) - small precise movements
        'typing_speed': 0.05,     # 0.05 chars/min minimum (was 0.1) - very slow typing ok
        'correction_rate': 0.0,   # Can be 0 (no corrections) - unchanged
        'clicks_per_minute': 0.05 # 0.05 clicks/min minimum (was 0.1) - minimal activity ok
    }
    
    # ✅ RELAXED: More flexible adaptive threshold configuration
    ADAPTIVE_CONFIG = {
        'min_sessions_for_adaptive': 5,      # Need at least 5 sessions (was 10) - faster adaptation
        'std_dev_multiplier': 3.0,          # 3 standard deviations (was 2.0) - more lenient
        'max_threshold_multiplier': 5.0,    # Maximum 5x base threshold (was 3.0) - allow more variation
        'min_threshold_multiplier': 0.2,    # Minimum 0.2x base threshold (was 0.3) - tighter for consistent users
    }

    def validate_metric(self, value: float, metric_name: str) -> float:
        """Validate and correct individual metric values."""
        if metric_name == "flight_avg" and value < 0:
            print(f"Warning: {metric_name} = {value:.6f} is negative. Setting to 0.001")
            return 0.001
        if metric_name == "traj_avg" and value < 0:
            print(f"Warning: {metric_name} = {value:.6f} is negative. Setting to 2.0")
            return 2.0
        if metric_name == "correction_rate" and value < 0:
            print(f"Warning: {metric_name} = {value:.6f} is negative. Setting to 0.0")
            return 0.0
        if metric_name == "typing_speed" and value < 0:
            print(f"Warning: {metric_name} = {value:.6f} is negative. Setting to 0.0")
            return 0.0
        if metric_name == "clicks_per_minute" and value < 0:
            print(f"Warning: {metric_name} = {value:.6f} is negative. Setting to 0.0")
            return 0.0
        return value

    def is_data_quality_acceptable(self, validated_metrics: Dict[str, float]) -> Tuple[bool, str]:
        """Check if the behavioral data has acceptable quality - more lenient rules."""
        print(f"\n--- Data Quality Check ---")
        
        zero_count = 0
        below_minimum_count = 0
        
        for metric_name, value in validated_metrics.items():
            min_acceptable = self.MIN_ACCEPTABLE_VALUES[metric_name]
            
            if value == 0:
                zero_count += 1
                print(f"  {metric_name}: {value} (ZERO VALUE)")
            elif value < min_acceptable:
                below_minimum_count += 1
                print(f"  {metric_name}: {value} (BELOW MINIMUM {min_acceptable})")
            else:
                print(f"  {metric_name}: {value} ✅")
        
        total_problematic = zero_count + below_minimum_count
        
        # ✅ RELAXED: Allow more zero values before rejection
        if zero_count >= 4:  # Allow up to 3 zero values (was >= 3)
            return False, f"Too many zero values ({zero_count}/5 metrics are zero)"
        
        # ✅ RELAXED: Allow more problematic values
        if total_problematic >= 5:  # Only reject if ALL metrics are problematic (was >= 4)
            return False, f"Poor data quality ({total_problematic}/5 metrics are zero or below minimum)"
        
        # ✅ RELAXED: Only reject if BOTH mouse metrics are zero (critical for mouse activity)
        if validated_metrics['flight_avg'] == 0 and validated_metrics['traj_avg'] == 0 and validated_metrics['clicks_per_minute'] == 0:
            return False, "No meaningful user interaction detected (flight_avg, traj_avg, and clicks_per_minute all zero)"
        
        print(f"✅ Data quality acceptable: {zero_count} zeros, {below_minimum_count} below minimum")
        return True, "Data quality acceptable"

    def calculate_user_statistics(self, behaviors: List[UserBehavior]) -> Dict[str, Dict[str, float]]:
        """Calculate detailed statistics for each metric from user's historical data."""
        metrics_data = {
            'flight_avg': [b.flight_avg for b in behaviors],
            'traj_avg': [b.traj_avg for b in behaviors],
            'typing_speed': [b.typing_speed for b in behaviors],
            'correction_rate': [b.correction_rate for b in behaviors],
            'clicks_per_minute': [b.clicks_per_minute for b in behaviors]
        }
        
        statistics_result = {}
        
        for metric_name, values in metrics_data.items():
            if len(values) >= 2:  # Need at least 2 values for standard deviation
                avg = statistics.mean(values)
                std_dev = statistics.stdev(values) if len(values) > 1 else 0
                min_val = min(values)
                max_val = max(values)
                
                statistics_result[metric_name] = {
                    'mean': avg,
                    'std_dev': std_dev,
                    'min': min_val,
                    'max': max_val,
                    'range': max_val - min_val,
                    'coefficient_of_variation': (std_dev / avg) if avg > 0 else 0
                }
            else:
                # Not enough data for meaningful statistics
                statistics_result[metric_name] = {
                    'mean': values[0] if values else 0,
                    'std_dev': 0,
                    'min': values[0] if values else 0,
                    'max': values[0] if values else 0,
                    'range': 0,
                    'coefficient_of_variation': 0
                }
        
        return statistics_result

    def calculate_adaptive_thresholds(self, user_statistics: Dict[str, Dict[str, float]], 
                                    user_count: int) -> Dict[str, float]:
        """Calculate adaptive thresholds based on user's historical variance."""
        print(f"\n--- Calculating Adaptive Thresholds ---")
        
        adaptive_thresholds = self.BASE_DEVIATION_THRESHOLDS.copy()
        
        if user_count < self.ADAPTIVE_CONFIG['min_sessions_for_adaptive']:
            print(f"Not enough sessions ({user_count}) for adaptive thresholds. Using base thresholds.")
            return adaptive_thresholds
        
        print(f"User has {user_count} sessions. Calculating adaptive thresholds...")
        
        for metric_name, base_threshold in self.BASE_DEVIATION_THRESHOLDS.items():
            if metric_name in user_statistics:
                stats = user_statistics[metric_name]
                std_dev = stats['std_dev']
                mean = stats['mean']
                cv = stats['coefficient_of_variation']
                
                # Calculate adaptive threshold using standard deviation
                if std_dev > 0 and mean > 0:
                    # Use standard deviation multiplied by confidence factor
                    std_dev_threshold = std_dev * self.ADAPTIVE_CONFIG['std_dev_multiplier']
                    
                    # Apply bounds to prevent extreme thresholds
                    min_allowed = base_threshold * self.ADAPTIVE_CONFIG['min_threshold_multiplier']
                    max_allowed = base_threshold * self.ADAPTIVE_CONFIG['max_threshold_multiplier']
                    
                    adaptive_threshold = max(min_allowed, min(max_allowed, std_dev_threshold))
                    
                    print(f"  {metric_name}:")
                    print(f"    Base threshold: {base_threshold:.4f}")
                    print(f"    User std_dev: {std_dev:.4f}")
                    print(f"    User CV: {cv:.4f}")
                    print(f"    Calculated adaptive: {std_dev_threshold:.4f}")
                    print(f"    Final adaptive: {adaptive_threshold:.4f}")
                    
                    adaptive_thresholds[metric_name] = adaptive_threshold
                else:
                    print(f"  {metric_name}: Using base threshold (insufficient variance data)")
        
        return adaptive_thresholds

    def get_user_averages(self, customer_unique_id: uuid.UUID) -> Optional[Dict[str, float]]:
        """Calculate average metrics for a specific user, excluding low-quality records."""
        # Query all behavior records for this user
        all_behaviors = self.db.query(UserBehavior).filter(
            UserBehavior.customer_unique_id == customer_unique_id
        ).all()
        
        if not all_behaviors:
            print(f"No existing behavioral data found for user {customer_unique_id}")
            return None
        
        # Filter out low-quality records (using more lenient quality check)
        quality_behaviors = []
        for behavior in all_behaviors:
            metrics = {
                'flight_avg': behavior.flight_avg,
                'traj_avg': behavior.traj_avg,
                'typing_speed': behavior.typing_speed,
                'correction_rate': behavior.correction_rate,
                'clicks_per_minute': behavior.clicks_per_minute
            }
            
            is_quality, _ = self.is_data_quality_acceptable(metrics)
            if is_quality:
                quality_behaviors.append(behavior)
            else:
                print(f"  Excluding low-quality record: session_id={behavior.session_id}")
        
        if not quality_behaviors:
            print(f"No quality behavioral data found for user {customer_unique_id}")
            return None
        
        # Calculate averages and statistics from quality records
        count = len(quality_behaviors)
        averages = {
            'flight_avg': sum(b.flight_avg for b in quality_behaviors) / count,
            'traj_avg': sum(b.traj_avg for b in quality_behaviors) / count,
            'typing_speed': sum(b.typing_speed for b in quality_behaviors) / count,
            'correction_rate': sum(b.correction_rate for b in quality_behaviors) / count,
            'clicks_per_minute': sum(b.clicks_per_minute for b in quality_behaviors) / count,
            'count': count,
            'total_records': len(all_behaviors),
            'excluded_records': len(all_behaviors) - count
        }
        
        # Add detailed user statistics for adaptive thresholds
        user_statistics = self.calculate_user_statistics(quality_behaviors)
        averages['user_statistics'] = user_statistics
        
        print(f"Calculated averages for user {customer_unique_id}:")
        print(f"  Used {count} quality records (excluded {averages['excluded_records']} low-quality)")
        
        return averages

    def check_deviation(self, new_metrics: Tuple[float, float, float, float, float], 
                       averages: Dict[str, float]) -> bool:
        """Check if new metrics deviate too much from existing averages using adaptive thresholds."""
        flight_avg, traj_avg, typing_speed, correction_rate, clicks_per_minute = new_metrics
        
        metrics_dict = {
            'flight_avg': flight_avg,
            'traj_avg': traj_avg,
            'correction_rate': correction_rate,
            'typing_speed': typing_speed,
            'clicks_per_minute': clicks_per_minute
        }
        
        print(f"\n--- Deviation Check ---")
        print(f"Current averages from database (based on {averages['count']} quality rows):")
        for metric, avg_val in averages.items():
            if metric not in ['count', 'total_records', 'excluded_records', 'user_statistics']:
                print(f"  {metric}: {avg_val:.4f}")
        
        print(f"\nNew session metrics:")
        for metric, new_val in metrics_dict.items():
            print(f"  {metric}: {new_val:.4f}")
        
        # Calculate adaptive thresholds
        user_statistics = averages.get('user_statistics', {})
        adaptive_thresholds = self.calculate_adaptive_thresholds(
            user_statistics, 
            averages['count']
        )
        
        print(f"\nDeviation analysis with adaptive thresholds:")
        
        # ✅ RELAXED: Count failures but don't reject immediately
        failed_metrics = []
        
        for metric, new_val in metrics_dict.items():
            avg_val = averages[metric]
            deviation = abs(new_val - avg_val)
            threshold = adaptive_thresholds[metric]
            
            status = "✅ PASS" if deviation <= threshold else "❌ FAIL"
            threshold_type = "ADAPTIVE" if averages['count'] >= self.ADAPTIVE_CONFIG['min_sessions_for_adaptive'] else "BASE"
            
            print(f"  {metric}: deviation={deviation:.4f}, threshold={threshold:.4f} ({threshold_type}), {status}")
            
            if deviation > threshold:
                failed_metrics.append(metric)
                print(f"⚠️  WARNING: {metric} deviation ({deviation:.4f}) exceeds {threshold_type.lower()} threshold ({threshold:.4f})")
                print(f"   Current: {new_val:.4f}, Average: {avg_val:.4f}")
        
        # ✅ RELAXED: Only reject if multiple critical metrics fail OR one metric fails by a huge margin
        if len(failed_metrics) >= 3:  # Allow 1-2 metrics to fail
            print(f"❌ REJECTION: Too many metrics failed ({len(failed_metrics)}/5): {failed_metrics}")
            return False
        
        # Check for extreme deviations (more than 2x the threshold)
        for metric in failed_metrics:
            new_val = metrics_dict[metric]
            avg_val = averages[metric]
            deviation = abs(new_val - avg_val)
            threshold = adaptive_thresholds[metric]
            
            if deviation > (threshold * 2):  # Extreme deviation
                print(f"❌ REJECTION: Extreme deviation in {metric}: {deviation:.4f} > {threshold * 2:.4f} (2x threshold)")
                return False
        
        if failed_metrics:
            print(f"⚠️  ACCEPTANCE WITH WARNINGS: {len(failed_metrics)} metrics exceeded thresholds but within acceptable limits")
        else:
            print(f"✅ ACCEPTANCE: All metrics within acceptable deviation limits")
        
        return True

    def validate_and_save_behavior(self, behavior_in: BehaviorDataCreate) -> Tuple[bool, UserBehavior, str]:
        """Validate behavioral data and save if it passes all checks."""
        print(f"\n=== BEHAVIORAL VALIDATION STARTED ===")
        print(f"Processing data for user: {behavior_in.customer_unique_id}")
        
        # Step 1: Validate individual metrics
        print(f"\n--- Step 1: Individual Metric Validation ---")
        validated_metrics = {
            'flight_avg': self.validate_metric(behavior_in.flight_avg, 'flight_avg'),
            'traj_avg': self.validate_metric(behavior_in.traj_avg, 'traj_avg'),
            'typing_speed': self.validate_metric(behavior_in.typing_speed, 'typing_speed'),
            'correction_rate': self.validate_metric(behavior_in.correction_rate, 'correction_rate'),
            'clicks_per_minute': self.validate_metric(behavior_in.clicks_per_minute, 'clicks_per_minute')
        }
        
        # Step 2: Check data quality
        print(f"\n--- Step 2: Data Quality Assessment ---")
        is_quality_ok, quality_message = self.is_data_quality_acceptable(validated_metrics)
        
        if not is_quality_ok:
            print(f"\n❌ BEHAVIORAL DATA REJECTED: {quality_message}")
            return False, None, f"Data quality check failed: {quality_message}"
        
        # Step 3: Check against user averages with adaptive thresholds
        averages = self.get_user_averages(behavior_in.customer_unique_id)
        
        if averages is not None:
            print(f"\n--- Step 3: Adaptive Deviation Check Against User History ---")
            new_metrics = (
                validated_metrics['flight_avg'],
                validated_metrics['traj_avg'], 
                validated_metrics['typing_speed'],
                validated_metrics['correction_rate'],
                validated_metrics['clicks_per_minute']
            )
            
            if not self.check_deviation(new_metrics, averages):
                print(f"\n❌ BEHAVIORAL DATA REJECTED: Adaptive deviation check failed")
                return False, None, "Behavioral metrics deviate too much from user's historical patterns"
        else:
            print(f"\n--- Step 3: Skipping deviation check (no quality baseline data) ---")
        
        # Step 4: Save to database
        print(f"\n--- Step 4: Saving to Database ---")
        try:
            behavior_obj = UserBehavior(
                flight_avg=validated_metrics['flight_avg'],
                traj_avg=validated_metrics['traj_avg'],
                typing_speed=validated_metrics['typing_speed'],
                correction_rate=validated_metrics['correction_rate'],
                clicks_per_minute=validated_metrics['clicks_per_minute'],
                customer_unique_id=behavior_in.customer_unique_id
            )
            
            self.db.add(behavior_obj)
            self.db.commit()
            self.db.refresh(behavior_obj)
            
            print(f"✅ BEHAVIORAL DATA SAVED: Session ID {behavior_obj.session_id}")
            print(f"=== BEHAVIORAL VALIDATION COMPLETED ===\n")
            
            return True, behavior_obj, "Behavioral data successfully validated and saved"
            
        except Exception as e:
            print(f"❌ DATABASE ERROR: {str(e)}")
            self.db.rollback()
            return False, None, f"Database error: {str(e)}"