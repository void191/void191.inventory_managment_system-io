import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowRight, Warehouse, Bell, CheckCircle } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, LabelList } from 'recharts';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';

// Custom prefix-free tooltip
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
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
        {payload[0].value}
      </div>
    );
  }
  return null;
};

function occupancyClass(occupancy) {
  if (occupancy < 65) return 'is-success';
  if (occupancy < 80) return 'is-warning';
  return 'is-danger';
}

function getMovementBadgeClass(type) {
  switch (type) {
    case 'Receipt': return 'badge badge--success';
    case 'Issue': return 'badge badge--danger';
    case 'Transfer': return 'badge badge--sand';
    default: return 'badge badge--warning';
  }
}

function Dashboard({ eventBus }) {
  const [storeState, storeActions] = useStore();
  const navigate = useNavigate();
  const [bannerMessage, setBannerMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [products, pos, sos, warehouses, movements] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/purchase-orders'),
          api.get('/api/sales-orders'),
          api.get('/api/warehouses'),
          api.get('/api/stock-movements')
        ]);

        // Map product fields
        const mappedProducts = products.map(p => ({
          ...p,
          threshold: p.reorder_threshold,
          details: p.additional_details,
          price: parseFloat(p.price)
        }));

        // Map PO fields
        const mappedPOs = pos.map(po => ({
          ...po,
          supplier: po.supplier_name,
          total: parseFloat(po.total_amount),
          items: (po.lines || []).map(l => ({
            ...l,
            name: l.product_name,
            sku: l.product_sku,
            qty: l.quantity,
            price: parseFloat(l.unit_price)
          }))
        }));

        // Map SO fields
        const mappedSOs = sos.map(so => ({
          ...so,
          customer: so.customer_name,
          dueDate: so.due_date,
          total: parseFloat(so.total_amount),
          items: (so.lines || []).map(l => ({
            ...l,
            name: l.product_name,
            sku: l.product_sku,
            qty: l.quantity,
            price: parseFloat(l.unit_price)
          }))
        }));

        // Map Warehouse fields
        const mappedWarehouses = warehouses.map(w => ({
          ...w,
          bins: w.total_bins,
          occupancy: w.occupancy_percent
        }));

        // Map movements
        const mappedMovements = movements.map(m => ({
          id: m.id,
          date: new Date(m.created_at).toISOString().split('T')[0],
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: m.movement_type,
          sku: m.product_sku,
          warehouse: m.warehouse_name,
          qty: m.quantity
        }));

        storeActions.setProducts(mappedProducts);
        storeActions.setPurchaseOrders(mappedPOs);
        storeActions.setSalesOrders(mappedSOs);
        storeActions.setWarehouses(mappedWarehouses);
        storeActions.setStockMovements(mappedMovements);
        
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to fetch dashboard data');
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    // Set initial alert message
    if (storeState.products.length > 0) {
      const criticals = storeState.products.filter(p => p.stock <= p.threshold);
      if (criticals.length > 0) {
        setBannerMessage(`${criticals[0].name} (${criticals[0].sku}) is below safety threshold! Current stock: ${criticals[0].stock} units.`);
      } else {
        setBannerMessage('All stock levels are currently within safety margins.');
      }
    }

    const unsubscribe = eventBus.on('inventory:critical', (payload) => {
      if (payload?.message) {
        setBannerMessage(payload.message);
      }
    });

    return unsubscribe;
  }, [eventBus, storeState.products]);

  if (loading) {
    return (
      <section className="module-page">
        <div className="module-header">
          <div className="module-header__title">
            <div className="module-header__title-icon">
              <moduleConfig.icon size={20} />
            </div>
            <div>
              <p className="eyebrow">Operations Overview</p>
              <h3>Loading Dashboard...</h3>
            </div>
          </div>
        </div>
        <div className="kpi-grid" style={{ marginTop: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-card stack" style={{ height: 180, gap: 12 }}>
              <div className="skeleton-bar" style={{ width: '45%', height: '14px', borderRadius: 4 }}></div>
              <div className="skeleton-bar" style={{ width: '70%', height: '36px', borderRadius: 6 }}></div>
              <div className="skeleton-bar" style={{ width: '100%', height: '50px', borderRadius: 6, marginTop: 'auto' }}></div>
            </div>
          ))}
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
              <strong>Error Loading Dashboard</strong>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Derived operational data
  const criticalProducts = storeState.products.filter(p => p.stock <= p.threshold);
  
  const today = new Date().toISOString().split('T')[0];
  let todayMovements = storeState.stockMovements.filter(m => m.date === today);
  if (todayMovements.length === 0) {
    todayMovements = storeState.stockMovements.slice(0, 5);
  }
  
  const overduePOsCount = storeState.purchaseOrders.filter(
    po => po.status !== 'Delivered' && po.eta < today
  ).length;

  const pastDueSOsCount = storeState.salesOrders.filter(
    so => so.status !== 'Shipped' && so.status !== 'Returned' && so.dueDate < today
  ).length;

  const returnsCount = storeState.salesOrders.filter(
    so => so.status === 'Returned'
  ).length;

  const handleCreatePO = (product) => {
    const suggestedQty = product.threshold * 2 - product.stock;
    storeActions.setPendingNewPO({
      supplier: product.supplier,
      sku: product.sku,
      qty: suggestedQty > 0 ? suggestedQty : 50
    });
    navigate('/purchase-orders');
  };

  return (
    <section className="module-page route-fade">
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <moduleConfig.icon size={20} />
          </div>
          <div>
            <p className="eyebrow">Operations Overview</p>
            <h3>Operational Command Center</h3>
          </div>
        </div>
      </div>

      {bannerMessage && (
        <div className="banner" style={{ borderLeftColor: criticalProducts.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AlertTriangle color={criticalProducts.length > 0 ? 'var(--danger)' : 'var(--success)'} />
            <div>
              <strong>{criticalProducts.length > 0 ? 'Critical Stock Alert' : 'System Operations Normal'}</strong>
              <p>{bannerMessage}</p>
            </div>
          </div>
          <span className={`badge ${criticalProducts.length > 0 ? 'badge--danger' : 'badge--success'}`}>
            {criticalProducts.length} items needing review
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <article className="metric-card">
          <p>Total Stock Value</p>
          <div className="metric-value">${(storeState.products.reduce((acc, p) => acc + (p.price * p.stock), 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <p className="metric-footnote">{storeState.products.length} catalog items tracked</p>
          <div className="sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moduleConfig.mockData.stockTrend}>
                <Line type="monotone" dataKey="value" stroke="#A67C52" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        
        <article className="metric-card">
          <p>Low-Stock Alerts</p>
          <div className="metric-value" style={{ color: criticalProducts.length > 0 ? 'var(--danger)' : 'inherit' }}>
            {criticalProducts.length}
          </div>
          <p className="metric-footnote">Items currently below threshold</p>
          <div className="sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moduleConfig.mockData.stockTrend.map(pt => ({ ...pt, value: pt.value - 20 }))}>
                <Line type="monotone" dataKey="value" stroke="#8B2E2E" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="metric-card">
          <p>Pending Inbound POs</p>
          <div className="metric-value">
            {storeState.purchaseOrders.filter(po => po.status !== 'Delivered').length}
          </div>
          <p className="metric-footnote">{overduePOsCount} purchase orders overdue</p>
          <div className="sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moduleConfig.mockData.stockTrend.map(pt => ({ ...pt, value: pt.value + 10 }))}>
                <Line type="monotone" dataKey="value" stroke="#C2A27C" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="metric-card">
          <p>Pending Customer Sales</p>
          <div className="metric-value">
            {storeState.salesOrders.filter(so => so.status !== 'Shipped').length}
          </div>
          <p className="metric-footnote">{pastDueSOsCount} orders past due date</p>
          <div className="sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moduleConfig.mockData.stockTrend.map(pt => ({ ...pt, value: 460 - pt.value }))}>
                <Line type="monotone" dataKey="value" stroke="#4D8F57" strokeWidth={1.8} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {/* Main Dashboard Workspace */}
      <div className="split-layout has-detail" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) 1fr' }}>
        
        {/* Left Column: Chart, Occupancy Mini-map, Reorder Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Stock Trend Chart Card */}
          <div className="card">
            <div className="module-header" style={{ marginBottom: 12 }}>
              <div>
                <h4>Overall Stock Trend</h4>
                <p>Seven-day indexed stock level availability fluctuations.</p>
              </div>
              <span className="badge badge--sand">Rolling 7 days</span>
            </div>
            <div className="chart-panel" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moduleConfig.mockData.stockTrend} margin={{ top: 20, right: 15, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#7A5C3E" tickLine={false} style={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-accent-primary)"
                    strokeWidth={2.8}
                    dot={{ r: 4, fill: 'var(--color-accent-primary)', strokeWidth: 0 }}
                  >
                    <LabelList dataKey="value" position="top" style={{ fill: '#7A5C3E', fontSize: 10, fontWeight: 700 }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Warehouse Occupancy Mini-map Card */}
          <div className="card">
            <div className="module-header" style={{ marginBottom: 16 }}>
              <div>
                <h4>Warehouse Bins Occupancy Mini-map</h4>
                <p>Real-time physical bin usage percentage. Click warehouse to open floor plan.</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
              {storeState.warehouses.map((wh) => (
                <div 
                  key={wh.id} 
                  className="list-row" 
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer', gap: 8 }}
                  onClick={() => navigate('/warehouses')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <Warehouse size={16} color="var(--sand-muted)" />
                      <strong>{wh.name}</strong>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{wh.occupancy}%</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${occupancyClass(wh.occupancy)}`}
                      style={{ width: `${wh.occupancy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reorder Queue Card */}
          <div className="card">
            <div className="module-header" style={{ marginBottom: 12 }}>
              <div>
                <h4>Low Stock Reorder Queue</h4>
                <p>Items currently sitting below their set safety thresholds.</p>
              </div>
              <span className="badge badge--danger">{criticalProducts.length} items critical</span>
            </div>
            {criticalProducts.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--sand-muted)' }}>
                <CheckCircle size={24} color="var(--success)" style={{ marginBottom: 8 }} />
                <p>All products have healthy inventory counts.</p>
              </div>
            ) : (
              <div className="table-shell" style={{ border: 'none', background: 'transparent' }}>
                <div className="table-wrap">
                  <table style={{ background: 'transparent' }}>
                    <thead>
                      <tr style={{ background: 'transparent' }}>
                        <th style={{ padding: '10px 12px' }}>SKU</th>
                        <th style={{ padding: '10px 12px' }}>Name</th>
                        <th style={{ padding: '10px 12px' }}>Current Stock</th>
                        <th style={{ padding: '10px 12px' }}>Threshold</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Reorder Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalProducts.map((product) => (
                        <tr key={product.sku}>
                          <td style={{ padding: '10px 12px' }}>{product.sku}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{product.name}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="badge badge--danger">{product.stock} units</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>{product.threshold} units</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="subtle-button"
                              style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem' }}
                              onClick={() => handleCreatePO(product)}
                            >
                              Create PO <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Today's Feed, Pending Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Pending Actions Panel */}
          <div className="detail-panel" style={{ width: '100%', animation: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Bell size={18} color="var(--sand-accent-dark)" />
              <h4 style={{ margin: 0 }}>Pending Operations Actions</h4>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div 
                className="list-row" 
                style={{ cursor: 'pointer', background: overduePOsCount > 0 ? 'rgba(139, 46, 46, 0.08)' : 'rgba(214,195,163,0.12)' }}
                onClick={() => navigate('/purchase-orders')}
              >
                <div>
                  <strong>Overdue Purchase Orders</strong>
                  <p>{overduePOsCount} POs have passed their ETA date</p>
                </div>
                <span className={`badge ${overduePOsCount > 0 ? 'badge--danger' : 'badge--sand'}`}>{overduePOsCount}</span>
              </div>

              <div 
                className="list-row" 
                style={{ cursor: 'pointer', background: pastDueSOsCount > 0 ? 'rgba(139, 46, 46, 0.08)' : 'rgba(214,195,163,0.12)' }}
                onClick={() => navigate('/sales-orders')}
              >
                <div>
                  <strong>Past Due Sales Orders</strong>
                  <p>{pastDueSOsCount} orders unshipped past due date</p>
                </div>
                <span className={`badge ${pastDueSOsCount > 0 ? 'badge--danger' : 'badge--sand'}`}>{pastDueSOsCount}</span>
              </div>

              <div 
                className="list-row" 
                style={{ cursor: 'pointer', background: returnsCount > 0 ? 'rgba(194, 162, 124, 0.12)' : 'rgba(214,195,163,0.12)' }}
                onClick={() => navigate('/sales-orders')}
              >
                <div>
                  <strong>Unresolved Return Requests</strong>
                  <p>{returnsCount} returns awaiting inspection</p>
                </div>
                <span className={`badge ${returnsCount > 0 ? 'badge--warning' : 'badge--sand'}`}>{returnsCount}</span>
              </div>
            </div>
          </div>

          {/* Today's Activity Feed Card */}
          <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={18} color="var(--sand-accent-dark)" />
              <h4 style={{ margin: 0 }}>Today's Activity Feed</h4>
            </div>
            
            {todayMovements.length === 0 ? (
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'var(--sand-muted)' }}>
                <p>No inventory movements recorded today.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10, flexGrow: 1, overflowY: 'auto', maxHeight: 380 }}>
                {todayMovements.map((movement) => (
                  <div key={movement.id} className="list-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="eyebrow" style={{ fontSize: '0.7rem' }}>{movement.time || 'Today'}</span>
                        <span className={getMovementBadgeClass(movement.type)} style={{ padding: '2px 8px', fontSize: '0.74rem' }}>
                          {movement.type}
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <strong style={{ fontSize: '0.9rem' }}>{movement.sku}</strong>
                        <span style={{ color: 'var(--sand-muted)', fontSize: '0.85rem' }}> • {movement.warehouse}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                      <strong style={{ 
                        color: movement.qty > 0 ? 'var(--success)' : 'var(--danger)',
                        fontSize: '0.98rem' 
                      }}>
                        {movement.qty > 0 ? `+${movement.qty}` : movement.qty} units
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
}

export default Dashboard;
