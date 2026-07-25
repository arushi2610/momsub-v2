import React from 'react';
import { ArrowLeft } from 'lucide-react';
import logo from '../assets/logo.jpg';

export type LegalPage = 'privacy' | 'terms';

const LAST_UPDATED = 'July 25, 2026';
const SUPPORT_PHONE = '847-213-9336';
// Fill these in before relying on these documents.
const COMPANY = '[MomSub — your registered legal entity name]';
const CONTACT_EMAIL = '[your contact email]';
const GOVERNING_LAW = '[your state/country]';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-text-main tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-text-sub leading-relaxed">{children}</div>
    </section>
  );
}

export default function Legal({ page }: { page: LegalPage }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border-theme sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src={logo} alt="MomSub" className="h-8 w-auto" />
          </a>
          <nav className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
            <a href="/privacy" className={page === 'privacy' ? 'text-primary' : 'text-text-sub hover:text-text-main'}>Privacy</a>
            <a href="/terms" className={page === 'terms' ? 'text-primary' : 'text-text-sub hover:text-text-main'}>Terms</a>
            <a href="/" className="flex items-center gap-1 text-text-sub hover:text-text-main">
              <ArrowLeft className="w-3.5 h-3.5" /> App
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 md:py-16 space-y-8">
        {page === 'privacy' ? <Privacy /> : <Terms />}

        <footer className="pt-8 border-t border-border-theme text-xs text-text-sub flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} MomSub. All rights reserved.</span>
          <span>
            Questions? Call <a href={`tel:${SUPPORT_PHONE}`} className="text-primary font-bold">{SUPPORT_PHONE}</a>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Privacy() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-black text-text-main tracking-tight">Privacy Policy</h1>
        <p className="text-xs font-bold text-text-sub uppercase tracking-widest mt-2">Last updated: {LAST_UPDATED}</p>
      </div>

      <p className="text-sm text-text-sub leading-relaxed">
        This Privacy Policy explains how {COMPANY} (“MomSub,” “we,” “us”) collects, uses, and protects information
        when you use the MomSub platform for scheduling and managing childcare between families and caregivers.
      </p>

      <Section title="Information we collect">
        <p>We collect only what we need to run the service:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account details</strong> — your name, email address, phone number, and your role (parent, nanny, or admin).</li>
          <li><strong>Schedule information</strong> — recurring and weekly schedules, shift times, hours worked, adjustments, and any notes or reasons you add to a schedule.</li>
          <li><strong>Messages</strong> — messages you send through the app, including schedule discussions and dispute conversations.</li>
          <li><strong>Usage and technical data</strong> — basic information needed to keep your session secure, such as sign-in activity and automatic sign-out after inactivity.</li>
        </ul>
        <p>We do <strong>not</strong> collect payment card numbers or bank details through the app.</p>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and manage your account and verify who you are.</li>
          <li>To match families with caregivers and let both sides view, request, and approve weekly schedules.</li>
          <li>To send notifications about schedule requests, approvals, and changes.</li>
          <li>To provide support and respond to questions or disputes.</li>
          <li>To keep the platform secure and prevent unauthorized access.</li>
        </ul>
      </Section>

      <Section title="How your information is shared">
        <p>Your information is visible only to the people who need it:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Between matched parties.</strong> A parent and the nanny they are matched with can see each other’s name, phone number, and the schedules and messages they share.</li>
          <li><strong>With administrators.</strong> MomSub admins can view accounts, matches, and schedules to operate the service and help resolve disputes.</li>
          <li><strong>With service providers.</strong> We use Google Firebase (Authentication and Firestore) to host the app, store data, and send account emails such as password resets. Your data is processed on Google’s infrastructure under Google’s security and privacy terms.</li>
        </ul>
        <p>We do not sell your personal information, and we do not share it with advertisers.</p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep your information for as long as your account is active and as needed to provide the service and keep
          accurate records of hours and schedules. You may ask us to close your account and delete your personal
          information, subject to any records we are legally required to keep.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access to data is controlled by security rules that limit each person to their own records and the records
          of people they are matched with. Sessions automatically sign out after a period of inactivity. Administrator
          access is protected by an additional access code. No system is perfectly secure, but we work to protect your
          information from unauthorized access.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          Depending on where you live, you may have the right to access, correct, or delete your personal information,
          or to object to certain processing. To make a request, contact us using the details below and we will respond
          within a reasonable time.
        </p>
      </Section>

      <Section title="Children’s privacy">
        <p>
          MomSub is intended for use by adults (parents, caregivers, and administrators). Accounts are not created by
          or for children. While schedules may reference care for a family’s children, the app does not knowingly
          collect personal information directly from children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will change the “Last updated” date above.
          Continued use of MomSub after an update means you accept the revised policy.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about this policy or your data? Contact {COMPANY} at {CONTACT_EMAIL} or {SUPPORT_PHONE}.
        </p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <div>
        <h1 className="text-3xl font-black text-text-main tracking-tight">Terms of Service</h1>
        <p className="text-xs font-bold text-text-sub uppercase tracking-widest mt-2">Last updated: {LAST_UPDATED}</p>
      </div>

      <p className="text-sm text-text-sub leading-relaxed">
        These Terms of Service (“Terms”) govern your use of the MomSub platform operated by {COMPANY} (“MomSub,” “we,”
        “us”). By creating an account or using the app, you agree to these Terms. If you do not agree, please do not use
        MomSub.
      </p>

      <Section title="What MomSub does">
        <p>
          MomSub is a scheduling and coordination tool that helps families and caregivers agree on weekly childcare
          schedules, request adjustments, approve hours, and communicate. MomSub provides the software; it does not
          employ caregivers and is not a party to any employment or care arrangement between a family and a caregiver.
        </p>
      </Section>

      <Section title="Accounts">
        <ul className="list-disc pl-5 space-y-1">
          <li>You must provide accurate information and keep your login credentials confidential.</li>
          <li>You are responsible for activity that happens under your account.</li>
          <li>Parent and nanny accounts are available to anyone; administrator accounts require a valid admin access code or an invitation from an existing administrator.</li>
          <li>You must be at least 18 years old to create an account.</li>
        </ul>
      </Section>

      <Section title="Schedules, hours, and approvals">
        <ul className="list-disc pl-5 space-y-1">
          <li>An administrator sets a recurring schedule for each family–caregiver pair. Individual weeks inherit that schedule until someone adjusts them.</li>
          <li>Either the parent or the nanny may request an adjustment to a week’s schedule, and the other party must approve it or propose their own change.</li>
          <li>Adjustments may be requested up to seven days after the end of the week in question; after that, the week is closed.</li>
          <li>You are responsible for the accuracy of the schedules and hours you submit and approve. MomSub records what you enter but does not independently verify hours worked.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use MomSub for any unlawful purpose or to harass, abuse, or harm another person.</li>
          <li>Attempt to access accounts or data that are not yours, or interfere with the security of the platform.</li>
          <li>Submit false information or impersonate someone else.</li>
          <li>Copy, resell, or attempt to reverse-engineer the platform.</li>
        </ul>
      </Section>

      <Section title="Payments between families and caregivers">
        <p>
          MomSub helps you record and agree on schedules and hours. Any payment, wages, taxes, or employment obligations
          between a family and a caregiver are solely between those parties. MomSub does not process payments and is not
          responsible for how the parties handle compensation.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          MomSub is provided “as is” and “as available,” without warranties of any kind, whether express or implied. We
          do not guarantee that the service will be uninterrupted, error-free, or that it will meet your specific needs.
          MomSub is not responsible for the conduct of any user, or for the quality, safety, or legality of any care
          arrangement made using the platform.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, {COMPANY} will not be liable for any indirect, incidental, or
          consequential damages arising from your use of MomSub. Our total liability for any claim relating to the
          service is limited to the amount you paid us, if any, in the twelve months before the claim.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You may stop using MomSub at any time. We may suspend or close an account that violates these Terms or that we
          reasonably believe poses a risk to other users or the platform.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of {GOVERNING_LAW}, without regard to its conflict-of-laws rules. Any
          disputes will be handled in the courts located there, unless applicable law requires otherwise.
        </p>
      </Section>

      <Section title="Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will change the “Last updated” date above.
          Continued use of MomSub after an update means you accept the revised Terms.
        </p>
      </Section>

      <Section title="Contact us">
        <p>Questions about these Terms? Contact {COMPANY} at {CONTACT_EMAIL} or {SUPPORT_PHONE}.</p>
      </Section>
    </>
  );
}
