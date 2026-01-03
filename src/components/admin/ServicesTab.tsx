import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface ServicesTabProps {
  adminPassword: string;
}

interface EditableRow extends ServiceFormData {
  id?: string;
  isNew?: boolean;
  isModified?: boolean;
}

const emptyRow: EditableRow = {
  name: '',
  duration: 60,
  preparationTime: 15,
  price: 0,
  isActive: true,
  description: '',
  sortOrder: 1,
  isNew: true,
  isModified: false,
};

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

  const [editingRows, setEditingRows] = useState<Record<string, EditableRow>>({});
  const [newRow, setNewRow] = useState<EditableRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<AdminService | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Set default sortOrder for new row based on existing services
  useEffect(() => {
    if (services.length > 0 && newRow === null) {
      const maxSort = Math.max(...services.map(s => s.sortOrder));
      setNewRow({ ...emptyRow, sortOrder: maxSort + 1 });
    } else if (services.length === 0 && newRow === null) {
      setNewRow({ ...emptyRow });
    }
  }, [services, newRow]);

  const handleFieldChange = (id: string, field: keyof ServiceFormData, value: string | number | boolean) => {
    const service = services.find(s => s.id === id);
    if (!service) return;

    setEditingRows(prev => {
      const current = prev[id] || {
        name: service.name,
        duration: service.duration,
        preparationTime: service.preparationTime,
        price: service.price,
        isActive: service.isActive,
        description: service.description,
        sortOrder: service.sortOrder,
        id: service.id,
        isModified: false,
      };

      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
          isModified: true,
        },
      };
    });
  };

  const handleNewRowChange = (field: keyof ServiceFormData, value: string | number | boolean) => {
    setNewRow(prev => prev ? { ...prev, [field]: value, isModified: true } : null);
  };

  const handleSave = async (id: string) => {
    const editedRow = editingRows[id];
    if (!editedRow) return;

    setSavingId(id);
    try {
      await updateService({
        id,
        name: editedRow.name,
        duration: editedRow.duration,
        preparationTime: editedRow.preparationTime,
        price: editedRow.price,
        isActive: editedRow.isActive,
        description: editedRow.description,
        sortOrder: editedRow.sortOrder,
      });
      toast.success('Paslauga atnaujinta');
      setEditingRows(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `Klaida: ${message}` : 'Nepavyko išsaugoti');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateNew = async () => {
    if (!newRow || !newRow.name.trim()) {
      toast.error('Įveskite paslaugos pavadinimą');
      return;
    }

    setSavingId('new');
    try {
      await createService({
        name: newRow.name,
        duration: newRow.duration,
        preparationTime: newRow.preparationTime,
        price: newRow.price,
        isActive: newRow.isActive,
        description: newRow.description,
        sortOrder: newRow.sortOrder,
      });
      toast.success('Paslauga sukurta');
      const maxSort = services.length > 0 ? Math.max(...services.map(s => s.sortOrder)) + 2 : 1;
      setNewRow({ ...emptyRow, sortOrder: maxSort });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `Klaida: ${message}` : 'Nepavyko sukurti');
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = (id: string) => {
    setEditingRows(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCancelNew = () => {
    const maxSort = services.length > 0 ? Math.max(...services.map(s => s.sortOrder)) + 1 : 1;
    setNewRow({ ...emptyRow, sortOrder: maxSort });
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
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `Klaida: ${message}` : 'Nepavyko ištrinti');
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
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'x-admin-password': adminPassword,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || 'Sync failed');
      }

      const result = await response.json();
      toast.success(`Sinchronizuota: ${result.synced} paslaugos`);
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `Klaida: ${message}` : 'Nepavyko sinchronizuoti');
    } finally {
      setIsSyncing(false);
    }
  };

  const getRowValue = <T extends keyof ServiceFormData>(service: AdminService, field: T): ServiceFormData[T] => {
    if (editingRows[service.id]) {
      return editingRows[service.id][field] as ServiceFormData[T];
    }
    return service[field] as ServiceFormData[T];
  };

  const getStringValue = (service: AdminService, field: 'name' | 'description'): string => {
    return getRowValue(service, field) as string;
  };

  const getNumberValue = (service: AdminService, field: 'sortOrder' | 'duration' | 'preparationTime' | 'price'): number => {
    return getRowValue(service, field) as number;
  };

  const getBoolValue = (service: AdminService, field: 'isActive'): boolean => {
    return getRowValue(service, field) as boolean;
  };

  const isRowEditing = (id: string) => !!editingRows[id]?.isModified;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Kraunama...</p>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Nežinoma klaida';
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-destructive">Klaida kraunant paslaugas</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Bandyti dar kartą
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Paslaugos</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Airtable
        </Button>
      </div>

      {/* Inline Editable Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">#</TableHead>
              <TableHead className="min-w-[180px]">Pavadinimas</TableHead>
              <TableHead className="w-20 text-center">Trukmė</TableHead>
              <TableHead className="w-20 text-center">Paruoš.</TableHead>
              <TableHead className="w-24 text-center">Booking</TableHead>
              <TableHead className="w-20 text-center">Kaina</TableHead>
              <TableHead className="min-w-[120px]">Aprašymas</TableHead>
              <TableHead className="w-16 text-center">Aktyvus</TableHead>
              <TableHead className="w-28 text-center">Veiksmai</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => {
              const isEditing = isRowEditing(service.id);
              const duration = getNumberValue(service, 'duration') || 0;
              const preparation = getNumberValue(service, 'preparationTime') || 0;
              const bookingTime = duration + preparation;

              return (
                <TableRow key={service.id} className={isEditing ? 'bg-muted/50' : ''}>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={1}
                      className="w-14 h-8 text-center text-sm"
                      value={getNumberValue(service, 'sortOrder')}
                      onChange={(e) => handleFieldChange(service.id, 'sortOrder', parseInt(e.target.value) || 1)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm"
                      value={getStringValue(service, 'name')}
                      onChange={(e) => handleFieldChange(service.id, 'name', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={15}
                      className="w-16 h-8 text-center text-sm"
                      value={getNumberValue(service, 'duration')}
                      onChange={(e) => handleFieldChange(service.id, 'duration', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      className="w-16 h-8 text-center text-sm"
                      value={getNumberValue(service, 'preparationTime')}
                      onChange={(e) => handleFieldChange(service.id, 'preparationTime', parseInt(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                      {bookingTime} min
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-16 h-8 text-center text-sm"
                      value={getNumberValue(service, 'price')}
                      onChange={(e) => handleFieldChange(service.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm"
                      value={getStringValue(service, 'description')}
                      onChange={(e) => handleFieldChange(service.id, 'description', e.target.value)}
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={getBoolValue(service, 'isActive')}
                      onCheckedChange={(checked) => handleFieldChange(service.id, 'isActive', checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => handleSave(service.id)}
                            disabled={savingId === service.id}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCancelEdit(service.id)}
                            disabled={savingId === service.id}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteClick(service)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* New Row */}
            {newRow && (
              <TableRow className="bg-primary/5">
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min={1}
                    className="w-14 h-8 text-center text-sm"
                    value={newRow.sortOrder}
                    onChange={(e) => handleNewRowChange('sortOrder', parseInt(e.target.value) || 1)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-sm"
                    value={newRow.name}
                    onChange={(e) => handleNewRowChange('name', e.target.value)}
                    placeholder="Naujos paslaugos pavadinimas"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min={15}
                    className="w-16 h-8 text-center text-sm"
                    value={newRow.duration}
                    onChange={(e) => handleNewRowChange('duration', parseInt(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min={0}
                    className="w-16 h-8 text-center text-sm"
                    value={newRow.preparationTime}
                    onChange={(e) => handleNewRowChange('preparationTime', parseInt(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                    {(newRow.duration || 0) + (newRow.preparationTime || 0)} min
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="w-16 h-8 text-center text-sm"
                    value={newRow.price}
                    onChange={(e) => handleNewRowChange('price', parseFloat(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-8 text-sm"
                    value={newRow.description}
                    onChange={(e) => handleNewRowChange('description', e.target.value)}
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={newRow.isActive}
                    onCheckedChange={(checked) => handleNewRowChange('isActive', checked)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary"
                      onClick={handleCreateNew}
                      disabled={savingId === 'new' || !newRow.name.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    {newRow.isModified && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCancelNew}
                        disabled={savingId === 'new'}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
