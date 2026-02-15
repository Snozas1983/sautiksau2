import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { airtableApi } from '@/lib/airtable';
import { toast } from 'sonner';

const Admin = () => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdminAuth();
  
  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/admin/dashboard');
    return null;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast.error('Įveskite slaptažodį');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await airtableApi('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      
      if (result.success) {
        login(password);
        toast.success('Sėkmingai prisijungėte');
        navigate('/admin/dashboard');
      } else {
        toast.error('Neteisingas slaptažodis');
      }
    } catch {
      toast.error('Klaida tikrinant slaptažodį');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Grįžti
        </Button>
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-medium text-foreground">Admin</h1>
          <p className="text-muted-foreground mt-2">Įveskite slaptažodį</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Slaptažodis"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-center text-lg"
            autoFocus
          />
          
          <Button 
            type="submit" 
            className="w-full h-12"
            disabled={isLoading}
          >
            {isLoading ? 'Tikrinama...' : 'Prisijungti'}
          </Button>
        </form>
        
        <div className="text-center mt-4">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            onClick={async () => {
              try {
                const result = await airtableApi('/admin/forgot-password', {
                  method: 'POST',
                });
                if (result.success) {
                  toast.success('Nuoroda išsiųsta į el. paštą');
                }
              } catch {
                toast.error('Nepavyko išsiųsti el. laiško');
              }
            }}
          >
            Pamiršau slaptažodį
          </button>
        </div>
      </div>
    </div>
  );
};

export default Admin;
