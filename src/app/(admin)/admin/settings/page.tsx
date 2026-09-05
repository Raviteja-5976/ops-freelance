"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { saveSettingsRecord, updateProfileRecord } from "@/lib/db";
import { defaultSettings } from "@/lib/data-store";

export default function AdminSettingsPage() {
  const { showToast } = useToast();
  const { profile, user, refreshProfile } = useAuth();
  const { settings, loading, refresh } = useData();
  const [activeTab, setActiveTab] = useState<"business" | "invoicing" | "email" | "account">("business");

  // Business tab state
  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Invoicing tab state
  const [series, setSeries] = useState(defaultSettings.invoice_series);
  // GST off is stored as a zero rate, so no extra column is needed. The rate
  // box keeps its own value while the toggle is off, ready for the day the
  // studio registers.
  const [gstEnabled, setGstEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(String(defaultSettings.default_tax_rate_bps / 100));
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  // Email tab state
  const [fromName, setFromName] = useState("OpenRiverStack");
  const [fromEmail, setFromEmail] = useState("no-reply@openriverstack.com");
  const [replyTo, setReplyTo] = useState("support@openriverstack.com");
  const [founderAlertEmail, setFounderAlertEmail] = useState("founder@openriverstack.com");
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true);
  const [notifyOnInvoice, setNotifyOnInvoice] = useState(true);
  const [notifyOnCall, setNotifyOnCall] = useState(true);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Account tab state
  const [adminName, setAdminName] = useState("");
  const [timezone, setTimezone] = useState(defaultSettings.timezone);
  const [saving, setSaving] = useState(false);

  // Hydrate the form from the saved settings row once it loads.
  useEffect(() => {
    if (!settings) return;
    setBusinessName(settings.business_name || "");
    setLegalName(settings.legal_name || "");
    setGstin(settings.gstin || "");
    setPan(settings.pan || "");
    setEmail(settings.email || "");
    setPhone(settings.phone || "");
    setAddressLine((settings.address?.line1 as string) || "");
    setCity((settings.address?.city as string) || "");
    setState((settings.address?.state as string) || "");
    setSeries(settings.invoice_series);
    setGstEnabled(settings.default_tax_rate_bps > 0);
    setTaxRate(
      settings.default_tax_rate_bps > 0
        ? String(settings.default_tax_rate_bps / 100)
        : "18"
    );
    setTerms(settings.invoice_terms || "");
    setNotes(settings.invoice_notes || "");
    setTimezone(settings.timezone);
  }, [settings]);

  useEffect(() => {
    setAdminName(profile?.full_name || "");
    setTestEmailAddress((prev) => prev || user?.email || "");
  }, [profile, user]);

  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: testEmailAddress }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const msg = data.simulated
          ? "Simulated email logged (SMTP credentials not yet set in .env.local)"
          : `Live SMTP Email dispatched! Message ID: ${data.messageId}`;
        setTestResult(msg);
        showToast(msg);
      } else {
        const errMsg = data.error || "Failed to dispatch test email";
        setTestResult(`Error: ${errMsg}`);
        showToast(errMsg, "error");
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : String(err);
      setTestResult(`Network error: ${errStr}`);
      showToast("Network error testing email", "error");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;

    const rate = Number(taxRate);
    if (gstEnabled && (!Number.isFinite(rate) || rate <= 0)) {
      showToast("Enter a GST rate above zero, or switch GST off", "error");
      return;
    }

    setSaving(true);
    try {
      await saveSettingsRecord({
        business_name: businessName.trim() || "OpenRiverStack",
        legal_name: legalName.trim() || null,
        gstin: gstin.trim() || null,
        pan: pan.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: {
          line1: addressLine.trim(),
          city: city.trim(),
          state: state.trim(),
          country: "India",
        },
        invoice_series: series.trim() || "ORS",
        // Basis points: 18% is stored as 1800.
        default_tax_rate_bps: gstEnabled ? Math.round(rate * 100) : 0,
        invoice_terms: terms.trim() || null,
        invoice_notes: notes.trim() || null,
        timezone,
      });

      if (profile && adminName.trim() && adminName.trim() !== profile.full_name) {
        await updateProfileRecord(profile.id, { full_name: adminName.trim() });
        await refreshProfile();
      }

      await refresh();
      showToast("Settings saved");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl font-sans">
      <div className="pb-2 border-b border-ink-100">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          Settings
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          Studio identity, invoicing parameters, and communication rules.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ink-100 pb-px text-[13px]">
        {[
          { key: "business", label: "Business & Legal" },
          { key: "invoicing", label: "Invoicing Defaults" },
          { key: "email", label: "Email Notifications" },
          { key: "account", label: "Studio Account" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-3.5 py-2 font-medium transition-colors ${
              activeTab === t.key
                ? "text-ink-950 font-semibold border-b-2 border-river-700 -mb-px"
                : "text-ink-600 hover:text-ink-950"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Business */}
      {activeTab === "business" && (
        <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-5">
          <div className="p-3 bg-ink-50 rounded-sm border border-ink-100 text-[12px] text-ink-600">
            Note: Changing business and tax fields affects invoices issued from now on. Previously issued invoices maintain their immutable snapshot.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Brand / Display Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <Input
              label="Legal Name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <Input
              label="GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
            <Input
              label="PAN"
              value={pan}
              onChange={(e) => setPan(e.target.value)}
            />
            <Input
              label="Studio Billing Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contact Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Input
            label="Studio Registered Address"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="State" value={state} onChange={(e) => setState(e.target.value)} />
          </div>

          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="self-start mt-2">
            Save business settings
          </Button>
        </div>
      )}

      {/* Tab: Invoicing */}
      {activeTab === "invoicing" && (
        <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Invoice Series Prefix"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              helperText="e.g. ORS results in ORS/2026-27/001"
            />
            <Input
              label="GST Rate (%)"
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              disabled={!gstEnabled}
              helperText={gstEnabled ? "Typically 18%" : "Switch GST on to edit"}
            />
          </div>

          <div className="border border-ink-100 rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[14px] font-medium text-ink-950">
                  Charge GST on invoices
                </p>
                <p className="text-[13px] text-ink-500 mt-0.5 leading-snug">
                  Leave this off until the studio is GST registered. New
                  invoices are then raised at the contract value with no tax
                  lines, and the GST columns disappear from the invoice.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gstEnabled}
                onClick={() => setGstEnabled(!gstEnabled)}
                className={`shrink-0 w-[46px] h-[26px] rounded-full border transition-colors relative ${
                  gstEnabled
                    ? "bg-river-700 border-river-700"
                    : "bg-ink-100 border-ink-200"
                }`}
              >
                <span
                  className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-surface shadow-sm transition-all ${
                    gstEnabled ? "left-[23px]" : "left-[2px]"
                  }`}
                />
              </button>
            </div>
            <p
              className={`text-[13px] font-medium ${
                gstEnabled ? "text-river-800" : "text-ink-600"
              }`}
            >
              {gstEnabled
                ? `Invoices will add ${taxRate || 0}% GST — split as CGST + SGST within your state, IGST outside it.`
                : "Invoices are currently raised without GST."}
            </p>
          </div>

          <Textarea
            label="Default Payment Terms"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />

          <Textarea
            label="Default Invoice Notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="self-start mt-2">
            Save invoicing defaults
          </Button>
        </div>
      )}

      {/* Tab: Email */}
      {activeTab === "email" && (
        <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-6">
          <div>
            <h3 className="text-[14px] font-semibold text-ink-950">Domain & Alias Routing</h3>
            <p className="text-[12px] text-ink-500 mt-0.5">
              Configured for <code className="text-river-700 font-mono">openriverstack.com</code> via Direct SMTP Mail Server.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sender Name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              helperText="Visible display name on outbound emails"
            />
            <Input
              label="Outbound Sender Alias"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              helperText="System notifications, invoices, updates (no-reply@)"
            />
            <Input
              label="Client Support / Reply-To"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              helperText="Where client responses are delivered (support@)"
            />
            <Input
              label="Founder / Admin Alerts"
              type="email"
              value={founderAlertEmail}
              onChange={(e) => setFounderAlertEmail(e.target.value)}
              helperText="Receives new booking requests & alerts (founder@)"
            />
          </div>

          {/* Alias Overview Badge Grid */}
          <div className="bg-sand-50 border border-ink-100/70 rounded p-4 text-[12px] text-ink-700 flex flex-col gap-2">
            <span className="font-semibold text-ink-900">Configured Aliases for openriverstack.com:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="bg-surface px-2.5 py-1.5 rounded border border-ink-100 flex items-center justify-between">
                <span>no-reply@openriverstack.com</span>
                <span className="text-river-700 font-sans font-medium text-[10px]">Transactional</span>
              </div>
              <div className="bg-surface px-2.5 py-1.5 rounded border border-ink-100 flex items-center justify-between">
                <span>support@openriverstack.com</span>
                <span className="text-river-700 font-sans font-medium text-[10px]">Client Helpdesk</span>
              </div>
              <div className="bg-surface px-2.5 py-1.5 rounded border border-ink-100 flex items-center justify-between">
                <span>founder@openriverstack.com</span>
                <span className="text-river-700 font-sans font-medium text-[10px]">Founder Inbox</span>
              </div>
              <div className="bg-surface px-2.5 py-1.5 rounded border border-ink-100 flex items-center justify-between">
                <span>info@openriverstack.com</span>
                <span className="text-river-700 font-sans font-medium text-[10px]">General Inquiries</span>
              </div>
            </div>
          </div>

          <div className="border-t border-ink-100 pt-4 flex flex-col gap-3">
            <h3 className="text-[14px] font-semibold text-ink-950">Automated Client Notifications</h3>
            <label className="flex items-center gap-2 text-[13px] text-ink-800 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnUpdate}
                onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                className="rounded-xs text-river-700"
              />
              Email client immediately when a project update is published (via no-reply@)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-800 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnInvoice}
                onChange={(e) => setNotifyOnInvoice(e.target.checked)}
                className="rounded-xs text-river-700"
              />
              Email client immediately when a new tax invoice is issued (via no-reply@)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-800 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnCall}
                onChange={(e) => setNotifyOnCall(e.target.checked)}
                className="rounded-xs text-river-700"
              />
              Email confirmation with meeting link when a call request is approved
            </label>
          </div>

          <div className="border-t border-ink-100 pt-4 flex flex-col gap-3">
            <h3 className="text-[14px] font-semibold text-ink-950">Direct SMTP Delivery Verification</h3>
            <p className="text-[12px] text-ink-500">
              Send a real test email through your SMTP mail server to verify credentials and connectivity.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <Input
                  label="Test Recipient"
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="e.g. founder@openriverstack.com"
                />
              </div>
              <div className="sm:pt-5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest}
                >
                  {isSendingTest ? "Sending Test..." : "Send Test via SMTP"}
                </Button>
              </div>
            </div>
            {testResult && (
              <div className="p-3 bg-surface border border-ink-100 rounded text-[12px] font-mono text-ink-700">
                {testResult}
              </div>
            )}
          </div>

          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="self-start mt-1">
            Save email settings
          </Button>
        </div>
      )}

      {/* Tab: Account */}
      {activeTab === "account" && (
        <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-5">
          <Input
            label="Operator Full Name"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600 font-sans">
              Studio Operating Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>

          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="self-start mt-2">
            Save account settings
          </Button>
        </div>
      )}
    </div>
  );
}
