import { moduleConfig as dashboardConfig } from './Dashboard/moduleConfig';
import { moduleConfig as productsConfig } from './Products/moduleConfig';
import { moduleConfig as stockLevelsConfig } from './StockLevels/moduleConfig';
import { moduleConfig as purchaseOrdersConfig } from './PurchaseOrders/moduleConfig';
import { moduleConfig as salesOrdersConfig } from './SalesOrders/moduleConfig';
import { moduleConfig as cashierConfig } from './Cashier/moduleConfig';
import { moduleConfig as warehousesConfig } from './Warehouses/moduleConfig';
import { moduleConfig as suppliersConfig } from './Suppliers/moduleConfig';
import { moduleConfig as stockMovementsConfig } from './StockMovements/moduleConfig';
import { moduleConfig as reportsConfig } from './Reports/moduleConfig';
import { moduleConfig as userManagementConfig } from './UserManagement/moduleConfig';

export const modules = [
  { ...dashboardConfig, loadComponent: () => import('./Dashboard'), iconKey: 'dashboard' },
  { ...productsConfig, loadComponent: () => import('./Products'), iconKey: 'products' },
  { ...stockLevelsConfig, loadComponent: () => import('./StockLevels'), iconKey: 'stock' },
  { ...purchaseOrdersConfig, loadComponent: () => import('./PurchaseOrders'), iconKey: 'purchase' },
  { ...salesOrdersConfig, loadComponent: () => import('./SalesOrders'), iconKey: 'sales' },
  { ...cashierConfig, loadComponent: () => import('./Cashier'), iconKey: 'cashier' },
  { ...warehousesConfig, loadComponent: () => import('./Warehouses'), iconKey: 'warehouses' },
  { ...suppliersConfig, loadComponent: () => import('./Suppliers'), iconKey: 'suppliers' },
  { ...stockMovementsConfig, loadComponent: () => import('./StockMovements'), iconKey: 'movements' },
  { ...reportsConfig, loadComponent: () => import('./Reports'), iconKey: 'reports' },
  { ...userManagementConfig, loadComponent: () => import('./UserManagement'), iconKey: 'users' },
];
