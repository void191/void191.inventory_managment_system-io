import { useState, useEffect } from 'react';
import { useStore } from '../../core/store';
import { moduleConfig } from './moduleConfig';
import api from '../../api';
import { AlertTriangle } from 'lucide-react';

function occupancyClass(occupancy) {
  if (occupancy < 65) return 'is-success';
  if (occupancy < 80) return 'is-warning';
  return 'is-danger';
}

function Warehouses() {
  const [storeState, storeActions] = useStore();
  const [clickedBin, setClickedBin] = useState(null);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWarehousesAndStock = async () => {
    setLoading(true);
    setError('');
    try {
      const [warehousesData, stockData] = await Promise.all([
        api.get('/api/warehouses'),
        api.get('/api/stock-levels')
      ]);

      const mappedWarehouses = warehousesData.map(w => {
        const whId = w.name.includes('Alpha') ? 'WH-A' : w.name.includes('Beta') ? 'WH-B' : 'WH-C';
        const binLetter = w.name.includes('Alpha') ? 'A' : w.name.includes('Beta') ? 'B' : 'C';

        // Extract products inside this warehouse
        const binView = [];
        let idx = 1;
        stockData.forEach(l => {
          if (l.warehouse_name === w.name && l.on_hand > 0) {
            binView.push({
              bin: `${binLetter}-${String(idx++).padStart(2, '0')}`,
              item: l.product_name,
              qty: l.on_hand
            });
          }
        });

        return {
          id: whId,
          name: w.name,
          location: w.location,
          bins: w.total_bins,
          occupancy: w.occupancy_percent,
          binView
        };
      });

      storeActions.setWarehouses(mappedWarehouses);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load warehouses data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehousesAndStock();
  }, []);

  // Generate bins list for a warehouse
  const getWarehouseBins = (warehouse) => {
    const binsCount = warehouse.bins;
    const prefix = warehouse.id.replace('WH-', '');
    const list = [];

    for (let i = 0; i < binsCount; i++) {
      const binId = `${prefix}-${String(i + 1).padStart(2, '0')}`;
      
      // Match existing spec bins
      const specBin = warehouse.binView.find((b) => b.bin === binId);
      if (specBin) {
        let status = 'is-partial';
        if (specBin.qty >= 120) status = 'is-full';
        else if (specBin.qty >= 50) status = 'is-nearly-full';

        list.push({
          bin: binId,
          item: specBin.item,
          qty: specBin.qty,
          status,
        });
      } else {
        // Fill pseudo-randomly to match warehouse occupancy %
        const isOccupied = ((i * 17 + 5) % 100) < warehouse.occupancy;
        if (isOccupied) {
          const statuses = ['is-partial', 'is-nearly-full', 'is-full'];
          const status = statuses[(i * 3 + 2) % 3];
          
          const itemsList = ['Organic Wheat', 'Yellow Corn', 'Moisture Meters', 'Bag Sealers', 'Poly Bags', 'Stretch Wrap'];
          const item = itemsList[(i * 7) % itemsList.length];
          const qty = status === 'is-full' ? 120 + (i % 40) : status === 'is-nearly-full' ? 45 + (i % 25) : 8 + (i % 12);

          list.push({
            bin: binId,
            item,
            qty,
            status,
          });
        } else {
          list.push({
            bin: binId,
            item: 'None (Empty)',
            qty: 0,
            status: 'is-empty',
          });
        }
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
              <p className="eyebrow">Storage Network</p>
              <h3>Loading Warehouse floor plans...</h3>
            </div>
          </div>
        </div>
        <div className="card stack" style={{ padding: 24, gap: 16, marginTop: 20 }}>
          <div className="skeleton-bar" style={{ width: '100%', height: '50px', borderRadius: 8 }}></div>
          <div className="skeleton-bar" style={{ width: '100%', height: '140px', borderRadius: 8 }}></div>
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
              <strong>Error Loading Warehouses</strong>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchWarehousesAndStock} className="subtle-button">Retry</button>
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
            <p className="eyebrow">Storage Network</p>
            <h3>Warehouse Floor Plan Layouts</h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {storeState.warehouses.map((warehouse) => {
          const bins = getWarehouseBins(warehouse);
          
          return (
            <article key={warehouse.id} className="card floor-plan" style={{ padding: 22 }}>
              
              {/* Warehouse Header info */}
              <div className="floor-plan__header">
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{warehouse.name}</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>{warehouse.location} • {warehouse.bins} total bin slots</p>
                </div>
                
                <div style={{ width: 200 }}>
                  <div className="inline-meta" style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                    <span>Occupancy</span>
                    <strong>{warehouse.occupancy}%</strong>
                  </div>
                  <div className="progress-track" style={{ height: 8 }}>
                    <div
                      className={`progress-fill ${occupancyClass(warehouse.occupancy)}`}
                      style={{ width: `${warehouse.occupancy}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Floor Plan Grid */}
              <div className="bin-grid">
                {bins.map((bin) => (
                  <div
                    key={bin.bin}
                    className={`bin-square ${bin.status}`}
                    onClick={() => setClickedBin(clickedBin === bin.bin ? null : bin.bin)}
                    title={`Bin ${bin.bin}`}
                  >
                    {bin.bin.split('-')[1]}

                    {clickedBin === bin.bin && (
                      <div className="bin-popover">
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4, marginBottom: 4 }}>
                          Bin {bin.bin}
                        </div>
                        <div style={{ fontWeight: 500, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {bin.item}
                        </div>
                        <div style={{ color: '#d6c3a3', fontSize: '0.74rem', marginTop: 2 }}>
                          {bin.qty > 0 ? `${bin.qty} units` : 'Empty slot'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Warehouses;
