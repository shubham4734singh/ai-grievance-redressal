import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './Chatbot.css';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Grievance Assistant. Would you like some help filing a complaint today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [awaitingLocationConsent, setAwaitingLocationConsent] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isAffirmative = (value) => {
    const normalized = value.trim().toLowerCase();
    return /(^|\s)(yes|yeah|yep|sure|ok|okay|haan|hanji|ji|हां|हाँ|हो|होय)(\s|$|[.!?])/i.test(normalized);
  };

  const isNegative = (value) => {
    const normalized = value.trim().toLowerCase();
    return /(^|\s)(no|nope|nah|nahi|nahin|नहीं|नही|नको)(\s|$|[.!?])/i.test(normalized);
  };

  const isSameLocationQuestion = (value) => (
    /same location/i.test(value) ||
    /currently at/i.test(value) ||
    /problem location/i.test(value)
  );

  const getCurrentLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      () => reject(new Error('Location permission was denied or unavailable.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  const sendChatRequest = async (conversation, currentLocation = null, evidenceOverride = evidenceUrl) => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        messages: conversation,
        current_location: currentLocation,
        evidence_url: evidenceOverride || null
      })
    });

    if (response.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!response.ok) throw new Error('Failed to get response');
    return response.json();
  };

  const addAssistantReply = (baseMessages, data) => {
    const assistantMessage = { role: 'assistant', content: data.reply };
    setAwaitingLocationConsent(Boolean(data.expects_location_permission) || isSameLocationQuestion(data.reply));
    setMessages([...baseMessages, assistantMessage]);
  };

  const buildGpsMessage = (currentLocation) => ({
    role: 'user',
    content: `Browser GPS location captured: latitude ${currentLocation.latitude}, longitude ${currentLocation.longitude}, accuracy ${Math.round(currentLocation.accuracy)} meters. Use this as the exact problem location.`
  });

  const requestBrowserLocation = async () => {
    const userMessage = { role: 'user', content: 'Use my current browser location.' };
    const visibleMessages = [...messages, userMessage];
    setMessages(visibleMessages);
    setLoading(true);

    try {
      const currentLocation = await getCurrentLocation();
      const messagesForServer = [...visibleMessages, buildGpsMessage(currentLocation)];
      const data = await sendChatRequest(messagesForServer, currentLocation);
      addAssistantReply(visibleMessages, data);
    } catch (error) {
      setAwaitingLocationConsent(false);
      setMessages([
        ...visibleMessages,
        {
          role: 'assistant',
          content: "I couldn't access your current location. Please type the problem location with the nearest landmark, street, or city."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chooseManualLocation = () => {
    const userMessage = { role: 'user', content: 'I will enter the location manually.' };
    setAwaitingLocationConsent(false);
    setMessages([
      ...messages,
      userMessage,
      {
        role: 'assistant',
        content: 'Please type the exact problem location with the nearest landmark, street, or city.'
      }
    ]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const data = new FormData();
        data.append('file', audioBlob, 'recording.webm');
        
        try {
          const token = localStorage.getItem('token');
      const res = await fetch('/api/upload/audio', {
            method: 'POST',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' },
            body: data
          });
          if (res.status === 401) throw new Error('AUTH_REQUIRED');
          if (!res.ok) throw new Error('Transcription failed');
          const result = await res.json();
          setInput(prev => prev ? prev + ' ' + result.transcript : result.transcript);
        } catch (err) {
          alert(err.message === 'AUTH_REQUIRED' ? 'Please sign in again before using voice input.' : 'Voice transcription failed. Please try typing instead.');
        }
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available.");
    }
  };

  const handleEvidenceUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please attach an image file.');
      event.target.value = '';
      return;
    }

    const data = new FormData();
    data.append('file', file);
    setUploadingEvidence(true);
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: data
      });
      if (res.status === 401) throw new Error('AUTH_REQUIRED');
      if (!res.ok) throw new Error('Upload failed');

      const result = await res.json();
      setEvidenceUrl(result.url);
      setEvidenceName(file.name);
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: 'Attached an evidence image.'
        }
      ]);
    } catch (err) {
      setUploadError(err.message === 'AUTH_REQUIRED' ? 'Please sign in again before attaching an image.' : 'Image upload failed. Please try again.');
    } finally {
      setUploadingEvidence(false);
      event.target.value = '';
    }
  };

  const removeEvidence = () => {
    setEvidenceUrl('');
    setEvidenceName('');
    setUploadError('');
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    const openAssistant = () => setIsOpen(true);
    window.addEventListener('open-help-assistant', openAssistant);
    return () => window.removeEventListener('open-help-assistant', openAssistant);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      let currentLocation = null;
      let messagesForServer = newMessages;

      if (awaitingLocationConsent && isAffirmative(input)) {
        currentLocation = await getCurrentLocation();
        messagesForServer = [...newMessages, buildGpsMessage(currentLocation)];
      } else if (awaitingLocationConsent && isNegative(input)) {
        setAwaitingLocationConsent(false);
      }

      const data = await sendChatRequest(messagesForServer, currentLocation);
      addAssistantReply(newMessages, data);
    } catch (error) {
      const reply = error.message === 'AUTH_REQUIRED'
        ? 'Please sign in to use the grievance assistant. If you are already signed in, your session may have expired, so sign out and sign in again.'
        : awaitingLocationConsent && isAffirmative(input)
        ? "I couldn't access your current location. Please type the problem location with the nearest landmark or street."
        : "I'm having trouble connecting to the server right now. Please try again later.";
      setAwaitingLocationConsent(false);
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open help assistant"
        className={`fixed bottom-5 right-5 md:bottom-6 md:right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-[0_8px_24px_rgba(23,61,112,.35)] hover:bg-primary-700 hover:scale-105 transition-all flex items-center justify-center z-40 ${isOpen ? 'hidden' : 'block'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-3 md:inset-x-auto md:bottom-6 md:right-6 w-auto md:w-96 h-[min(32rem,calc(100vh-1.5rem))] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary-600 font-bold text-xl">
                AI
              </div>
              <div>
                <h3 className="font-bold">Grievance Assistant</h3>
                <p className="text-xs text-primary-100">Here to guide you, simply</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl prose prose-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-sm shadow-sm flex gap-2">
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            {awaitingLocationConsent && !loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm p-3">
                  <p className="text-sm text-gray-700 mb-3">Share your exact location from this browser, or enter it manually.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={requestBrowserLocation}
                      className="px-3 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
                    >
                      Use current location
                    </button>
                    <button
                      type="button"
                      onClick={chooseManualLocation}
                      className="px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Enter manually
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200">
            {(evidenceUrl || uploadingEvidence || uploadError) && (
              <div className="px-4 pt-3">
                {evidenceUrl && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2">
                    <img src={evidenceUrl} alt="Evidence preview" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{evidenceName || 'Evidence image'}</p>
                      <p className="text-xs text-gray-500">Attached to this complaint</p>
                    </div>
                    <button type="button" onClick={removeEvidence} className="px-2 py-1 text-xs font-semibold text-gray-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                )}
                {uploadingEvidence && <p className="text-xs font-semibold text-primary-600">Uploading image...</p>}
                {uploadError && <p className="text-xs font-semibold text-red-600">{uploadError}</p>}
              </div>
            )}
            <form onSubmit={handleSend} className="p-4 flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEvidenceUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingEvidence || loading}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                title="Attach Evidence Photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a3 3 0 016 0v7a5 5 0 11-10 0V6a1 1 0 112 0v5a3 3 0 106 0V4a1 1 0 10-2 0v7a1 1 0 11-2 0V4z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                title={isRecording ? 'Stop Recording' : 'Start Dictation'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isRecording ? "Listening..." : "Type your message..."}
                className="min-w-0 flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isRecording}
              />
              <button
                type="submit"
                disabled={loading || uploadingEvidence || !input.trim() || isRecording}
                className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 -ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
