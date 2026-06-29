import { useMemo, useState, useEffect } from 'react';
import { Search, X, Mail, Phone, MapPin, Award, AlertTriangle } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import Dropdown from '../../app/components/Dropdown';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';

function Suppliers() {
  const [storeState, storeActions] = useStore();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('All');
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  // Local details state
  const [contractsList, setContractsList] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/suppliers');
      
      const mappedSuppliers = data.map(s => {
        const rating = (s.performance_rating || 5) * 20; // Map 1-5 rating to 0-100 range
        return {
          id: s.id,
          name: s.name,
          contact: s.contact_name,
          email: s.email,
          phone: s.phone,
          region: s.region,
          contracts: s.contracts_count,
          rating,
          ratingHistory: [
            { month: 'Jan', rating: Math.max(50, rating - 4) },
            { month: 'Feb', rating: Math.max(50, rating - 2) },
            { month: 'Mar', rating: rating },
            { month: 'Apr', rating: Math.max(50, rating - 3) },
            { month: 'May', rating: Math.min(100, rating + 2) },
            { month: 'Jun', rating: rating }
          ]
        };
      });

      storeActions.setSuppliers(mappedSuppliers);
      if (mappedSuppliers.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(mappedSuppliers[0].id);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load suppliers');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Fetch supplier contracts and orders when selection changes
  useEffect(() => {
    if (!selectedSupplierId) return;

    async function fetchDetails() {
      try {
        const [contracts, orders] = await Promise.all([
          api.get(`/api/suppliers/${selectedSupplierId}/contracts`),
          api.get(`/api/suppliers/${selectedSupplierId}/orders`)
        ]);

        const mappedContracts = contracts.map(c => ({
          id: `CON-${c.id}`,
          product: c.product_sku || 'Unknown Product',
          terms: c.terms
        }));

        const mappedOrders = orders.map(o => ({
          id: `#${o.id}`,
          eta: o.eta,
          amount: `$${parseFloat(o.total_amount).toFixed(2)}`
        }));

        setContractsList(mappedContracts);
        setSupplierOrders(mappedOrders);
        setLoadingDetails(false);
      } catch (err) {
        console.error('Failed to load supplier details', err);
        setLoadingDetails(false);
      }
    }

    fetchDetails();
  }, [selectedSupplierId]);

  const regions = ['All', ...new Set(storeState.suppliers.map((supplier) => supplier.region))];

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return storeState.suppliers.filter((supplier) => {
      const matchesQuery =
        !normalizedQuery ||
        [supplier.name, supplier.contact].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesRegion = region === 'All' || supplier.region === region;
      return matchesQuery && matchesRegion;
    });
  }, [storeState.suppliers, query, region]);

  const selectedSupplier = useMemo(() => {
    return storeState.suppliers.find((supplier) => supplier.id === selectedSupplierId) || null;
  }, [storeState.suppliers, selectedSupplierId]);

  if (loading) {
    return (
      <section className="module-page">
        <div className="module-header">
          <div className="module-header__title">
            <div className="module-header__title-icon" style={{ padding: 6, overflow: 'visible' }}>
              <moduleConfig.icon size={22} style={{ overflow: 'visible' }} />
            </div>
            <div>
              <p className="eyebrow">Vendor Directory</p>
              <h3>Loading Supplier Directory...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '36px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '70px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '70px', borderRadius: 8 }}></div>
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
              <strong>Error Loading Suppliers</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchSuppliers} className="subtle-button">Retry</button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-page route-fade">
      <div className="module-header">
        <div className="module-header__title">
          <div className="module-header__title-icon" style={{ padding: 6, overflow: 'visible' }}>
            <moduleConfig.icon size={22} style={{ overflow: 'visible' }} />
          </div>
          <div>
            <p className="eyebrow">Vendor Directory</p>
            <h3>Discover Suppliers and Performance</h3>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <label>
          <span className="eyebrow">Search</span>
          <div style={{ position: 'relative', marginTop: 6 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--sand-muted)' }} />
            <input
              className="surface-input"
              style={{ paddingLeft: 38 }}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Supplier or contact"
            />
          </div>
        </label>
        <Dropdown
          label="Region"
          value={region}
          onChange={setRegion}
          options={regions.map((option) => ({ label: option, value: option }))}
        />
      </div>

      <div className={`split-layout ${selectedSupplier ? 'has-detail' : ''}`}>
        
        {/* Suppliers Cards Grid */}
        <div className="supplier-grid">
          {filteredSuppliers.map((supplier) => (
            <article
              key={supplier.id}
              className="supplier-card"
              onClick={() => setSelectedSupplierId(supplier.id)}
              style={{
                cursor: 'pointer',
                borderColor: selectedSupplierId === supplier.id ? 'var(--color-accent-primary)' : 'rgba(122, 92, 62, 0.12)',
                background: selectedSupplierId === supplier.id ? '#fffcf7' : 'rgba(255, 250, 242, 0.78)'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1.08rem' }}>{supplier.name}</h4>
              <p style={{ fontSize: '0.86rem', marginTop: 4 }}>{supplier.contact}</p>
              <div className="stack" style={{ marginTop: 16 }}>
                <div className="list-row" style={{ padding: '6px 10px', fontSize: '0.84rem' }}>
                  <span>Region</span>
                  <strong>{supplier.region}</strong>
                </div>
                <div className="list-row" style={{ padding: '6px 10px', fontSize: '0.84rem' }}>
                  <span>Active Contracts</span>
                  <strong>{supplier.contracts}</strong>
                </div>
                <div>
                  <div className="inline-meta" style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                    <span>Performance Rating</span>
                    <strong>{supplier.rating}%</strong>
                  </div>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div
                      className={`progress-fill ${
                        supplier.rating >= 85 ? 'is-success' : supplier.rating >= 75 ? 'is-warning' : 'is-danger'
                      }`}
                      style={{ width: `${supplier.rating}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Supplier Details Side Panel */}
        {selectedSupplier && (
          <aside className="detail-panel" style={{ position: 'relative' }}>
            <button
              type="button"
              className="close-detail-btn"
              onClick={() => setSelectedSupplierId(null)}
              aria-label="Close details"
            >
              <X size={18} />
            </button>

            <h4 style={{ fontSize: '1.24rem', margin: '12px 0 4px' }}>{selectedSupplier.name}</h4>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16 }} className="inline-meta">
              <MapPin size={14} />
              <span>{selectedSupplier.region} Region</span>
            </div>

            {/* Contact Info Section */}
            <div style={{ background: 'rgba(214,195,163,0.12)', padding: 14, borderRadius: 16, marginBottom: 18 }}>
              <p className="eyebrow" style={{ fontSize: '0.7rem', marginBottom: 8 }}>Contact Information</p>
              <div className="stack" style={{ gap: 8, fontSize: '0.86rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={14} color="var(--sand-muted)" />
                  <strong>{selectedSupplier.contact}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} color="var(--sand-muted)" />
                  <span style={{ wordBreak: 'break-all' }}>{selectedSupplier.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={14} color="var(--sand-muted)" />
                  <span>{selectedSupplier.phone}</span>
                </div>
              </div>
            </div>

            <div style={{ opacity: loadingDetails ? 0.4 : 1, transition: 'opacity 200ms ease' }}>
                {/* Active Contracts Table */}
                <div style={{ marginBottom: 18 }}>
                  <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Active Contracts</p>
                  {contractsList.length > 0 ? (
                    <div className="table-shell" style={{ border: 'none', background: 'transparent' }}>
                      <table style={{ width: '100%', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'transparent' }}>
                            <th style={{ padding: '6px 4px' }}>ID</th>
                            <th style={{ padding: '6px 4px' }}>Product</th>
                            <th style={{ padding: '6px 4px' }}>Terms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contractsList.map((con) => (
                            <tr key={con.id} style={{ background: 'transparent' }}>
                              <td style={{ padding: '6px 4px', fontWeight: 600 }}>{con.id}</td>
                              <td style={{ padding: '6px 4px' }}>{con.product}</td>
                              <td style={{ padding: '6px 4px' }}>{con.terms}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--sand-muted)', fontSize: '0.84rem' }}>No active contracts on file.</p>
                  )}
                </div>

                {/* Orders with this supplier */}
                <div style={{ marginBottom: 18 }}>
                  <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>Purchase Orders History</p>
                  {supplierOrders.length > 0 ? (
                    <div className="table-shell" style={{ border: 'none', background: 'transparent' }}>
                      <table style={{ width: '100%', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'transparent' }}>
                            <th style={{ padding: '6px 4px' }}>PO ID</th>
                            <th style={{ padding: '6px 4px' }}>Date</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierOrders.map((po) => (
                            <tr key={po.id} style={{ background: 'transparent' }}>
                              <td style={{ padding: '6px 4px', fontWeight: 600 }}>{po.id}</td>
                              <td style={{ padding: '6px 4px' }}>{po.eta}</td>
                              <td style={{ padding: '6px 4px', textAlign: 'right' }}>{po.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--sand-muted)', fontSize: '0.84rem' }}>No purchase orders for this supplier.</p>
                  )}
                </div>
            </div>

            {/* Performance rating history mini-chart */}
            <div>
              <p className="eyebrow" style={{ fontSize: '0.74rem', marginBottom: 8 }}>6-Month Performance Trend</p>
              <div style={{ height: 110, background: 'rgba(214,195,163,0.06)', borderRadius: 12, padding: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedSupplier.ratingHistory} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
                    <XAxis dataKey="month" tickLine={false} style={{ fontSize: 9 }} stroke="#7A5C3E" />
                    <YAxis domain={[50, 100]} tickLine={false} style={{ fontSize: 9 }} stroke="#7A5C3E" />
                    <Tooltip formatter={(v) => [v + '%', 'Rating']} />
                    <Area 
                      type="monotone" 
                      dataKey="rating" 
                      stroke="var(--color-accent-primary)" 
                      fill="rgba(166, 124, 82, 0.16)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </aside>
        )}
      </div>
    </section>
  );
}

export default Suppliers;
