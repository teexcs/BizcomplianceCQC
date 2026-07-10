'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CompanyNameField } from '@/components/site/company-name-field';
import { BoxedDropdown } from '@/components/site/boxed-dropdown';
import { updateOrganisation, updateProfile } from '@/lib/actions/client';
import { openBillingPortal } from '@/lib/actions/billing';

const SERVICE_TYPES = [
  { value: 'domiciliary-care', label: 'Domiciliary care' },
  { value: 'supported-living', label: 'Supported living' },
  { value: 'care-home', label: 'Care home (residential)' },
  { value: 'nursing-home', label: 'Care home (nursing)' },
  { value: 'clinic', label: 'Clinic / treatment service' },
  { value: 'new-provider', label: 'New provider (pre-registration)' },
  { value: 'other', label: 'Other regulated service' },
];

export interface OrgFormValues {
  name: string;
  service_type: string;
  cqc_provider_id: string;
  cqc_location_id: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
}

export function OrganisationForm({ initial }: { initial: OrgFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const initialServiceType = SERVICE_TYPES.some((item) => item.value === initial.service_type)
    ? initial.service_type
    : 'other';
  const [serviceType, setServiceType] = useState(initialServiceType);
  const [otherServiceType, setOtherServiceType] = useState(
    initialServiceType === 'other' ? initial.service_type : '',
  );
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof OrgFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    if (serviceType === 'other' && !otherServiceType.trim()) {
      setStatus({ tone: 'error', text: 'Please describe your service type.' });
      setLoading(false);
      return;
    }
    const resolvedServiceType = serviceType === 'other' ? otherServiceType.trim() : serviceType;
    const result = await updateOrganisation({ ...values, service_type: resolvedServiceType });
    setStatus(
      result.ok
        ? { tone: 'ok', text: 'Business details saved.' }
        : { tone: 'error', text: result.error ?? 'Could not save.' },
    );
    setLoading(false);
    if (result.ok) router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-name">Business name</Label>
          <CompanyNameField
            id="org-name"
            value={values.name}
            onValueChange={(value) => setValues((current) => ({ ...current, name: value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-service">Service type</Label>
          <BoxedDropdown
            id="org-service"
            value={serviceType}
            onChange={(value) => {
              setServiceType(value);
              if (value !== 'other') setOtherServiceType('');
            }}
            options={SERVICE_TYPES}
            placeholder="Select your service type"
          />
          {serviceType === 'other' ? (
            <div className="space-y-2">
              <Label htmlFor="org-service-other">Tell us your service</Label>
              <Input
                id="org-service-other"
                value={otherServiceType}
                onChange={(e) => setOtherServiceType(e.target.value)}
                required
                placeholder="Type your service here"
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-provider">CQC provider ID</Label>
          <Input
            id="org-provider"
            value={values.cqc_provider_id}
            onChange={set('cqc_provider_id')}
            placeholder="1-000000000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-location">CQC location ID</Label>
          <Input
            id="org-location"
            value={values.cqc_location_id}
            onChange={set('cqc_location_id')}
            placeholder="1-000000000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone">Phone</Label>
          <Input id="org-phone" type="tel" value={values.phone} onChange={set('phone')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-address1">Address line 1</Label>
          <Input id="org-address1" value={values.address_line1} onChange={set('address_line1')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-address2">Address line 2</Label>
          <Input id="org-address2" value={values.address_line2} onChange={set('address_line2')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-city">City</Label>
          <Input id="org-city" value={values.city} onChange={set('city')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-postcode">Postcode</Label>
          <Input id="org-postcode" value={values.postcode} onChange={set('postcode')} />
        </div>
      </div>
      {status ? (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${status.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}
        >
          {status.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save business details'}
      </button>
    </form>
  );
}

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const result = await updateProfile({ full_name: fullName });
    setStatus(
      result.ok
        ? { tone: 'ok', text: 'Profile saved.' }
        : { tone: 'error', text: result.error ?? 'Could not save.' },
    );
    setLoading(false);
    if (result.ok) router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Your name</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled aria-describedby="email-note" />
          <p id="email-note" className="text-xs text-muted-foreground">
            Contact us to change your sign-in email.
          </p>
        </div>
      </div>
      {status ? (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${status.tone === 'ok' ? 'text-green-700' : 'text-destructive'}`}
        >
          {status.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-6 bg-[hsl(220,50%,15%)] text-[hsl(36,33%,97%)] hover:bg-[hsl(220,50%,15%)]/90 transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

export function BillingPortalButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const result = await openBillingPortal();
    // On success the action redirects; reaching here means it failed.
    if (result && !result.ok) setError(result.error);
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md border text-sm font-medium h-10 px-6 hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading ? 'Opening…' : 'Manage billing & invoices'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
