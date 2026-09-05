"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { createClientRecord } from "@/lib/db";

export default function NewClientPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { refresh } = useData();

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [state, setState] = useState("Telangana");
  const [stateCode, setStateCode] = useState("36");
  const [postalCode, setPostalCode] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Client name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // The primary contact's name has no column of its own, so it is kept with
      // the internal notes rather than silently dropped.
      const contact = contactName.trim();
      const notes = [
        contact ? `Primary contact: ${contact}` : "",
        internalNotes.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const created = await createClientRecord({
        name: trimmedName,
        legal_name: legalName.trim() || trimmedName,
        gstin: gstin.trim() || null,
        pan: pan.trim() || null,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        address_line1: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        state_code: stateCode.trim() || null,
        postal_code: postalCode.trim() || null,
        country: "India",
        internal_notes: notes || null,
      });

      await refresh();
      showToast(`Client ${created.name} created`);
      router.push(`/admin/clients/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create client.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link
          href="/admin/clients"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-2"
        >
          ← Back to clients
        </Link>
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          New client
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          Register client entity for engagements and billing.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-6">
        {/* Section 1: Who they are */}
        <div>
          <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
            1. Identity & Primary Contact
          </h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Display Name / Organisation"
              required
              placeholder="e.g. Acme Corporation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Primary Contact Person"
                required
                placeholder="e.g. Ananya Rao"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <Input
                label="Contact Email"
                type="email"
                required
                placeholder="e.g. ananya@acme.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <Input
              label="Contact Phone"
              placeholder="e.g. +91 98765 43210"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Billing & GST */}
        <div className="border-t border-ink-100 pt-5">
          <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
            2. Invoicing & Tax Details
          </h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Legal Name (for tax invoice)"
              placeholder="e.g. Acme Corporation India Private Limited"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="GSTIN"
                placeholder="e.g. 36AAFCO1234A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
              />
              <Input
                label="PAN"
                placeholder="e.g. AAFCO1234A"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
              />
            </div>
            <Input
              label="Registered Address"
              placeholder="Street, Building, Floor"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                label="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
              <Input
                label="State Code (GST)"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                helperText="36 = Telangana"
              />
            </div>
            <Input
              label="Postal Code"
              placeholder="e.g. 500081"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>

        {/* Internal Notes */}
        <div className="border-t border-ink-100 pt-5">
          <Textarea
            label="Internal Notes (Only you can see this)"
            rows={2}
            placeholder="Special client agreements, working preferences..."
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            {error}
          </div>
        )}

        <div className="pt-3 border-t border-ink-100 flex items-center justify-between">
          <Button type="submit" variant="primary" size="md" loading={saving}>
            Create client
          </Button>
          <Link href="/admin/clients">
            <Button type="button" variant="quiet" size="md">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
