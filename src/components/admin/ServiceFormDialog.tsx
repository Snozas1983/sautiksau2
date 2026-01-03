import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AdminService, ServiceFormData } from '@/hooks/useAdminServices';

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: AdminService | null;
  onSave: (data: ServiceFormData) => Promise<void>;
  isSaving: boolean;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  onSave,
  isSaving,
}: ServiceFormDialogProps) {
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    duration: 60,
    preparationTime: 10,
    price: 50,
    isActive: true,
    description: '',
    sortOrder: 1,
  });

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        duration: service.duration,
        preparationTime: service.preparationTime,
        price: service.price,
        isActive: service.isActive,
        description: service.description,
        sortOrder: service.sortOrder,
      });
    } else {
      setFormData({
        name: '',
        duration: 60,
        preparationTime: 10,
        price: 50,
        isActive: true,
        description: '',
        sortOrder: 1,
      });
    }
  }, [service, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {service ? 'Redaguoti paslaugą' : 'Nauja paslauga'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Pavadinimas</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Aprašymas</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Trukmė (min)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preparationTime">Paruošimo laikas (min)</Label>
              <Input
                id="preparationTime"
                type="number"
                min={0}
                value={formData.preparationTime}
                onChange={(e) => setFormData({ ...formData, preparationTime: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bookingTime">Booking time (min)</Label>
              <Input
                id="bookingTime"
                type="number"
                value={formData.duration + formData.preparationTime}
                disabled
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Automatiškai: Trukmė + Paruošimas
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Kaina (EUR)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Rikiavimo eilė</Label>
              <Input
                id="sortOrder"
                type="number"
                min={1}
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Aktyvus</Label>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Atšaukti
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saugoma...' : 'Išsaugoti'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
