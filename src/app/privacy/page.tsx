import type { Metadata } from "next";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE_NAME} collects, why, and how to have it deleted.`,
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const linkClass = "font-medium text-primary underline underline-offset-4";

export default function PrivacyPage() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
      {CONTACT_EMAIL}
    </a>
  );

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 leading-relaxed [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold md:text-4xl">Privacy</h1>
        <p className="text-muted-foreground">Last updated {LAST_UPDATED}</p>
        <p>
          {SITE_NAME} is a small community recipe site. We collect only what the site needs to work,
          we don&apos;t sell or share your data for advertising, and there are no ads, analytics, or
          tracking scripts.
        </p>
      </header>

      <Section title="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> your name and email. Your password is stored only as a
            one-way hash, so nobody (including us) can read it. If you sign in with Google, we
            receive your name, email, and profile photo from Google.
          </li>
          <li>
            <strong>What you post:</strong> recipes and their photos.
          </li>
          <li>
            <strong>Security records:</strong> recent login, signup, and password reset attempts
            (email or IP address and time), kept for 24 hours to stop password guessing, and our web
            server&apos;s access logs, kept for about two weeks.
          </li>
          <li>
            <strong>AI features:</strong> we count how many questions each account asks so we can
            apply the hourly limit. We don&apos;t store the questions or answers.
          </li>
        </ul>
      </Section>

      <Section title="What's public">
        <p>
          Recipes, their photos, and your name (on your profile page and next to your recipes) are
          visible to anyone. Your email address is never shown on the site.
        </p>
        <p>
          Photos are published as you upload them. Some phones store the place a photo was taken
          inside the file, so turn off location for your camera, or remove it before uploading, if
          you&apos;d rather not share it.
        </p>
      </Section>

      <Section title="Cookies and browser storage">
        <ul>
          <li>One cookie keeps you signed in. It is removed when you log out.</li>
          <li>
            Your browser remembers your light or dark theme choice and an unsaved recipe draft.
            These stay on your device.
          </li>
        </ul>
      </Section>

      <Section title="Services that handle your data">
        <ul>
          <li>
            <strong>DigitalOcean</strong> hosts the site, the database, recipe photos, and backups.
          </li>
          <li>
            <strong>Anthropic</strong> receives the questions you ask the cooking assistant and
            pantry ideas, along with the recipe you asked about, to write an answer.
          </li>
          <li>
            <strong>Resend</strong> delivers password reset emails.
          </li>
          <li>
            <strong>Google</strong> handles sign-in if you choose &quot;Continue with Google&quot;.
          </li>
        </ul>
      </Section>

      <Section title="Backups">
        <p>
          The database is backed up every night. Backups are private and are deleted after 14 days.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete any of your recipes at any time from the recipe page. To delete your whole
          account, email {mail} from the address you signed up with. We&apos;ll delete your account
          and your recipes and photos. Copies in backups disappear within 14 days.
        </p>
      </Section>

      <Section title="Questions">
        <p>Email {mail}. If this page changes, we&apos;ll update the date at the top.</p>
      </Section>
    </article>
  );
}
