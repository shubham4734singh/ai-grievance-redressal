import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, ClipboardList, Clock3, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';

const priorityStyle = {
  Urgent: 'bg-red-100 text-red-800 ring-red-200',
  High: 'bg-orange-100 text-orange-800 ring-orange-200',
  Medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  Low: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Unassigned: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const priorityRank = { Urgent: 4, High: 3, Medium: 2, Low: 1, Unassigned: 0 };

const PriorityBadge = ({ priority = 'Unassigned' }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityStyle[priority] || priorityStyle.Unassigned}`}>
    {priority === 'Urgent' || priority === 'High' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
    {priority}
  </span>
);

const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not available';

const ManageStaff = () => {
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '', department: 'Water' });
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setNotice({ type: '', text: '' });
    try {
      const response = await fetch('/api/auth/create-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify(formData) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create staff account.');
      setNotice({ type: 'success', text: `${data.full_name} can now access the ${data.department} workspace.` });
      setFormData({ full_name: '', email: '', password: '', department: 'Water' });
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setLoading(false); }
  };

  return <Card className="max-w-2xl p-6 md:p-8">
    <h2 className="text-xl font-bold text-slate-950">Create department officer</h2>
    <p className="mt-1 text-sm text-slate-600">Officers can view and update cases assigned to their department.</p>
    {notice.text && <div className={`mt-5 rounded-lg border p-3 text-sm font-medium ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{notice.text}</div>}
    <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
      {[['full_name', 'Full name', 'text'], ['email', 'Email address', 'email'], ['password', 'Temporary password', 'password']].map(([key, label, type]) => <label key={key} className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><input required type={type} value={formData[key]} onChange={(event) => setFormData({ ...formData, [key]: event.target.value })} className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></label>)}
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Department scope</span><select value={formData.department} onChange={(event) => setFormData({ ...formData, department: event.target.value })} className="h-11 rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100">{['Water', 'Electricity', 'Roads', 'Sanitation', 'Police'].map((department) => <option key={department}>{department}</option>)}</select></label>
      <Button type="submit" loading={loading} className="sm:col-span-2">Create officer account</Button>
    </form>
  </Card>;
};

