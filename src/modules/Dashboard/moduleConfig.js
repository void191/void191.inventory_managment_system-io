import { LayoutDashboard } from 'lucide-react';

export const moduleConfig = {
  name: 'Dashboard',
  route: '/dashboard',
  icon: LayoutDashboard,
  mockData: {
    stockTrend: [
      { name: 'Mon', value: 340 },
      { name: 'Tue', value: 310 },
      { name: 'Wed', value: 380 },
      { name: 'Thu', value: 340 },
      { name: 'Fri', value: 420 },
      { name: 'Sat', value: 385 },
      { name: 'Sun', value: 450 },
    ]
  },
};
