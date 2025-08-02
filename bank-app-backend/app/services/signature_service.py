import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

def preprocess_signature(image_data: str):
    """
    Preprocess the signature image for feature extraction
    """
    try:
        logger.info("Starting signature preprocessing...")
        
        # Decode base64 image
        if ',' in image_data:
            img_bytes = base64.b64decode(image_data.split(',')[1])
        else:
            img_bytes = base64.b64decode(image_data)
            
        # Convert to PIL Image and then to numpy array
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        img = np.array(img)
        
        # Convert to grayscale
        if len(img.shape) == 3:
            img_gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        else:
            img_gray = img
        
        # Resize to standard size
        img_resized = cv2.resize(img_gray, (512, 256))
        
        # Apply Gaussian blur to reduce noise
        img_blur = cv2.GaussianBlur(img_resized, (3, 3), 0)
        
        # Binarization using adaptive threshold
        img_binary = cv2.adaptiveThreshold(img_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                         cv2.THRESH_BINARY_INV, 11, 2)
        
        # Morphological operations to clean up
        kernel = np.ones((2,2), np.uint8)
        img_cleaned = cv2.morphologyEx(img_binary, cv2.MORPH_CLOSE, kernel)
        img_cleaned = cv2.morphologyEx(img_cleaned, cv2.MORPH_OPEN, kernel)
        
        # Center the signature
        contours, _ = cv2.findContours(img_cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            img_centered = np.zeros_like(img_cleaned)
            center_x = (img_cleaned.shape[1] - w) // 2
            center_y = (img_cleaned.shape[0] - h) // 2
            
            if center_x >= 0 and center_y >= 0 and center_x + w < img_cleaned.shape[1] and center_y + h < img_cleaned.shape[0]:
                img_centered[center_y:center_y+h, center_x:center_x+w] = img_cleaned[y:y+h, x:x+w]
            else:
                img_centered = img_cleaned
        else:
            img_centered = img_cleaned
        
        logger.info("Signature preprocessing completed successfully")
        return img_centered
        
    except Exception as e:
        logger.error(f"Preprocessing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

def extract_sift_features(img):
    """
    Extract SIFT features from the preprocessed image
    """
    try:
        sift = cv2.SIFT_create(nfeatures=100)
        keypoints, descriptors = sift.detectAndCompute(img, None)
        
        if descriptors is not None:
            logger.info(f"Extracted {len(descriptors)} SIFT features")
            descriptors = descriptors.tolist()  # Convert to list for JSON serialization
        else:
            logger.warning("No SIFT features found")
            descriptors = []
        
        return descriptors
    except Exception as e:
        logger.error(f"SIFT feature extraction failed: {str(e)}")
        return []

def extract_contour_features(img):
    """
    Extract contour-based features
    """
    try:
        contours, _ = cv2.findContours(img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        largest_contour = max(contours, key=cv2.contourArea)
        
        area = cv2.contourArea(largest_contour)
        perimeter = cv2.arcLength(largest_contour, True)
        x, y, w, h = cv2.boundingRect(largest_contour)
        aspect_ratio = w / h if h != 0 else 0
        hull = cv2.convexHull(largest_contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area != 0 else 0
        extent = area / (w * h) if (w * h) != 0 else 0
        
        features = {
            'area': float(area),
            'perimeter': float(perimeter),
            'aspect_ratio': float(aspect_ratio),
            'solidity': float(solidity),
            'extent': float(extent)
        }
        
        logger.info("Contour features extracted successfully")
        return features
        
    except Exception as e:
        logger.error(f"Contour feature extraction failed: {str(e)}")
        return None

def extract_hu_moments(img):
    """
    Extract Hu moments
    """
    try:
        moments = cv2.moments(img)
        hu_moments = cv2.HuMoments(moments)
        hu_moments = -np.sign(hu_moments) * np.log10(np.abs(hu_moments) + 1e-10)
        hu_moments = hu_moments.flatten().astype(float).tolist()  # Convert to list for JSON
        
        logger.info("Hu moments extracted successfully")
        return hu_moments
        
    except Exception as e:
        logger.error(f"Hu moments extraction failed: {str(e)}")
        return []

def extract_all_features(img):
    """
    Extract all types of features from the signature
    """
    try:
        sift_descriptors = extract_sift_features(img)
        contour_features = extract_contour_features(img)
        hu_moments = extract_hu_moments(img)
        
        return {
            'sift_descriptors': sift_descriptors,
            'contour_features': contour_features,
            'hu_moments': hu_moments
        }
        
    except Exception as e:
        logger.error(f"Feature extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Feature extraction failed: {str(e)}")

def match_sift_features(des1, des2):
    """
    Match SIFT features using FLANN matcher
    """
    if not des1 or not des2:
        return 0.0
    
    if len(des1) < 2 or len(des2) < 2:
        return 0.0
    
    try:
        FLANN_INDEX_KDTREE = 1
        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
        search_params = dict(checks=50)
        
        flann = cv2.FlannBasedMatcher(index_params, search_params)
        matches = flann.knnMatch(np.array(des1, dtype=np.float32), np.array(des2, dtype=np.float32), k=2)
        
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.7 * n.distance:
                    good_matches.append(m)
        
        match_ratio = len(good_matches) / min(len(des1), len(des2))
        logger.info(f"SIFT match ratio: {match_ratio:.3f}")
        
        return float(match_ratio)
        
    except Exception as e:
        logger.error(f"SIFT matching failed: {str(e)}")
        return 0.0

def match_contour_features(features1, features2):
    """
    Compare contour features
    """
    if features1 is None or features2 is None:
        return 0.0
    
    try:
        aspect_diff = abs(features1['aspect_ratio'] - features2['aspect_ratio']) / max(features1['aspect_ratio'], features2['aspect_ratio'], 0.1)
        solidity_diff = abs(features1['solidity'] - features2['solidity']) / max(features1['solidity'], features2['solidity'], 0.1)
        extent_diff = abs(features1['extent'] - features2['extent']) / max(features1['extent'], features2['extent'], 0.1)
        
        similarity = 1 - (aspect_diff + solidity_diff + extent_diff) / 3
        similarity = max(0, similarity)
        
        logger.info(f"Contour feature similarity: {similarity:.3f}")
        return float(similarity)
        
    except Exception as e:
        logger.error(f"Contour feature matching failed: {str(e)}")
        return 0.0

def match_hu_moments(moments1, moments2):
    """
    Compare Hu moments
    """
    if not moments1 or not moments2:
        return 0.0
    
    try:
        distance = np.linalg.norm(np.array(moments1) - np.array(moments2))
        similarity = 1 / (1 + distance)
        
        logger.info(f"Hu moments similarity: {similarity:.3f}")
        return float(similarity)
        
    except Exception as e:
        logger.error(f"Hu moments matching failed: {str(e)}")
        return 0.0

def calculate_final_score(sift_score, contour_score, hu_score):
    """
    Calculate weighted final score
    """
    sift_weight = 0.5
    contour_weight = 0.3
    hu_weight = 0.2
    
    final_score = (sift_weight * sift_score + 
                   contour_weight * contour_score + 
                   hu_weight * hu_score)
    
    logger.info(f"Final weighted score: {final_score:.3f}")
    return float(final_score)