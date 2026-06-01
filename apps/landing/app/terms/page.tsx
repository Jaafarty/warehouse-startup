import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Ware-House",
  description: "The terms that govern your use of Ware-House.",
};

/* NOTE: Default/boilerplate terms of service. Review with legal counsel and
   tailor to your jurisdiction before relying on it in production. */
export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="May 27, 2026">
      <LegalSection heading="Acceptance of terms">
        <p>
          By accessing or using Ware-House (the &quot;Service&quot;), you agree
          to be bound by these Terms of Service. If you do not agree, do not use
          the Service.
        </p>
      </LegalSection>

      <LegalSection heading="The service">
        <p>
          Ware-House provides cloud-based inventory and sales management,
          including stock tracking, sales and returns processing, analytics,
          and role-based team access. We may add, change, or remove features
          over time.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts and responsibilities">
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials and for all activity under your account. You must
          provide accurate information and promptly update it as needed.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          You agree not to misuse the Service, including by attempting to access
          it without authorization, disrupting its operation, or using it for
          unlawful purposes. You are responsible for the data you enter and for
          complying with applicable laws.
        </p>
      </LegalSection>

      <LegalSection heading="Your data">
        <p>
          You retain ownership of the business data you enter into the Service.
          You grant us the limited rights necessary to host and process that
          data in order to provide the Service. Our handling of personal data is
          described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions and payment">
        <p>
          Paid plans, where offered, are billed in advance on a recurring basis.
          Fees are non-refundable except where required by law. We may change
          pricing with reasonable notice.
        </p>
      </LegalSection>

      <LegalSection heading="Availability and warranty">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as
          available&quot; without warranties of any kind. We do not guarantee
          that the Service will be uninterrupted, error-free, or secure.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Ware-House and its providers
          will not be liable for any indirect, incidental, or consequential
          damages, or for any loss of data or profits arising from your use of
          the Service.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          You may stop using the Service at any time. We may suspend or
          terminate access if you violate these terms or use the Service in a
          way that may cause harm.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          We may update these Terms from time to time. Material changes will be
          reflected by updating the &quot;Last updated&quot; date above.
          Continued use of the Service after changes constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="Contact us">
        <p>
          Questions about these Terms? Contact us at{" "}
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
