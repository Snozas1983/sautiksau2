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
    <div className="space-y-6 md:space-y-12">
      {services.map((service, index) => (
        <button
          key={service.id}
          onClick={() => onSelectService(service)}
          className={cn(
            'w-full text-left pb-6 md:pb-12 transition-all duration-200 group',
            index < services.length - 1 && 'border-b border-booking-border',
            'focus:outline-none'
          )}
        >
          <div className="flex flex-col gap-2 md:gap-3">
            <h3 className="text-base md:text-2xl font-light text-booking-foreground transition-all duration-200 group-hover:font-semibold leading-relaxed break-words max-w-[80%] md:max-w-full">
              {service.name}
            </h3>
            <div className="flex items-baseline gap-4 md:justify-end">
              <span className="text-booking-muted font-light text-sm md:text-base">
                {service.duration} min
              </span>
              <span className="text-base md:text-2xl font-light text-booking-foreground">
                {service.price} €
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};