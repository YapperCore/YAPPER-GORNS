# cs3398-gorns-s25-yapper-9a8fb00da542/backend/services/firebase_service.py
import firebase_admin
from firebase_admin import credentials, storage
import os
import logging
from config import FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_STORAGE_BUCKET

logger = logging.getLogger(__name__)
bucket = None

def initialize_firebase():
    global bucket
    if not firebase_admin._apps:
        try:
            if not os.path.exists(FIREBASE_SERVICE_ACCOUNT_KEY):
                logger.error(f"Firebase service account key not found at: {FIREBASE_SERVICE_ACCOUNT_KEY}")
                raise FileNotFoundError(f"Service account key file not found: {FIREBASE_SERVICE_ACCOUNT_KEY}")

            cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_KEY)
            firebase_admin.initialize_app(cred, {
                'storageBucket': FIREBASE_STORAGE_BUCKET
            })
            bucket = storage.bucket()
            logger.info(f"Firebase Admin initialized. Storage bucket: {FIREBASE_STORAGE_BUCKET}")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            # Depending on your app's requirements, you might want to exit or handle this differently
    else:
        # Already initialized, ensure bucket is set
        if not bucket:
            bucket = storage.bucket()
        logger.info("Firebase Admin already initialized.")


def upload_to_firebase(local_path, firebase_filename, content_type='application/octet-stream'):
    """Uploads a file to Firebase Storage."""
    if not bucket:
        logger.error("Firebase Storage bucket not initialized. Cannot upload.")
        return None, "Firebase Storage not initialized"

    blob = bucket.blob(f"audio/{firebase_filename}") # Store in an 'audio' folder
    try:
        blob.upload_from_filename(local_path, content_type=content_type)
        # Make the blob publicly accessible (optional, adjust based on your security needs)
        # blob.make_public()
        # return blob.public_url, None
        # Get a signed URL valid for a long time (e.g., 100 years) - adjust as needed
        # Requires appropriate IAM permissions for the service account
        signed_url = blob.generate_signed_url(version="v4", expiration=3153600000) # approx 100 years
        logger.info(f"File {firebase_filename} uploaded to Firebase Storage.")
        return signed_url, None # Or return firebase_filename if you don't need URL immediately
    except Exception as e:
        logger.error(f"Failed to upload {firebase_filename} to Firebase: {e}")
        return None, f"Firebase upload failed: {e}"

def delete_from_firebase(firebase_filename):
    """Deletes a file from Firebase Storage."""
    if not bucket:
        logger.error("Firebase Storage bucket not initialized. Cannot delete.")
        return False, "Firebase Storage not initialized"

    blob = bucket.blob(f"audio/{firebase_filename}")
    try:
        if blob.exists():
            blob.delete()
            logger.info(f"File audio/{firebase_filename} deleted from Firebase Storage.")
            return True, None
        else:
            logger.warning(f"File audio/{firebase_filename} not found in Firebase Storage for deletion.")
            return False, "File not found in Firebase Storage"
    except Exception as e:
        logger.error(f"Failed to delete audio/{firebase_filename} from Firebase: {e}")
        return False, f"Firebase deletion failed: {e}"

# Initialize on import
initialize_firebase()
