import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Hash, MapPin, Search, Sparkles, Star } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Stepper } from '../components/ui/Stepper';
import { StatusBadge } from '../components/ui/StatusBadge';

const TrackGrievance = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '';
  
  const [trackingId, setTrackingId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [grievance, setGrievance] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const fetchGrievance = async (idToFetch) => {
    if (!idToFetch) return;
    
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/grievances/track/${idToFetch}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Grievance not found. Please check your tracking ID.');
      }
      const data = await response.json();
      setGrievance(data);
      setSearchParams({ id: idToFetch });
    } catch (err) {
      setError(err.message);
      setGrievance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId && !grievance) {
      fetchGrievance(initialId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchGrievance(trackingId);
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!grievance) return;

    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/grievances/track/${grievance.tracking_id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to submit feedback.');
      setGrievance(data);
      setFeedbackComment('');
    } catch (err) {
      setFeedbackError(err.message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const steps = ['Submitted', 'Reviewed', 'Assigned', 'In Progress', 'Resolved'];

  return (
    <div className="max-w-6xl mx-auto py-9 md:py-12 px-5">
      <div className="text-center max-w-2xl mx-auto"><div className="inline-flex p-3 rounded-xl bg-primary-50 text-primary-600"><ClipboardCheck className="w-7 h-7"/></div><p className="mt-4 text-sm font-bold tracking-wide uppercase text-primary-600">Track your request</p><h1 className="mt-1 text-3xl font-bold text-slate-900">See what’s happening with your grievance</h1><p className="mt-3 text-slate-600">Enter the tracking ID you received after submitting your request.</p></div>
      <Card className="w-full max-w-2xl mx-auto mt-8 shadow-[0_10px_28px_rgba(15,42,75,.06)]">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Input 
              label="Tracking ID" 
              placeholder="e.g. GRV-A1B2C3D4" 
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={loading} iconLeft={<Search className="w-4 h-4"/>}>Check status</Button>
        </form>
        {error && <div className="mt-4 text-status-urgent text-sm bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>}
      </Card>

      {grievance && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card><div className="flex justify-between items-start gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-primary-600">Current progress</p><h2 className="text-xl font-bold text-slate-900 mt-1">Status timeline</h2></div><StatusBadge status={grievance.status === 'Resolved' ? 'resolved' : 'progress'} /></div>
              <div className="py-4">
                <Stepper steps={steps} currentStep={grievance.status} />
              </div>
              
              <div className="mt-8 space-y-4">
                <h4 className="font-semibold text-gray-900">Activity History</h4>
                {grievance.history.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-1 text-sm border-l-2 border-surface-border pl-4 py-1">
                    <span className="font-semibold text-gray-900">{entry.status}</span>
                    <span className="text-gray-600">{entry.note}</span>
                    <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card><div className="rounded-xl border border-[#d6e5f0] bg-[#f4f9fd] p-5 flex gap-3"><Sparkles className="shrink-0 w-5 h-5 text-primary-500"/><p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Need help understanding an update?</span> Use the help button in the bottom right to ask in simple language.</p></div>
            {grievance.status === 'Resolved' && (
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-primary-600">Citizen feedback</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">How was the resolution?</h2>
                  </div>
                  {grievance.feedback_rating && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">Submitted</span>}
                </div>
                {grievance.feedback_rating ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center gap-1 text-emerald-700">
                      {Array.from({ length: grievance.feedback_rating }).map((_, index) => <Star key={index} className="h-5 w-5 fill-current" />)}
                    </div>
                    {grievance.feedback_comment && <p className="mt-3 text-sm text-slate-700">{grievance.feedback_comment}</p>}
                    <p className="mt-2 text-xs text-slate-500">Thanks. Your feedback helps improve service quality.</p>
                  </div>
                ) : (
                  <form onSubmit={submitFeedback} className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-700">Rating</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setFeedbackRating(rating)}
                            className={`grid h-10 w-10 place-items-center rounded-full border ${feedbackRating >= rating ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 bg-white text-slate-300'}`}
                            aria-label={`${rating} star rating`}
                          >
                            <Star className={`h-5 w-5 ${feedbackRating >= rating ? 'fill-current' : ''}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                      <span>Comment</span>
                      <textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} rows="3" placeholder="Tell us what went well or what could improve..." className="rounded-lg border border-slate-300 p-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
                    </label>
                    {feedbackError && <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{feedbackError}</div>}
                    <Button type="submit" loading={feedbackLoading}>Submit feedback</Button>
                  </form>
                )}
              </Card>
            )}
          </div>
          
          <div className="space-y-6">
            <Card><h2 className="font-bold text-slate-900">Request details</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Current Status</p>
                  <StatusBadge status={grievance.status === 'Resolved' ? 'resolved' : 'progress'} />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Tracking ID</p>
                  <p className="font-mono font-medium text-gray-900 flex gap-2"><Hash className="w-4 h-4 text-primary-500"/>{grievance.tracking_id}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Submitted On</p>
                  <p className="text-gray-900">{new Date(grievance.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Category</p>
                  <p className="text-gray-900">{grievance.category || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Location</p>
                  <p className="text-gray-900 flex gap-2"><MapPin className="w-4 h-4 shrink-0 text-primary-500"/>{grievance.location || 'Not provided'}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackGrievance;
