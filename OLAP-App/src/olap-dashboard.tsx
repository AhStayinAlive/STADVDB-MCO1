import React, { useState } from 'react';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';
import { Filter, ChevronDown } from 'lucide-react';

// OLAP Adapter Interface - easily swappable with real backends
const OLAPAdapter = {
  // Mock data - replace with actual OLAP queries
  fetchCallerTypeData: () => [
    { name: 'Anonymous', value: 35, color: '#00D9FF' },
    { name: 'Employee', value: 20, color: '#FF6B35' },
    { name: 'Customer', value: 25, color: '#FFA500' },
    { name: 'Supplier', value: 12, color: '#FFD700' },
    { name: 'Manager', value: 8, color: '#FF1493' }
  ],
  
  fetchCasesData: () => [
    { dept: 'Internal', cases: 85, color: '#FF6B6B' },
    { dept: 'Marketing', cases: 120, color: '#FFA500' },
    { dept: 'Accounting', cases: 45, color: '#FFD700' },
    { dept: 'Logistics', cases: 95, color: '#90EE90' },
    { dept: 'Finance', cases: 110, color: '#00D9FF' },
    { dept: 'Operations', cases: 130, color: '#4169E1' },
    { dept: 'IT', cases: 75, color: '#9370DB' },
    { dept: 'HR', cases: 140, color: '#FF1493' },
    { dept: 'Sales', cases: 65, color: '#FF69B4' }
  ],
  
  fetchStatusData: () => [
    { name: 'Open', value: 65, color: '#00D9FF' },
    { name: 'Closed', value: 35, color: '#FF6B6B' }
  ],
  
  fetchOriginData: () => [
    { name: 'Phone', value: 45, color: '#00D9FF' },
    { name: 'Email', value: 25, color: '#FFA500' },
    { name: 'Web', value: 20, color: '#FFD700' },
    { name: 'In-person', value: 10, color: '#FF6B6B' }
  ],
  
  fetchReportSourceData: () => [
    { name: 'Helpline', value: 60, color: '#00D9FF' },
    { name: 'Internal', value: 40, color: '#90EE90' }
  ],
  
  fetchTrendData: () => [
    { month: 'Jan', cases: 120, resolved: 95 },
    { month: 'Feb', cases: 145, resolved: 110 },
    { month: 'Mar', cases: 135, resolved: 125 },
    { month: 'Apr', cases: 165, resolved: 145 },
    { month: 'May', cases: 180, resolved: 160 },
    { month: 'Jun', cases: 195, resolved: 175 },
    { month: 'Jul', cases: 210, resolved: 190 },
    { month: 'Aug', cases: 185, resolved: 170 }
  ],
  
  fetchResponseTimeData: () => [
    { month: 'Jan', avgHours: 24 },
    { month: 'Feb', avgHours: 22 },
    { month: 'Mar', avgHours: 20 },
    { month: 'Apr', avgHours: 18 },
    { month: 'May', avgHours: 16 },
    { month: 'Jun', avgHours: 15 },
    { month: 'Jul', avgHours: 14 },
    { month: 'Aug', avgHours: 13 }
  ],
  
  fetchHeatmapData: () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = ['00', '04', '08', '12', '16', '20'];
    const data = [];
    
    days.forEach((day, dayIndex) => {
      hours.forEach((hour, hourIndex) => {
        data.push({
          day,
          hour,
          value: Math.floor(Math.random() * 50) + 10 + (hourIndex * 10)
        });
      });
    });
    
    return { data, days, hours };
  }
};

const FilterDropdown = ({ label, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="mb-4">
      <label className="text-gray-400 text-sm block mb-2">{label}</label>
      <div 
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 flex items-center justify-between cursor-pointer hover:border-gray-600 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-gray-300 text-sm">All</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
};

const Dashboard = () => {
  // Fetch data from adapter (easily replaceable with real OLAP calls)
  const callerTypeData = OLAPAdapter.fetchCallerTypeData();
  const casesData = OLAPAdapter.fetchCasesData();
  const statusData = OLAPAdapter.fetchStatusData();
  const originData = OLAPAdapter.fetchOriginData();
  const reportSourceData = OLAPAdapter.fetchReportSourceData();
  const trendData = OLAPAdapter.fetchTrendData();
  const responseTimeData = OLAPAdapter.fetchResponseTimeData();
  const heatmapData = OLAPAdapter.fetchHeatmapData();
  
  const getHeatmapColor = (value) => {
    if (value < 20) return '#1e3a5f';
    if (value < 35) return '#2d5a7b';
    if (value < 50) return '#3d7a9f';
    return '#00D9FF';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">OLAP Business Intelligence</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1">
          {/* Top Row - Pie and Bar Charts */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Caller Type Pie Chart */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query1</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={callerTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {callerTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend 
                    verticalAlign="middle" 
                    align="right"
                    layout="vertical"
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Cases Bar Chart */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query2</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={casesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dept" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Bar dataKey="cases" radius={[4, 4, 0, 0]}>
                    {casesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Middle Row - Status, Origin, Report Source */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Status */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query3</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Origin */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query4</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={originData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                  >
                    {originData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center text-3xl font-bold mt-4">100 %</div>
            </div>

            {/* Report Source */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query5</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={reportSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                  >
                    {reportSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row - Trend Charts and Heatmap */}
          <div className="grid grid-cols-3 gap-6">
            {/* Cases Trend */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query6</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Legend />
                  <Line type="monotone" dataKey="cases" stroke="#00D9FF" strokeWidth={2} dot={{ fill: '#00D9FF' }} />
                  <Line type="monotone" dataKey="resolved" stroke="#90EE90" strokeWidth={2} dot={{ fill: '#90EE90' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Response Time Trend */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query7</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                  <Line type="monotone" dataKey="avgHours" stroke="#FFA500" strokeWidth={2} dot={{ fill: '#FFA500' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Heatmap */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Query Heatmap</h2>
              <div className="mt-4">
                <div className="flex">
                  <div className="w-12"></div>
                  <div className="flex-1 flex justify-around text-xs text-gray-400">
                    {heatmapData.hours.map(hour => (
                      <div key={hour}>{hour}</div>
                    ))}
                  </div>
                </div>
                {heatmapData.days.map(day => (
                  <div key={day} className="flex items-center mt-1">
                    <div className="w-12 text-xs text-gray-400">{day}</div>
                    <div className="flex-1 flex gap-1">
                      {heatmapData.data
                        .filter(d => d.day === day)
                        .map((cell, idx) => (
                          <div
                            key={idx}
                            className="flex-1 h-6 rounded"
                            style={{ backgroundColor: getHeatmapColor(cell.value) }}
                            title={`${cell.day} ${cell.hour}:00 - ${cell.value} cases`}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Filters */}
        <div className="w-64 bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          
          <FilterDropdown label="Period" options={['Last 7 days', 'Last 30 days', 'Last 90 days']} />
          <FilterDropdown label="Type" options={['All', 'Complaint', 'Inquiry', 'Request']} />
          <FilterDropdown label="Department" options={['All', 'Internal', 'Marketing', 'Finance']} />
          <FilterDropdown label="Location" options={['All', 'North', 'South', 'East', 'West']} />
          <FilterDropdown label="Status" options={['All', 'Open', 'Closed', 'Pending']} />
          
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded mt-6 transition">
            Apply Filters
          </button>
          
          <button className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded mt-2 transition">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;