# Workbench user guide

Start the application using the [setup instructions](../README.md#run-locally). Choose a role and interface language. Demo and personal workspaces are separate; use the same browser and address throughout a local demonstration.

## Teacher workflow

1. Open **Teaching overview** and create a course. In **Courses & materials**, select a course to edit its details or delete it.
2. Select **Lecture materials**, enter a title and teaching week, optionally add a topic, and choose a file. Upload PDF, PPTX, DOCX, TXT or Markdown up to 25 MB.
3. Choose **Save source draft**, **AI draft guide** or **AI generate questions**. Guidance and questions can be requested independently. Generation runs in a page-level queue; continue uploading or navigating while it runs. Closing or refreshing the page can interrupt pending tasks.
4. Open **Review & edit** to correct explanations and questions. Check the original sources and use **Student preview**. Questions can also be added to an existing guide later.
5. Choose **Publish to students** when ready. A source-only resource can be published before a guide is ready. Edited or regenerated resources return to draft and need publication again. **Unpublish** withdraws a resource.
6. To set coursework, switch to the **Coursework** tab, upload the brief and generate an introduction and proposed dates. Verify the source and confirm release and deadline fields before publication. Dates are entered in UTC; convert BST if applicable. Detailed marking-criteria analysis and personal steps are handled in the student workspace. Review, edit, regenerate and withdraw coursework from its list.
7. Open **Course discussions** to answer questions. Unanswered-question reminders lead to the relevant course. **Student feedback** shows available viewing and practice records, not verified learning or a real class attendance register.

Teacher generation uses a separately configured teaching ELM connection; see [API setup](../server/README.md). Invalid or incomplete generation does not become approved content automatically.

## Student planning and study

1. In **Semester overview**, compare elapsed semester time with coursework bars and deadlines. Use course filters and **Add personal plan** to organise course-related or other activities. Time elapsed and task completion are different measures.
2. Open **Weekly tasks** and switch weeks to see upcoming steps by course. Check the notification bell for in-app reminders. Closing the application does not provide background push notifications.
3. In **My courses**, choose a course and expand a week. **Learning** and **Coursework** are neighbouring tabs. Optional weekly topics depend on the teacher’s settings.
4. Open a published material to enter the full reading workspace. Scroll PDF pages, inspect current-page information and adjust the reader and conversation panel widths. Use private notes, guidance and source-page links to check explanations.
5. In **Practice**, choose an answer, check it and inspect its explanation and source. Published practice does not require a personal AI key. Completion is an activity record, not certification of mastery.
6. Open a coursework brief to inspect the teacher’s requirements. Generate a personal plan, analyse submission requirements and marking criteria, or ask a brief-grounded question. Mark your steps as completed. A manual “submitted in the university system” marker does not submit files or replace the official assessment portal.

## Ask about a document

Open **My AI API**, select ELM or DeepSeek and enter your own key and a model available to your account. Selecting a provider does not verify your credentials; refresh clears the key. Student requests do not fall back to the teacher’s credentials.

Ask a specific question in the selected document’s question panel, then inspect the returned source references. “Explain this page” uses the current page context. Retrieval is limited to the selected material; unsupported questions may return insufficient evidence. With **Search source only**, the application returns excerpts rather than new model explanations.

The chosen provider receives the relevant text and question for the requested operation. Model usage may incur charges. Image-only documents, diagrams and equation images may not be represented adequately by text extraction; verify them in the original file.

## Record and review a lecture

1. Start the [local speech service](LOCAL_SPEECH_SETUP.md) if live recognition is needed. Connect your personal model API if translation or explanation is needed.
2. Open a course or lecture, select **Class recording** and confirm the course. Desktop recording defaults to shared audio: in the browser prompt, choose the video tab and enable audio sharing. For a live lecture, choose microphone input instead.
3. Allow the requested capture permissions. The shared display track is not saved as video; the application uses its audio track. Support for whole-system audio varies, so a Chrome or Edge video tab is preferable when screen audio is unavailable.
4. Read and edit the transcript while recording. New confirmed recognition text is appended rather than replacing corrections. The installed `small.en` configuration recognises English.
5. Enable translation and choose an output language. Correct the translated text as needed. A model error can pause translation while recording and local recognition continue.
6. End and save the recording. Replay, seek, download audio or export text. Check the edited translation, then generate an explanation from it. Changes to the text can require regenerating the explanation.
7. Minimise the recording panel or move between pages without intentionally stopping the session. The recording remains associated with its starting course; slide changes do not automatically align the transcript. Long recordings, background mobile operation and crash recovery require further validation.

Follow the lecturer’s and institution’s recording rules. Recordings and notes are local personal records, not published class resources.

## Find a study partner and ask a teacher

In **Peer learning**, enter the courses you can help with or want to study, your language and availability. Save your profile, inspect compatible matches and send an invitation. An accepted invitation enables conversation. You do not need to select a specific knowledge point. You can pause matching when unavailable.

Demo identities are fictional. Local browser identities are not verified university accounts, and a match does not certify teaching competence. For teacher help, post your question in the relevant **Course discussion** and revisit it for replies.

## Troubleshooting

- **No materials:** check the course, demo/personal workspace and publication state. Uploading or saving a draft does not publish it.
- **AI request fails:** check the provider, key, model access and allowance. Retrying does not require discarding the source document. Use source-only search meanwhile.
- **No extracted text:** use a text-bearing original if available; scanned pages are not automatically OCR-processed.
- **Speech unavailable:** verify the local service, model readiness, port 8000 and browser audio permission. Audio-only recording remains available when recognition is disabled.
- **Missing records after changing browser:** local storage belongs to that browser and origin. The prototype does not supply institutional cross-device synchronisation.

[中文使用说明](学生教师双视角说明.md) · [Back to project](../README.md)
