import { useState, useEffect } from 'react';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';
import { AlertTriangle } from 'lucide-react';

function getHealth(available) {
  if (available >= 700) return { label: 'Healthy', fill: 'is-success', badge: 'badge badge--success' };
  if (available >= 300) return { label: 'Watch', fill: 'is-warning', badge: 'badge badge--warning' };
  return { label: 'Critical', fill: 'is-danger', badge: 'badge badge--danger' };
}

function StockLevels({ eventBus }) {
  const [storeState, storeActions] = useStore();
  const [hoveredSquare, setHoveredSquare] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStockLevels = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/stock-levels');
      
      // Aggregate detailed product-level levels by warehouse name
      const aggregates = {};
      data.forEach(l => {
        const wh = l.warehouse_name;
        if (!aggregates[wh]) {
          aggregates[wh] = { warehouse: wh, onHand: 0, reserved: 0, available: 0 };
        }
        aggregates[wh].onHand += parseInt(l.on_hand) || 0;
        aggregates[wh].reserved += parseInt(l.reserved) || 0;
        aggregates[wh].available += parseInt(l.available) || 0;
      });

      const mappedLevels = Object.values(aggregates);
      storeActions.setStockLevels(mappedLevels);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load stock levels');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockLevels();
  }, []);

  // Convert stock numbers into a grid of 40 allocation squares
  const getAllocationSquares = (item) => {
    const totalSquares = 40;
    const totalStock = item.onHand || 1; // avoid divide by zero
    const reservedRatio = item.reserved / totalStock;
    
    const reservedCount = Math.round(totalSquares * reservedRatio);
    const availableCount = totalSquares - reservedCount;

    const list = [];
    for (let i = 0; i < totalSquares; i++) {
      if (i < reservedCount) {
        list.push({
          id: `${item.warehouse}-sq-${i}`,
          type: 'Reserved',
          status: 'reserved',
          qty: Math.round(item.reserved / (reservedCount || 1))
        });
      } else {
        list.push({
          id: `${item.warehouse}-sq-${i}`,
          type: 'Available',
          status: 'available',
          qty: Math.round(item.available / (availableCount || 1))
        });
      }
    }
    return list;
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
              <p className="eyebrow">Warehouse Availability</p>
              <h3>Loading Stock Allocation Maps...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '50px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '80px', borderRadius: 8 }}></div>
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
              <strong>Error Loading Stock Levels</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchStockLevels} className="subtle-button">Retry</button>
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
            <p className="eyebrow">Warehouse Availability</p>
            <h3>Live Balance & Allocation Maps</h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {storeState.stockLevels.map((item) => {
          const health = getHealth(item.available);
          const squares = getAllocationSquares(item);
          const allocationPct = Math.round((item.available / (item.onHand || 1)) * 100);

          return (
            <article 
              key={item.warehouse} 
              className="card floor-plan" 
              style={{ padding: 22 }}
              onMouseEnter={() => {
                if (health.label === 'Critical') {
                  eventBus.emit('inventory:critical', {
                    message: `${item.warehouse} availability is critical at ${item.available} units. Replenish immediately.`,
                  });
                }
              }}
            >
              {/* Header section */}
              <div className="floor-plan__header">
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{item.warehouse}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>
                    Balance: <strong>{item.onHand}</strong> total on hand • {item.reserved} reserved • {item.available} available
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span className={health.badge}>{health.label}</span>
                  <div style={{ width: 140 }}>
                    <div className="progress-track" style={{ height: 8 }}>
                      <div
                        className={`progress-fill ${health.fill}`}
                        style={{ width: `${allocationPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Allocation grid */}
              <div className="bin-grid" style={{ gridTemplateColumns: 'repeat(20, 1fr)', background: 'rgba(77, 143, 87, 0.05)' }}>
                {squares.map((sq) => {
                  const isHovered = hoveredSquare === sq.id;
                  const bg = sq.status === 'reserved' ? '#C2A27C' : '#4D8F57';
                  
                  return (
                    <div
                      key={sq.id}
                      className="bin-square"
                      style={{
                        backgroundColor: bg,
                        border: '1px solid rgba(255,255,255,0.25)',
                        aspectRatio: 1,
                        borderRadius: 4
                      }}
                      onMouseEnter={() => setHoveredSquare(sq.id)}
                      onMouseLeave={() => setHoveredSquare(null)}
                    >
                      {isHovered && (
                        <div className="bin-popover">
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4, marginBottom: 4 }}>
                            {sq.type} Stock Block
                          </div>
                          <div>Approx. {sq.qty} units</div>
                          <div style={{ fontSize: '0.74rem', color: '#d6c3a3' }}>Allocation block</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default StockLevels;
