import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  ClipboardCheck,
  FileText,
  FileSearch,
  Heart,
  Home,
  MessageSquare,
  MessageCircle,
  Settings,
  Scale,
  Shield,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const careItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, exact: true },
  { title: "Residents", url: "/residents", icon: Users },
  { title: "Care Plans", url: "/care-plans", icon: FileText },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Daily Notes", url: "/notes", icon: MessageSquare },
  { title: "Calendar", url: "/calendar", icon: Calendar },
] as const;

const systemItems = [
  { title: "Alerts", url: "/alerts", icon: AlertTriangle },
  { title: "Family", url: "/family", icon: Heart },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

const governanceItems = [
  { title: "Audits", url: "/audits", icon: ClipboardCheck },
  { title: "Feedback", url: "/feedback", icon: MessageCircle },
  { title: "Regulatory", url: "/regulatory", icon: Scale },
  { title: "Incident Review", url: "/incident-review", icon: FileSearch },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const renderItem = (item: { title: string; url: string; icon: typeof Home; exact?: boolean }) => {
    const active = isActive(item.url, item.exact);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={active}>
          <Link
            to={item.url}
            className={cn(
              "flex items-center gap-2 transition-colors",
              active
                ? "bg-nav-navy text-nav-navy-foreground font-medium hover:bg-nav-navy hover:text-nav-navy-foreground"
                : "text-nav-navy hover:bg-nav-navy-hover hover:text-nav-navy-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Heart className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">CareCore</h2>
              <p className="truncate text-[11px] text-muted-foreground">Person-Centred Care</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-nav-navy font-semibold">Care Management</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{careItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-nav-navy font-semibold">Governance</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{governanceItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-nav-navy font-semibold">System</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{systemItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
