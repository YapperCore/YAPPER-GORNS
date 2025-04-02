from flask_socketio import SocketIO
from config import CORS_ALLOWED_ORIGINS

socketio = SocketIO(cors_allowed_origins=CORS_ALLOWED_ORIGINS)
