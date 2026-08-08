import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';

const AdminDashboard = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  
  // Status Update Form State
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchGrievances = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/grievances/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch grievances');
      const data = await response.json();
      setGrievances(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/grievances/track/${selectedGrievance.tracking_id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, note, priority })
      });
      
      if (!response.ok) throw new Error('Update failed');
      
      // Refresh list and close modal
      await fetchGrievances();
      setSelectedGrievance(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const openUpdateModal = (g) => {
    setSelectedGrievance(g);
    setStatus(g.status);
    setPriority(g.priority);
    setNote('');
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage and resolve citizen grievances.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <th className="p-4 font-semibold text-sm">Tracking ID</th>
                <th className="p-4 font-semibold text-sm">Date</th>
                <th className="p-4 font-semibold text-sm">Description</th>
                <th className="p-4 font-semibold text-sm">Location</th>
                <th className="p-4 font-semibold text-sm">Status</th>
                <th className="p-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grievances.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-sm text-gray-600">{g.tracking_id}</td>
                  <td className="p-4 text-sm text-gray-600">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-sm text-gray-900 max-w-xs truncate">{g.description}</td>
                  <td className="p-4 text-sm text-gray-600 truncate max-w-[150px]">{g.location}</td>
                  <td className="p-4"><StatusBadge status={g.status} /></td>
                  <td className="p-4">
                    <Button variant="outline" size="sm" onClick={() => openUpdateModal(g)}>Review</Button>
                  </td>
                </tr>
              ))}
              {grievances.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">No grievances found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Review Grievance: {selectedGrievance.tracking_id}</h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4 bg-primary-50 p-4 rounded-xl border border-primary-100 mb-4">
                <div>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider mb-1">AI Category</p>
                  <p className="font-semibold text-gray-900">{selectedGrievance.category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider mb-1">Assigned Dept</p>
                  <p className="font-semibold text-gray-900">{selectedGrievance.department}</p>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider mb-1">AI Priority</p>
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    selectedGrievance.priority === 'Urgent' || selectedGrievance.priority === 'High' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedGrievance.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-primary-600 font-bold uppercase tracking-wider mb-1">Citizen Sentiment</p>
                  <p className="font-semibold text-gray-900">{selectedGrievance.sentiment}</p>
                </div>
              </div>

              {selectedGrievance.duplicate_of && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex gap-3 items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-bold">Duplicate Detected</p>
                    <p className="text-sm">The AI has flagged this as a potential duplicate of <span className="font-mono font-bold">{selectedGrievance.duplicate_of}</span>.</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Description</p>
                <p className="text-gray-900">{selectedGrievance.description}</p>
              </div>

              {selectedGrievance.citizen_details && (
                <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="text-sm text-gray-500 font-semibold uppercase mb-3">Citizen Profile (Auto-Linked)</p>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Name</p>
                        <p className="font-semibold text-gray-900">{selectedGrievance.citizen_details.full_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Phone</p>
                        <p className="font-semibold text-gray-900">{selectedGrievance.citizen_details.phone || 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Email</p>
                      <p className="font-semibold text-primary-600 break-all">{selectedGrievance.citizen_details.email}</p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 font-semibold uppercase">Location</p>
                <p className="text-gray-900">{selectedGrievance.location}</p>
              </div>
              {selectedGrievance.evidence_url && (
                <div>
                  <p className="text-sm text-gray-500 font-semibold uppercase mb-2">Evidence Photo</p>
                  <img src={selectedGrievance.evidence_url} alt="Evidence" className="rounded-xl max-h-64 object-cover" />
                </div>
              )}
            </div>

            <hr className="my-6 border-gray-200" />

            <form onSubmit={handleUpdate} className="space-y-4">
              <h3 className="text-lg font-bold">Update Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">New Status</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white"
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Priority</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white"
                  >
                    <option value="Unassigned">Unassigned</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Resolution Note</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300"
                  rows="3"
                  placeholder="Explain the update to the citizen..."
                  required
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" type="button" onClick={() => setSelectedGrievance(null)}>Cancel</Button>
                <Button type="submit" loading={updating}>Save Update</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