const AdminDashboard = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sort, setSort] = useState('newest');
  const [activeTab, setActiveTab] = useState('grievances');
  const [status, setStatus] = useState('Submitted');
  const [priority, setPriority] = useState('Unassigned');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [plan, setPlan] = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentName = user.department === 'All' ? 'Central' : user.department || 'Central';

  const fetchGrievances = async () => {
    setError('');
    try {
      const response = await fetch('/api/grievances/', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to load grievances.');
      setGrievances(data);
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  };

  useEffect(() => { fetchGrievances(); }, []);

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    return grievances.filter((item) => {
      const matchesSearch = !search || [item.tracking_id, item.description, item.location, item.category, item.department].filter(Boolean).join(' ').toLowerCase().includes(search);
      return matchesSearch && (statusFilter === 'All' || item.status === statusFilter) && (priorityFilter === 'All' || item.priority === priorityFilter);
    }).sort((a, b) => {
      if (sort === 'priority') return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [grievances, priorityFilter, query, sort, statusFilter]);

  const stats = [
    ['Open cases', grievances.filter((item) => !['Resolved', 'Rejected'].includes(item.status)).length, ClipboardList, 'bg-primary-50 text-primary-700'],
    ['In progress', grievances.filter((item) => item.status === 'In Progress').length, Clock3, 'bg-amber-50 text-amber-800'],
    ['Resolved', grievances.filter((item) => item.status === 'Resolved').length, CheckCircle2, 'bg-emerald-50 text-emerald-800'],
    ['Needs attention', grievances.filter((item) => ['Urgent', 'High'].includes(item.priority)).length, AlertTriangle, 'bg-red-50 text-red-800'],
  ];

  const openReview = (item) => { setSelected(item); setStatus(item.status); setPriority(item.priority || 'Unassigned'); setNote(''); setPlan(''); };
  const updateCase = async (event) => {
    event.preventDefault(); setUpdating(true);
    try {
      const response = await fetch(`/api/grievances/track/${selected.tracking_id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ status, priority, note }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Unable to update this grievance.');
      await fetchGrievances(); setSelected(null);
    } catch (requestError) { setError(requestError.message); } finally { setUpdating(false); }
  };
  const generatePlan = async () => {
    setGeneratingPlan(true); setPlan('');
    try { const response = await fetch(`/api/grievances/track/${selected.tracking_id}/solution`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Unable to generate an action plan.'); setPlan(data.solution_plan); } catch (requestError) { setError(requestError.message); } finally { setGeneratingPlan(false); }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading officer workspace...</div>;

  return <div className="mx-auto max-w-7xl px-5 py-8 md:py-10">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-sm font-bold uppercase tracking-wide text-primary-600">Officer workspace</p><h1 className="mt-1 text-3xl font-bold text-slate-950">{departmentName} operations</h1><p className="mt-2 text-slate-600">Prioritise incoming grievances and keep citizens informed.</p></div>
      <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800"><span className="font-bold">AI triage enabled</span><span className="mx-2 text-primary-300">|</span>Priority and routing are applied at intake.</div>
    </div>

    {error && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}
    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value, Icon, tone]) => <Card key={label} density="admin" className="flex items-center gap-4 p-4"><span className={`grid h-11 w-11 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-2xl font-bold text-slate-950">{value}</p><p className="text-sm text-slate-600">{label}</p></div></Card>)}</div>

    {user.department === 'All' && <div className="mt-8 flex border-b border-slate-200"><button onClick={() => setActiveTab('grievances')} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'grievances' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Grievances</button><button onClick={() => setActiveTab('staff')} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'staff' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Manage officers</button></div>}
    {activeTab === 'staff' ? <div className="mt-8"><ManageStaff /></div> : <>
      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, description, location, category..." className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></label>
        <div className="grid grid-cols-3 gap-2 sm:flex"><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><option>All</option><option>Submitted</option><option>In Progress</option><option>Resolved</option><option>Rejected</option></select><select aria-label="Filter by AI priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><option>All</option><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option><option>Unassigned</option></select><select aria-label="Sort grievances" value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Highest priority</option></select></div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><SlidersHorizontal className="h-4 w-4" /><span>{shown.length} of {grievances.length} cases shown</span></div>
      <Card density="admin" className="mt-4 overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Case</th><th className="px-4 py-3 font-semibold">AI assessment</th><th className="px-4 py-3 font-semibold">Location</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Received</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{shown.map((item) => <tr key={item.id} className="transition hover:bg-primary-50/40"><td className="px-5 py-4"><p className="font-mono text-xs font-bold text-primary-700">{item.tracking_id}</p><p className="mt-1 max-w-[260px] truncate text-sm font-medium text-slate-900">{item.description}</p></td><td className="px-4 py-4"><PriorityBadge priority={item.priority} /><p className="mt-1.5 text-xs text-slate-500">{item.category || 'Uncategorised'} · {item.sentiment || 'Neutral'}</p></td><td className="px-4 py-4 text-sm text-slate-600"><span className="flex max-w-[170px] items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />{item.location}</span></td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4 text-sm text-slate-600">{formatDate(item.created_at)}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => openReview(item)}>Review</Button></td></tr>)}{shown.length === 0 && <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-slate-500">No grievances match the current filters.</td></tr>}</tbody></table></div></Card>
    </>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 md:p-7"><div className="flex items-start justify-between gap-5"><div><p className="font-mono text-xs font-bold text-primary-700">{selected.tracking_id}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Review grievance</h2></div><button aria-label="Close review" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-4"><div className="rounded-lg border border-primary-100 bg-primary-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-primary-700">AI category</p><p className="mt-1 text-sm font-semibold text-slate-900">{selected.category || 'Uncategorised'}</p></div><div className="rounded-lg border border-primary-100 bg-primary-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-primary-700">AI priority</p><div className="mt-1"><PriorityBadge priority={selected.priority} /></div></div><div className="rounded-lg border border-primary-100 bg-primary-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Sentiment</p><p className="mt-1 text-sm font-semibold text-slate-900">{selected.sentiment || 'Neutral'}</p></div><div className="rounded-lg border border-primary-100 bg-primary-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-primary-700">Department</p><p className="mt-1 text-sm font-semibold text-slate-900">{selected.department || 'Unassigned'}</p></div></div>
      <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Citizen report</p><p className="mt-2 whitespace-pre-wrap leading-6 text-slate-800">{selected.description}</p><p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-4 w-4" />{selected.location}</p></div>
      {selected.evidence_url && <img src={selected.evidence_url} alt="Submitted evidence" className="mt-5 max-h-64 rounded-lg object-cover" />}
      <div className="mt-6 border border-primary-100 bg-primary-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-bold text-primary-800"><Bot className="h-4 w-4" />AI resolution brief</p>{!plan && <Button size="sm" onClick={generatePlan} loading={generatingPlan} iconLeft={<Sparkles className="h-4 w-4" />}>Generate plan</Button>}</div>{plan ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{plan}</p> : !generatingPlan && <p className="mt-2 text-sm text-primary-700">Create a practical next-step plan based on the report, department, and priority.</p>}</div>
      <form onSubmit={updateCase} className="mt-7 border-t border-slate-200 pt-6"><h3 className="text-lg font-bold text-slate-950">Update citizen</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3"><option>Submitted</option><option>In Progress</option><option>Resolved</option><option>Rejected</option></select></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3"><option>Unassigned</option><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label></div><label className="mt-4 grid gap-1.5 text-sm font-semibold text-slate-700"><span>Update note</span><textarea required value={note} onChange={(event) => setNote(event.target.value)} rows="3" placeholder="Explain what changed and what happens next..." className="rounded-lg border border-slate-300 p-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" /></label><div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" loading={updating}>Save update</Button></div></form>
    </Card></div>}
  </div>;
};

export default AdminDashboard;
