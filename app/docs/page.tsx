import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import appConfig from "@/settings";

export const metadata: Metadata = {
  title: `Documentation de l'API — ${appConfig.appName}`,
  description:
    "Créez, vérifiez et suivez vos QR codes sécurisés depuis votre propre plateforme avec l'API ScanHub.",
};

const BASE_URL = `${(process.env.NEXT_PUBLIC_APP_URL || "https://votre-scanhub").replace(/\/$/, "")}/api/v1/integrations`;

const SECTIONS = [
  { id: "demarrer", title: "Démarrer en 5 minutes" },
  { id: "auth", title: "Authentification" },
  { id: "creer", title: "Créer des QR codes" },
  { id: "doublons", title: "Réessayer sans doublon" },
  { id: "verifier", title: "Vérifier et valider" },
  { id: "presences", title: "Lire les présences" },
  { id: "webhooks", title: "Webhooks" },
  { id: "reference", title: "Tous les appels" },
  { id: "erreurs", title: "Erreurs et limites" },
];

const ENDPOINTS = [
  ["GET", "/events", "Vos événements"],
  ["POST", "/events", "Créer un événement"],
  ["POST", "/qrs", "Créer un QR code"],
  ["POST", "/qrs/batch", "Créer jusqu'à 500 QR codes"],
  ["GET", "/qrs", "Lister vos QR codes"],
  ["GET", "/qrs/:id", "Détail d'un code (identifiant ScanHub ou votre externalId)"],
  ["GET", "/qrs/:id/image", "Image du QR code (?format=png|svg, ?size=64…1024)"],
  ["POST", "/qrs/:id/revoke", "Révoquer un code"],
  ["POST", "/qrs/:id/restore", "Rétablir un code révoqué"],
  ["POST", "/verify", "Vérifier un code sans le consommer"],
  ["POST", "/consume", "Valider un passage"],
  ["GET", "/scans", "Lire les scans (présences)"],
  ["GET", "/webhooks", "Vos adresses de notification"],
  ["POST", "/webhooks", "Ajouter une adresse de notification"],
  ["GET", "/webhooks/:id", "État d'une adresse et ses derniers envois"],
  ["POST", "/webhooks/:id/test", "Envoyer un événement de test"],
  ["DELETE", "/webhooks/:id", "Supprimer une adresse"],
];

