import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const FileGrievance = () => {
  const [formData, setFormData] = useState({ description: '', location: '', contact_email: '', contact_phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState(null);
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

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
            headers: { 'Authorization': `Bearer ${token}` },
            body: data
          });
          if (!res.ok) throw new Error('Transcription failed');
          const result = await res.json();
          // Append the transcribed text to the existing description
          setFormData(prev => ({ 
            ...prev, 
            description: prev.description ? prev.description + ' ' + result.transcript : result.transcript 
          }));
        } catch (err) {
          setError('Voice transcription failed. Please try typing instead.');
        }
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.id]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.description || !formData.location) {
      setError('Please fill in all required fields (Description and Location).');
      return;
    }

    if (!formData.evidence_url) {
      setError('Please upload a photo of the evidence before submitting.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/grievances/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit grievance');
      }

      const data = await response.json();
      setSubmittedId(data.tracking_id);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submittedId) {
    return (
      <div className="max-w-2xl mx-auto text-center mt-12 space-y-6">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl">
          ✓
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Grievance Submitted!</h2>
        <p className="text-gray-600 text-lg">Your tracking ID is:</p>
        <div className="bg-surface-bg border-2 border-dashed border-gray-300 p-4 rounded-xl text-2xl font-mono font-bold text-primary-600 tracking-wider">
          {submittedId}
        </div>
        <p className="text-sm text-gray-500">Please save this ID to track your request status later.</p>
        <Button onClick={() => window.location.href='/track'} className="mt-4">
          Track Status Now
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">File a Grievance</h1>
          <p className="text-gray-600 mt-2">Describe your issue in detail. Our AI will automatically categorize and route it.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6 p-2">
          <div className="space-y-1.5 relative">
            <div className="flex justify-between items-center">
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700">Detailed Description</label>
              <button 
                type="button" 
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full transition-colors ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
              >
                {isRecording ? '⏹ Stop Recording' : '🎤 Dictate with Voice'}
              </button>
            </div>
            <textarea
              id="description"
              rows="4"
              value={formData.description}
              className="w-full px-4 py-3 rounded-xl border border-surface-border bg-surface-bg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none resize-none"
              placeholder="Please describe the problem you are facing... (or click the microphone to speak)"
              onChange={handleChange}
              required
            ></textarea>
          </div>
          
          <Input label="Location (Landmark, City, etc.)" id="location" placeholder="Where is this happening?" onChange={handleChange} required />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Contact Email (Optional)" id="contact_email" type="email" placeholder="For updates" onChange={handleChange} />
            <Input label="Contact Phone (Optional)" id="contact_phone" type="tel" placeholder="For updates" onChange={handleChange} />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Attach Evidence Photo</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                id="evidence" 
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  try {
                    setLoading(true);
                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/upload', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${token}`
                      },
                      body: formData
                    });
                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json();
                    setFormData(prev => ({ ...prev, evidence_url: data.url }));
                  } catch (err) {
                    setError('Failed to upload image. Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-colors"
              />
            </div>
            {formData.evidence_url && (
              <div className="mt-3 relative w-full h-48 rounded-xl overflow-hidden border border-surface-border">
                <img src={formData.evidence_url} alt="Evidence Preview" className="object-cover w-full h-full" />
              </div>
            )}
          </div>

          {error && <div className="text-status-urgent text-sm bg-red-50 p-3 rounded-md">{error}</div>}
          
          <Button type="submit" loading={loading} fullWidth className="mt-4">
            Submit Grievance
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default FileGrievance;
