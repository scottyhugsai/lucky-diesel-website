import {
  BarChart3, Bell, CalendarDays, Car, ClipboardCheck, ClipboardList, Clock, CreditCard, FileText, Gauge, Home, Images,
  Inbox, LayoutDashboard, MessageSquare, Package, Receipt, Settings, Smartphone, Truck, Users, Workflow, Wrench, Zap,
} from 'lucide-react';

/** Icons available to app navigation. Add here (not a namespace import) to keep bundles small. */
export const NAV_ICONS = {
  BarChart3, Bell, CalendarDays, Car, ClipboardCheck, ClipboardList, Clock, CreditCard, FileText, Gauge, Home, Images,
  Inbox, LayoutDashboard, MessageSquare, Package, Receipt, Settings, Smartphone, Truck, Users, Workflow, Wrench, Zap,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
