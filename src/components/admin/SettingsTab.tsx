import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { airtableApi } from '@/lib/airtable';
import { toast } from 'sonner';

interface SettingsTabProps {
  adminPassword: string;
}

interface SettingsData {
  work_start: string;
  work_end: string;
  break_between: string;
  booking_days_ahead: string;
  deposit_amount: string;
  cancel_hours_before: string;
  max_bookings_per_phone: string;
  max_bookings_per_email: string;
  email_logo_url: string;
  // Contact information
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_facebook: string;
  contact_instagram: string;
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
        work_start: settings['work_start'] || '09:00',
        work_end: settings['work_end'] || '18:00',
        break_between: settings['break_between'] || '0',
        booking_days_ahead: settings['booking_days_ahead'] || '60',
        deposit_amount: settings['deposit_amount'] || '10',
        cancel_hours_before: settings['cancel_hours_before'] || '24',
        max_bookings_per_phone: settings['max_bookings_per_phone'] || '4',
        max_bookings_per_email: settings['max_bookings_per_email'] || '4',
        email_logo_url: settings['email_logo_url'] || '',
        // Contact information
        contact_name: settings['contact_name'] || '',
        contact_phone: settings['contact_phone'] || '+37062082478',
        contact_email: settings['contact_email'] || 'info@sautiksau.lt',
        contact_facebook: settings['contact_facebook'] || 'https://www.facebook.com/sautiksau',
        contact_instagram: settings['contact_instagram'] || 'https://www.instagram.com/sautiksaumasazas/',
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
                value={formData.work_start || ''}
                onChange={(e) => setFormData({ ...formData, work_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Pabaiga</Label>
              <Input
                type="time"
                value={formData.work_end || ''}
                onChange={(e) => setFormData({ ...formData, work_end: e.target.value })}
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
              value={formData.break_between || ''}
              onChange={(e) => setFormData({ ...formData, break_between: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Kiek dienų į priekį galima rezervuoti</Label>
            <Input
              type="number"
              value={formData.booking_days_ahead || ''}
              onChange={(e) => setFormData({ ...formData, booking_days_ahead: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Avanso suma (EUR)</Label>
            <Input
              type="number"
              value={formData.deposit_amount || ''}
              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Atšaukimo limitas (val. prieš vizitą)</Label>
            <Input
              type="number"
              value={formData.cancel_hours_before || ''}
              onChange={(e) => setFormData({ ...formData, cancel_hours_before: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Anti-abuse Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Apsauga nuo piktnaudžiavimo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Maks. aktyvių rezervacijų su vienu tel. nr.</Label>
            <Input
              type="number"
              min="1"
              value={formData.max_bookings_per_phone || ''}
              onChange={(e) => setFormData({ ...formData, max_bookings_per_phone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Riboja kiek neįvykusių rezervacijų gali turėti vienas telefono numeris
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Maks. aktyvių rezervacijų su vienu el. paštu</Label>
            <Input
              type="number"
              min="1"
              value={formData.max_bookings_per_email || ''}
              onChange={(e) => setFormData({ ...formData, max_bookings_per_email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Riboja kiek neįvykusių rezervacijų gali turėti vienas el. paštas
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">El. pašto nustatymai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logotipo URL el. laiškuose</Label>
            <Input
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.email_logo_url || ''}
              onChange={(e) => setFormData({ ...formData, email_logo_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Įkelkite logotipą į kokią nors talpyklą ir įklijuokite nuorodą čia
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontaktinė informacija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vardas Pavardė (neprivaloma)</Label>
            <Input
              placeholder="Vardenis Pavardenis"
              value={formData.contact_name || ''}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefonas</Label>
            <Input
              type="tel"
              placeholder="+37062082478"
              value={formData.contact_phone || ''}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Šis telefonas bus rodomas svetainėje ir el. laiškuose
            </p>
          </div>
          <div className="space-y-2">
            <Label>El. paštas</Label>
            <Input
              type="email"
              placeholder="info@sautiksau.lt"
              value={formData.contact_email || ''}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Facebook</Label>
            <Input
              type="url"
              placeholder="https://www.facebook.com/sautiksau"
              value={formData.contact_facebook || ''}
              onChange={(e) => setFormData({ ...formData, contact_facebook: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Instagram</Label>
            <Input
              type="url"
              placeholder="https://www.instagram.com/sautiksaumasazas/"
              value={formData.contact_instagram || ''}
              onChange={(e) => setFormData({ ...formData, contact_instagram: e.target.value })}
            />
          </div>
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