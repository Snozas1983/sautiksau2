import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface NotificationRequest {
  type?: 'booking' | 'cancellation' | 'blacklist_warning'; // Default: 'booking'
  bookingId: string;
  manageToken?: string;
  serviceName: string;
  servicePrice?: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  // For cancellation - which notifications to send
  sendSms?: boolean;
  sendEmail?: boolean;
  // For blacklist warning
  blacklistReason?: string;
}

// Format date from YYYY-MM-DD to readable Lithuanian format
function formatDate(dateStr: string): string {
  const months = [
    'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
    'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio'
  ];
  const days = ['Sekmadienis', 'Pirmadienis', 'Antradienis', 'Trečiadienis', 'Ketvirtadienis', 'Penktadienis', 'Šeštadienis'];
  
  const date = new Date(dateStr);
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  return `${dayName}, ${month} ${day} d.`;
}

// Replace template placeholders with actual values
function replaceTemplatePlaceholders(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

// Get notification templates from database
async function getTemplates(): Promise<Record<string, { subject: string | null; body: string; is_active: boolean }>> {
  const { data, error } = await supabaseAdmin
    .from('notification_templates')
    .select('type, subject, body, is_active');
  
  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
  
  const templates: Record<string, { subject: string | null; body: string; is_active: boolean }> = {};
  for (const row of data || []) {
    templates[row.type] = {
      subject: row.subject,
      body: row.body,
      is_active: row.is_active,
    };
  }
  
  return templates;
}

// Send email using Resend
async function sendEmail(
  resend: InstanceType<typeof Resend>,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: "SauTikSau <info@sautiksau.lt>",
      to: [to],
      subject,
      html,
    });
    console.log("Email sent:", result);
    return { success: true };
  } catch (error) {
    console.error("Email error:", error);
    return { success: false, error: String(error) };
  }
}

// Send SMS using ClickSend
async function sendSMS(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const username = Deno.env.get("CLICKSEND_USERNAME");
  const apiKey = Deno.env.get("CLICKSEND_API_KEY");

  if (!username || !apiKey) {
    console.error("ClickSend credentials not configured");
    return { success: false, error: "SMS not configured" };
  }

  // Format phone number (ensure it starts with country code)
  let formattedPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (formattedPhone.startsWith('8')) {
    formattedPhone = '+370' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+370' + formattedPhone;
  }

  try {
    const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(`${username}:${apiKey}`),
      },
      body: JSON.stringify({
        messages: [
          {
            source: "sdk",
            from: "SAUTIKSAU",
            body: message,
            to: formattedPhone,
          },
        ],
      }),
    });

    const data = await response.json();
    console.log("SMS response:", data);

    if (data.response_code === "SUCCESS") {
      return { success: true };
    } else {
      return { success: false, error: data.response_msg || "SMS failed" };
    }
  } catch (error) {
    console.error("SMS error:", error);
    return { success: false, error: String(error) };
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const data: NotificationRequest = await req.json();
    const notificationType = data.type || 'booking';
    
    console.log(`Sending ${notificationType} notifications for booking:`, data);

    // Get templates from database
    const templates = await getTemplates();
    
    // Prepare template data
    const formattedDate = formatDate(data.date);
    const manageLink = data.manageToken 
      ? `https://sau-tik-sau-zen.lovable.app/booking/${data.manageToken}`
      : 'https://sau-tik-sau-zen.lovable.app';
    const bookingLink = 'https://sau-tik-sau-zen.lovable.app';
    
    const templateData: Record<string, string> = {
      customer_name: data.customerName,
      service_name: data.serviceName,
      price: data.servicePrice || '',
      date: formattedDate,
      start_time: data.startTime,
      end_time: data.endTime,
      customer_phone: data.customerPhone,
      customer_email: data.customerEmail || '',
      booking_id: data.bookingId,
      manage_link: manageLink,
      booking_link: bookingLink,
    };

    const results: { adminEmail?: any; customerEmail?: any; customerSMS?: any } = {};

    if (notificationType === 'booking') {
      // ===== BOOKING NOTIFICATIONS =====
      
      // 1. Send email to admin
      const adminTemplate = templates['email_admin'];
      if (adminTemplate?.is_active) {
        const adminSubject = replaceTemplatePlaceholders(adminTemplate.subject || '', templateData);
        const adminBody = replaceTemplatePlaceholders(adminTemplate.body, templateData);
        
        results.adminEmail = await sendEmail(
          resend,
          "info@sautiksau.lt",
          adminSubject,
          adminBody
        );
      }

      // 2. Send email to customer (if email provided)
      if (data.customerEmail) {
        const customerTemplate = templates['email_customer'];
        if (customerTemplate?.is_active) {
          const customerSubject = replaceTemplatePlaceholders(customerTemplate.subject || '', templateData);
          const customerBody = replaceTemplatePlaceholders(customerTemplate.body, templateData);
          
          results.customerEmail = await sendEmail(
            resend,
            data.customerEmail,
            customerSubject,
            customerBody
          );
        }
      }

      // 3. Send SMS to customer
      const smsTemplate = templates['sms_customer'];
      if (smsTemplate?.is_active) {
        const smsBody = replaceTemplatePlaceholders(smsTemplate.body, templateData);
        results.customerSMS = await sendSMS(data.customerPhone, smsBody);
      }
      
    } else if (notificationType === 'cancellation') {
      // ===== CANCELLATION NOTIFICATIONS =====
      // Only send to customer, based on sendSms/sendEmail flags
      
      // 1. Send cancellation email to customer
      if (data.sendEmail && data.customerEmail) {
        const cancelEmailTemplate = templates['email_cancel_customer'];
        if (cancelEmailTemplate?.is_active) {
          const subject = replaceTemplatePlaceholders(cancelEmailTemplate.subject || '', templateData);
          const body = replaceTemplatePlaceholders(cancelEmailTemplate.body, templateData);
          
          results.customerEmail = await sendEmail(
            resend,
            data.customerEmail,
            subject,
            body
          );
        }
      }

      // 2. Send cancellation SMS to customer
      if (data.sendSms) {
        const cancelSmsTemplate = templates['sms_cancel_customer'];
        if (cancelSmsTemplate?.is_active) {
          const smsBody = replaceTemplatePlaceholders(cancelSmsTemplate.body, templateData);
          results.customerSMS = await sendSMS(data.customerPhone, smsBody);
        }
      }
    } else if (notificationType === 'blacklist_warning') {
      // ===== BLACKLIST WARNING TO ADMIN =====
      const blacklistTemplateData = {
        ...templateData,
        blacklist_reason: data.blacklistReason || 'Neatvyko',
      };
      
      const blacklistTemplate = templates['email_admin_blacklist'];
      if (blacklistTemplate?.is_active) {
        const subject = replaceTemplatePlaceholders(blacklistTemplate.subject || '', blacklistTemplateData);
        const body = replaceTemplatePlaceholders(blacklistTemplate.body, blacklistTemplateData);
        
        results.adminEmail = await sendEmail(
          resend,
          "info@sautiksau.lt",
          subject,
          body
        );
      }
    }

    console.log("Notification results:", results);

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Error in send-notifications:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
