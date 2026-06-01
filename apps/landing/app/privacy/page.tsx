import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Ware-House",
  description: "How Ware-House collects, uses, and protects your data.",
};

/* NOTE: Default/boilerplate privacy policy. Review with legal counsel and
   tailor to your jurisdiction before relying on it in production. */
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="May 27, 2026">
      <LegalSection heading="Overview">
        <p>
          This Privacy Policy explains how Ware-House (&quot;we&quot;,
          &quot;us&quot;) collects, uses, and safeguards information when you use
          our inventory and sales management service (the &quot;Service&quot;).
          By using the Service, you agree to the practices described here.
        </p>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <p>
          <strong className="text-foreground">Account information.</strong>{" "}
          When you sign up, our authentication provider collects your name,
          email address, and login credentials.
        </p>
        <p>
          <strong className="text-foreground">Business data.</strong> Data you
          enter into the Service — stores, products, stock movements, sales,
          returns, customers, and team members — is stored to provide the
          Service to you.
        </p>
        <p>
          <strong className="text-foreground">Usage data.</strong> We may
          collect technical information such as device, browser, and basic
          interaction logs to operate and improve the Service.
        </p>
      </LegalSection>

      <LegalSection heading="How we use information">
        <p>
          We use information to provide and maintain the Service, authenticate
          users, process sales and inventory operations, send transactional
          messages such as store invitations, and improve reliability and
          performance.
        </p>
      </LegalSection>

      <LegalSection heading="How we share information">
        <p>
          We do not sell your personal information. We share data only with
          service providers that help us run the Service — for example
          authentication, database hosting, and transactional email — and only
          as needed to deliver the Service. We may disclose information where
          required by law.
        </p>
      </LegalSection>

      <LegalSection heading="Data storage and security">
        <p>
          Your data is stored with our infrastructure providers and protected
          with industry-standard measures. No method of transmission or storage
          is completely secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention">
        <p>
          We retain your data for as long as your account is active or as needed
          to provide the Service. You may request deletion of your account and
          associated data, subject to legal retention requirements.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on your location, you may have the right to access, correct,
          export, or delete your personal information. To exercise these rights,
          contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>
          We use essential cookies to keep you signed in and to operate the
          Service. We do not use cookies to sell your data to third parties.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be reflected by updating the &quot;Last updated&quot; date above.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a
            href="mailto:support@ware-house.app"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            support@ware-house.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
