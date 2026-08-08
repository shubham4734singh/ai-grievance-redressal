import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/grievances/analytics/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch analytics');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Analytics...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto mt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600 mt-2">Real-time overview of citizen grievances across the city.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-primary-500 text-white p-6 flex flex-col justify-center items-center">
          <p className="text-primary-100 font-bold uppercase tracking-wider text-sm">Total Grievances</p>
          <p className="text-5xl font-extrabold mt-2">{data.total}</p>
        </Card>
        
        <Card className="p-6 flex flex-col justify-center items-center border-t-4 border-yellow-400">
          <p className="text-gray-500 font-bold uppercase tracking-wider text-sm">Submitted</p>
          <p className="text-4xl font-extrabold text-gray-900 mt-2">{data.status_distribution['Submitted'] || 0}</p>
        </Card>
        
        <Card className="p-6 flex flex-col justify-center items-center border-t-4 border-blue-400">
          <p className="text-gray-500 font-bold uppercase tracking-wider text-sm">In Progress</p>
          <p className="text-4xl font-extrabold text-gray-900 mt-2">{data.status_distribution['In Progress'] || 0}</p>
        </Card>
        
        <Card className="p-6 flex flex-col justify-center items-center border-t-4 border-green-400">
          <p className="text-gray-500 font-bold uppercase tracking-wider text-sm">Resolved</p>
          <p className="text-4xl font-extrabold text-gray-900 mt-2">{data.status_distribution['Resolved'] || 0}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Grievances by Category</h2>
          <div className="space-y-4">
            {Object.entries(data.category_distribution).sort((a,b) => b[1] - a[1]).map(([category, count]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold text-gray-700">{category}</span>
                  <span className="text-gray-500 font-bold">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-primary-500 h-2.5 rounded-full" style={{ width: `${Math.min((count / data.total) * 100, 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Priority Breakdown */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Urgency Breakdown</h2>
          <div className="space-y-4">
            {Object.entries(data.priority_distribution).map(([priority, count]) => {
              let color = 'bg-blue-400';
              if (priority === 'Urgent') color = 'bg-red-500';
              if (priority === 'High') color = 'bg-orange-400';
              if (priority === 'Medium') color = 'bg-yellow-400';
              if (priority === 'Low') color = 'bg-green-400';
              
              return (
                <div key={priority}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{priority}</span>
                    <span className="text-gray-500 font-bold">{count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.min((count / data.total) * 100, 100)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
