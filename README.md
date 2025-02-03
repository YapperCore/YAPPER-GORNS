## Yapper
> Outline a brief description of your project.
> Live demo [_here_](https://www.example.com). <!-- If you have the project hosted somewhere, include the link here. -->

## Table of Contents
* [General Info](#general-information)
* [Technologies Used](#technologies-used)
* [Features](#features)
* [Screenshots](#screenshots)
* [Setup](#setup)
* [Usage](#usage)
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
<!-- You don't have to answer all the questions - just the ones relevant to your project. -->


---

# Project YAPPER

**Project YAPPER**, developed by **Ali Jalil, Joshua Egwaikhide, Abheek Pradhan, and Michael Elder**, is an innovative audio translation tool designed to bridge language barriers by translating spoken language audio recordings into text and subsequently into multiple languages. This solution addresses the challenges posed by language differences in our increasingly interconnected world, making cross-cultural communication more accessible, efficient, and accurate.

## Technical Architecture

### Client-Side (React Website)
- **User Interface:**  
  The front end of Project YAPPER is built using React, ensuring a dynamic, responsive, and user-friendly experience. Users can easily record or upload audio files, with real-time updates that keep them informed about the transcription process.
- **Real-Time Interaction:**  
  Utilizing React’s component-based architecture, the application offers immediate feedback and an engaging experience, which is especially beneficial for users needing quick and reliable translations.
- **Accessibility:**  
  The intuitive design makes the tool accessible to a wide range of users, including those who may not be tech-savvy, thereby broadening its impact.

### Server-Side (Cloud Services)
- **Cloud Integration:**  
  The backend leverages robust cloud services from providers like Amazon Web Services (AWS) or Microsoft Azure. This integration ensures high scalability, security, and performance—critical for processing and storing large volumes of audio data.
- **Speech-to-Text Processing:**  
  Advanced speech recognition algorithms hosted on the cloud convert spoken audio into text. These models are optimized to handle various accents and dialects, ensuring high accuracy in transcription.
- **Translation Capabilities:**  
  After converting speech to text, integrated translation APIs transform the transcription into the desired target language. This two-step process—speech-to-text followed by text translation—enables the application to effectively support multiple languages.
- **Scalability and Performance:**  
  Leveraging cloud services guarantees that Project YAPPER can dynamically scale to handle peak usage times without compromising performance, ensuring a reliable service for users worldwide.

## Purpose and Impact

The primary objective of Project YAPPER is to eliminate communication barriers by providing an efficient and accurate translation solution. By combining state-of-the-art speech recognition with robust cloud-based translation services, the project facilitates smoother cross-cultural interactions in both personal and professional contexts. This innovative approach supports the growing need for accessible language translation in our diverse global society.

## Why We Undertook This Project

Recognizing the challenges posed by language barriers in our increasingly interconnected world, our team—**Ali Jalil, Joshua Egwaikhide, Abheek Pradhan, and Michael Elder**—embarked on the development of Project YAPPER. Leveraging the latest advancements in cloud technology and machine learning, we aimed to create a tool that not only transcribes audio with high precision but also translates it in real time, thereby enhancing communication across different languages and cultures.

---



## Technologies Used
- Electron 34.0.2
- Python 3.10
- React 18.
- AWS or Azure


#### 1. File Uploader
- **Description:**  
  Enables users to upload an audio file into the application. The selected file is then sent to the backend for transcription processing.
- **Who Uses It:**  
  End users who need to convert their recorded audio into text.
- **User Stories:**
  - **User Story 1:**  
    *As a user, I want to upload an audio file so that it can be transcribed, allowing me to obtain a textual version of my recording.*
  - **User Story 2:**  
    *As a user, I want to receive confirmation that my audio file has been successfully uploaded so that I know the transcription process has started.*

#### 2. Audio Playback
- **Description:**  
  Provides a built-in audio player that allows users to play, pause, and navigate through the uploaded audio file. This helps users review the audio content before or after transcription.
- **Who Uses It:**  
  End users who wish to verify the audio content and ensure the transcription accurately reflects the recording.
- **User Stories:**
  - **User Story 1:**  
    *As a user, I want to play the audio file within the application so that I can verify its content before transcription.*
  - **User Story 2:**  
    *As a user, I want to pause and navigate through the audio so that I can easily review specific segments of the recording.*

#### 3. Transcription Viewer
- **Description:**  
  Displays the transcribed text generated from the uploaded audio file in a clear and readable format. The text may update in real time as the transcription process continues.
- **Who Uses It:**  
  End users who need to read, reference, or edit the transcribed text.
- **User Stories:**
  - **User Story 1:**  
    *As a user, I want to view the transcription of my audio file so that I can read and understand its contents.*
  - **User Story 2:**  
    *As a user, I want the transcription to update in real time as the audio is being processed so that I can track its progress.*

---

### Future Features (Planned for Subsequent Sprints)

#### 1. Sectioned Notes
- **Description:**  
  Automatically splits the transcribed text into distinct sections or notes, making it easier to navigate and manage large volumes of text.
- **Who Uses It:**  
  Users who need to organize lengthy transcriptions into manageable segments.
- **User Story:**  
  *As a user, I want the transcription to be divided into distinct sections so that I can easily find and reference different parts of the content.*

#### 2. Note Sharing
- **Description:**  
  Allows users to share individual notes or entire transcriptions with others via social media, email, or built-in sharing functionalities.
- **Who Uses It:**  
  Users who need to collaborate or distribute the transcription results with colleagues, friends, or other stakeholders.
- **User Story:**  
  *As a user, I want to share my transcribed notes with others so that I can collaborate effectively or disseminate important information.*

#### 3. Note Grouping
- **Description:**  
  Enables users to group related notes together for better organization and quicker access, which is especially useful for managing multiple transcriptions.
- **Who Uses It:**  
  Users who handle a large amount of transcribed data and need a method to categorize and organize it logically.
- **User Story:**  
  *As a user, I want to group related notes together so that I can organize my transcriptions in a more meaningful and efficient way.*


## Screenshots
![Logo](Yapperlogoimg.png)

<!-- If you have screenshots you'd like to share, include them here. -->



<!-- Optional -->
<!-- ## License -->
<!-- This project is open source and available under the [... License](). -->
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

<!-- You don't have to include all sections - just the one's relevant to your project -->