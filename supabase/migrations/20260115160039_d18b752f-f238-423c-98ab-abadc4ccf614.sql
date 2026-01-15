-- 1. Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Add manage_token to bookings for customer self-service links
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS manage_token uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_manage_token ON public.bookings(manage_token);

-- 3. Create notification_templates table for editable email/SMS templates
CREATE TABLE public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL UNIQUE,
    name text NOT NULL,
    subject text,
    body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notification templates"
ON public.notification_templates
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.notification_templates (type, name, subject, body) VALUES
(
    'email_admin',
    'Administratoriaus pranešimas',
    'Nauja rezervacija: {{customer_name}} - {{date}} {{start_time}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🎉 Nauja rezervacija!</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Rezervacijos informacija</h3>
            <p><strong>Paslauga:</strong> {{service_name}}</p>
            <p><strong>Data:</strong> {{date}}</p>
            <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
        </div>
        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Kliento informacija</h3>
            <p><strong>Vardas:</strong> {{customer_name}}</p>
            <p><strong>Telefonas:</strong> <a href="tel:{{customer_phone}}">{{customer_phone}}</a></p>
        </div>
        <p style="color: #999; font-size: 12px;">Rezervacijos ID: {{booking_id}}</p>
    </div>'
),
(
    'email_customer',
    'Kliento patvirtinimas',
    'Rezervacija patvirtinta - {{date}} {{start_time}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Sveiki, {{customer_name}}! 👋</h2>
        <p>Jūsų rezervacija <strong>SauTikSau</strong> patvirtinta!</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Rezervacijos detalės</h3>
            <p><strong>Paslauga:</strong> {{service_name}}</p>
            <p><strong>Data:</strong> {{date}}</p>
            <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
        </div>
        <p><strong>Adresas:</strong> Vilnius (tikslus adresas bus atsiųstas prieš vizitą)</p>
        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Valdyti rezervaciją:</strong></p>
            <p style="margin: 10px 0 0 0;"><a href="{{manage_link}}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Perkelti arba atšaukti vizitą</a></p>
        </div>
        <p style="color: #666;">Jei turite klausimų: 📧 <a href="mailto:info@sautiksau.lt">info@sautiksau.lt</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">SauTikSau masažai | <a href="https://sautiksau.lt">sautiksau.lt</a></p>
    </div>'
),
(
    'sms_customer',
    'Kliento SMS',
    NULL,
    'SauTikSau: Rezervacija patvirtinta! {{service_name}}, {{date}} {{start_time}}. Valdyti: {{manage_link}}'
);

-- 4. Create schedule_exceptions table for blocking/allowing time slots
CREATE TABLE public.schedule_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date,
    day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    exception_type text NOT NULL CHECK (exception_type IN ('block', 'allow')),
    is_recurring boolean NOT NULL DEFAULT false,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_exception CHECK (
        (is_recurring = true AND day_of_week IS NOT NULL AND date IS NULL) OR
        (is_recurring = false AND date IS NOT NULL AND day_of_week IS NULL)
    )
);

ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedule exceptions"
ON public.schedule_exceptions
FOR SELECT
USING (true);