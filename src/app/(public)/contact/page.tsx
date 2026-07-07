'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { submitContactForm } from '@/lib/actions/contact';

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div ref={ref} className={cn('transition-all duration-700 ease-out', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function ContactPage() {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await submitContactForm({ ...formData, website: '' });
    if (result.ok) {
      showToast('Message sent — we aim to reply within one business day.', 'success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } else {
      showToast(result.error ?? 'Could not send your message.', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <ScrollReveal>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(220,45%,45%)] mb-4">Contact</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-6">
              Book a CQC readiness audit
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-12">
              If you want to discuss your service before booking, send a short message and we will reply with the next steps.
            </p>

            <div className="space-y-8">
              <div>
                <h3 className="font-display text-sm font-semibold mb-2">Email</h3>
                <p className="text-muted-foreground">hello@bizcompliance.co.uk</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold mb-2">Service area</h3>
                <p className="text-muted-foreground">UK adult social care and healthcare providers</p>
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold mb-2">Response time</h3>
                <p className="text-muted-foreground">We aim to respond to enquiries within 24 hours during business days.</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" rows={6} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
