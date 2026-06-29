import { useState, useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart2, TrendingUp, Layers, FileText, AlertTriangle } from 'lucide-react';
import { moduleConfig } from './moduleConfig';
import Dropdown from '../../app/components/Dropdown';
import api from '../../api';

// Custom prefix-free tooltip
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const val = typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value;
    return (
      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(122, 92, 62, 0.12)',
        background: 'rgba(255, 250, 242, 0.96)',
        padding: '6px 10px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#3E2F23',
        boxShadow: '0 4px 12px rgba(62,47,35,0.08)'
      }}>
        {val}
      </div>
    );
  }
  return null;
};

function Reports() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'sales' | 'purchases'
  
  // Custom Chart Type Toggle per tab: 'bar' | 'line' | 'area'
  const [chartTypes, setChartTypes] = useState({
    inventory: 'bar',
    sales: 'line',
    purchases: 'bar'
  });

  // Dynamic Date range for reports
  const [datePreset, setDatePreset] = useState('year'); // '7days' | 'month' | 'year'

  // Generate Report Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportType, setReportType] = useState('Valuation');
  const [modalStart, setModalStart] = useState('2026-01-01');
  const [modalEnd, setModalEnd] = useState('2026-06-30');
  const [exportFormat, setExportFormat] = useState('PDF');

  // Backend fetched reports state
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const permissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('permissions') || '{}');
    } catch {
      return {};
    }
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/api/reports/${activeTab}`);
      setReportData(data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load report data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab]);

  const reportTabs = [
    { key: 'inventory', label: 'Inventory Valuation' },
    { key: 'sales', label: 'Sales Performance' },
    { key: 'purchases', label: 'Purchases Analysis' }
  ];

  // Derive metrics and chart points dynamically based on backend output
  const derivedStats = useMemo(() => {
    if (activeTab === 'inventory') {
      const totalVal = reportData.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0);
      
      // Group by category name
      const catSums = {};
      reportData.forEach(r => {
        catSums[r.category] = (catSums[r.category] || 0) + parseFloat(r.total_value || 0);
      });

      const summaryList = Object.entries(catSums).map(([cat, val]) => ({
        label: cat,
        value: `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }));

      const chartPoints = Object.entries(catSums).map(([cat, val]) => ({
        name: cat,
        value: val
      }));

      return {
        metricLabel: 'Total Asset Value',
        metricValue: `$${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        summary: summaryList.slice(0, 3), // limit to top 3 categories
        chartData: chartPoints
      };
    } else if (activeTab === 'sales') {
      const totalSales = reportData.reduce((sum, r) => sum + parseFloat(r.total_sales || 0), 0);
      
      const summaryList = reportData.map(r => ({
        label: `${r.month} Sales`,
        value: `$${parseFloat(r.total_sales).toFixed(2)}`
      }));

      const chartPoints = reportData.map(r => ({
        name: r.month,
        value: parseFloat(r.total_sales)
      }));

      return {
        metricLabel: 'Total Shipped Sales',
        metricValue: `$${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        summary: summaryList.slice(-3), // show last 3 months
        chartData: chartPoints
      };
    } else {
      const totalPurchases = reportData.reduce((sum, r) => sum + parseFloat(r.total_purchases || 0), 0);
      
      const summaryList = reportData.map(r => ({
        label: `${r.month} Purchases`,
        value: `$${parseFloat(r.total_purchases).toFixed(2)}`
      }));

      const chartPoints = reportData.map(r => ({
        name: r.month,
        value: parseFloat(r.total_purchases)
      }));

      return {
        metricLabel: 'Total Inbound Purchases',
        metricValue: `$${totalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        summary: summaryList.slice(-3), // show last 3 months
        chartData: chartPoints
      };
    }
  }, [activeTab, reportData]);

  // Apply visual preset trimming
  const trimmedChartData = useMemo(() => {
    const full = derivedStats.chartData;
    if (datePreset === '7days') return full.slice(-2); // Mock trimming
    if (datePreset === 'month') return full.slice(-4);
    return full;
  }, [datePreset, derivedStats]);

  const toggleChartType = (tabKey, type) => {
    setChartTypes(current => ({
      ...current,
      [tabKey]: type
    }));
  };

  const currentChartType = chartTypes[activeTab];

  // Render active Recharts elements dynamically
  const renderChart = () => {
    const data = trimmedChartData;
    const strokeColor = 'var(--color-accent-primary)';
    const fillColor = 'rgba(166, 124, 82, 0.14)';

    if (data.length === 0) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--sand-muted)' }}>
          <p>No historical report data matches this date scope.</p>
        </div>
      );
    }

    if (currentChartType === 'bar') {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(122, 92, 62, 0.12)" />
          <XAxis dataKey="name" stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <YAxis stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Bar 
            dataKey="value" 
            fill="var(--color-accent-primary)" 
            radius={[6, 6, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      );
    }

    if (currentChartType === 'line') {
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(122, 92, 62, 0.12)" />
          <XAxis dataKey="name" stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <YAxis stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={strokeColor} 
            strokeWidth={3} 
            dot={{ r: 5, fill: strokeColor, strokeWidth: 0 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      );
    }

    if (currentChartType === 'area') {
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(122, 92, 62, 0.12)" />
          <XAxis dataKey="name" stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <YAxis stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={strokeColor} 
            fill={fillColor} 
            strokeWidth={2}
          />
        </AreaChart>
      );
    }

    return null;
  };

  return (
    <section className="module-page route-fade">
      
      {/* Header */}
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <moduleConfig.icon size={20} />
          </div>
          <div>
            <p className="eyebrow">Analytics</p>
            <h3>Business Performance & Reports</h3>
          </div>
        </div>
        
        {permissions.view_reports && (
          <button 
            type="button" 
            className="action-button" 
            onClick={() => setIsModalOpen(true)}
          >
            <FileText size={18} /> Print / Export Report
          </button>
        )}
      </div>

      {/* Date Range selectors for charts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div className="tab-strip">
          {reportTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`tab-button ${tab.key === activeTab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'rgba(214,195,163,0.14)', padding: 4, borderRadius: 12 }}>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 8, background: datePreset === '7days' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setDatePreset('7days')}
          >
            7 Days
          </button>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 8, background: datePreset === 'month' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setDatePreset('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className="subtle-button"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 8, background: datePreset === 'year' ? '#FFF' : 'transparent', border: 'none' }}
            onClick={() => setDatePreset('year')}
          >
            Full Year
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '40%', height: '14px', borderRadius: 4 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '180px', borderRadius: 8 }}></div>
        </div>
      ) : error ? (
        <div className="banner" style={{ borderLeftColor: 'var(--danger)', marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AlertTriangle color="var(--danger)" />
            <div>
              <strong>Error Loading Report</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchReportData} className="subtle-button">Retry</button>
        </div>
      ) : (
        <>
          {/* KPI summaries */}
          <div className="summary-row">
            <div className="summary-stat">
              <p>{derivedStats.metricLabel}</p>
              <h4 style={{ fontSize: '1.8rem', margin: '8px 0 0', fontWeight: 600 }}>{derivedStats.metricValue}</h4>
            </div>
            {derivedStats.summary.map((item) => (
              <div key={item.label} className="summary-stat">
                <p>{item.label}</p>
                <h4 style={{ margin: '8px 0 0', fontWeight: 600 }}>{item.value}</h4>
              </div>
            ))}
          </div>

          {/* Chart Panel with dynamic controls */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-dark)' }}>Performance Metrics Graph</strong>
              
              {/* Chart Type Icon Buttons Toggles */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(214,195,163,0.12)', padding: 4, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => toggleChartType(activeTab, 'bar')}
                  style={{
                    border: 'none',
                    background: currentChartType === 'bar' ? '#FFF' : 'transparent',
                    borderRadius: 8,
                    padding: 6,
                    cursor: 'pointer'
                  }}
                  title="Bar Chart"
                >
                  <BarChart2 size={15} color="var(--color-text-dark)" />
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleChartType(activeTab, 'line')}
                  style={{
                    border: 'none',
                    background: currentChartType === 'line' ? '#FFF' : 'transparent',
                    borderRadius: 8,
                    padding: 6,
                    cursor: 'pointer'
                  }}
                  title="Line Chart"
                >
                  <TrendingUp size={15} color="var(--color-text-dark)" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleChartType(activeTab, 'area')}
                  style={{
                    border: 'none',
                    background: currentChartType === 'area' ? '#FFF' : 'transparent',
                    borderRadius: 8,
                    padding: 6,
                    cursor: 'pointer'
                  }}
                  title="Area Chart"
                >
                  <Layers size={15} color="var(--color-text-dark)" />
                </button>
              </div>
            </div>

            <div className="chart-panel" style={{ height: 310, padding: '16px 8px 8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Generate Report Preview Modal */}
      {isModalOpen && (
        <div className="overlay" role="presentation" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" role="dialog" onClick={(event) => event.stopPropagation()} style={{ width: '640px' }}>
            <div className="module-header" style={{ marginBottom: 20 }}>
              <div>
                <p className="eyebrow">Compile Data</p>
                <h3>Generate Operational Report</h3>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
              {/* Form Side */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Dropdown
                  label="Report Category"
                  value={reportType}
                  onChange={setReportType}
                  options={[
                    { label: 'Valuation & Assets', value: 'Valuation' },
                    { label: 'Sales MoM Revenue', value: 'Sales' },
                    { label: 'Purchases Inbound Cost', value: 'Purchases' }
                  ]}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>
                    <span className="eyebrow" style={{ fontSize: '0.64rem' }}>Start Date</span>
                    <input
                      type="date"
                      className="surface-input"
                      value={modalStart}
                      onChange={(e) => setModalStart(e.target.value)}
                      style={{ padding: 8, fontSize: '0.85rem', marginTop: 4 }}
                    />
                  </label>
                  <label>
                    <span className="eyebrow" style={{ fontSize: '0.64rem' }}>End Date</span>
                    <input
                      type="date"
                      className="surface-input"
                      value={modalEnd}
                      onChange={(e) => setModalEnd(e.target.value)}
                      style={{ padding: 8, fontSize: '0.85rem', marginTop: 4 }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="eyebrow" style={{ marginBottom: 8 }}>Export Format</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="radio" name="format" checked={exportFormat === 'PDF'} onChange={() => setExportFormat('PDF')} />
                      PDF Document Preview
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="radio" name="format" checked={exportFormat === 'CSV'} onChange={() => setExportFormat('CSV')} />
                      CSV Spreadsheet File
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview Side */}
              <div style={{ borderLeft: '1px solid rgba(122,92,62,0.12)', paddingLeft: 20, display: 'flex', flexDirection: 'column' }}>
                <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 10 }}>Generated Summary Preview</p>
                <div style={{
                  flexGrow: 1,
                  background: 'rgba(214,195,163,0.12)',
                  borderRadius: 14,
                  padding: 14,
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <strong style={{ display: 'block', fontSize: '0.9rem', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: 6 }}>
                    Grainhouse {reportType} Statement
                  </strong>
                  <div><strong>Date range:</strong> {modalStart} to {modalEnd}</div>
                  <div><strong>Format output:</strong> {exportFormat}</div>
                  <div><strong>Status:</strong> Ready to compile</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid rgba(122,92,62,0.1)', paddingTop: 16 }}>
              <button type="button" className="subtle-button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  alert(`Generating and downloading ${reportType} report statement as ${exportFormat}...`);
                  setIsModalOpen(false);
                }}
              >
                Compile & Download
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

export default Reports;
