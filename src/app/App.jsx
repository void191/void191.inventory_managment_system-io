import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChevronLeft, LogOut } from 'lucide-react';
import eventBus from '../core/eventBus';
import { modules } from '../modules';
import Login from '../modules/Login';

// Pre-create lazy components statically so their identities do not change on re-render
const lazyComponents = {};
modules.forEach((module) => {
  lazyComponents[module.route] = lazy(module.loadComponent);
});

// Sidebar link with static Lucide icon
function SidebarLink({ module }) {
  const IconComponent = module.icon;

  return (
    <NavLink
      to={module.route}
      className={({ isActive }) => `sidebar__item ${isActive ? 'is-active' : ''}`}
    >
      <div className="sidebar__icon-slot">
        {IconComponent && <IconComponent size={20} strokeWidth={1.5} />}
      </div>
      <span className="sidebar__label">{module.name}</span>
    </NavLink>
  );
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Reactive state hooks for authorization and permissions
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState(localStorage.getItem('role'));
  const [permissionsVal, setPermissionsVal] = useState(localStorage.getItem('permissions'));

  // Sync auth state on route changes to prevent blank screen after login
  useEffect(() => {
    setToken(localStorage.getItem('token'));
    setUserRole(localStorage.getItem('role'));
    setPermissionsVal(localStorage.getItem('permissions'));
  }, [location.pathname]);

  // Authentication guards
  if (!token && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (token && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  if (location.pathname === '/login') {
    return <Login />;
  }

  // Parse user permissions
  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(permissionsVal || '{}');
    } catch {
      return {};
    }
  }, [permissionsVal]);

  const routeToPermissionKey = {
    '/dashboard': 'view_dashboard',
    '/products': 'view_products',
    '/stock-levels': 'view_stock_levels',
    '/purchase-orders': 'view_purchase_orders',
    '/sales-orders': 'view_sales_orders',
    '/cashier': 'view_cashier',
    '/warehouses': 'view_warehouses',
    '/suppliers': 'view_suppliers',
    '/stock-movements': 'view_stock_movements',
    '/reports': 'view_reports',
    '/users': 'view_users'
  };

  // URL routing guards based on granular permissions
  if (token) {
    const routeKey = routeToPermissionKey[location.pathname];
    if (routeKey && userPermissions[routeKey] === false) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Pre-load all module chunks at application startup
  useEffect(() => {
    if (token) {
      modules.forEach((module) => {
        module.loadComponent().catch((err) => console.error('Preload failed for', module.name, err));
      });
    }
  }, [token]);

  // Listen to screen size to auto-collapse sidebar at 1024px
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentModule = useMemo(() => {
    return modules.find((module) => module.route === location.pathname) ?? modules[0];
  }, [location.pathname]);

  useEffect(() => {
    if (currentModule) {
      eventBus.emit('navigation:changed', {
        route: location.pathname,
        moduleName: currentModule.name,
      });
    }
  }, [currentModule, location.pathname]);

  // Filter sidebar navigation by granular user permissions
  const visibleModules = useMemo(() => {
    return modules.filter((m) => {
      const key = routeToPermissionKey[m.route];
      return key ? !!userPermissions[key] : true;
    });
  }, [userPermissions]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar__brand">
          <div className="sidebar__brand-mark" aria-hidden="true">
            <svg viewBox="0 0 68 56" className="brand-logo" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="14" width="26" height="26" rx="8" transform="rotate(-10 10 14)" fill="#A67C52" />
              <rect x="28" y="12" width="26" height="26" rx="8" transform="rotate(10 28 12)" fill="#D6C3A3" />
            </svg>
          </div>
          <div className="sidebar__brand-text">
            <h1>Grainhouse</h1>
          </div>
        </div>

        <button
          type="button"
          className={`sidebar__toggle ${sidebarCollapsed ? 'is-collapsed' : ''}`}
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label="Toggle navigation"
        >
          <ChevronLeft size={18} />
        </button>

        <nav className="sidebar__nav" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleModules.map((module) => (
              <SidebarLink key={module.route} module={module} />
            ))}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="sidebar__item"
            style={{
              marginTop: 'auto',
              background: 'transparent',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div className="sidebar__icon-slot">
              <LogOut size={20} strokeWidth={1.5} />
            </div>
            <span className="sidebar__label">Logout</span>
          </button>
        </nav>
      </aside>

      <div className="content-shell">
        <main key={location.pathname} className="page-frame route-fade">
          <Routes>
            <Route path="/" element={<Navigate to={modules[0].route} replace />} />
            {modules.map((module) => {
              const ModuleComponent = lazyComponents[module.route];

              return (
                <Route
                  key={module.route}
                  path={module.route}
                  element={
                    <Suspense fallback={null}>
                      <ModuleComponent eventBus={eventBus} moduleConfig={module} />
                    </Suspense>
                  }
                />
              );
            })}
            <Route path="*" element={<Navigate to={modules[0].route} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
