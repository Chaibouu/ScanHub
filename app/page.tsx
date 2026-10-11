import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import appConfig from "@/settings";
import { PLANS, formatLimit } from "@/settings/plans";

const STEPS = [
  {
    title: "Créez votre espace",
    text: "Inscrivez votre organisation en une minute. Vos données sont séparées de celles des autres organisateurs.",
  },
  {
    title: "Ajoutez vos billets",
    text: "Importez votre liste de participants ou connectez votre billetterie. ScanHub génère un QR code par billet.",
  },
  {
    title: "Contrôlez à l'entrée",
    text: "Vos agents scannent avec leur téléphone. Un billet déjà utilisé, annulé ou inconnu est refusé tout de suite.",
  },
];

const FEATURES = [
  {
    title: "Fonctionne sans internet",
    text: "Le téléphone garde la liste des billets. Les contrôles continuent pendant une coupure et se synchronisent ensuite.",
  },
  {
    title: "Un billet, une seule entrée",
    text: "Même si deux agents scannent le même billet au même instant, un seul passage est accepté.",
  },
  {
    title: "Suivi en direct",
    text: "Entrées validées, refus, agents et terminaux : tout est visible dans votre tableau de bord et exportable.",
  },
  {
    title: "Une API pour votre plateforme",
    text: "Créez vos QR codes depuis votre site ou votre billetterie, et recevez chaque scan en direct.",
  },
  {
    title: "Vos téléphones, sous contrôle",
    text: "Chaque terminal est activé par un code à usage unique et peut être bloqué en un clic s'il est perdu.",
  },
];

export default function Home() {
  const free = PLANS.FREE;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <Image src={appConfig.logoUrl} alt="" width={36} height={36} className="rounded" />
          {appConfig.appName}
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/docs">
            <Button variant="ghost">API</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="ghost">Se connecter</Button>
          </Link>
          <Link href="/auth/signup">
            <Button>Créer mon espace</Button>
          </Link>
        </nav>
      </header>

      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Contrôlez les entrées de votre événement avec de simples QR codes
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            ScanHub vérifie vos billets, badges et invitations en une seconde, depuis un téléphone,
            même sans connexion. Pour les concerts, conférences, salons, mariages et cérémonies.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup">
              <Button size="lg">Commencer gratuitement</Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline">
                J'ai déjà un espace
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-sm text-gray-500">Gratuit, sans carte bancaire.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold">Comment ça marche</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-gray-200 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold">Pensé pour le terrain</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold">Gratuit pour tous les organisateurs</h2>
        <p className="mt-3 text-gray-600">Tout est inclus dès l'inscription :</p>
        <ul className="mx-auto mt-6 grid max-w-xl gap-3 text-left text-sm sm:grid-cols-2">
          <li className="rounded-lg border border-gray-200 px-4 py-3">
            {formatLimit(free.maxActiveEvents)} événements ouverts en même temps
          </li>
          <li className="rounded-lg border border-gray-200 px-4 py-3">
            {formatLimit(free.maxTicketsPerEvent)} billets par événement
          </li>
          <li className="rounded-lg border border-gray-200 px-4 py-3">
            {formatLimit(free.maxDevices)} téléphones de contrôle
          </li>
          <li className="rounded-lg border border-gray-200 px-4 py-3">
            {formatLimit(free.maxMembers)} membres dans votre équipe
          </li>
        </ul>
        <Link href="/auth/signup" className="mt-8 inline-block">
          <Button size="lg">Créer mon espace ScanHub</Button>
        </Link>
      </section>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} {appConfig.appName}
      </footer>
    </main>
  );
}
