import { useState } from 'react';
import { Search, UserX, UserCheck, Phone, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useClients, useUpdateClient, Client } from '@/hooks/useClients';
import { toast } from 'sonner';

interface ClientsTabProps {
  adminPassword: string;
}

export function ClientsTab({ adminPassword }: ClientsTabProps) {
  const [filter, setFilter] = useState<'all' | 'blacklist'>('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dialogAction, setDialogAction] = useState<'blacklist' | 'remove' | null>(null);
  
  const { data: clients, isLoading } = useClients(adminPassword, {
    blacklistOnly: filter === 'blacklist',
    search: search.trim() || undefined,
  });
  
  const updateClient = useUpdateClient(adminPassword);
  
  const handleBlacklistAction = async () => {
    if (!selectedClient) return;
    
    const isRemoving = selectedClient.isBlacklisted;
    
    try {
      await updateClient.mutateAsync({
        clientId: selectedClient.id,
        updates: {
          isBlacklisted: !isRemoving,
          blacklistReason: isRemoving ? '' : 'Pridėta rankiniu būdu',
        },
      });
      
      toast.success(isRemoving ? 'Klientas pašalintas iš juodo sąrašo' : 'Klientas įtrauktas į juodą sąrašą');
    } catch (error) {
      toast.error('Įvyko klaida');
    }
    
    setSelectedClient(null);
    setDialogAction(null);
  };
  
  const openDialog = (client: Client, action: 'blacklist' | 'remove') => {
    setSelectedClient(client);
    setDialogAction(action);
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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ieškoti pagal vardą arba telefoną..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      
      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'blacklist')}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">Visi klientai</TabsTrigger>
          <TabsTrigger value="blacklist" className="flex-1">
            <AlertTriangle className="w-4 h-4 mr-1" />
            Juodas sąrašas
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Clients List */}
      <div className="space-y-2">
        {clients && clients.length > 0 ? (
          clients.map((client) => (
            <Card key={client.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {client.name || 'Nenurodyta'}
                      </span>
                      {client.isBlacklisted && (
                        <Badge variant="destructive" className="text-xs">
                          Juodas sąrašas
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Phone className="w-3 h-3" />
                      <a href={`tel:${client.phone}`} className="hover:underline">
                        {client.phone}
                      </a>
                    </div>
                    {client.email && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {client.email}
                      </div>
                    )}
                    {client.noShowCount > 0 && (
                      <div className="text-xs text-orange-600 mt-1">
                        Neatvykimų: {client.noShowCount}
                      </div>
                    )}
                    {client.blacklistReason && client.isBlacklisted && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Priežastis: {client.blacklistReason}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    {client.isBlacklisted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(client, 'remove')}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Pašalinti
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDialog(client, 'blacklist')}
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Blokuoti
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {filter === 'blacklist' 
              ? 'Juodas sąrašas tuščias'
              : search 
                ? 'Klientų nerasta'
                : 'Nėra klientų'}
          </div>
        )}
      </div>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={!!dialogAction} onOpenChange={() => { setDialogAction(null); setSelectedClient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === 'blacklist' 
                ? 'Įtraukti į juodą sąrašą?' 
                : 'Pašalinti iš juodo sąrašo?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === 'blacklist' 
                ? `Ar tikrai norite įtraukti klientą ${selectedClient?.name || selectedClient?.phone} į juodą sąrašą? Jo būsimos rezervacijos reikalaus patvirtinimo.`
                : `Ar tikrai norite pašalinti klientą ${selectedClient?.name || selectedClient?.phone} iš juodo sąrašo?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Atšaukti</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlacklistAction}>
              {dialogAction === 'blacklist' ? 'Įtraukti' : 'Pašalinti'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}