const RESULT_CODES = [
  ["VALID", "Le code est bon."],
  ["ALREADY_USED", "Billet à usage unique déjà validé."],
  ["EXPIRED", "Date de validité dépassée."],
  ["REVOKED", "Code révoqué."],
  ["UNAUTHORIZED", "Le code appartient à un autre événement que celui indiqué."],
  ["EVENT_CLOSED", "L'événement est suspendu ou clôturé."],
  ["INVALID", "Code inconnu."],
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4 border-t border-gray-200 pt-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold">
            {appConfig.appName} <span className="font-normal text-gray-500">· API</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Obtenir une clé API</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-6 space-y-1 text-sm">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded px-2 py-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 space-y-10 text-sm leading-relaxed text-gray-700">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">API ScanHub</h1>
            <p className="text-base">
              Créez des QR codes sécurisés depuis votre propre plateforme, faites-les contrôler avec
              l'application ScanHub ou depuis votre application, et récupérez les présences.
            </p>
            <p>
              Adresse de base : <code className="rounded bg-gray-100 px-1.5 py-0.5">{BASE_URL}</code>
            </p>
          </div>

          <Section id="demarrer" title="Démarrer en 5 minutes">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <Link href="/auth/signup" className="text-blue-600 underline">
                  Créez votre espace
                </Link>{" "}
                (gratuit).
              </li>
              <li>
                Dans <strong>Billetteries (API)</strong>, cliquez sur « Générer une clé API ». La clé
                n'est affichée qu'une fois.
              </li>
              <li>Créez un événement dans le tableau de bord, ou par l'API.</li>
              <li>Créez votre premier QR code :</li>
            </ol>
            <Code>{`curl -X POST ${BASE_URL}/qrs \\
  -H "x-api-key: VOTRE_CLE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "externalId": "BADGE-0001",
    "type": "BADGE",
    "eventId": "ID_DE_VOTRE_EVENEMENT",
    "holderName": "Awa Diallo",
    "holderRole": "Ambassadrice"
  }'`}</Code>
            <p>Réponse :</p>
            <Code>{`{
  "id": "cmv…",
  "externalId": "BADGE-0001",
  "token": "SCN_8F72K91X…",   // à mettre dans le QR code
  "type": "BADGE",
  "status": "ACTIVE",
  "reusable": true,
  "created": true
}`}</Code>
            <p>
              Mettez <code>token</code> dans votre QR code, ou demandez directement l'image à ScanHub
              avec <code>GET /qrs/BADGE-0001/image</code>. C'est tout : le code est scannable.
            </p>
          </Section>

          <Section id="auth" title="Authentification">
            <p>
              Chaque requête porte votre clé dans l'en-tête <code>x-api-key</code>. La clé donne accès
              à votre espace uniquement. Gardez-la côté serveur : ne la mettez jamais dans une page web
              ou une application mobile.
            </p>
            <p>
              En cas de fuite, régénérez-la dans le tableau de bord : l'ancienne cesse de fonctionner
              tout de suite.
            </p>
          </Section>

          <Section id="creer" title="Créer des QR codes">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-4 font-semibold">Champ</th>
                    <th className="py-2 font-semibold">Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["externalId", "Votre propre référence (numéro de badge, de commande…). Recommandé."],
                    ["type", "TICKET, INVITATION (usage unique) · BADGE, PASS, COUPON (réutilisables). Défaut : TICKET."],
                    ["eventId", "Événement auquel rattacher le code."],
                    ["holderName, holderEmail, holderRole", "Affichés à l'agent au moment du scan."],
                    ["reusable", "Force le caractère réutilisable ou non."],
                    ["expiresAt", "Date limite de validité (ISO 8601, ex. 2026-12-31T23:59:59Z)."],
                    ["metadata", "Objet libre, renvoyé tel quel."],
                    ["token", "Optionnel : votre propre code. Doit être long (24+) et aléatoire, sinon il est refusé."],
                  ].map(([field, text]) => (
                    <tr key={field}>
                      <td className="py-2 pr-4 align-top font-mono text-gray-900">{field}</td>
                      <td className="py-2">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <strong>En lot</strong> — jusqu'à 500 codes par appel. <code>eventId</code> et{" "}
              <code>type</code> donnés à la racine s'appliquent aux éléments qui ne les précisent pas :
            </p>
            <Code>{`curl -X POST ${BASE_URL}/qrs/batch \\
  -H "x-api-key: VOTRE_CLE" -H "Content-Type: application/json" \\
  -d '{
    "eventId": "ID_DE_VOTRE_EVENEMENT",
    "type": "BADGE",
    "qrs": [
      { "externalId": "BADGE-0001", "holderName": "Awa Diallo" },
      { "externalId": "BADGE-0002", "holderName": "Moussa Ibrahim" }
    ]
  }'`}</Code>
          </Section>

          <Section id="doublons" title="Réessayer sans doublon">
            <p>
              Si une requête échoue à cause du réseau, renvoyez-la telle quelle. Quand{" "}
              <code>externalId</code> est déjà connu, ScanHub rend le code d'origine avec le statut{" "}
              <code>200</code> et <code>"created": false</code>, au lieu d'en créer un second. C'est
              vrai aussi pour chaque élément d'un lot.
            </p>
          </Section>

          <Section id="verifier" title="Vérifier et valider">
            <p>
              Deux façons de contrôler un code : avec l'application mobile ScanHub (rien à développer),
              ou depuis votre propre application avec ces deux appels.
            </p>
            <Code>{`# Vérifier, sans rien modifier
curl -X POST ${BASE_URL}/verify \\
  -H "x-api-key: VOTRE_CLE" -H "Content-Type: application/json" \\
  -d '{ "token": "SCN_8F72K91X…", "eventId": "ID_DE_VOTRE_EVENEMENT" }'

# Valider un passage (un billet à usage unique devient « utilisé »)
curl -X POST ${BASE_URL}/consume \\
  -H "x-api-key: VOTRE_CLE" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: 6f1c0c1e-…" \\
  -d '{ "token": "SCN_8F72K91X…", "eventId": "ID_DE_VOTRE_EVENEMENT" }'`}</Code>
            <p>
              <code>Idempotency-Key</code> : une valeur unique par passage (un UUID). Rejouer la même
              requête rend le même résultat au lieu de compter un second passage.
            </p>
            <p>La réponse contient <code>valid</code> (vrai ou faux) et <code>code</code> :</p>
            <ul className="space-y-1">
              {RESULT_CODES.map(([code, text]) => (
                <li key={code}>
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-900">{code}</code> — {text}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="presences" title="Lire les présences">
            <p>
              <code>GET /scans</code> rend les scans de votre espace, du plus ancien au plus récent.
              Gardez <code>nextCursor</code> et repassez-le dans <code>?after=</code> : vous ne recevez
              que les nouveaux scans, y compris ceux faits sans connexion et arrivés plus tard.
            </p>
            <Code>{`curl "${BASE_URL}/scans?eventId=ID&after=DERNIER_CURSEUR" -H "x-api-key: VOTRE_CLE"

{
  "scans": [{
    "id": "cmv…",
    "result": "VALID",
    "scannedAt": "2026-10-11T09:14:03.000Z",
    "qr": { "id": "cmv…", "externalId": "BADGE-0001", "type": "BADGE" },
    "holderName": "Awa Diallo",
    "operator": { "type": "agent", "name": "Agent Contrôleur" }
  }],
  "hasMore": false,
  "nextCursor": "cmv…"
}`}</Code>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p>
              Plutôt que d'interroger l'API, donnez à ScanHub une adresse de votre serveur : il y envoie
              chaque scan dès qu'il est enregistré. Ajoutez l'adresse dans{" "}
              <strong>Billetteries (API)</strong> ou avec <code>POST /webhooks</code>. Vous recevez
              alors un <strong>secret de signature</strong>, affiché une seule fois.
            </p>
            <Code>{`POST https://votre-site.com/api/scanhub
ScanHub-Event: scan.created
ScanHub-Delivery: cmv…
ScanHub-Signature: t=1791700000,v1=5f2b…

{
  "id": "cmv…",                 // identifiant de l'envoi : ignorez un id déjà traité
  "type": "scan.created",
  "createdAt": "2026-10-11T09:14:03.120Z",
  "data": { "scan": { "id": "…", "result": "VALID", "qr": { "externalId": "BADGE-0001" } } }
}`}</Code>
            <p>
              <strong>Vérifiez toujours la signature</strong> avant de faire confiance au contenu.
              Elle est calculée sur le texte brut reçu, pas sur un objet re-sérialisé :
            </p>
            <Code>{`import crypto from "node:crypto";

export function verifyScanHubSignature(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");

  const recent = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300; // 5 minutes
  const a = Buffer.from(expected), b = Buffer.from(parts.v1 ?? "");
  return recent && a.length === b.length && crypto.timingSafeEqual(a, b);
}`}</Code>
            <ul className="list-disc space-y-1 pl-5">
              <li>Répondez avec un statut <code>2xx</code> en moins de 8 secondes.</li>
              <li>
                Sinon ScanHub réessaie jusqu'à 5 fois, avec un délai croissant (1 min, 5 min, 30 min,
                2 h, 12 h).
              </li>
              <li>
                Un même envoi peut arriver deux fois : servez-vous de son <code>id</code> pour l'ignorer.
              </li>
              <li>
                Après un grand nombre d'échecs d'affilée, l'adresse est désactivée ; vous la réactivez
                depuis le tableau de bord.
              </li>
            </ul>
          </Section>

          <Section id="reference" title="Tous les appels">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <tbody className="divide-y divide-gray-100">
                  {ENDPOINTS.map(([method, path, text]) => (
                    <tr key={method + path}>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold text-white ${
                            method === "GET" ? "bg-emerald-600" : method === "DELETE" ? "bg-red-600" : "bg-blue-600"
                          }`}
                        >
                          {method}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-gray-900">{path}</td>
                      <td className="py-2">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="erreurs" title="Erreurs et limites">
            <p>
              Une erreur a toujours la forme <code>{`{ "error": "message", "status": 400 }`}</code>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><code>400</code> — requête mal formée ; <code>details</code> précise le champ.</li>
              <li><code>401</code> — clé API absente ou invalide.</li>
              <li><code>403</code> — limite de votre formule atteinte, ou espace suspendu.</li>
              <li><code>404</code> — ressource introuvable dans votre espace.</li>
              <li><code>409</code> — conflit (code déjà enregistré, code non révoqué…).</li>
              <li><code>422</code> — valeur refusée (code fourni trop prévisible, adresse invalide…).</li>
              <li><code>429</code> — trop de requêtes : 600 par minute et par clé. Attendez le délai indiqué dans <code>Retry-After</code>.</li>
            </ul>
          </Section>
        </article>
      </div>
    </main>
  );
}
