import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { airtableApi } from '@/lib/airtable';
import { toast } from 'sonner';

interface SettingsTabProps {
  adminPassword: string;
}

interface SettingsData {
  'M-F Start': string;
  'M-F Finish': string;
  'break_between': string;
  'booking_days_ahead': string;
  'deposit_amount': string;
  'cancel_hours_before': string;
}

export function SettingsTab({ adminPassword }: SettingsTabProps) {
  const [formData, setFormData] = useState<Partial<SettingsData>>({});
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const data = await airtableApi('/admin/settings', {}, adminPassword);
      return data.settings as Record<string, string>;
    },
  });
  
  useEffect(() => {
    if (settings) {
      setFormData({
        'M-F Start': settings['M-F Start'] || '09:00',
        'M-F Finish': settings['M-F Finish'] || '18:00',
        'break_between': settings['break_between'] || '15',
        'booking_days_ahead': settings['booking_days_ahead'] || '60',
        'deposit_amount': settings['deposit_amount'] || '10',
        'cancel_hours_before': settings['cancel_hours_before'] || settings['Canselation time'] || '24',
      });
    }
  }, [settings]);
  
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      await airtableApi('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }, adminPassword);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Nustatymai išsaugoti');
    },
    onError: () => {
      toast.error('Klaida saugant nustatymus');
    },
  });

  const syncServicesMutation = useMutation({
    mutationFn: async () => {
      const result = await airtableApi('/admin/sync-services', {
        method: 'POST',
      }, adminPassword);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Sinchronizuota ${data.synced}/${data.total} paslaugų (${data.errors.length} klaidos)`);
      } else {
        toast.success(`Sėkmingai sinchronizuota ${data.synced} paslaugos`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Klaida sinchronizuojant: ${error.message}`);
    },
  });
  
  const handleSave = () => {
    saveMutation.mutate(formData as Record<string, string>);
  };
  
  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Kraunama...
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* Working Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Darbo laikas (Pr-Pn)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pradžia</Label>
              <Input
                type="time"
                value={formData['M-F Start'] || ''}
                onChange={(e) => setFormData({ ...formData, 'M-F Start': e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pabaiga</Label>
              <Input
                type="time"
                value={formData['M-F Finish'] || ''}
                onChange={(e) => setFormData({ ...formData, 'M-F Finish': e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Booking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rezervacijos nustatymai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pertrauka tarp klientų (min)</Label>
            <Input
              type="number"
              value={formData['break_between'] || ''}
              onChange={(e) => setFormData({ ...formData, 'break_between': e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Kiek dienų į priekį galima rezervuoti</Label>
            <Input
              type="number"
              value={formData['booking_days_ahead'] || ''}
              onChange={(e) => setFormData({ ...formData, 'booking_days_ahead': e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Avanso suma (EUR)</Label>
            <Input
              type="number"
              value={formData['deposit_amount'] || ''}
              onChange={(e) => setFormData({ ...formData, 'deposit_amount': e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Atšaukimo limitas (val. prieš vizitą)</Label>
            <Input
              type="number"
              value={formData['cancel_hours_before'] || ''}
              onChange={(e) => setFormData({ ...formData, 'cancel_hours_before': e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Services Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paslaugų sinchronizacija</CardTitle>
          <CardDescription>
            Atnaujinti paslaugų sąrašą iš Airtable į duomenų bazę
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => syncServicesMutation.mutate()}
            disabled={syncServicesMutation.isPending}
            variant="outline"
            className="w-full"
          >
            {syncServicesMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atnaujinti paslaugas
          </Button>
        </CardContent>
      </Card>
      
      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        className="w-full" 
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Išsaugoti
      </Button>
    </div>
  );
}
