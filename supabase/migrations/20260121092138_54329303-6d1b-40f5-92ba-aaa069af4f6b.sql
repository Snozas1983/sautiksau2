-- Add email column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique indexes (allowing NULL)
CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_unique ON clients(phone) WHERE phone IS NOT NULL AND phone != '';
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_unique ON clients(email) WHERE email IS NOT NULL AND email != '';

-- Add contact settings
INSERT INTO settings (key, value) VALUES 
  ('contact_name', ''),
  ('contact_phone', '+37062082478'),
  ('contact_email', 'info@sautiksau.lt'),
  ('contact_facebook', 'https://www.facebook.com/sautiksau'),
  ('contact_instagram', 'https://www.instagram.com/sautiksaumasazas/')
ON CONFLICT (key) DO NOTHING;

-- Update pending_customer notification template with contact phone placeholder
UPDATE notification_templates 
SET body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  {{#if logo_url}}<img src="{{logo_url}}" alt="Logo" style="max-width: 200px; margin-bottom: 20px;">{{/if}}
  <h2>Sveiki, {{customer_name}}!</h2>
  <p><strong>Dėmesio:</strong> Kadangi praeityje su jūsų duomenimis buvo registruotas vizitas, į kurį nebuvo atvykta, jūsų rezervacija reikalauja administratoriaus patvirtinimo.</p>
  <p>Jūsų rezervacijos informacija:</p>
  <ul>
    <li><strong>Paslauga:</strong> {{service_name}}</li>
    <li><strong>Data:</strong> {{date}}</li>
    <li><strong>Laikas:</strong> {{start_time}} - {{end_time}}</li>
  </ul>
  <p>Dėl registracijos patvirtinimo su jumis susisieks administratorius telefonu (jei jį nurodėte). Jei ne - prašome susisiekti: <strong>{{contact_phone}}</strong></p>
  <p>Ačiū už supratimą!</p>
</div>',
subject = 'Jūsų rezervacija laukia patvirtinimo'
WHERE type = 'pending_customer';