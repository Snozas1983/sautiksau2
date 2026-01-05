import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Settings, LogOut, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { CalendarTab } from '@/components/admin/CalendarTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { ServicesTab } from '@/components/admin/ServicesTab';

type Tab = 'calendar' | 'services' | 'settings';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>('services');
  const { isAuthenticated, isLoading, logout, getPassword } = useAdminAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/admin');
    }
  }, [isLoading, isAuthenticated, navigate]);
  
  const handleLogout = () => {
    logout();
    navigate('/admin');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Kraunama...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  const adminPassword = getPassword();
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Admin</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </header>
      
      {/* Content */}
      <main className="flex-1 overflow-auto pb-20">
        {activeTab === 'calendar' && adminPassword && (
          <CalendarTab adminPassword={adminPassword} />
        )}
        {activeTab === 'services' && adminPassword && (
          <ServicesTab adminPassword={adminPassword} />
        )}
        {activeTab === 'settings' && adminPassword && (
          <SettingsTab adminPassword={adminPassword} />
        )}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card px-4 py-2 flex justify-around">
        <Button
          variant={activeTab === 'calendar' ? 'secondary' : 'ghost'}
          className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-xs">Kalendorius</span>
        </Button>
        <Button
          variant={activeTab === 'services' ? 'secondary' : 'ghost'}
          className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
          onClick={() => setActiveTab('services')}
        >
          <List className="w-5 h-5" />
          <span className="text-xs">Paslaugos</span>
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
          className="flex-1 flex flex-col items-center gap-1 h-auto py-2"
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="w-5 h-5" />
          <span className="text-xs">Nustatymai</span>
        </Button>
      </nav>
    </div>
  );
};

export default AdminDashboard;
