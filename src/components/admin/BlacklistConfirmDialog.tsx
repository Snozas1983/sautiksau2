import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface BlacklistConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  customerName?: string;
}

export function BlacklistConfirmDialog({ 
  open, 
  onClose, 
  onConfirm, 
  customerName 
}: BlacklistConfirmDialogProps) {
  const [reason, setReason] = useState('Neatvyko į vizitą');
  
  const handleConfirm = () => {
    onConfirm(reason);
    setReason('Neatvyko į vizitą');
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Įtraukti į juodą sąrašą?
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Ar tikrai norite įtraukti <strong>{customerName}</strong> į juodą sąrašą?
          </p>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Priežastis</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Įveskite priežastį..."
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Atšaukti
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Įtraukti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
