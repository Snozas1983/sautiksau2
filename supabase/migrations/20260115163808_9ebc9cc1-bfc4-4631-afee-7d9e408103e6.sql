-- Add admin blacklist warning email template
INSERT INTO notification_templates (type, name, subject, body, is_active)
VALUES (
  'email_admin_blacklist',
  'Įspėjimas apie juodo sąrašo klientą',
  '⚠️ DĖMESIO: Juodo sąrašo klientas užsiregistravo',
  '<h2 style="color: #dc2626;">⚠️ Juodo sąrašo klientas</h2>
   <p><strong>{{customer_name}}</strong> ({{customer_phone}}) užsiregistravo vizitui.</p>
   <table style="margin: 20px 0; border-collapse: collapse;">
     <tr><td style="padding: 8px 16px 8px 0; font-weight: bold;">Data:</td><td>{{date}}</td></tr>
     <tr><td style="padding: 8px 16px 8px 0; font-weight: bold;">Laikas:</td><td>{{start_time}} - {{end_time}}</td></tr>
     <tr><td style="padding: 8px 16px 8px 0; font-weight: bold;">Paslauga:</td><td>{{service_name}}</td></tr>
   </table>
   <p style="color: #dc2626; font-weight: bold;">Priežastis kodėl juodame sąraše: {{blacklist_reason}}</p>
   <p style="margin-top: 20px;">Peržiūrėkite rezervaciją administratoriaus skiltyje.</p>',
  true
);