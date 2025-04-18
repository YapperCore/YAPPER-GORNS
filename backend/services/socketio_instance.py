# backend/services/socketio_instance.py
from flask_socketio import SocketIO, join_room, emit, disconnect
from services.storage import save_doc_store, doc_store
import logging

logger = logging.getLogger(__name__)

# Allow any origin for development or set specific origins for production
cors_allowed_origins = "*"  # For development
# For production you might want to restrict this:
# cors_allowed_origins = ["https://yourdomain.com"]

# Initialize with proper configuration
socketio = SocketIO(
    cors_allowed_origins=cors_allowed_origins, 
    async_mode='threading',
    ping_timeout=60,  # Increase ping timeout
    ping_interval=25,  # Optimize ping interval
    logger=True,      # Enable logging
    engineio_logger=True  # Enable more detailed engine logging
)

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected to socket")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected from socket")

@socketio.on('join_doc')
def handle_join_doc_evt(data):
    doc_id = data.get('doc_id')
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
            'segments': doc.get('segments', []),
            'status': doc.get('status', 'unknown'),
            'is_replicate': doc.get('is_replicate', False)
        }, room=doc_id)
    else:
        logger.warning(f"Doc {doc_id} not found or deleted")

@socketio.on('edit_doc')
def handle_edit_doc_evt(data):
    doc_id = data.get('doc_id')
    new_content = data.get('content')
    
    if not doc_id or new_content is None:
        logger.warning("Invalid edit_doc event data")
        return
        
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        doc['content'] = new_content
        save_doc_store()
        
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
        # Add status message for Replicate
        doc = doc_store.get(doc_id)
        is_replicate = False
        if doc and doc.get('transcription_config', {}).get('mode') == 'replicate':
            is_replicate = True

        # Emit immediately without batching for real-time updates
        socketio.emit('partial_transcript_batch', {
            'doc_id': doc_id,
            'chunks': chunks,
            'segments': segments or [],
            'progress': 100 if is_replicate else calculate_progress(chunks),
            'is_replicate': is_replicate
        }, room=doc_id)
        
        logger.debug(f"Emitted {len(chunks)} chunks for doc {doc_id}")
    except Exception as e:
        logger.error(f"Error emitting partial transcript: {e}")

def calculate_progress(chunks):
    """Calculate progress based on chunks"""
    if not chunks:
        return 0
    
    # Get the total number of chunks expected from the first chunk
    if len(chunks) > 0 and 'total_chunks' in chunks[0]:
        current_chunk = chunks[-1].get('chunk_index', 0)
        total_chunks = chunks[0].get('total_chunks', 1)
        
        if total_chunks > 0:
            return min(100, int((current_chunk / total_chunks) * 100))
    
    return 0

def emit_final_transcript(doc_id, content=None):
    """
    Emit final transcript completion event
    
    Args:
        doc_id: Document ID
        content: Optional final content
    """
    try:
        # Get the document content if not provided
        if content is None and doc_id in doc_store:
            content = doc_store[doc_id].get('content', '')
            
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True,
            'content': content
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
