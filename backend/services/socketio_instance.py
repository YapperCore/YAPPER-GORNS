<<<<<<< HEAD
from flask_socketio import SocketIO, join_room,emit # type: ignore
from config import CORS_ALLOWED_ORIGINS
from services.storage import save_doc_store, doc_store



socketio = SocketIO(cors_allowed_origins=CORS_ALLOWED_ORIGINS)

=======
# backend/services/socketio_instance.py
from flask_socketio import SocketIO, join_room, emit, disconnect
from services.storage import save_doc_store, doc_store
import logging

logger = logging.getLogger(__name__)

# Initialize with threading mode - will be attached to app later
socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected to socket")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected from socket")
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie

@socketio.on('join_doc')
def handle_join_doc_evt(data):
    doc_id = data.get('doc_id')
<<<<<<< HEAD
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)
=======
    if not doc_id:
        logger.warning("Join doc event without doc_id")
        return
        
    join_room(doc_id)
    logger.info(f"Client joined room: {doc_id}")
    
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        # Include any timing data stored in the document
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content'],
            'segments': doc.get('segments', [])
        }, room=doc_id)
    else:
        logger.warning(f"Doc {doc_id} not found or deleted")
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie

@socketio.on('edit_doc')
def handle_edit_doc_evt(data):
    doc_id = data.get('doc_id')
    new_content = data.get('content')
<<<<<<< HEAD
=======
    
    if not doc_id or new_content is None:
        logger.warning("Invalid edit_doc event data")
        return
        
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        doc['content'] = new_content
        save_doc_store()
<<<<<<< HEAD
    emit('doc_content_update', {
        'doc_id': doc_id,
        'content': new_content
    }, room=doc_id, include_self=False)
=======
        
        # Broadcast to all clients except sender
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': new_content,
            'segments': doc.get('segments', [])
        }, room=doc_id, include_self=False)
    else:
        logger.warning(f"Edit event for non-existent doc: {doc_id}")

@socketio.on('audio_position_update')
def handle_audio_position(data):
    """Handle audio playback position updates for highlighting text"""
    doc_id = data.get('doc_id')
    position = data.get('position')
    
    if doc_id and position is not None:
        # Broadcast current audio position to all clients in the room
        # This helps synchronize text highlighting with audio playback
        emit('audio_position', {
            'doc_id': doc_id,
            'position': position
        }, room=doc_id)

def emit_partial_transcript(doc_id, chunks, segments=None):
    """
    Emit partial transcript chunks to all clients in a document room
    
    Args:
        doc_id: Document ID
        chunks: List of transcript chunks
        segments: Optional timing information for text highlighting
    """
    if not chunks:
        return
        
    try:
        # Emit immediately without batching for real-time updates
        socketio.emit('partial_transcript_batch', {
            'doc_id': doc_id,
            'chunks': chunks,
            'segments': segments or []
        }, room=doc_id)
        
        logger.debug(f"Emitted {len(chunks)} chunks for doc {doc_id}")
    except Exception as e:
        logger.error(f"Error emitting partial transcript: {e}")

def emit_final_transcript(doc_id):
    """
    Emit final transcript completion event
    
    Args:
        doc_id: Document ID
    """
    try:
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        }, room=doc_id)
        
        logger.info(f"Emitted final transcript completion for doc {doc_id}")
    except Exception as e:
        logger.error(f"Error emitting final transcript: {e}")

def emit_transcription_error(doc_id, error_message):
    """
    Emit transcription error event
    
    Args:
        doc_id: Document ID
        error_message: Error message
    """
    try:
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': error_message
        }, room=doc_id)
        
        logger.error(f"Emitted transcription error for doc {doc_id}: {error_message}")
    except Exception as e:
        logger.error(f"Error emitting transcription error: {e}")
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
