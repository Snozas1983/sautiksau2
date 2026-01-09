import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

export const TreatwellButton = () => {
  useEffect(() => {
    // Load Treatwell CSS
    const link = document.createElement("link");
    link.type = "text/css";
    link.href = "https://book.treatwell.lt/common/venue-menu/css/widget-button.css";
    link.rel = "stylesheet";
    link.media = "screen";
    link.id = "treatwell-css";
    
    if (!document.getElementById("treatwell-css")) {
      document.getElementsByTagName("head")[0].appendChild(link);
    }

    // Load Treatwell JavaScript
    const existingScript = document.getElementById("treatwell-script");
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://book.treatwell.lt/common/venue-menu/javascript/widget-button.js?v1';
      script.async = true;
      script.id = "treatwell-script";
      document.body.appendChild(script);
    }
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && (window as any).wahanda) {
      (window as any).wahanda.openOnlineBookingWidget(
        "https://book.treatwell.lt/salonas/513524/meniu/"
      );
    } else {
      window.open("https://book.treatwell.lt/salonas/513524/meniu/", "_blank");
    }
  };

  return (
    <a
      href="https://www.treatwell.lt/"
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 
                 border border-booking-border rounded-sm 
                 text-booking-muted hover:text-booking-foreground 
                 hover:border-booking-foreground transition-colors 
                 text-sm font-light"
    >
      <ExternalLink size={16} />
      Užsiregistruok per Treatwell
    </a>
  );
};
