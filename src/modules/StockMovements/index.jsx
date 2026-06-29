import { useEffect, useMemo, useState } from 'react';
import { Calendar, Filter, X, ChevronDown, AlertTriangle, ArrowDownRight, ArrowUpRight, RefreshCw, Repeat } from 'lucide-react';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import Dropdown from '../../app/components/Dropdown';
import api from '../../api';

function getTooltip(type) {
  switch (type) {
    case 'Receipt': return 'Goods arrived from a supplier';
    case 'Issue': return 'Stock sent out to fulfill an order';
    case 'Adjustment': return 'Manual correction to stock count';
    case 'Transfer': return 'Stock moved between warehouses';
    default: return '';
  }
}

function getBadgeClass(type) {
  switch (type) {
    case 'Receipt': return 'badge badge--success';
    case 'Issue': return 'badge badge--danger';
    case 'Transfer': return 'badge badge--sand';
    default: return 'badge badge--warning';
  }
}

function getTypeIcon(type) {
  switch (type) {
    case 'Receipt': return ArrowDownRight;
    case 'Issue': return ArrowUpRight;
    case 'Transfer': return Repeat;
    case 'Adjustment': return RefreshCw;
    default: return RefreshCw;
  }
}

function getTypeColor(type) {
  switch (type) {
    case 'Receipt': return 'var(--success)';
    case 'Issue': return 'var(--danger)';
    case 'Transfer': return 'var(--sand-accent-dark)';
    case 'Adjustment': return '#c48a20';
    default: return 'var(--sand-muted)';
  }
}

