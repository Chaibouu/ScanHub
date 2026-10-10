import nodemailer, { TransportOptions } from "nodemailer";
import appConfig from "@/settings";

const domain = process.env.NEXT_PUBLIC_APP_URL;
// MAIL_FROM peut déjà être au format "Nom <adresse>"
const fromHeader = appConfig.mailFrom?.includes("<")
  ? appConfig.mailFrom
  : `${appConfig.appName} <${appConfig.mailFrom}>`;
const transporter = nodemailer.createTransport(
  appConfig.mailOptions as TransportOptions
);

export const sendTwoFactorTokenEmail = async (email: string, token: string) => {
  const mailOptions = {
    from: fromHeader,
    to: email,
    subject: "2FA Code",
    html: `<p>Your 2FA code: ${token}</p>`,
  };
  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const encodedToken = encodeURIComponent(token);

  const resetLink = `${domain}/auth/reset-password?token=${encodedToken}`;

  const mailOptions = {
    from: fromHeader,
    to: email,
    subject: "Reset your password",
    html: `<p>Click <a href="${resetLink}">here</a> to reset password.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

export const sendVerificationEmail = async (email: string, token: string) => {
  const encodedToken = encodeURIComponent(token);
  const confirmLink = `${domain}/auth/verify?token=${encodedToken}`;

  const mailOptions = {
    from: fromHeader,
    to: email,
    subject: "Vérification de votre compte",
    html: `<p>Merci de vous être inscrit. Cliquez sur le lien suivant pour      vérifier votre compte :</p>
  <a href="${confirmLink}">Vérifiez votre compte</a>`,
  };

  await transporter.sendMail(mailOptions);
};

export const sendLoginNotificationEmail = async (
  email: string,
  info: {
    device: string;
    browser: string;
    os: string;
    ip: string;
    city: string;
    country: string;
    time: string;
  }
) => {
  const mailOptions = {
    from: fromHeader,
    to: email,
    subject: "Nouvelle connexion à votre compte",
    html: `
      <p>Bonjour,</p>
      <p>Une nouvelle connexion a été détectée sur votre compte depuis un appareil inconnu.</p>
      <table style="border-collapse:collapse;width:100%;max-width:480px;">
        <tr><td style="padding:6px 0;color:#666;">Appareil</td><td style="padding:6px 0;font-weight:bold;">${info.device}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Navigateur</td><td style="padding:6px 0;">${info.browser}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Système</td><td style="padding:6px 0;">${info.os}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Adresse IP</td><td style="padding:6px 0;">${info.ip}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Localisation</td><td style="padding:6px 0;">${info.city}, ${info.country}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;">${info.time}</td></tr>
      </table>
      <p style="margin-top:16px;">Si c'est bien vous, vous pouvez ignorer cet email.</p>
      <p><strong>Si ce n'est pas vous</strong>, changez immédiatement votre mot de passe et activez la double authentification.</p>
      <p>Cordialement,<br>${appConfig.appName}</p>
    `,
  };
  await transporter.sendMail(mailOptions);
};

export const sendChangeEmailVerification = async (
  email: string,
  verificationToken: string
) => {
  const encodedToken = encodeURIComponent(verificationToken);
  const verificationLink = `${domain}/auth/verify-email?token=${encodedToken}`;

  const mailOptions = {
    from: fromHeader,
    to: email,
    subject: "Confirmation de changement d'adresse e-mail",
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à changer votre adresse e-mail. Cliquez sur le lien ci-dessous pour confirmer :</p>
      <a href="${verificationLink}">Modifier mon email</a>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      <p>Cordialement,</p>
      <p>L'équipe ${appConfig.appName}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
