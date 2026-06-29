import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, X, AlertTriangle } from 'lucide-react';
import Dropdown from '../../app/components/Dropdown';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';

function statusClass(status) {
  if (status === 'Shipped') return 'badge badge--success';
  if (status === 'Returned') return 'badge badge--danger';
  if (status === 'Allocated') return 'badge badge--warning';
  return 'badge badge--sand';
}

function SalesOrders({ eventBus }) {
  const [storeState, storeActions] = useStore();
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Date range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [selectedId, setSelectedId] = useState(null);
  const [sortBy, setSortBy] = useState({ key: 'dueDate', direction: 'asc' });

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const permissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('permissions') || '{}');
    } catch {
      return {};
    }
  }, []);

  const fetchSOs = async () => {
    setLoading(true);
    setError('');
    try {
      const [sosData, productsData] = await Promise.all([
        api.get('/api/sales-orders'),
        api.get('/api/products')
      ]);

      const mappedSOs = sosData.map(so => ({
        ...so,
        customer: so.customer_name,
        dueDate: so.due_date,
        total: `$${parseFloat(so.total_amount).toFixed(2)}`,
        items: (so.lines || []).map(l => ({
          ...l,
          name: l.product_name,
          sku: l.product_sku,
          qty: l.quantity,
          price: parseFloat(l.unit_price)
        }))
      }));

      const mappedProducts = productsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price)
      }));

      storeActions.setSalesOrders(mappedSOs);
      storeActions.setProducts(mappedProducts);

      if (mappedSOs.length > 0 && !selectedId) {
        setSelectedId(mappedSOs[0].id);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load sales orders');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSOs();
  }, []);

  const statuses = ['All', ...new Set(storeState.salesOrders.map((order) => order.status))];

  const filteredOrders = useMemo(() => {
    return storeState.salesOrders
      .filter((order) => {
        const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
        
        let matchesDate = true;
        if (startDate) {
          matchesDate = matchesDate && order.dueDate >= startDate;
        }
        if (endDate) {
          matchesDate = matchesDate && order.dueDate <= endDate;
        }

        return matchesStatus && matchesDate;
      })
      .sort((left, right) => {
        const leftValue = left[sortBy.key];
        const rightValue = right[sortBy.key];
        const comparison = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
        return sortBy.direction === 'asc' ? comparison : -comparison;
      });
  }, [storeState.salesOrders, statusFilter, startDate, endDate, sortBy]);

  const selectedOrder = useMemo(() => {
    return filteredOrders.find((order) => order.id === selectedId) ?? filteredOrders[0] ?? null;
  }, [filteredOrders, selectedId]);

  const handleShipOrder = async (order) => {
    if (order.status === 'Shipped') return;

    if (!confirm(`Mark Order #${order.id} as Shipped? This will decrement product stock.`)) {
      return;
    }

    try {
      await api.patch(`/api/sales-orders/${order.id}/ship`);
      
      storeActions.updateSalesOrderStatus(order.id, 'Shipped');

      // Refresh products and stock levels
      const [productsData, movementsData] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/stock-movements')
      ]);

      const mappedProducts = productsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price)
      }));

      const mappedMovements = movementsData.map(m => ({
        id: m.id,
        date: new Date(m.created_at).toISOString().split('T')[0],
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: m.movement_type,
        sku: m.product_sku,
        warehouse: m.warehouse_name,
        qty: m.quantity
      }));

      storeActions.setProducts(mappedProducts);
      storeActions.setStockMovements(mappedMovements);

      eventBus.emit('sales-order:updated', { id: order.id, status: 'Shipped' });
    } catch (err) {
      alert(err.message || 'Failed to ship order');
    }
  };

  const handleReturnInitiated = async (order) => {
    if (order.status === 'Returned') return;

    if (!confirm(`Mark Order #${order.id} as Returned? This will restock the inventory.`)) {
      return;
    }

    try {
      await api.patch(`/api/sales-orders/${order.id}/return`);
      
      storeActions.updateSalesOrderStatus(order.id, 'Returned');

      // Refresh products and stock levels
      const [productsData, movementsData] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/stock-movements')
      ]);

      const mappedProducts = productsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price)
      }));

      const mappedMovements = movementsData.map(m => ({
        id: m.id,
        date: new Date(m.created_at).toISOString().split('T')[0],
        time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: m.movement_type,
        sku: m.product_sku,
        warehouse: m.warehouse_name,
        qty: m.quantity
      }));

      storeActions.setProducts(mappedProducts);
      storeActions.setStockMovements(mappedMovements);

      eventBus.emit('sales-order:updated', { id: order.id, status: 'Returned' });
    } catch (err) {
      alert(err.message || 'Failed to return order');
    }
  };

  const updateSort = (key) => {
    setSortBy((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  if (loading) {
    return (
      <section className="module-page">
        <div className="module-header">
          <div className="module-header__title">
            <div className="module-header__title-icon">
              <moduleConfig.icon size={20} />
            </div>
            <div>
              <p className="eyebrow">Outbound Orders</p>
              <h3>Loading Sales Orders...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '36px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '60px', borderRadius: 8 }}></div>
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
              <strong>Error Loading Sales Orders</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchSOs} className="subtle-button">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-page route-fade">
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon">
            <moduleConfig.icon size={20} />
          </div>
          <div>
            <p className="eyebrow">Outbound Orders</p>
            <h3>Track Fulfillment and Returns</h3>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="filter-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <Dropdown
          label="Fulfillment Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statuses.map((status) => ({ label: status, value: status }))}
        />
        
        <label>
          <span className="eyebrow">Start Due Date</span>
          <input
            type="date"
            className="surface-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>

        <label>
          <span className="eyebrow">End Due Date</span>
          <input
            type="date"
            className="surface-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
      </div>

      <div className={`split-layout ${selectedOrder ? 'has-detail' : ''}`}>
        
        {/* Table list */}
        <div className="table-shell" style={{ border: '1px solid rgba(122, 92, 62, 0.12)' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    ['id', 'Order'],
                    ['customer', 'Customer'],
                    ['dueDate', 'Due Date'],
                    ['total', 'Total'],
                    ['status', 'Status'],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button type="button" className="table-sort" onClick={() => updateSort(key)}>
                        {label}
                        <span
                          className={`sort-arrow ${sortBy.key === key ? 'is-active' : ''} ${
                            sortBy.key === key && sortBy.direction === 'desc' ? 'is-desc' : ''
                          }`}
                        >
                          <ArrowUpDown size={14} />
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="clickable-row" 
                    onClick={() => setSelectedId(order.id)}
                    style={selectedId === order.id ? { background: 'var(--color-surface-strong)' } : {}}
                  >
                    <td>#{order.id}</td>
                    <td style={{ fontWeight: 500 }}>{order.customer}</td>
                    <td>{order.dueDate}</td>
                    <td style={{ fontWeight: 600 }}>{order.total}</td>
                    <td>
                      <span className={statusClass(order.status)}>{order.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Panel */}
        {selectedOrder && (
          <aside className="detail-panel" style={{ position: 'relative' }}>
            <button
              type="button"
              className="close-detail-btn"
              onClick={() => setSelectedId(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            <h4 style={{ fontSize: '1.22rem', margin: '12px 0 4px' }}>Order #{selectedOrder.id}</h4>
            <p style={{ marginBottom: 14, fontWeight: 500, color: 'var(--color-text-dark)' }}>{selectedOrder.customer}</p>
            
            <div className="stack" style={{ gap: 10 }}>
              <div className="list-row">
                <span>Destination</span>
                <strong>{selectedOrder.destination}</strong>
              </div>
              <div className="list-row">
                <span>Due Date</span>
                <strong>{selectedOrder.dueDate}</strong>
              </div>
              <div className="list-row">
                <span>Total Value</span>
                <strong style={{ color: 'var(--color-accent-hover)' }}>{selectedOrder.total}</strong>
              </div>
            </div>

            {/* Products in this Order */}
            <div style={{ marginTop: 20 }}>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 10 }}>Products in this Order</p>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="table-shell" style={{ border: 'none', background: 'transparent' }}>
                  <table style={{ width: '100%', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'transparent' }}>
                        <th style={{ padding: '8px 4px' }}>Product</th>
                        <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.sku} style={{ background: 'transparent' }}>
                          <td style={{ padding: '8px 4px' }}>
                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--sand-muted)' }}>{item.sku}</span>
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.qty}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>${item.price.toFixed(2)}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>
                            ${(item.qty * item.price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--sand-muted)', fontSize: '0.86rem' }}>No item line breakdown.</p>
              )}
            </div>

            {/* Action buttons with clear hierarchy (Viewer restricted) */}
            {permissions.ship_sales_orders && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24, borderTop: '1px solid rgba(122,92,62,0.12)', paddingTop: 18 }}>
                <button
                  type="button"
                  className="action-button"
                  style={{ flexGrow: 1, justifyContent: 'center' }}
                  onClick={() => handleShipOrder(selectedOrder)}
                  disabled={selectedOrder.status === 'Shipped' || selectedOrder.status === 'Returned'}
                >
                  {selectedOrder.status === 'Shipped' ? 'Shipped' : 'Mark Shipped'}
                </button>
                <button
                  type="button"
                  className="subtle-button"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'transparent',
                    flexGrow: 1,
                    justifyContent: 'center'
                  }}
                  onClick={() => handleReturnInitiated(selectedOrder)}
                  disabled={selectedOrder.status === 'Returned' || selectedOrder.status === 'Shipped'}
                >
                  {selectedOrder.status === 'Returned' ? 'Returned' : 'Mark Returned'}
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

export default SalesOrders;
