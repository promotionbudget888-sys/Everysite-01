import { FileText, Users, ClipboardList, History, LogOut, Settings, Trophy, Upload } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleLabel } from '@/lib/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getMenuItems = () => {
    if (profile?.role === 'requester') {
      return [
        { title: 'คำขอของฉัน', url: '/my-requests', icon: FileText },
        { title: 'สร้างคำขอใหม่', url: '/create-request', icon: ClipboardList },
        { title: 'รายงานผลงานการแข่งขัน', url: '/competition-report', icon: Trophy, external: 'https://script.google.com/macros/s/AKfycbyfxI21pwP7sTtsDbYvL-6se65LPYvdNtpqdfnZT1Kd5R9m6vT8XzrB1WOqL-n4ESXI/exec' },
        { title: 'ส่งเอกสารผลงาน', url: '/submit-document', icon: Upload, external: 'https://script.google.com/macros/s/AKfycbxQVp83myUBth_YxBgjRlwrDelU6PBtm9gR-SyFwgqbtAa788xWHoujET0cE52KnHPL/exec' },
      ];
    }

    if (profile?.role === 'zone_approver_1') {
      return [
        { title: 'รออนุมัติ (Level 1)', url: '/pending-approvals', icon: ClipboardList },
        { title: 'ประวัติการอนุมัติ', url: '/approval-history', icon: History },
      ];
    }

    if (profile?.role === 'zone_approver_2') {
      return [
        { title: 'รออนุมัติ (Level 2)', url: '/pending-approvals', icon: ClipboardList },
        { title: 'ประวัติการอนุมัติ', url: '/approval-history', icon: History },
      ];
    }

    if (profile?.role === 'admin') {
      return [
        { title: 'คำขอทั้งหมด', url: '/all-requests', icon: FileText },
        { title: 'จัดการผู้ใช้', url: '/users', icon: Users },
        // ✅ ลบ จัดการโซน ออกแล้ว
        { title: 'ประวัติการใช้งาน', url: '/audit-logs', icon: History },
        { title: 'ตั้งค่าระบบ', url: '/settings', icon: Settings },
      ];
    }

    return [];
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">งบส่งเสริม</h1>
            <p className="text-xs text-sidebar-muted">Everysite Funds</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted">เมนูหลัก</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => {
                      if ('external' in item && item.external) {
                        window.open(item.external as string, '_blank');
                      } else {
                        navigate(item.url);
                      }
                    }}
                    isActive={location.pathname === item.url}
                    className="transition-colors"
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'ผู้ใช้งาน'}
            </p>
            <Badge variant="outline" className="text-xs bg-sidebar-accent border-sidebar-border text-sidebar-muted">
              {profile?.role ? getRoleLabel(profile.role) : 'ไม่ระบุ'}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          ออกจากระบบ
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}