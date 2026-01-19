-- Add new settings for booking limits and email logo
INSERT INTO settings (key, value) VALUES 
  ('max_bookings_per_phone', '4'),
  ('max_bookings_per_email', '4'),
  ('email_logo_url', '')
ON CONFLICT (key) DO NOTHING;

-- Add new notification templates for reschedule and pending approval
INSERT INTO notification_templates (type, name, subject, body, is_active) VALUES
  -- Reschedule notifications
  ('email_reschedule_customer', 'Vizito perkėlimas (klientui)', 'Jūsų vizitas perkeltas - {{service_name}}', 
   '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
     {{#if logo_url}}<img src="{{logo_url}}" alt="SauTikSau" style="max-width: 150px; margin-bottom: 20px;" />{{/if}}
     <h2>Sveiki, {{customer_name}}!</h2>
     <p>Jūsų vizitas buvo perkeltas į naują laiką:</p>
     <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
       <p><strong>Paslauga:</strong> {{service_name}}</p>
       <p><strong>Data:</strong> {{date}}</p>
       <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
     </div>
     <p>Jei turite klausimų, susisiekite su mumis.</p>
     <p><a href="{{manage_link}}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 4px;">Tvarkyti rezervaciją</a></p>
   </div>', true),
   
  ('sms_reschedule_customer', 'Vizito perkėlimas (SMS)', NULL,
   'SauTikSau: Jūsų vizitas perkeltas. Nauja data: {{date}}, {{start_time}}. Paslauga: {{service_name}}. Valdyti: {{manage_link}}', true),
   
  ('email_reschedule_admin', 'Vizito perkėlimas (admin)', 'Vizitas perkeltas: {{customer_name}}',
   '<div style="font-family: Arial, sans-serif;">
     <h2>Vizitas perkeltas</h2>
     <p><strong>Klientas:</strong> {{customer_name}}</p>
     <p><strong>Telefonas:</strong> {{customer_phone}}</p>
     <p><strong>Paslauga:</strong> {{service_name}}</p>
     <p><strong>Nauja data:</strong> {{date}}</p>
     <p><strong>Naujas laikas:</strong> {{start_time}} - {{end_time}}</p>
     <p><a href="{{admin_link}}">Peržiūrėti rezervaciją</a></p>
   </div>', true),
   
  -- Admin cancel notification
  ('email_cancel_admin', 'Vizito atšaukimas (admin)', 'Vizitas atšauktas: {{customer_name}}',
   '<div style="font-family: Arial, sans-serif;">
     <h2>Vizitas atšauktas</h2>
     <p><strong>Klientas:</strong> {{customer_name}}</p>
     <p><strong>Telefonas:</strong> {{customer_phone}}</p>
     <p><strong>Paslauga:</strong> {{service_name}}</p>
     <p><strong>Data:</strong> {{date}}</p>
     <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
   </div>', true),
   
  -- Pending approval notifications (for blacklisted clients)
  ('email_pending_customer', 'Laukiama patvirtinimo (klientui)', 'Jūsų rezervacija laukia patvirtinimo',
   '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
     {{#if logo_url}}<img src="{{logo_url}}" alt="SauTikSau" style="max-width: 150px; margin-bottom: 20px;" />{{/if}}
     <h2>Sveiki, {{customer_name}}!</h2>
     <p>Jūsų rezervacija buvo priimta, tačiau <strong>reikalauja administratoriaus patvirtinimo</strong>.</p>
     <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
       <p style="margin: 0;"><strong>Pastaba:</strong> Kadangi praeityje buvote neatvykęs į sutartą vizitą, jūsų rezervacija bus patvirtinta po administratoriaus peržiūros.</p>
     </div>
     <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
       <p><strong>Paslauga:</strong> {{service_name}}</p>
       <p><strong>Pageidaujama data:</strong> {{date}}</p>
       <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
     </div>
     <p>Mes su jumis susisieksime dėl patvirtinimo.</p>
   </div>', true),
   
  ('sms_pending_customer', 'Laukiama patvirtinimo (SMS)', NULL,
   'SauTikSau: Jūsų rezervacija ({{date}}, {{start_time}}) laukia patvirtinimo. Susisieksime su jumis.', true),
   
  ('email_pending_admin', 'Laukiama patvirtinimo (admin)', 'Reikalingas patvirtinimas: {{customer_name}} (juodas sąrašas)',
   '<div style="font-family: Arial, sans-serif;">
     <h2 style="color: #dc3545;">⚠️ Reikalingas patvirtinimas</h2>
     <p>Klientas iš <strong>juodo sąrašo</strong> bandė rezervuotis:</p>
     <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
       <p><strong>Klientas:</strong> {{customer_name}}</p>
       <p><strong>Telefonas:</strong> {{customer_phone}}</p>
       <p><strong>El. paštas:</strong> {{customer_email}}</p>
       <p><strong>Priežastis:</strong> {{blacklist_reason}}</p>
     </div>
     <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
       <p><strong>Paslauga:</strong> {{service_name}}</p>
       <p><strong>Data:</strong> {{date}}</p>
       <p><strong>Laikas:</strong> {{start_time}} - {{end_time}}</p>
     </div>
     <p><a href="{{admin_link}}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: white; text-decoration: none; border-radius: 4px;">Peržiūrėti ir patvirtinti</a></p>
   </div>', true)
ON CONFLICT (type) DO NOTHING;