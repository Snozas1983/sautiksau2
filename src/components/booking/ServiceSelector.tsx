import { Service } from './types';
import { cn } from '@/lib/utils';

interface ServiceSelectorProps {
  services: Service[];
  selectedService: Service | null;
  onSelectService: (service: Service) => void;
}

export const ServiceSelector = ({
  services,
  selectedService,
  onSelectService,
}: ServiceSelectorProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-light text-booking-foreground text-center mb-8">
        Pasirinkite paslaugą
      </h3>
      <div className="grid gap-4">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelectService(service)}
            className={cn(
              'w-full p-6 text-left rounded-sm border transition-all duration-300',
              'hover:border-booking-available/50 hover:bg-booking-surface/50',
              'focus:outline-none focus:ring-2 focus:ring-booking-available/30',
              selectedService?.id === service.id
                ? 'border-booking-available bg-booking-surface'
                : 'border-booking-border bg-transparent'
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h4 className="text-lg font-light text-booking-foreground">
                {service.name}
              </h4>
              <div className="flex items-center gap-4">
                <span className="text-sm text-booking-muted">
                  {service.duration} min
                </span>
                <span className="text-xl font-light text-booking-foreground">
                  {service.price} €
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
