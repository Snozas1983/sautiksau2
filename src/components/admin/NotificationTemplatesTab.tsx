import { useState, useEffect } from 'react';
import { Save, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Template {
  id: string;
  type: string;
  name: string;
  subject: string | null;
  body: string;
  is_active: boolean;
}

interface NotificationTemplatesTabProps {
  adminPassword: string;
}

const AVAILABLE_PLACEHOLDERS = [
  { key: '{{customer_name}}', label: 'Kliento vardas' },
  { key: '{{service_name}}', label: 'Paslauga' },
  { key: '{{date}}', label: 'Data' },
  { key: '{{start_time}}', label: 'Pradžios laikas' },
  { key: '{{end_time}}', label: 'Pabaigos laikas' },
  { key: '{{customer_phone}}', label: 'Telefonas' },
  { key: '{{customer_email}}', label: 'El. paštas' },
  { key: '{{booking_id}}', label: 'Rezervacijos ID' },
  { key: '{{manage_link}}', label: 'Valdymo nuoroda' },
];

export function NotificationTemplatesTab({ adminPassword }: NotificationTemplatesTabProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const fetchTemplates = async () => {
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/airtable-proxy/admin/templates`,
        {
          headers: {
            'x-admin-password': adminPassword,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch templates');

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.error('Klaida gaunant šablonus');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (template: Template) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/airtable-proxy/admin/templates/${template.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword,
          },
          body: JSON.stringify({
            subject: template.subject,
            body: template.body,
            is_active: template.is_active,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to save template');

      toast.success('Šablonas išsaugotas');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Klaida saugant šabloną');
    } finally {
      setIsSaving(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    if (!editingTemplate) return;
    
    // Insert at cursor position or at end
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = 
        editingTemplate.body.substring(0, start) + 
        placeholder + 
        editingTemplate.body.substring(end);
      
      setEditingTemplate({ ...editingTemplate, body: newBody });
    } else {
      setEditingTemplate({ 
        ...editingTemplate, 
        body: editingTemplate.body + placeholder 
      });
    }
  };

  const getTemplateIcon = (type: string) => {
    if (type.includes('sms')) return <MessageSquare className="h-5 w-5" />;
    return <Mail className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Kraunama...
      </div>
    );
  }

  if (editingTemplate) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Redaguoti: {editingTemplate.name}</h2>
          <Button variant="ghost" onClick={() => setEditingTemplate(null)}>
            Atšaukti
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="template-active">Aktyvus</Label>
              <Switch
                id="template-active"
                checked={editingTemplate.is_active}
                onCheckedChange={(checked) => 
                  setEditingTemplate({ ...editingTemplate, is_active: checked })
                }
              />
            </div>

            {/* Subject (only for emails) */}
            {editingTemplate.type.includes('email') && (
              <div className="space-y-2">
                <Label htmlFor="template-subject">Tema</Label>
                <Input
                  id="template-subject"
                  value={editingTemplate.subject || ''}
                  onChange={(e) => 
                    setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                  }
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="template-body">
                {editingTemplate.type.includes('sms') ? 'SMS tekstas' : 'Laiško turinys (HTML)'}
              </Label>
              <Textarea
                id="template-body"
                value={editingTemplate.body}
                onChange={(e) => 
                  setEditingTemplate({ ...editingTemplate, body: e.target.value })
                }
                rows={editingTemplate.type.includes('sms') ? 4 : 12}
                className="font-mono text-sm"
              />
            </div>

            {/* Placeholders */}
            <div className="space-y-2">
              <Label>Kintamieji (spauskite norėdami įterpti)</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_PLACEHOLDERS.map((p) => (
                  <Badge
                    key={p.key}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                    onClick={() => insertPlaceholder(p.key)}
                  >
                    {p.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Save button */}
            <div className="pt-4">
              <Button
                onClick={() => handleSave(editingTemplate)}
                disabled={isSaving}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saugoma...' : 'Išsaugoti'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pranešimų šablonai</h2>
        <Button variant="ghost" size="icon" onClick={fetchTemplates}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {templates.map((template) => (
          <Card 
            key={template.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setEditingTemplate(template)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTemplateIcon(template.type)}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <Badge variant={template.is_active ? 'default' : 'secondary'}>
                  {template.is_active ? 'Aktyvus' : 'Išjungtas'}
                </Badge>
              </div>
              {template.subject && (
                <CardDescription className="truncate">
                  Tema: {template.subject}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          Šablonų nerasta
        </div>
      )}
    </div>
  );
}
