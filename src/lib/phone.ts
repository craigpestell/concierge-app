// Phone number helpers and the free business-line guides shown at /concierge/phone.
import { brand } from "./brand";

/** Accepts a North American number in any common format. Returns its 10 digits, or null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  // Area code and exchange can't start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return digits;
}

/** 6045550142 → 604-555-0142. Anything else is returned as is. */
export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

export function telHref(phone: string) {
  const d = phone.replace(/\D/g, "");
  return `tel:${d.length === 10 ? `+1${d}` : d}`;
}

export type ProviderId = "fongo" | "textnow";

export type ProviderGuide = {
  id: ProviderId;
  name: string;
  summary: string;
  goodFor: string[];
  watchOut: string[];
  steps: { title: string; body: string; link?: { href: string; label: string } }[];
  keepAlive: string;
  sources: { href: string; label: string }[];
};

// Checked against the providers' own pages on 2026-10-29. Re-check before relying on prices.
export const PROVIDERS: ProviderGuide[] = [
  {
    id: "fongo",
    name: "Fongo Works",
    summary:
      "A free business phone system from a Canadian company. Calls to your business number can forward straight to your mobile, so clients never see your personal number.",
    goodFor: [
      "Free with no time limit and no credit card",
      "Local 778 numbers for New Westminster and Burnaby, or 604 for Vancouver",
      "Free forwarding to your mobile, voicemail and a recorded greeting",
      "Outgoing calls from the app show your business number",
    ],
    watchOut: [
      "Texting needs Fongo Works Pro ($10 a month)",
      "The free plan has no desktop app, only the phone app",
    ],
    steps: [
      {
        title: "Create your free account",
        body: `On a computer, open the Fongo Works sign-up page and choose the free plan. Use your business email (${brand.email}) so the account isn't tied to your personal one.`,
        link: { href: "https://www.fongoworks.com/signup", label: "Open Fongo Works sign-up" },
      },
      {
        title: "Pick your number",
        body: "During sign-up you choose a number at no cost. Look for New Westminster or Burnaby (778), or Vancouver (604). Pick one that's easy to say out loud.",
      },
      {
        title: "Install the Fongo Works app",
        body: "On your phone, install “Fongo Works” from the App Store or Google Play and sign in with the account you just made. It's a different app from the regular “Fongo” app, which won't accept a Fongo Works login.",
        link: { href: "https://www.fongo.com/services/fongo-works/devices/fongo-works-companion-app/", label: "Fongo Works app links" },
      },
      {
        title: "Forward calls to your mobile",
        body: "In the Fongo Works dashboard, open the Members tab, click the down arrow next to your name and choose Edit Member. Type your mobile number into the Cell Phone field. Then set call handling to “Forward To Cell Phone, Then Go To Voicemail”.",
        link: { href: "https://www.fongo.com/services/fongo-works/devices/forward-to-cellphone/", label: "Fongo's forwarding guide" },
      },
      {
        title: "Lower the ring count",
        body: "If your mobile's own voicemail picks up before Fongo's does, clients hear your personal greeting. Lower your extension's ring count in the dashboard so the business voicemail answers first.",
      },
      {
        title: "Record your greeting",
        body: `Record a short welcome and voicemail message, for example: “You've reached ${brand.name}. Leave your name and number and I'll call you back today.”`,
      },
      {
        title: "Test it",
        body: "Ask a friend to call the new number. Check it rings on your mobile, then let it go to voicemail once to hear the greeting.",
      },
    ],
    keepAlive:
      "Fongo can close a free account after 90 days with no calls in or out. Answer a call or make one from the Fongo Works app at least once every couple of months.",
    sources: [
      { href: "https://www.fongo.com/services/fongo-works/", label: "Fongo Works FAQ" },
      { href: "https://www.fongo.com/services/fongo-works/features/", label: "free and Pro features" },
      { href: "https://www.fongo.com/services/fongo-works/features/local-phone-number/", label: "area codes" },
    ],
  },
  {
    id: "textnow",
    name: "TextNow",
    summary:
      "A free calling and texting app. Your business number rings inside the app on your phone over Wi-Fi or mobile data, and texting is included.",
    goodFor: [
      "Free calls and texts, including texting clients",
      "Set up entirely from your phone in a few minutes",
      "Works on a computer too, with the TextNow desktop and web apps",
    ],
    watchOut: [
      "The free plan shows ads in the app",
      "There's no fixed rule for how long an unused number lasts, so you need to use it often",
      "In Canada it works over Wi-Fi or your mobile data only. Don't buy a TextNow SIM card, its cellular service isn't offered here",
      "A 604, 778 or 236 number isn't guaranteed. If none are offered, use Fongo Works instead",
    ],
    steps: [
      {
        title: "Install the TextNow app",
        body: "On your phone, install “TextNow: Call + Text Unlimited” from the App Store or Google Play.",
        link: { href: "https://www.textnow.com/free-phone-number", label: "TextNow free number page" },
      },
      {
        title: "Sign up with your business email",
        body: `Create an account with your business email (${brand.email}) rather than your personal one.`,
      },
      {
        title: "Choose a local number",
        body: "When asked for an area code, enter 604 first, then try 778 or 236. TextNow shows about ten numbers to choose from. If no BC numbers come up, stop here and use Fongo Works.",
      },
      {
        title: "Use it straight away",
        body: "A brand-new TextNow number can expire within 24 hours if it isn't used. Send a text or make a call from the app right after you pick it.",
      },
      {
        title: "Set up voicemail and notifications",
        body: "In the app's settings, record your voicemail greeting. Then allow TextNow notifications in your phone's settings so business calls ring even when the app is closed.",
      },
      {
        title: "Test it",
        body: "Ask a friend to call and text the new number. Check it rings with the app closed and on mobile data, not only on Wi-Fi.",
      },
    ],
    keepAlive:
      "TextNow says a call or text at least once a day keeps a free number active. A paid Lock In Number add-on in the app locks it to your account if you'd rather not worry about it.",
    sources: [
      { href: "https://www.textnow.com/free-phone-number", label: "free number" },
      { href: "https://www.textnow.com/blog/textnow-in-canada-why-wireless-service-isnt-available", label: "TextNow in Canada" },
      { href: "https://help.textnow.com/hc/en-us/articles/360043106673-Help-My-Phone-Number-was-recycled-how-can-I-get-it-back", label: "keeping your number" },
    ],
  },
];

export function providerGuide(id: string | null | undefined) {
  return PROVIDERS.find((p) => p.id === id);
}
