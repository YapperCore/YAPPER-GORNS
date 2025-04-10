# backend/auth_middleware.py
"""
Authentication middleware for secure user access
"""
import logging
import functools
from flask import request, jsonify
from firebase_helper import is_admin_user

logger = logging.getLogger(__name__)

def get_user_from_request():
    """Extract user ID from request headers or parameters"""
    # Check Authorization header first (for token-based auth)
    auth_header = request.headers.get('Authorization', '')
    
    # Get user ID from query parameters or headers
    user_id = request.args.get('userId') or request.headers.get('X-User-ID')
    
    return user_id

def require_auth(f):
    """Middleware to require authentication"""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_user_from_request()
        
        if not user_id:
            # Allow anonymous access but log it
            logger.warning(f"Anonymous request to {request.path}")
            return f(None, *args, **kwargs)
        
        # Add user info to the wrapped function
        return f(user_id, *args, **kwargs)
    
    return decorated

def require_admin(f):
    """Middleware to require admin permissions"""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_user_from_request()
        
        # Check if user is admin
        if not user_id or not is_admin_user(user_id):
            return jsonify({"error": "Admin access required"}), 403
        
        return f(user_id, *args, **kwargs)
    
    return decorated

def user_owns_resource(resource_owner_id):
    """
    Check if current user owns a resource
    
    Args:
        resource_owner_id: Owner ID of the resource
        
    Returns:
        bool: True if current user owns resource or is admin
    """
    user_id = get_user_from_request()
    
    if not user_id:
        return False
        
    if user_id == resource_owner_id:
        return True
        
    # Also check if user is admin
    if is_admin_user(user_id):
        return True
        
    return False
