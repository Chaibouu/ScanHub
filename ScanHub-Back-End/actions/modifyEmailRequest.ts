"use server";
import { makeAuthenticatedRequest } from "./makeAuthenticatedRequest";

export const changeEmail = async (body: any) => {
  const test = await makeAuthenticatedRequest(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/change-email/request`,
    "POST",
    body
  );

  return JSON.parse(JSON.stringify(test));
};
