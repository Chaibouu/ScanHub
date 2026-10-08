# ScanHub — application mobile (Expo)

Application de contrôle d'accès pour les agents : scan de QR codes, validation des entrées,
mode hors-ligne avec synchronisation.

## Démarrage

```bash
npm install
cp .env.example .env       # renseigner EXPO_PUBLIC_API_URL
npx expo start
```

`EXPO_PUBLIC_API_URL` doit pointer vers le backend ScanHub **tel qu'il est joignable depuis le
téléphone** (adresse IP du poste en réseau local, jamais `localhost`), par exemple
`http://192.168.1.20:3000/api/v1`. En production, utiliser une URL HTTPS.

La caméra, SQLite et le stockage sécurisé sont des modules natifs : utiliser un build de
développement (`npx expo run:android` / `npx expo run:ios`, ou `eas build --profile development`).

## Première utilisation

1. **Activer le terminal** : écran de connexion → « Activer cet appareil avec un code ».
   Le code (8 caractères, usage unique, 48 h) est généré par un administrateur dans le tableau de
   bord, rubrique *Terminaux Mobiles*.
2. **Se connecter** avec un compte agent.
3. **Choisir l'événement**, puis *Synchronisation → Télécharger les QR de l'événement* pour
   préparer le mode hors-ligne.

## Mode hors-ligne

- Sans réseau, un QR n'est accepté que s'il figure dans la base locale téléchargée.
  Un QR inconnu est toujours refusé.
- Les entrées validées hors-ligne sont mises en file (SQLite) et envoyées au retour du réseau.
  Le serveur revalide chaque scan : un billet déjà utilisé ailleurs remonte en conflit.

## Vérifications

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```
