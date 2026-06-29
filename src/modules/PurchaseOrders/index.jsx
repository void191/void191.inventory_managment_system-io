import { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Plus, X, Trash2, Printer, AlertTriangle } from 'lucide-react';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import Dropdown from '../../app/components/Dropdown';
import api from '../../api';

function getStatusClass(status) {
  if (status === 'Delivered') return 'badge badge--success';
  if (status === 'Sent') return 'badge badge--warning';
  return 'badge badge--sand';
}

function PurchaseOrders({ eventBus }) {
  const [storeState, storeActions] = useStore();
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sorting state
  const [sortBy, setSortBy] = useState({ key: 'eta', direction: 'asc' });

  // PO Form states
  const [formSupplier, setFormSupplier] = useState('');
  const [formEta, setFormEta] = useState('');
  
  // Adding line items inside modal
  const [addedLines, setAddedLines] = useState([]);
  const [currentLineProductSku, setCurrentLineProductSku] = useState('');
  const [currentLineQty, setCurrentLineQty] = useState('10');

  const permissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('permissions') || '{}');
    } catch {
      return {};
    }
  }, []);

  const fetchPOsAndSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const [posData, suppliersData, productsData] = await Promise.all([
        api.get('/api/purchase-orders'),
        api.get('/api/suppliers'),
        api.get('/api/products')
      ]);

      const mappedPOs = posData.map(po => ({
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

      const mappedSuppliers = suppliersData.map(s => ({
        ...s,
        contact: s.contact_name,
        rating: s.performance_rating
      }));

      const mappedProducts = productsData.map(p => ({
        ...p,
        threshold: p.reorder_threshold,
        details: p.additional_details,
        price: parseFloat(p.price)
      }));

      storeActions.setPurchaseOrders(mappedPOs);
      storeActions.setSuppliers(mappedSuppliers);
      storeActions.setProducts(mappedProducts);

      if (mappedPOs.length > 0 && !selectedOrderId) {
        setSelectedOrderId(mappedPOs[0].id);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load purchase orders');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPOsAndSuppliers();
  }, []);

  // Trigger modal and pre-fill if there is a pending PO from dashboard
  useEffect(() => {
    if (storeState.pendingNewPO) {
      setIsModalOpen(true);
      setFormSupplier(storeState.pendingNewPO.supplier);
      const prod = storeState.products.find(p => p.sku === storeState.pendingNewPO.sku);
      if (prod) {
        setAddedLines([
          {
            sku: prod.sku,
            name: prod.name,
            qty: parseInt(storeState.pendingNewPO.qty) || 50,
            price: prod.price
          }
        ]);
      }
      // Clear pending PO state in store
      storeActions.setPendingNewPO(null);
    }
  }, [storeState.pendingNewPO, storeState.products, storeActions]);

  // Derived list of orders
  const orderedRows = useMemo(() => {
    return [...storeState.purchaseOrders].sort((left, right) => {
      const leftValue = left[sortBy.key];
      const rightValue = right[sortBy.key];
      const comparison = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
      return sortBy.direction === 'asc' ? comparison : -comparison;
    });
  }, [storeState.purchaseOrders, sortBy]);

  const selectedOrder = useMemo(() => {
    return storeState.purchaseOrders.find((order) => order.id === selectedOrderId) || null;
  }, [storeState.purchaseOrders, selectedOrderId]);

  // Supplier info lookup
  const selectedSupplierInfo = useMemo(() => {
    if (!selectedOrder) return null;
    return storeState.suppliers.find(s => s.name === selectedOrder.supplier) || null;
  }, [selectedOrder, storeState.suppliers]);

  const updateSort = (key) => {
    setSortBy((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const handleAddLineItem = () => {
    if (!currentLineProductSku) return;
    const product = storeState.products.find(p => p.sku === currentLineProductSku);
    if (!product) return;

    // Check if item already added
    const existingIndex = addedLines.findIndex(line => line.sku === product.sku);
    if (existingIndex > -1) {
      const updated = [...addedLines];
      updated[existingIndex].qty += parseInt(currentLineQty) || 1;
      setAddedLines(updated);
    } else {
      setAddedLines([
        ...addedLines,
        {
          sku: product.sku,
          name: product.name,
          qty: parseInt(currentLineQty) || 1,
          price: product.price
        }
      ]);
    }
  };

  const handleRemoveLineItem = (index) => {
    setAddedLines(addedLines.filter((_, i) => i !== index));
  };

  const totalFormAmount = useMemo(() => {
    const sum = addedLines.reduce((acc, line) => acc + (line.qty * line.price), 0);
    return `$${sum.toFixed(2)}`;
  }, [addedLines]);

  const handleSaveOrder = async () => {
    if (!formSupplier || !formEta || addedLines.length === 0) return;

    try {
      const saved = await api.post('/api/purchase-orders', {
        supplier_name: formSupplier,
        eta: formEta,
        items: addedLines.map(l => ({
          product_name: l.name,
          product_sku: l.sku,
          quantity: l.qty,
          unit_price: l.price
        }))
      });

      const mapped = {
        ...saved,
        supplier: saved.supplier_name,
        total: parseFloat(saved.total_amount),
        items: (saved.lines || []).map(line => ({
          ...line,
          name: line.product_name,
          sku: line.product_sku,
          qty: line.quantity,
          price: parseFloat(line.unit_price)
        }))
      };

      storeActions.setState({ purchaseOrders: [mapped, ...storeState.purchaseOrders] });

      // Reset Form
      setFormSupplier('');
      setFormEta('');
      setAddedLines([]);
      setIsModalOpen(false);
      setSelectedOrderId(mapped.id);
    } catch (err) {
      alert(err.message || 'Failed to save purchase order');
    }
  };

  const handleMarkReceived = async (order) => {
    if (order.status === 'Delivered') return;
    
    if (!confirm(`Mark Order #${order.id} as Received? This will increase stock counts across Warehouses.`)) {
      return;
    }

    try {
      await api.patch(`/api/purchase-orders/${order.id}/receive`);
      
      storeActions.updatePurchaseOrderStatus(order.id, 'Delivered');

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

      eventBus.emit('purchase-order:received', order);
    } catch (err) {
      alert(err.message || 'Failed to receive purchase order');
    }
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
              <p className="eyebrow">Inbound Supply</p>
              <h3>Loading Purchase Orders...</h3>
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
              <strong>Error Loading Purchase Orders</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchPOsAndSuppliers} className="subtle-button">Retry</button>
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
            <p className="eyebrow">Inbound Supply</p>
            <h3>Purchase Orders commits</h3>
          </div>
        </div>
        {permissions.create_purchase_orders && (
          <button type="button" className="action-button" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Create Order
          </button>
        )}
      </div>

      <div className={`split-layout ${selectedOrder ? 'has-detail' : ''}`}>
        
        {/* Orders Table */}
        <div className="table-shell" style={{ border: '1px solid rgba(122, 92, 62, 0.12)' }}>
          <div className="table-wrap">
            <table className="po-table">
              <thead>
                <tr>
                  {[
                    ['id', 'Order'],
                    ['supplier', 'Supplier'],
                    ['eta', 'ETA Date'],
                    ['total', 'Total Cost'],
                    ['status', 'Status'],
                    ['actions', 'Actions'],
                  ].map(([key, label]) => (
                    <th key={key}>
                      {key !== 'actions' ? (
                        <button className="table-sort" type="button" onClick={() => updateSort(key)}>
                          {label} <ArrowUpDown size={12} />
                        </button>
                      ) : (
                        <span>{label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((order) => (
                  <tr
                    key={order.id}
                    className="clickable-row"
                    onClick={() => setSelectedOrderId(order.id)}
                    style={selectedOrderId === order.id ? { background: 'var(--color-surface-strong)' } : {}}
                  >
                    <td style={{ fontWeight: 700 }}>#{order.id}</td>
                    <td>{order.supplier}</td>
                    <td>{order.eta}</td>
                    <td style={{ fontWeight: 600 }}>${order.total.toFixed(2)}</td>
                    <td>
                      <span className={getStatusClass(order.status)}>{order.status}</span>
                    </td>
                    <td>
                      {permissions.receive_purchase_orders && (
                        <button
                          type="button"
                          className="subtle-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkReceived(order);
                          }}
                          disabled={order.status === 'Delivered'}
                        >
                          {order.status === 'Delivered' ? 'Received' : 'Mark received'}
                        </button>
                      )}
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
              onClick={() => setSelectedOrderId(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            <h4 style={{ fontSize: '1.22rem', margin: '12px 0 4px' }}>Order #{selectedOrder.id}</h4>
            <div className="inline-meta" style={{ marginBottom: 16 }}>
              <span className={getStatusClass(selectedOrder.status)}>{selectedOrder.status}</span>
              <span>ETA: {selectedOrder.eta}</span>
            </div>

            {/* Supplier Section */}
            <div style={{ background: 'rgba(214,195,163,0.12)', padding: 14, borderRadius: 16, marginBottom: 16 }}>
              <p className="eyebrow" style={{ fontSize: '0.7rem', marginBottom: 4 }}>Supplier Contact</p>
              <strong style={{ display: 'block', fontSize: '0.96rem' }}>{selectedOrder.supplier}</strong>
              {selectedSupplierInfo && (
                <div style={{ marginTop: 6, fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                  <div>Contact: {selectedSupplierInfo.contact}</div>
                  <div>Region: {selectedSupplierInfo.region}</div>
                </div>
              )}
            </div>

            {/* Total value */}
            <div className="list-row" style={{ marginBottom: 18 }}>
              <span>Total Commitment</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--color-accent-hover)' }}>${selectedOrder.total.toFixed(2)}</strong>
            </div>

            {/* Line Items Table */}
            <div>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 10 }}>Order Lines</p>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="table-shell" style={{ border: 'none', background: 'transparent' }}>
                  <table style={{ width: '100%', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: 'transparent' }}>
                        <th style={{ padding: '8px 4px' }}>Item</th>
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
                <p style={{ color: 'var(--sand-muted)', fontSize: '0.86rem' }}>No itemized lines recorded for this order.</p>
              )}
            </div>

          </aside>
        )}
      </div>

      {/* Create Purchase Order Modal */}
      {isModalOpen && (
        <div className="overlay" role="presentation" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" role="dialog" onClick={(event) => event.stopPropagation()} style={{ width: '560px' }}>
            <div className="module-header" style={{ marginBottom: 20 }}>
              <div>
                <p className="eyebrow">New Inbound supply</p>
                <h3>Create Purchase Order</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
                <Dropdown
                  label="Supplier"
                  value={formSupplier}
                  onChange={setFormSupplier}
                  options={storeState.suppliers.map(s => ({ label: s.name, value: s.name }))}
                />
                
                <label>
                  <span className="eyebrow">ETA Date</span>
                  <input
                    className="surface-input"
                    type="date"
                    value={formEta}
                    onChange={(e) => setFormEta(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </label>
              </div>

              {/* Line Items Builder */}
              <div style={{ border: '1px solid rgba(122,92,62,0.14)', borderRadius: 16, padding: 14, background: 'rgba(255,250,242,0.3)' }}>
                <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 12 }}>Build Order Lines</p>
                
                {/* Inputs for adding a line */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr auto', gap: 10, alignItems: 'end', marginBottom: 14 }}>
                  <Dropdown
                    label="Choose Product"
                    value={currentLineProductSku}
                    onChange={setCurrentLineProductSku}
                    options={storeState.products.map(p => ({ label: `${p.name} (${p.sku})`, value: p.sku }))}
                  />
                  <label>
                    <span className="eyebrow">Qty</span>
                    <input
                      className="surface-input"
                      type="number"
                      value={currentLineQty}
                      onChange={(e) => setCurrentLineQty(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <button
                    type="button"
                    className="subtle-button"
                    style={{ padding: '11px 16px', borderRadius: 14 }}
                    onClick={handleAddLineItem}
                  >
                    Add
                  </button>
                </div>

                {/* Added lines list */}
                {addedLines.length > 0 ? (
                  <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.6fr 0.8fr auto', gap: 8, paddingBottom: 6, borderBottom: '1px solid rgba(122,92,62,0.1)', fontWeight: 600, fontSize: '0.82rem' }}>
                      <span>Product</span>
                      <span style={{ textAlign: 'center' }}>Qty</span>
                      <span style={{ textAlign: 'right' }}>Total</span>
                      <span></span>
                    </div>
                    {addedLines.map((line, idx) => (
                      <div 
                        key={line.sku} 
                        style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.6fr 0.8fr auto', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid rgba(122,92,62,0.06)', fontSize: '0.84rem' }}
                      >
                        <span style={{ fontWeight: 500 }}>{line.name}</span>
                        <span style={{ textAlign: 'center' }}>{line.qty}</span>
                        <span style={{ textAlign: 'right' }}>${(line.qty * line.price).toFixed(2)}</span>
                        <button
                          type="button"
                          style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                          onClick={() => handleRemoveLineItem(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--sand-muted)', fontSize: '0.84rem', margin: 0, textAlign: 'center', padding: '10px 0' }}>No line items added yet.</p>
                )}
              </div>

              {/* Total amount preview */}
              <div className="list-row" style={{ marginTop: 4 }}>
                <span>Estimated Grand Total</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-accent-hover)' }}>{totalFormAmount}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="subtle-button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                onClick={handleSaveOrder}
                disabled={!formSupplier || !formEta || addedLines.length === 0}
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default PurchaseOrders;
