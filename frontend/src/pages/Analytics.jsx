import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, ClipboardList, Clock3, Layers3, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';

const statusMeta = {
  Submitted: { label: 'Submitted', tone: 'bg-slate-500', soft: 'bg-slate-100 text-slate-700' },
  'In Progress': { label: 'In progress', tone: 'bg-primary-500', soft: 'bg-primary-50 text-primary-700' },
  Resolved: { label: 'Resolved', tone: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
  Rejected: { label: 'Rejected', tone: 'bg-rose-500', soft: 'bg-rose-50 text-rose-700' },
};

const priorityMeta = {
  Urgent: { tone: 'bg-red-500', soft: 'bg-red-50 text-red-800', order: 0 },
  High: { tone: 'bg-orange-500', soft: 'bg-orange-50 text-orange-800', order: 1 },
  Medium: { tone: 'bg-amber-400', soft: 'bg-amber-50 text-amber-800', order: 2 },
  Low: { tone: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-800', order: 3 },
  Unassigned: { tone: 'bg-slate-400', soft: 'bg-slate-100 text-slate-700', order: 4 },
};

const percent = (value, total) => total ? Math.round((value / total) * 100) : 0;

const Metric = ({ label, value, detail, Icon, tone }) => <Card density="admin" className="p-5">
  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{detail}</p></div><span className={`grid h-10 w-10 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></span></div>
</Card>;

const DistributionRow = ({ label, value, total, tone, detail }) => <div className="py-3.5 first:pt-0 last:pb-0">
  <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{label}</p>{detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}</div><div className="flex shrink-0 items-baseline gap-2"><span className="text-sm font-bold text-slate-900">{value}</span><span className="text-xs text-slate-500">{percent(value, total)}%</span></div></div>
  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${percent(value, total)}%` }} /></div>
</div>;

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/grievances/analytics/dashboard', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Unable to load analytics.');
      setData(result); setLastUpdated(new Date());
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(); }, []);

  const insights = useMemo(() => {
    if (!data) return null;
    const total = data.total || 0;
    const status = data.status_distribution || {};
    const priorities = data.priority_distribution || {};
    const categories = Object.entries(data.category_distribution || {}).sort((a, b) => b[1] - a[1]);
    const resolved = status.Resolved || 0;
    const inProgress = status['In Progress'] || 0;
    const submitted = status.Submitted || 0;
    const backlog = Math.max(total - resolved - (status.Rejected || 0), 0);
    const highPriority = (priorities.Urgent || 0) + (priorities.High || 0);
    const priorityRows = Object.entries(priorities).sort(([a], [b]) => (priorityMeta[a]?.order ?? 99) - (priorityMeta[b]?.order ?? 99));
    return { total, status, categories, resolved, inProgress, submitted, backlog, highPriority, priorityRows, resolutionRate: percent(resolved, total), activeRate: percent(backlog, total), leadingCategory: categories[0]?.[0] || 'No category data' };
  }, [data]);

  if (loading && !data) return <div className="p-10 text-center text-slate-500">Loading analytics workspace...</div>;
  if (error && !data) return <div className="p-10 text-center text-red-700">{error}</div>;

  return <div className="mx-auto max-w-7xl px-5 py-8 md:py-10">
    <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-primary-600">Operational intelligence</p><h1 className="mt-1 text-3xl font-bold text-slate-950">Grievance analytics</h1><p className="mt-2 text-slate-600">Department workload, resolution flow, and AI-prioritised risk.</p></div><div className="flex items-center gap-3"><div className="text-right text-xs text-slate-500"><p>Live operational data</p><p className="mt-1">Updated {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'just now'}</p></div><button title="Refresh analytics" aria-label="Refresh analytics" onClick={fetchAnalytics} disabled={loading} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-primary-300 hover:text-primary-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>

    {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total intake" value={insights.total} detail="All reported grievances" Icon={ClipboardList} tone="bg-primary-50 text-primary-700" /><Metric label="Active backlog" value={insights.backlog} detail={`${insights.activeRate}% of total intake`} Icon={Layers3} tone="bg-amber-50 text-amber-800" /><Metric label="Resolution rate" value={`${insights.resolutionRate}%`} detail={`${insights.resolved} cases resolved`} Icon={CheckCircle2} tone="bg-emerald-50 text-emerald-800" /><Metric label="Priority queue" value={insights.highPriority} detail="Urgent and high priority" Icon={ShieldAlert} tone="bg-red-50 text-red-800" /></section>

    <section className="mt-7 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card density="admin" className="p-0"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5"><div><h2 className="font-bold text-slate-950">Resolution pipeline</h2><p className="mt-1 text-sm text-slate-600">Current stage distribution across all grievances.</p></div><Activity className="h-5 w-5 text-primary-600" /></div><div className="grid gap-0 divide-y divide-slate-100 px-5 py-5 md:grid-cols-2 md:divide-x md:divide-y-0">{Object.keys(statusMeta).map((key) => <div key={key} className="py-4 first:pt-0 last:pb-0 md:px-5 md:first:pl-0 md:nth-[2]:pr-0"><div className="flex items-center justify-between"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusMeta[key].soft}`}>{statusMeta[key].label}</span><span className="text-lg font-bold text-slate-950">{insights.status[key] || 0}</span></div><div className="mt-4 h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${statusMeta[key].tone}`} style={{ width: `${percent(insights.status[key] || 0, insights.total)}%` }} /></div><p className="mt-2 text-xs text-slate-500">{percent(insights.status[key] || 0, insights.total)}% of all reported cases</p></div>)}</div></Card>
      <Card density="admin" className="p-0"><div className="border-b border-slate-200 px-5 py-5"><p className="text-xs font-bold uppercase tracking-wide text-primary-600">AI workload signal</p><h2 className="mt-1 font-bold text-slate-950">Attention required</h2></div><div className="p-5"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-red-700"><AlertTriangle className="h-6 w-6" /></span><div><p className="text-2xl font-bold text-slate-950">{insights.highPriority}</p><p className="text-sm text-slate-600">High-impact reports need attention</p></div></div><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-sm font-semibold text-slate-800">Leading service category</p><p className="mt-1 flex items-center gap-2 text-sm text-primary-700"><TrendingUp className="h-4 w-4" />{insights.leadingCategory}</p></div><div className="mt-4 border-t border-slate-100 pt-4"><p className="text-sm font-semibold text-slate-800">Cases currently in progress</p><p className="mt-1 text-sm text-slate-600">{insights.inProgress} cases are assigned or under active review.</p></div></div></Card>
    </section>

    <section className="mt-7 grid gap-5 lg:grid-cols-2"><Card density="admin" className="p-0"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5"><div><h2 className="font-bold text-slate-950">Service demand</h2><p className="mt-1 text-sm text-slate-600">Where citizens are reporting the most issues.</p></div><BarChart3 className="h-5 w-5 text-primary-600" /></div><div className="px-5 py-5">{insights.categories.length ? insights.categories.map(([category, count]) => <DistributionRow key={category} label={category} value={count} total={insights.total} tone="bg-primary-500" detail="Share of total grievance intake" />) : <p className="py-6 text-center text-sm text-slate-500">No category data is available yet.</p>}</div></Card>
      <Card density="admin" className="p-0"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-5"><div><h2 className="font-bold text-slate-950">AI priority distribution</h2><p className="mt-1 text-sm text-slate-600">Triage levels assigned at grievance intake.</p></div><AlertTriangle className="h-5 w-5 text-primary-600" /></div><div className="px-5 py-5">{insights.priorityRows.length ? insights.priorityRows.map(([priority, count]) => <DistributionRow key={priority} label={priority} value={count} total={insights.total} tone={priorityMeta[priority]?.tone || 'bg-slate-400'} detail={priority === 'Urgent' ? 'Immediate operational response' : priority === 'High' ? 'Prioritised field review' : 'AI-assigned triage level'} />) : <p className="py-6 text-center text-sm text-slate-500">No priority data is available yet.</p>}</div></Card></section>

    <section className="mt-7 border-t border-slate-200 pt-5"><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{insights.resolved} resolved cases</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary-500" />{insights.inProgress} in active handling</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" />{insights.highPriority} in priority queue</span><span className="ml-auto flex items-center gap-1 font-medium text-primary-700">Operational dashboard <ArrowUpRight className="h-4 w-4" /></span></div></section>
  </div>;
};

export default Analytics;
