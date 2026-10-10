"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTicketAction, importTicketsAction } from "@/actions/tickets";

const TYPE_OPTIONS = [
  { value: "TICKET", label: "Billet (usage unique)" },
  { value: "INVITATION", label: "Invitation (usage unique)" },
  { value: "BADGE", label: "Badge (réutilisable)" },
  { value: "PASS", label: "Pass (réutilisable)" },
];

const fieldClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
const labelClass = "text-xs font-medium text-gray-600 dark:text-gray-300";

function TypeSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
      {TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Ajout d'un billet à la main. */
export function CreateTicketForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [holderName, setHolderName] = useState("");
  const [holderEmail, setHolderEmail] = useState("");
  const [holderRole, setHolderRole] = useState("");
  const [type, setType] = useState("TICKET");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createTicketAction(eventId, { holderName, holderEmail, holderRole, type });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setHolderName("");
      setHolderEmail("");
      setHolderRole("");
      toast.success("Billet créé.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-5 md:items-end">
      <div className="space-y-1">
        <label htmlFor="ticket-name" className={labelClass}>
          Nom du participant
        </label>
        <Input
          id="ticket-name"
          value={holderName}
          onChange={(e) => setHolderName(e.target.value)}
          placeholder="Ex : Aïcha Mahamadou"
          minLength={2}
          maxLength={150}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ticket-email" className={labelClass}>
          Email (optionnel)
        </label>
        <Input
          id="ticket-email"
          type="email"
          value={holderEmail}
          onChange={(e) => setHolderEmail(e.target.value)}
          placeholder="participant@domaine.com"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ticket-role" className={labelClass}>
          Catégorie (optionnel)
        </label>
        <Input
          id="ticket-role"
          value={holderRole}
          onChange={(e) => setHolderRole(e.target.value)}
          placeholder="Ex : VIP, Exposant"
          maxLength={100}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="ticket-type" className={labelClass}>
          Type
        </label>
        <TypeSelect id="ticket-type" value={type} onChange={setType} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Création…" : "Ajouter le billet"}
      </Button>
    </form>
  );
}

/** Import d'une liste de participants : un billet est généré par ligne. */
export function ImportTicketsForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [csv, setCsv] = useState("");
  const [defaultType, setDefaultType] = useState("TICKET");

  const lineCount = csv.split(/\r?\n/).filter((line) => line.trim()).length;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("Fichier trop volumineux (1 Mo maximum).");
      return;
    }
    setCsv(await file.text());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await importTicketsAction(eventId, { csv, defaultType });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCsv("");
      if (fileInput.current) fileInput.current.value = "";
      toast.success(`${result.count} billet(s) créé(s).`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-500">
        Fichier CSV (exporté depuis Excel) avec une ligne par participant. Colonnes reconnues :{" "}
        <code>nom</code>, <code>email</code>, <code>catégorie</code>, <code>type</code>. Sans
        ligne de titres, l'ordre attendu est : nom ; email ; catégorie.
      </p>
      <div className="grid gap-3 md:grid-cols-3 md:items-end">
        <div className="space-y-1">
          <label htmlFor="import-file" className={labelClass}>
            Fichier CSV
          </label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="block w-full text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="import-type" className={labelClass}>
            Type par défaut
          </label>
          <TypeSelect id="import-type" value={defaultType} onChange={setDefaultType} />
        </div>
        <Button type="submit" disabled={isPending || lineCount === 0}>
          {isPending ? "Import…" : lineCount > 0 ? `Importer ${lineCount} ligne(s)` : "Importer"}
        </Button>
      </div>
      <div className="space-y-1">
        <label htmlFor="import-text" className={labelClass}>
          …ou collez la liste ici
        </label>
        <textarea
          id="import-text"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={4}
          placeholder={"nom;email;catégorie\nAïcha Mahamadou;aicha@exemple.com;VIP"}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
        />
      </div>
    </form>
  );
}
