import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { LogIn, LogOut, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { airtableApi } from '@/lib/airtable';
import { ServicesTab } from './ServicesTab';

export function AdminQuickPanel() {
  const [searchParams] = useSearchParams();
  const showPanel = searchParams.get('admin') === '1';
  
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  if (!showPanel) return null;

  const handleLogin = async () => {
    if (!password.trim()) {
      toast.error('Įveskite slaptažodį');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await airtableApi('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (result.success) {
        setIsLoggedIn(true);
        setAdminPassword(password);
        toast.success('Prisijungta');
      } else {
        toast.error('Neteisingas slaptažodis');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Klaida';
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAdminPassword(null);
    setPassword('');
    toast.success('Atsijungta');
  };

  if (!isPanelOpen) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setIsPanelOpen(true)}
        >
          Admin
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card border-b border-border shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">🔧 Admin Quick Panel</span>
          
          {!isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="Slaptažodis"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-40 h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleLogin}
                disabled={isLoggingIn}
              >
                <LogIn className="w-4 h-4 mr-1" />
                Prisijungti
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary">✓ Prisijungta</span>
              <Link to="/admin/dashboard">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Pilnas admin
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                Atsijungti
              </Button>
            </div>
          )}
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setIsPanelOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Services table (shown when logged in) */}
      {isLoggedIn && adminPassword && (
        <div className="max-h-[60vh] overflow-auto">
          <ServicesTab adminPassword={adminPassword} />
        </div>
      )}
    </div>
  );
}
