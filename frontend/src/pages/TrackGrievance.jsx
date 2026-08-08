import React, { useState, useEffect } from 'react';
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

  const steps = ['Submitted', 'Reviewed', 'Assigned', 'In Progress', 'Resolved'];

  return (
    <div className="flex flex-col items-center py-12 px-4 gap-8">
      <Card className="w-full max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Track Grievance Status</h2>
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
          <div className="flex-1">
            <Input 
              label="Tracking ID" 
              placeholder="e.g. GRV-A1B2C3D4" 
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={loading} className="mb-0.5">Track</Button>
        </form>
        {error && <div className="mt-4 text-status-urgent text-sm">{error}</div>}
      </Card>

      {grievance && (
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card title="Status Timeline">
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
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card title="Grievance Details">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Current Status</p>
                  <StatusBadge status={grievance.status === 'Resolved' ? 'resolved' : 'progress'} />
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Tracking ID</p>
                  <p className="font-mono font-medium text-gray-900">{grievance.tracking_id}</p>
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
                  <p className="text-gray-900">{grievance.location || 'Not provided'}</p>
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