function StockMovements() {
  const [storeState, storeActions] = useStore();
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedMovementId, setSelectedMovementId] = useState(null);
  
  // Custom Date Range Picker States
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/stock-movements');
      const mapped = data.map(m => ({
        id: m.id,
        date: new Date(m.created_at).toISOString().split('T')[0],
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: m.movement_type,
        sku: m.product_sku,
        warehouse: m.warehouse_name,
        qty: m.quantity,
        notes: m.notes
      }));
      storeActions.setStockMovements(mapped);
      if (mapped.length > 0 && !selectedMovementId) {
        setSelectedMovementId(mapped[0].id);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load stock movements');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const types = ['All', ...new Set(storeState.stockMovements.map((m) => m.type))];

  // Derived today's totals
  const todayTotals = useMemo(() => {
    const movements = storeState.stockMovements.filter(m => m.date === today);
    return {
      received: movements.filter(m => m.type === 'Receipt').reduce((sum, m) => sum + Math.abs(m.qty), 0),
      issued: movements.filter(m => m.type === 'Issue').reduce((sum, m) => sum + Math.abs(m.qty), 0),
      adjusted: movements.filter(m => m.type === 'Adjustment').reduce((sum, m) => sum + m.qty, 0),
      transferred: movements.filter(m => m.type === 'Transfer').reduce((sum, m) => sum + Math.abs(m.qty), 0),
    };
  }, [storeState.stockMovements, today]);

  // Apply filters
  const filteredMovements = useMemo(() => {
    return storeState.stockMovements.filter((m) => {
      const matchesType = typeFilter === 'All' || m.type === typeFilter;
      
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && m.date >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && m.date <= endDate;
      }

      return matchesType && matchesDate;
    });
  }, [storeState.stockMovements, typeFilter, startDate, endDate]);

  const selectedMovement = useMemo(() => {
    return filteredMovements.find(m => m.id === selectedMovementId) || null;
  }, [filteredMovements, selectedMovementId]);

  const handlePreset = (preset) => {
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7days') {
      const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past7);
      setEndDate(today);
    } else if (preset === '30days') {
      const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past30);
      setEndDate(today);
    } else if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
    }
    setIsDatePickerOpen(false);
  };

  const formattedRangeText = useMemo(() => {
    if (!startDate && !endDate) return 'All Recorded Dates';
    if (startDate === endDate && startDate === today) return 'Today';
    return `${startDate || 'Start'} to ${endDate || 'End'}`;
  }, [startDate, endDate, today]);

  // Group movements by date for the detail panel timeline
  const movementsByDate = useMemo(() => {
    const groups = {};
    filteredMovements.forEach(m => {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredMovements]);

  if (loading) {
    return (
      <section className="module-page">
        <div className="module-header">
          <div className="module-header__title">
            <div className="module-header__title-icon">
              <moduleConfig.icon size={20} />
            </div>
            <div>
              <p className="eyebrow">Inventory Ledger</p>
              <h3>Loading Stock Movements...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '36px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '80px', borderRadius: 8 }}></div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-page">
        <div className="banner" style={{ borderLeftColor: 'var(--danger)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AlertTriangle color="var(--danger)" />
            <div>
              <strong>Error Loading Movements</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchMovements} className="subtle-button">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-page route-fade">
      
      {/* Header */}
      <div className="module-header" style={{ alignItems: 'flex-start' }}>
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <moduleConfig.icon size={20} />
          </div>
          <div style={{ maxWidth: 680 }}>
            <p className="eyebrow">Inventory Ledger</p>
            <h3>Warehouse Ledger Records</h3>
            <p style={{ marginTop: 6, fontSize: '0.88rem', color: 'var(--sand-muted)', lineHeight: '1.45' }}>
              Every physical change of products is recorded below. A <strong>Receipt</strong> increases stock; an <strong>Issue</strong> decreases stock. 
              Use filters to isolate movements by date range or transaction type.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Stat Widgets for Today */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16, margin: '8px 0 20px' }}>
        <div className="card" style={{ padding: '14px 18px' }}>
          <span className="eyebrow" style={{ fontSize: '0.74rem' }}>Received Today</span>
          <h4 style={{ margin: '4px 0 0', color: 'var(--success)' }}>+{todayTotals.received} units</h4>
        </div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <span className="eyebrow" style={{ fontSize: '0.74rem' }}>Issued Today</span>
          <h4 style={{ margin: '4px 0 0', color: 'var(--danger)' }}>-{todayTotals.issued} units</h4>
        </div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <span className="eyebrow" style={{ fontSize: '0.74rem' }}>Adjusted Today</span>
          <h4 style={{ margin: '4px 0 0' }}>{todayTotals.adjusted >= 0 ? `+${todayTotals.adjusted}` : todayTotals.adjusted} units</h4>
        </div>
        <div className="card" style={{ padding: '14px 18px' }}>
          <span className="eyebrow" style={{ fontSize: '0.74rem' }}>Transfers Today</span>
          <h4 style={{ margin: '4px 0 0', color: 'var(--sand-accent-dark)' }}>{todayTotals.transferred} units</h4>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="toolbar" style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, flexGrow: 1, flexWrap: 'wrap' }}>
          <Dropdown
            label="Transaction Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={types.map((type) => ({ label: type, value: type }))}
          />

          {/* Date Picker Custom Wrapper */}
          <div className="date-picker-custom" style={{ minWidth: 200 }}>
            <span className="eyebrow">Date Range Selection</span>
            <button
              type="button"
              className="surface-input"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} color="var(--sand-muted)" />
                {formattedRangeText}
              </span>
              <ChevronDown size={14} color="var(--sand-muted)" />
            </button>

            {isDatePickerOpen && (
              <div className="date-picker-custom__popover stack" style={{ gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  <button type="button" className="subtle-button" style={{ padding: '4px 8px', fontSize: '0.76rem' }} onClick={() => handlePreset('today')}>Today</button>
                  <button type="button" className="subtle-button" style={{ padding: '4px 8px', fontSize: '0.76rem' }} onClick={() => handlePreset('7days')}>7 Days</button>
                  <button type="button" className="subtle-button" style={{ padding: '4px 8px', fontSize: '0.76rem' }} onClick={() => handlePreset('30days')}>30 Days</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    className="surface-input"
                    style={{ padding: 6, fontSize: '0.8rem' }}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className="surface-input"
                    style={{ padding: 6, fontSize: '0.8rem' }}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="subtle-button" style={{ color: 'var(--danger)', fontSize: '0.8rem' }} onClick={() => handlePreset('clear')}>Clear</button>
                  <button type="button" className="action-button" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 8 }} onClick={() => setIsDatePickerOpen(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clear all active filters indicator */}
        {(typeFilter !== 'All' || startDate || endDate) && (
          <button
            type="button"
            className="subtle-button"
            style={{ alignSelf: 'flex-end', height: 42, padding: '0 12px', color: 'var(--danger)' }}
            onClick={() => {
              setTypeFilter('All');
              setStartDate('');
              setEndDate('');
            }}
          >
            <Filter size={14} /> Reset Filters
          </button>
        )}
      </div>

      {/* Split Layout: Cards Grid + Detail Panel */}
      <div className={`split-layout ${selectedMovement ? 'has-detail' : ''}`}>
        
        {/* Movement Cards Grid */}
        <div className="supplier-grid">
          {filteredMovements.map((movement) => {
            const TypeIcon = getTypeIcon(movement.type);
            const typeColor = getTypeColor(movement.type);
            return (
              <article
                key={movement.id}
                className="supplier-card"
                onClick={() => setSelectedMovementId(movement.id)}
                style={{
                  cursor: 'pointer',
                  borderColor: selectedMovementId === movement.id ? 'var(--color-accent-primary)' : 'rgba(122, 92, 62, 0.12)',
                  background: selectedMovementId === movement.id ? '#fffcf7' : 'rgba(255, 250, 242, 0.78)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${typeColor}14`
                    }}>
                      <TypeIcon size={18} color={typeColor} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem' }}>{movement.sku}</h4>
                      <p style={{ fontSize: '0.78rem', marginTop: 2, color: 'var(--sand-muted)' }}>{movement.date} · {movement.time}</p>
                    </div>
                  </div>
                  <span className={getBadgeClass(movement.type)} style={{ fontSize: '0.72rem' }}>
                    {movement.type}
                  </span>
                </div>
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="list-row" style={{ padding: '6px 10px', fontSize: '0.84rem' }}>
                    <span>Warehouse</span>
                    <strong>{movement.warehouse}</strong>
                  </div>
                  <div className="list-row" style={{ padding: '6px 10px', fontSize: '0.84rem' }}>
                    <span>Quantity</span>
                    <strong style={{ color: movement.qty >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {movement.qty >= 0 ? `+${movement.qty}` : movement.qty} units
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredMovements.length === 0 && (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--sand-muted)', gridColumn: '1 / -1' }}>
              No ledger records match the selected filter configuration.
            </div>
          )}
        </div>

        {/* Movement Detail Side Panel */}
        {selectedMovement && (
          <aside className="detail-panel" style={{ position: 'relative' }}>
            <button
              type="button"
              className="close-detail-btn"
              onClick={() => setSelectedMovementId(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            {/* Movement Type Header */}
            {(() => {
              const TypeIcon = getTypeIcon(selectedMovement.type);
              const typeColor = getTypeColor(selectedMovement.type);
              return (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0 4px' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${typeColor}18`
                  }}>
                    <TypeIcon size={22} color={typeColor} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.24rem', margin: 0 }}>{selectedMovement.type} Movement</h4>
                    <p style={{ fontSize: '0.84rem', color: 'var(--sand-muted)', margin: 0 }}>Record #{selectedMovement.id}</p>
                  </div>
                </div>
              );
            })()}

            {/* Movement Details */}
            <div style={{ background: 'rgba(214,195,163,0.12)', padding: 14, borderRadius: 16, marginTop: 16, marginBottom: 18 }}>
              <p className="eyebrow" style={{ fontSize: '0.7rem', marginBottom: 8 }}>Movement Details</p>
              <div className="stack" style={{ gap: 8, fontSize: '0.86rem' }}>
                <div className="list-row" style={{ padding: '8px 12px' }}>
                  <span>Product SKU</span>
                  <strong>{selectedMovement.sku}</strong>
                </div>
                <div className="list-row" style={{ padding: '8px 12px' }}>
                  <span>Warehouse</span>
                  <strong>{selectedMovement.warehouse}</strong>
                </div>
                <div className="list-row" style={{ padding: '8px 12px' }}>
                  <span>Quantity</span>
                  <strong style={{ color: selectedMovement.qty >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '1.05rem' }}>
                    {selectedMovement.qty >= 0 ? `+${selectedMovement.qty}` : selectedMovement.qty} units
                  </strong>
                </div>
                <div className="list-row" style={{ padding: '8px 12px' }}>
                  <span>Date</span>
                  <strong>{selectedMovement.date}</strong>
                </div>
                <div className="list-row" style={{ padding: '8px 12px' }}>
                  <span>Time</span>
                  <strong>{selectedMovement.time}</strong>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Notes & Reference</p>
              <div style={{
                background: 'rgba(214,195,163,0.06)', padding: 14, borderRadius: 12,
                fontSize: '0.86rem', color: selectedMovement.notes ? 'var(--sand-ink)' : 'var(--sand-muted)',
                lineHeight: 1.5, fontStyle: selectedMovement.notes ? 'normal' : 'italic',
                minHeight: 40
              }}>
                {selectedMovement.notes || 'No notes recorded for this movement.'}
              </div>
            </div>

            {/* Movement type explanation */}
            <div style={{ marginBottom: 18 }}>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>What does this mean?</p>
              <p style={{ fontSize: '0.84rem', color: 'var(--sand-muted)', lineHeight: 1.5 }}>
                {getTooltip(selectedMovement.type)}
              </p>
            </div>

            {/* Recent movements timeline for same SKU */}
            <div>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>
                Recent Activity for {selectedMovement.sku}
              </p>
              <div className="stack" style={{ gap: 6 }}>
                {storeState.stockMovements
                  .filter(m => m.sku === selectedMovement.sku && m.id !== selectedMovement.id)
                  .slice(0, 5)
                  .map(m => {
                    const MiniIcon = getTypeIcon(m.type);
                    const miniColor = getTypeColor(m.type);
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMovementId(m.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10,
                          background: 'rgba(214,195,163,0.06)', cursor: 'pointer',
                          transition: 'background 120ms ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(214,195,163,0.16)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(214,195,163,0.06)'}
                      >
                        <MiniIcon size={14} color={miniColor} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{m.type}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--sand-muted)', marginLeft: 6 }}>{m.date}</span>
                        </div>
                        <strong style={{
                          fontSize: '0.8rem',
                          color: m.qty >= 0 ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {m.qty >= 0 ? `+${m.qty}` : m.qty}
                        </strong>
                      </div>
                    );
                  })
                }
                {storeState.stockMovements.filter(m => m.sku === selectedMovement.sku && m.id !== selectedMovement.id).length === 0 && (
                  <p style={{ color: 'var(--sand-muted)', fontSize: '0.84rem', fontStyle: 'italic' }}>No other movements for this product.</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

export default StockMovements;
