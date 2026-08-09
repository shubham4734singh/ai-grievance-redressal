import React, { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, ClipboardList, Clock3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';

const ManageStaff = () => {
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', department: 'Water' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create staff account');
      
      setSuccess(`Successfully created Admin account for ${data.full_name} (${data.department})`);
      setFormData({ full_name: '', email: '', password: '', department: 'Water' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-6">Create New Department Admin</h2>
        
        {success && <div className="p-4 mb-6 bg-green-50 text-green-700 rounded-xl border border-green-200 font-bold">{success}</div>}
        {error && <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-xl border border-red-200 font-bold">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input type="text" required value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Temporary Password</label>
              <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Department Scope</label>
              <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-2 border rounded-xl bg-white">
                <option value="Water">Water Department</option>
                <option value="Electricity">Electricity Board</option>
                <option value="Roads">Roads & Transport</option>
                <option value="Sanitation">Sanitation & Waste</option>
                <option value="Police">Police & Security</option>
              </select>
            </div>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-4">Create Admin Account</Button>
        </form>
      </div>
    </Card>
  );
};

const AdminDashboard = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentName = user.department === 'All' ? 'Central' : user.department || 'Central';

  // Status Update Form State
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState('');
  const [updating, setUpdating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

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

  const [activeTab, setActiveTab] = useState('grievances');

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const shown = grievances.filter(g => (filter === 'All' || g.status === filter) && `${g.tracking_id} ${g.description} ${g.location}`.toLowerCase().includes(query.toLowerCase()));
  const stats = [{ label:'Open cases', value: grievances.filter(g=>g.status !== 'Resolved').length, icon:ClipboardList, tone:'text-primary-600 bg-primary-50' }, { label:'In progress', value: grievances.filter(g=>g.status === 'In Progress').length, icon:Clock3, tone:'text-amber-700 bg-amber-50' }, { label:'Resolved', value: grievances.filter(g=>g.status === 'Resolved').length, icon:CheckCircle2, tone:'text-green-700 bg-green-50' }, { label:'High priority', value: grievances.filter(g=>['High','Urgent'].includes(g.priority)).length, icon:AlertTriangle, tone:'text-red-700 bg-red-50' }];
  return (
    <div className="max-w-7xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{departmentName} Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage and resolve citizen grievances efficiently.</p>
        </div>
      </div>

      {user.department === 'All' && (
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button 
            className={`py-2 px-4 font-bold ${activeTab === 'grievances' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('grievances')}
          >
            Grievances
          </button>
          <button 
            className={`py-2 px-4 font-bold ${activeTab === 'staff' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('staff')}
          >
            Manage Staff
          </button>
        </div>
      )}

      {activeTab === 'staff' ? (
        <ManageStaff />
      ) : (
      <>

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
              {shown.map(g => (
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
              {shown.length === 0 && (
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

              {selectedGrievance.citizen_details ? (
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
              ) : selectedGrievance.contact_phone ? (
                <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-700 font-semibold uppercase mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.539.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.216-3.05 5.546-5.02c.241-.213-.054-.334-.373-.121l-6.852 4.31-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.941z"/></svg>
                    Telegram Guest Profile
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">Name</p>
                      <p className="font-semibold text-gray-900">{selectedGrievance.contact_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase font-bold tracking-wider mb-1">Phone</p>
                      <p className="font-semibold text-gray-900">{selectedGrievance.contact_phone}</p>
                    </div>
                  </div>
                </div>
              ) : null}
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
      </>
      )}
    </div>
  );
};

export default AdminDashboard;
