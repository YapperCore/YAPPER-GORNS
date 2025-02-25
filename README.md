## Yapper
> Outline a brief description of your project.

> Live demo [_here_](https://www.example.com). <!-- If you have the project hosted somewhere, include the link here. -->

## Table of Contents
* [General Info](#general-information)
* [Project Yapper - Overview](#project-yapper---overview)
* [Technologies Used](#technologies-used)
* [Features](#features)
* [Future Features](#future-features)
* [Screenshots](#screenshots)
* [Setup](#setup)
* [Usage](#usage)
* [Additional Implementation Details](#additional-implementation-details)
  * [Chunked Audio Transcription Flow](#chunked-audio-transcription-flow)
  * [Real-Time Collaboration](#real-time-collaboration)
  * [Trash--Restore Logic](#trash--restore-logic)
  * [Storing and Loading Documents](#storing-and-loading-documents)
* [Project Status](#project-status)
* [Room for Improvement](#room-for-improvement)
* [Acknowledgements](#acknowledgements)
* [Contact](#contact)
<!-- * [License](#license) -->


## General Information
- Provide general information about your project here.
- What problem does it (intend to) solve?
- What is the purpose of your project?
- Why did you undertake it?

---

# Project Yapper - Overview

**Project YAPPER**, developed by **Ali Jalil, Joshua Egwaikhide, Abheek Pradhan, and Michael Elder**, is an innovative audio translation/transcription tool designed to convert spoken audio into text — and optionally into multiple languages if you expand the translation features. It addresses the challenges posed by language differences in our increasingly interconnected world, making cross-cultural communication accessible and accurate.

## Technologies Used
- **Electron 34.0.2** (optional if you're using an Electron wrapper)
- **Python 3.10**
- **Flask** & **Flask-SocketIO** (for the backend)
- **React 18** (for the frontend)
- **AWS or Azure** (optional cloud integration)
- **Speech2TextProcessor** (transformers) & **torchaudio** for chunked audio transcription

---

## Features

1. **Upload a File**  
   Users can upload an audio file to be transcribed.  
   - **User Story**: “As a user, I want to upload an audio file so that I can generate a transcription.”

2. **Play Audio File** *(optional or future)*  
   Users can play the uploaded audio file directly in the UI.

3. **View and Edit Transcription Text**  
   The transcribed text is displayed in a text editor. Users can correct errors or refine the text.

4. **Soft-Delete (Trash)**  
   Instead of permanently deleting an audio file, it’s moved to a *trash folder*, allowing you to restore it later if needed.

5. **Document Management**  
   Each uploaded file auto-creates a “doc” with references to that file. We can also create docs manually, or list, edit, and delete them.

6. **Real-Time Collaboration**  
   Multiple users can join the same doc (via Socket.IO rooms) and see content updates live.

---

## Future Features

1. **Split Audio into Sections**  
   Potential feature to segment audio into smaller playable chunks.

2. **Share Notes**  
   A feature to share documents/transcriptions with others more easily.

3. **Group Notes**  
   Categorize notes for better organization (tagging, labeling, etc.).

---

## Screenshots
![Logo](Yapperlogoimg.png)

*(If you have screenshots of your UI, add them here.)*

---

## Setup

1. **Backend**:
   - **Install** Python packages:
     ```bash
     pip install flask flask-socketio eventlet transformers torchaudio
     ```
   - **Run** the server:
     ```bash
     cd backend
     python3 app.py
     ```
     or
     ```bash
     python -m app
     ```
     Both are valid. `python3 app.py` directly executes `app.py`, while `python -m app` uses the module approach.

2. **Frontend**:
   - **Install** Node dependencies:
     ```bash
     cd ../frontend
     npm install
     ```
   - **Start** the React dev server:
     ```bash
     npm start
     ```
   - Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Home Page**:
   - You can upload an audio file via the “Submit” button.  
   - It automatically creates a new doc in memory, spawns chunked transcription, and displays partial transcripts.  
   - The doc references the audio file, so if you later delete the file (move to trash), the doc is flagged accordingly (`audioTrashed=true`).

2. **Docs**:
   - A doc is basically a text record. You can list them (at `/docs`) or edit them (at `/docs/edit/:docId`).
   - Each doc can also be loaded in “Transcription Editor,” which merges partial transcripts in real time.

3. **Trash**:
   - “Delete” an audio file => moves it from `uploads/` to `trash/`.  
   - Any doc referencing that file has `audioTrashed: true`.
   - You can see the trash listing at `/trash` or via API (`/trash-files`).  
   - Restoration moves the file back and sets `audioTrashed: false`.

---

## Additional Implementation Details

### Chunked Audio Transcription Flow
1. **Upload**: `/upload-audio` saves the file in `uploads/` and creates a doc record with `audioFilename` plus `audioTrashed=false`.  
2. **Background** transcription uses a **5-second** chunk approach, sending partial transcripts via `partial_transcript_batch`.  
3. The server also appends chunk text (with a space) to the doc’s `content`.  
4. When done, the server emits `final_transcript` for that doc.

### Real-Time Collaboration
1. The frontend uses Socket.IO: `socket.emit("join_doc", { doc_id })` to join that doc’s “room.”  
2. Whenever the user changes text, we do `socket.emit("edit_doc", { doc_id, content })`.  
3. The server updates `doc_store[doc_id].content` and emits `doc_content_update` to all clients in that room.

### Trash--Restore Logic
1. **Delete** => `DELETE /delete_file/<filename>`  
   - Moves `<filename>` from `uploads/` to `trash/`.  
   - Finds any doc referencing that file => sets `audioTrashed=true`.  
2. **Restore** => `GET /restore_file/<filename>`  
   - Moves `<filename>` from `trash/` to `uploads/`.  
   - Marks doc referencing that file as `audioTrashed=false`.

### Storing and Loading Documents
- **In-memory store** plus a `doc_store.json` file for persistence:
  - On startup, the server loads existing docs + doc_counter from `doc_store.json`.  
  - On each doc modification (or transcription chunk appended), the server writes back to `doc_store.json`.  

---

## Project Status
- Active / In progress, with core chunked transcription, doc editing, trash, and restore features done.

## Room for Improvement
- Expand the robust translation step.  
- Add support for playing only partial sections of audio.  
- Improve UI (drag-and-drop uploads, better doc listing).  

## Acknowledgements
- Thanks to the team: **Ali Jalil, Joshua Egwaikhide, Abheek Pradhan, Michael Elder**.  
- Big thanks to open-source libraries: Flask-SocketIO, React, Transformers, etc.

## Contact
Created by the Yapper team.

<!--
## License
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 (or later).
See <https://www.gnu.org/licenses/>.
-->

