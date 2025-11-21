import { Phone, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-6">
            <img 
              src={logo} 
              alt="SAU TIK SAU masažo studija" 
              className="w-64 md:w-80 mx-auto"
            />
          </div>
          
          <div className="h-px w-24 mx-auto bg-border" />
          
          <p className="text-lg md:text-xl font-light leading-relaxed text-muted-foreground max-w-xl mx-auto">
            Minimalistinio japoniško stiliaus masažo erdvė Domeikavoje
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
            <a 
              href="tel:+37062082478" 
              className="flex items-center gap-2 text-foreground hover:text-muted-foreground transition-colors"
            >
              <Phone size={18} />
              <span className="font-light">+370 620 82478</span>
            </a>
            <div className="hidden sm:block h-4 w-px bg-border" />
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={18} />
              <span className="font-light">Domeikava</span>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-center mb-16 tracking-wide">
            Apie mus
          </h2>
          <div className="space-y-6 text-center">
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Privati, profesionali vieno kambario masažo erdvė, kurioje svarbiausias yra jūsų poilsis ir tyla.
            </p>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Kiekviena sesija – tai laikas skirti sau, įkvėptas japonų minimalizmo filosofijos ir ramybės.
            </p>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Čia nėra skubėjimo, tik profesionali priežiūra ir erdvė atsigavimui.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-center mb-16 tracking-wide">
            Paslaugos
          </h2>
          <div className="space-y-12">
            <div className="space-y-4 pb-12 border-b border-border">
              <div className="flex flex-col md:flex-row md:justify-between md:items-baseline gap-3">
                <h3 className="text-2xl font-light">Kobido veido masažas</h3>
                <div className="flex items-baseline gap-4">
                  <span className="text-muted-foreground font-light">60 min</span>
                  <span className="text-2xl font-light">60 €</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pb-12 border-b border-border">
              <div className="flex flex-col md:flex-row md:justify-between md:items-baseline gap-3">
                <h3 className="text-2xl font-light">Anti celiulitinis kūno masažas</h3>
                <div className="flex items-baseline gap-4">
                  <span className="text-muted-foreground font-light">90 min</span>
                  <span className="text-2xl font-light">80 €</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Plans Section */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-light text-center mb-16 tracking-wide">
            Ateities planai
          </h2>
          <div className="text-center space-y-6">
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Artimiausioje ateityje planuojame organizuoti moterų vakarus, bendradarbiauti su 
              makiažo meistrais bei kurti savo kosmetikos produktų liniją.
            </p>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Stebėkite naujienas ir būkite kartu su mumis šioje kelionėje.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center space-y-12">
          <h2 className="text-3xl md:text-4xl font-light tracking-wide">
            Kontaktai
          </h2>
          
          <div className="space-y-8">
            <div className="space-y-3">
              <p className="text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Telefonas
              </p>
              <a 
                href="tel:+37062082478" 
                className="text-2xl font-light hover:text-muted-foreground transition-colors"
              >
                +370 620 82478
              </a>
            </div>
            
            <div className="h-px w-24 mx-auto bg-border" />
            
            <div className="space-y-3">
              <p className="text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Adresas
              </p>
              <p className="text-2xl font-light">
                Domeikava
              </p>
            </div>
            
            <div className="h-px w-24 mx-auto bg-border" />
            
            <div className="space-y-3">
              <p className="text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Socialiniai tinklai
              </p>
              <div className="flex justify-center gap-6">
                <a 
                  href="#" 
                  className="text-lg font-light hover:text-muted-foreground transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook
                </a>
                <a 
                  href="#" 
                  className="text-lg font-light hover:text-muted-foreground transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-light text-muted-foreground tracking-wider">
            © 2025 SAU TIK SAU. Visos teisės saugomos.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
