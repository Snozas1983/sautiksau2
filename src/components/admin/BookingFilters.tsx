import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FilterType = 'today' | 'week' | 'month' | 'all';

interface BookingFiltersProps {
  filter: FilterType;
  statusFilter: string;
  onFilterChange: (filter: FilterType) => void;
  onStatusFilterChange: (status: string) => void;
  hideTimeFilter?: boolean;
}

export function BookingFilters({ 
  filter, 
  statusFilter, 
  onFilterChange, 
  onStatusFilterChange,
  hideTimeFilter = false,
}: BookingFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Date filter buttons */}
      {!hideTimeFilter && (
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={filter === 'today' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('today')}
        >
          Šiandien
        </Button>
        <Button
          variant={filter === 'week' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('week')}
        >
          Savaitė
        </Button>
        <Button
          variant={filter === 'month' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('month')}
        >
          Mėnuo
        </Button>
        <Button
          variant={filter === 'all' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onFilterChange('all')}
        >
          Visi
        </Button>
      </div>
      )}
      
      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filtruoti pagal statusą" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi statusai</SelectItem>
          <SelectItem value="confirmed">Patvirtinti</SelectItem>
          <SelectItem value="completed">Atlikti</SelectItem>
          <SelectItem value="no_show">Neatvyko</SelectItem>
          <SelectItem value="cancelled">Atšaukti</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
