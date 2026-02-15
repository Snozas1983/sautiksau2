import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { airtableApi } from '@/lib/airtable';
import { toast } from 'sonner';

const PASSWORD_RULES = [
  { label: 'Mažiausiai 8 simboliai', test: (p: string) => p.length >= 8 },
  { label: 'Bent viena didžioji raidė', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Bent viena mažoji raidė', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Bent vienas skaičius', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Bent vienas specialus simbolis', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

const AdminResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const ruleResults = useMemo(() => PASSWORD_RULES.map(r => ({ ...r, passed: r.test(password) })), [password]);
  const allPassed = ruleResults.every(r => r.passed);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">Netinkama nuoroda</p>
        <Button variant="ghost" onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Grįžti į prisijungimą
        </Button>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-medium mb-2">Slaptažodis pakeistas</h1>
        <p className="text-muted-foreground mb-6">Galite prisijungti su nauju slaptažodžiu</p>
        <Button onClick={() => navigate('/admin')}>Prisijungti</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPassed || !passwordsMatch) return;

    setIsLoading(true);
    try {
      const result = await airtableApi('/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (result.success) {
        setIsDone(true);
        toast.success('Slaptažodis sėkmingai pakeistas');
      }
    } catch {
      toast.error('Nepavyko pakeisti slaptažodžio. Nuoroda gali būti pasibaigusi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Grįžti
        </Button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-medium text-foreground">Naujas slaptažodis</h1>
          <p className="text-muted-foreground mt-2">Įveskite naują admin slaptažodį</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="password"
              placeholder="Naujas slaptažodis"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12"
              autoFocus
            />
          </div>

          {password.length > 0 && (
            <div className="space-y-1.5 text-sm">
              {ruleResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  {r.passed ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={r.passed ? 'text-foreground' : 'text-muted-foreground'}>{r.label}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <Input
              type="password"
              placeholder="Pakartokite slaptažodį"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-sm text-destructive mt-1">Slaptažodžiai nesutampa</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12"
            disabled={isLoading || !allPassed || !passwordsMatch}
          >
            {isLoading ? 'Keičiama...' : 'Pakeisti slaptažodį'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminResetPassword;
