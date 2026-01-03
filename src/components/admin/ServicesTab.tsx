import { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdminServices, AdminService, ServiceFormData } from '@/hooks/useAdminServices';
import { ServiceFormDialog } from './ServiceFormDialog';

interface ServicesTabProps {
  adminPassword: string;
}

export function ServicesTab({ adminPassword }: ServicesTabProps) {
  const {
    services,
    isLoading,
    error,
    createService,
    updateService,
    deleteService,
    isCreating,
    isUpdating,
    isDeleting,
    refetch,
  } = useAdminServices(adminPassword);

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdminService | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<AdminService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleCreate = () => {
    setEditingService(null);
    setFormOpen(true);
  };

  const handleEdit = (service: AdminService) => {
    setEditingService(service);
    setFormOpen(true);
  };

  const handleDeleteClick = (service: AdminService) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!serviceToDelete) return;
    
    try {
      await deleteService(serviceToDelete.id);
      toast.success('Paslauga ištrinta');
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    } catch (error) {
      toast.error('Nepavyko ištrinti paslaugos');
    }
  };

  const handleSave = async (data: ServiceFormData) => {
    try {
      if (editingService) {
        await updateService({ id: editingService.id, ...data });
        toast.success('Paslauga atnaujinta');
      } else {
        await createService(data);
        toast.success('Paslauga sukurta');
      }
    } catch (error) {
      toast.error('Nepavyko išsaugoti paslaugos');
      throw error;
    }
  };

  const handleToggleActive = async (service: AdminService) => {
    try {
      await updateService({
        id: service.id,
        name: service.name,
        duration: service.duration,
        preparationTime: service.preparationTime,
        bookingTime: service.bookingTime,
        price: service.price,
        description: service.description,
        sortOrder: service.sortOrder,
        isActive: !service.isActive,
      });
      toast.success(service.isActive ? 'Paslauga deaktyvuota' : 'Paslauga aktyvuota');
    } catch (error) {
      toast.error('Nepavyko pakeisti būsenos');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/airtable-proxy/admin/sync-services`,
        {
          method: 'POST',
          headers: {
            'x-admin-password': adminPassword,
          },
        }
      );
      
      if (!response.ok) throw new Error('Sync failed');
      
      const result = await response.json();
      toast.success(`Sinchronizuota: ${result.synced} paslaugos`);
      refetch();
    } catch (error) {
      toast.error('Nepavyko sinchronizuoti');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Kraunama...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Klaida kraunant paslaugas</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Paslaugos</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Airtable
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Pridėti
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Pavadinimas</TableHead>
              <TableHead className="w-20 text-center">Trukmė</TableHead>
              <TableHead className="w-20 text-center">Kaina</TableHead>
              <TableHead className="w-20 text-center">Aktyvus</TableHead>
              <TableHead className="w-24 text-right">Veiksmai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nėra paslaugų
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="text-muted-foreground">
                    {service.sortOrder}
                  </TableCell>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell className="text-center">{service.duration} min</TableCell>
                  <TableCell className="text-center">{service.price} €</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={service.isActive}
                      onCheckedChange={() => handleToggleActive(service)}
                      disabled={isUpdating}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(service)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(service)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Dialog */}
      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        service={editingService}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ištrinti paslaugą?</AlertDialogTitle>
            <AlertDialogDescription>
              Ar tikrai norite ištrinti "{serviceToDelete?.name}"? Šis veiksmas negrįžtamas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Atšaukti</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Trinama...' : 'Ištrinti'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
