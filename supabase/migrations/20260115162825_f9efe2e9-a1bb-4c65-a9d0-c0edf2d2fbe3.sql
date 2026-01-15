-- Insert cancellation notification templates
INSERT INTO public.notification_templates (type, name, subject, body, is_active) VALUES
('email_cancel_customer', 'Vizito atšaukimas (el. paštas)', 'SauTikSau: Jūsų vizitas atšauktas', '<h2>Sveiki, {{customer_name}}!</h2>
<p>Informuojame, kad Jūsų vizitas <strong>{{date}}</strong> <strong>{{start_time}}</strong> buvo atšauktas.</p>
<p><strong>Paslauga:</strong> {{service_name}}<br>
<strong>Kaina:</strong> {{price}} €</p>
<p>Jei turite klausimų arba norite užsiregistruoti nauju laiku, susisiekite su mumis:</p>
<ul>
<li>El. paštas: info@sautiksau.lt</li>
<li>Telefonas: +370 XXX XXXXX</li>
</ul>
<p>Atsiprašome už nepatogumus.</p>
<p>Pagarbiai,<br>SauTikSau komanda</p>', true),
('sms_cancel_customer', 'Vizito atšaukimas (SMS)', NULL, 'SauTikSau: Jūsų vizitas {{date}} {{start_time}} atšauktas. Susisiekite: info@sautiksau.lt arba užsiregistruokite iš naujo: {{booking_link}}', true);